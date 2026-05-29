"""Admin QA Playbook router — interactive checklist + AI test suggester."""
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from typing import Optional

from deps import require_role
from qa_playbook import (
    build_checklist_template,
    checklist_stats,
    create_run,
    list_runs,
    get_run,
    update_check,
    close_run,
    run_summary,
    ai_suggest_tests,
    render_run_markdown,
)

router = APIRouter(prefix="/api/admin/qa", tags=["admin-qa"])


# ---- Models ----
class CreateRunIn(BaseModel):
    name: Optional[str] = ""
    version: Optional[str] = ""


class UpdateCheckIn(BaseModel):
    status: str  # pending | pass | fail | skip
    note: Optional[str] = ""


class AISuggestIn(BaseModel):
    feature: str
    context: Optional[str] = None


# ---- Routes ----
@router.get("/checklist/template")
async def checklist_template(admin=Depends(require_role("admin"))):
    items = build_checklist_template()
    return {"items": items, "stats": checklist_stats(items)}


@router.get("/runs")
async def runs(admin=Depends(require_role("admin"))):
    return {"runs": await list_runs()}


@router.post("/runs")
async def create_run_ep(payload: CreateRunIn, admin=Depends(require_role("admin"))):
    run = await create_run(payload.name or "", str(admin.get("_id") or admin.get("id") or ""), payload.version or "")
    return {"run": run, "summary": run_summary(run)}


@router.get("/runs/{run_id}")
async def fetch_run(run_id: str, admin=Depends(require_role("admin"))):
    run = await get_run(run_id)
    if not run:
        raise HTTPException(404, "Run not found")
    return {"run": run, "summary": run_summary(run)}


@router.patch("/runs/{run_id}/check/{check_id}")
async def patch_check(run_id: str, check_id: str, payload: UpdateCheckIn, admin=Depends(require_role("admin"))):
    try:
        run = await update_check(
            run_id, check_id,
            status=payload.status,
            note=payload.note or "",
            actor=str(admin.get("_id") or admin.get("id") or "")
        )
    except ValueError as e:
        raise HTTPException(400, str(e))
    if not run:
        raise HTTPException(404, "Run or check not found")
    return {"run": run, "summary": run_summary(run)}


@router.post("/runs/{run_id}/close")
async def close_run_ep(run_id: str, admin=Depends(require_role("admin"))):
    run = await close_run(run_id)
    if not run:
        raise HTTPException(404, "Run not found")
    return {"run": run, "summary": run_summary(run)}


@router.get("/runs/{run_id}/markdown")
async def markdown_export(run_id: str, admin=Depends(require_role("admin"))):
    run = await get_run(run_id)
    if not run:
        raise HTTPException(404, "Run not found")
    md = render_run_markdown(run)
    return Response(
        content=md,
        media_type="text/markdown; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="qa-run-{run_id[:8]}.md"'},
    )


@router.post("/ai-suggest")
async def ai_suggest(payload: AISuggestIn, admin=Depends(require_role("admin"))):
    result = await ai_suggest_tests(payload.feature, payload.context)
    return result
