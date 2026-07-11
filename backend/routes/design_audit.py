"""Design Audit — Admin module (Feb 2026).

Evaluates UX/UI unity, Hick's Law adherence and mobile-vs-desktop impact per app page.
Uses Claude (Emergent LLM key) for qualitative analysis and produces:
  - Mobile score (0–100)
  - Desktop score (0–100)
  - Unity score (color/spacing/typography consistency)
  - Findings & concrete recommendations

Cache: 12h per page. Force via ?force=true.
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from db import db
from deps import require_role

router = APIRouter(prefix="/api/admin/design-audit", tags=["design-audit"])
logger = logging.getLogger("propmanage.design_audit")

CACHE_HOURS = 12

# Registry of pages we audit — path + role zone + short brief on what the page contains.
PAGES: list[dict[str, Any]] = [
    # Public
    {"key": "landing",         "path": "/",                  "zone": "public",    "label": "Landing (Home)",
     "brief": "Hero cu 3 CTA-uri, marquee categorii, secțiuni value-prop, harta zonă acoperire, footer legal Vintage Furniture."},
    {"key": "marketplace",     "path": "/marketplace",       "zone": "public",    "label": "Marketplace listare",
     "brief": "Filtre (categorie/verified/sort), grid carduri specialiști cu health-score, badge tier, buton Vezi profil."},
    {"key": "preturi",         "path": "/preturi",           "zone": "public",    "label": "Prețuri servicii (SEO)",
     "brief": "Grile prețuri pe categorii, strip Market Pulse, tabel comparativ."},
    {"key": "legal",           "path": "/legal/termeni",     "zone": "public",    "label": "Documente legale",
     "brief": "Text lung structurat (termeni, GDPR) cu Vintage Furniture S.R.L. sticky nav."},
    # Client
    {"key": "client_dashboard","path": "/client",            "zone": "client",    "label": "Client Dashboard",
     "brief": "Bento cards Quest-uri & Recompense, cereri active, timeline, buton FAB Solicită, bottom nav 4 tab-uri."},
    {"key": "client_marketplace","path": "/client",          "zone": "client",    "label": "Client — listă specialiști",
     "brief": "Carduri specialiști vizibile în tab Solicită: avatar, tier badge, rating, buton profil + solicită."},
    # Specialist
    {"key": "specialist_dashboard","path": "/specialist",    "zone": "specialist","label": "Specialist Dashboard",
     "brief": "Astăzi ai (sumar), tab-uri cereri disponibile, wallet, KPIs performanță."},
    # Operator
    {"key": "operator_dashboard","path": "/operator",        "zone": "operator",  "label": "Operator Dashboard",
     "brief": "KpiCards standardizate, AI Insights, listă cereri triaj, dispute panel."},
    # Admin
    {"key": "admin_overview",  "path": "/admin",             "zone": "admin",     "label": "Admin Overview",
     "brief": "Morning briefing card, 4 KPI cards, AI Insights, chart activitate 14z, top specialiști, finanțe, categorii, panouri operaționale progressive-disclosure."},
    {"key": "admin_analytics", "path": "/admin/analytics",   "zone": "admin",     "label": "Admin Analytics & Growth",
     "brief": "KpiCards trend, funnel, surse trafic, AI Insights, tabele exportabile CSV."},
    {"key": "admin_users",     "path": "/admin/users",       "zone": "admin",     "label": "Admin Users",
     "brief": "Data table utilizatori, filtre roluri, acțiuni impersonare/ban, KpiCards top."},
    {"key": "admin_ai_control","path": "/admin/ai-control-center","zone": "admin","label": "AI Control Center",
     "brief": "Configurare model AI, memoria cross-session, agenti activi, AI Insights v2."},
    {"key": "admin_governance","path": "/admin/ai-governance","zone": "admin",    "label": "AI Governance",
     "brief": "Agenti lifecycle, activitate 24h/7z, faza curentă, AI Insights v2."},
]


def _find_page(key: str) -> dict[str, Any] | None:
    for p in PAGES:
        if p["key"] == key:
            return p
    return None


def _rule_based_score(page: dict[str, Any]) -> dict[str, Any]:
    """Fallback deterministic scoring when LLM unavailable."""
    # Baseline scores by zone — refined via LLM. Kept intentionally conservative so the LLM adds value.
    baselines = {
        "public":     {"mobile": 78, "desktop": 86, "unity": 82},
        "client":     {"mobile": 82, "desktop": 80, "unity": 84},
        "specialist": {"mobile": 74, "desktop": 82, "unity": 78},
        "operator":   {"mobile": 70, "desktop": 88, "unity": 86},
        "admin":      {"mobile": 62, "desktop": 90, "unity": 82},
    }
    b = baselines.get(page["zone"], {"mobile": 75, "desktop": 82, "unity": 80})
    return {
        "mobile_score": b["mobile"],
        "desktop_score": b["desktop"],
        "unity_score": b["unity"],
        "hicks_law_score": 78,
        "findings": [
            f"Analiză rule-based fallback pentru {page['label']} — activează LLM pentru evaluare detaliată.",
        ],
        "recommendations": [
            "Rulează analiza AI pentru findings specifice paginii.",
        ],
        "mobile_impact": "Mediu — analiză completă necesită LLM.",
        "desktop_impact": "Bun — layout desktop respectă gridul 12-col.",
    }


@router.get("/pages")
async def list_pages(_admin=Depends(require_role("admin"))):
    """Return the registry of pages we can audit + last-cached scores per page."""
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=CACHE_HOURS)).isoformat()
    latest: dict[str, dict[str, Any]] = {}
    async for row in db.design_audit_cache.find({}, {"_id": 0}):
        latest[row["key"]] = row

    out = []
    for p in PAGES:
        cache = latest.get(p["key"])
        is_fresh = bool(cache and cache.get("generated_at", "") >= cutoff)
        out.append({
            **p,
            "last_audit": cache.get("generated_at") if cache else None,
            "fresh": is_fresh,
            "mobile_score": cache["result"].get("mobile_score") if cache else None,
            "desktop_score": cache["result"].get("desktop_score") if cache else None,
            "unity_score": cache["result"].get("unity_score") if cache else None,
        })
    return {"pages": out, "cache_hours": CACHE_HOURS}


@router.get("/analyze")
async def analyze_page(key: str, force: bool = False, _admin=Depends(require_role("admin"))):
    """Run the audit for a specific page, using LLM when possible."""
    page = _find_page(key)
    if not page:
        raise HTTPException(404, f"Pagină necunoscută: {key}. Valide: {[p['key'] for p in PAGES]}")

    cutoff = (datetime.now(timezone.utc) - timedelta(hours=CACHE_HOURS)).isoformat()
    if not force:
        cached = await db.design_audit_cache.find_one({"key": key, "generated_at": {"$gte": cutoff}}, {"_id": 0})
        if cached:
            return {**cached["result"], "page": page, "generated_at": cached["generated_at"], "cached": True}

    try:
        from orchestrator.llm import claude_json
        system = (
            "Ești UX/UI Auditor senior pentru PropManage — o platformă românească de servicii pentru "
            "proprietate (public, client, specialist, operator, admin). Design System-ul folosește: "
            "lime brand (#84cc16/#d4ff3a), suprafețe alb/slate-800 (light/dark), fără mov/blue accent. "
            "Regula: pe temă LIGHT toate suprafețele sunt albe/gri deschis; pe DARK toate slate-800/900. "
            "IMPORTANT: entitatea legală CORECTĂ este 'VINTAGE FURNITURE S.R.L.' (CUI 35250247, J12/3534/2015, "
            "Cluj-Napoca) — brand-ul public 'PropManage' este marca comercială. Nu marcă aceasta ca problemă. "
            "Evaluezi respectarea legii lui Hick (limitare opțiuni), unitatea vizuală (culori, spacing, tipografie), "
            "contrastul (WCAG AA), și impactul UX distinct pe MOBILE (touch targets ≥44px, bottom nav, thumb zone) "
            "vs DESKTOP (grid 12-col, hover states, dense info). Răspunde STRICT JSON: "
            "{\"mobile_score\": 0-100, \"desktop_score\": 0-100, \"unity_score\": 0-100, "
            "\"hicks_law_score\": 0-100, \"findings\": [3-5 constatări factuale scurte, string-uri simple], "
            "\"recommendations\": [3-5 acțiuni concrete — string-uri simple, poți începe cu 'P0:', 'P1:' pentru prioritate], "
            "\"mobile_impact\": \"scurt verdict impact pe mobil\", "
            "\"desktop_impact\": \"scurt verdict impact pe desktop\"}. "
            "Fii concret și critic — dai note reale, nu inflatate. Recomandările sunt string-uri, nu obiecte."
        )
        prompt = (
            f"Auditez pagina: {page['label']} ({page['path']}, zonă={page['zone']}).\n\n"
            f"Descriere conținut: {page['brief']}\n\n"
            f"Evaluează UX-ul pe mobile vs desktop, unitatea vizuală (light+dark trebuie să fie perfect coerente), "
            f"și aderența la legea lui Hick (nu prea multe alegeri odată). "
            f"Presupune că folosim Design System-ul strict cu KpiCard, AIInsightCard, DSBadge, PMPillButton, "
            f"card = 'rounded-2xl border bg-white dark:bg-slate-800'. "
            f"Livrează scorurile și 3-5 recomandări prioritizate."
        )
        result = await claude_json(system=system, prompt=prompt, session_prefix=f"design-audit-{key}")
        if not isinstance(result, dict) or "mobile_score" not in result:
            raise ValueError("Răspuns LLM invalid")
        payload = {
            "mobile_score": int(result.get("mobile_score", 0)),
            "desktop_score": int(result.get("desktop_score", 0)),
            "unity_score": int(result.get("unity_score", 0)),
            "hicks_law_score": int(result.get("hicks_law_score", 0)),
            "findings": (result.get("findings") or [])[:5],
            "recommendations": (result.get("recommendations") or [])[:5],
            "mobile_impact": result.get("mobile_impact") or "",
            "desktop_impact": result.get("desktop_impact") or "",
        }
    except Exception as e:  # noqa: BLE001
        logger.warning(f"[design-audit] LLM fail ({key}): {e} — fallback rule-based")
        payload = _rule_based_score(page)

    now = datetime.now(timezone.utc).isoformat()
    await db.design_audit_cache.update_one(
        {"key": key},
        {"$set": {"key": key, "generated_at": now, "result": payload}},
        upsert=True,
    )
    return {**payload, "page": page, "generated_at": now, "cached": False}


@router.get("/summary")
async def audit_summary(_admin=Depends(require_role("admin"))):
    """Aggregated summary — medii globale, worst 3 mobile, worst 3 desktop."""
    rows = []
    async for row in db.design_audit_cache.find({}, {"_id": 0}):
        r = row.get("result") or {}
        rows.append({
            "key": row["key"],
            "mobile_score": r.get("mobile_score") or 0,
            "desktop_score": r.get("desktop_score") or 0,
            "unity_score": r.get("unity_score") or 0,
            "hicks_law_score": r.get("hicks_law_score") or 0,
        })

    if not rows:
        return {
            "coverage": 0,
            "total_pages": len(PAGES),
            "audited": 0,
            "avg_mobile": None,
            "avg_desktop": None,
            "avg_unity": None,
            "avg_hicks": None,
            "worst_mobile": [],
            "worst_desktop": [],
        }

    labels = {p["key"]: p["label"] for p in PAGES}
    n = len(rows)
    avg = lambda k: round(sum(r[k] for r in rows) / n, 1)  # noqa: E731
    worst_mobile = sorted(rows, key=lambda r: r["mobile_score"])[:3]
    worst_desktop = sorted(rows, key=lambda r: r["desktop_score"])[:3]
    return {
        "coverage": round(n / len(PAGES) * 100),
        "total_pages": len(PAGES),
        "audited": n,
        "avg_mobile": avg("mobile_score"),
        "avg_desktop": avg("desktop_score"),
        "avg_unity": avg("unity_score"),
        "avg_hicks": avg("hicks_law_score"),
        "worst_mobile": [{**w, "label": labels.get(w["key"], w["key"])} for w in worst_mobile],
        "worst_desktop": [{**w, "label": labels.get(w["key"], w["key"])} for w in worst_desktop],
    }
