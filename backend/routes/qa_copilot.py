"""QA Copilot router — AI-assisted manual testing sessions.

Endpoints (all require admin role):
  POST   /api/admin/qa-copilot/sessions               create session
  GET    /api/admin/qa-copilot/sessions               list sessions (newest first)
  GET    /api/admin/qa-copilot/sessions/{id}          one session with findings
  PATCH  /api/admin/qa-copilot/sessions/{id}          update title/goal/area/status
  DELETE /api/admin/qa-copilot/sessions/{id}          delete session
  POST   /api/admin/qa-copilot/sessions/{id}/findings add finding (triggers AI analysis)
  DELETE /api/admin/qa-copilot/sessions/{id}/findings/{fid}  remove a finding
  POST   /api/admin/qa-copilot/sessions/{id}/generate-prompt  build Emergent prompt
"""
import uuid
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional

from deps import require_role
from db import db
from qa_copilot_engine import analyze_finding, generate_emergent_prompt

logger = logging.getLogger("propmanage.qa_copilot")

router = APIRouter(prefix="/api/admin/qa-copilot", tags=["admin-qa-copilot"])


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _serialize(doc: dict) -> dict:
    if not doc:
        return doc
    doc = dict(doc)
    doc.pop("_id", None)
    return doc


# ---- Schemas ----
class SessionCreate(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    goal: str = Field(default="", max_length=2000)
    role_being_tested: str = Field(default="client", max_length=40)
    area: str = Field(default="", max_length=200)


class SessionPatch(BaseModel):
    title: Optional[str] = None
    goal: Optional[str] = None
    role_being_tested: Optional[str] = None
    area: Optional[str] = None
    status: Optional[str] = None  # active / closed


class FindingCreate(BaseModel):
    text: str = Field(min_length=3, max_length=4000)
    screenshot_url: Optional[str] = Field(default=None, max_length=4000)


# ---- Endpoints ----
@router.post("/sessions")
async def create_session(payload: SessionCreate, admin=Depends(require_role("admin"))):
    
    sid = uuid.uuid4().hex
    doc = {
        "id": sid,
        "title": payload.title.strip(),
        "goal": payload.goal.strip(),
        "role_being_tested": payload.role_being_tested.strip().lower(),
        "area": payload.area.strip(),
        "status": "active",
        "findings": [],
        "generated_prompt": None,
        "owner_email": admin.get("email"),
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
    }
    await db.qa_sessions.insert_one(doc)
    return _serialize(doc)


@router.get("/sessions")
async def list_sessions(limit: int = 50, admin=Depends(require_role("admin"))):
    
    cur = db.qa_sessions.find({}, {"findings": 0, "generated_prompt": 0}).sort("created_at", -1).limit(int(limit))
    items = [_serialize(d) async for d in cur]
    # Add finding counts via second pass (keep light)
    if items:
        ids = [i["id"] for i in items]
        counts_cur = db.qa_sessions.aggregate([
            {"$match": {"id": {"$in": ids}}},
            {"$project": {"id": 1, "count": {"$size": {"$ifNull": ["$findings", []]}}}},
        ])
        counts = {c["id"]: c["count"] async for c in counts_cur}
        for it in items:
            it["finding_count"] = counts.get(it["id"], 0)
    return {"items": items, "total": len(items)}


@router.get("/sessions/{sid}")
async def get_session(sid: str, admin=Depends(require_role("admin"))):
    
    doc = await db.qa_sessions.find_one({"id": sid})
    if not doc:
        raise HTTPException(404, "Session not found")
    return _serialize(doc)


@router.patch("/sessions/{sid}")
async def patch_session(sid: str, payload: SessionPatch, admin=Depends(require_role("admin"))):
    
    update = {k: v for k, v in payload.model_dump(exclude_none=True).items()}
    if not update:
        raise HTTPException(400, "No fields to update")
    if "status" in update and update["status"] not in ("active", "closed"):
        raise HTTPException(400, "Invalid status")
    update["updated_at"] = _now_iso()
    res = await db.qa_sessions.update_one({"id": sid}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(404, "Session not found")
    doc = await db.qa_sessions.find_one({"id": sid})
    return _serialize(doc)


@router.delete("/sessions/{sid}")
async def delete_session(sid: str, admin=Depends(require_role("admin"))):
    
    res = await db.qa_sessions.delete_one({"id": sid})
    if res.deleted_count == 0:
        raise HTTPException(404, "Session not found")
    return {"deleted": True}


@router.post("/sessions/{sid}/findings")
async def add_finding(sid: str, payload: FindingCreate, admin=Depends(require_role("admin"))):
    
    session = await db.qa_sessions.find_one({"id": sid})
    if not session:
        raise HTTPException(404, "Session not found")

    # Build prior_findings context: current session findings + most recent 10 across all sessions
    prior_local = [
        {"id": f["id"], "text": f.get("text", ""), "summary": (f.get("ai_analysis") or {}).get("summary", "")}
        for f in (session.get("findings") or [])
    ]
    other_cur = db.qa_sessions.aggregate([
        {"$match": {"id": {"$ne": sid}}},
        {"$unwind": "$findings"},
        {"$sort": {"findings.ts": -1}},
        {"$limit": 10},
        {"$project": {
            "_id": 0,
            "id": "$findings.id",
            "text": "$findings.text",
            "summary": "$findings.ai_analysis.summary",
        }},
    ])
    prior_other = [d async for d in other_cur]
    prior_findings = prior_local + prior_other

    fid = uuid.uuid4().hex[:12]
    analysis = await analyze_finding(
        payload.text,
        role=session.get("role_being_tested", "client"),
        area=session.get("area", ""),
        prior_findings=prior_findings,
    )

    finding = {
        "id": fid,
        "ts": _now_iso(),
        "text": payload.text.strip(),
        "screenshot_url": payload.screenshot_url,
        "ai_analysis": analysis,
    }
    await db.qa_sessions.update_one(
        {"id": sid},
        {"$push": {"findings": finding}, "$set": {"updated_at": _now_iso()}},
    )
    return finding


@router.delete("/sessions/{sid}/findings/{fid}")
async def delete_finding(sid: str, fid: str, admin=Depends(require_role("admin"))):
    
    res = await db.qa_sessions.update_one(
        {"id": sid},
        {"$pull": {"findings": {"id": fid}}, "$set": {"updated_at": _now_iso()}},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Session not found")
    return {"deleted": True}


@router.post("/sessions/{sid}/generate-prompt")
async def generate_prompt(sid: str, admin=Depends(require_role("admin"))):
    
    session = await db.qa_sessions.find_one({"id": sid})
    if not session:
        raise HTTPException(404, "Session not found")
    result = await generate_emergent_prompt(session)
    if "error" in result:
        raise HTTPException(503, result["error"])
    prompt_text = result["prompt"]
    await db.qa_sessions.update_one(
        {"id": sid},
        {"$set": {"generated_prompt": prompt_text, "generated_at": _now_iso(), "updated_at": _now_iso()}},
    )
    return {"prompt": prompt_text, "provider": result.get("provider")}
