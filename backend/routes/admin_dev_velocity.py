"""Admin endpoints for the Dev Velocity weekly report."""
import logging
from fastapi import APIRouter, Depends

from deps import require_role
from dev_velocity_service import collect_velocity, ai_summary, send_weekly_velocity_email
from db import db

logger = logging.getLogger("propmanage.routes.dev_velocity")
router = APIRouter(prefix="/api/admin/dev-velocity", tags=["admin-dev-velocity"])


@router.get("/preview")
async def preview_velocity(days: int = 7, user: dict = Depends(require_role("admin"))):
    """Compute weekly stats + AI summary (returned as JSON for inline preview)."""
    stats = collect_velocity(days=min(days, 30))
    summary = await ai_summary(stats)
    return {"stats": stats, "summary": summary}


@router.post("/send-now")
async def send_velocity_now(user: dict = Depends(require_role("admin"))):
    """Force-send the weekly velocity email NOW."""
    result = await send_weekly_velocity_email(force=True)
    logger.info(f"[DevVelocity] manual send by {user.get('email')}: {result.get('recipients')}")
    return result


@router.get("/history")
async def velocity_history(limit: int = 20, user: dict = Depends(require_role("admin"))):
    cursor = db.dev_velocity_runs.find({}).sort("created_at", -1).limit(min(limit, 100))
    items = []
    async for r in cursor:
        r["_id"] = str(r["_id"])
        items.append(r)
    return {"items": items}
