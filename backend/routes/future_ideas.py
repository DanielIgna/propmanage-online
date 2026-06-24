"""PropManage — Future Ideas Vault API

Read-only catalog of *proposed* development ideas that need explicit business
validation before any code is written. Stores ONLY the validation status and
admin notes per idea — the technical content itself lives in the frontend
catalog (static, version-controlled).

This deliberately does NOT integrate with admin_todos: ideas here are
STRATEGIC PROPOSALS, not tasks. A separate flow is required so admins do not
accidentally promote a proposal to the dev queue.

Collection:
  - future_ideas_status  (one doc per idea_id)
    Includes immutable `decision_log` array for strategic decision history
"""
import logging
from datetime import datetime, timezone
from typing import Optional, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from db import db
from deps import require_role

logger = logging.getLogger("propmanage.future_ideas")
router = APIRouter(prefix="/api/admin/future-ideas", tags=["future-ideas"])

ALLOWED_STATUSES = {"pending_validation", "in_discussion", "approved", "rejected", "on_hold"}
DEFAULT_STATUS = "pending_validation"


class StatusPatch(BaseModel):
    status: Optional[Literal["pending_validation", "in_discussion", "approved", "rejected", "on_hold"]] = None
    notes: Optional[str] = Field(default=None, max_length=4000)
    estimated_cost_eur: Optional[float] = None
    estimated_revenue_eur_monthly: Optional[float] = None
    emergent_credits_used: Optional[float] = None
    emergent_credits_notes: Optional[str] = Field(default=None, max_length=2000)
    # Required ONLY when status actually changes from previous value.
    decision_reason: Optional[str] = Field(default=None, max_length=2000)


def _serialize(doc: dict) -> dict:
    return {
        "idea_id": doc["idea_id"],
        "status": doc.get("status", DEFAULT_STATUS),
        "notes": doc.get("notes", ""),
        "estimated_cost_eur": doc.get("estimated_cost_eur"),
        "estimated_revenue_eur_monthly": doc.get("estimated_revenue_eur_monthly"),
        "emergent_credits_used": doc.get("emergent_credits_used"),
        "emergent_credits_notes": doc.get("emergent_credits_notes", ""),
        "decision_log": doc.get("decision_log", []),
        "updated_at": doc.get("updated_at"),
        "updated_by": doc.get("updated_by"),
    }


@router.get("")
async def list_statuses(user=Depends(require_role("admin"))):
    cursor = db.future_ideas_status.find({})
    out = []
    async for doc in cursor:
        out.append(_serialize(doc))
    return {"items": out}


@router.get("/{idea_id}")
async def get_status(idea_id: str, user=Depends(require_role("admin"))):
    doc = await db.future_ideas_status.find_one({"idea_id": idea_id})
    if not doc:
        return {
            "idea_id": idea_id,
            "status": DEFAULT_STATUS,
            "notes": "",
            "estimated_cost_eur": None,
            "estimated_revenue_eur_monthly": None,
            "emergent_credits_used": None,
            "emergent_credits_notes": "",
            "decision_log": [],
            "updated_at": None,
            "updated_by": None,
        }
    return _serialize(doc)


@router.put("/{idea_id}")
async def update_status(idea_id: str, patch: StatusPatch, user=Depends(require_role("admin"))):
    if patch.status is not None and patch.status not in ALLOWED_STATUSES:
        raise HTTPException(400, "Invalid status")

    actor = user.get("email") or user.get("id")
    now_iso = datetime.now(timezone.utc).isoformat()

    # Load existing to detect status changes
    existing = await db.future_ideas_status.find_one({"idea_id": idea_id})
    prev_status = (existing or {}).get("status", DEFAULT_STATUS)

    update = {"updated_at": now_iso, "updated_by": actor}
    if patch.status is not None:
        update["status"] = patch.status
    if patch.notes is not None:
        update["notes"] = patch.notes
    if patch.estimated_cost_eur is not None:
        update["estimated_cost_eur"] = patch.estimated_cost_eur
    if patch.estimated_revenue_eur_monthly is not None:
        update["estimated_revenue_eur_monthly"] = patch.estimated_revenue_eur_monthly
    if patch.emergent_credits_used is not None:
        update["emergent_credits_used"] = patch.emergent_credits_used
    if patch.emergent_credits_notes is not None:
        update["emergent_credits_notes"] = patch.emergent_credits_notes

    # Detect status change → require reason and append to decision_log
    status_changed = patch.status is not None and patch.status != prev_status
    push_op = {}
    if status_changed:
        if not patch.decision_reason or not patch.decision_reason.strip():
            raise HTTPException(
                400,
                "Schimbarea statusului necesită un motiv (decision_reason). Adaugă o explicație de min. 3 caractere.",
            )
        log_entry = {
            "at": now_iso,
            "by": actor,
            "from_status": prev_status,
            "to_status": patch.status,
            "reason": patch.decision_reason.strip(),
        }
        push_op = {"$push": {"decision_log": log_entry}}

    set_op = {"$set": update, "$setOnInsert": {"idea_id": idea_id, "created_at": now_iso}}
    # Merge $set and $push (Mongo allows both ops in same update; $push auto-creates array if missing)
    combined = {**set_op, **push_op}
    await db.future_ideas_status.update_one({"idea_id": idea_id}, combined, upsert=True)

    doc = await db.future_ideas_status.find_one({"idea_id": idea_id})
    return _serialize(doc)
