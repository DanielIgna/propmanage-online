"""PropManage router: requests."""
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
router = APIRouter(prefix="/api", tags=["requests"])

# ============= REQUESTS =============
@router.post("/requests")
async def create_request(data: RequestIn, user: dict = Depends(require_role("client"))):
    prop = await db.properties.find_one({"_id": ObjectId(data.property_id), "owner_id": user["id"]})
    if not prop: raise HTTPException(404, "Property not found")
    doc = {
        **data.model_dump(),
        "client_id": user["id"],
        "client_name": user["name"],
        "property_name": prop["name"],
        "property_address": prop.get("address"),
        "status": "open",  # open, assigned, in_progress, completed, confirmed
        "specialist_id": None,
        "specialist_name": None,
        "escrow_amount": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    res = await db.requests.insert_one(doc)
    doc["id"] = str(res.inserted_id)
    doc.pop("_id", None)
    await log_event(doc["id"], "request.created", actor=user, property_id=data.property_id,
                    payload={"title": data.title, "category": data.category, "priority": data.priority, "budget_estimate": data.budget_estimate})
    # Notify all eligible specialists about the new lead
    spec_query = {"role": "specialist"}
    if data.category:
        # Notify specialists with matching specialty OR no specialty set
        spec_query = {"role": "specialist", "$or": [{"specialty": data.category}, {"specialty": None}]}
    specs = await db.users.find(spec_query).to_list(50)
    for s in specs:
        await notify(
            str(s["_id"]),
            f"Lead nou: {data.title}",
            f"Solicitare {data.priority} în categoria {data.category}. Buget estimat: {data.budget_estimate or '—'} RON",
            type_="lead",
            link=f"/specialist"
        )
    return doc

@router.get("/requests")
async def list_requests(
    user: dict = Depends(get_current_user),
    q: Optional[str] = None,  # search query
    category: Optional[str] = None,
    status: Optional[str] = None,
    priority: Optional[str] = None,
):
    if user["role"] == "client":
        query = {"client_id": user["id"]}
    elif user["role"] == "specialist":
        # Dual-role: in client view, specialist sees their own requests as a client would
        if user.get("active_view") == "client" and user.get("dual_role_enabled"):
            query = {"client_id": user["id"]}
        else:
            # show open requests + assigned to this specialist
            query = {"$or": [{"status": "open"}, {"specialist_id": user["id"]}]}
    else:  # admin/operator
        query = {}
    
    # Apply filters
    if category:
        query["category"] = category
    if status:
        query["status"] = status
    if priority:
        query["priority"] = priority
    if q:
        # text search on title/description
        regex = {"$regex": q, "$options": "i"}
        text_filter = {"$or": [{"title": regex}, {"description": regex}]}
        # combine with existing query
        if "$or" in query:
            query = {"$and": [query, text_filter]}
        else:
            query = {**query, **text_filter}
    
    docs = await db.requests.find(query).sort("created_at", -1).to_list(200)
    out = [serialize_doc(d) for d in docs]

    # Batch-enrich with last activity event per request (banner data)
    req_ids = [r["id"] for r in out]
    last_events = {}
    if req_ids:
        # Mongo aggregation to get the latest event per request
        pipeline = [
            {"$match": {"request_id": {"$in": req_ids}}},
            {"$sort": {"created_at": -1}},
            {"$group": {
                "_id": "$request_id",
                "event_type": {"$first": "$event_type"},
                "actor_name": {"$first": "$actor_name"},
                "actor_role": {"$first": "$actor_role"},
                "payload": {"$first": "$payload"},
                "created_at": {"$first": "$created_at"},
            }}
        ]
        async for e in db.activity_events.aggregate(pipeline):
            last_events[e["_id"]] = {
                "event_type": e["event_type"],
                "actor_name": e["actor_name"],
                "actor_role": e["actor_role"],
                "payload": e.get("payload") or {},
                "created_at": e["created_at"],
            }
    for r in out:
        r["last_event"] = last_events.get(r["id"])
    return out

@router.get("/requests/{req_id}")
async def get_request(req_id: str, user: dict = Depends(get_current_user)):
    doc = await db.requests.find_one({"_id": ObjectId(req_id)})
    if not doc: raise HTTPException(404, "Request not found")
    return serialize_doc(doc)

# ============= SPECIALISTS / MARKETPLACE =============
@router.get("/specialists")
async def list_specialists(category: Optional[str] = None):
    q = {"role": "specialist"}
    if category: q["specialty"] = category
    docs = await db.users.find(q).to_list(100)
    return [serialize_doc(d) for d in docs]

class AcceptRequestIn(BaseModel):
    proposed_start_date: Optional[str] = None
    proposed_end_date: Optional[str] = None
    estimated_hours: Optional[float] = Field(default=None, ge=0, le=200)
    note: Optional[str] = Field(default=None, max_length=500)

@router.post("/requests/{req_id}/accept")
async def accept_request(req_id: str, data: Optional[AcceptRequestIn] = None, user: dict = Depends(require_role("specialist"))):
    """Specialist accepts a lead - pays 45 RON fee and proposes terms (start/end dates, hours)."""
    req = await db.requests.find_one({"_id": ObjectId(req_id)})
    if not req: raise HTTPException(404, "Request not found")
    if req.get("status") != "open":
        raise HTTPException(400, "Request not available")

    LEAD_FEE = 45.0
    specialist = await db.users.find_one({"_id": ObjectId(user["id"])})
    if (specialist.get("wallet_balance") or 0) < LEAD_FEE:
        raise HTTPException(400, f"Insufficient balance. Need {LEAD_FEE} RON")

    # Deduct lead fee
    await db.users.update_one(
        {"_id": ObjectId(user["id"])},
        {"$inc": {"wallet_balance": -LEAD_FEE}}
    )
    update = {
        "status": "assigned",
        "specialist_id": user["id"],
        "specialist_name": user["name"],
        "specialist_specialty": specialist.get("specialty") or specialist.get("category") or "",
        "specialist_city": specialist.get("city") or specialist.get("location") or "",
        "specialist_verified": bool(specialist.get("verified")),
        "assigned_at": datetime.now(timezone.utc).isoformat(),
    }
    # Schedule proposal
    proposed = {}
    if data:
        if data.proposed_start_date: proposed["start_date"] = data.proposed_start_date
        if data.proposed_end_date: proposed["end_date"] = data.proposed_end_date
        if data.estimated_hours is not None: proposed["estimated_hours"] = data.estimated_hours
        if data.note: proposed["note"] = data.note
    if proposed:
        proposed["proposed_at"] = datetime.now(timezone.utc).isoformat()
        proposed["proposed_by"] = user["id"]
        update["schedule_proposal"] = proposed
    await db.requests.update_one({"_id": ObjectId(req_id)}, {"$set": update})
    # Log transaction
    await db.transactions.insert_one({
        "user_id": user["id"],
        "type": "lead_fee",
        "amount": -LEAD_FEE,
        "request_id": req_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    # Notify client
    schedule_msg = ""
    if proposed.get("start_date"):
        schedule_msg = f" Programare propusă: {proposed.get('start_date','')[:10]}"
        if proposed.get("end_date"): schedule_msg += f" → {proposed.get('end_date','')[:10]}"
    await notify(
        req["client_id"],
        f"Specialist alocat: {user['name']}",
        f"{user['name']} a acceptat solicitarea ta '{req.get('title','')}'.{schedule_msg}",
        type_="assignment",
        link="/client"
    )
    await log_event(req_id, "request.accepted", actor=user, payload={"lead_fee": LEAD_FEE, "schedule": proposed or None})
    return {"ok": True, "balance_after": (specialist.get("wallet_balance") or 0) - LEAD_FEE}

@router.post("/requests/{req_id}/start")
async def start_work(req_id: str, user: dict = Depends(require_role("specialist"))):
    req = await db.requests.find_one({"_id": ObjectId(req_id), "specialist_id": user["id"]})
    if not req: raise HTTPException(404, "Request not found")
    await db.requests.update_one({"_id": ObjectId(req_id)}, {"$set": {"status": "in_progress", "started_at": datetime.now(timezone.utc).isoformat()}})
    await log_event(req_id, "work.started", actor=user)
    return {"ok": True}

@router.post("/requests/{req_id}/complete")
async def complete_work(req_id: str, user: dict = Depends(require_role("specialist"))):
    req = await db.requests.find_one({"_id": ObjectId(req_id), "specialist_id": user["id"]})
    if not req: raise HTTPException(404, "Request not found")
    await db.requests.update_one({"_id": ObjectId(req_id)}, {"$set": {"status": "completed", "completed_at": datetime.now(timezone.utc).isoformat()}})
    await notify(req["client_id"], "Lucrare finalizată", f"{user['name']} a marcat lucrarea '{req.get('title','')}' ca finalizată. Verifică și confirmă pentru a elibera plata.", type_="completion", link="/client")
    await log_event(req_id, "work.completed", actor=user)
    return {"ok": True}

@router.post("/requests/{req_id}/escrow")
async def place_escrow(req_id: str, amount: float, user: dict = Depends(require_role("client"))):
    """Client places funds in escrow"""
    req = await db.requests.find_one({"_id": ObjectId(req_id), "client_id": user["id"]})
    if not req: raise HTTPException(404, "Request not found")
    await db.requests.update_one(
        {"_id": ObjectId(req_id)},
        {"$set": {"escrow_amount": amount, "escrow_status": "held"}}
    )
    return {"ok": True, "amount": amount}

@router.post("/requests/{req_id}/confirm")
async def confirm_complete(req_id: str, user: dict = Depends(require_role("client"))):
    """Client confirms - releases escrow + awards tokens"""
    req = await db.requests.find_one({"_id": ObjectId(req_id), "client_id": user["id"]})
    if not req: raise HTTPException(404, "Request not found")
    if req.get("status") != "completed":
        raise HTTPException(400, "Work not completed yet")
    
    amount = req.get("escrow_amount") or 0
    # Release to specialist (95% - 5% platform fee)
    specialist_amount = amount * 0.95
    if req.get("specialist_id"):
        await db.users.update_one(
            {"_id": ObjectId(req["specialist_id"])},
            {"$inc": {"wallet_balance": specialist_amount}}
        )
        await db.transactions.insert_one({
            "user_id": req["specialist_id"],
            "type": "job_payment",
            "amount": specialist_amount,
            "request_id": req_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    # Award tokens to client (+100)
    await db.users.update_one(
        {"_id": ObjectId(user["id"])},
        {"$inc": {"tokens": 100}}
    )

    # Referral bonus — first confirmed request triggers reward for sponsor
    client_doc = await db.users.find_one({"_id": ObjectId(user["id"])})
    if client_doc and client_doc.get("referrer_id") and not client_doc.get("referral_bonus_paid"):
        try:
            sponsor_oid = ObjectId(client_doc["referrer_id"])
            sponsor = await db.users.find_one({"_id": sponsor_oid})
            if sponsor and not sponsor.get("deleted"):
                # +500 tokens to sponsor
                await db.users.update_one(
                    {"_id": sponsor_oid},
                    {"$inc": {"tokens": 500}}
                )
                # Activate Digital Twin on sponsor's first property (bonus perk)
                sponsor_prop = await db.properties.find_one({"owner_id": str(sponsor_oid), "twin_unlocked": {"$ne": True}})
                if sponsor_prop:
                    await db.properties.update_one(
                        {"_id": sponsor_prop["_id"]},
                        {"$set": {"twin_unlocked": True, "twin_unlocked_via": "referral"}}
                    )
                # Mark bonus as paid (single-use)
                await db.users.update_one(
                    {"_id": ObjectId(user["id"])},
                    {"$set": {"referral_bonus_paid": True, "referral_bonus_paid_at": datetime.now(timezone.utc).isoformat()}}
                )
                await db.transactions.insert_one({
                    "user_id": str(sponsor_oid),
                    "type": "referral_bonus",
                    "amount": 500,
                    "currency": "tokens",
                    "referred_user_id": user["id"],
                    "created_at": datetime.now(timezone.utc).isoformat(),
                })
                await notify(
                    str(sponsor_oid),
                    "Bonus referral activat! 🎉",
                    f"Prietenul tău {client_doc.get('name','')} și-a finalizat prima cerere. Ai primit +500 tokeni"
                    + (" și Digital Twin activat pe prima ta proprietate." if sponsor_prop else "."),
                    type_="referral",
                    link="/client" if sponsor.get("role") == "client" else f"/{sponsor.get('role','client')}"
                )
        except Exception as e:
            logging.warning(f"Referral bonus failed: {e}")

    # Update property health (+5%)
    await db.properties.update_one(
        {"_id": ObjectId(req["property_id"])},
        {"$inc": {"health_score": 5, "utilities_health": 3}}
    )
    
    await db.requests.update_one(
        {"_id": ObjectId(req_id)},
        {"$set": {"status": "confirmed", "escrow_status": "released", "confirmed_at": datetime.now(timezone.utc).isoformat()}}
    )
    await log_event(req_id, "work.confirmed", actor=user, payload={"tokens_awarded": 100, "amount_released": specialist_amount})
    # Notify specialist about payment
    if req.get("specialist_id"):
        await notify(
            req["specialist_id"],
            "Plată eliberată",
            f"Plata de {specialist_amount:.2f} RON a fost eliberată în contul tău pentru lucrarea '{req.get('title','')}'.",
            type_="payment",
            link="/specialist"
        )
    return {"ok": True, "tokens_earned": 100}

@router.post("/requests/{req_id}/review")
async def review_specialist(req_id: str, data: ReviewIn, user: dict = Depends(require_role("client"))):
    req = await db.requests.find_one({"_id": ObjectId(req_id), "client_id": user["id"]})
    if not req: raise HTTPException(404, "Request not found")
    if not req.get("specialist_id"):
        raise HTTPException(400, "No specialist assigned")
    
    # Save review
    await db.reviews.insert_one({
        "request_id": req_id,
        "client_id": user["id"],
        "specialist_id": req["specialist_id"],
        "rating": data.rating,
        "comment": data.comment,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Update specialist rating
    spec = await db.users.find_one({"_id": ObjectId(req["specialist_id"])})
    old_count = spec.get("reviews_count", 0)
    old_rating = spec.get("rating", 5.0)
    new_count = old_count + 1
    new_rating = ((old_rating * old_count) + data.rating) / new_count
    
    update = {"rating": round(new_rating, 2), "reviews_count": new_count}
    # Auto-upgrade tier
    if new_count >= 10 and new_rating >= 4.8:
        update["verified"] = True
        update["tier"] = "VERIFIED"
    
    await db.users.update_one({"_id": ObjectId(req["specialist_id"])}, {"$set": update})
    
    # Award client +20 tokens for review
    await db.users.update_one({"_id": ObjectId(user["id"])}, {"$inc": {"tokens": 20}})
    return {"ok": True, "new_rating": new_rating}

# ============= ACTIVITY EVENTS API =============
async def _can_view_request_events(user: dict, req: dict) -> bool:
    """RBAC: returns True if the user is allowed to see all events for this request."""
    if user.get("role") in ("admin",): return True
    if req.get("client_id") == user["id"]: return True
    if req.get("specialist_id") == user["id"]: return True
    # Operator: only if they validated the twin of this property
    if user.get("role") == "operator" and req.get("property_id"):
        twin = await db.twins.find_one({"property_id": req["property_id"]})
        if twin and twin.get("validated_by") == user["id"]:
            return True
    return False

@router.get("/requests/{req_id}/timeline")
async def request_timeline(req_id: str, user: dict = Depends(get_current_user)):
    """Returns the full activity timeline for a request, accessible to:
    - The client + specialist of the request
    - Any admin
    - The operator who validated the property's twin
    """
    req = await db.requests.find_one({"_id": ObjectId(req_id)})
    if not req: raise HTTPException(404, "Request not found")
    if not await _can_view_request_events(user, req):
        raise HTTPException(403, "Nu ai permisiunea să vezi timeline-ul acestei cereri.")
    events = await db.activity_events.find({"request_id": req_id}).sort("created_at", 1).to_list(500)
    return {
        "request": serialize_doc(req),
        "events": [serialize_doc(e) for e in events],
    }

@router.get("/admin/activity-stream")
async def admin_activity_stream(
    user: dict = Depends(require_role("admin")),
    limit: int = 100,
    event_type: Optional[str] = None,
    actor_role: Optional[str] = None,
    since: Optional[str] = None,  # ISO timestamp
):
    """Platform-wide activity feed (admin only)."""
    q = {}
    if event_type: q["event_type"] = event_type
    if actor_role: q["actor_role"] = actor_role
    if since: q["created_at"] = {"$gte": since}
    events = await db.activity_events.find(q).sort("created_at", -1).limit(min(max(limit, 1), 500)).to_list(500)
    return [serialize_doc(e) for e in events]

