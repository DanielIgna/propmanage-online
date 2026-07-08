"""PropManage Analytics & Growth — tracking propriu + campanii + dashboard KPI.

ARHITECTURĂ MODULARĂ (zona admin: BUSINESS → Statistici & KPI):
  • Tracker first-party: frontend/src/lib/analytics.js → POST /api/track (batch)
  • Integrări externe pluggable (Clarity / GA4 / Meta Pixel) prin analytics_settings
    — scripturile se injectează în frontend DOAR dacă ID-ul e configurat.
  • Link scurt per campanie: GET /api/go/{code} → redirect cu atribuire.

Colecții: analytics_events, analytics_sessions, growth_campaigns, analytics_settings
"""
import csv
import io
import logging
import os
import secrets
import uuid
from collections import defaultdict
from datetime import datetime, timezone, timedelta
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Request, Query
from fastapi.responses import RedirectResponse, StreamingResponse, Response
from pydantic import BaseModel, Field

from db import db
from deps import require_role

logger = logging.getLogger("propmanage.analytics_growth")

router = APIRouter(prefix="/api", tags=["analytics-growth"])
admin_router = APIRouter(prefix="/api/admin", tags=["analytics-growth-admin"])

APP_PUBLIC_URL = (os.environ.get("APP_PUBLIC_URL") or "").rstrip("/")

KNOWN_SOURCES = ["whatsapp", "facebook", "google", "direct", "qr", "admin", "other"]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _day(ts: Optional[str] = None) -> str:
    return (ts or _now())[:10]


def classify_source(referrer: str = "", utm_source: str = "", campaign_code: str = "", via_qr: bool = False) -> str:
    """Clasifică sursa de trafic — modular, ușor de extins."""
    u = (utm_source or "").lower()
    r = (referrer or "").lower()
    if via_qr or u == "qr":
        return "qr"
    if u:
        for s in ("whatsapp", "facebook", "google", "admin"):
            if s in u:
                return s
        return "other"
    if campaign_code:
        return "other"
    if "wa.me" in r or "whatsapp" in r:
        return "whatsapp"
    if "facebook" in r or "fb.com" in r or "instagram" in r:
        return "facebook"
    if "google" in r or "gclid" in r:
        return "google"
    if not r:
        return "direct"
    return "other"


# ═══════════════════════════ TRACKING (public) ═══════════════════════════

class TrackEvent(BaseModel):
    type: str  # pageview | heartbeat | click | funnel
    path: str = ""
    referrer: str = ""
    utm_source: str = ""
    utm_campaign: str = ""
    campaign_code: str = ""
    via_qr: bool = False
    duration_ms: int = 0          # heartbeat: timp acumulat pe pagină
    x_pct: Optional[float] = None  # click: coordonate % (pt heatmap Faza 2)
    y_pct: Optional[float] = None
    funnel_step: str = ""          # signup_started | account_created | property_added | subscription | specialist_request
    ts: str = ""


class TrackBatch(BaseModel):
    visitor_id: str = Field(min_length=8, max_length=64)
    session_id: str = Field(min_length=8, max_length=64)
    user_role: str = ""
    events: List[TrackEvent] = Field(max_length=50)


@router.post("/track")
async def ingest_events(batch: TrackBatch, request: Request):
    """Ingestie batch de evenimente de la trackerul first-party. Fără auth (public)."""
    settings = await _get_settings()
    if not settings.get("tracker_enabled", True):
        return {"ok": True, "ingested": 0}
    now = _now()
    docs = []
    sess_updates = {"last_seen_at": now}
    inc = defaultdict(int)
    for ev in batch.events[:50]:
        path = (ev.path or "")[:300]
        if path.startswith("/admin"):
            continue  # nu poluăm statisticile cu trafic admin
        source = classify_source(ev.referrer, ev.utm_source, ev.campaign_code, ev.via_qr)
        docs.append({
            "event_id": str(uuid.uuid4()),
            "type": ev.type[:20],
            "path": path,
            "referrer": (ev.referrer or "")[:300],
            "source": source,
            "utm_source": (ev.utm_source or "")[:100],
            "utm_campaign": (ev.utm_campaign or "")[:100],
            "campaign_code": (ev.campaign_code or "")[:40],
            "duration_ms": max(0, min(ev.duration_ms, 3_600_000)),
            "x_pct": ev.x_pct, "y_pct": ev.y_pct,
            "funnel_step": (ev.funnel_step or "")[:40],
            "visitor_id": batch.visitor_id,
            "session_id": batch.session_id,
            "day": _day(now),
            "ts": ev.ts or now,
        })
        if ev.type == "pageview":
            inc["pageviews"] += 1
        elif ev.type == "heartbeat":
            inc["duration_ms"] += max(0, min(ev.duration_ms, 300_000))
        if ev.campaign_code:
            sess_updates["campaign_code"] = ev.campaign_code[:40]
        if source != "direct" or "source" not in sess_updates:
            sess_updates.setdefault("source", source)
        if ev.type == "funnel" and ev.funnel_step:
            sess_updates[f"funnel_{ev.funnel_step[:30]}"] = True
    if docs:
        await db.analytics_events.insert_many(docs)
    await db.analytics_sessions.update_one(
        {"session_id": batch.session_id},
        {
            "$set": sess_updates,
            "$setOnInsert": {
                "visitor_id": batch.visitor_id,
                "started_at": now,
                "day": _day(now),
                "entry_path": docs[0]["path"] if docs else "/",
            },
            "$inc": dict(inc) if inc else {"pageviews": 0},
        },
        upsert=True,
    )
    return {"ok": True, "ingested": len(docs)}


@router.get("/track/config")
async def tracker_config():
    """Config public pentru tracker + integrări externe (Clarity/GA4/Meta)."""
    s = await _get_settings()
    return {
        "enabled": s.get("tracker_enabled", True),
        "clarity_id": s.get("clarity_id") or "",
        "ga4_id": s.get("ga4_id") or "",
        "meta_pixel_id": s.get("meta_pixel_id") or "",
    }


@router.get("/go/{code}")
async def campaign_short_link(code: str, qr: int = 0):
    """Link scurt personalizat per campanie → redirect cu atribuire UTM."""
    camp = await db.growth_campaigns.find_one({"code": code})
    if not camp:
        return RedirectResponse(url="/", status_code=302)
    field = "qr_opens" if qr else "link_opens"
    await db.growth_campaigns.update_one({"code": code}, {"$inc": {field: 1, "opens": 1}})
    src = "qr" if qr else (camp.get("channel") or "other")
    target = f"/?c={code}&utm_source={src}&utm_campaign={code}" + ("&via_qr=1" if qr else "")
    return RedirectResponse(url=target, status_code=302)


# ═══════════════════════ SETTINGS / INTEGRĂRI (admin) ═══════════════════════

async def _get_settings() -> dict:
    s = await db.analytics_settings.find_one({"_id": "integrations"})
    if not s:
        s = {"_id": "integrations", "tracker_enabled": True, "clarity_id": "", "ga4_id": "", "meta_pixel_id": ""}
        await db.analytics_settings.insert_one(s)
    return s


class IntegrationsUpdate(BaseModel):
    tracker_enabled: Optional[bool] = None
    clarity_id: Optional[str] = None
    ga4_id: Optional[str] = None
    meta_pixel_id: Optional[str] = None


@admin_router.get("/analytics/integrations")
async def get_integrations(user: dict = Depends(require_role("admin"))):
    s = await _get_settings()
    s.pop("_id", None)
    return s


@admin_router.put("/analytics/integrations")
async def update_integrations(body: IntegrationsUpdate, user: dict = Depends(require_role("admin"))):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(400, "Nimic de actualizat")
    updates["updated_at"] = _now()
    updates["updated_by"] = user.get("email")
    await db.analytics_settings.update_one({"_id": "integrations"}, {"$set": updates}, upsert=True)
    logger.info("Analytics integrations updated by %s: %s", user.get("email"), list(updates))
    s = await _get_settings()
    s.pop("_id", None)
    return s


# ═══════════════════════ CAMPANII GROWTH (admin) ═══════════════════════

class CampaignCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    administrator: str = ""
    association: str = ""
    apartments_count: int = 0
    channel: str = "whatsapp"      # canal de distribuție (whatsapp/facebook/google/qr/admin/other)
    recipients_count: int = 0      # câte persoane au primit mesajul
    sent_at: str = ""
    notes: str = ""


class CampaignUpdate(BaseModel):
    name: Optional[str] = None
    administrator: Optional[str] = None
    association: Optional[str] = None
    apartments_count: Optional[int] = None
    channel: Optional[str] = None
    recipients_count: Optional[int] = None
    sent_at: Optional[str] = None
    notes: Optional[str] = None
    revenue_manual: Optional[float] = None
    status: Optional[str] = None


def _campaign_public(c: dict) -> dict:
    c.pop("_id", None)
    return c


@admin_router.post("/growth/campaigns")
async def create_campaign(body: CampaignCreate, user: dict = Depends(require_role("admin"))):
    code = secrets.token_urlsafe(4).replace("_", "x").replace("-", "z").lower()[:6]
    doc = {
        "id": str(uuid.uuid4()),
        "code": code,
        "url": f"{APP_PUBLIC_URL}/api/go/{code}",
        "qr_url": f"{APP_PUBLIC_URL}/api/go/{code}?qr=1",
        **body.model_dump(),
        "status": "active",
        "opens": 0, "link_opens": 0, "qr_opens": 0,
        "revenue_manual": 0.0,
        "created_by": user.get("email"),
        "created_at": _now(),
    }
    if not doc["sent_at"]:
        doc["sent_at"] = _now()
    await db.growth_campaigns.insert_one(doc)
    return _campaign_public(doc)


@admin_router.get("/growth/campaigns")
async def list_campaigns(user: dict = Depends(require_role("admin"))):
    docs = await db.growth_campaigns.find({}).sort("created_at", -1).to_list(200)
    items = []
    for c in docs:
        stats = await _campaign_stats(c)
        items.append({**_campaign_public(c), **stats})
    return {"items": items, "count": len(items)}


@admin_router.patch("/growth/campaigns/{cid}")
async def update_campaign(cid: str, body: CampaignUpdate, user: dict = Depends(require_role("admin"))):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(400, "Nimic de actualizat")
    res = await db.growth_campaigns.update_one({"id": cid}, {"$set": updates})
    if not res.matched_count:
        raise HTTPException(404, "Campanie inexistentă")
    c = await db.growth_campaigns.find_one({"id": cid})
    return _campaign_public(c)


@admin_router.delete("/growth/campaigns/{cid}")
async def delete_campaign(cid: str, user: dict = Depends(require_role("admin"))):
    res = await db.growth_campaigns.delete_one({"id": cid})
    if not res.deleted_count:
        raise HTTPException(404, "Campanie inexistentă")
    return {"ok": True}


async def _campaign_stats(camp: dict) -> dict:
    """Indicatorii de startup per campanie:
    primit → deschis link → 30s+ pe site → început înregistrare → cont finalizat → revenit în 7 zile."""
    code = camp.get("code")
    sessions = await db.analytics_sessions.find({"campaign_code": code}).to_list(5000)
    visitors = {}
    for s in sessions:
        v = visitors.setdefault(s["visitor_id"], {"days": set(), "dur": 0, "signup_started": False, "account_created": False, "subscription": False})
        v["days"].add(s.get("day"))
        v["dur"] = max(v["dur"], s.get("duration_ms", 0))
        for f in ("signup_started", "account_created", "subscription", "specialist_request", "property_added"):
            if s.get(f"funnel_{f}"):
                v[f] = True
    recipients = camp.get("recipients_count", 0)
    opened = camp.get("opens", 0)
    unique_visitors = len(visitors)
    over_30s = sum(1 for v in visitors.values() if v["dur"] >= 30_000)
    signup_started = sum(1 for v in visitors.values() if v.get("signup_started"))
    accounts = sum(1 for v in visitors.values() if v.get("account_created"))
    subscriptions = sum(1 for v in visitors.values() if v.get("subscription"))
    returned_7d = sum(1 for v in visitors.values() if len(v["days"]) >= 2)
    conversion = round(accounts / unique_visitors * 100, 1) if unique_visitors else 0.0
    return {
        "stats": {
            "recipients": recipients,
            "opened": opened,
            "unique_visitors": unique_visitors,
            "over_30s": over_30s,
            "signup_started": signup_started,
            "accounts_created": accounts,
            "subscriptions": subscriptions,
            "returned_7d": returned_7d,
            "conversion_pct": conversion,
            "revenue": camp.get("revenue_manual") or 0.0,
        }
    }


@admin_router.get("/growth/campaigns/{cid}/qr")
async def campaign_qr(cid: str, user: dict = Depends(require_role("admin"))):
    """QR personalizat (PNG) pentru linkul campaniei."""
    camp = await db.growth_campaigns.find_one({"id": cid})
    if not camp:
        raise HTTPException(404, "Campanie inexistentă")
    import qrcode
    img = qrcode.make(camp["qr_url"], box_size=10, border=2)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return Response(content=buf.getvalue(), media_type="image/png",
                    headers={"Content-Disposition": f'attachment; filename="qr_{camp["code"]}.png"'})


# ═══════════════════════ DASHBOARD KPI (admin) ═══════════════════════

def _period_range(period: str, date_from: str = "", date_to: str = "") -> tuple:
    today = datetime.now(timezone.utc).date()
    if period == "day":
        start = today
    elif period == "week":
        start = today - timedelta(days=6)
    elif period == "month":
        start = today - timedelta(days=29)
    else:  # custom
        start = datetime.fromisoformat(date_from).date() if date_from else today - timedelta(days=29)
        today = datetime.fromisoformat(date_to).date() if date_to else today
    return start.isoformat(), today.isoformat()


@admin_router.get("/analytics/overview")
async def analytics_overview(
    period: str = Query("week", pattern="^(day|week|month|custom)$"),
    date_from: str = "", date_to: str = "",
    user: dict = Depends(require_role("admin")),
):
    d_from, d_to = _period_range(period, date_from, date_to)
    q = {"day": {"$gte": d_from, "$lte": d_to}}

    sessions = await db.analytics_sessions.find(q).to_list(20000)
    visitors = {s["visitor_id"] for s in sessions}
    bounces = sum(1 for s in sessions if (s.get("pageviews") or 0) <= 1)
    total_dur = sum(s.get("duration_ms", 0) for s in sessions)

    # Surse trafic
    by_source = defaultdict(lambda: {"sessions": 0, "visitors": set()})
    daily = defaultdict(lambda: {"sessions": 0, "visitors": set()})
    for s in sessions:
        src = s.get("source") or "direct"
        by_source[src]["sessions"] += 1
        by_source[src]["visitors"].add(s["visitor_id"])
        daily[s.get("day")]["sessions"] += 1
        daily[s.get("day")]["visitors"].add(s["visitor_id"])

    # KPI din datele interne (creat în perioadă)
    iso_from, iso_to = d_from, d_to + "T23:59:59"
    accounts = await db.users.count_documents({"created_at": {"$gte": iso_from, "$lte": iso_to}})
    specialists = await db.users.count_documents({"role": "specialist", "created_at": {"$gte": iso_from, "$lte": iso_to}})
    properties = await db.properties.count_documents({"created_at": {"$gte": iso_from, "$lte": iso_to}})
    requests_n = await db.requests.count_documents({"created_at": {"$gte": iso_from, "$lte": iso_to}})
    subs = await db.hh_subscriptions.count_documents({"created_at": {"$gte": iso_from, "$lte": iso_to}})

    # Funnel (vizită → cont → proprietate → abonament → solicitare)
    funnel = [
        {"step": "Vizită", "count": len(visitors)},
        {"step": "Cont creat", "count": accounts},
        {"step": "Proprietate adăugată", "count": properties},
        {"step": "Abonament", "count": subs},
        {"step": "Solicitare specialist", "count": requests_n},
    ]

    # Serie zilnică completă (zile fără trafic = 0)
    series = []
    cur = datetime.fromisoformat(d_from).date()
    end = datetime.fromisoformat(d_to).date()
    while cur <= end:
        k = cur.isoformat()
        series.append({"day": k, "sessions": daily[k]["sessions"], "visitors": len(daily[k]["visitors"])})
        cur += timedelta(days=1)

    return {
        "period": {"from": d_from, "to": d_to},
        "kpi": {
            "unique_visitors": len(visitors),
            "sessions": len(sessions),
            "accounts_created": accounts,
            "specialists_signed": specialists,
            "properties_added": properties,
            "specialist_requests": requests_n,
            "subscriptions": subs,
            "bounce_rate_pct": round(bounces / len(sessions) * 100, 1) if sessions else 0.0,
            "avg_session_sec": round(total_dur / len(sessions) / 1000) if sessions else 0,
        },
        "sources": [
            {"source": k, "sessions": v["sessions"], "visitors": len(v["visitors"])}
            for k, v in sorted(by_source.items(), key=lambda x: -x[1]["sessions"])
        ],
        "funnel": funnel,
        "series": series,
    }


@admin_router.get("/analytics/pages")
async def analytics_pages(
    period: str = Query("week", pattern="^(day|week|month|custom)$"),
    date_from: str = "", date_to: str = "",
    user: dict = Depends(require_role("admin")),
):
    """Per pagină: vizualizări, timp mediu, bounce."""
    d_from, d_to = _period_range(period, date_from, date_to)
    q = {"day": {"$gte": d_from, "$lte": d_to}, "type": {"$in": ["pageview", "heartbeat"]}}
    pages = defaultdict(lambda: {"views": 0, "duration_ms": 0, "sessions": set()})
    async for e in db.analytics_events.find(q, {"path": 1, "type": 1, "duration_ms": 1, "session_id": 1}):
        p = pages[e.get("path") or "/"]
        if e["type"] == "pageview":
            p["views"] += 1
            p["sessions"].add(e["session_id"])
        else:
            p["duration_ms"] += e.get("duration_ms", 0)
    # bounce per pagină de intrare
    entry_counts = defaultdict(lambda: {"entries": 0, "bounces": 0})
    async for s in db.analytics_sessions.find({"day": {"$gte": d_from, "$lte": d_to}}, {"entry_path": 1, "pageviews": 1}):
        ep = s.get("entry_path") or "/"
        entry_counts[ep]["entries"] += 1
        if (s.get("pageviews") or 0) <= 1:
            entry_counts[ep]["bounces"] += 1
    items = []
    for path, p in sorted(pages.items(), key=lambda x: -x[1]["views"]):
        ec = entry_counts.get(path, {"entries": 0, "bounces": 0})
        items.append({
            "path": path,
            "views": p["views"],
            "avg_time_sec": round(p["duration_ms"] / max(1, p["views"]) / 1000),
            "bounce_rate_pct": round(ec["bounces"] / ec["entries"] * 100, 1) if ec["entries"] else 0.0,
        })
    return {"items": items[:100], "period": {"from": d_from, "to": d_to}}


@admin_router.get("/analytics/export.csv")
async def export_csv(
    report: str = Query("overview", pattern="^(overview|campaigns|pages)$"),
    period: str = "month", date_from: str = "", date_to: str = "",
    user: dict = Depends(require_role("admin")),
):
    buf = io.StringIO()
    w = csv.writer(buf)
    if report == "campaigns":
        docs = await db.growth_campaigns.find({}).sort("created_at", -1).to_list(500)
        w.writerow(["nume", "administrator", "asociatie", "apartamente", "canal", "trimis_la", "link", "primit", "deschis",
                    "vizitatori_unici", "peste_30s", "inceput_inregistrare", "conturi", "abonamente", "revenit_7z", "conversie_pct", "venit"])
        for c in docs:
            st = (await _campaign_stats(c))["stats"]
            w.writerow([c.get("name"), c.get("administrator"), c.get("association"), c.get("apartments_count"),
                        c.get("channel"), c.get("sent_at", "")[:10], c.get("url"), st["recipients"], st["opened"],
                        st["unique_visitors"], st["over_30s"], st["signup_started"], st["accounts_created"],
                        st["subscriptions"], st["returned_7d"], st["conversion_pct"], st["revenue"]])
    elif report == "pages":
        data = await analytics_pages(period, date_from, date_to, user)
        w.writerow(["pagina", "vizualizari", "timp_mediu_sec", "bounce_pct"])
        for i in data["items"]:
            w.writerow([i["path"], i["views"], i["avg_time_sec"], i["bounce_rate_pct"]])
    else:
        data = await analytics_overview(period, date_from, date_to, user)
        w.writerow(["zi", "vizitatori", "sesiuni"])
        for s in data["series"]:
            w.writerow([s["day"], s["visitors"], s["sessions"]])
        w.writerow([])
        w.writerow(["kpi", "valoare"])
        for k, v in data["kpi"].items():
            w.writerow([k, v])
    return StreamingResponse(
        iter([buf.getvalue().encode("utf-8-sig")]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="propmanage_{report}.csv"'},
    )
