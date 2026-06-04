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
        update["done_at"] = datetime.now(timezone.utc).isoformat() if payload.done else None
    if not update:
        raise HTTPException(400, "Nothing to update")
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    res = await db.admin_todos.find_one_and_update(
        {"id": todo_id}, {"$set": update}, projection={"_id": 0}, return_document=True,
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
