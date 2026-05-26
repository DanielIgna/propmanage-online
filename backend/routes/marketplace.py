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
    zone: Optional[str] = None,
    style: Optional[str] = None,
):
    """Public endpoint: browse all specialists with filters. No auth required.

    Optional filters:
      - category: matches primary specialty OR service_categories.
      - zone: matches coverage_zones (specialist serves that area).
      - style: matches at least one portfolio item with that style (client-relevant for design).
    """
    q = {"role": "specialist", "deleted": {"$ne": True}}
    if category:
        q["$or"] = [{"specialty": category}, {"service_categories": category}]
    if verified_only:
        q["verified"] = True
    if min_rating is not None:
        q["rating"] = {"$gte": min_rating}
    if zone:
        q["coverage_zones"] = zone

    sort_map = {
        "rating": [("rating", -1), ("reviews_count", -1)],
        "reviews": [("reviews_count", -1)],
        "recent": [("created_at", -1)],
    }
    cursor = db.users.find(q).sort(sort_map.get(sort, sort_map["rating"]))
    docs = await cursor.to_list(100)

    # Style filter: keep only those with at least one portfolio item matching style
    if style and docs:
        spec_ids = [str(d["_id"]) for d in docs]
        matching = await db.portfolio.distinct(
            "specialist_id",
            {"specialist_id": {"$in": spec_ids}, "style": style}
        )
        matching_set = set(matching)
        docs = [d for d in docs if str(d["_id"]) in matching_set]

    return [{
        "id": str(d["_id"]),
        "name": d.get("name"),
        "picture": d.get("picture"),
        "avatar": d.get("avatar"),
        "specialty": d.get("specialty"),
        "service_categories": d.get("service_categories", []),
        "coverage_zones": d.get("coverage_zones", []),
        "rating": d.get("rating"),
        "reviews_count": d.get("reviews_count", 0),
        "tier": d.get("tier"),
        "verified": d.get("verified", False),
        "availability_status": d.get("availability_status"),
    } for d in docs]


@router.get("/marketplace/filters")
async def marketplace_filters(category: Optional[str] = None):
    """Returns available zones + styles for filter dropdowns (scoped by category if provided)."""
    spec_query = {"role": "specialist", "deleted": {"$ne": True}}
    if category:
        spec_query["$or"] = [{"specialty": category}, {"service_categories": category}]
    zones = await db.users.distinct("coverage_zones", spec_query)
    zones = sorted([z for z in zones if z])

    portfolio_query = {}
    if category:
        portfolio_query["category"] = category
        # Restrict styles to portfolios of specialists in scope
        spec_ids = await db.users.distinct("_id", spec_query)
        portfolio_query["specialist_id"] = {"$in": [str(s) for s in spec_ids]}
    styles = await db.portfolio.distinct("style", portfolio_query)
    styles = sorted([s for s in styles if s])

    return {"zones": zones, "styles": styles}


