"""Sub-Admin management — REST API (super-admin only).

Endpoints (mounted at /api/admin/sub-admins):
  GET    /                — list all sub-admins
  POST   /                — create a new sub-admin (custom email + password)
  PATCH  /{id}            — update scope/seniority/active
  POST   /{id}/reset-password — reset password (returns new one)
  DELETE /{id}            — soft-delete (sets is_active=False)

Only callable by a super admin (admin_scope="general") — enforced via the
``is_super_admin`` helper.

Additional helper endpoint:
  GET /me/scope           — any authenticated admin can read their own scope
  GET /audit              — super-admin: latest admin actions log
"""
import logging
import secrets
import string
from datetime import datetime, timezone
from typing import Optional

import bcrypt
from bson import ObjectId
from fastapi import APIRouter, Body, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field

from db import db
from deps import get_current_user
from sub_admin_deps import (
    ALLOWED_SCOPES,
    ALLOWED_SENIORITY,
    is_super_admin,
)

logger = logging.getLogger("propmanage.sub_admins")
router = APIRouter(prefix="/api/admin/sub-admins", tags=["admin-sub-admins"])


def _require_super(user: dict) -> None:
    if not is_super_admin(user):
        raise HTTPException(403, "Doar super admin (scope=general) poate gestiona sub-admini.")


def _strip(u: dict) -> dict:
    out = {
        "id": str(u.get("_id")),
        "email": u.get("email"),
        "name": u.get("name"),
        "admin_scope": u.get("admin_scope") or "general",
        "admin_seniority": u.get("admin_seniority") or "senior",
        "reports_to": u.get("reports_to"),
        "is_active": u.get("is_active", True),
        "created_at": u.get("created_at"),
        "updated_at": u.get("updated_at"),
        "last_seen": u.get("last_seen"),
        "is_demo_sub_admin": bool(u.get("is_demo_sub_admin")),
    }
    return out


def _random_password(length: int = 14) -> str:
    alphabet = string.ascii_letters + string.digits + "!@#$%&*"
    return "".join(secrets.choice(alphabet) for _ in range(length))


class SubAdminCreate(BaseModel):
    email: EmailStr
    name: str = Field(min_length=2, max_length=80)
    admin_scope: str
    admin_seniority: str = Field(default="junior")
    reports_to: Optional[str] = None
    password: Optional[str] = Field(default=None, min_length=8, max_length=80)


class SubAdminPatch(BaseModel):
    admin_scope: Optional[str] = None
    admin_seniority: Optional[str] = None
    reports_to: Optional[str] = None
    is_active: Optional[bool] = None
    name: Optional[str] = Field(default=None, min_length=2, max_length=80)


@router.get("/me/scope")
async def my_scope(user: dict = Depends(get_current_user)):
    """Any logged-in admin can read their own scope (for UI sidebar filtering)."""
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin role required")
    return {
        "admin_scope": user.get("admin_scope") or "general",
        "admin_seniority": user.get("admin_seniority") or "senior",
        "is_super_admin": is_super_admin(user),
        "reports_to": user.get("reports_to"),
        "email": user.get("email"),
        "name": user.get("name"),
    }


@router.get("")
async def list_sub_admins(user: dict = Depends(get_current_user)):
    _require_super(user)
    cursor = db.users.find(
        {"role": "admin"},
        sort=[("created_at", -1)],
    )
    items = [_strip(u) async for u in cursor]
    return {"items": items, "count": len(items)}


@router.post("")
async def create_sub_admin(payload: SubAdminCreate, user: dict = Depends(get_current_user)):
    _require_super(user)
    if payload.admin_scope not in ALLOWED_SCOPES:
        raise HTTPException(400, f"admin_scope must be in {sorted(ALLOWED_SCOPES)}")
    if payload.admin_seniority not in ALLOWED_SENIORITY:
        raise HTTPException(400, f"admin_seniority must be in {sorted(ALLOWED_SENIORITY)}")
    existing = await db.users.find_one({"email": payload.email})
    if existing:
        raise HTTPException(409, "Email deja folosit")

    raw_pw = payload.password or _random_password()
    pw_hash = bcrypt.hashpw(raw_pw.encode(), bcrypt.gensalt()).decode()
    now_iso = datetime.now(timezone.utc).isoformat()
    doc = {
        "email": payload.email,
        "name": payload.name,
        "role": "admin",
        "admin_scope": payload.admin_scope,
        "admin_seniority": payload.admin_seniority,
        "reports_to": payload.reports_to,
        "password_hash": pw_hash,
        "verified": True,
        "email_verified": True,
        "phone_verified": False,
        "wallet_balance": 0,
        "tokens": 0,
        "tier": "",
        "is_active": True,
        "created_at": now_iso,
        "updated_at": now_iso,
        "created_by": user["id"],
        "consent_grandfathered": True,
        "terms_accepted": True,
        "privacy_policy_accepted": True,
    }
    res = await db.users.insert_one(doc)
    return {
        "ok": True,
        "id": str(res.inserted_id),
        "email": payload.email,
        "name": payload.name,
        "admin_scope": payload.admin_scope,
        "admin_seniority": payload.admin_seniority,
        # IMPORTANT: returned ONLY at creation so admin can communicate it to the user.
        "initial_password": raw_pw,
    }


@router.patch("/{admin_id}")
async def patch_sub_admin(
    admin_id: str,
    payload: SubAdminPatch,
    user: dict = Depends(get_current_user),
):
    _require_super(user)
    try:
        oid = ObjectId(admin_id)
    except Exception:
        raise HTTPException(400, "Invalid id")
    target = await db.users.find_one({"_id": oid, "role": "admin"})
    if not target:
        raise HTTPException(404, "Sub-admin not found")
    # Prevent the super-admin from accidentally demoting themselves
    if str(target["_id"]) == user["id"] and payload.admin_scope and payload.admin_scope != "general":
        raise HTTPException(400, "Nu poți schimba propriul scope (general) — ar duce la lockout.")

    update = {}
    if payload.admin_scope is not None:
        if payload.admin_scope not in ALLOWED_SCOPES:
            raise HTTPException(400, f"admin_scope must be in {sorted(ALLOWED_SCOPES)}")
        update["admin_scope"] = payload.admin_scope
    if payload.admin_seniority is not None:
        if payload.admin_seniority not in ALLOWED_SENIORITY:
            raise HTTPException(400, f"admin_seniority must be in {sorted(ALLOWED_SENIORITY)}")
        update["admin_seniority"] = payload.admin_seniority
    if payload.reports_to is not None:
        update["reports_to"] = payload.reports_to or None
    if payload.is_active is not None:
        update["is_active"] = bool(payload.is_active)
    if payload.name is not None:
        update["name"] = payload.name
    if not update:
        raise HTTPException(400, "Nothing to update")
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    update["updated_by"] = user["id"]
    await db.users.update_one({"_id": oid}, {"$set": update})
    fresh = await db.users.find_one({"_id": oid})
    return {"ok": True, "item": _strip(fresh)}


@router.post("/{admin_id}/reset-password")
async def reset_sub_admin_password(admin_id: str, user: dict = Depends(get_current_user)):
    _require_super(user)
    try:
        oid = ObjectId(admin_id)
    except Exception:
        raise HTTPException(400, "Invalid id")
    target = await db.users.find_one({"_id": oid, "role": "admin"})
    if not target:
        raise HTTPException(404, "Sub-admin not found")
    new_pw = _random_password()
    pw_hash = bcrypt.hashpw(new_pw.encode(), bcrypt.gensalt()).decode()
    await db.users.update_one(
        {"_id": oid},
        {"$set": {
            "password_hash": pw_hash,
            "password_reset_at": datetime.now(timezone.utc).isoformat(),
            "password_reset_by": user["id"],
        }},
    )
    return {"ok": True, "email": target.get("email"), "new_password": new_pw}


@router.delete("/{admin_id}")
async def deactivate_sub_admin(admin_id: str, user: dict = Depends(get_current_user)):
    _require_super(user)
    try:
        oid = ObjectId(admin_id)
    except Exception:
        raise HTTPException(400, "Invalid id")
    if str(oid) == user["id"]:
        raise HTTPException(400, "Nu te poți dezactiva pe tine.")
    await db.users.update_one(
        {"_id": oid, "role": "admin"},
        {"$set": {
            "is_active": False,
            "deactivated_at": datetime.now(timezone.utc).isoformat(),
            "deactivated_by": user["id"],
        }},
    )
    return {"ok": True, "deactivated": admin_id}


@router.get("/audit")
async def audit_log(
    limit: int = 100,
    scope: Optional[str] = None,
    outcome: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    _require_super(user)
    limit = min(max(int(limit), 1), 500)
    q: dict = {}
    if scope:
        q["scope"] = scope.lower()
    if outcome in ("allowed", "denied"):
        q["outcome"] = outcome
    cursor = db.admin_actions_log.find(q, {"_id": 0}).sort("ts", -1).limit(limit)
    items = [d async for d in cursor]
    # Aggregate counts per scope (for chips in UI)
    counts: dict = {}
    async for d in db.admin_actions_log.aggregate([
        {"$group": {"_id": "$scope", "n": {"$sum": 1}}},
    ]):
        counts[d.get("_id") or "unknown"] = d.get("n", 0)
    return {"items": items, "count": len(items), "scope_counts": counts}
