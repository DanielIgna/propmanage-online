"""App-wide Settings — centralized configuration for social links, pricing,
commissions, contact info, and other knobs that admin needs to control
WITHOUT code changes.

Single MongoDB document with `_id = "app_settings"`.
All endpoints are admin/operator-gated except the public GET subset.
"""
from datetime import datetime, timezone
from typing import Optional, Dict, Any
import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from db import db
from deps import require_role
from core_utils import serialize_doc

logger = logging.getLogger("propmanage.app_settings")

router = APIRouter(prefix="/api/admin/app-settings", tags=["admin-settings"])
public_router = APIRouter(prefix="/api/app-settings", tags=["app-settings-public"])


DEFAULT_SETTINGS = {
    "_id": "app_settings",
    "social": {
        "facebook_main": "https://www.facebook.com/share/1GEh9j9wDF/",
        "facebook_estate": "",
        "instagram_main": "",
        "instagram_estate": "",
        "youtube": "",
        "linkedin": "",
    },
    "pricing": {
        "audit_ron": 350.0,
        "twin_ron": 950.0,
        "commission_pct": 2.5,
    },
    "contact": {
        "email": "contact@propmanage.ro",
        "phone": "",
        "address": "",
    },
    "company": {
        "name": "PropManage",
        "tagline": "Property Operating System",
    },
    "updated_at": None,
    "updated_by": None,
}


async def get_or_init_settings() -> dict:
    """Idempotent — returns settings doc, creating defaults on first call."""
    doc = await db.app_settings.find_one({"_id": "app_settings"})
    if not doc:
        doc = {**DEFAULT_SETTINGS, "updated_at": datetime.now(timezone.utc)}
        await db.app_settings.insert_one(doc)
    # Backfill any missing keys for forward compatibility
    changed = False
    for top_key, default_val in DEFAULT_SETTINGS.items():
        if top_key in ("_id", "updated_at", "updated_by"):
            continue
        if top_key not in doc:
            doc[top_key] = default_val
            changed = True
        elif isinstance(default_val, dict):
            for sub_key, sub_default in default_val.items():
                if sub_key not in doc[top_key]:
                    doc[top_key][sub_key] = sub_default
                    changed = True
    if changed:
        await db.app_settings.update_one({"_id": "app_settings"}, {"$set": doc})
    return doc


# ---------- Schemas ----------

class SocialLinks(BaseModel):
    facebook_main: Optional[str] = ""
    facebook_estate: Optional[str] = ""
    instagram_main: Optional[str] = ""
    instagram_estate: Optional[str] = ""
    youtube: Optional[str] = ""
    linkedin: Optional[str] = ""


class PricingSettings(BaseModel):
    audit_ron: float = Field(..., ge=0)
    twin_ron: float = Field(..., ge=0)
    commission_pct: float = Field(..., ge=0, le=100)


class ContactSettings(BaseModel):
    email: Optional[str] = ""
    phone: Optional[str] = ""
    address: Optional[str] = ""


class CompanySettings(BaseModel):
    name: Optional[str] = ""
    tagline: Optional[str] = ""


class AppSettingsUpdate(BaseModel):
    social: Optional[SocialLinks] = None
    pricing: Optional[PricingSettings] = None
    contact: Optional[ContactSettings] = None
    company: Optional[CompanySettings] = None


# ---------- Public (read-only safe subset) ----------

@public_router.get("/public")
async def get_public_settings():
    """Public read-only subset used by Footer / public pages."""
    doc = await get_or_init_settings()
    return {
        "social": doc.get("social", {}),
        "pricing": doc.get("pricing", {}),
        "contact": {"email": doc.get("contact", {}).get("email", "")},
        "company": doc.get("company", {}),
    }


# ---------- Admin ----------

@router.get("")
async def get_all_settings(user: dict = Depends(require_role("admin", "operator"))):
    doc = await get_or_init_settings()
    return serialize_doc(doc)


@router.put("")
async def update_settings(body: AppSettingsUpdate, user: dict = Depends(require_role("admin", "operator"))):
    """Partial update — only fields present in payload are modified."""
    update: Dict[str, Any] = {}
    payload = body.model_dump(exclude_none=True)
    for section, section_value in payload.items():
        if isinstance(section_value, dict):
            for sub_key, sub_value in section_value.items():
                update[f"{section}.{sub_key}"] = sub_value
    if not update:
        raise HTTPException(400, "No fields provided")
    update["updated_at"] = datetime.now(timezone.utc)
    update["updated_by"] = str(user.get("id") or user.get("email"))
    await db.app_settings.update_one({"_id": "app_settings"}, {"$set": update}, upsert=True)
    doc = await db.app_settings.find_one({"_id": "app_settings"})
    return serialize_doc(doc)


@router.post("/reset")
async def reset_settings(user: dict = Depends(require_role("admin"))):
    """Reset to factory defaults (admin only — destructive)."""
    now = datetime.now(timezone.utc)
    fresh = {**DEFAULT_SETTINGS, "updated_at": now, "updated_by": str(user.get("id"))}
    await db.app_settings.replace_one({"_id": "app_settings"}, fresh, upsert=True)
    return serialize_doc(fresh)
