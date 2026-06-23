"""House Health — F4.1: Plans CRUD + Scoring formula config.

Public:
    GET  /api/house-health/plans                 — list active plans (for upgrade page)
    GET  /api/house-health/scoring-config        — read scoring weights/thresholds

Admin only:
    GET    /api/admin/house-health/plans         — list all (incl. inactive)
    POST   /api/admin/house-health/plans         — create
    PATCH  /api/admin/house-health/plans/{id}    — partial update
    DELETE /api/admin/house-health/plans/{id}    — soft delete (active=false)
    PUT    /api/admin/house-health/scoring-config — replace weights/thresholds

Collections: ``hh_plans``, ``hh_scoring_config`` (singleton _id="default").
"""
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, validator

from db import db
from deps import get_current_user, require_role

logger = logging.getLogger("propmanage.house_health.plans")

public_router = APIRouter(prefix="/api/house-health", tags=["house-health"])
admin_router = APIRouter(prefix="/api/admin/house-health", tags=["house-health-admin"])

# ============================== DEFAULTS ====================================
DEFAULT_SCORING_CONFIG = {
    "_id": "default",
    "weights": {
        "air": 15,
        "thermal": 20,
        "humidity": 15,
        "electric": 15,
        "docs": 10,
        "maintenance": 15,
        "radon": 10,
    },
    "thresholds": {"excellent": 90, "good": 75, "fair": 50},
    "updated_at": None,
    "updated_by": None,
}


# ============================== MODELS ======================================
class PlanIn(BaseModel):
    slug: str = Field(..., description="basic|pro|premium|custom (must be unique)")
    name: str
    description: Optional[str] = ""
    price_eur: float = 0.0
    currency: str = "EUR"
    billing_period: str = Field("monthly", description="monthly|yearly|one_time")
    trial_days: int = 0
    features: List[str] = []
    stripe_price_id: Optional[str] = None
    lead_commission_pct: float = Field(10.0, ge=0, le=100)
    sort_order: int = 0
    active: bool = True

    @validator("billing_period")
    def _bp(cls, v):
        if v not in ("monthly", "yearly", "one_time"):
            raise ValueError("billing_period must be monthly|yearly|one_time")
        return v


class PlanPatch(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price_eur: Optional[float] = None
    currency: Optional[str] = None
    billing_period: Optional[str] = None
    trial_days: Optional[int] = None
    features: Optional[List[str]] = None
    stripe_price_id: Optional[str] = None
    lead_commission_pct: Optional[float] = None
    sort_order: Optional[int] = None
    active: Optional[bool] = None


class ScoringConfigIn(BaseModel):
    weights: dict
    thresholds: Optional[dict] = None

    @validator("weights")
    def _w(cls, v):
        required = {"air", "thermal", "humidity", "electric", "docs", "maintenance", "radon"}
        missing = required - set(v.keys())
        if missing:
            raise ValueError(f"missing weight keys: {missing}")
        try:
            total = sum(float(v[k]) for k in required)
        except (TypeError, ValueError):
            raise ValueError("weights must be numeric")
        if abs(total - 100) > 0.01:
            raise ValueError(f"weights must sum to 100, got {total}")
        return {k: float(v[k]) for k in required}

    @validator("thresholds")
    def _t(cls, v):
        if v is None:
            return None
        req = {"excellent", "good", "fair"}
        missing = req - set(v.keys())
        if missing:
            raise ValueError(f"missing thresholds: {missing}")
        ex, gd, fr = float(v["excellent"]), float(v["good"]), float(v["fair"])
        if not (0 < fr < gd < ex <= 100):
            raise ValueError("thresholds must satisfy 0 < fair < good < excellent <= 100")
        return {"excellent": ex, "good": gd, "fair": fr}


# ============================== PLANS — PUBLIC ==============================
@public_router.get("/plans")
async def list_active_plans(user=Depends(get_current_user)):
    """List active plans for the upgrade/checkout page."""
    items = []
    async for p in db.hh_plans.find({"active": True}, {"_id": 0}).sort("sort_order", 1):
        items.append(p)
    return {"items": items, "count": len(items)}


# ============================== PLANS — ADMIN ===============================
@admin_router.get("/plans")
async def admin_list_plans(user=Depends(require_role("admin"))):
    items = []
    async for p in db.hh_plans.find({}, {"_id": 0}).sort("sort_order", 1):
        items.append(p)
    return {"items": items, "count": len(items)}


@admin_router.post("/plans")
async def admin_create_plan(payload: PlanIn, user=Depends(require_role("admin"))):
    if await db.hh_plans.find_one({"slug": payload.slug}):
        raise HTTPException(409, f"Slug '{payload.slug}' există deja.")
    plan_id = uuid.uuid4().hex
    doc = payload.dict()
    doc.update({
        "id": plan_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user.get("email"),
        "updated_at": None,
    })
    await db.hh_plans.insert_one(doc)
    doc.pop("_id", None)
    await db.hh_audit_log.insert_one({
        "user_id": user["id"], "action": "plan_created",
        "resource_id": plan_id, "timestamp": datetime.now(timezone.utc).isoformat(),
    })
    return {"ok": True, "plan": doc}


@admin_router.patch("/plans/{plan_id}")
async def admin_patch_plan(plan_id: str, payload: PlanPatch, user=Depends(require_role("admin"))):
    p = await db.hh_plans.find_one({"id": plan_id})
    if not p:
        raise HTTPException(404, "Plan inexistent.")
    update = {k: v for k, v in payload.dict().items() if v is not None}
    if not update:
        return {"ok": True, "noop": True}
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    update["updated_by"] = user.get("email")
    if "billing_period" in update and update["billing_period"] not in ("monthly", "yearly", "one_time"):
        raise HTTPException(400, "billing_period invalid.")
    await db.hh_plans.update_one({"id": plan_id}, {"$set": update})
    await db.hh_audit_log.insert_one({
        "user_id": user["id"], "action": "plan_updated",
        "resource_id": plan_id, "timestamp": datetime.now(timezone.utc).isoformat(),
        "changes": list(update.keys()),
    })
    fresh = await db.hh_plans.find_one({"id": plan_id}, {"_id": 0})
    return {"ok": True, "plan": fresh}


@admin_router.delete("/plans/{plan_id}")
async def admin_delete_plan(plan_id: str, user=Depends(require_role("admin"))):
    """Soft delete — sets active=false. Hard delete is intentionally disabled."""
    p = await db.hh_plans.find_one({"id": plan_id})
    if not p:
        raise HTTPException(404, "Plan inexistent.")
    await db.hh_plans.update_one(
        {"id": plan_id},
        {"$set": {"active": False, "updated_at": datetime.now(timezone.utc).isoformat(), "updated_by": user.get("email")}},
    )
    await db.hh_audit_log.insert_one({
        "user_id": user["id"], "action": "plan_archived",
        "resource_id": plan_id, "timestamp": datetime.now(timezone.utc).isoformat(),
    })
    return {"ok": True, "archived": plan_id}


# ============================== SCORING CONFIG ==============================
async def _ensure_default_scoring():
    s = await db.hh_scoring_config.find_one({"_id": "default"})
    if not s:
        seed = dict(DEFAULT_SCORING_CONFIG)
        seed["updated_at"] = datetime.now(timezone.utc).isoformat()
        seed["updated_by"] = "seed"
        await db.hh_scoring_config.insert_one(seed)
        s = seed
    return s


@public_router.get("/scoring-config")
async def get_scoring_config(user=Depends(get_current_user)):
    """Read scoring weights & thresholds (used by client UI + score engine)."""
    s = await _ensure_default_scoring()
    s.pop("_id", None)
    return s


@admin_router.put("/scoring-config")
async def update_scoring_config(payload: ScoringConfigIn, user=Depends(require_role("admin"))):
    update = {
        "weights": payload.weights,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": user.get("email"),
    }
    if payload.thresholds is not None:
        update["thresholds"] = payload.thresholds
    await db.hh_scoring_config.update_one(
        {"_id": "default"},
        {"$set": update, "$setOnInsert": {"_id": "default"}},
        upsert=True,
    )
    await db.hh_audit_log.insert_one({
        "user_id": user["id"], "action": "scoring_config_updated",
        "resource_id": "default", "timestamp": datetime.now(timezone.utc).isoformat(),
    })
    fresh = await db.hh_scoring_config.find_one({"_id": "default"})
    fresh.pop("_id", None)
    return {"ok": True, "config": fresh}
