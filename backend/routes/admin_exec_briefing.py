"""Admin endpoints: preview & manually trigger the weekly Executive Briefing."""
from fastapi import APIRouter, Depends, HTTPException

from deps import get_current_user
from executive_briefing import (
    compute_exec_briefing,
    send_exec_briefing_email,
    _render_exec_briefing_html,
)
from db import db
import os

router = APIRouter(prefix="/api/admin/exec-briefing", tags=["admin-exec-briefing"])


async def _require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return user


@router.get("/preview")
async def preview(_: dict = Depends(_require_admin)) -> dict:
    """Return the computed payload + rendered HTML body (no email sent)."""
    payload = await compute_exec_briefing()
    app_url = os.environ.get("APP_PUBLIC_URL", "https://propmanage.ro")
    return {
        "payload": payload,
        "html": _render_exec_briefing_html(payload, app_url),
    }


@router.post("/send")
async def send_now(_: dict = Depends(_require_admin)) -> dict:
    """Manually trigger the briefing right now (sends to ADMIN_EMAILS)."""
    return await send_exec_briefing_email(force=True)


@router.get("/history")
async def history(_: dict = Depends(_require_admin), limit: int = 12) -> dict:
    cursor = db.exec_briefings.find({}, {"payload.users": 0}).sort("sent_at", -1).limit(limit)
    items: list[dict] = []
    async for d in cursor:
        d.pop("_id", None)
        items.append(d)
    return {"items": items, "count": len(items)}
