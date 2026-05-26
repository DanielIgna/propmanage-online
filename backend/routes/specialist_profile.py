"""PropManage router: specialist_profile."""
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
router = APIRouter(prefix="/api", tags=["specialist_profile"])

# ============= SPECIALIST PUBLIC PROFILE =============

@router.get("/specialists/{spec_id}/profile")
async def specialist_profile(spec_id: str):
    """Public profile for a specialist - no auth required"""
    try:
        spec = await db.users.find_one({"_id": ObjectId(spec_id), "role": "specialist"})
    except Exception:
        raise HTTPException(404, "Specialist not found")
    if not spec:
        raise HTTPException(404, "Specialist not found")
    
    # Get reviews
    reviews = await db.reviews.find({"specialist_id": spec_id}).sort("created_at", -1).limit(20).to_list(20)
    
    # Get completed jobs count
    completed = await db.requests.count_documents({"specialist_id": spec_id, "status": "confirmed"})
    
    # Get specialties from past requests
    specialties_cursor = db.requests.aggregate([
        {"$match": {"specialist_id": spec_id, "status": "confirmed"}},
        {"$group": {"_id": "$category", "count": {"$sum": 1}}}
    ])
    specialties = await specialties_cursor.to_list(10)
    
    return {
        "id": str(spec["_id"]),
        "name": spec.get("name"),
        "email": spec.get("email"),
        "picture": spec.get("picture"),
        "specialty": spec.get("specialty"),
        "rating": spec.get("rating"),
        "reviews_count": spec.get("reviews_count", 0),
        "tier": spec.get("tier"),
        "verified": spec.get("verified", False),
        "completed_jobs": completed,
        "member_since": spec.get("created_at"),
        "specialties": [{"category": s["_id"], "count": s["count"]} for s in specialties if s["_id"]],
        "reviews": [
            {
                "rating": r.get("rating"),
                "comment": r.get("comment"),
                "created_at": r.get("created_at"),
            } for r in reviews
        ],
    }


