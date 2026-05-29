"""Admin endpoints for Content Audit (doc conflicts + AI-suggested fixes + overrides)."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from deps import require_role
from qa_content_audit import (
    audit_all_docs, persist_conflicts, list_conflicts,
    update_conflict_status, ai_suggest_fix, apply_fix,
)

router = APIRouter(prefix="/api/admin/qa/content-audit", tags=["admin-content-audit"])


class StatusIn(BaseModel):
    status: str  # open | approved | dismissed | fixed


class ApplyFixIn(BaseModel):
    custom_body: Optional[str] = None
    custom_title: Optional[str] = None


@router.post("/scan")
async def scan_all_docs(admin=Depends(require_role("admin"))):
    """Run the audit on every doc, persist any new conflicts, return summary."""
    conflicts = audit_all_docs()
    persisted = await persist_conflicts(conflicts)
    return {"detected": len(conflicts), **persisted}


@router.get("/conflicts")
async def list_all_conflicts(status: Optional[str] = None, admin=Depends(require_role("admin"))):
    rows = await list_conflicts(status)
    return {"conflicts": rows, "total": len(rows)}


@router.patch("/conflicts/{cid}/status")
async def patch_status(cid: str, payload: StatusIn, admin=Depends(require_role("admin"))):
    actor = admin.get("email") or "unknown-admin"
    try:
        row = await update_conflict_status(cid, payload.status, actor)
    except ValueError as e:
        raise HTTPException(400, str(e))
    if not row:
        raise HTTPException(404, "Conflict not found")
    return {"conflict": row}


@router.post("/conflicts/{cid}/ai-fix")
async def ai_fix(cid: str, admin=Depends(require_role("admin"))):
    return await ai_suggest_fix(cid)


@router.post("/conflicts/{cid}/apply")
async def apply(cid: str, payload: ApplyFixIn, admin=Depends(require_role("admin"))):
    actor = admin.get("email") or "unknown-admin"
    result = await apply_fix(cid, actor, custom_body=payload.custom_body, custom_title=payload.custom_title)
    if result.get("error"):
        raise HTTPException(400, result["error"])
    return result
