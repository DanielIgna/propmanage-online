"""Content Growth Engine V1 — Content Factory + SEO Opportunity Engine.

Reuses existing infra (GSC via admin_seo, analytics via analytics_growth, blog, sitemap).
Turns REAL search + acquisition data into commercial content opportunities, then into
human-reviewed article DRAFTS. V1 NEVER auto-publishes.

Data honesty: every opportunity is tagged with its source (gsc | analytics | structural-gap)
and a data_status (ok | data_insufficient | unavailable). No mock data, no invented search
volume/impressions/trends. On Preview GSC is not connected → those categories = UNAVAILABLE.

Workflow: idea → research → brief → draft → review → approved → published → measured.
"""
import os
import re
import uuid
import json
import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from db import db
from deps import require_role

logger = logging.getLogger(__name__)

admin_router = APIRouter(prefix="/api/admin/content-factory", tags=["content-factory"])
public_router = APIRouter(prefix="/api/content", tags=["content-public"])

WORKFLOW_STATUSES = ["idea", "research", "brief", "draft", "review", "approved", "published", "measured", "retired"]

# ── Content clusters (reuse PropManage taxonomy) → commercial destination + CTA ──
CLUSTERS = {
    "design_interior": {"label": "Design Interior", "cta": "Începe proiectul de design", "cta_to": "/design-interior#formular", "hub": "/design-interior"},
    "renovare":        {"label": "Renovare",        "cta": "Evaluează-ți casa",          "cta_to": "/scorul-casei",         "hub": "/design-interior/renovare"},
    "audit":           {"label": "Audit / Scorul Casei", "cta": "Evaluează-ți casa gratuit", "cta_to": "/scorul-casei",     "hub": "/scorul-casei"},
    "imobile":         {"label": "Imobile Verificate", "cta": "Vezi imobile verificate",  "cta_to": "/imobile-verificate",   "hub": "/imobile-verificate"},
    "probleme":        {"label": "Probleme Casă",    "cta": "Caută un specialist",        "cta_to": "/marketplace",          "hub": "/probleme-casa"},
    "costuri":         {"label": "Costuri / Prețuri","cta": "Vezi prețurile",             "cta_to": "/preturi",              "hub": "/preturi"},
    "specialisti":     {"label": "Specialiști",      "cta": "Caută un specialist",        "cta_to": "/marketplace",          "hub": "/marketplace"},
    "mobilier":        {"label": "Mobilier",         "cta": "Mobilier la comandă",        "cta_to": "/servicii/mobilier",    "hub": "/servicii/mobilier"},
    "servicii_local":  {"label": "Servicii pentru casă", "cta": "Caută un specialist",    "cta_to": "/marketplace",          "hub": "/servicii-pentru-casa/cluj-napoca"},
    "digital_twin":    {"label": "Digital Twin",     "cta": "Creează cont gratuit",       "cta_to": "/register",             "hub": "/design-interior"},
    "cartea_casei":    {"label": "Cartea Casei",     "cta": "Creează cont gratuit",       "cta_to": "/register",             "hub": "/house-health"},
}

# ── Intent classification rules (deterministic, keyword-based) ──
INTENT_RULES = {
    "design":        ["design interior", "amenaj", "designer", "stil", "mobilare", "decor"],
    "renovation":    ["renovare", "renov", "reabilitare", "modernizare"],
    "cost":          ["cost", "preț", "pret", "tarif", "buget", "cât costă", "cat costa"],
    "problem":       ["problem", "igrasie", "mucegai", "fisur", "infiltraț", "defect", "reparaț"],
    "property":      ["apartament", "casă", "casa", "vilă", "vila", "imobil", "locuință", "locuinta", "bloc"],
    "specialist_acq":["devino specialist", "înscrie", "inscrie", "colabor", "vreau clienți", "portofoliu specialist"],
    "specialist":    ["instalator", "electrician", "zugrav", "constructor", "meseriaș", "specialist", "firma"],
    "local":         [],  # filled dynamically by city detection
    "comparison":    ["vs", "sau", "diferența", "diferenta", "mai bun", "comparație", "comparatie"],
    "transactional": ["ofertă", "oferta", "comandă", "comanda", "programare", "cerere", "contact"],
    "informational": ["ce este", "cum", "de ce", "ghid", "sfaturi", "pași", "pasi", "checklist"],
    "audit":         ["audit", "evaluare", "verificare", "inspecție", "inspectie", "scor", "diagnoza"],
    "mobilier":      ["mobilier", "mobilă", "mobila", "dressing", "bucătărie la comandă"],
}

# Romanian cities we already cover (for local intent detection) — reused list.
KNOWN_CITIES = [
    "cluj", "cluj-napoca", "florești", "floresti", "apahida", "baciu", "bucurești", "bucuresti",
    "timișoara", "timisoara", "brașov", "brasov", "iași", "iasi", "sibiu", "oradea",
    "târgu mureș", "targu mures", "arad", "satu mare", "bistrița", "bistrita",
    "alba iulia", "deva", "hunedoara", "turda", "zalău", "zalau",
]

COMMERCIAL_INTENTS = {"design", "renovation", "cost", "specialist", "specialist_acq", "audit", "mobilier", "property", "transactional"}


def classify_intent(text: str) -> list[str]:
    """Return the set of intent tags for a query/topic. A query can carry several."""
    t = (text or "").lower()
    tags = []
    for intent, kws in INTENT_RULES.items():
        if intent == "local":
            continue
        if any(kw in t for kw in kws):
            tags.append(intent)
    if any(c in t for c in KNOWN_CITIES):
        tags.append("local")
    # commercial umbrella
    if any(tag in COMMERCIAL_INTENTS for tag in tags):
        if "commercial" not in tags:
            tags.append("commercial")
    if not tags:
        tags.append("informational")
    return tags


def _detect_city(text: str) -> Optional[str]:
    t = (text or "").lower()
    for c in KNOWN_CITIES:
        if c in t:
            return c.title()
    return None


def _cluster_for(text: str, intents: list[str]) -> str:
    t = (text or "").lower()
    if "mobilier" in intents or "mobil" in t:
        return "mobilier"
    if "design" in intents:
        return "design_interior"
    if "renovation" in intents:
        return "renovare"
    if "audit" in intents:
        return "audit"
    if "cost" in intents:
        return "costuri"
    if "problem" in intents:
        return "probleme"
    if "specialist_acq" in intents or "specialist" in intents:
        return "specialisti"
    if "local" in intents:
        return "servicii_local"
    if "property" in intents:
        return "imobile"
    return "design_interior"


# ── Existing-page inventory (content-gap check — reuses real registries) ──
def _existing_targets() -> list[dict]:
    targets = []
    try:
        from seo_guides import GUIDE_SLUGS
        for slug, _ in GUIDE_SLUGS:
            targets.append({"path": f"/ghiduri/{slug}", "key": slug.replace("-", " ")})
    except Exception:
        pass
    try:
        from seo_problems import PROBLEM_SLUGS
        for slug, _ in PROBLEM_SLUGS:
            targets.append({"path": f"/probleme-casa/{slug}", "key": slug.replace("-", " ")})
    except Exception:
        pass
    try:
        from construction.price_seo import PRICE_SEO
        for slug in PRICE_SEO:
            targets.append({"path": f"/preturi/{slug}", "key": slug.replace("-", " ")})
    except Exception:
        pass
    try:
        from seo_design import DESIGN_PAGES, DESIGN_STYLES, DESIGN_LOCAL_CITIES
        for slug, _ in DESIGN_PAGES:
            targets.append({"path": f"/design-interior/{slug}", "key": slug.replace("-", " ")})
        for slug, _ in DESIGN_STYLES:
            targets.append({"path": f"/design-interior/stil/{slug}", "key": slug.replace("-", " ")})
        for slug in DESIGN_LOCAL_CITIES:
            targets.append({"path": f"/design-interior/{slug}", "key": slug.replace("-", " ")})
    except Exception:
        pass
    return targets


def _norm(s: str) -> set:
    return set(re.findall(r"[a-zăâîșț]+", (s or "").lower()))


def find_content_gap(topic: str, published_slugs: set) -> dict:
    """Does a relevant page already exist? Returns gap decision + best match."""
    topic_words = _norm(topic)
    if not topic_words:
        return {"gap": "candidate", "existing_page": None, "overlap": 0.0}
    best, best_score = None, 0.0
    for t in _existing_targets():
        kw = _norm(t["key"])
        if not kw:
            continue
        overlap = len(topic_words & kw) / max(1, len(topic_words))
        if overlap > best_score:
            best, best_score = t, overlap
    # already-published factory articles
    for slug in published_slugs:
        kw = _norm(slug.replace("-", " "))
        overlap = len(topic_words & kw) / max(1, len(topic_words))
        if overlap > best_score:
            best, best_score = {"path": f"/blog/{slug}", "key": slug}, overlap
    if best_score >= 0.6:
        return {"gap": "update", "existing_page": best["path"], "overlap": round(best_score, 2)}
    if best_score >= 0.34:
        return {"gap": "update_or_link", "existing_page": best["path"], "overlap": round(best_score, 2)}
    return {"gap": "candidate", "existing_page": best["path"] if best else None, "overlap": round(best_score, 2)}


# ── Seed commercial topics for STRUCTURAL-GAP detection (no invented search volume) ──
# These are real commercial intents PropManage targets. They carry NO metrics — only
# structural justification (cluster + commercial destination + existing-page check).
SEED_TOPICS = [
    "cât costă amenajarea unui apartament la cheie",
    "renovare completă apartament pas cu pas",
    "design interior vs decorator — ce alegi",
    "cum alegi stilul de design potrivit pentru apartament",
    "greșeli frecvente la renovarea băii",
    "cât costă mobilierul la comandă pentru bucătărie",
    "audit tehnic înainte de renovare — de ce contează",
    "cum eviți surprizele de buget la o renovare",
    "design interior pentru apartament de 2 camere — idei și buget",
    "checklist recepție lucrări de amenajare",
    "digital twin pentru locuință — la ce ajută",
    "cum verifici un apartament vechi înainte de cumpărare",
]


async def detect_opportunities(period_days: int = 90) -> dict:
    """Aggregate opportunities from all REAL sources. Honest about missing data."""
    published_slugs = set()
    async for a in db.content_articles.find({"status": "published"}, {"slug": 1, "_id": 0}):
        if a.get("slug"):
            published_slugs.add(a["slug"])

    opportunities = []
    sources_status = {}

    # ── Source 1: GSC — REUSES the exact same integration as the GSC tab ──
    # (routes.admin_seo._gsc_config + _gsc_run_query, db.seo_config key="gsc").
    # No second OAuth client, no separate credentials. Connected == cfg has a property.
    gsc_status = "unavailable"
    try:
        from routes.admin_seo import _gsc_config, _gsc_run_query
        from datetime import timedelta, date
        cfg = await _gsc_config()
        if cfg and cfg.get("property"):          # same connectivity test as the GSC tab
            gsc_status = "ok"
            end = date.today()
            start = end - timedelta(days=min(period_days, 90))
            q_rows = await asyncio.to_thread(
                _gsc_run_query, cfg, cfg["property"], start.isoformat(), end.isoformat(), ["query"], 200)
            for r in q_rows:
                keys = r.get("keys") or []
                if not keys:
                    continue
                query = keys[0]
                impr = int(r.get("impressions", 0))
                clicks = int(r.get("clicks", 0))
                ctr = round(float(r.get("ctr", 0)) * 100, 2)
                pos = round(float(r.get("position", 0)), 1)
                intents = classify_intent(query)
                cluster = _cluster_for(query, intents)
                city = _detect_city(query)
                gap = find_content_gap(query, published_slugs)
                commercial = bool(set(intents) & COMMERCIAL_INTENTS)
                # Category detection from REAL metrics only
                category, prio = None, 40
                if impr >= 100 and ctr < 2.0:
                    category, prio = "high_impression_low_ctr", 80
                elif 5 <= pos <= 20 and impr >= 30:
                    category, prio = "ranking_opportunity", 75
                elif commercial and impr >= 10:
                    category, prio = "commercial_intent", 68
                elif impr >= 50:
                    category, prio = "emerging_query", 55
                if not category:
                    continue  # not enough signal → skip (no invented demand)
                if commercial:
                    prio += 8
                if city:
                    prio += 5
                opportunities.append({
                    "id": str(uuid.uuid4()),
                    "source": "gsc",
                    "category": category,
                    "topic": query,
                    "query": query,
                    "intent": intents,
                    "cluster": cluster,
                    "city": city,
                    "existing_page": gap["existing_page"],
                    "gap": gap["gap"],
                    "impressions": impr, "clicks": clicks, "ctr": ctr, "position": pos,
                    "sessions": None,
                    "priority": min(100, prio),
                    "rationale": f"GSC real: {impr} impresii, {clicks} clickuri, CTR {ctr}%, poziție {pos}. "
                                 f"Gap: {gap['gap']}. Cluster {CLUSTERS[cluster]['label']}.",
                    "data_status": "ok",
                })
    except Exception as e:
        logger.info(f"GSC opportunity source unavailable: {e}")
    sources_status["gsc"] = gsc_status

    # ── Source 2: Analytics (real landing pages with sessions but weak CTA/conversion) ──
    analytics_status = "data_insufficient"
    try:
        from routes.analytics_growth import _seo_organic_data  # reuse if exposed
    except Exception:
        _seo_organic_data = None
    landing_rows = []
    async for s in db.analytics_sessions.aggregate([
        {"$match": {"entry_path": {"$nin": [None, ""]}}},
        {"$group": {"_id": "$entry_path", "sessions": {"$sum": 1}}},
        {"$sort": {"sessions": -1}}, {"$limit": 50},
    ]):
        landing_rows.append(s)
    if landing_rows:
        analytics_status = "ok"
        _content_prefixes = ("/blog", "/ghiduri", "/design-interior", "/preturi", "/probleme-casa",
                             "/servicii", "/imobile-verificate", "/scorul-casei", "/marketplace", "/house-health")
        for row in landing_rows:
            path = row["_id"]
            sess = row["sessions"]
            # Only CONTENT pages qualify (skip auth/system/admin/root).
            if sess >= 3 and any(path == p or path.startswith(p) for p in _content_prefixes):
                opportunities.append({
                    "id": str(uuid.uuid4()),
                    "source": "analytics",
                    "category": "high_impression_low_cta",
                    "topic": f"Optimizare pagină cu trafic real: {path}",
                    "query": None,
                    "intent": ["commercial"],
                    "cluster": "design_interior",
                    "city": None,
                    "existing_page": path,
                    "gap": "update",
                    "sessions": sess,
                    "priority": min(100, 40 + sess),
                    "rationale": f"{sess} sesiuni reale pe {path} — candidat pentru optimizare CTA / internal linking.",
                    "data_status": "ok",
                })
    sources_status["analytics"] = analytics_status

    # ── Source 3: Structural content-gap (no invented metrics) ──
    structural = []
    for topic in SEED_TOPICS:
        intents = classify_intent(topic)
        cluster = _cluster_for(topic, intents)
        city = _detect_city(topic)
        gap = find_content_gap(topic, published_slugs)
        commercial = bool(set(intents) & COMMERCIAL_INTENTS)
        if gap["gap"] == "update" and gap["overlap"] >= 0.6:
            continue  # already well covered — skip (avoid duplicate)
        prio = 55
        if commercial:
            prio += 20
        if gap["gap"] == "candidate":
            prio += 10
        if cluster in ("design_interior", "renovare", "audit", "specialisti", "imobile"):
            prio += 8  # monetizable priority
        structural.append({
            "id": str(uuid.uuid4()),
            "source": "structural-gap",
            "category": "commercial_intent" if commercial else "informational",
            "topic": topic,
            "query": topic,
            "intent": intents,
            "cluster": cluster,
            "city": city,
            "existing_page": gap["existing_page"],
            "gap": gap["gap"],
            "sessions": None,
            "priority": prio,
            "rationale": (f"Intentie comerciala in clusterul {CLUSTERS[cluster]['label']}; "
                          f"gap: {gap['gap']} (overlap {gap['overlap']}). Fara date GSC pe Preview - justificare structurala."),
            "data_status": "ok",
        })
    opportunities.extend(structural)

    opportunities.sort(key=lambda o: o["priority"], reverse=True)
    _gsc_ok = sources_status.get("gsc") == "ok"
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "sources_status": sources_status,
        "gsc_note": ("GSC conectat — categoriile bazate pe impresii/CTR/poziție folosesc date reale."
                     if _gsc_ok else
                     "GSC neconectat pe Preview — categoriile bazate pe impresii/CTR/poziție = UNAVAILABLE. "
                     "Se activează automat în Producție unde GSC e conectat."),
        "count": len(opportunities),
        "opportunities": opportunities,
    }


# ── Content performance + Growth decision (closes the loop) ──
async def _gsc_page_metrics(period_days: int = 28) -> Optional[dict]:
    """Real per-page GSC metrics keyed by page URL. None if GSC not connected (Preview)."""
    try:
        from routes.admin_seo import _gsc_config, _gsc_run_query
        cfg = await _gsc_config()
        if not cfg:
            return None
        from datetime import timedelta, date
        end = date.today()
        start = end - timedelta(days=period_days)
        rows = await asyncio.to_thread(
            _gsc_run_query, cfg, cfg["property"], start.isoformat(), end.isoformat(), ["page"], 500)
        out = {}
        for r in rows:
            keys = r.get("keys") or []
            if not keys:
                continue
            out[keys[0].rstrip("/")] = {
                "impressions": int(r.get("impressions", 0)),
                "clicks": int(r.get("clicks", 0)),
                "ctr": round(float(r.get("ctr", 0)) * 100, 2),
                "position": round(float(r.get("position", 0)), 1),
            }
        return out
    except Exception as e:
        logger.info(f"GSC page metrics unavailable: {e}")
        return None


def _content_decision(gsc: Optional[dict], sessions: int, conversions: int) -> tuple[str, str]:
    """KEEP / UPDATE / EXPAND / WAIT / DATA_INSUFFICIENT — from REAL data only."""
    if gsc is None and sessions == 0:
        return "DATA_INSUFFICIENT", "Fără date GSC (Preview) și fără sesiuni încă."
    if gsc:
        imp, clk, ctr, pos = gsc["impressions"], gsc["clicks"], gsc["ctr"], gsc["position"]
        if imp >= 200 and ctr < 2.0:
            return "UPDATE", f"Impresii mari ({imp}) dar CTR mic ({ctr}%) — optimizează titlu/meta."
        if 5 <= pos <= 20 and imp >= 100:
            return "EXPAND", f"Poziție {pos} cu {imp} impresii — extinde conținutul pentru ranking mai bun."
        if clk >= 20 and conversions == 0:
            return "UPDATE", f"{clk} clickuri, 0 conversii — întărește CTA/internal linking."
        if clk >= 20 and conversions > 0:
            return "KEEP", f"Performează: {clk} clickuri, {conversions} conversii."
        if imp < 30:
            return "WAIT", "Prea puține impresii încă — așteaptă mai multe date."
    if sessions >= 30 and conversions == 0:
        return "UPDATE", f"{sessions} sesiuni, 0 conversii — optimizează CTA."
    if sessions >= 30 and conversions > 0:
        return "KEEP", f"{sessions} sesiuni și {conversions} conversii."
    return "WAIT", "Trafic încă mic — mai adună date înainte de o decizie."


async def article_performance(period_days: int = 28) -> dict:
    """Per published article: real GSC + analytics + conversions + growth decision."""
    site = os.environ.get("APP_PUBLIC_URL", "https://propmanage.ro").rstrip("/")
    gsc_map = await _gsc_page_metrics(period_days)
    items = []
    async for a in db.content_articles.find({"status": "published"}):
        slug = a.get("slug")
        path = f"/blog/{slug}"
        url = f"{site}{path}"
        gsc = None
        if gsc_map is not None:
            gsc = gsc_map.get(url.rstrip("/")) or gsc_map.get(url) or {
                "impressions": 0, "clicks": 0, "ctr": 0.0, "position": 0.0}
        sessions = await db.analytics_sessions.count_documents({"entry_path": path})
        signups = await db.marketing_conversions.count_documents(
            {"entry_path": path, "action": {"$regex": "sign|account", "$options": "i"}})
        leads = await db.marketing_conversions.count_documents(
            {"entry_path": path, "action": {"$regex": "lead|request|offer|form", "$options": "i"}})
        rev_cursor = db.marketing_conversions.aggregate([
            {"$match": {"entry_path": path, "value": {"$gt": 0}}},
            {"$group": {"_id": None, "v": {"$sum": "$value"}}}])
        revenue = 0.0
        async for r in rev_cursor:
            revenue = float(r.get("v", 0))
        conversions = signups + leads
        decision, reason = _content_decision(gsc, sessions, conversions)
        items.append({
            "slug": slug, "title": a.get("title"), "path": path, "cluster": a.get("cluster"),
            "cluster_label": CLUSTERS.get(a.get("cluster"), {}).get("label"),
            "gsc": gsc if gsc_map is not None else None,
            "gsc_status": "ok" if gsc_map is not None else "unavailable",
            "sessions": sessions, "signups": signups, "leads": leads,
            "revenue": revenue if revenue > 0 else None,
            "revenue_status": "ok" if revenue > 0 else "unavailable",
            "decision": decision, "decision_reason": reason,
            "published_at": a.get("published_at"),
        })
    published = len(items)
    _gsc_ok = gsc_map is not None
    return {
        "period_days": period_days,
        "gsc_status": "ok" if _gsc_ok else "unavailable",
        "gsc_note": ("GSC conectat — metrici per-articol din date reale."
                     if _gsc_ok else
                     "GSC neconectat pe Preview → metrici per-articol UNAVAILABLE; se activează în Producție."),
        "published_articles": published,
        "note": "DATA INSUFFICIENT afișat onest când nu există trafic/GSC. Zero date inventate." if published == 0 else None,
        "items": items,
    }


# ── Content brief ──
def build_brief(opp: dict) -> dict:
    cluster = opp.get("cluster") or "design_interior"
    cmeta = CLUSTERS.get(cluster, CLUSTERS["design_interior"])
    intents = opp.get("intent") or classify_intent(opp.get("topic", ""))
    city = opp.get("city")
    internal = [cmeta["hub"]]
    if opp.get("existing_page") and opp["existing_page"] not in internal:
        internal.append(opp["existing_page"])
    # add a couple of relevant cluster hubs
    for extra in ("/scorul-casei", "/imobile-verificate", "/marketplace", "/design-interior"):
        if extra not in internal and len(internal) < 5:
            internal.append(extra)
    return {
        "title": opp.get("topic", "").capitalize(),
        "search_intent": intents,
        "primary_query": opp.get("query") or opp.get("topic"),
        "secondary_queries": [],
        "target_audience": "owner" if cluster in ("renovare", "audit", "imobile", "costuri") else
                           ("designer" if cluster == "design_interior" else "owner"),
        "content_cluster": cluster,
        "city": city,
        "existing_pages_to_link": internal,
        "cta": cmeta["cta"],
        "commercial_destination": cmeta["cta_to"],
        "required_factual_sources": ["Servicii PropManage (design, audit, Scorul Casei, escrow, specialiști verificați)"],
        "propmanage_data": "Proces în 17 etape, Digital Twin, plăți protejate prin escrow, specialiști verificați",
    }


def _slugify(text: str) -> str:
    t = (text or "").lower()
    repl = {"ă": "a", "â": "a", "î": "i", "ș": "s", "ț": "t", "\u201e": "", "\u201d": "", "\u2013": "-"}
    for k, v in repl.items():
        t = t.replace(k, v)
    t = re.sub(r"[^a-z0-9]+", "-", t).strip("-")
    return t[:70]


# ── Article generator (Claude Sonnet 4.6 via Emergent LLM key) ──
ARTICLE_SYSTEM_PROMPT = """Ești redactor SEO senior pentru PropManage, o platformă românească de management al locuinței (design interior, audit tehnic „Scorul Casei", renovare, Imobile Verificate, specialiști verificați cu plăți protejate prin escrow, Digital Twin, Cartea Casei).

Scrii articole ORIGINALE în limba română, naturale, utile și FACTUALE. Reguli stricte:
- ZERO afirmații inventate: fără statistici, prețuri exacte, procente sau studii pe care nu le poți susține. Poți vorbi calitativ despre costuri („variază în funcție de..."), nu inventa cifre.
- Fără keyword stuffing, fără text de umplutură, fără promisiuni exagerate.
- Ton profesionist, clar, empatic cu proprietarul român.
- Integrează natural serviciile PropManage relevante și un CTA la final.
- Structură SEO: titlu, meta description (max 155 caractere), H1, 4-6 secțiuni cu H2, paragrafe scurte, liste unde ajută, 3 întrebări FAQ.

Răspunde DOAR cu JSON valid, fără text în plus. Nu folosi ghilimele drepte (") în interiorul valorilor de text — folosește « » sau apostrof simplu. Formă:
{"title": "...", "meta_description": "...", "h1": "...", "excerpt": "...", "sections": [{"h2": "...", "paragraphs": ["..."], "bullets": ["..."]}], "faq": [{"q": "...", "a": "..."}]}"""


async def generate_article_draft(brief: dict) -> dict:
    """One-shot Claude generation → structured article JSON. No auto-publish."""
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(500, "EMERGENT_LLM_KEY lipsă")
    from emergentintegrations.llm.chat import LlmChat, UserMessage

    cmeta = CLUSTERS.get(brief["content_cluster"], CLUSTERS["design_interior"])
    city_line = f"\nOraș relevant: {brief['city']}." if brief.get("city") else ""
    links = ", ".join(brief.get("existing_pages_to_link", []))
    user_prompt = f"""Scrie un articol pentru blogul PropManage.

Subiect / query principal: {brief['primary_query']}
Intenție de căutare: {', '.join(brief['search_intent'])}
Cluster: {cmeta['label']}
Audiență: {brief['target_audience']}{city_line}
CTA la final: „{brief['cta']}" (destinație: {brief['commercial_destination']})
Pagini interne relevante de menționat natural în text: {links}
Date PropManage reale de folosit: {brief['propmanage_data']}

Lungime: 700-1000 cuvinte. Factual, original, util. Răspunde DOAR cu JSON-ul cerut."""

    chat = LlmChat(
        api_key=api_key,
        session_id=f"content-factory-{uuid.uuid4().hex[:12]}",
        system_message=ARTICLE_SYSTEM_PROMPT,
    ).with_model("anthropic", "claude-sonnet-4-6")

    resp = await chat.send_message(UserMessage(text=user_prompt))
    text = resp if isinstance(resp, str) else getattr(resp, "content", str(resp))
    # extract JSON
    m = re.search(r"\{.*\}", text, re.DOTALL)
    if not m:
        raise HTTPException(502, "LLM nu a returnat JSON valid")
    raw = m.group(0)
    try:
        data = json.loads(raw, strict=False)
    except json.JSONDecodeError:
        # tolerant retry: strip control chars, collapse smart double-quotes inside text
        cleaned = re.sub(r"[\x00-\x1f]", " ", raw).replace("\u201c", "«").replace("\u201d", "»")
        data = json.loads(cleaned, strict=False)
    return data


# ── Article store model ──
class GenerateIn(BaseModel):
    opportunity: Optional[dict] = None   # full opportunity object from detect_opportunities
    brief: Optional[dict] = None         # OR an explicit brief


class ArticlePatch(BaseModel):
    status: Optional[str] = None
    title: Optional[str] = None
    meta_description: Optional[str] = None
    h1: Optional[str] = None
    excerpt: Optional[str] = None
    sections: Optional[list] = None
    faq: Optional[list] = None


def _serialize_article(doc: dict) -> dict:
    return {
        "id": doc.get("article_id"),
        "slug": doc.get("slug"),
        "status": doc.get("status"),
        "cluster": doc.get("cluster"),
        "cluster_label": CLUSTERS.get(doc.get("cluster"), {}).get("label"),
        "city": doc.get("city"),
        "intent": doc.get("intent") or [],
        "primary_query": doc.get("primary_query"),
        "title": doc.get("title"),
        "meta_description": doc.get("meta_description"),
        "h1": doc.get("h1"),
        "excerpt": doc.get("excerpt"),
        "sections": doc.get("sections") or [],
        "faq": doc.get("faq") or [],
        "cta": doc.get("cta"),
        "cta_to": doc.get("cta_to"),
        "internal_links": doc.get("internal_links") or [],
        "source": doc.get("source"),
        "gap": doc.get("gap"),
        "brief": doc.get("brief"),
        "read_mins": doc.get("read_mins"),
        "created_at": doc.get("created_at"),
        "updated_at": doc.get("updated_at"),
        "published_at": doc.get("published_at"),
    }


# ── Admin endpoints ──
@admin_router.get("/opportunities")
async def get_opportunities(period: int = Query(90, ge=7, le=365), user=Depends(require_role("admin"))):
    return await detect_opportunities(period)


@admin_router.get("/performance")
async def get_performance(period: int = Query(28, ge=7, le=365), user=Depends(require_role("admin"))):
    """Content Growth Loop: article → traffic → CTA → lead → revenue → decision."""
    return await article_performance(period)


@admin_router.get("/summary")
async def factory_summary(user=Depends(require_role("admin"))):
    by_status = {}
    for st in WORKFLOW_STATUSES:
        by_status[st] = await db.content_articles.count_documents({"status": st})
    by_cluster = {}
    async for r in db.content_articles.aggregate([{"$group": {"_id": "$cluster", "n": {"$sum": 1}}}]):
        by_cluster[r["_id"] or "n/a"] = r["n"]
    return {
        "workflow": WORKFLOW_STATUSES,
        "articles_total": await db.content_articles.count_documents({}),
        "by_status": by_status,
        "by_cluster": by_cluster,
        "published": await db.content_articles.count_documents({"status": "published"}),
        "note": "V1: human review obligatoriu. Nimic nu se publică automat.",
    }


@admin_router.get("/articles")
async def list_articles(status: Optional[str] = None, user=Depends(require_role("admin"))):
    q = {}
    if status:
        q["status"] = status
    out = []
    async for doc in db.content_articles.find(q).sort("created_at", -1):
        out.append(_serialize_article(doc))
    return {"count": len(out), "articles": out}


@admin_router.post("/articles/generate")
async def generate_article(payload: GenerateIn, user=Depends(require_role("admin"))):
    opp = payload.opportunity or {}
    brief = payload.brief or build_brief(opp)
    generated = await generate_article_draft(brief)
    title = generated.get("title") or brief["title"]
    slug = _slugify(title)
    # ensure unique slug
    if await db.content_articles.find_one({"slug": slug}):
        slug = f"{slug}-{uuid.uuid4().hex[:5]}"
    words = sum(len(" ".join(s.get("paragraphs", [])).split()) for s in generated.get("sections", []))
    cmeta = CLUSTERS.get(brief["content_cluster"], CLUSTERS["design_interior"])
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "article_id": str(uuid.uuid4()),
        "slug": slug,
        "status": "draft",   # V1 — never auto-published
        "cluster": brief["content_cluster"],
        "city": brief.get("city"),
        "intent": brief.get("search_intent") or [],
        "primary_query": brief.get("primary_query"),
        "title": title,
        "meta_description": generated.get("meta_description", "")[:160],
        "h1": generated.get("h1") or title,
        "excerpt": generated.get("excerpt", ""),
        "sections": generated.get("sections", []),
        "faq": generated.get("faq", []),
        "cta": brief["cta"],
        "cta_to": brief["commercial_destination"],
        "internal_links": brief.get("existing_pages_to_link", []),
        "source": opp.get("source", "manual"),
        "gap": opp.get("gap"),
        "brief": brief,
        "read_mins": max(2, round(words / 200)),
        "created_by": user.get("email") or user.get("id"),
        "created_at": now,
        "updated_at": now,
        "published_at": None,
    }
    await db.content_articles.insert_one(doc)
    return {"ok": True, "article": _serialize_article(doc)}


@admin_router.patch("/articles/{article_id}")
async def patch_article(article_id: str, payload: ArticlePatch, user=Depends(require_role("admin"))):
    doc = await db.content_articles.find_one({"article_id": article_id})
    if not doc:
        raise HTTPException(404, "Articol inexistent")
    update = {k: v for k, v in payload.dict().items() if v is not None}
    if "status" in update:
        if update["status"] not in WORKFLOW_STATUSES:
            raise HTTPException(400, f"status invalid; permis: {WORKFLOW_STATUSES}")
        # publishing goes through the dedicated endpoint (guards + timestamp)
        if update["status"] == "published" and doc.get("status") != "published":
            raise HTTPException(400, "Folosește POST /articles/{id}/publish pentru publicare")
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.content_articles.update_one({"article_id": article_id}, {"$set": update})
    doc.update(update)
    return {"ok": True, "article": _serialize_article(doc)}


@admin_router.post("/articles/{article_id}/publish")
async def publish_article(article_id: str, user=Depends(require_role("admin"))):
    """Human-gated publish. Only APPROVED drafts can be published (V1 rule)."""
    doc = await db.content_articles.find_one({"article_id": article_id})
    if not doc:
        raise HTTPException(404, "Articol inexistent")
    if doc.get("status") != "approved":
        raise HTTPException(400, "Doar articolele cu status 'approved' pot fi publicate (human review obligatoriu în V1).")
    if not doc.get("sections"):
        raise HTTPException(400, "Articol fără conținut — nu poate fi publicat.")
    now = datetime.now(timezone.utc).isoformat()
    await db.content_articles.update_one(
        {"article_id": article_id},
        {"$set": {"status": "published", "published_at": now, "updated_at": now}})
    # refresh sitemap (reuse existing writer)
    try:
        from routes.public import write_sitemap_file
        await write_sitemap_file()
    except Exception as e:
        logger.warning(f"sitemap refresh after publish failed: {e}")
    doc["status"] = "published"; doc["published_at"] = now
    return {"ok": True, "article": _serialize_article(doc)}


@admin_router.delete("/articles/{article_id}")
async def delete_article(article_id: str, user=Depends(require_role("admin"))):
    r = await db.content_articles.delete_one({"article_id": article_id})
    if r.deleted_count == 0:
        raise HTTPException(404, "Articol inexistent")
    return {"ok": True, "deleted": True}


# ── Public endpoints (published only) ──
@public_router.get("/articles")
async def public_articles():
    out = []
    async for doc in db.content_articles.find({"status": "published"}).sort("published_at", -1):
        s = _serialize_article(doc)
        out.append({
            "slug": s["slug"], "title": s["title"], "h1": s["h1"], "excerpt": s["excerpt"],
            "meta_description": s["meta_description"], "cluster": s["cluster"],
            "cluster_label": s["cluster_label"], "city": s["city"], "read_mins": s["read_mins"],
            "published_at": s["published_at"],
        })
    return {"count": len(out), "articles": out}


@public_router.get("/articles/{slug}")
async def public_article(slug: str):
    doc = await db.content_articles.find_one({"slug": slug, "status": "published"})
    if not doc:
        raise HTTPException(404, "Articol negăsit sau nepublicat")
    return _serialize_article(doc)


# Helper for sitemap (published + indexable slugs)
async def published_article_slugs() -> list[tuple[str, str]]:
    out = []
    async for doc in db.content_articles.find(
        {"status": "published"}, {"slug": 1, "updated_at": 1, "_id": 0}):
        lm = (doc.get("updated_at") or "")[:10] or datetime.now(timezone.utc).strftime("%Y-%m-%d")
        out.append((doc["slug"], lm))
    return out
