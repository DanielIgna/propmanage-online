"""PropManage — Admin ToDo Board API

Persists custom admin todos + tracks which documented (read-only) todos
have been marked as done. Separate from QA Copilot findings.

Collections:
  - admin_todos       (custom todos)
  - admin_todo_state  (singleton _id="config" with doc_done_ids list)
"""
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Body, HTTPException
from pydantic import BaseModel, Field

from db import db
from deps import require_role

logger = logging.getLogger("propmanage.admin_todos")
router = APIRouter(prefix="/api/admin/todos", tags=["admin-todos"])

ALLOWED_PRIORITIES = {"high", "medium", "low"}


class TodoIn(BaseModel):
    text: str = Field(min_length=2, max_length=500)
    priority: str = Field(default="medium")


class TodoPatch(BaseModel):
    text: Optional[str] = Field(default=None, max_length=500)
    priority: Optional[str] = None
    done: Optional[bool] = None


@router.get("")
async def list_todos(user=Depends(require_role("admin"))):
    cursor = db.admin_todos.find({}, {"_id": 0}).sort([("done", 1), ("created_at", -1)]).limit(500)
    items = [d async for d in cursor]
    state = await db.admin_todo_state.find_one({"_id": "config"}) or {}
    doc_done_ids = list(state.get("doc_done_ids") or [])
    return {"items": items, "doc_done_ids": doc_done_ids}


@router.post("")
async def create_todo(payload: TodoIn, user=Depends(require_role("admin"))):
    if payload.priority not in ALLOWED_PRIORITIES:
        raise HTTPException(400, "priority must be high/medium/low")
    doc = {
        "id": str(uuid.uuid4()),
        "text": payload.text.strip(),
        "priority": payload.priority,
        "done": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user["id"],
    }
    await db.admin_todos.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.put("/{todo_id}")
async def update_todo(todo_id: str, payload: TodoPatch, user=Depends(require_role("admin"))):
    update = {}
    if payload.text is not None:
        text = payload.text.strip()
        if len(text) < 2:
            raise HTTPException(400, "text too short")
        update["text"] = text
    if payload.priority is not None:
        if payload.priority not in ALLOWED_PRIORITIES:
            raise HTTPException(400, "priority must be high/medium/low")
        update["priority"] = payload.priority
    if payload.done is not None:
        update["done"] = bool(payload.done)
        if payload.done:
            update["done_at"] = datetime.now(timezone.utc).isoformat()
        # On un-toggle, clear done_at instead of setting it to None
    if not update and payload.done is not False:
        raise HTTPException(400, "Nothing to update")
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    mongo_op = {"$set": update}
    if payload.done is False:
        mongo_op["$unset"] = {"done_at": ""}
    res = await db.admin_todos.find_one_and_update(
        {"id": todo_id}, mongo_op, projection={"_id": 0}, return_document=True,
    )
    if not res:
        raise HTTPException(404, "Todo not found")
    return res


@router.delete("/{todo_id}")
async def delete_todo(todo_id: str, user=Depends(require_role("admin"))):
    res = await db.admin_todos.delete_one({"id": todo_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Todo not found")
    return {"deleted": True}


@router.post("/doc-done")
async def toggle_doc_done(payload: dict = Body(...), user=Depends(require_role("admin"))):
    """Mark/unmark a documented (read-only) todo as done.

    Body: {id: "doc:topic-id:i", action: "mark" | "unmark"}
    The id format must start with "doc:" — anything else is rejected.
    """
    todo_id = (payload.get("id") or "").strip()
    action = payload.get("action") or "mark"
    if not todo_id.startswith("doc:"):
        raise HTTPException(400, "id must start with 'doc:'")
    if action not in ("mark", "unmark"):
        raise HTTPException(400, "action must be mark|unmark")
    op = "$addToSet" if action == "mark" else "$pull"
    await db.admin_todo_state.update_one(
        {"_id": "config"}, {op: {"doc_done_ids": todo_id}}, upsert=True,
    )
    state = await db.admin_todo_state.find_one({"_id": "config"}) or {}
    return {"doc_done_ids": list(state.get("doc_done_ids") or [])}


@router.post("/generate-prompt")
async def generate_emergent_prompt(payload: dict = Body(...), user=Depends(require_role("admin"))):
    """Generate a structured Emergent agent prompt for a single TODO item.

    Body: {
      text: str (required) — the TODO text,
      topic_title: str (optional) — parent module from documentation,
      priority: str (optional) — "high"|"medium"|"low"
    }
    Returns: {prompt: str, model, provider}
    """
    from ai_core.provider import call_llm

    text = (payload.get("text") or "").strip()
    if len(text) < 3:
        raise HTTPException(400, "text too short")
    topic = (payload.get("topic_title") or "").strip()
    priority = (payload.get("priority") or "medium").strip()

    system = (
        "You are a senior engineering manager at PropManage (FastAPI + React + MongoDB stack). "
        "Given a TODO item from the admin documentation, generate a CONCISE structured prompt "
        "(in Romanian) that the user can paste directly into the Emergent coding agent to implement it. "
        "Output exactly these markdown sections in order:\n"
        "1. **Obiectiv** — 1 propoziție clară\n"
        "2. **Fișiere suspecte** — 3-6 path-uri concrete din /app/backend sau /app/frontend (folosește bun simț tehnic; "
        "pentru ToDo/auto-match menționează routes/admin.py, pages/admin/AdminTodoBoard.jsx; "
        "pentru autonomy menționează backend/autonomy/, frontend AutonomyEnginePage.jsx; etc.)\n"
        "3. **Pași concreți** — 3-5 pași numerotați, fiecare implementabil\n"
        "4. **Criterii de validare** — 2-3 condiții clare cum testează agentul că merge\n"
        "5. **Risc** — o singură propoziție: ce poate sparge\n\n"
        "Reguli: maxim 400 cuvinte total · NU adăuga preambul · NU pune cod · folosește doar verbe acționabile."
    )
    user_msg = (
        f"## Modul: {topic or 'Necunoscut'}\n"
        f"## Prioritate: {priority}\n"
        f"## TODO\n{text}"
    )
    res = await call_llm(system, user_msg, session_id=f"todo-prompt-{uuid.uuid4().hex[:6]}")
    prompt = res.get("text") or ""
    if not prompt:
        # Fallback determinist
        prompt = (
            f"## Obiectiv\nImplementează: {text}\n\n"
            f"## Fișiere suspecte\n- (verifică manual pe baza modulului '{topic or 'necunoscut'}')\n\n"
            f"## Pași concreți\n1. Identifică fișierele relevante\n2. Implementează modificarea minimă\n"
            f"3. Adaugă data-testids dacă e UI\n4. Rulează testing_agent_v3_fork\n\n"
            f"## Criterii de validare\n- Funcționează end-to-end\n- Niciun regression\n\n"
            f"## Risc\nModificarea ar putea afecta module conexe — testează cu atenție."
        )
    return {"prompt": prompt, "model": res.get("model"), "provider": res.get("provider")}
