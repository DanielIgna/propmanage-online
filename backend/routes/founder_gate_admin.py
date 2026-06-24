"""Founder Gate — Admin API (read-only, Phase FG-0)

This route exposes the critical actions registry for admin UI display
and reports the current feature flag state.

ALL endpoints are admin-only and READ-ONLY in Phase FG-0.
No enforcement happens yet — middleware comes in Phase FG-2.
"""
import logging
from fastapi import APIRouter, Depends

from db import db
from deps import require_role
from founder_gate import ENABLE_FLAG_KEY
from founder_gate.registry import (
    get_registry, registry_stats, actions_by_category,
)

logger = logging.getLogger("propmanage.founder_gate")
router = APIRouter(prefix="/api/admin/founder-gate", tags=["founder-gate"])


async def _read_flag() -> bool:
    """Read feature flag from app_settings (default False)."""
    doc = await db.app_settings.find_one({"_id": "app_settings"}, {ENABLE_FLAG_KEY: 1})
    if not doc:
        return False
    return bool(doc.get(ENABLE_FLAG_KEY, False))


@router.get("/status")
async def get_status(user=Depends(require_role("admin"))):
    """Return the current state of the Founder Gate module.

    Phase FG-0: always reports `phase: "FG-0"` and `enforcement_active: False`.
    """
    enabled = await _read_flag()
    return {
        "phase": "FG-0",
        "feature_flag": ENABLE_FLAG_KEY,
        "feature_flag_value": enabled,
        "enforcement_active": False,  # FG-0: never enforces
        "next_phase": "FG-1 (Twilio integration + SMS service)",
        "note": (
            "Phase FG-0 is foundation-only. The gate does NOT block any "
            "request yet. Enforcement starts at Phase FG-2 (middleware) "
            "and the flag must be ON to take effect."
        ),
    }


@router.get("/critical-actions")
async def list_critical_actions(user=Depends(require_role("admin"))):
    """Return the full registry of protected actions."""
    return {
        "items": get_registry(),
        "stats": registry_stats(),
    }


@router.get("/critical-actions/by-category")
async def list_by_category(user=Depends(require_role("admin"))):
    """Return registry grouped by category — useful for admin dashboard UI."""
    return {"groups": actions_by_category()}
