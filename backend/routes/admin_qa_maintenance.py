"""Admin endpoints: cleanup + auto-fix QA artefacts on production.

These tools let admins reset stale documentation overrides and refresh
inconsistency scans without database shell access. Designed for the
post-deploy "release gate is red — fix it" workflow.
"""
from fastapi import APIRouter, Depends

from deps import require_role
from db import db
from qa_terminology_audit import scan_all_docs, persist_inconsistencies

router = APIRouter(prefix="/api/admin/qa/maintenance", tags=["admin-qa-maintenance"])


@router.post("/cleanup-stale-overrides")
async def cleanup_stale_overrides(_: dict = Depends(require_role("admin"))) -> dict:
    """Delete ALL doc_overrides + term_inconsistencies, then rescan inconsistencies.

    Used post-deploy when the docs source of truth (`docs_content.py`) has been
    corrected but the DB still holds stale AI rewrites that put back old terms.
    Idempotent — safe to run repeatedly.
    """
    res_overrides = await db.doc_overrides.delete_many({})
    res_incs = await db.term_inconsistencies.delete_many({})

    # Re-scan so the dashboard reflects the new clean state immediately
    scan = await scan_all_docs()
    persisted = await persist_inconsistencies(scan)

    return {
        "ok": True,
        "deleted_overrides": res_overrides.deleted_count,
        "deleted_inconsistencies": res_incs.deleted_count,
        "new_inconsistencies_found": persisted,
        "by_doc": scan.get("by_doc", {}),
    }


@router.post("/auto-fix-release-gate")
async def auto_fix_release_gate(_: dict = Depends(require_role("admin"))) -> dict:
    """One-click "fix what you can" — runs cleanup then re-runs the release gate."""
    # Step 1+2: cleanup
    res_overrides = await db.doc_overrides.delete_many({})
    res_incs = await db.term_inconsistencies.delete_many({})
    scan = await scan_all_docs()
    persisted = await persist_inconsistencies(scan)

    # Step 3: re-run release gate
    from qa_automation import run_release_gate
    gate = await run_release_gate(triggered_by="auto-fix", email_admins=False)

    return {
        "cleanup": {
            "deleted_overrides": res_overrides.deleted_count,
            "deleted_inconsistencies": res_incs.deleted_count,
            "new_inconsistencies_found": persisted,
        },
        "gate": {
            "verdict": gate["summary"].get("verdict"),
            "pass": gate["summary"].get("pass"),
            "fail": gate["summary"].get("fail"),
            "total": gate["summary"].get("total"),
            "p0_fail": gate["summary"].get("p0_fail"),
            "blocked": gate["summary"].get("blocked"),
            "gate_id": gate.get("gate_id"),
        },
    }
