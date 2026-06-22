"""Twin Orchestrator AI Agent — natural-language Q&A about the platform itself.

Super-admin only. Gathers platform context (autonomy scores, recent autopilot
runs, audit log, alerts, KPIs) and feeds it as system prompt to Claude
Sonnet 4.5, which answers the admin's question.

Endpoint:
    POST /api/admin/twin/ask  { question: str, session_id?: str }

The Twin has read-only access to MongoDB collections via a curated context
bundle — no tool calling, no writes.
"""
import logging
import os
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from db import db
from deps import require_role
from sub_admin_deps import is_super_admin

logger = logging.getLogger("propmanage.twin")

router = APIRouter(prefix="/api/admin/twin", tags=["twin-orchestrator"])

MODEL_NAME = "claude-sonnet-4-5-20250929"
MAX_CONTEXT_ITEMS = 8  # cap recent rows per collection to keep prompt sane


class AskRequest(BaseModel):
    question: str = Field(..., min_length=2, max_length=600)
    session_id: Optional[str] = None


async def _gather_platform_context() -> dict:
    """Snapshot of the platform state for the AI prompt."""
    ctx = {"now": datetime.now(timezone.utc).isoformat()}

    # Latest autonomy snapshot
    snap = await db.autonomy_snapshots.find_one({}, sort=[("timestamp", -1)])
    if snap:
        ctx["latest_autonomy"] = {
            "timestamp": snap.get("timestamp"),
            "tier": snap.get("tier"),
            "scores": snap.get("scores"),
            "breakdown_summary": snap.get("breakdown_summary"),
            "recommendations_count": snap.get("recommendations_count"),
        }

    # Last 5 autonomy snapshots (trend)
    trend = []
    async for s in db.autonomy_snapshots.find({}, {"_id": 0, "timestamp": 1, "tier": 1, "scores": 1}).sort("timestamp", -1).limit(5):
        trend.append(s)
    ctx["autonomy_trend_5d"] = list(reversed(trend))

    # Recent autopilot runs
    runs = []
    async for r in db.autopilot_runs.find({}, {"_id": 0}).sort("ran_at", -1).limit(MAX_CONTEXT_ITEMS):
        runs.append(r)
    ctx["recent_autopilot_runs"] = runs

    # Recent tier alerts
    alerts = []
    async for a in db.autonomy_alerts.find({}, {"_id": 0}).sort("sent_at", -1).limit(5):
        alerts.append(a)
    ctx["recent_tier_alerts"] = alerts

    # Admin actions today (counts by outcome)
    today_iso = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    allowed = await db.admin_actions_log.count_documents({"ts": {"$gte": today_iso}, "outcome": "allowed"})
    denied = await db.admin_actions_log.count_documents({"ts": {"$gte": today_iso}, "outcome": "denied"})
    ctx["admin_actions_24h"] = {"allowed": allowed, "denied": denied}

    # Top admins by activity (last 24h)
    top_actors = []
    pipeline = [
        {"$match": {"ts": {"$gte": today_iso}}},
        {"$group": {"_id": "$user_email", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 5},
    ]
    async for d in db.admin_actions_log.aggregate(pipeline):
        if d.get("_id"):
            top_actors.append({"email": d["_id"], "actions_24h": d["count"]})
    ctx["top_admins_24h"] = top_actors

    # AI Health latest
    today = datetime.now(timezone.utc).date().isoformat()
    h = await db.admin_ai_health_history.find_one({"day": today}, {"_id": 0})
    if h:
        ctx["ai_health_today"] = h

    # Counts overview
    try:
        ctx["counts"] = {
            "users_total": await db.users.count_documents({}),
            "requests_total": await db.requests.count_documents({}),
            "kyc_pending": await db.kyc_documents.count_documents({"status": "pending"}),
            "open_ai_findings": await db.admin_ai_findings.count_documents({"status": "open"}),
        }
    except Exception:  # noqa: BLE001
        ctx["counts"] = {}

    return ctx


def _build_system_prompt(ctx: dict) -> str:
    import json as _json
    ctx_str = _json.dumps(ctx, default=str, indent=2)[:9000]  # cap to avoid huge prompts
    return (
        "You are Twin, the AI orchestrator for PropManage — an AI-assisted "
        "property management platform for Romania. You answer admin questions "
        "about the platform's state, scores, recent actions, and trends.\n\n"
        "RULES:\n"
        "- Respond in ROMANIAN (the user is Romanian).\n"
        "- Be concise — 2-5 sentences typical. Use bullets only when listing.\n"
        "- Use specific numbers from the context (tier, scores, counts).\n"
        "- If the answer requires data NOT in the context, say so honestly and suggest where to look (which admin page).\n"
        "- Never make up numbers. If the context shows ai_health.overall=91, say 91 — not 'around 90'.\n"
        "- For 'why' questions, look at autonomy_trend_5d and recent_autopilot_runs to explain causes.\n"
        "- For 'what should I do' questions, suggest concrete actions (Auto-Tune, Boost DEV, etc.).\n"
        "- You have READ-ONLY context. You cannot execute actions.\n\n"
        f"CURRENT PLATFORM CONTEXT (JSON snapshot):\n{ctx_str}\n"
    )


@router.post("/ask")
async def twin_ask(payload: AskRequest, user=Depends(require_role("admin"))):
    """Ask the Twin Orchestrator a question about the platform.

    Super-admin only. The Twin reads the live platform state and answers in
    natural Romanian using Claude Sonnet 4.5.
    """
    if not is_super_admin(user):
        raise HTTPException(403, "Doar super-admin poate folosi Twin Orchestrator.")

    key = os.environ.get("EMERGENT_LLM_KEY")
    if not key:
        raise HTTPException(500, "EMERGENT_LLM_KEY lipsește din environment.")

    session_id = payload.session_id or f"twin-{user['id']}-{uuid.uuid4().hex[:8]}"

    try:
        ctx = await _gather_platform_context()
        system_prompt = _build_system_prompt(ctx)

        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=key,
            session_id=session_id,
            system_message=system_prompt,
        ).with_model("anthropic", MODEL_NAME)
        answer = await chat.send_message(UserMessage(text=payload.question))

        # Persist Q&A for audit + future analysis
        await db.twin_conversations.insert_one({
            "id": uuid.uuid4().hex,
            "session_id": session_id,
            "user_id": user["id"],
            "user_email": user.get("email"),
            "question": payload.question,
            "answer": (answer or "")[:4000],
            "model": MODEL_NAME,
            "asked_at": datetime.now(timezone.utc).isoformat(),
        })

        return {
            "ok": True,
            "session_id": session_id,
            "answer": answer or "(Răspuns gol — încearcă o reformulare a întrebării.)",
            "context_keys": list(ctx.keys()),
        }
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        logger.exception(f"[twin.ask] failed: {e}")
        raise HTTPException(500, f"Eroare Twin: {str(e)[:200]}")


@router.get("/history")
async def twin_history(
    session_id: Optional[str] = None,
    limit: int = 30,
    user=Depends(require_role("admin")),
):
    """Recent Q&A pairs. Optionally filter by session_id."""
    q = {"user_id": user["id"]}
    if session_id:
        q["session_id"] = session_id
    cursor = db.twin_conversations.find(q, {"_id": 0}).sort("asked_at", -1).limit(min(limit, 100))
    items = [d async for d in cursor]
    return {"items": list(reversed(items)), "count": len(items)}
