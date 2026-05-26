"""PropManage router: property_timeline."""
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
router = APIRouter(prefix="/api", tags=["property_timeline"])

# ============= PROPERTY TIMELINE =============

@router.get("/properties/{prop_id}/timeline")
async def property_timeline(prop_id: str, user: dict = Depends(get_current_user)):
    """Chronological list of all events for a property"""
    prop = await db.properties.find_one({"_id": ObjectId(prop_id)})
    if not prop: raise HTTPException(404, "Property not found")
    
    # Aggregate all events: requests + maintenance logs
    requests_docs = await db.requests.find({"property_id": prop_id}).to_list(200)
    
    events = []
    for r in requests_docs:
        events.append({
            "type": "request_created",
            "title": r.get("title"),
            "description": f"Solicitare {r.get('category', '')} ({r.get('priority', '')})",
            "timestamp": r.get("created_at"),
            "status": r.get("status"),
            "request_id": str(r["_id"]),
        })
        if r.get("assigned_at"):
            events.append({
                "type": "specialist_assigned",
                "title": f"Specialist alocat: {r.get('specialist_name','')}",
                "description": r.get("title"),
                "timestamp": r["assigned_at"],
                "request_id": str(r["_id"]),
            })
        if r.get("completed_at"):
            events.append({
                "type": "work_completed",
                "title": f"Finalizat: {r.get('title','')}",
                "description": f"De {r.get('specialist_name','')}",
                "timestamp": r["completed_at"],
                "request_id": str(r["_id"]),
            })
        if r.get("confirmed_at"):
            events.append({
                "type": "confirmed",
                "title": f"Confirmat & plătit: {r.get('escrow_amount','—')} RON",
                "description": r.get("title"),
                "timestamp": r["confirmed_at"],
                "request_id": str(r["_id"]),
            })
    
    # Sort newest first
    events.sort(key=lambda e: e.get("timestamp", ""), reverse=True)
    return {
        "property": serialize_doc(prop),
        "events": events,
        "total": len(events),
    }


