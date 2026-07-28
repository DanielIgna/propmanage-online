"""PropBenefits · Agenți AI — AI Success Manager + AI Growth Advisor.

Success Manager: UN obiectiv — succesul utilizatorului. Propune permanent
următoarea acțiune cu cel mai mare impact. Nu notifică inutil — acționează contextual.
Growth Advisor: agent pentru Admin — analizează retenție/campanii/abonamente/orașe
și propune acțiuni concrete (determinist + sinteză LLM prin ai_core, REUSE AI Brain).
"""
import logging
from datetime import datetime, timezone, timedelta

from db import db
from propbenefits import eligibility, membership, ledger, opportunities
from propbenefits.health import subscription_health, ecosystem_health

logger = logging.getLogger("propmanage.propbenefits")


def _now():
    return datetime.now(timezone.utc)


def _iso(dt=None):
    return (dt or _now()).isoformat()


def _act(aid, title, value, cta, impact):
    """value = valoarea pentru utilizator (nu funcția); impact = estimare 1-10."""
    return {"id": aid, "title": title, "value": value, "cta_path": cta, "impact": impact}


# ---------------------------------------------------------------------------
# AI Success Manager (per utilizator)
# ---------------------------------------------------------------------------
async def success_manager(user: dict) -> dict:
    ctx = await eligibility.user_context(user)
    health = await subscription_health(user, ctx)
    wallet = await ledger.wallet_summary(ctx["uid"])
    feed = await opportunities.feed(user, limit=3)
    candidates = []

    if wallet["counts"].get("available"):
        soon = sorted(wallet["available"], key=lambda b: b.get("expires_at") or "")[0]
        candidates.append(_act("use_benefit",
                               f"Folosește beneficiul „{soon['title']}”",
                               "Îl ai deja câștigat — nu-l lăsa să expire.",
                               "/client?tab=benefits", 9))
    if ctx["documents"] < 3:
        missing = 3 - ctx["documents"]
        candidates.append(_act("docs_for_benefit",
                               f"Îți mai lipsesc {missing} documente pentru primul Beneficiu Activ",
                               "Cartea casei completă deblochează beneficii și crește valoarea proprietății.",
                               "/client?tab=property", 8))
    if ctx["twins"] == 0:
        candidates.append(_act("activate_twin",
                               "Activează Digital Twin pentru acces la campaniile exclusive",
                               "Membrii cu twin au acces la auditul acoperit 70% și la beneficiile Verified.",
                               "/digital-twin", 8))
    if not ctx["hh_score"] and ctx["properties"] > 0:
        candidates.append(_act("house_health",
                               "Pornește House Health — scorul casei tale",
                               "Un scor calculat îți deblochează recomandări și beneficii dedicate.",
                               "/house-health", 7))
    if feed["opportunities"]:
        top = feed["opportunities"][0]
        candidates.append(_act("claim_opportunity",
                               f"Activează oportunitatea „{top['title']}”",
                               (top.get("why") or ["Este relevantă pentru casa ta."])[0],
                               "/client?tab=benefits", 7))
    if ctx["subscription_active"] and ctx.get("subscription_expires_at"):
        try:
            days = (datetime.fromisoformat(str(ctx["subscription_expires_at"]).replace("Z", "+00:00")) - _now()).days
            if 0 <= days <= 14:
                candidates.append(_act("renew_subscription",
                                       f"Abonamentul tău expiră în {days} zile",
                                       "Reînnoiește-l ca să nu pierzi beneficiile active și scorul House Health.",
                                       "/house-health/upgrade", 10))
        except Exception:  # noqa: BLE001
            pass
    if ctx["referrals_claimed"] == 0 and ctx["completed_jobs"] >= 1:
        candidates.append(_act("invite_neighbor",
                               "Invită un vecin — Beneficiu Comunitate pentru amândoi",
                               "Beneficiul se activează când vecinul își pornește abonamentul sau primul serviciu.",
                               "/client?tab=settings", 6))

    candidates.sort(key=lambda a: -a["impact"])
    return {
        "health": {"score": health["score"], "status": health["status"]},
        "next_action": candidates[0] if candidates else None,
        "secondary": candidates[1:3],
        "membership": feed["membership"]["level"],
        "generated_at": _iso(),
    }


# ---------------------------------------------------------------------------
# AI Growth Advisor (Admin) — determinist + sinteză LLM, cache 6h
# ---------------------------------------------------------------------------
async def growth_advisor(refresh: bool = False) -> dict:
    if not refresh:
        cached = await db.pb_advisor_reports.find_one({}, {"_id": 0}, sort=[("generated_at", -1)])
        if cached and cached["generated_at"] > _iso(_now() - timedelta(hours=6)):
            return cached

    eco = await ecosystem_health()
    now = _iso()
    camps = await db.pb_campaigns.find({}, {"_id": 0}).to_list(200)
    camp_stats = [{"title": c["title"], "kind": c["kind"], "status": c["status"],
                   "claims": c.get("claims_count", 0), "max_claims": c.get("max_claims", 0),
                   "budget_used": c.get("budget_used", 0), "budget_total": c.get("budget_total", 0)}
                  for c in camps]
    pending_ref = await db.pb_referral_pending.count_documents({"status": "pending_activation"})
    activated_ref = await db.pb_referral_pending.count_documents({"status": "activated"})
    at_risk = await db.pb_subscription_health.count_documents({"status": "at_risk"})
    watch = await db.pb_subscription_health.count_documents({"status": "watch"})
    expiring = await db.hh_subscriptions.count_documents(
        {"status": "active", "expires_at": {"$gt": now, "$lt": _iso(_now() + timedelta(days=30))}})
    cities = await db.properties.aggregate([
        {"$group": {"_id": {"$ifNull": ["$city", "necunoscut"]}, "n": {"$sum": 1}}},
        {"$sort": {"n": -1}}, {"$limit": 5}]).to_list(5)

    findings = []
    if at_risk:
        findings.append(f"{at_risk} abonați au Subscription Health „at risk” — AI Success Manager are acțiuni pregătite; verifică lista și contactează-i pe primii 3.")
    if expiring:
        findings.append(f"{expiring} abonamente expiră în următoarele 30 de zile — campanie de reînnoire cu Beneficiu Activ recomandată.")
    stalled = [c for c in camp_stats if c["status"] == "active" and c["claims"] == 0]
    if stalled:
        findings.append(f"{len(stalled)} campanii active fără nicio revendicare ({', '.join(s['title'] for s in stalled[:3])}) — verifică eligibilitatea sau vizibilitatea lor.")
    if pending_ref:
        findings.append(f"{pending_ref} recomandări în așteptarea activării — un impuls de activare (Beneficiu de bun venit vizibil) le poate converti.")
    if not findings:
        findings.append("Nicio alertă critică — concentrează-te pe creșterea campaniilor cu cele mai multe revendicări.")

    summary_text = ""
    try:
        from ai_core.provider import call_llm
        metrics_txt = (f"Ecosystem Health {eco['score']}/100 · abonamente active {eco['components'][0]['value']} "
                       f"(țintă finală 3000) · retenție 30z {eco['components'][1]['value']}% · "
                       f"campanii: {[(c['title'], c['claims']) for c in camp_stats[:6]]} · "
                       f"referral: {activated_ref} activate / {pending_ref} pending · "
                       f"at-risk {at_risk} · watch {watch} · expiră 30z {expiring} · orașe top {[(c['_id'], c['n']) for c in cities]}")
        r = await call_llm(
            "Ești AI Growth Advisor pentru PropManage (Home Graph, România). Răspunzi DOAR în română, "
            "concis, acționabil. Obiectiv: creșterea abonamentelor active spre 3000, retenție și comunitate. "
            "NU propui reduceri — propui beneficii, campanii, retenție. Format: 3-5 acțiuni numerotate, fiecare cu impactul estimat.",
            f"Datele reale ale platformei azi: {metrics_txt}. Constatări deterministe: {findings}. Propune acțiunile săptămânii.")
        summary_text = r.get("text", "")
    except Exception as e:  # noqa: BLE001
        logger.warning(f"[growth_advisor] LLM synthesis failed: {e}")

    report = {
        "generated_at": _iso(),
        "ecosystem_score": eco["score"],
        "metrics": {"subscriptions_active": eco["components"][0]["value"],
                    "retention_pct": eco["components"][1]["value"],
                    "at_risk": at_risk, "watch": watch, "expiring_30d": expiring,
                    "referral_pending": pending_ref, "referral_activated": activated_ref,
                    "top_cities": [{"city": c["_id"], "properties": c["n"]} for c in cities]},
        "campaigns": camp_stats,
        "findings": findings,
        "ai_recommendations": summary_text,
    }
    await db.pb_advisor_reports.insert_one({**report})
    return report
