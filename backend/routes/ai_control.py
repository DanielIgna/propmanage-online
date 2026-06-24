"""Admin AI Control Center router.

Endpoints (all require admin role):
  GET    /api/admin/ai-control/config              live AI config (provider, model, enabled)
  PUT    /api/admin/ai-control/config              update config (saves to app_settings.ai_ecosystem)
  GET    /api/admin/ai-control/providers           list of supported providers + models
  GET    /api/admin/ai-control/overview            unified dashboard data
  GET    /api/admin/ai-control/memories            list memories (filter by user_id or scope)
  DELETE /api/admin/ai-control/memories/{id}       delete single memory
  POST   /api/admin/ai-control/memories/reset      reset memories for a user (or all if user_id=*)
  GET    /api/admin/ai-control/bugs/search?q=...   bug memory search
  GET    /api/admin/ai-control/graph?user_id=...   knowledge graph for user
"""
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional

from deps import require_role
from db import db

from ai_core import memory as mem_engine
from ai_core import bug_memory as bug_engine
from ai_core import knowledge_graph as kg_engine
from ai_core.provider import PROVIDERS, get_ai_config

logger = logging.getLogger("propmanage.ai_control")

router = APIRouter(prefix="/api/admin/ai-control", tags=["admin-ai-control"])


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


class AIConfigUpdate(BaseModel):
    enabled: Optional[bool] = None
    provider: Optional[str] = None
    model: Optional[str] = None
    temperature: Optional[float] = Field(default=None, ge=0.0, le=2.0)
    max_tokens: Optional[int] = Field(default=None, ge=128, le=8192)


@router.get("/config")
async def get_config(admin=Depends(require_role("admin"))):
    return await get_ai_config()


@router.put("/config")
async def update_config(payload: AIConfigUpdate, admin=Depends(require_role("admin"))):
    update_fields = {k: v for k, v in payload.model_dump(exclude_none=True).items()}
    if not update_fields:
        raise HTTPException(400, "No fields provided")
    if update_fields.get("provider") and update_fields["provider"] not in PROVIDERS:
        raise HTTPException(400, f"Unknown provider. Allowed: {list(PROVIDERS.keys())}")
    if update_fields.get("provider") and not PROVIDERS[update_fields["provider"]].get("active"):
        raise HTTPException(400, f"Provider '{update_fields['provider']}' is not active yet (Phase 5)")

    set_doc = {f"ai_ecosystem.{k}": v for k, v in update_fields.items()}
    set_doc["ai_ecosystem.updated_at"] = _now_iso()
    set_doc["ai_ecosystem.updated_by"] = admin.get("email")
    await db.app_settings.update_one(
        {"_id": "app_settings"},
        {"$set": set_doc},
        upsert=True,
    )
    return await get_ai_config()


@router.get("/providers")
async def list_providers(admin=Depends(require_role("admin"))):
    return {"providers": PROVIDERS}


@router.get("/overview")
async def overview(admin=Depends(require_role("admin"))):
    cfg = await get_ai_config()
    mem_stats = await mem_engine.stats()
    bug_stats = await bug_engine.stats()
    graph_stats = await kg_engine.overview()

    # Active agents inventory — purely informational; legacy modules are tracked separately.
    agents = [
        {"id": "concierge", "label": "AI Concierge", "status": "active", "path": "/concierge", "kind": "legacy"},
        {"id": "ai_investigator", "label": "AI Investigator (Guardian)", "status": "active", "path": "/admin/ai", "kind": "legacy"},
        {"id": "qa_copilot", "label": "QA Copilot", "status": "active", "path": "/admin/qa-copilot", "kind": "phase69"},
        {"id": "memory_engine", "label": "Cross-session Memory", "status": "active" if cfg.get("enabled") else "disabled", "path": "/admin/ai-control", "kind": "phase70"},
        {"id": "bug_memory", "label": "Bug Memory Search", "status": "active", "path": "/admin/ai-control", "kind": "phase70"},
        {"id": "knowledge_graph", "label": "Knowledge Graph", "status": "active", "path": "/admin/ai-control", "kind": "phase70"},
    ]

    return {
        "config": cfg,
        "memory": mem_stats,
        "bugs": bug_stats,
        "graph": graph_stats,
        "agents": agents,
        "providers": PROVIDERS,
    }


@router.get("/memories")
async def list_memories(
    user_id: Optional[str] = Query(default=None),
    scope: Optional[str] = Query(default=None),
    limit: int = Query(default=50, le=200),
    admin=Depends(require_role("admin")),
):
    flt = {}
    if user_id:
        flt["user_id"] = user_id
    if scope:
        flt["scope"] = scope
    cur = db.ai_memories.find(flt, {"tokens": 0}).sort("created_at", -1).limit(int(limit))
    items = []
    async for m in cur:
        m.pop("_id", None)
        items.append(m)
    return {"items": items, "total": len(items)}


@router.delete("/memories/{mid}")
async def delete_one(mid: str, admin=Depends(require_role("admin"))):
    ok = await mem_engine.delete_memory(mid)
    if not ok:
        raise HTTPException(404, "Memory not found")
    return {"deleted": True}


class ResetIn(BaseModel):
    user_id: str = Field(min_length=1, description="User ID, or '*' to reset all memories.")


@router.post("/memories/reset")
async def reset_memories(payload: ResetIn, admin=Depends(require_role("admin"))):
    if payload.user_id == "*":
        res = await db.ai_memories.delete_many({})
        return {"deleted_count": res.deleted_count, "scope": "all"}
    n = await mem_engine.reset_user_memories(payload.user_id)
    return {"deleted_count": n, "scope": "user", "user_id": payload.user_id}


@router.get("/bugs/search")
async def search_bugs(q: str = Query(min_length=2, max_length=300), limit: int = Query(default=10, le=50), admin=Depends(require_role("admin"))):
    return await bug_engine.search(q, limit=int(limit))


@router.get("/graph")
async def graph_for_user(user_id: str = Query(min_length=3), admin=Depends(require_role("admin"))):
    return await kg_engine.for_user(user_id)
