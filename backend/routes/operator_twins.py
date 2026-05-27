"""PropManage router: operator_twins."""
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
router = APIRouter(prefix="/api", tags=["operator_twins"])

# ============= OPERATOR (Maintenance validation) =============
@router.get("/operator/queue")
async def operator_queue(user: dict = Depends(require_role("operator", "admin"))):
    """Pending maintenance logs awaiting validation"""
    docs = await db.maintenance_logs.find({"status": "pending"}).to_list(50)
    return [serialize_doc(d) for d in docs]

@router.post("/operator/logs/{log_id}/validate")
async def validate_log(log_id: str, action: str, user: dict = Depends(require_role("operator", "admin"))):
    if action not in ["approve", "reject"]:
        raise HTTPException(400, "Invalid action")
    await db.maintenance_logs.update_one(
        {"_id": ObjectId(log_id)},
        {"$set": {"status": action, "validated_by": user["id"], "validated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"ok": True}

# ============= OPERATOR: DIGITAL TWIN =============
@router.post("/properties/{prop_id}/twin/request")
async def request_twin_validation(prop_id: str, user: dict = Depends(get_current_user)):
    """Client requests a Digital Twin model build/review by Operator"""
    prop = await db.properties.find_one({"_id": ObjectId(prop_id)})
    if not prop:
        raise HTTPException(404, "Property not found")
    if prop.get("owner_id") != user["id"] and user.get("role") != "admin":
        raise HTTPException(403, "Not allowed")
    twin = await db.twins.find_one({"property_id": prop_id})
    now_iso = datetime.now(timezone.utc).isoformat()
    if twin:
        await db.twins.update_one(
            {"_id": twin["_id"]},
            {"$set": {"status": "pending_validation", "requested_at": now_iso}}
        )
    else:
        await db.twins.insert_one({
            "property_id": prop_id,
            "status": "pending_validation",
            "rooms": [],
            "assets": [],
            "requested_at": now_iso,
            "created_at": now_iso,
        })
    # Notify all operators
    ops = await db.users.find({"role": "operator"}).to_list(10)
    for op in ops:
        await notify(str(op["_id"]), "Twin nou de validat", f"Proprietatea '{prop.get('name','')}' așteaptă validarea Digital Twin.", type_="twin", link="/operator")
    await log_event(None, "twin.requested", actor=user, property_id=prop_id, payload={"property_name": prop.get("name")})
    return {"ok": True}

@router.get("/properties/{prop_id}/twin")
async def get_my_property_twin(prop_id: str, user: dict = Depends(get_current_user)):
    """Read-only twin view for the property OWNER (client), the assigned specialist
    of an active/historical request on this property, admin and operator."""
    prop = await db.properties.find_one({"_id": ObjectId(prop_id)})
    if not prop:
        raise HTTPException(404, "Property not found")
    is_authorized = (
        prop.get("owner_id") == user["id"]
        or user.get("role") in ("admin", "operator")
    )
    if not is_authorized and user.get("role") == "specialist":
        # Allow specialists currently or previously assigned to any request on this property
        spec_request = await db.requests.find_one({
            "property_id": prop_id,
            "specialist_id": user["id"],
        })
        is_authorized = bool(spec_request)
    if not is_authorized:
        raise HTTPException(403, "Not allowed")
    twin = await db.twins.find_one({"property_id": prop_id})
    if not twin:
        return {"status": "not_requested", "rooms": [], "assets": []}
    return {
        "status": twin.get("status"),
        "rooms": twin.get("rooms") or [],
        "assets": twin.get("assets") or [],
        "notes": twin.get("notes"),
        "requested_at": twin.get("requested_at"),
        "validated_at": twin.get("validated_at"),
    }


@router.get("/operator/twins")
async def operator_list_twins(user: dict = Depends(require_role("operator", "admin"))):
    """List all twins (pending + approved) with batched enrichment"""
    docs = await db.twins.find({}).sort("requested_at", -1).to_list(100)
    prop_ids = [ObjectId(d["property_id"]) for d in docs if d.get("property_id")]
    props_map = {}
    owner_ids = set()
    if prop_ids:
        async for p in db.properties.find({"_id": {"$in": prop_ids}}):
            props_map[str(p["_id"])] = p
            if p.get("owner_id"): owner_ids.add(p["owner_id"])
    owners_map = {}
    if owner_ids:
        async for o in db.users.find({"_id": {"$in": [ObjectId(oid) for oid in owner_ids]}}):
            owners_map[str(o["_id"])] = o
    out = []
    for d in docs:
        d = serialize_doc(d)
        prop = props_map.get(d.get("property_id"))
        # Always set enriched fields (None if not found) so consumers can rely on keys existing
        d["property_name"] = prop.get("name") if prop else None
        d["property_address"] = prop.get("address") if prop else None
        d["property_type"] = prop.get("type") if prop else None
        d["property_surface"] = prop.get("surface") if prop else None
        d["property_rooms"] = prop.get("rooms") if prop else None
        owner = owners_map.get(prop.get("owner_id")) if prop else None
        d["owner_name"] = owner.get("name") if owner else None
        d["owner_email"] = owner.get("email") if owner else None
        out.append(d)
    return out

@router.get("/operator/twins/{prop_id}")
async def operator_get_twin(prop_id: str, user: dict = Depends(require_role("operator", "admin"))):
    twin = await db.twins.find_one({"property_id": prop_id})
    if not twin:
        # Return empty draft so operator can start editing
        prop = await db.properties.find_one({"_id": ObjectId(prop_id)})
        if not prop:
            raise HTTPException(404, "Property not found")
        return {
            "property_id": prop_id,
            "status": "draft",
            "rooms": [],
            "assets": [],
            "property_name": prop.get("name"),
        }
    twin = serialize_doc(twin)
    prop = await db.properties.find_one({"_id": ObjectId(prop_id)})
    if prop:
        twin["property_name"] = prop.get("name")
        twin["property_address"] = prop.get("address")
        twin["property_surface"] = prop.get("surface")
    return twin

@router.post("/operator/twins/{prop_id}")
async def operator_save_twin(prop_id: str, data: TwinUpsertIn, user: dict = Depends(require_role("operator", "admin"))):
    now_iso = datetime.now(timezone.utc).isoformat()
    payload = {
        "rooms": [r.model_dump() for r in data.rooms],
        "assets": [a.model_dump() for a in data.assets],
        "model_url": data.model_url,
        "notes": data.notes,
        "updated_at": now_iso,
        "updated_by": user["id"],
    }
    existing = await db.twins.find_one({"property_id": prop_id})
    if existing:
        await db.twins.update_one({"_id": existing["_id"]}, {"$set": payload})
    else:
        payload["property_id"] = prop_id
        payload["status"] = "draft"
        payload["created_at"] = now_iso
        await db.twins.insert_one(payload)
    return {"ok": True}

@router.post("/operator/twins/{prop_id}/validate")
async def operator_validate_twin(prop_id: str, data: TwinValidateIn, user: dict = Depends(require_role("operator", "admin"))):
    twin = await db.twins.find_one({"property_id": prop_id})
    if not twin:
        raise HTTPException(404, "Twin not found")
    new_status = "approved" if data.action == "approve" else "needs_revision"
    now_iso = datetime.now(timezone.utc).isoformat()
    await db.twins.update_one(
        {"_id": twin["_id"]},
        {"$set": {
            "status": new_status,
            "validation_notes": data.notes,
            "validated_at": now_iso,
            "validated_by": user["id"],
        }}
    )
    # Update property twin_unlocked flag
    if data.action == "approve":
        await db.properties.update_one(
            {"_id": ObjectId(prop_id)},
            {"$set": {"twin_unlocked": True, "structure_health": 95}}
        )
    # Notify property owner
    prop = await db.properties.find_one({"_id": ObjectId(prop_id)})
    if prop and prop.get("owner_id"):
        if data.action == "approve":
            await notify(prop["owner_id"], "Digital Twin aprobat", f"Twin-ul proprietății '{prop.get('name','')}' a fost validat și activat.", type_="twin", link="/client")
        else:
            await notify(prop["owner_id"], "Twin necesită revizie", f"Twin-ul proprietății '{prop.get('name','')}' necesită ajustări. {data.notes or ''}", type_="twin", link="/client")
    # Notify specialists with active (assigned/in_progress/completed) requests on this property
    notified_specialists = set()
    async for req in db.requests.find({
        "property_id": prop_id,
        "status": {"$in": ["assigned", "in_progress", "completed"]},
        "specialist_id": {"$ne": None},
    }, {"specialist_id": 1, "title": 1}):
        sid = req.get("specialist_id")
        if sid and sid not in notified_specialists:
            notified_specialists.add(sid)
            if data.action == "approve":
                await notify(
                    sid,
                    "🏠 Twin actualizat pe proprietatea ta de lucru",
                    f"Operatorul a validat 2D twin-ul proprietatii pe care lucrezi ('{prop.get('name', '')}'). Acum poti vedea camerele si asset-urile in profilul cererii.",
                    type_="twin_specialist_update",
                    link="/specialist",
                )
            else:
                await notify(
                    sid,
                    "⚠ Twin necesită revizie",
                    f"2D twin-ul proprietatii '{prop.get('name', '')}' (unde ai lucrare activa) a fost respins. Operatorul a notat: {(data.notes or '—')[:140]}",
                    type_="twin_specialist_update",
                    link="/specialist",
                )
    await log_event(None, "twin.validated", actor=user, property_id=prop_id,
                    payload={"action": data.action, "new_status": new_status, "notes": (data.notes or "")[:200], "specialists_notified": len(notified_specialists)})
    return {"ok": True, "status": new_status, "specialists_notified": len(notified_specialists)}

