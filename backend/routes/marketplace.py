"""PropManage router: marketplace."""
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
router = APIRouter(prefix="/api", tags=["marketplace"])

# ============= PUBLIC MARKETPLACE =============

@router.get("/marketplace/specialists")
async def public_marketplace(
    category: Optional[str] = None,
    verified_only: bool = False,
    min_rating: Optional[float] = None,
    sort: str = "rating",  # rating, reviews, recent
):
    """Public endpoint: browse all specialists with filters. No auth required."""
    q = {"role": "specialist"}
    if category:
        q["specialty"] = category
    if verified_only:
        q["verified"] = True
    if min_rating is not None:
        q["rating"] = {"$gte": min_rating}
    
    sort_map = {
        "rating": [("rating", -1), ("reviews_count", -1)],
        "reviews": [("reviews_count", -1)],
        "recent": [("created_at", -1)],
    }
    cursor = db.users.find(q).sort(sort_map.get(sort, sort_map["rating"]))
    docs = await cursor.to_list(100)
    
    return [{
        "id": str(d["_id"]),
        "name": d.get("name"),
        "picture": d.get("picture"),
        "specialty": d.get("specialty"),
        "rating": d.get("rating"),
        "reviews_count": d.get("reviews_count", 0),
        "tier": d.get("tier"),
        "verified": d.get("verified", False),
    } for d in docs]


