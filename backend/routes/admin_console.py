"""PropManage router: admin_console (Metronic-style admin panel).

Provides:
- CMS content (key/value text) CRUD
- Email template editing
- Coverage zones (custom additions/disables on top of seed list)
- Trust score weights editor
- Platform settings (feature flags, commission, branding)
- Unified user management (list/filter/edit/ban)
- Finance overview, projects list, global search
- CSV exports (users, transactions, disputes)
- Live activity feed
"""
import csv
import io
import logging
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from db import db
from core_utils import serialize_doc
from deps import require_role
from romania_zones import ROMANIAN_ZONES

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/admin", tags=["admin_console"])


# ============= DEFAULTS =============
DEFAULT_CMS = {
    "landing.promo_banner": "",
    "hero.badge": "PROPERTY OPERATING SYSTEM • V4.2",
    "hero.title1": "Proprietatea ta,",
    "hero.title2": "perfecționată",
    "hero.title3": "digital.",
    "hero.subtitle": "PropManage creează un Digital Twin high-fidelity al locuinței tale, monitorizând starea structurală și performanța financiară în timp real. Liniștea structurată pentru proprietarul modern.",
    "hero.cta1": "Explorează Demo",
    "hero.cta1.variant_a": "Explorează Demo",
    "hero.cta1.variant_b": "Începe gratuit acum",
    "hero.cta2": "Vezi Flux Complet",
    "cta.badge": "READY TO BUILD",
    "cta.title1": "Gata să digitalizezi",
    "cta.title2": "tot ecosistemul?",
    "cta.intro": "Alătură-te celor 12,842 de utilizatori care au transformat proprietățile lor în active digitale gestionabile, valoroase și liniștitoare.",
    "cta.btn1": "Creează cont gratuit",
    "cta.btn2": "Talk to specialist",
    "cta.footer": "No credit card required · Cancel anytime · 14-day trial",
    "label.request.create": "Cere o ofertă",
    "label.marketplace.cta": "Vezi marketplace",
    "label.dashboard.client": "Panou Client",
    "label.dashboard.specialist": "Panou Specialist",
    "category.hvac.name": "HVAC & Climatizare",
    "category.hvac.desc": "Instalare, reparație și mentenanță sisteme de aer condiționat și încălzire.",
    "category.plumbing.name": "Instalații sanitare",
    "category.plumbing.desc": "Reparații țevi, scurgeri, instalare obiecte sanitare, dezobturări.",
    "category.electric.name": "Sistem electric",
    "category.electric.desc": "Instalații electrice, panouri, prize, întrerupătoare, certificări.",
    "category.design.name": "Design interior",
    "category.design.desc": "Concepte design, randări, planuri tehnice, implementare la cheie.",
}

DEFAULT_EMAIL_TEMPLATES = {
    "welcome": {
        "subject": "Bine ai venit la PropManage!",
        "html": "<h1>Salut {{name}}!</h1><p>Contul tău PropManage este activ. Începe prin a adăuga prima proprietate.</p>",
    },
    "dispute_opened": {
        "subject": "Dispută deschisă — Cazul #{{case_id}}",
        "html": "<p>Bună {{name}},</p><p>Disputa pentru lucrarea <b>{{request_title}}</b> a fost deschisă. Echipa noastră o va analiza în 24h.</p>",
    },
    "dispute_resolved": {
        "subject": "Dispută rezolvată — Cazul #{{case_id}}",
        "html": "<p>Disputa a fost rezolvată în favoarea: <b>{{verdict}}</b>.</p><p>Detalii: {{details}}</p>",
    },
    "escrow_funded": {
        "subject": "Fonduri securizate în Escrow",
        "html": "<p>Suma de <b>{{amount}} RON</b> a fost securizată în escrow pentru lucrarea <b>{{request_title}}</b>.</p>",
    },
    "specialist_verified": {
        "subject": "Cont VERIFIED ✓",
        "html": "<p>Felicitări {{name}}! Contul tău este acum VERIFIED. Ai acces la marketplace-ul de leads premium.</p>",
    },
}

DEFAULT_TRUST_WEIGHTS = {
    "on_time": 0.30,
    "reviews": 0.30,
    "photos": 0.15,
    "complaints_penalty": 0.15,
    "verification_bonus": 0.10,
}

DEFAULT_SETTINGS = {
    "stripe_live": False,
    "resend_live": False,
    "platform_commission_pct": 5.0,
    "lead_fee_ron": 45.0,
    "primary_color": "#d4ff3a",
    "logo_text": "PropManage",
    "support_email": "support@propmanage.io",
    "maintenance_mode": False,
}


# ============= MODELS =============
class CMSEntryIn(BaseModel):
    key: str
    value: str


class EmailTemplateIn(BaseModel):
    subject: str
    html: str


class ZoneIn(BaseModel):
    country: str = "România"
    city: str
    zone: str


class TrustWeightsIn(BaseModel):
    on_time: float = Field(ge=0, le=1)
    reviews: float = Field(ge=0, le=1)
    photos: float = Field(ge=0, le=1)
    complaints_penalty: float = Field(ge=0, le=1)
    verification_bonus: float = Field(ge=0, le=1)


class SettingsIn(BaseModel):
    stripe_live: Optional[bool] = None
    resend_live: Optional[bool] = None
    platform_commission_pct: Optional[float] = Field(None, ge=0, le=50)
    lead_fee_ron: Optional[float] = Field(None, ge=0, le=10000)
    primary_color: Optional[str] = None
    logo_text: Optional[str] = None
    support_email: Optional[str] = None
    maintenance_mode: Optional[bool] = None


class UserUpdateIn(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    verified: Optional[bool] = None
    tier: Optional[str] = None
    banned: Optional[bool] = None


# ============= CMS =============
@router.get("/cms")
async def list_cms(user: dict = Depends(require_role("admin"))):
    """Return merged: defaults + DB overrides. DB values win."""
    docs = await db.cms_content.find({}).to_list(500)
    overrides = {d["key"]: d.get("value", "") for d in docs}
    overrides_meta = {d["key"]: d for d in docs}
    out = []
    seen = set()
    for k, v in DEFAULT_CMS.items():
        seen.add(k)
        meta = overrides_meta.get(k)
        out.append({
            "key": k,
            "value": overrides.get(k, v),
            "default": v,
            "is_overridden": k in overrides,
            "updated_at": meta.get("updated_at") if meta else None,
            "updated_by": meta.get("updated_by") if meta else None,
        })
    # Custom keys created by admin not in defaults
    for k, v in overrides.items():
        if k in seen:
            continue
        meta = overrides_meta.get(k)
        out.append({
            "key": k,
            "value": v,
            "default": None,
            "is_overridden": True,
            "is_custom": True,
            "updated_at": meta.get("updated_at") if meta else None,
            "updated_by": meta.get("updated_by") if meta else None,
        })
    out.sort(key=lambda x: x["key"])
    return out


@router.put("/cms")
async def upsert_cms(data: CMSEntryIn, user: dict = Depends(require_role("admin"))):
    now = datetime.now(timezone.utc).isoformat()
    await db.cms_content.update_one(
        {"key": data.key},
        {"$set": {
            "key": data.key,
            "value": data.value,
            "updated_at": now,
            "updated_by": user["id"],
        }},
        upsert=True,
    )
    return {"ok": True, "key": data.key}


@router.delete("/cms/{key}")
async def reset_cms(key: str, user: dict = Depends(require_role("admin"))):
    await db.cms_content.delete_one({"key": key})
    return {"ok": True, "reset": key}


# Public endpoint (no auth) - frontend reads merged CMS
@router.get("/cms/public", include_in_schema=False)
async def cms_public_redirect():
    raise HTTPException(404, "Use /api/cms/public instead")


# ============= EMAIL TEMPLATES =============
@router.get("/email-templates")
async def list_email_templates(user: dict = Depends(require_role("admin"))):
    docs = await db.email_templates.find({}).to_list(100)
    overrides = {d["template_id"]: d for d in docs}
    out = []
    for tid, default in DEFAULT_EMAIL_TEMPLATES.items():
        override = overrides.get(tid)
        out.append({
            "id": tid,
            "subject": override.get("subject") if override else default["subject"],
            "html": override.get("html") if override else default["html"],
            "default_subject": default["subject"],
            "default_html": default["html"],
            "is_overridden": bool(override),
            "updated_at": override.get("updated_at") if override else None,
        })
    return out


@router.put("/email-templates/{template_id}")
async def update_email_template(template_id: str, data: EmailTemplateIn, user: dict = Depends(require_role("admin"))):
    if template_id not in DEFAULT_EMAIL_TEMPLATES:
        raise HTTPException(404, "Template not found")
    await db.email_templates.update_one(
        {"template_id": template_id},
        {"$set": {
            "template_id": template_id,
            "subject": data.subject,
            "html": data.html,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "updated_by": user["id"],
        }},
        upsert=True,
    )
    return {"ok": True}


@router.delete("/email-templates/{template_id}")
async def reset_email_template(template_id: str, user: dict = Depends(require_role("admin"))):
    await db.email_templates.delete_one({"template_id": template_id})
    return {"ok": True}


# ============= ZONES =============
@router.get("/zones")
async def list_zones(user: dict = Depends(require_role("admin"))):
    """Return seed zones + custom additions, with disabled flag."""
    custom_docs = await db.zones_custom.find({}).to_list(500)
    disabled_docs = await db.zones_disabled.find({}).to_list(500)
    disabled_set = {(d["country"], d["city"], d["zone"]) for d in disabled_docs}

    out = []
    for country, city, zone in ROMANIAN_ZONES:
        out.append({
            "country": country,
            "city": city,
            "zone": zone,
            "source": "seed",
            "disabled": (country, city, zone) in disabled_set,
        })
    for c in custom_docs:
        out.append({
            "country": c.get("country", "România"),
            "city": c.get("city"),
            "zone": c.get("zone"),
            "source": "custom",
            "id": str(c["_id"]),
            "disabled": False,
        })
    return out


@router.post("/zones")
async def add_zone(data: ZoneIn, user: dict = Depends(require_role("admin"))):
    norm = {
        "country": data.country.strip(),
        "city": data.city.strip(),
        "zone": data.zone.strip(),
    }
    if not norm["city"] or not norm["zone"]:
        raise HTTPException(400, "City and zone required")
    # Case-insensitive duplicate check
    exists = await db.zones_custom.find_one({
        "country": {"$regex": f"^{norm['country']}$", "$options": "i"},
        "city": {"$regex": f"^{norm['city']}$", "$options": "i"},
        "zone": {"$regex": f"^{norm['zone']}$", "$options": "i"},
    })
    if exists:
        raise HTTPException(400, "Zone already exists")
    doc = dict(norm)
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    doc["created_by"] = user["id"]
    res = await db.zones_custom.insert_one(doc)
    return {"ok": True, "id": str(res.inserted_id)}


@router.delete("/zones/custom/{zone_id}")
async def remove_custom_zone(zone_id: str, user: dict = Depends(require_role("admin"))):
    await db.zones_custom.delete_one({"_id": ObjectId(zone_id)})
    return {"ok": True}


@router.post("/zones/toggle")
async def toggle_zone(data: ZoneIn, user: dict = Depends(require_role("admin"))):
    """Disable/enable a seed zone."""
    q = {"country": data.country, "city": data.city, "zone": data.zone}
    existing = await db.zones_disabled.find_one(q)
    if existing:
        await db.zones_disabled.delete_one(q)
        return {"ok": True, "disabled": False}
    await db.zones_disabled.insert_one({**q, "disabled_at": datetime.now(timezone.utc).isoformat(), "disabled_by": user["id"]})
    return {"ok": True, "disabled": True}


# ============= TRUST WEIGHTS =============
@router.get("/trust-weights")
async def get_trust_weights(user: dict = Depends(require_role("admin"))):
    doc = await db.platform_config.find_one({"key": "trust_weights"})
    if not doc:
        return {**DEFAULT_TRUST_WEIGHTS, "is_default": True}
    return {**doc.get("value", DEFAULT_TRUST_WEIGHTS), "updated_at": doc.get("updated_at"), "is_default": False}


@router.put("/trust-weights")
async def set_trust_weights(data: TrustWeightsIn, user: dict = Depends(require_role("admin"))):
    weights = data.model_dump()
    total = sum(weights.values())
    if abs(total - 1.0) > 0.001:
        raise HTTPException(400, f"Weights must sum to 1.0 (got {total:.3f})")
    await db.platform_config.update_one(
        {"key": "trust_weights"},
        {"$set": {
            "key": "trust_weights",
            "value": weights,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "updated_by": user["id"],
        }},
        upsert=True,
    )
    return {"ok": True, **weights}


# ============= PLATFORM SETTINGS =============
@router.get("/settings")
async def get_settings(user: dict = Depends(require_role("admin"))):
    doc = await db.platform_config.find_one({"key": "settings"})
    base = dict(DEFAULT_SETTINGS)
    if doc:
        base.update(doc.get("value", {}))
        base["updated_at"] = doc.get("updated_at")
    return base


@router.put("/settings")
async def update_settings(data: SettingsIn, user: dict = Depends(require_role("admin"))):
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(400, "Nothing to update")
    doc = await db.platform_config.find_one({"key": "settings"})
    current = (doc or {}).get("value", {})
    merged = {**DEFAULT_SETTINGS, **current, **updates}
    await db.platform_config.update_one(
        {"key": "settings"},
        {"$set": {
            "key": "settings",
            "value": merged,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "updated_by": user["id"],
        }},
        upsert=True,
    )
    return {"ok": True, **merged}


# ============= USERS (Unified Management) =============
@router.get("/users")
async def list_users(
    user: dict = Depends(require_role("admin")),
    role: Optional[str] = None,
    q: Optional[str] = None,
    verified: Optional[bool] = None,
    banned: Optional[bool] = None,
    skip: int = 0,
    limit: int = Query(50, le=200),
):
    filt = {}
    if role:
        filt["role"] = role
    if verified is not None:
        filt["verified"] = verified
    if banned is not None:
        filt["banned"] = banned
    if q:
        filt["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"email": {"$regex": q, "$options": "i"}},
        ]
    total = await db.users.count_documents(filt)
    cursor = db.users.find(filt).sort("created_at", -1).skip(skip).limit(limit)
    items = [serialize_doc(d) async for d in cursor]
    return {"items": items, "total": total, "skip": skip, "limit": limit}


@router.patch("/users/{user_id}")
async def update_user(user_id: str, data: UserUpdateIn, user: dict = Depends(require_role("admin"))):
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(400, "Nothing to update")
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    updates["updated_by"] = user["id"]
    res = await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(404, "User not found")
    return {"ok": True}


@router.post("/users/{user_id}/ban")
async def ban_user(user_id: str, user: dict = Depends(require_role("admin"))):
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"banned": True, "banned_at": datetime.now(timezone.utc).isoformat(), "banned_by": user["id"]}},
    )
    return {"ok": True}


@router.post("/users/{user_id}/unban")
async def unban_user(user_id: str, user: dict = Depends(require_role("admin"))):
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$unset": {"banned": "", "banned_at": "", "banned_by": ""}},
    )
    return {"ok": True}


# ============= GLOBAL SEARCH =============
@router.get("/search")
async def global_search(
    q: str = Query(..., min_length=2),
    user: dict = Depends(require_role("admin")),
):
    pattern = {"$regex": q, "$options": "i"}
    users = await db.users.find(
        {"$or": [{"name": pattern}, {"email": pattern}]}
    ).limit(8).to_list(8)
    requests = await db.requests.find(
        {"$or": [{"title": pattern}, {"description": pattern}]}
    ).limit(8).to_list(8)
    projects = await db.projects.find(
        {"name": pattern}
    ).limit(8).to_list(8)
    return {
        "users": [{"id": str(u["_id"]), "name": u.get("name"), "email": u.get("email"), "role": u.get("role")} for u in users],
        "requests": [{"id": str(r["_id"]), "title": r.get("title"), "status": r.get("status")} for r in requests],
        "projects": [{"id": str(p["_id"]), "name": p.get("name"), "status": p.get("status")} for p in projects],
    }


# ============= FINANCE OVERVIEW =============
@router.get("/finance/overview")
async def finance_overview(user: dict = Depends(require_role("admin"))):
    """Wallet totals + transaction sums."""
    users = await db.users.find({}, {"wallet_balance": 1, "name": 1, "email": 1, "role": 1}).to_list(2000)
    total_wallet = sum((u.get("wallet_balance") or 0) for u in users)
    top_wallets = sorted(
        [{"id": str(u["_id"]), "name": u.get("name"), "email": u.get("email"), "role": u.get("role"), "balance": u.get("wallet_balance") or 0} for u in users],
        key=lambda x: x["balance"], reverse=True
    )[:10]

    # tx totals last 30 days
    since = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    pipeline = [
        {"$match": {"created_at": {"$gte": since}}},
        {"$group": {"_id": "$type", "total": {"$sum": "$amount"}, "count": {"$sum": 1}}},
    ]
    tx_agg = await db.transactions.aggregate(pipeline).to_list(20)
    by_type = [{"type": t["_id"] or "unknown", "total": t["total"], "count": t["count"]} for t in tx_agg]

    # Escrow held
    escrow_held = 0
    async for r in db.requests.find({"status": {"$in": ["assigned", "in_progress", "completed"]}, "escrow_amount": {"$gt": 0}}):
        escrow_held += r.get("escrow_amount", 0)

    return {
        "total_wallet": round(total_wallet, 2),
        "escrow_held": round(escrow_held, 2),
        "top_wallets": top_wallets,
        "tx_by_type": by_type,
    }


# ============= PROJECTS LIST =============
@router.get("/projects")
async def admin_projects(
    user: dict = Depends(require_role("admin")),
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = Query(50, le=200),
):
    filt = {}
    if status:
        filt["status"] = status
    total = await db.projects.count_documents(filt)
    cursor = db.projects.find(filt).sort("created_at", -1).skip(skip).limit(limit)
    docs = [serialize_doc(d) async for d in cursor]
    # Enrich names
    uids = set()
    for d in docs:
        if d.get("client_id"):
            uids.add(d["client_id"])
        if d.get("designer_id"):
            uids.add(d["designer_id"])
    umap = {}
    if uids:
        async for u in db.users.find({"_id": {"$in": [ObjectId(uid) for uid in uids]}}, {"name": 1, "email": 1}):
            umap[str(u["_id"])] = u
    for d in docs:
        d["client_name"] = (umap.get(d.get("client_id")) or {}).get("name")
        d["designer_name"] = (umap.get(d.get("designer_id")) or {}).get("name")
    return {"items": docs, "total": total}


# ============= CSV EXPORTS =============
def _csv_response(rows: List[dict], filename: str):
    if not rows:
        rows = [{"info": "no data"}]
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=list(rows[0].keys()))
    writer.writeheader()
    writer.writerows(rows)
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/export/users.csv")
async def export_users(user: dict = Depends(require_role("admin"))):
    rows = []
    async for u in db.users.find({}):
        rows.append({
            "id": str(u["_id"]),
            "name": u.get("name", ""),
            "email": u.get("email", ""),
            "role": u.get("role", ""),
            "verified": u.get("verified", False),
            "tier": u.get("tier", ""),
            "wallet_balance": u.get("wallet_balance", 0),
            "created_at": u.get("created_at", ""),
            "banned": u.get("banned", False),
        })
    return _csv_response(rows, "users.csv")


@router.get("/export/transactions.csv")
async def export_transactions(user: dict = Depends(require_role("admin"))):
    rows = []
    async for t in db.transactions.find({}).sort("created_at", -1).limit(5000):
        rows.append({
            "id": str(t["_id"]),
            "user_id": t.get("user_id", ""),
            "type": t.get("type", ""),
            "amount": t.get("amount", 0),
            "created_at": t.get("created_at", ""),
        })
    return _csv_response(rows, "transactions.csv")


@router.get("/export/disputes.csv")
async def export_disputes(user: dict = Depends(require_role("admin"))):
    rows = []
    async for d in db.disputes.find({}).sort("created_at", -1):
        rows.append({
            "id": str(d["_id"]),
            "request_id": d.get("request_id", ""),
            "opened_by": d.get("opened_by", ""),
            "status": d.get("status", ""),
            "reason": (d.get("reason") or "")[:200],
            "verdict": d.get("verdict", ""),
            "created_at": d.get("created_at", ""),
        })
    return _csv_response(rows, "disputes.csv")


# ============= LIVE ACTIVITY FEED =============
@router.get("/activity-feed-live")
async def activity_feed_live(limit: int = Query(20, le=100), user: dict = Depends(require_role("admin"))):
    docs = await db.events.find({}).sort("created_at", -1).limit(limit).to_list(limit)
    # Enrich user names
    uids = {d.get("actor_id") for d in docs if d.get("actor_id")}
    umap = {}
    if uids:
        async for u in db.users.find({"_id": {"$in": [ObjectId(uid) for uid in uids if uid]}}, {"name": 1, "role": 1}):
            umap[str(u["_id"])] = u
    out = []
    for d in docs:
        actor = umap.get(d.get("actor_id"))
        out.append({
            "id": str(d.get("_id")),
            "type": d.get("type"),
            "message": d.get("message"),
            "created_at": d.get("created_at"),
            "actor_name": actor.get("name") if actor else None,
            "actor_role": actor.get("role") if actor else None,
        })
    return out


# ============= PUBLIC CMS (no auth) =============
public_router = APIRouter(prefix="/api", tags=["cms_public"])


@public_router.get("/cms/public")
async def get_public_cms():
    """Return merged defaults + overrides as flat dict (no auth)."""
    docs = await db.cms_content.find({}).to_list(500)
    overrides = {d["key"]: d.get("value", "") for d in docs}
    merged = {**DEFAULT_CMS, **overrides}
    return merged


# ============= A/B TESTING =============
class ABEventIn(BaseModel):
    experiment: str = Field(min_length=2, max_length=64)
    variant: str = Field(pattern="^(a|b)$")
    event: str = Field(pattern="^(impression|click)$")
    session_id: Optional[str] = None


@public_router.post("/ab/track")
async def ab_track(data: ABEventIn):
    """Track A/B test event. Public — no auth. Deduplicates impressions per (session, exp, variant)."""
    now = datetime.now(timezone.utc).isoformat()
    if data.event == "impression" and data.session_id:
        # 1 impression per session per (exp, variant)
        exists = await db.ab_events.find_one({
            "experiment": data.experiment,
            "variant": data.variant,
            "event": "impression",
            "session_id": data.session_id,
        })
        if exists:
            return {"ok": True, "deduplicated": True}
    await db.ab_events.insert_one({
        "experiment": data.experiment,
        "variant": data.variant,
        "event": data.event,
        "session_id": data.session_id,
        "created_at": now,
    })
    return {"ok": True}


@router.get("/ab/stats")
async def ab_stats(user: dict = Depends(require_role("admin"))):
    """Return per-experiment, per-variant counts + CTR."""
    pipeline = [
        {"$group": {
            "_id": {"experiment": "$experiment", "variant": "$variant", "event": "$event"},
            "count": {"$sum": 1},
        }},
    ]
    rows = await db.ab_events.aggregate(pipeline).to_list(200)
    # Reshape: experiment -> variant -> {impressions, clicks}
    exp_map = {}
    for r in rows:
        eid = r["_id"]["experiment"]
        var = r["_id"]["variant"]
        evt = r["_id"]["event"]
        exp_map.setdefault(eid, {}).setdefault(var, {"impressions": 0, "clicks": 0})[f"{evt}s"] = r["count"]

    out = []
    KNOWN = {"hero_cta1": {"label": "Hero CTA principal", "keys": ["hero.cta1.variant_a", "hero.cta1.variant_b"]}}
    for eid, vmap in exp_map.items():
        meta = KNOWN.get(eid, {"label": eid, "keys": []})
        variants = []
        for v in ["a", "b"]:
            stats = vmap.get(v, {"impressions": 0, "clicks": 0})
            impr = stats.get("impressions", 0)
            clk = stats.get("clicks", 0)
            ctr = (clk / impr * 100) if impr else 0
            variants.append({
                "variant": v,
                "impressions": impr,
                "clicks": clk,
                "ctr": round(ctr, 2),
            })
        # Winner: highest CTR if both have >= 30 impressions
        winner = None
        if variants[0]["impressions"] >= 30 and variants[1]["impressions"] >= 30:
            if variants[0]["ctr"] > variants[1]["ctr"]:
                winner = "a"
            elif variants[1]["ctr"] > variants[0]["ctr"]:
                winner = "b"
        out.append({
            "experiment": eid,
            "label": meta["label"],
            "keys": meta["keys"],
            "variants": variants,
            "winner": winner,
        })
    # Ensure known experiments appear even with zero data
    for eid, meta in KNOWN.items():
        if not any(o["experiment"] == eid for o in out):
            out.append({
                "experiment": eid,
                "label": meta["label"],
                "keys": meta["keys"],
                "variants": [
                    {"variant": "a", "impressions": 0, "clicks": 0, "ctr": 0},
                    {"variant": "b", "impressions": 0, "clicks": 0, "ctr": 0},
                ],
                "winner": None,
            })
    return out


@router.delete("/ab/{experiment}/reset")
async def ab_reset(experiment: str, user: dict = Depends(require_role("admin"))):
    res = await db.ab_events.delete_many({"experiment": experiment})
    return {"ok": True, "deleted": res.deleted_count}
