"""Suggested services — clients propose a service that is missing from the catalog.

Flow:
  - A client who can't find the service they need submits a free-text name.
  - It is saved to a distinct `suggested_services` collection (status=pending),
    optionally linked to the request they just created.
  - Admins review the list and can approve (adds the service to the official
    construction taxonomy), reject, or leave it pending.
  - Duplicates are prevented by a normalized-name key: a new submission for an
    already-pending/approved name is linked to the existing suggestion instead
    of creating a second row (its vote count + linked requests grow).

Collections:
  suggested_services { _id, name, normalized, slug, category_hint, description,
                       status (pending|approved|rejected), suggested_by,
                       request_ids[], votes, created_at, updated_at,
                       reviewed_by, reviewed_at, reject_reason, taxonomy_node_id }
"""
import logging
import re
import unicodedata
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Body, Depends, HTTPException
from pydantic import BaseModel, Field
from pymongo.errors import DuplicateKeyError

from db import db
from deps import get_current_user, require_role

logger = logging.getLogger("propmanage.suggested_services")

router = APIRouter(prefix="/api", tags=["suggested-services"])
admin_router = APIRouter(prefix="/api/admin/suggested-services", tags=["admin-suggested-services"])

ALLOWED_STATUS = {"pending", "approved", "rejected"}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _normalize(name: str) -> str:
    s = unicodedata.normalize("NFKD", name or "").encode("ascii", "ignore").decode("ascii")
    return re.sub(r"\s+", " ", s.strip().lower())


def _slugify(name: str) -> str:
    s = unicodedata.normalize("NFKD", name or "").encode("ascii", "ignore").decode("ascii")
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()
    return s or uuid.uuid4().hex[:8]


def _serialize(d: dict) -> dict:
    if not d:
        return d
    return {
        "id": str(d.get("_id")),
        "name": d.get("name"),
        "normalized": d.get("normalized"),
        "slug": d.get("slug"),
        "category_hint": d.get("category_hint"),
        "description": d.get("description"),
        "status": d.get("status") or "pending",
        "suggested_by": d.get("suggested_by"),
        "request_ids": d.get("request_ids") or [],
        "votes": d.get("votes") or 0,
        "created_at": d.get("created_at"),
        "updated_at": d.get("updated_at"),
        "reviewed_by": d.get("reviewed_by"),
        "reviewed_at": d.get("reviewed_at"),
        "reject_reason": d.get("reject_reason"),
        "taxonomy_node_id": d.get("taxonomy_node_id"),
    }


async def record_suggestion(*, name: str, user_id: str, category_hint: Optional[str] = None,
                            description: Optional[str] = None, request_id: Optional[str] = None) -> Optional[dict]:
    """Idempotent create-or-link. Dedupes by normalized name (prevents duplicates).

    Rejected suggestions are reopened to pending when re-submitted. Returns the
    serialized suggestion, or None when the name is too short.
    """
    name = (name or "").strip()
    if len(name) < 2:
        return None
    normalized = _normalize(name)
    now = _now()
    existing = await db.suggested_services.find_one({"normalized": normalized})
    if existing:
        updates = {"$set": {"updated_at": now}, "$inc": {"votes": 1}}
        if request_id:
            updates["$addToSet"] = {"request_ids": request_id}
        # Re-open a previously rejected suggestion when demand returns.
        if existing.get("status") == "rejected":
            updates["$set"]["status"] = "pending"
            updates["$set"]["reject_reason"] = None
        await db.suggested_services.update_one({"_id": existing["_id"]}, updates)
        return _serialize(await db.suggested_services.find_one({"_id": existing["_id"]}))
    doc = {
        "name": name,
        "normalized": normalized,
        "slug": _slugify(name),
        "category_hint": category_hint,
        "description": (description or None),
        "status": "pending",
        "suggested_by": user_id,
        "request_ids": [request_id] if request_id else [],
        "votes": 1,
        "created_at": now,
        "updated_at": now,
    }
    try:
        res = await db.suggested_services.insert_one(doc)
        doc["_id"] = res.inserted_id
        return _serialize(doc)
    except DuplicateKeyError:
        # Race: another concurrent submit created it first → link to that one.
        again = await db.suggested_services.find_one_and_update(
            {"normalized": normalized},
            {"$set": {"updated_at": now}, "$inc": {"votes": 1},
             **({"$addToSet": {"request_ids": request_id}} if request_id else {})},
            return_document=True,
        )
        return _serialize(again)


class SuggestIn(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    category_hint: Optional[str] = None
    description: Optional[str] = Field(default=None, max_length=600)
    request_id: Optional[str] = None


@router.post("/suggested-services")
async def submit_suggestion(payload: SuggestIn, user=Depends(get_current_user)):
    """Any authenticated user can propose a missing service."""
    out = await record_suggestion(
        name=payload.name, user_id=user["id"], category_hint=payload.category_hint,
        description=payload.description, request_id=payload.request_id,
    )
    if out is None:
        raise HTTPException(400, "Numele serviciului este prea scurt.")
    return out


# ───────────────────────────── ADMIN ─────────────────────────────

@admin_router.get("")
async def list_suggestions(status: Optional[str] = None, user=Depends(require_role("admin"))):
    q = {}
    if status and status in ALLOWED_STATUS:
        q["status"] = status
    cur = db.suggested_services.find(q).sort([("status", 1), ("votes", -1), ("created_at", -1)])
    items = [_serialize(d) async for d in cur]
    counts = {}
    for st in ALLOWED_STATUS:
        counts[st] = await db.suggested_services.count_documents({"status": st})
    return {"items": items, "counts": counts}


class ApproveIn(BaseModel):
    parent_id: Optional[str] = None          # taxonomy node to attach under (depth<=1)
    legacy_category: Optional[str] = None     # used only when creating a new root
    name_override: Optional[str] = None


@admin_router.post("/{sug_id}/approve")
async def approve_suggestion(sug_id: str, payload: ApproveIn = Body(default=ApproveIn()),
                             user=Depends(require_role("admin"))):
    sug = await db.suggested_services.find_one({"_id": _oid(sug_id)})
    if not sug:
        raise HTTPException(404, "Sugestie inexistentă.")
    if sug.get("status") == "approved" and sug.get("taxonomy_node_id"):
        return _serialize(sug)

    # Build the catalog node (reuses the construction taxonomy structure).
    from construction.taxonomy import slugify as tax_slugify, refresh_category_visibility
    name = (payload.name_override or sug.get("name") or "").strip()
    if len(name) < 2:
        raise HTTPException(400, "Nume invalid pentru catalog.")
    parent_id = payload.parent_id
    if parent_id:
        parent = await db.construction_taxonomy.find_one({"id": parent_id})
        if not parent:
            raise HTTPException(404, "Nodul părinte nu există.")
        if parent.get("depth_level", 0) >= 2:
            raise HTTPException(400, "Adâncime maximă 3 niveluri.")
        depth = parent["depth_level"] + 1
        legacy = parent["legacy_category"]
    else:
        depth = 0
        legacy = payload.legacy_category or tax_slugify(name)
    siblings = await db.construction_taxonomy.count_documents({"parent_id": parent_id})
    # Prevent duplicating an existing catalog node under the same parent.
    dup = await db.construction_taxonomy.find_one({"parent_id": parent_id, "slug": tax_slugify(name)})
    if dup:
        await db.suggested_services.update_one(
            {"_id": sug["_id"]},
            {"$set": {"status": "approved", "taxonomy_node_id": dup["id"],
                      "reviewed_by": user.get("email"), "reviewed_at": _now(),
                      "reject_reason": None, "updated_at": _now()}},
        )
        return _serialize(await db.suggested_services.find_one({"_id": sug["_id"]}))
    node = {
        "id": uuid.uuid4().hex,
        "name": name,
        "slug": tax_slugify(name),
        "parent_id": parent_id,
        "depth_level": depth,
        "legacy_category": legacy,
        "is_active": True,
        "is_publicly_visible": False,
        "specialist_count": 0,
        "order": siblings,
        "source": "suggested",
        "suggested_service_id": sug_id,
        "created_at": _now(),
        "updated_at": _now(),
    }
    await db.construction_taxonomy.insert_one({**node})
    await refresh_category_visibility()
    await db.suggested_services.update_one(
        {"_id": sug["_id"]},
        {"$set": {"status": "approved", "taxonomy_node_id": node["id"],
                  "reviewed_by": user.get("email"), "reviewed_at": _now(),
                  "reject_reason": None, "updated_at": _now()}},
    )
    return _serialize(await db.suggested_services.find_one({"_id": sug["_id"]}))


class RejectIn(BaseModel):
    reason: Optional[str] = Field(default=None, max_length=300)


@admin_router.post("/{sug_id}/reject")
async def reject_suggestion(sug_id: str, payload: RejectIn = Body(default=RejectIn()),
                            user=Depends(require_role("admin"))):
    res = await db.suggested_services.find_one_and_update(
        {"_id": _oid(sug_id)},
        {"$set": {"status": "rejected", "reject_reason": payload.reason,
                  "reviewed_by": user.get("email"), "reviewed_at": _now(), "updated_at": _now()}},
        return_document=True,
    )
    if not res:
        raise HTTPException(404, "Sugestie inexistentă.")
    return _serialize(res)


def _oid(s: str):
    from bson import ObjectId
    try:
        return ObjectId(s)
    except Exception:
        raise HTTPException(400, "ID invalid.")
