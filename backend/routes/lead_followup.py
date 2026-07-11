"""Rute admin — follow-up automat lead-uri warm (P2)."""
from fastapi import APIRouter, Body, Depends

from db import db
from deps import require_role
from lead_followup import get_config, run_followup_scan, update_config

router = APIRouter(prefix="/api/admin/leads/followup", tags=["lead-followup"])


@router.get("/config")
async def followup_config(_admin=Depends(require_role("admin"))):
    return await get_config()


@router.put("/config")
async def followup_config_update(patch: dict = Body(...), admin=Depends(require_role("admin"))):
    return await update_config(patch, who=admin.get("email"))


@router.post("/run")
async def followup_run(dry_run: bool = True, _admin=Depends(require_role("admin"))):
    """Rulare manuală. Default dry_run=true (nu trimite emailuri, doar raportează candidații)."""
    return await run_followup_scan(manual=True, dry_run=dry_run)


@router.get("/log")
async def followup_log(limit: int = 50, _admin=Depends(require_role("admin"))):
    items = await db.lead_followup_log.find({}, {"_id": 0}).sort("at", -1).to_list(min(limit, 200))
    return {"items": items, "total": len(items)}
