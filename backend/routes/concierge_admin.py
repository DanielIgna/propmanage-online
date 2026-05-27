"""PropManage — AI Concierge admin endpoints (settings, conversations, stats, block)."""
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Body, Query

from db import db
from deps import require_role
from routes.concierge_core import _get_settings

admin_router = APIRouter(prefix="/api/admin/concierge", tags=["admin-concierge"])


@admin_router.get("/settings")
async def get_concierge_settings(user: dict = Depends(require_role("admin"))):
    return await _get_settings()


@admin_router.put("/settings")
async def update_concierge_settings(
    payload: dict = Body(...),
    user: dict = Depends(require_role("admin")),
):
    update = {}
    if "enabled_roles" in payload:
        roles = [r for r in payload["enabled_roles"] if r in ["client", "specialist", "operator"]]
        update["enabled_roles"] = roles
    if "escalation_triggers" in payload:
        update["escalation_triggers"] = [t.strip() for t in payload["escalation_triggers"] if t.strip()][:50]
    if "support_email" in payload:
        update["support_email"] = payload["support_email"].strip()
    if "blocked_users" in payload:
        update["blocked_users"] = [u for u in payload["blocked_users"] if isinstance(u, str)]
    await db.concierge_settings.update_one({"_id": "global"}, {"$set": update}, upsert=True)
    return await _get_settings()


@admin_router.get("/conversations")
async def list_concierge_conversations(
    limit: int = Query(50, le=200),
    filter: Optional[str] = None,
    user: dict = Depends(require_role("admin")),
):
    pipeline = []
    match = {}
    if filter == "escalated":
        match["escalated"] = True
    elif filter == "blocked":
        match["blocked"] = True
    if match:
        pipeline.append({"$match": match})
    pipeline += [
        {"$sort": {"created_at": -1}},
        {"$group": {
            "_id": "$session_id",
            "user_id": {"$first": "$user_id"},
            "user_role": {"$first": "$user_role"},
            "last_message_at": {"$first": "$created_at"},
            "message_count": {"$sum": 1},
            "escalated": {"$max": "$escalated"},
            "blocked": {"$max": "$blocked"},
            "first_message": {"$last": "$content"},
        }},
        {"$sort": {"last_message_at": -1}},
        {"$limit": limit},
    ]
    items = []
    async for d in db.concierge_messages.aggregate(pipeline):
        items.append({
            "session_id": d["_id"],
            "user_id": d.get("user_id"),
            "user_role": d.get("user_role"),
            "last_message_at": d.get("last_message_at"),
            "message_count": d.get("message_count"),
            "escalated": bool(d.get("escalated")),
            "blocked": bool(d.get("blocked")),
            "first_message": (d.get("first_message") or "")[:120],
        })
    return {"items": items}


@admin_router.get("/conversations/{session_id}")
async def get_conversation_messages(session_id: str, user: dict = Depends(require_role("admin"))):
    cursor = db.concierge_messages.find({"session_id": session_id}).sort("created_at", 1)
    msgs = []
    async for m in cursor:
        msgs.append({
            "role": m.get("role"),
            "content": m.get("content"),
            "blocked": m.get("blocked", False),
            "escalated": m.get("escalated", False),
            "block_reason": m.get("block_reason"),
            "escalation_trigger": m.get("escalation_trigger"),
            "created_at": m.get("created_at"),
        })
    return {"session_id": session_id, "messages": msgs}


@admin_router.get("/stats")
async def concierge_stats(user: dict = Depends(require_role("admin"))):
    cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    total = await db.concierge_messages.count_documents({"created_at": {"$gte": cutoff}})
    escalated = await db.concierge_messages.count_documents({"created_at": {"$gte": cutoff}, "escalated": True})
    blocked = await db.concierge_messages.count_documents({"created_at": {"$gte": cutoff}, "blocked": True})
    by_role = {}
    pipeline = [
        {"$match": {"created_at": {"$gte": cutoff}, "role": "user"}},
        {"$group": {"_id": "$user_role", "count": {"$sum": 1}, "sessions": {"$addToSet": "$session_id"}}},
    ]
    async for d in db.concierge_messages.aggregate(pipeline):
        by_role[d["_id"]] = {"messages": d["count"], "sessions": len(d.get("sessions", []))}
    pipeline = [
        {"$match": {"created_at": {"$gte": cutoff}, "blocked": True}},
        {"$group": {"_id": "$user_id", "count": {"$sum": 1}, "role": {"$first": "$user_role"}}},
        {"$sort": {"count": -1}},
        {"$limit": 10},
    ]
    top_abusers = []
    async for d in db.concierge_messages.aggregate(pipeline):
        top_abusers.append({"user_id": d["_id"], "user_role": d.get("role"), "blocks": d["count"]})
    return {
        "window_days": 30,
        "total_messages": total,
        "escalated_count": escalated,
        "blocked_count": blocked,
        "escalation_rate_pct": round((escalated / total * 100), 1) if total else 0,
        "block_rate_pct": round((blocked / total * 100), 1) if total else 0,
        "by_role": by_role,
        "top_abusers": top_abusers,
    }


@admin_router.post("/block-user/{user_id}")
async def block_user(user_id: str, user: dict = Depends(require_role("admin"))):
    settings = await _get_settings()
    blocked = list(settings.get("blocked_users", []))
    if user_id not in blocked:
        blocked.append(user_id)
    await db.concierge_settings.update_one({"_id": "global"}, {"$set": {"blocked_users": blocked}}, upsert=True)
    return {"ok": True, "blocked_users": blocked}


@admin_router.delete("/block-user/{user_id}")
async def unblock_user(user_id: str, user: dict = Depends(require_role("admin"))):
    settings = await _get_settings()
    blocked = [u for u in settings.get("blocked_users", []) if u != user_id]
    await db.concierge_settings.update_one({"_id": "global"}, {"$set": {"blocked_users": blocked}}, upsert=True)
    return {"ok": True, "blocked_users": blocked}
