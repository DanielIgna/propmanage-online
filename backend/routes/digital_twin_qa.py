"""Digital Twin AI Q&A — Phase 2 of AI Ecosystem.

Lets users ask natural-language questions about a Digital Twin project.
The AI receives context built from existing collections:
  - digital_twin_projects (project meta)
  - digital_twin_models (uploaded files: GLB/IFC/SKP)
  - digital_twin_plans (2D floor plans with rooms)
  - digital_twin_pins (annotations: equipment, finishes, etc.)
  - digital_twin_comments (pin discussion threads)

The endpoint stores conversation history in `digital_twin_qa_sessions` and
persists memorable facts to ai_memories (scope=client_agent or admin_agent).

Read-only on twin data — never mutates the project.
"""
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from deps import get_current_user
from db import db
from ai_core.provider import call_llm, ecosystem_enabled
from ai_core import memory as ai_memory

logger = logging.getLogger("propmanage.dt_qa")

router = APIRouter(prefix="/api/digital-twin/qa", tags=["digital-twin-qa"])


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


_SYSTEM = """You are the Digital Twin AI assistant for PropManage — a Romanian property management platform.
You answer in Romanian. You have access to structured data about a specific 3D Digital Twin project
(uploaded models, 2D floor plans, room dimensions, equipment pins, finish materials, comments).

Rules:
- Be concise and factual. If the answer is in the provided context, state it directly with measurements.
- If the context does NOT contain the answer, say "Această informație nu este în Digital Twin-ul curent.
  Adaugă un pin pe modelul 3D pentru această întrebare."
- For room areas, sum the area_m2 fields when relevant. For equipment, mention pin label + room + type.
- Never invent numbers, materials, or brands. Use ONLY what is in the context."""


async def _build_context(project_id: str) -> str:
    """Build a compact context string from twin collections."""
    project = await db.digital_twin_projects.find_one({"id": project_id})
    if not project:
        return ""

    parts = [f"# Project: {project.get('name', 'Untitled')}"]
    if project.get("description"):
        parts.append(f"Description: {project['description']}")
    if project.get("address"):
        parts.append(f"Address: {project['address']}")

    # Models
    models = await db.digital_twin_models.find({"project_id": project_id}, {"name": 1, "kind": 1, "format": 1, "uploaded_at": 1, "_id": 0}).to_list(length=20)
    if models:
        parts.append("\n## 3D Models uploaded")
        for m in models:
            parts.append(f"- {m.get('name')} ({m.get('format', '?')}, {m.get('kind', '?')})")

    # Plans + rooms
    plans = await db.digital_twin_plans.find({"project_id": project_id}).to_list(length=20)
    if plans:
        parts.append("\n## 2D Floor Plans & Rooms")
        for p in plans:
            parts.append(f"### {p.get('name', 'Plan')} (level {p.get('level', '?')})")
            for room in (p.get("rooms") or []):
                area = room.get("area_m2")
                area_str = f"{area} m²" if area else "?"
                parts.append(f"  - {room.get('name', 'Room')}: {area_str}, type={room.get('type', '?')}")

    # Pins (equipment, finishes, electric panel locations, etc.)
    pins = await db.digital_twin_pins.find({"project_id": project_id}).to_list(length=200)
    if pins:
        parts.append(f"\n## Pins / Annotations ({len(pins)})")
        for p in pins[:80]:
            label = p.get("label") or p.get("title") or "Pin"
            ptype = p.get("type") or p.get("category") or "info"
            room = p.get("room_name") or "?"
            details = p.get("description") or p.get("notes") or ""
            parts.append(f"- [{ptype}] {label} (camera: {room}) {details[:120]}")

    return "\n".join(parts)


# ---------- Schemas ----------
class AskIn(BaseModel):
    project_id: str = Field(min_length=3)
    question: str = Field(min_length=2, max_length=1000)
    session_id: Optional[str] = None


# ---------- Endpoints ----------
@router.post("/ask")
async def ask(payload: AskIn, user: dict = Depends(get_current_user)):
    """Answer a question about a Digital Twin project."""
    if not await ecosystem_enabled():
        return {"answer": "Ecosistemul AI este momentan dezactivat din Admin Settings.", "context_size": 0, "session_id": payload.session_id}

    # Authorization: user must own project OR be admin OR be a member
    project = await db.digital_twin_projects.find_one({"id": payload.project_id})
    if not project:
        raise HTTPException(404, "Project not found")

    owner_ok = str(project.get("owner_id")) == str(user.get("id"))
    member_ok = user.get("id") in (project.get("members") or [])
    admin_ok = user.get("role") in ("admin", "operator")
    if not (owner_ok or member_ok or admin_ok):
        raise HTTPException(403, "Access denied to this project")

    context = await _build_context(payload.project_id)
    if not context:
        return {"answer": "Acest proiect Digital Twin nu are încă date. Adaugă modele 3D, planuri 2D sau pin-uri.", "context_size": 0, "session_id": payload.session_id}

    # Inject relevant prior memories
    memories = await ai_memory.recall(user_id=user.get("email") or user["id"], query=payload.question, scope="client_agent", limit=3)
    mem_block = ""
    if memories:
        mem_block = "\n\n## Prior context from your past questions:\n" + "\n".join(f"- {m['summary']}" for m in memories)

    user_message = (
        f"## Digital Twin Context\n{context}{mem_block}\n\n"
        f"## Question\n{payload.question}\n\nReply in Romanian."
    )

    sid = payload.session_id or uuid.uuid4().hex
    result = await call_llm(_SYSTEM, user_message, session_id=f"dt-qa-{sid[:8]}")
    answer = result.get("text") or "Nu am putut răspunde acum. Încearcă din nou peste un minut."
    if result.get("error"):
        logger.warning(f"[dt_qa] LLM error: {result['error']}")

    # Persist conversation turn
    turn = {
        "id": uuid.uuid4().hex,
        "session_id": sid,
        "project_id": payload.project_id,
        "user_id": user.get("id"),
        "user_email": user.get("email"),
        "question": payload.question,
        "answer": answer,
        "ts": _now_iso(),
    }
    try:
        await db.digital_twin_qa_sessions.insert_one(turn)
    except Exception:  # noqa: BLE001
        pass

    # Persist a compact memory of this exchange so future questions get context
    try:
        await ai_memory.remember(
            user_id=user.get("email") or user["id"],
            scope="client_agent",
            content=f"Întrebare DT '{payload.question[:140]}' → răspuns: {answer[:200]}",
            summary=f"DT[{project.get('name', '?')}]: {payload.question[:140]}",
            source=f"dt_qa:{sid}",
        )
    except Exception:  # noqa: BLE001
        pass

    return {"answer": answer, "context_size": len(context), "session_id": sid, "provider": result.get("provider"), "model": result.get("model")}


@router.get("/history")
async def history(project_id: str = Query(min_length=3), limit: int = 30, user: dict = Depends(get_current_user)):
    """Recent Q&A turns for a project (visible to project members)."""
    project = await db.digital_twin_projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(404, "Project not found")
    owner_ok = str(project.get("owner_id")) == str(user.get("id"))
    member_ok = user.get("id") in (project.get("members") or [])
    admin_ok = user.get("role") in ("admin", "operator")
    if not (owner_ok or member_ok or admin_ok):
        raise HTTPException(403, "Access denied")

    cur = db.digital_twin_qa_sessions.find({"project_id": project_id}).sort("ts", -1).limit(int(limit))
    items = []
    async for t in cur:
        t.pop("_id", None)
        items.append(t)
    return {"items": items, "total": len(items)}
