"""Admin endpoints for Terminology Audit."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from deps import require_role
from qa_terminology_audit import (
    seed_clusters_if_empty, list_clusters, scan_all_docs,
    persist_inconsistencies, list_inconsistencies, update_status,
    ai_suggest_fix, apply_fix, ai_discover_clusters, add_cluster,
)

router = APIRouter(prefix="/api/admin/qa/term-audit", tags=["admin-term-audit"])


class StatusIn(BaseModel):
    status: str


class ApplyIn(BaseModel):
    custom_body: Optional[str] = None
    custom_title: Optional[str] = None


class AIFixIn(BaseModel):
    occurrence_index: int = 0


class AddClusterIn(BaseModel):
    key: str
    canonical: str
    variants: list[str]
    description: Optional[str] = ""


@router.get("/clusters")
async def clusters(admin=Depends(require_role("admin"))):
    await seed_clusters_if_empty()
    return {"clusters": await list_clusters()}


@router.post("/clusters")
async def add_one(payload: AddClusterIn, admin=Depends(require_role("admin"))):
    res = await add_cluster(payload.key, payload.canonical, payload.variants, payload.description or "")
    if res.get("error"):
        raise HTTPException(400, res["error"])
    return res


@router.post("/scan")
async def scan(admin=Depends(require_role("admin"))):
    report = await scan_all_docs()
    persisted = await persist_inconsistencies(report)
    return {"report": report, "persisted": persisted}


@router.get("/inconsistencies")
async def list_all(status: Optional[str] = None, admin=Depends(require_role("admin"))):
    rows = await list_inconsistencies(status)
    return {"inconsistencies": rows, "total": len(rows)}


@router.patch("/inconsistencies/{inc_id}/status")
async def patch_status(inc_id: str, payload: StatusIn, admin=Depends(require_role("admin"))):
    actor = admin.get("email") or "unknown-admin"
    try:
        row = await update_status(inc_id, payload.status, actor)
    except ValueError as e:
        raise HTTPException(400, str(e))
    if not row:
        raise HTTPException(404, "Not found")
    return {"inconsistency": row}


@router.post("/inconsistencies/{inc_id}/ai-fix")
async def ai_fix(inc_id: str, payload: AIFixIn, admin=Depends(require_role("admin"))):
    return await ai_suggest_fix(inc_id, occurrence_index=payload.occurrence_index)


@router.post("/inconsistencies/{inc_id}/apply")
async def apply(inc_id: str, payload: ApplyIn, admin=Depends(require_role("admin"))):
    actor = admin.get("email") or "unknown-admin"
    result = await apply_fix(inc_id, actor, custom_body=payload.custom_body, custom_title=payload.custom_title)
    if result.get("error"):
        raise HTTPException(400, result["error"])
    return result


@router.post("/discover")
async def discover(admin=Depends(require_role("admin"))):
    return await ai_discover_clusters()
