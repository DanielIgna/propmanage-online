"""Entitlements API — expune starea de entitlement pentru frontend + admin.

Endpoints:
  GET  /api/me/entitlements              — user curent (auto-hidratat)
  GET  /api/admin/entitlements/catalog   — catalog tier→features (admin)
  GET  /api/admin/users/{user_id}/entitlements — lookup admin pe alt user
"""
from __future__ import annotations

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from db import db
from deps import get_current_user, require_role
from entitlements import get_tier_catalog, get_user_entitlements

router = APIRouter(prefix="/api", tags=["entitlements"])


@router.get("/me/entitlements")
async def me_entitlements(user: dict = Depends(get_current_user)):
    """Snapshot-ul de entitlement pentru user-ul curent. Frontend-ul îl folosește
    ca sursă unică pentru gating UI."""
    return await get_user_entitlements(user)


@router.get("/admin/entitlements/catalog")
async def catalog(_admin: dict = Depends(require_role("admin"))):
    return get_tier_catalog()


@router.get("/admin/users/{user_id}/entitlements")
async def admin_lookup(user_id: str, _admin: dict = Depends(require_role("admin"))):
    """Admin verifică starea de entitlement a unui user oarecare (fără impersonation)."""
    try:
        u = await db.users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        u = None
    if not u:
        raise HTTPException(404, "Utilizator inexistent")
    # normalizează la formatul așteptat de get_user_entitlements
    target = {
        "id": str(u["_id"]),
        "role": u.get("role"),
        "active_view": u.get("active_view"),
    }
    ent = await get_user_entitlements(target)
    ent["user_email"] = u.get("email")
    ent["user_name"] = u.get("name")
    return ent
