"""In-app Tour v2.0 — per-user completion tracking for admin onboarding.

Lightweight endpoint: tells frontend whether to show the v2.0 tour for the
current user. Marked complete after the user finishes or skips the tour.

Stored in users.tour_v2_completed (bool, default False).
"""
from fastapi import APIRouter, Depends
from datetime import datetime, timezone
from bson import ObjectId

from db import db
from deps import get_current_user

router = APIRouter(prefix="/api/admin/tour", tags=["admin-tour"])


def _uid_filter(uid: str) -> dict:
    try:
        return {"_id": ObjectId(uid)}
    except Exception:
        return {"id": uid}


@router.get("/status")
async def tour_status(user=Depends(get_current_user)):
    """Return whether the v2.0 tour has been completed/skipped by this user."""
    doc = await db.users.find_one(_uid_filter(user["id"]), {"tour_v2_completed": 1, "tour_v2_completed_at": 1})
    return {
        "completed": bool((doc or {}).get("tour_v2_completed", False)),
        "completed_at": (doc or {}).get("tour_v2_completed_at"),
    }


@router.post("/complete")
async def mark_tour_complete(user=Depends(get_current_user)):
    """Mark the v2.0 tour as completed (or skipped) for this user."""
    await db.users.update_one(
        _uid_filter(user["id"]),
        {"$set": {
            "tour_v2_completed": True,
            "tour_v2_completed_at": datetime.now(timezone.utc).isoformat(),
        }},
    )
    return {"ok": True}


@router.post("/reset")
async def reset_tour(user=Depends(get_current_user)):
    """Reset the v2.0 tour so it shows again (for testing/demo)."""
    await db.users.update_one(
        _uid_filter(user["id"]),
        {"$unset": {"tour_v2_completed": "", "tour_v2_completed_at": ""}},
    )
    return {"ok": True}
