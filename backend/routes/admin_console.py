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


# ============= AUDIT LOG HELPER =============
async def audit(action: str, actor: dict, target: Optional[dict] = None, before: Optional[dict] = None, after: Optional[dict] = None, note: Optional[str] = None):
    """Persist an admin action to the audit_log collection. Fire-and-forget (won't break request)."""
    try:
        await db.admin_audit_log.insert_one({
            "action": action,
            "actor_id": actor.get("id"),
            "actor_name": actor.get("name"),
            "actor_email": actor.get("email"),
            "target_type": (target or {}).get("type"),
            "target_id": (target or {}).get("id"),
            "target_label": (target or {}).get("label"),
            "before": before,
            "after": after,
            "note": note,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    except Exception as exc:
        logger.warning(f"Audit log write failed for {action}: {exc}")


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
    "cta.badge": "GATA DE LANSARE",
    "cta.title1": "Gata să digitalizezi",
    "cta.title2": "tot ecosistemul?",
    "cta.intro": "Alătură-te celor 12,842 de utilizatori care au transformat proprietățile lor în active digitale gestionabile, valoroase și liniștitoare.",
    "cta.btn1": "Creează cont gratuit",
    "cta.btn2": "Vorbește cu un specialist",
    "cta.footer": "Fără card de credit · Anulezi oricând · Probă 14 zile",
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
    # Landing page section visibility flags
    "landing_show_admin_trust": False,
    "landing_show_business_model": False,
    "landing_show_unit_economics": False,
    "landing_show_value_proposition": True,
    "landing_show_golden_path": True,
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
    landing_show_admin_trust: Optional[bool] = None
    landing_show_business_model: Optional[bool] = None
    landing_show_unit_economics: Optional[bool] = None
    landing_show_value_proposition: Optional[bool] = None
    landing_show_golden_path: Optional[bool] = None


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
    existing = await db.cms_content.find_one({"key": data.key})
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
    await audit("cms.update", user,
                target={"type": "cms_key", "id": data.key, "label": data.key},
                before={"value": (existing or {}).get("value")} if existing else None,
                after={"value": data.value})
    return {"ok": True, "key": data.key}


@router.delete("/cms/{key}")
async def reset_cms(key: str, user: dict = Depends(require_role("admin"))):
    existing = await db.cms_content.find_one({"key": key})
    await db.cms_content.delete_one({"key": key})
    if existing:
        await audit("cms.reset", user,
                    target={"type": "cms_key", "id": key, "label": key},
                    before={"value": existing.get("value")})
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
    await audit("settings.update", user,
                target={"type": "platform_settings", "id": "settings", "label": "Platform Settings"},
                before={k: current.get(k) for k in updates},
                after=updates)
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
    try:
        oid = ObjectId(user_id)
    except InvalidId:
        raise HTTPException(400, "Invalid user id")
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(400, "Nothing to update")
    target_user = await db.users.find_one({"_id": oid}, {"name": 1, "email": 1, **{k: 1 for k in updates}})
    if not target_user:
        raise HTTPException(404, "User not found")
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    updates["updated_by"] = user["id"]
    await db.users.update_one({"_id": oid}, {"$set": updates})
    await audit("user.update", user,
                target={"type": "user", "id": user_id, "label": target_user.get("email")},
                before={k: target_user.get(k) for k in updates if k not in ("updated_at", "updated_by")},
                after={k: v for k, v in updates.items() if k not in ("updated_at", "updated_by")})
    return {"ok": True}


@router.post("/users/{user_id}/ban")
async def ban_user(user_id: str, user: dict = Depends(require_role("admin"))):
    try:
        oid = ObjectId(user_id)
    except InvalidId:
        raise HTTPException(400, "Invalid user id")
    target_user = await db.users.find_one({"_id": oid}, {"email": 1})
    await db.users.update_one(
        {"_id": oid},
        {"$set": {"banned": True, "banned_at": datetime.now(timezone.utc).isoformat(), "banned_by": user["id"]}},
    )
    await audit("user.ban", user,
                target={"type": "user", "id": user_id, "label": (target_user or {}).get("email")})
    return {"ok": True}


@router.post("/users/{user_id}/unban")
async def unban_user(user_id: str, user: dict = Depends(require_role("admin"))):
    try:
        oid = ObjectId(user_id)
    except InvalidId:
        raise HTTPException(400, "Invalid user id")
    target_user = await db.users.find_one({"_id": oid}, {"email": 1})
    await db.users.update_one(
        {"_id": oid},
        {"$unset": {"banned": "", "banned_at": "", "banned_by": ""}},
    )
    await audit("user.unban", user,
                target={"type": "user", "id": user_id, "label": (target_user or {}).get("email")})
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
    """Return merged defaults + overrides as flat dict (no auth). Includes landing visibility flags."""
    docs = await db.cms_content.find({}).to_list(500)
    overrides = {d["key"]: d.get("value", "") for d in docs}
    merged = {**DEFAULT_CMS, **overrides}
    # Append public settings (landing visibility flags only)
    settings_doc = await db.platform_config.find_one({"key": "settings"})
    base = dict(DEFAULT_SETTINGS)
    if settings_doc:
        base.update(settings_doc.get("value", {}))
    for flag in [
        "landing_show_admin_trust", "landing_show_business_model",
        "landing_show_unit_economics", "landing_show_value_proposition",
        "landing_show_golden_path"
    ]:
        merged[f"_settings.{flag}"] = bool(base.get(flag, False))
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


# ============= LANDING PRESETS =============
LANDING_FLAG_KEYS = [
    "landing_show_admin_trust",
    "landing_show_business_model",
    "landing_show_unit_economics",
    "landing_show_value_proposition",
    "landing_show_golden_path",
]
DEFAULT_PRESETS = [
    {
        "name": "Public Client",
        "description": "Pentru utilizatorul obișnuit — fără pitch investitor",
        "flags": {"landing_show_admin_trust": False, "landing_show_business_model": False,
                  "landing_show_unit_economics": False, "landing_show_value_proposition": True,
                  "landing_show_golden_path": True},
        "system": True,
    },
    {
        "name": "Pitch Investitor",
        "description": "Toate secțiunile vizibile, incl. Business Model + KPI financiari",
        "flags": {"landing_show_admin_trust": True, "landing_show_business_model": True,
                  "landing_show_unit_economics": True, "landing_show_value_proposition": True,
                  "landing_show_golden_path": True},
        "system": True,
    },
    {
        "name": "Demo Minimal",
        "description": "Doar Hero + Golden Path — pentru screenshot-uri marketing",
        "flags": {"landing_show_admin_trust": False, "landing_show_business_model": False,
                  "landing_show_unit_economics": False, "landing_show_value_proposition": False,
                  "landing_show_golden_path": True},
        "system": True,
    },
]


class PresetIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    description: Optional[str] = Field(default=None, max_length=300)
    flags: dict


async def _ensure_default_presets():
    """Idempotent — seed default presets if none of type system exist."""
    existing = await db.landing_presets.count_documents({"system": True})
    if existing < len(DEFAULT_PRESETS):
        for p in DEFAULT_PRESETS:
            await db.landing_presets.update_one(
                {"name": p["name"], "system": True},
                {"$setOnInsert": {
                    "name": p["name"],
                    "description": p["description"],
                    "flags": p["flags"],
                    "system": True,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }},
                upsert=True,
            )


@router.get("/landing-presets")
async def list_landing_presets(user: dict = Depends(require_role("admin"))):
    await _ensure_default_presets()
    docs = await db.landing_presets.find({}).sort([("system", -1), ("created_at", 1)]).to_list(100)
    out = []
    for d in docs:
        out.append({
            "id": str(d["_id"]),
            "name": d.get("name"),
            "description": d.get("description"),
            "flags": d.get("flags", {}),
            "system": bool(d.get("system", False)),
            "created_at": d.get("created_at"),
        })
    return out


@router.post("/landing-presets")
async def create_landing_preset(data: PresetIn, user: dict = Depends(require_role("admin"))):
    # Sanitize flags — keep only known keys
    flags = {k: bool(data.flags.get(k, False)) for k in LANDING_FLAG_KEYS}
    if await db.landing_presets.find_one({"name": data.name}):
        raise HTTPException(400, "Un preset cu acest nume există deja.")
    doc = {
        "name": data.name.strip(),
        "description": data.description,
        "flags": flags,
        "system": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user["id"],
    }
    res = await db.landing_presets.insert_one(doc)
    await audit("preset.create", user,
                target={"type": "preset", "id": str(res.inserted_id), "label": data.name},
                after={"flags": flags})
    return {"ok": True, "id": str(res.inserted_id)}


@router.delete("/landing-presets/{preset_id}")
async def delete_landing_preset(preset_id: str, user: dict = Depends(require_role("admin"))):
    try:
        oid = ObjectId(preset_id)
    except InvalidId:
        raise HTTPException(400, "Invalid preset id")
    doc = await db.landing_presets.find_one({"_id": oid})
    if not doc:
        raise HTTPException(404, "Preset not found")
    if doc.get("system"):
        raise HTTPException(400, "Preset-urile sistem nu pot fi șterse.")
    await db.landing_presets.delete_one({"_id": oid})
    await audit("preset.delete", user,
                target={"type": "preset", "id": preset_id, "label": doc.get("name")},
                before={"flags": doc.get("flags")})
    return {"ok": True}


@router.post("/landing-presets/{preset_id}/apply")
async def apply_landing_preset(preset_id: str, user: dict = Depends(require_role("admin"))):
    """Persist this preset's flags into platform settings."""
    try:
        oid = ObjectId(preset_id)
    except InvalidId:
        raise HTTPException(400, "Invalid preset id")
    preset = await db.landing_presets.find_one({"_id": oid})
    if not preset:
        raise HTTPException(404, "Preset not found")
    settings_doc = await db.platform_config.find_one({"key": "settings"})
    current = (settings_doc or {}).get("value", {})
    merged = {**DEFAULT_SETTINGS, **current, **preset.get("flags", {})}
    now_iso = datetime.now(timezone.utc).isoformat()
    await db.platform_config.update_one(
        {"key": "settings"},
        {"$set": {
            "key": "settings", "value": merged,
            "updated_at": now_iso,
            "updated_by": user["id"],
        }},
        upsert=True,
    )
    # Log manual apply to history for full audit trail
    await db.preset_schedule_runs.insert_one({
        "schedule_id": None,
        "preset_id": preset_id,
        "preset_name": preset.get("name"),
        "flags": preset.get("flags", {}),
        "day_of_week": None,
        "time": None,
        "run_at": now_iso,
        "status": "applied",
        "trigger": "manual",
        "actor_id": user["id"],
        "actor_name": user.get("name"),
    })
    return {"ok": True, "applied": preset.get("name"), "flags": preset.get("flags")}


# ============= AUTO-SCHEDULE PRESETS =============
class ScheduleIn(BaseModel):
    preset_id: str
    days: List[int] = Field(min_length=1, max_length=7)  # 0=Monday ... 6=Sunday
    time: str = Field(pattern=r"^[0-2]\d:[0-5]\d$")  # HH:MM 24h
    enabled: bool = True


@router.get("/preset-schedules")
async def list_schedules(user: dict = Depends(require_role("admin"))):
    docs = await db.preset_schedules.find({}).sort("created_at", -1).to_list(100)
    # Enrich with preset names
    pids = [d.get("preset_id") for d in docs]
    pmap = {}
    if pids:
        pid_oids = [ObjectId(p) for p in pids if p]
        async for p in db.landing_presets.find({"_id": {"$in": pid_oids}}):
            pmap[str(p["_id"])] = p
    out = []
    for d in docs:
        preset = pmap.get(d.get("preset_id"))
        out.append({
            "id": str(d["_id"]),
            "preset_id": d.get("preset_id"),
            "preset_name": (preset or {}).get("name", "(șters)"),
            "days": d.get("days", []),
            "time": d.get("time"),
            "enabled": bool(d.get("enabled", True)),
            "last_run_at": d.get("last_run_at"),
            "created_at": d.get("created_at"),
        })
    return out


@router.post("/preset-schedules")
async def create_schedule(data: ScheduleIn, user: dict = Depends(require_role("admin"))):
    if any(d < 0 or d > 6 for d in data.days):
        raise HTTPException(400, "Days must be 0-6 (Monday-Sunday)")
    try:
        ObjectId(data.preset_id)
    except InvalidId:
        raise HTTPException(400, "Invalid preset id")
    preset = await db.landing_presets.find_one({"_id": ObjectId(data.preset_id)})
    if not preset:
        raise HTTPException(404, "Preset not found")
    doc = {
        "preset_id": data.preset_id,
        "days": sorted(set(data.days)),
        "time": data.time,
        "enabled": data.enabled,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user["id"],
    }
    res = await db.preset_schedules.insert_one(doc)
    return {"ok": True, "id": str(res.inserted_id)}


@router.patch("/preset-schedules/{schedule_id}")
async def toggle_schedule(schedule_id: str, enabled: bool, user: dict = Depends(require_role("admin"))):
    try:
        oid = ObjectId(schedule_id)
    except InvalidId:
        raise HTTPException(400, "Invalid id")
    await db.preset_schedules.update_one({"_id": oid}, {"$set": {"enabled": enabled}})
    return {"ok": True}


@router.delete("/preset-schedules/{schedule_id}")
async def delete_schedule(schedule_id: str, user: dict = Depends(require_role("admin"))):
    try:
        oid = ObjectId(schedule_id)
    except InvalidId:
        raise HTTPException(400, "Invalid id")
    await db.preset_schedules.delete_one({"_id": oid})
    return {"ok": True}


async def run_due_preset_schedules():
    """Cron callable — runs every minute. Apply schedules whose (day, time) match now (Europe/Bucharest)."""
    import pytz as _pytz
    tz = _pytz.timezone("Europe/Bucharest")
    now = datetime.now(tz)
    weekday = now.weekday()  # 0=Monday
    hhmm = now.strftime("%H:%M")

    # Dedup window: same minute → skip if we already ran today's slot
    today_key = now.strftime("%Y-%m-%d")
    async for sched in db.preset_schedules.find({"enabled": True, "time": hhmm, "days": weekday}):
        last = sched.get("last_run_at") or ""
        if last.startswith(today_key) and last.endswith(hhmm):
            continue  # already ran this minute today
        # Apply preset
        try:
            preset = await db.landing_presets.find_one({"_id": ObjectId(sched["preset_id"])})
            if not preset:
                continue
            settings_doc = await db.platform_config.find_one({"key": "settings"})
            current = (settings_doc or {}).get("value", {})
            merged = {**DEFAULT_SETTINGS, **current, **preset.get("flags", {})}
            run_at_iso = datetime.now(timezone.utc).isoformat()
            await db.platform_config.update_one(
                {"key": "settings"},
                {"$set": {"key": "settings", "value": merged,
                          "updated_at": run_at_iso,
                          "updated_by": "scheduler"}},
                upsert=True,
            )
            await db.preset_schedules.update_one(
                {"_id": sched["_id"]},
                {"$set": {"last_run_at": f"{today_key}T{hhmm}"}}
            )
            # Log run to history
            await db.preset_schedule_runs.insert_one({
                "schedule_id": str(sched["_id"]),
                "preset_id": sched["preset_id"],
                "preset_name": preset.get("name"),
                "flags": preset.get("flags", {}),
                "day_of_week": weekday,
                "time": hhmm,
                "run_at": run_at_iso,
                "status": "applied",
                "trigger": "auto-scheduler",
            })
            logger.info(f"Scheduled preset applied: {preset.get('name')} at {hhmm}")
        except Exception as exc:
            await db.preset_schedule_runs.insert_one({
                "schedule_id": str(sched.get("_id")),
                "preset_id": sched.get("preset_id"),
                "preset_name": "(eroare)",
                "day_of_week": weekday,
                "time": hhmm,
                "run_at": datetime.now(timezone.utc).isoformat(),
                "status": "error",
                "trigger": "auto-scheduler",
                "error": str(exc)[:300],
            })
            logger.warning(f"Schedule run failed for {sched.get('_id')}: {exc}")


@router.get("/schedule-history")
async def schedule_history(    user: dict = Depends(require_role("admin")),
    preset_id: Optional[str] = None,
    limit: int = Query(50, le=200),
):
    filt = {}
    if preset_id:
        filt["preset_id"] = preset_id
    cursor = db.preset_schedule_runs.find(filt).sort("run_at", -1).limit(limit)
    out = []
    async for d in cursor:
        out.append({
            "id": str(d["_id"]),
            "schedule_id": d.get("schedule_id"),
            "preset_id": d.get("preset_id"),
            "preset_name": d.get("preset_name"),
            "day_of_week": d.get("day_of_week"),
            "time": d.get("time"),
            "run_at": d.get("run_at"),
            "status": d.get("status"),
            "trigger": d.get("trigger"),
            "error": d.get("error"),
        })
    return out


# ============= AUDIT LOG ENDPOINTS =============
@router.get("/audit-log")
async def list_audit_log(
    user: dict = Depends(require_role("admin")),
    action: Optional[str] = None,
    actor_id: Optional[str] = None,
    target_type: Optional[str] = None,
    q: Optional[str] = None,
    limit: int = Query(100, le=500),
    skip: int = 0,
):
    filt = {}
    if action:
        filt["action"] = action
    if actor_id:
        filt["actor_id"] = actor_id
    if target_type:
        filt["target_type"] = target_type
    if q:
        filt["$or"] = [
            {"actor_name": {"$regex": q, "$options": "i"}},
            {"actor_email": {"$regex": q, "$options": "i"}},
            {"target_label": {"$regex": q, "$options": "i"}},
            {"note": {"$regex": q, "$options": "i"}},
        ]
    total = await db.admin_audit_log.count_documents(filt)
    cursor = db.admin_audit_log.find(filt).sort("created_at", -1).skip(skip).limit(limit)
    items = []
    async for d in cursor:
        items.append({
            "id": str(d["_id"]),
            "action": d.get("action"),
            "actor_id": d.get("actor_id"),
            "actor_name": d.get("actor_name"),
            "actor_email": d.get("actor_email"),
            "target_type": d.get("target_type"),
            "target_id": d.get("target_id"),
            "target_label": d.get("target_label"),
            "before": d.get("before"),
            "after": d.get("after"),
            "note": d.get("note"),
            "created_at": d.get("created_at"),
        })
    return {"items": items, "total": total, "skip": skip, "limit": limit}


@router.get("/audit-log/actions")
async def audit_log_actions(user: dict = Depends(require_role("admin"))):
    """Return distinct action types + counts for filter dropdown."""
    pipeline = [
        {"$group": {"_id": "$action", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    rows = await db.admin_audit_log.aggregate(pipeline).to_list(50)
    return [{"action": r["_id"], "count": r["count"]} for r in rows if r["_id"]]


@router.get("/audit-log/export.csv")
async def export_audit_log_csv(user: dict = Depends(require_role("admin"))):
    rows = []
    async for d in db.admin_audit_log.find({}).sort("created_at", -1).limit(5000):
        rows.append({
            "created_at": d.get("created_at", ""),
            "action": d.get("action", ""),
            "actor": d.get("actor_email", ""),
            "actor_name": d.get("actor_name", ""),
            "target_type": d.get("target_type", ""),
            "target_label": d.get("target_label", ""),
            "before": str(d.get("before") or "")[:200],
            "after": str(d.get("after") or "")[:200],
        })
    return _csv_response(rows, "audit_log.csv")

