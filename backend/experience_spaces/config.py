"""Experience Spaces — configuration helpers + feature flag middleware."""
import logging
from typing import Optional

from fastapi import Depends, HTTPException, Request

from db import db
from deps import get_current_user

logger = logging.getLogger("propmanage.experience_spaces")

# Default config — used when no document exists yet
DEFAULT_ES_CONFIG = {
    "enable_experience_spaces": False,
    "es_modules_enabled": {
        "spaces": True,
        "bookings": True,
        "payments": False,
        "providers": False,
        "ai_manager": True,
        "digital_twin": True,
        "analytics": True,
    },
    "es_pilot_organization_ids": [],
    "es_default_commission_pct": 15,
    "es_default_revenue_model": "marketplace",
    "es_default_currency": "RON",
    "es_default_timezone": "Europe/Bucharest",
}


async def get_es_config() -> dict:
    """Load Experience Spaces config from app_settings.config doc.

    Returns DEFAULT_ES_CONFIG if any keys are missing (graceful upgrade).
    """
    doc = await db.app_settings.find_one({"_id": "config"}) or {}
    merged = {**DEFAULT_ES_CONFIG}
    for k in DEFAULT_ES_CONFIG:
        if k in doc:
            merged[k] = doc[k]
    return merged


async def is_es_enabled() -> bool:
    cfg = await get_es_config()
    return bool(cfg.get("enable_experience_spaces"))


async def require_es_enabled(request: Request):
    """FastAPI dependency — blocks all ES endpoints when feature flag is OFF.

    Also checks per-submodule flags (extracted from URL path).
    """
    cfg = await get_es_config()
    if not cfg.get("enable_experience_spaces"):
        raise HTTPException(status_code=403, detail="Experience Spaces module is disabled")

    # Granular per-submodule check based on path segment
    # /api/experience-spaces/<module>/...
    parts = (request.url.path or "").split("/")
    if len(parts) >= 4:
        submodule = parts[3].replace("-", "_")
        modules = cfg.get("es_modules_enabled") or {}
        if submodule in modules and not modules[submodule]:
            raise HTTPException(status_code=403, detail=f"Submodule '{submodule}' is disabled")


async def require_es_admin(user: dict = Depends(get_current_user)):
    """RBAC: only admins can manage ES configuration / bookings / providers."""
    role = (user or {}).get("role")
    if role not in ("admin", "operator"):
        raise HTTPException(status_code=403, detail="Admin or operator role required")
    return user


async def get_es_organization_id(user: dict = Depends(get_current_user)) -> Optional[str]:
    """Returns organization id to scope queries. Phase 1 = single-tenant fallback."""
    return (user or {}).get("organization_id") or "default"
