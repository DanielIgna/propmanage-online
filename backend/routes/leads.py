"""Leads unificate — single view of lead (Sprint 2 · 2.1)."""
from fastapi import APIRouter, Depends

import leads_store
from deps import require_role

router = APIRouter(prefix="/api/admin/leads", tags=["leads"])


@router.get("")
async def unified_leads(source: str = None, stage: str = None, segment: str = None, limit: int = 200,
                        _admin=Depends(require_role("admin"))):
    return {"leads": await leads_store.list_leads(source, stage, segment, min(limit, 500)),
            "sources": list(leads_store.LEGACY_SOURCES.keys())}


@router.get("/summary")
async def leads_summary(days: int = 30, _admin=Depends(require_role("admin"))):
    return await leads_store.summary(days)


@router.post("/migrate")
async def run_migration(_admin=Depends(require_role("admin"))):
    return {"ok": True, "migrated": await leads_store.migrate_all()}
