"""Experience Spaces — bootstrap router.

Exposes:
  GET /api/experience-spaces/_config        Public flag check (used by frontend bootstrap)
  GET /api/experience-spaces/health         Module healthcheck
  GET /api/experience-spaces/_admin/config  Full admin config
  PUT /api/experience-spaces/_admin/config  Update config (feature flag, modules, etc.)
"""
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Body, Depends, HTTPException

from db import db
from deps import require_role
from experience_spaces.config import (
    DEFAULT_ES_CONFIG, get_es_config, require_es_enabled,
)

logger = logging.getLogger("propmanage.es_bootstrap")
router = APIRouter(prefix="/api/experience-spaces", tags=["experience-spaces"])


@router.get("/_config")
async def public_config():
    """Public — only returns the flags needed for frontend bootstrap.

    Used by frontend to decide whether to render ES navigation entries.
    NEVER returns sensitive config.
    """
    cfg = await get_es_config()
    return {
        "enabled": bool(cfg.get("enable_experience_spaces")),
        "modules": cfg.get("es_modules_enabled") or {},
    }


@router.get("/health", dependencies=[Depends(require_es_enabled)])
async def health():
    """Module health probe — also verifies feature flag is ON."""
    return {
        "status": "ok",
        "module": "experience_spaces",
        "phase": "ES-0",
        "ts": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/_admin/config")
async def get_admin_config(user=Depends(require_role("admin"))):
    """Admin — full ES configuration."""
    return await get_es_config()


@router.put("/_admin/config")
async def update_admin_config(
    payload: dict = Body(...),
    user=Depends(require_role("admin")),
):
    """Admin — updates ES configuration. Only known keys are accepted."""
    allowed_keys = set(DEFAULT_ES_CONFIG.keys())
    update = {}
    for k, v in (payload or {}).items():
        if k in allowed_keys:
            update[k] = v
    if not update:
        raise HTTPException(400, "No valid keys to update")
    update["es_updated_at"] = datetime.now(timezone.utc).isoformat()
    update["es_updated_by"] = user["id"]
    await db.app_settings.update_one(
        {"_id": "config"}, {"$set": update}, upsert=True,
    )
    return await get_es_config()
