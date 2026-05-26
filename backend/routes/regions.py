"""PropManage router: regions."""
import os
import asyncio
import json
import logging
from typing import Optional, List, Literal, Dict
from datetime import datetime, timezone, timedelta
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, Field

from db import db
from core_utils import serialize_doc, effective_role
from deps import get_current_user, require_role
from services import send_email, notify, send_web_push, log_event
from models import *
from email_service import (
    send_template, tpl_welcome, tpl_dispute_opened, tpl_dispute_resolved,
    tpl_design_phase_quote, tpl_specialist_verified, tpl_escrow_funded,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["regions"])

# ============= REGIONS / ZONES =============

@router.get("/regions")
async def list_regions():
    """List all regions (country/city/zone hierarchy)"""
    docs = await db.regions.find({}).sort("country", 1).to_list(500)
    return [serialize_doc(d) for d in docs]


@router.post("/regions")
async def create_region(data: RegionIn, user: dict = Depends(require_role("admin"))):
    existing = await db.regions.find_one({"country": data.country, "city": data.city, "zone": data.zone})
    if existing:
        return serialize_doc(existing)
    doc = {**data.model_dump(), "created_at": datetime.now(timezone.utc).isoformat()}
    res = await db.regions.insert_one(doc)
    doc["id"] = str(res.inserted_id)
    doc.pop("_id", None)
    return doc


@router.put("/specialists/me/zones")
async def update_specialist_zones(data: SpecialistZonesIn, user: dict = Depends(require_role("specialist"))):
    """Specialist defines coverage zones and service categories"""
    await db.users.update_one(
        {"_id": ObjectId(user["id"])},
        {"$set": {"coverage_zones": data.zones, "service_categories": data.categories}}
    )
    return {"ok": True, "zones": data.zones, "categories": data.categories}


@router.put("/specialists/me/availability")
async def update_availability(data: AvailabilityIn, user: dict = Depends(require_role("specialist"))):
    """Toggle availability status + define hours"""
    update = {"availability_status": data.status}
    if data.available_hours:
        update["available_hours"] = data.available_hours
    await db.users.update_one({"_id": ObjectId(user["id"])}, {"$set": update})
    return {"ok": True, "status": data.status}


