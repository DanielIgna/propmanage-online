"""Strategic City Partnership Program — backend.

V1 (current): non-exclusive collaboration framework. Partner brings clients.
Future enhancements (marketplace, specialist commissions) require addendums.

Endpoints (Admin / super-admin):
  POST   /api/admin/city-partners              create partner
  GET    /api/admin/city-partners              list partners
  GET    /api/admin/city-partners/{id}         partner detail
  PATCH  /api/admin/city-partners/{id}         update fields
  DELETE /api/admin/city-partners/{id}         soft-archive
  POST   /api/admin/city-partners/{id}/onboarding-step  update step 1-7
  POST   /api/admin/city-partners/{id}/create-login     issue partner credentials
  GET    /api/admin/city-partners/{id}/leads
  POST   /api/admin/city-partners/{id}/leads
  PATCH  /api/admin/city-partners/leads/{lead_id}
  GET    /api/admin/city-partners/stats        global stats

Endpoints (partner self-service, role=city_partner):
  GET  /api/partner/me                         my partner record
  GET  /api/partner/leads                      only my leads
  POST /api/partner/leads                      add a referral
  GET  /api/partner/stats                      my dashboard stats

Collections:
  city_partners      { _id, company, contact_name, contact_email, contact_phone,
                       city, county, units_managed, growth_rate, portfolio_type,
                       started_at, status (lead|onboarding|active|paused|terminated),
                       onboarding_step (0-7), onboarding_complete, territory_protected,
                       linked_user_id, notes, created_at, updated_at }

  city_partner_leads { _id, partner_id, lead_name, lead_email, lead_phone,
                       source, introduced_at, stage (introduced|contacted|onboarded|converted|lost),
                       conversion_date, revenue_generated, notes, created_at, updated_at }
"""
import logging
import os
import re
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
from passlib.hash import bcrypt

from db import db
from deps import get_current_user
from sub_admin_deps import is_super_admin

logger = logging.getLogger("propmanage.city_partners")

admin_router = APIRouter(prefix="/api/admin/city-partners", tags=["admin-city-partners"])
partner_router = APIRouter(prefix="/api/partner", tags=["city-partner-portal"])
products_admin_router = APIRouter(prefix="/api/admin/city-partner-products", tags=["admin-city-partner-products"])

# Commercial prospecting statuses (City nZEB expansion) — additive, kept compatible
# with the legacy lifecycle statuses. A "prospect" is NOT a public/verified partner.
PROSPECT_STATUSES = {"prospect", "contacted", "discussion", "negotiation", "agreed", "rejected"}
ALLOWED_STATUS = {"lead", "onboarding", "active", "paused", "terminated"} | PROSPECT_STATUSES
# Ordered funnel metadata (admin UI + reporting). `public` = may be shown as a live partner.
COMMERCIAL_STATUS_META = [
    {"key": "prospect", "label": "Prospect / Necontactat", "public": False},
    {"key": "contacted", "label": "Contactat", "public": False},
    {"key": "discussion", "label": "Discuție inițiată", "public": False},
    {"key": "negotiation", "label": "Negociere", "public": False},
    {"key": "agreed", "label": "Partener agreat", "public": False},
    {"key": "active", "label": "Activ", "public": True},
    {"key": "paused", "label": "Pauzat", "public": False},
    {"key": "rejected", "label": "Respins", "public": False},
    # legacy lifecycle statuses kept for backward compatibility
    {"key": "lead", "label": "Lead (legacy)", "public": False},
    {"key": "onboarding", "label": "Onboarding (legacy)", "public": False},
    {"key": "terminated", "label": "Încetat (legacy)", "public": False},
]
# Reusable City nZEB category taxonomy (extensible, not a parallel registry).
NZEB_CATEGORIES = [
    "Ventilație și recuperare de căldură",
    "Audit și consultanță energetică",
    "Tâmplărie și anvelopa clădirii",
    "Izolații și renovări",
    "HVAC și instalații",
    "Pompe de căldură",
    "Fotovoltaice și stocare",
    "Alte soluții pentru eficiență energetică",
]
ALLOWED_LEAD_STAGES = {"introduced", "contacted", "onboarded", "converted", "lost"}
# Partner-network taxonomy (Faza 4A prep) — used to scale studios/city/regional/national
# partners, suppliers and brands. Optional & additive: existing partners default to "city".
ALLOWED_PARTNER_TYPES = {"studio", "city", "regional", "national", "supplier", "brand", "specialist"}
ALLOWED_COVERAGE = {"city", "regional", "national"}

ONBOARDING_STEPS = [
    "Prezentare oficială",
    "Introducere în ecosistem",
    "Prezentare pe grupurile disponibile",
    "Invitație către administratori",
    "Creare conturi platformă",
    "Urmărire social media",
    "Activare campanii locale",
]


def _require_super(user: dict) -> None:
    if not is_super_admin(user):
        raise HTTPException(403, "Doar super admin poate gestiona City Partners.")


# ── Partner portal sub-users, roles & notifications (reusable) ──────────────
PARTNER_SUB_ROLES = {"viewer", "operator"}
PARTNER_ROLE_LABELS = {"owner": "Administrator partener", "operator": "Operator", "viewer": "Vizualizare"}


def _user_id(user: dict) -> str:
    return str(user.get("id") or user.get("_id") or "")


def _app_base_url() -> str:
    return (os.environ.get("FRONTEND_PUBLIC_URL") or os.environ.get("APP_PUBLIC_URL") or "").rstrip("/")


def _partner_role(user: dict, partner: dict) -> str:
    uid = _user_id(user)
    if partner.get("linked_user_id") and str(partner.get("linked_user_id")) == uid:
        return "owner"
    for pu in (partner.get("portal_users") or []):
        if str(pu.get("user_id")) == uid:
            return pu.get("role") or "viewer"
    return user.get("partner_sub_role") or "viewer"


async def _portal_user_emails(partner: dict) -> list:
    emails = []
    lid = partner.get("linked_user_id")
    if lid:
        try:
            owner = await db.users.find_one({"_id": ObjectId(str(lid))})
            if owner and owner.get("email"):
                emails.append(owner["email"])
        except Exception:  # noqa: BLE001
            pass
    for pu in (partner.get("portal_users") or []):
        if pu.get("email") and pu.get("active", True):
            emails.append(pu["email"])
    return list(dict.fromkeys(emails))


async def _notify_partner(partner: dict, *, title: str, body: str, lead_id=None) -> None:
    """Record an in-app notification for a partner's portal users and email them."""
    now = datetime.now(timezone.utc).isoformat()
    await db.partner_notifications.insert_one({
        "partner_id": partner["_id"],
        "title": title,
        "body": body,
        "lead_id": str(lead_id) if lead_id else None,
        "read_by": [],
        "created_at": now,
    })
    if partner.get("portal_access_enabled") is not True:
        return
    emails = await _portal_user_emails(partner)
    if not emails:
        return
    try:
        from email_service import send_template, tpl_partner_lead_notification
        portal_url = f"{_app_base_url()}/partners/portal"
        for em in emails:
            await send_template(tpl_partner_lead_notification, partner.get("company"), title, body, portal_url, to=em, fire_and_forget=True)
    except Exception as e:  # noqa: BLE001
        logger.warning(f"Partner lead email failed: {e}")


def _serialize(doc: dict) -> dict:
    if not doc:
        return doc
    return {
        "id": str(doc.get("_id")),
        "company": doc.get("company"),
        "contact_name": doc.get("contact_name"),
        "contact_email": doc.get("contact_email"),
        "contact_phone": doc.get("contact_phone"),
        "city": doc.get("city"),
        "county": doc.get("county"),
        "units_managed": doc.get("units_managed") or 0,
        "growth_rate": doc.get("growth_rate"),
        "portfolio_type": doc.get("portfolio_type"),
        "started_at": doc.get("started_at"),
        "status": doc.get("status") or "lead",
        "public_visible": (doc.get("status") == "active"),
        "collaboration_agreed": bool(doc.get("collaboration_agreed")),
        # Portal access kill-switch (explicit admin action). None = never set (legacy).
        "portal_access_enabled": (None if doc.get("portal_access_enabled") is None else bool(doc.get("portal_access_enabled"))),
        # ── Prospect / supplier origin & commercial profile (City nZEB) — optional ──
        "website": doc.get("website"),
        "contact_role": doc.get("contact_role"),
        "country": doc.get("country"),
        "target_client_type": doc.get("target_client_type"),
        "capacity_note": doc.get("capacity_note"),
        "applications": doc.get("applications") or [],
        "next_action": doc.get("next_action"),
        "info_source": doc.get("info_source"),
        "origin_confirmed": bool(doc.get("origin_confirmed")),
        "coverage_confirmed": bool(doc.get("coverage_confirmed")),
        # Forward-looking collaboration indicators — prepared, never auto-filled.
        "collaboration_metrics": doc.get("collaboration_metrics") or {
            "invitable_clients": None,
            "requests_generated": None,
            "requests_taken": None,
            "conversions": None,
            "can_recommend_complementary": None,
            "network_contribution": None,
        },
        "onboarding_step": doc.get("onboarding_step") or 0,
        "onboarding_complete": bool(doc.get("onboarding_complete")),
        "territory_protected": bool(doc.get("territory_protected")),
        "linked_user_id": str(doc.get("linked_user_id")) if doc.get("linked_user_id") else None,
        # ── Partner-network relations (Faza 4A prep — optional, additive) ──
        "partner_type": doc.get("partner_type") or "city",
        "coverage": doc.get("coverage") or "city",
        "region": doc.get("region"),
        "categories": doc.get("categories") or [],
        "zones": doc.get("zones") or [],
        "services": doc.get("services") or [],
        "design_stages": doc.get("design_stages") or [],
        "brands": doc.get("brands") or [],
        "materials": doc.get("materials") or [],
        "projects": doc.get("projects") or [],
        "notes": doc.get("notes"),
        "created_at": doc.get("created_at"),
        "updated_at": doc.get("updated_at"),
    }


def _serialize_lead(d: dict) -> dict:
    if not d:
        return d
    return {
        "id": str(d.get("_id")),
        "partner_id": str(d.get("partner_id")) if d.get("partner_id") else None,
        "lead_name": d.get("lead_name"),
        "lead_email": d.get("lead_email"),
        "lead_phone": d.get("lead_phone"),
        "source": d.get("source"),
        "introduced_at": d.get("introduced_at"),
        "stage": d.get("stage") or "introduced",
        "conversion_date": d.get("conversion_date"),
        "revenue_generated": d.get("revenue_generated") or 0,
        "lost_reason": d.get("lost_reason"),
        "notes": d.get("notes"),
        "created_at": d.get("created_at"),
        "updated_at": d.get("updated_at"),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Pydantic models
# ─────────────────────────────────────────────────────────────────────────────
class PartnerCreate(BaseModel):
    company: str = Field(min_length=2, max_length=200)
    contact_name: Optional[str] = None
    contact_email: Optional[EmailStr] = None
    contact_phone: Optional[str] = None
    city: Optional[str] = None
    county: Optional[str] = None
    units_managed: Optional[int] = 0
    growth_rate: Optional[str] = None
    portfolio_type: Optional[str] = None
    started_at: Optional[str] = None
    status: str = "lead"
    partner_type: Optional[str] = None
    coverage: Optional[str] = None
    region: Optional[str] = None
    categories: Optional[list] = None
    zones: Optional[list] = None
    services: Optional[list] = None
    design_stages: Optional[list] = None
    brands: Optional[list] = None
    materials: Optional[list] = None
    notes: Optional[str] = None
    # Prospect / supplier origin & commercial profile (optional, unconfirmed-friendly)
    website: Optional[str] = None
    contact_role: Optional[str] = None
    country: Optional[str] = None
    target_client_type: Optional[str] = None
    capacity_note: Optional[str] = None
    applications: Optional[list] = None
    next_action: Optional[str] = None
    info_source: Optional[str] = None
    collaboration_agreed: Optional[bool] = None
    origin_confirmed: Optional[bool] = None
    coverage_confirmed: Optional[bool] = None
    collaboration_metrics: Optional[dict] = None


class PartnerPatch(BaseModel):
    company: Optional[str] = None
    contact_name: Optional[str] = None
    contact_email: Optional[EmailStr] = None
    contact_phone: Optional[str] = None
    city: Optional[str] = None
    county: Optional[str] = None
    units_managed: Optional[int] = None
    growth_rate: Optional[str] = None
    portfolio_type: Optional[str] = None
    started_at: Optional[str] = None
    status: Optional[str] = None
    territory_protected: Optional[bool] = None
    partner_type: Optional[str] = None
    coverage: Optional[str] = None
    region: Optional[str] = None
    categories: Optional[list] = None
    zones: Optional[list] = None
    services: Optional[list] = None
    design_stages: Optional[list] = None
    brands: Optional[list] = None
    materials: Optional[list] = None
    notes: Optional[str] = None
    website: Optional[str] = None
    contact_role: Optional[str] = None
    country: Optional[str] = None
    target_client_type: Optional[str] = None
    capacity_note: Optional[str] = None
    applications: Optional[list] = None
    next_action: Optional[str] = None
    info_source: Optional[str] = None
    collaboration_agreed: Optional[bool] = None
    origin_confirmed: Optional[bool] = None
    coverage_confirmed: Optional[bool] = None
    collaboration_metrics: Optional[dict] = None


class OnboardingStepUpdate(BaseModel):
    step: int = Field(ge=0, le=len(ONBOARDING_STEPS))


class PortalAccessUpdate(BaseModel):
    enabled: bool


class PartnerUserCreate(BaseModel):
    email: EmailStr
    name: Optional[str] = None
    role: str = "viewer"


class AcceptInviteBody(BaseModel):
    token: str
    password: str = Field(min_length=8, max_length=128)


class LeadCreate(BaseModel):
    lead_name: str = Field(min_length=2, max_length=200)
    lead_email: Optional[EmailStr] = None
    lead_phone: Optional[str] = None
    source: Optional[str] = None
    stage: str = "introduced"
    notes: Optional[str] = None


class LeadPatch(BaseModel):
    lead_name: Optional[str] = None
    lead_email: Optional[EmailStr] = None
    lead_phone: Optional[str] = None
    source: Optional[str] = None
    stage: Optional[str] = None
    conversion_date: Optional[str] = None
    revenue_generated: Optional[float] = None
    lost_reason: Optional[str] = None
    notes: Optional[str] = None


# ═════════════════════════════════════════════════════════════════════════════
# ADMIN — CRUD
# ═════════════════════════════════════════════════════════════════════════════
@admin_router.get("")
async def list_partners(
    status: Optional[str] = None,
    city: Optional[str] = None,
    category: Optional[str] = None,
    country: Optional[str] = None,
    zone: Optional[str] = None,
    user=Depends(get_current_user),
):
    _require_super(user)
    q = {}
    if status and status != "all":
        if status == "prospects":
            q["status"] = {"$in": sorted(PROSPECT_STATUSES)}
        else:
            q["status"] = status
    if city:
        q["city"] = {"$regex": f"^{re.escape(city)}$", "$options": "i"}
    if category:
        q["categories"] = {"$regex": f"{re.escape(category)}", "$options": "i"}
    if country:
        q["country"] = {"$regex": f"^{re.escape(country)}$", "$options": "i"}
    if zone:
        q["zones"] = {"$regex": f"{re.escape(zone)}", "$options": "i"}
    cur = db.city_partners.find(q).sort("created_at", -1)
    items = [_serialize(d) async for d in cur]
    return {"items": items, "count": len(items)}


@admin_router.get("/meta")
async def partner_meta(user=Depends(get_current_user)):
    """Shared taxonomy for the City Partners / City nZEB registry: commercial statuses,
    nZEB categories, partner types and coverage levels. Single source for admin filters."""
    _require_super(user)
    return {
        "statuses": COMMERCIAL_STATUS_META,
        "prospect_statuses": sorted(PROSPECT_STATUSES),
        "nzeb_categories": NZEB_CATEGORIES,
        "partner_types": sorted(ALLOWED_PARTNER_TYPES),
        "coverage_levels": sorted(ALLOWED_COVERAGE),
    }


@admin_router.post("")
async def create_partner(payload: PartnerCreate, user=Depends(get_current_user)):
    _require_super(user)
    if payload.status not in ALLOWED_STATUS:
        raise HTTPException(400, f"status invalid; permis: {sorted(ALLOWED_STATUS)}")
    if payload.partner_type and payload.partner_type not in ALLOWED_PARTNER_TYPES:
        raise HTTPException(400, f"partner_type invalid; permis: {sorted(ALLOWED_PARTNER_TYPES)}")
    if payload.coverage and payload.coverage not in ALLOWED_COVERAGE:
        raise HTTPException(400, f"coverage invalid; permis: {sorted(ALLOWED_COVERAGE)}")
    email = payload.contact_email.lower() if payload.contact_email else None
    if email:
        existing = await db.city_partners.find_one({"contact_email": email})
        if existing:
            raise HTTPException(409, f"Există deja partener cu emailul {payload.contact_email}.")
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "company": payload.company,
        "contact_name": payload.contact_name,
        "contact_email": email,
        "contact_phone": payload.contact_phone,
        "city": payload.city,
        "county": payload.county,
        "units_managed": payload.units_managed or 0,
        "growth_rate": payload.growth_rate,
        "portfolio_type": payload.portfolio_type,
        "started_at": payload.started_at,
        "status": payload.status,
        "onboarding_step": 0,
        "onboarding_complete": False,
        "territory_protected": False,
        "linked_user_id": None,
        "partner_type": payload.partner_type or "city",
        "coverage": payload.coverage or "city",
        "region": payload.region,
        "categories": payload.categories or [],
        "zones": payload.zones or [],
        "services": payload.services or [],
        "design_stages": payload.design_stages or [],
        "brands": payload.brands or [],
        "materials": payload.materials or [],
        "projects": [],
        "notes": payload.notes,
        # Prospect / supplier origin & commercial profile (optional)
        "website": payload.website,
        "contact_role": payload.contact_role,
        "country": payload.country,
        "target_client_type": payload.target_client_type,
        "capacity_note": payload.capacity_note,
        "applications": payload.applications or [],
        "next_action": payload.next_action,
        "info_source": payload.info_source,
        "collaboration_agreed": bool(payload.collaboration_agreed),
        "origin_confirmed": bool(payload.origin_confirmed),
        "coverage_confirmed": bool(payload.coverage_confirmed),
        "collaboration_metrics": payload.collaboration_metrics or {},
        "created_at": now,
        "updated_at": now,
        "created_by": user.get("email"),
    }
    res = await db.city_partners.insert_one(doc)
    doc["_id"] = res.inserted_id
    return _serialize(doc)


@admin_router.get("/stats")
async def global_stats(user=Depends(get_current_user)):
    _require_super(user)
    total = await db.city_partners.count_documents({})
    by_status = {}
    for s in ALLOWED_STATUS:
        by_status[s] = await db.city_partners.count_documents({"status": s})

    # Total leads + by stage
    total_leads = await db.city_partner_leads.count_documents({})
    leads_by_stage = {}
    for st in ALLOWED_LEAD_STAGES:
        leads_by_stage[st] = await db.city_partner_leads.count_documents({"stage": st})

    # Top partners by lead count
    top_pipeline = [
        {"$group": {"_id": "$partner_id", "lead_count": {"$sum": 1}, "revenue": {"$sum": "$revenue_generated"}}},
        {"$sort": {"lead_count": -1}},
        {"$limit": 5},
    ]
    top_partners = []
    async for row in db.city_partner_leads.aggregate(top_pipeline):
        if not row.get("_id"):
            continue
        p = await db.city_partners.find_one({"_id": row["_id"]})
        if p:
            top_partners.append({
                "partner_id": str(p["_id"]),
                "company": p.get("company"),
                "city": p.get("city"),
                "lead_count": row["lead_count"],
                "revenue": row.get("revenue") or 0,
            })
    return {
        "total_partners": total,
        "by_status": by_status,
        "total_leads": total_leads,
        "leads_by_stage": leads_by_stage,
        "top_partners": top_partners,
    }


@admin_router.get("/ecosystem-map")
async def ecosystem_readiness(user=Depends(get_current_user)):
    """Read-only observability (Faza 4A): the 17-step→entity semantic map + partner-network
    readiness from REAL data (counts by type/coverage). No new dashboard, no invented data."""
    _require_super(user)
    from design_ecosystem import ecosystem_map
    by_type, by_coverage = {}, {}
    for t in ALLOWED_PARTNER_TYPES:
        by_type[t] = await db.city_partners.count_documents({"partner_type": t})
    # legacy partners without partner_type count as implicit "city"
    untyped = await db.city_partners.count_documents({"partner_type": {"$exists": False}})
    if untyped:
        by_type["city"] = by_type.get("city", 0) + untyped
    for c in ALLOWED_COVERAGE:
        by_coverage[c] = await db.city_partners.count_documents({"coverage": c})
    products_total = await db.city_partner_products.count_documents({})
    brands = await db.city_partner_products.distinct("brand")
    brands = [b for b in brands if b]
    return {
        "semantic_map": ecosystem_map(),
        "partner_network": {
            "partners_total": await db.city_partners.count_documents({}),
            "by_partner_type": by_type,
            "by_coverage": by_coverage,
        },
        "catalog": {
            "materials_total": products_total,      # real, may be 0
            "brands_distinct": len(brands),         # real, may be 0
            "brands": brands[:50],
        },
        "gaps": [
            "Proiecte reale: 0 stocate — model pregătit (CANDIDATE).",
            "Brand/supplier: reutilizează city_partners + city_partner_products; nu există registry paralel.",
        ],
    }


@admin_router.get("/{partner_id}")
async def get_partner(partner_id: str, user=Depends(get_current_user)):
    _require_super(user)
    try:
        oid = ObjectId(partner_id)
    except Exception:
        raise HTTPException(400, "ID invalid.")
    doc = await db.city_partners.find_one({"_id": oid})
    if not doc:
        raise HTTPException(404, "Partener inexistent.")
    return _serialize(doc)


@admin_router.patch("/{partner_id}")
async def patch_partner(partner_id: str, payload: PartnerPatch, user=Depends(get_current_user)):
    _require_super(user)
    try:
        oid = ObjectId(partner_id)
    except Exception:
        raise HTTPException(400, "ID invalid.")
    update = {k: v for k, v in payload.dict(exclude_unset=True).items() if v is not None}
    if "status" in update and update["status"] not in ALLOWED_STATUS:
        raise HTTPException(400, "status invalid")
    if "partner_type" in update and update["partner_type"] not in ALLOWED_PARTNER_TYPES:
        raise HTTPException(400, "partner_type invalid")
    if "coverage" in update and update["coverage"] not in ALLOWED_COVERAGE:
        raise HTTPException(400, "coverage invalid")
    if "contact_email" in update:
        update["contact_email"] = str(update["contact_email"]).lower()
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    res = await db.city_partners.find_one_and_update({"_id": oid}, {"$set": update}, return_document=True)
    if not res:
        raise HTTPException(404, "Partener inexistent.")
    return _serialize(res)


@admin_router.delete("/{partner_id}")
async def archive_partner(partner_id: str, user=Depends(get_current_user)):
    _require_super(user)
    try:
        oid = ObjectId(partner_id)
    except Exception:
        raise HTTPException(400, "ID invalid.")
    res = await db.city_partners.update_one(
        {"_id": oid},
        {"$set": {"status": "terminated", "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Partener inexistent.")
    return {"ok": True, "archived": True}


@admin_router.post("/{partner_id}/onboarding-step")
async def set_onboarding_step(partner_id: str, payload: OnboardingStepUpdate, user=Depends(get_current_user)):
    _require_super(user)
    try:
        oid = ObjectId(partner_id)
    except Exception:
        raise HTTPException(400, "ID invalid.")
    step = max(0, min(payload.step, len(ONBOARDING_STEPS)))
    update = {
        "onboarding_step": step,
        "onboarding_complete": step >= len(ONBOARDING_STEPS),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    # Auto-promote status: onboarding → active when complete
    if step >= len(ONBOARDING_STEPS):
        existing = await db.city_partners.find_one({"_id": oid})
        if existing and existing.get("status") == "onboarding":
            update["status"] = "active"
    res = await db.city_partners.find_one_and_update({"_id": oid}, {"$set": update}, return_document=True)
    if not res:
        raise HTTPException(404, "Partener inexistent.")
    return _serialize(res)


@admin_router.post("/{partner_id}/create-login")
async def create_partner_login(partner_id: str, user=Depends(get_current_user)):
    """Creates a `city_partner` user account linked to this partner record."""
    _require_super(user)
    try:
        oid = ObjectId(partner_id)
    except Exception:
        raise HTTPException(400, "ID invalid.")
    p = await db.city_partners.find_one({"_id": oid})
    if not p:
        raise HTTPException(404, "Partener inexistent.")
    if p.get("linked_user_id"):
        try:
            existing_oid = p["linked_user_id"] if isinstance(p["linked_user_id"], ObjectId) else ObjectId(str(p["linked_user_id"]))
            existing_user = await db.users.find_one({"_id": existing_oid})
        except Exception:
            existing_user = None
        if existing_user:
            return {"ok": True, "already_exists": True, "user_id": str(existing_user["_id"]), "email": existing_user["email"]}

    email = (p.get("contact_email") or "").strip().lower()
    if not email:
        raise HTTPException(400, "Partenerul nu are un email de contact valid. Adaugă-l înainte de a crea contul.")
    existing = await db.users.find_one({"email": email})
    if existing:
        if existing.get("role") not in (None, "city_partner"):
            raise HTTPException(400, f"Există deja un cont cu acest email și alt rol ({existing.get('role')}).")
        await db.city_partners.update_one(
            {"_id": oid},
            {"$set": {"linked_user_id": str(existing["_id"]), "portal_access_enabled": True, "updated_at": datetime.now(timezone.utc).isoformat()}},
        )
        await db.users.update_one({"_id": existing["_id"]}, {"$set": {"role": "city_partner", "partner_id": str(p["_id"])}})
        return {"ok": True, "linked_existing": True, "user_id": str(existing["_id"]), "email": email}

    temp_password = secrets.token_urlsafe(12).replace("_", "X").replace("-", "Y")[:14] + "!1A"
    pwd_hash = bcrypt.hash(temp_password)
    new_user = {
        "email": email,
        "password_hash": pwd_hash,
        "name": p.get("contact_name") or p.get("company"),
        "role": "city_partner",
        "phone": p.get("contact_phone"),
        "verified_email": True,
        "terms_accepted": True,
        "privacy_policy_accepted": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "partner_id": str(p["_id"]),  # store as STRING so serialize_doc doesn't choke on ObjectId
    }
    ures = await db.users.insert_one(new_user)
    await db.city_partners.update_one(
        {"_id": oid},
        {"$set": {"linked_user_id": str(ures.inserted_id), "portal_access_enabled": True, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"ok": True, "created": True, "user_id": str(ures.inserted_id), "email": email, "temp_password": temp_password}


@admin_router.post("/{partner_id}/portal-access")
async def set_portal_access(partner_id: str, payload: PortalAccessUpdate, user=Depends(get_current_user)):
    """Enable / suspend partner portal access. Explicit admin action only (section 3)."""
    _require_super(user)
    try:
        oid = ObjectId(partner_id)
    except Exception:
        raise HTTPException(400, "ID invalid.")
    p = await db.city_partners.find_one({"_id": oid})
    if not p:
        raise HTTPException(404, "Partener inexistent.")
    if payload.enabled and not p.get("linked_user_id") and not (p.get("portal_users")):
        raise HTTPException(400, "Creează întâi un cont de portal pentru acest partener.")
    res = await db.city_partners.find_one_and_update(
        {"_id": oid},
        {"$set": {"portal_access_enabled": payload.enabled, "updated_at": datetime.now(timezone.utc).isoformat()}},
        return_document=True,
    )
    return _serialize(res)


@admin_router.get("/{partner_id}/users")
async def list_partner_users(partner_id: str, user=Depends(get_current_user)):
    _require_super(user)
    try:
        oid = ObjectId(partner_id)
    except Exception:
        raise HTTPException(400, "ID invalid.")
    p = await db.city_partners.find_one({"_id": oid})
    if not p:
        raise HTTPException(404, "Partener inexistent.")
    items = []
    lid = p.get("linked_user_id")
    if lid:
        try:
            owner = await db.users.find_one({"_id": ObjectId(str(lid))})
        except Exception:
            owner = None
        if owner:
            items.append({"user_id": str(owner["_id"]), "email": owner.get("email"), "name": owner.get("name"), "role": "owner", "active": True, "invited": False, "accepted": True})
    for pu in (p.get("portal_users") or []):
        items.append({"user_id": str(pu.get("user_id")), "email": pu.get("email"), "name": pu.get("name"), "role": pu.get("role") or "viewer", "active": pu.get("active", True), "invited": bool(pu.get("invited")), "accepted": bool(pu.get("accepted"))})
    return {"items": items, "count": len(items), "portal_access_enabled": p.get("portal_access_enabled"), "roles": sorted(PARTNER_SUB_ROLES)}


@admin_router.post("/{partner_id}/users")
async def add_partner_user(partner_id: str, payload: PartnerUserCreate, user=Depends(get_current_user)):
    _require_super(user)
    if payload.role not in PARTNER_SUB_ROLES:
        raise HTTPException(400, "Rol invalid. Folosește 'viewer' sau 'operator'.")
    try:
        oid = ObjectId(partner_id)
    except Exception:
        raise HTTPException(400, "ID invalid.")
    p = await db.city_partners.find_one({"_id": oid})
    if not p:
        raise HTTPException(404, "Partener inexistent.")
    email = payload.email.strip().lower()
    existing = await db.users.find_one({"email": email})
    if existing and existing.get("role") not in (None, "city_partner"):
        raise HTTPException(400, f"Există deja un cont cu acest email și alt rol ({existing.get('role')}).")
    if existing and existing.get("partner_id") and str(existing.get("partner_id")) != str(p["_id"]):
        raise HTTPException(400, "Acest email este deja asociat altui partener. Elimină-l mai întâi din celălalt partener.")
    now = datetime.now(timezone.utc).isoformat()
    temp_password = None
    if existing:
        uid = existing["_id"]
        await db.users.update_one({"_id": uid}, {"$set": {"role": "city_partner", "partner_id": str(p["_id"]), "partner_sub_role": payload.role}})
    else:
        temp_password = secrets.token_urlsafe(12).replace("_", "X").replace("-", "Y")[:14] + "!1A"
        ures = await db.users.insert_one({
            "email": email,
            "password_hash": bcrypt.hash(temp_password),
            "name": payload.name or p.get("company"),
            "role": "city_partner",
            "verified_email": True,
            "terms_accepted": True,
            "privacy_policy_accepted": True,
            "created_at": now,
            "partner_id": str(p["_id"]),
            "partner_sub_role": payload.role,
            "must_set_password": True,
        })
        uid = ures.inserted_id
    await db.city_partners.update_one({"_id": oid}, {"$pull": {"portal_users": {"user_id": str(uid)}}})
    await db.city_partners.update_one({"_id": oid}, {
        "$push": {"portal_users": {"user_id": str(uid), "email": email, "name": payload.name or (existing or {}).get("name"), "role": payload.role, "active": True, "invited": False, "accepted": bool(existing), "added_at": now}},
        "$set": {"updated_at": now},
    })
    return {"ok": True, "user_id": str(uid), "email": email, "role": payload.role, "temp_password": temp_password}


@admin_router.post("/{partner_id}/users/{user_id}/invite")
async def invite_partner_user(partner_id: str, user_id: str, user=Depends(get_current_user)):
    _require_super(user)
    try:
        oid = ObjectId(partner_id)
        uoid = ObjectId(user_id)
    except Exception:
        raise HTTPException(400, "ID invalid.")
    p = await db.city_partners.find_one({"_id": oid})
    if not p:
        raise HTTPException(404, "Partener inexistent.")
    target = await db.users.find_one({"_id": uoid})
    if not target or str(target.get("partner_id")) != str(p["_id"]):
        raise HTTPException(404, "Utilizatorul nu aparține acestui partener.")
    if not target.get("email"):
        raise HTTPException(400, "Utilizatorul nu are email.")
    # Invalidate earlier unused invites so only the newest link works.
    await db.partner_invites.update_many({"user_id": str(uoid), "used": False}, {"$set": {"used": True}})
    token = secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc)
    await db.partner_invites.insert_one({
        "token": token, "user_id": str(uoid), "partner_id": str(p["_id"]),
        "email": target.get("email"), "created_at": now.isoformat(),
        "expires_at": (now + timedelta(days=7)).isoformat(), "used": False,
    })
    await db.city_partners.update_one({"_id": oid, "portal_users.user_id": str(uoid)}, {"$set": {"portal_users.$.invited": True}})
    invite_url = f"{_app_base_url()}/partners/accept-invite?token={token}"
    role_label = PARTNER_ROLE_LABELS.get(target.get("partner_sub_role") or "viewer", "Vizualizare")
    email_sent = False
    try:
        from email_service import send_template, tpl_partner_invite
        sent = await send_template(tpl_partner_invite, p.get("company"), invite_url, role_label, to=target["email"], fire_and_forget=False)
        email_sent = bool(sent and sent.get("ok"))
    except Exception as e:  # noqa: BLE001
        logger.warning(f"Invite email failed: {e}")
    return {"ok": True, "invite_url": invite_url, "email_sent": email_sent}


@admin_router.delete("/{partner_id}/users/{user_id}")
async def remove_partner_user(partner_id: str, user_id: str, user=Depends(get_current_user)):
    _require_super(user)
    try:
        oid = ObjectId(partner_id)
    except Exception:
        raise HTTPException(400, "ID invalid.")
    p = await db.city_partners.find_one({"_id": oid})
    if not p:
        raise HTTPException(404, "Partener inexistent.")
    if str(p.get("linked_user_id") or "") == str(user_id):
        raise HTTPException(400, "Contul principal nu poate fi eliminat. Folosește suspendarea accesului la portal.")
    in_users = any(str(pu.get("user_id")) == str(user_id) for pu in (p.get("portal_users") or []))
    try:
        tgt = await db.users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        raise HTTPException(400, "ID invalid.")
    belongs = in_users or (tgt and str(tgt.get("partner_id") or "") == str(p["_id"]))
    if not belongs:
        raise HTTPException(404, "Utilizatorul nu aparține acestui partener.")
    now = datetime.now(timezone.utc).isoformat()
    await db.city_partners.update_one({"_id": oid}, {"$pull": {"portal_users": {"user_id": str(user_id)}}, "$set": {"updated_at": now}})
    if tgt:
        await db.users.update_one({"_id": tgt["_id"]}, {"$unset": {"partner_id": "", "partner_sub_role": ""}})
    await db.partner_invites.update_many({"user_id": str(user_id), "used": False}, {"$set": {"used": True}})
    return {"ok": True}


# ─── Leads (admin side) ────────────────────────────────────────────────────
@admin_router.get("/{partner_id}/leads")
async def list_leads(partner_id: str, user=Depends(get_current_user)):
    _require_super(user)
    try:
        oid = ObjectId(partner_id)
    except Exception:
        raise HTTPException(400, "ID invalid.")
    cur = db.city_partner_leads.find({"partner_id": oid}).sort("created_at", -1)
    items = [_serialize_lead(d) async for d in cur]
    return {"items": items, "count": len(items)}


@admin_router.post("/{partner_id}/leads")
async def create_lead(partner_id: str, payload: LeadCreate, user=Depends(get_current_user)):
    _require_super(user)
    try:
        oid = ObjectId(partner_id)
    except Exception:
        raise HTTPException(400, "ID invalid.")
    partner = await db.city_partners.find_one({"_id": oid})
    if not partner:
        raise HTTPException(404, "Partener inexistent.")
    if payload.stage not in ALLOWED_LEAD_STAGES:
        raise HTTPException(400, "stage invalid")
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "partner_id": oid,
        "lead_name": payload.lead_name,
        "lead_email": (str(payload.lead_email).lower() if payload.lead_email else None),
        "lead_phone": payload.lead_phone,
        "source": payload.source,
        "introduced_at": now,
        "stage": payload.stage,
        "conversion_date": None,
        "revenue_generated": 0,
        "notes": payload.notes,
        "created_at": now,
        "updated_at": now,
        "created_by": user.get("email"),
    }
    res = await db.city_partner_leads.insert_one(doc)
    doc["_id"] = res.inserted_id
    from leads_store import sync_lead
    await sync_lead("city_partner", doc)
    await _notify_partner(partner, title=f"Lead nou: {payload.lead_name}", body=f"Un lead nou ți-a fost repartizat (status: {payload.stage}).", lead_id=res.inserted_id)
    return _serialize_lead(doc)


@admin_router.patch("/leads/{lead_id}")
async def patch_lead(lead_id: str, payload: LeadPatch, user=Depends(get_current_user)):
    _require_super(user)
    try:
        oid = ObjectId(lead_id)
    except Exception:
        raise HTTPException(400, "ID invalid.")
    update = {k: v for k, v in payload.dict(exclude_unset=True).items() if v is not None}
    if "stage" in update:
        if update["stage"] not in ALLOWED_LEAD_STAGES:
            raise HTTPException(400, "stage invalid")
        if update["stage"] == "converted" and not update.get("conversion_date"):
            update["conversion_date"] = datetime.now(timezone.utc).isoformat()
        if update["stage"] != "lost":
            update["lost_reason"] = None
    if "lead_email" in update:
        update["lead_email"] = str(update["lead_email"]).lower()
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    res = await db.city_partner_leads.find_one_and_update({"_id": oid}, {"$set": update}, return_document=True)
    if not res:
        raise HTTPException(404, "Lead inexistent.")
    from leads_store import sync_lead
    await sync_lead("city_partner", res)
    if "stage" in update:
        partner = await db.city_partners.find_one({"_id": res.get("partner_id")})
        if partner:
            await _notify_partner(partner, title=f"Status actualizat: {res.get('lead_name')}", body=f"Statusul cererii este acum: {update['stage']}.", lead_id=res["_id"])
    return _serialize_lead(res)


# ═════════════════════════════════════════════════════════════════════════════
# PARTNER PORTAL — self-service (role=city_partner)
# ═════════════════════════════════════════════════════════════════════════════
async def _require_partner(user: dict) -> dict:
    if user.get("role") != "city_partner":
        raise HTTPException(403, "Acces restricționat la partenerii strategici.")
    pid = user.get("partner_id")
    if not pid:
        raise HTTPException(404, "Contul nu este legat de un partener activ.")
    try:
        pid_obj = pid if isinstance(pid, ObjectId) else ObjectId(str(pid))
    except Exception:
        raise HTTPException(404, "partner_id invalid.")
    p = await db.city_partners.find_one({"_id": pid_obj})
    if not p:
        raise HTTPException(404, "Partener inexistent.")
    if p.get("status") == "terminated":
        raise HTTPException(403, "Colaborarea a fost încheiată.")
    if p.get("portal_access_enabled") is False:
        raise HTTPException(403, "Accesul la portal este suspendat de administrator.")
    return p


@partner_router.get("/me")
async def partner_me(user=Depends(get_current_user)):
    p = await _require_partner(user)
    return {
        "partner": _serialize(p),
        "onboarding_steps": ONBOARDING_STEPS,
        "user": {"name": user.get("name"), "email": user.get("email")},
    }


@partner_router.get("/leads")
async def partner_my_leads(user=Depends(get_current_user)):
    p = await _require_partner(user)
    cur = db.city_partner_leads.find({"partner_id": p["_id"]}).sort("created_at", -1)
    items = [_serialize_lead(d) async for d in cur]
    return {"items": items, "count": len(items)}


@partner_router.post("/leads")
async def partner_add_lead(payload: LeadCreate, user=Depends(get_current_user)):
    p = await _require_partner(user)
    if _partner_role(user, p) == "viewer":
        raise HTTPException(403, "Rol de vizualizare: nu poți adăuga cereri.")
    if payload.stage not in ALLOWED_LEAD_STAGES:
        raise HTTPException(400, "stage invalid")
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "partner_id": p["_id"],
        "lead_name": payload.lead_name,
        "lead_email": (str(payload.lead_email).lower() if payload.lead_email else None),
        "lead_phone": payload.lead_phone,
        "source": payload.source or "partner_portal",
        "introduced_at": now,
        "stage": payload.stage,
        "conversion_date": None,
        "revenue_generated": 0,
        "notes": payload.notes,
        "created_at": now,
        "updated_at": now,
        "created_by": user.get("email"),
    }
    res = await db.city_partner_leads.insert_one(doc)
    doc["_id"] = res.inserted_id
    from leads_store import sync_lead
    await sync_lead("city_partner", doc)
    return _serialize_lead(doc)


@partner_router.patch("/leads/{lead_id}")
async def partner_update_lead(lead_id: str, payload: LeadPatch, user=Depends(get_current_user)):
    """Operator/owner can update their OWN leads. Viewer is read-only. Strict isolation."""
    p = await _require_partner(user)
    if _partner_role(user, p) == "viewer":
        raise HTTPException(403, "Rol de vizualizare: nu poți modifica cereri.")
    try:
        oid = ObjectId(lead_id)
    except Exception:
        raise HTTPException(400, "ID invalid.")
    lead = await db.city_partner_leads.find_one({"_id": oid})
    if not lead or str(lead.get("partner_id")) != str(p["_id"]):
        raise HTTPException(404, "Cerere inexistentă.")
    update = {k: v for k, v in payload.dict(exclude_unset=True).items() if v is not None}
    if "stage" in update:
        if update["stage"] not in ALLOWED_LEAD_STAGES:
            raise HTTPException(400, "stage invalid")
        if update["stage"] == "converted" and not update.get("conversion_date"):
            update["conversion_date"] = datetime.now(timezone.utc).isoformat()
        if update["stage"] != "lost":
            update["lost_reason"] = None
    if "lead_email" in update:
        update["lead_email"] = str(update["lead_email"]).lower()
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    res = await db.city_partner_leads.find_one_and_update({"_id": oid}, {"$set": update}, return_document=True)
    from leads_store import sync_lead
    await sync_lead("city_partner", res)
    return _serialize_lead(res)


@partner_router.get("/notifications")
async def partner_list_notifications(user=Depends(get_current_user)):
    p = await _require_partner(user)
    uid = _user_id(user)
    items, unread = [], 0
    async for d in db.partner_notifications.find({"partner_id": p["_id"]}).sort("created_at", -1).limit(50):
        read = uid in [str(x) for x in (d.get("read_by") or [])]
        if not read:
            unread += 1
        items.append({"id": str(d["_id"]), "title": d.get("title"), "body": d.get("body"), "lead_id": d.get("lead_id"), "created_at": d.get("created_at"), "read": read})
    return {"items": items, "unread": unread}


@partner_router.post("/notifications/{note_id}/read")
async def partner_mark_notification_read(note_id: str, user=Depends(get_current_user)):
    p = await _require_partner(user)
    try:
        oid = ObjectId(note_id)
    except Exception:
        raise HTTPException(400, "ID invalid.")
    await db.partner_notifications.update_one({"_id": oid, "partner_id": p["_id"]}, {"$addToSet": {"read_by": _user_id(user)}})
    return {"ok": True}


@partner_router.get("/invite/{token}")
async def partner_invite_info(token: str):
    """PUBLIC — validate an invite token (no auth)."""
    inv = await db.partner_invites.find_one({"token": token})
    if not inv or inv.get("used"):
        return {"valid": False, "reason": "used_or_missing"}
    if inv.get("expires_at") and inv["expires_at"] < datetime.now(timezone.utc).isoformat():
        return {"valid": False, "reason": "expired"}
    partner = None
    try:
        partner = await db.city_partners.find_one({"_id": ObjectId(inv["partner_id"])})
    except Exception:
        pass
    return {"valid": True, "email": inv.get("email"), "partner_company": partner.get("company") if partner else None}


@partner_router.post("/accept-invite")
async def partner_accept_invite(payload: AcceptInviteBody):
    """PUBLIC — set password from an invite token (no auth)."""
    inv = await db.partner_invites.find_one({"token": payload.token})
    if not inv or inv.get("used"):
        raise HTTPException(400, "Invitație invalidă sau deja folosită.")
    if inv.get("expires_at") and inv["expires_at"] < datetime.now(timezone.utc).isoformat():
        raise HTTPException(400, "Invitația a expirat.")
    try:
        uid = ObjectId(inv["user_id"])
    except Exception:
        raise HTTPException(400, "Invitație coruptă.")
    await db.users.update_one({"_id": uid}, {"$set": {"password_hash": bcrypt.hash(payload.password), "verified_email": True}, "$unset": {"must_set_password": ""}})
    await db.partner_invites.update_one({"_id": inv["_id"]}, {"$set": {"used": True, "used_at": datetime.now(timezone.utc).isoformat()}})
    try:
        await db.city_partners.update_one({"_id": ObjectId(inv["partner_id"]), "portal_users.user_id": inv["user_id"]}, {"$set": {"portal_users.$.accepted": True}})
    except Exception:
        pass
    return {"ok": True}


@partner_router.get("/stats")
async def partner_my_stats(user=Depends(get_current_user)):
    p = await _require_partner(user)
    pid = p["_id"]
    total = await db.city_partner_leads.count_documents({"partner_id": pid})
    by_stage = {}
    for st in ALLOWED_LEAD_STAGES:
        by_stage[st] = await db.city_partner_leads.count_documents({"partner_id": pid, "stage": st})
    revenue_pipe = [
        {"$match": {"partner_id": pid}},
        {"$group": {"_id": None, "total": {"$sum": "$revenue_generated"}}},
    ]
    revenue = 0
    async for r in db.city_partner_leads.aggregate(revenue_pipe):
        revenue = r.get("total") or 0
    conv_rate = round((by_stage.get("converted", 0) / total * 100), 1) if total else 0
    return {
        "partner": {
            "company": p.get("company"),
            "city": p.get("city"),
            "status": p.get("status"),
            "onboarding_step": p.get("onboarding_step", 0),
            "onboarding_steps_total": len(ONBOARDING_STEPS),
        },
        "leads_total": total,
        "leads_by_stage": by_stage,
        "revenue_generated": revenue,
        "conversion_rate": conv_rate,
    }


# ─────────────────────────────────────────────────────────────────────────────
# PARTNER PORTAL — consolidated view (/partners/portal) + DEMO preview
# Reuses leads, products (catalog) and partner_agreements. No parallel system.
# ─────────────────────────────────────────────────────────────────────────────
def _compute_portal_stats(leads: list) -> dict:
    by_stage = {st: 0 for st in ALLOWED_LEAD_STAGES}
    revenue = 0
    for l in leads:
        st = l.get("stage") or "introduced"
        by_stage[st] = by_stage.get(st, 0) + 1
        revenue += l.get("revenue_generated") or 0
    total = len(leads)
    conv = by_stage.get("converted", 0)
    return {
        "leads_total": total,
        "leads_by_stage": by_stage,
        "revenue_generated": revenue,
        "conversion_rate": round(conv / total * 100, 1) if total else 0,
    }


async def _assemble_portal(p: dict, user_name, user_email) -> dict:
    pid = p["_id"]
    leads = [_serialize_lead(d) async for d in db.city_partner_leads.find({"partner_id": pid}).sort("created_at", -1)]
    catalog = [_serialize_product(d) async for d in db.city_partner_products.find({"partner_id": pid}).sort("created_at", -1)]
    agreement = None
    agr = await db.partner_agreements.find_one({"partner_id": pid, "status": {"$ne": "terminated"}})
    if agr:
        try:
            from strategic_partners import _serialize_agreement
            agreement = _serialize_agreement(agr)
        except Exception:  # noqa: BLE001
            agreement = None
    return {
        "demo": False,
        "partner": _serialize(p),
        "stats": _compute_portal_stats(leads),
        "leads": leads,
        "catalog": catalog,
        "agreement": agreement,
        "user": {"name": user_name, "email": user_email},
    }


def _demo_portal(p: dict, user: dict) -> dict:
    now = datetime.now(timezone.utc)

    def _iso(days):
        return (now - timedelta(days=days)).isoformat()

    cats = p.get("categories") or ["Servicii"]
    leads = [
        {"id": "demo-1", "partner_id": str(p["_id"]), "lead_name": "DEMO — Asociația Primăverii nr. 12", "lead_email": "demo1@exemplu.ro", "lead_phone": None, "source": "recomandare", "introduced_at": _iso(2), "stage": "introduced", "conversion_date": None, "revenue_generated": 0, "lost_reason": None, "notes": "Date demonstrative", "created_at": _iso(2), "updated_at": _iso(2)},
        {"id": "demo-2", "partner_id": str(p["_id"]), "lead_name": "DEMO — Dezvoltator Rezidențial Nord", "lead_email": "demo2@exemplu.ro", "lead_phone": None, "source": "eveniment local", "introduced_at": _iso(9), "stage": "contacted", "conversion_date": None, "revenue_generated": 0, "lost_reason": None, "notes": "Date demonstrative", "created_at": _iso(9), "updated_at": _iso(5)},
        {"id": "demo-3", "partner_id": str(p["_id"]), "lead_name": "DEMO — Primăria Reghin (proiect pilot)", "lead_email": "demo3@exemplu.ro", "lead_phone": None, "source": "parteneriat", "introduced_at": _iso(21), "stage": "onboarded", "conversion_date": None, "revenue_generated": 0, "lost_reason": None, "notes": "Date demonstrative", "created_at": _iso(21), "updated_at": _iso(7)},
        {"id": "demo-4", "partner_id": str(p["_id"]), "lead_name": "DEMO — Ansamblu Case Verzi", "lead_email": "demo4@exemplu.ro", "lead_phone": None, "source": "recomandare", "introduced_at": _iso(40), "stage": "converted", "conversion_date": _iso(12), "revenue_generated": 18500, "lost_reason": None, "notes": "Date demonstrative", "created_at": _iso(40), "updated_at": _iso(12)},
        {"id": "demo-5", "partner_id": str(p["_id"]), "lead_name": "DEMO — Client indecis", "lead_email": None, "lead_phone": None, "source": "website", "introduced_at": _iso(30), "stage": "lost", "conversion_date": None, "revenue_generated": 0, "lost_reason": "Buget indisponibil (DEMO)", "notes": "Date demonstrative", "created_at": _iso(30), "updated_at": _iso(15)},
    ]
    catalog = [
        {"id": "demo-p1", "name": f"DEMO — {cats[0]}", "brand": p.get("company"), "category": cats[0], "unit": "buc", "price_min": 1200, "price_max": 2400, "currency": "RON", "partner_id": str(p["_id"]), "partner_name": p.get("company"), "url": None, "tags": ["demo"], "active": True, "created_at": _iso(60), "updated_at": _iso(60)},
        {"id": "demo-p2", "name": f"DEMO — {(cats[1] if len(cats) > 1 else 'Serviciu complementar')}", "brand": p.get("company"), "category": (cats[1] if len(cats) > 1 else None), "unit": "mp", "price_min": 85, "price_max": 140, "currency": "RON", "partner_id": str(p["_id"]), "partner_name": p.get("company"), "url": None, "tags": ["demo"], "active": True, "created_at": _iso(60), "updated_at": _iso(60)},
    ]
    agreement = {
        "id": "demo-agr", "kind": "city", "partner_id": str(p["_id"]), "partner_name": p.get("company"),
        "categories": cats, "territory_cities": ([p.get("city")] if p.get("city") else []),
        "territory_counties": ([p.get("county")] if p.get("county") else []), "territory_regions": [],
        "coverage": p.get("coverage") or "city", "segment": None, "period_from": None, "period_to": None,
        "exclusivity": False, "commission_terms": "DEMO — 8% din valoarea proiectelor convertite", "status": "demo",
        "notes": "Acord demonstrativ, neobligatoriu. Valorile sunt sintetice.", "approved_by": None,
        "acknowledged_conflicts": [], "created_at": _iso(60), "updated_at": _iso(60),
    }
    return {
        "demo": True,
        "partner": _serialize(p),
        "stats": _compute_portal_stats(leads),
        "leads": leads,
        "catalog": catalog,
        "agreement": agreement,
        "user": {"name": user.get("name"), "email": user.get("email")},
        "role": "owner",
        "notifications_unread": 0,
    }


@partner_router.get("/portal")
async def partner_portal(user=Depends(get_current_user)):
    p = await _require_partner(user)
    data = await _assemble_portal(p, user.get("name"), user.get("email"))
    data["role"] = _partner_role(user, p)
    data["notifications_unread"] = await db.partner_notifications.count_documents({"partner_id": p["_id"], "read_by": {"$ne": _user_id(user)}})
    return data


@partner_router.get("/portal/demo")
async def partner_portal_demo(partner_id: str, user=Depends(get_current_user)):
    """Super-admin preview of the portal with synthetic DEMO data — no access granted."""
    _require_super(user)
    try:
        oid = ObjectId(partner_id)
    except Exception:
        raise HTTPException(400, "ID invalid.")
    p = await db.city_partners.find_one({"_id": oid})
    if not p:
        raise HTTPException(404, "Partener inexistent.")
    return _demo_portal(p, user)


# ─────────────────────────────────────────────────────────────────────────────
# AI City Partner Copilot — personalized weekly nudges (Claude Sonnet 4.5)
# ─────────────────────────────────────────────────────────────────────────────
@partner_router.post("/copilot/nudges")
async def partner_copilot_nudges(user=Depends(get_current_user)):
    """Generates 3 personalized action nudges for the logged-in partner.

    Response: {nudges: [{title, body, priority}], generated_at}
    """
    p = await _require_partner(user)
    key = os.environ.get("EMERGENT_LLM_KEY")
    if not key:
        raise HTTPException(503, "EMERGENT_LLM_KEY missing.")

    # Build context: partner profile + lead breakdown
    by_stage = {}
    for st in ALLOWED_LEAD_STAGES:
        by_stage[st] = await db.city_partner_leads.count_documents({"partner_id": p["_id"], "stage": st})
    recent_leads = []
    async for d in db.city_partner_leads.find({"partner_id": p["_id"]}).sort("created_at", -1).limit(8):
        recent_leads.append({
            "name": d.get("lead_name"),
            "stage": d.get("stage"),
            "introduced_at": d.get("introduced_at"),
            "source": d.get("source"),
        })

    import json, uuid as _uuid
    context = {
        "partner": {
            "company": p.get("company"),
            "city": p.get("city"),
            "status": p.get("status"),
            "onboarding_step": p.get("onboarding_step", 0),
            "units_managed": p.get("units_managed"),
            "portfolio_type": p.get("portfolio_type"),
        },
        "leads_by_stage": by_stage,
        "recent_leads": recent_leads,
    }

    system = (
        "Ești un Growth Coach pentru parteneri locali ai PropManage. "
        "Primești date despre un partener (administrator imobile / dezvoltator) și generezi "
        "EXACT 3 nudge-uri practice și personalizate pentru SĂPTĂMÂNA aceasta. "
        "Stil: concis, prietenos, în română, fără jargon. Răspunzi DOAR cu JSON valid: "
        "{nudges: [{title (max 60 char), body (max 240 char, mentionează nume concrete dacă există), priority('high'|'medium'|'low')}]}. "
        "Folosește numele clienților concreți din `recent_leads` când e relevant. "
        "Dacă datele sunt sărace, propune acțiuni de explorare (ex: aducere primul lead)."
    )

    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=key,
            session_id=f"city_partner_copilot_{_uuid.uuid4().hex[:8]}",
            system_message=system,
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")
        raw = await chat.send_message(UserMessage(text=json.dumps(context, ensure_ascii=False)))
        text = (raw or "").strip()
        if text.startswith("```"):
            text = "\n".join(line for line in text.splitlines() if not line.startswith("```"))
        i, j = text.find("{"), text.rfind("}")
        if i == -1 or j <= i:
            raise HTTPException(502, "AI nu a returnat JSON valid.")
        payload = json.loads(text[i:j + 1])
        nudges = []
        for n in (payload.get("nudges") or [])[:3]:
            nudges.append({
                "title": str(n.get("title") or "")[:80],
                "body": str(n.get("body") or "")[:300],
                "priority": (n.get("priority") or "medium").lower(),
            })
        out = {
            "nudges": nudges,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }
        # Persist last run for caching / audit
        await db.city_partner_nudges.insert_one({
            "partner_id": p["_id"],
            **out,
        })
        return out
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        logger.exception(f"[city_partner_copilot] failed: {e}")
        raise HTTPException(500, f"Eroare AI: {str(e)[:200]}")



# ═════════════════════════════════════════════════════════════════════════════
# CITY PARTNER PRODUCTS — real material catalog (admin-managed, EMPTY by default)
# Consumed by Digital Twin design concepts for REAL indicative material prices.
# Never seeded with fake data: stays empty until a super-admin adds real products.
# ═════════════════════════════════════════════════════════════════════════════
class ProductIn(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    brand: Optional[str] = None
    category: Optional[str] = None
    unit: str = "buc"
    price_min: float = Field(ge=0)
    price_max: Optional[float] = Field(default=None, ge=0)
    currency: str = "RON"
    partner_id: Optional[str] = None
    url: Optional[str] = None
    tags: list = Field(default_factory=list)
    active: bool = True


class ProductPatch(BaseModel):
    name: Optional[str] = None
    brand: Optional[str] = None
    category: Optional[str] = None
    unit: Optional[str] = None
    price_min: Optional[float] = None
    price_max: Optional[float] = None
    currency: Optional[str] = None
    partner_id: Optional[str] = None
    url: Optional[str] = None
    tags: Optional[list] = None
    active: Optional[bool] = None


def _serialize_product(d: dict) -> dict:
    if not d:
        return d
    return {
        "id": str(d.get("_id")),
        "name": d.get("name"),
        "brand": d.get("brand"),
        "category": d.get("category"),
        "unit": d.get("unit") or "buc",
        "price_min": d.get("price_min"),
        "price_max": d.get("price_max"),
        "currency": d.get("currency") or "RON",
        "partner_id": str(d["partner_id"]) if d.get("partner_id") else None,
        "partner_name": d.get("partner_name"),
        "url": d.get("url"),
        "tags": d.get("tags") or [],
        "active": bool(d.get("active", True)),
        "created_at": d.get("created_at"),
        "updated_at": d.get("updated_at"),
    }


async def _resolve_partner(partner_id):
    if not partner_id:
        return None, None
    try:
        pdoc = await db.city_partners.find_one({"_id": ObjectId(partner_id)})
    except Exception:
        return None, None
    if not pdoc:
        return None, None
    return pdoc["_id"], pdoc.get("company")


@products_admin_router.get("")
async def list_products(q: Optional[str] = None, user=Depends(get_current_user)):
    _require_super(user)
    query = {}
    if q:
        query["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"brand": {"$regex": q, "$options": "i"}},
            {"tags": {"$in": [q.lower()]}},
        ]
    cur = db.city_partner_products.find(query).sort("created_at", -1)
    items = [_serialize_product(d) async for d in cur]
    return {"items": items, "count": len(items)}


@products_admin_router.post("")
async def create_product(payload: ProductIn, user=Depends(get_current_user)):
    _require_super(user)
    now = datetime.now(timezone.utc).isoformat()
    partner_ref, partner_name = await _resolve_partner(payload.partner_id)
    doc = {
        "name": payload.name,
        "brand": payload.brand,
        "category": payload.category,
        "unit": payload.unit or "buc",
        "price_min": payload.price_min,
        "price_max": payload.price_max if payload.price_max is not None else payload.price_min,
        "currency": payload.currency or "RON",
        "partner_id": partner_ref,
        "partner_name": partner_name,
        "url": payload.url,
        "tags": [str(t).lower().strip() for t in (payload.tags or []) if str(t).strip()],
        "active": payload.active,
        "created_at": now,
        "updated_at": now,
        "created_by": user.get("email"),
    }
    res = await db.city_partner_products.insert_one(doc)
    doc["_id"] = res.inserted_id
    return _serialize_product(doc)


@products_admin_router.patch("/{product_id}")
async def patch_product(product_id: str, payload: ProductPatch, user=Depends(get_current_user)):
    _require_super(user)
    try:
        oid = ObjectId(product_id)
    except Exception:
        raise HTTPException(400, "ID invalid.")
    update = {k: v for k, v in payload.dict(exclude_unset=True).items() if v is not None}
    if "tags" in update:
        update["tags"] = [str(t).lower().strip() for t in update["tags"] if str(t).strip()]
    if "partner_id" in update:
        partner_ref, partner_name = await _resolve_partner(update["partner_id"])
        update["partner_id"] = partner_ref
        update["partner_name"] = partner_name
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    res = await db.city_partner_products.find_one_and_update({"_id": oid}, {"$set": update}, return_document=True)
    if not res:
        raise HTTPException(404, "Produs inexistent.")
    return _serialize_product(res)


@products_admin_router.delete("/{product_id}")
async def delete_product(product_id: str, user=Depends(get_current_user)):
    _require_super(user)
    try:
        oid = ObjectId(product_id)
    except Exception:
        raise HTTPException(400, "ID invalid.")
    res = await db.city_partner_products.delete_one({"_id": oid})
    if res.deleted_count == 0:
        raise HTTPException(404, "Produs inexistent.")
    return {"ok": True, "deleted": True}
