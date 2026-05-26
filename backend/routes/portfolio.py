"""PropManage router: portfolio."""
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
router = APIRouter(prefix="/api", tags=["portfolio"])

# ============= SPECIALIST PORTFOLIO =============

MAX_PORTFOLIO_ITEMS = 30
MAX_IMAGE_SIZE_BYTES = 5_500_000  # ~4MB base64

def _validate_image_payload(b64_or_url: str) -> bool:
    if not b64_or_url:
        return False
    if b64_or_url.startswith("http"):
        return True
    if b64_or_url.startswith("data:image/") and len(b64_or_url) < MAX_IMAGE_SIZE_BYTES:
        return True
    return False

@router.get("/specialists/{spec_id}/portfolio")
async def list_portfolio(spec_id: str):
    """Public: list portfolio items of any specialist (no auth required)."""
    docs = await db.portfolio.find({"specialist_id": spec_id}).sort("created_at", -1).to_list(50)
    return [serialize_doc(d) for d in docs]

@router.get("/specialist/portfolio")
async def my_portfolio(user: dict = Depends(require_role("specialist"))):
    """List own portfolio items."""
    docs = await db.portfolio.find({"specialist_id": user["id"]}).sort("created_at", -1).to_list(50)
    return [serialize_doc(d) for d in docs]

@router.post("/specialist/portfolio")
async def add_portfolio_item(data: PortfolioItemIn, user: dict = Depends(require_role("specialist"))):
    """Add a new portfolio item (own)."""
    existing_count = await db.portfolio.count_documents({"specialist_id": user["id"]})
    if existing_count >= MAX_PORTFOLIO_ITEMS:
        raise HTTPException(400, f"Maximum {MAX_PORTFOLIO_ITEMS} proiecte în portofoliu. Șterge proiecte vechi pentru a adăuga altele noi.")

    if not _validate_image_payload(data.cover_image):
        raise HTTPException(400, "Imagine cover invalidă (max 4MB base64 sau URL http)")
    for g in data.gallery:
        if not _validate_image_payload(g):
            raise HTTPException(400, "Una sau mai multe imagini din galerie sunt invalide")

    doc = {
        "specialist_id": user["id"],
        "specialist_name": user.get("name"),
        "title": data.title,
        "description": data.description,
        "style": data.style,
        "category": data.category,
        "cover_image": data.cover_image,
        "gallery": data.gallery,
        "completion_date": data.completion_date,
        "location": data.location,
        "surface": data.surface,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    res = await db.portfolio.insert_one(doc)
    doc["id"] = str(res.inserted_id)
    doc.pop("_id", None)
    return doc

@router.put("/specialist/portfolio/{item_id}")
async def update_portfolio_item(item_id: str, data: PortfolioItemIn, user: dict = Depends(require_role("specialist"))):
    item = await db.portfolio.find_one({"_id": ObjectId(item_id), "specialist_id": user["id"]})
    if not item:
        raise HTTPException(404, "Item not found")
    if not _validate_image_payload(data.cover_image):
        raise HTTPException(400, "Imagine cover invalidă")
    for g in data.gallery:
        if not _validate_image_payload(g):
            raise HTTPException(400, "Una sau mai multe imagini din galerie sunt invalide")
    await db.portfolio.update_one(
        {"_id": ObjectId(item_id)},
        {"$set": {
            "title": data.title,
            "description": data.description,
            "style": data.style,
            "category": data.category,
            "cover_image": data.cover_image,
            "gallery": data.gallery,
            "completion_date": data.completion_date,
            "location": data.location,
            "surface": data.surface,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }}
    )
    return {"ok": True}

@router.delete("/specialist/portfolio/{item_id}")
async def delete_portfolio_item(item_id: str, user: dict = Depends(require_role("specialist"))):
    res = await db.portfolio.delete_one({"_id": ObjectId(item_id), "specialist_id": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(404, "Item not found")
    return {"ok": True}


