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
    add_adhoc_check,
    get_run,
    update_check,
    close_run,
    run_summary,
    ai_suggest_tests,
    render_run_markdown,
)
from qa_automation import list_automated_tests, execute_tests, run_release_gate, list_release_gates, get_release_gate

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


class AddAdhocCheckIn(BaseModel):
    code: str
    priority: str = "P1"
    category: str = "AD-HOC"
    description: str
    subcategory: Optional[str] = "ad-hoc / AI"


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


@router.post("/runs/{run_id}/add-check")
async def add_check_ep(run_id: str, payload: AddAdhocCheckIn, admin=Depends(require_role("admin"))):
    try:
        run = await add_adhoc_check(
            run_id,
            code=payload.code,
            priority=payload.priority,
            category=payload.category,
            description=payload.description,
            subcategory=payload.subcategory or "ad-hoc / AI",
        )
    except ValueError as e:
        raise HTTPException(400, str(e))
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


class AutomateRunIn(BaseModel):
    test_codes: list[str]
    run_id: Optional[str] = None


@router.get("/automation/tests")
async def automation_catalog(admin=Depends(require_role("admin"))):
    return {"tests": list_automated_tests()}


@router.post("/automation/execute")
async def automation_execute(payload: AutomateRunIn, admin=Depends(require_role("admin"))):
    if not payload.test_codes:
        raise HTTPException(400, "test_codes required")
    result = await execute_tests(payload.test_codes, run_id=payload.run_id)
    return result


class ReleaseGateIn(BaseModel):
    email_admins: bool = True


@router.post("/automation/release-gate")
async def automation_release_gate(payload: ReleaseGateIn, admin=Depends(require_role("admin"))):
    triggered_by = admin.get("email") or "unknown-admin"
    result = await run_release_gate(triggered_by=triggered_by, email_admins=payload.email_admins)
    return result


@router.get("/automation/release-gates")
async def release_gates_history(admin=Depends(require_role("admin"))):
    return {"gates": await list_release_gates(limit=20)}


@router.get("/automation/release-gates/{gate_id}")
async def release_gate_detail(gate_id: str, admin=Depends(require_role("admin"))):
    g = await get_release_gate(gate_id)
    if not g:
        raise HTTPException(404, "Gate not found")
    return g
