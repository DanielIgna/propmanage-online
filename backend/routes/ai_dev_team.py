"""AI Dev Team router — READ-ONLY code analysis endpoints."""
import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional

from deps import require_role
from ai_core.dev_team import analyze_file, list_available_files, agents_meta

logger = logging.getLogger("propmanage.ai_dev_team_route")

router = APIRouter(prefix="/api/admin/ai-dev-team", tags=["admin-ai-dev-team"])


class AnalyzeIn(BaseModel):
    file: str = Field(min_length=3, max_length=400)
    agent: str = Field(default="auto")


@router.get("/agents")
async def get_agents(admin=Depends(require_role("admin"))):
    return {"agents": agents_meta()}


@router.get("/files")
async def get_files(kind: Optional[str] = Query(default=None, regex="^(frontend|backend)?$"), admin=Depends(require_role("admin"))):
    files = list_available_files(filter_kind=kind)
    return {"files": files, "total": len(files)}


@router.post("/analyze")
async def analyze(payload: AnalyzeIn, admin=Depends(require_role("admin"))):
    result = await analyze_file(payload.file, agent=payload.agent)
    if "error" in result and "summary" not in result:
        raise HTTPException(400, result["error"])
    return result
