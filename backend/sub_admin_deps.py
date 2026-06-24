"""Sub-Admin RBAC dependencies — scoped admin access (Feb 22 2026).

Hierarchy:
  - Admins with role="admin" + admin_scope="general" = SUPER ADMIN (you).
    They can do anything, create sub-admins, approve actions.
  - Admins with role="admin" + admin_scope in {testing, frontend, backend,
    security, ai, ops} are SUB-ADMINs. They can only call endpoints guarded
    with their scope (or "general").
  - admin_seniority in {junior, senior}. Senior sub-admins can see + approve
    actions of juniors within their same scope (used by Milestone 3 approval
    workflow, not enforced here).

Legacy: admins without admin_scope are treated as "general" (super admin)
so existing accounts (admin@propmanage.io) keep full access.
"""
import logging
from datetime import datetime, timezone
from typing import Iterable

from fastapi import Depends, HTTPException, Request

from deps import get_current_user
from db import db

logger = logging.getLogger("propmanage.sub_admin")

# Allowed scopes — kept short on purpose
ALLOWED_SCOPES = {"general", "testing", "frontend", "backend", "security", "ai", "ops"}
ALLOWED_SENIORITY = {"junior", "senior"}


def _user_scope(user: dict) -> str:
    return (user.get("admin_scope") or "general").lower()


def is_super_admin(user: dict) -> bool:
    return user.get("role") == "admin" and _user_scope(user) == "general"


async def _log_action(user: dict, request: Request, allowed: Iterable[str], outcome: str) -> None:
    try:
        doc = {
            "user_id": user.get("id"),
            "user_email": user.get("email"),
            "scope": _user_scope(user),
            "seniority": user.get("admin_seniority") or "senior",
            "method": request.method,
            "path": request.url.path,
            "allowed_scopes": list(allowed),
            "outcome": outcome,  # "allowed" | "denied"
            "ts": datetime.now(timezone.utc).isoformat(),
        }
        await db.admin_actions_log.insert_one(doc)
        # cap at 5000
        cur = db.admin_actions_log.find({}, {"_id": 1}).sort("ts", -1).skip(5000)
        old = [d["_id"] async for d in cur]
        if old:
            await db.admin_actions_log.delete_many({"_id": {"$in": old}})
    except Exception as e:  # noqa: BLE001
        logger.debug(f"[sub_admin] failed to log action: {e}")


def require_admin_scope(*allowed_scopes: str):
    """Dependency factory: restricts an endpoint to admins whose ``admin_scope``
    is in ``allowed_scopes`` (or who are super admins / general scope).

    Example::

        @router.post("/some-action", dependencies=[Depends(require_admin_scope("testing"))])
        async def some_action(...): ...

    Or directly::

        @router.post("/some-action")
        async def some_action(user=Depends(require_admin_scope("testing", "ai"))): ...
    """
    allowed = set((s or "").lower() for s in allowed_scopes) | {"general"}

    async def dep(request: Request, user: dict = Depends(get_current_user)) -> dict:
        if user.get("role") != "admin":
            await _log_action(user, request, allowed, "denied")
            raise HTTPException(403, "Admin role required")
        scope = _user_scope(user)
        if scope in allowed:
            await _log_action(user, request, allowed, "allowed")
            return user
        await _log_action(user, request, allowed, "denied")
        raise HTTPException(
            403,
            f"Acces refuzat — endpoint-ul necesită admin_scope ∈ {sorted(allowed)} (tu ești '{scope}').",
        )

    return dep
