"""PropManage Backend - FastAPI + MongoDB + JWT Auth + Marketplace + Stripe + Google OAuth + WebSocket"""
import os
import logging
import json
import uuid
import asyncio
import httpx
import stripe
import pyotp
import qrcode
import io
import secrets
import base64 as b64
from datetime import datetime, timezone, timedelta
from pathlib import Path
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
import pytz
from emergentintegrations.llm.chat import LlmChat, UserMessage
from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionRequest
from email_service import send_template, tpl_welcome, tpl_dispute_opened, tpl_dispute_resolved, tpl_design_phase_quote, tpl_specialist_verified, tpl_escrow_funded
from typing import Optional, List, Literal, Dict
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, status, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from bson import ObjectId
from pydantic import BaseModel, EmailStr, Field
import jwt  # used directly only in WebSocket chat handler

# Internal modules (refactored Phase A)
from db import db, client
from core_utils import (
    hash_password, verify_password, create_access_token, create_refresh_token,
    serialize_doc, set_auth_cookies, effective_role, JWT_SECRET, JWT_ALGORITHM,
)
from deps import get_current_user, require_role
from services import (
    send_email, notify, send_web_push, log_event,
    VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY_PEM, VAPID_CLAIM_EMAIL,
    SENDGRID_API_KEY, SENDGRID_SENDER,
)
from models import (
    Role, ALLOWED_SPECIALTIES,
    DESIGN_CONCEPT_PRICE_PER_ROOM, DESIGN_MAX_TOKEN_DISCOUNT_PCT,
    RegisterIn, LoginIn, TotpVerifyIn, PropertyIn, PropertyUpdateIn,
    RegionIn, SpecialistZonesIn, AvailabilityIn, ServiceAvailabilityIn,
    RequestIn, OfferIn, ReviewIn,
    DocumentIn, DocumentReviewIn, SpecialistRejectIn,
    DisputeOpenIn, DisputeResolveIn,
    TwinRoom, TwinAsset, TwinUpsertIn, TwinValidateIn,
    DesignConceptIn, DesignPhaseQuoteIn, DesignPhaseAcceptIn,
    PortfolioItemIn,
)
from seed import seed
from digest import (
    DIGEST_BUILDERS, run_daily_digests, send_digest_to_user, BUCHAREST_TZ_NAME,
)

ROOT_DIR = Path(__file__).parent

# Stripe configuration
stripe.api_key = os.environ.get("STRIPE_API_KEY", "sk_test_emergent")

# LLM key for AI assistant
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

app = FastAPI(title="PropManage API")
api = APIRouter(prefix="/api")


# ============= LEGACY MODELS / HELPERS — extracted to core_utils, deps, models =============

@api.post("/auth/register")
async def register(data: RegisterIn, response: Response):
    email = data.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email already registered")
    user = {
        "email": email,
        "password_hash": hash_password(data.password),
        "name": data.name,
        "role": data.role,
        "phone": data.phone,
        "wallet_balance": 500.0 if data.role == "specialist" else 0.0,  # specialists get 500 RON starting credit
        "tokens": 0,
        "rating": 5.0 if data.role == "specialist" else None,
        "reviews_count": 0,
        "verified": False,
        "tier": "ENTRY" if data.role == "specialist" else None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    if data.role == "specialist":
        # Validate categories - require at least one
        cats = data.service_categories or ([data.specialty] if data.specialty else [])
        cats = [c for c in cats if c]  # drop empty/None
        if not cats:
            raise HTTPException(400, "Selectează cel puțin o categorie de specialitate")
        invalid = [c for c in cats if c not in ALLOWED_SPECIALTIES]
        if invalid:
            raise HTTPException(400, f"Categorii invalide: {', '.join(invalid)}")
        user["specialty"] = data.specialty or cats[0]
        user["service_categories"] = cats
        user["coverage_zones"] = data.coverage_zones or []
        user["availability_status"] = "available"
        user["documents"] = []
    elif data.role == "client":
        user["zone"] = data.zone
    # Referral tracking — link to sponsor (only valid clients can be referred for bonus)
    if data.referrer_id:
        try:
            sponsor = await db.users.find_one({"_id": ObjectId(data.referrer_id)})
            if sponsor and not sponsor.get("deleted"):
                user["referrer_id"] = data.referrer_id
                user["referral_bonus_paid"] = False
        except Exception:
            pass  # invalid referrer id silently ignored
    result = await db.users.insert_one(user)
    uid = str(result.inserted_id)
    access = create_access_token(uid, email, data.role)
    refresh = create_refresh_token(uid)
    set_auth_cookies(response, access, refresh)
    user["id"] = uid
    user.pop("_id", None)
    user.pop("password_hash", None)
    # Welcome email (fire-and-forget, no blocking)
    await send_template(tpl_welcome, data.name, data.role, to=email)
    return user

# Simple in-memory rate limiter for /auth/login (per IP) - tracks FAILED attempts only
_login_attempts: Dict[str, List[datetime]] = {}
LOGIN_MAX_ATTEMPTS = 8
LOGIN_WINDOW_SECONDS = 60

def _check_login_rate_limit(ip: str):
    """Raise 429 if too many recent FAILED attempts. Does not auto-increment."""
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(seconds=LOGIN_WINDOW_SECONDS)
    attempts = [t for t in _login_attempts.get(ip, []) if t > cutoff]
    _login_attempts[ip] = attempts  # pruned
    if len(attempts) >= LOGIN_MAX_ATTEMPTS:
        raise HTTPException(429, "Prea multe încercări. Reîncearcă în 60 secunde.")

def _record_failed_login(ip: str):
    now = datetime.now(timezone.utc)
    _login_attempts.setdefault(ip, []).append(now)

@api.post("/auth/login")
async def login(data: LoginIn, request: Request, response: Response):
    ip = request.client.host if request.client else "unknown"
    _check_login_rate_limit(ip)
    email = data.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(data.password, user["password_hash"]):
        _record_failed_login(ip)
        raise HTTPException(401, "Invalid credentials")
    
    # 2FA gate
    if user.get("totp_enabled"):
        if not data.totp_code:
            raise HTTPException(202, {"error": "totp_required", "message": "2FA code required"})
        totp = pyotp.TOTP(user["totp_secret"])
        if not totp.verify(data.totp_code, valid_window=1):
            _record_failed_login(ip)
            raise HTTPException(401, "Invalid 2FA code")
    
    # Success - clear attempts for this IP
    _login_attempts.pop(ip, None)
    uid = str(user["_id"])
    access = create_access_token(uid, email, user.get("role", "client"))
    refresh = create_refresh_token(uid)
    set_auth_cookies(response, access, refresh)
    return serialize_doc(user)

@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"ok": True}

@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user

@api.get("/auth/ws-token")
async def ws_token(user: dict = Depends(get_current_user)):
    """Issue a short-lived JWT for WebSocket connections (cookies don't work cross-origin in WS)"""
    token = create_access_token(user["id"], user["email"], user["role"])
    return {"token": token}

# ============= DUAL-ROLE SWITCHER =============
class SwitchViewIn(BaseModel):
    view: Literal["client", "specialist"]

@api.post("/auth/switch-view")
async def switch_view(data: SwitchViewIn, user: dict = Depends(get_current_user)):
    """Verified specialists can toggle between specialist and client view (dual-role)."""
    if user.get("role") != "specialist":
        raise HTTPException(403, "Doar specialiștii pot comuta între profile.")
    if not user.get("verified"):
        raise HTTPException(403, "Doar specialiștii verificați pot accesa modul Client.")
    await db.users.update_one(
        {"_id": ObjectId(user["id"])},
        {"$set": {"active_view": data.view}}
    )
    refreshed = await db.users.find_one({"_id": ObjectId(user["id"])})
    return serialize_doc(refreshed)

# ============= PROFILE UPDATE =============
class ProfileUpdateIn(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=80)
    phone: Optional[str] = Field(default=None, max_length=30)
    zone: Optional[str] = Field(default=None, max_length=80)
    avatar: Optional[str] = Field(default=None, max_length=2_000_000)  # base64 data URL up to ~1.5MB

@api.patch("/auth/profile")
async def update_profile(data: ProfileUpdateIn, user: dict = Depends(get_current_user)):
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update:
        raise HTTPException(400, "Niciun câmp de actualizat.")
    await db.users.update_one({"_id": ObjectId(user["id"])}, {"$set": update})
    refreshed = await db.users.find_one({"_id": ObjectId(user["id"])})
    return serialize_doc(refreshed)

# ============= CHANGE PASSWORD =============
class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6)

@api.post("/auth/change-password")
async def change_password(data: ChangePasswordIn, user: dict = Depends(get_current_user)):
    db_user = await db.users.find_one({"_id": ObjectId(user["id"])})
    if not db_user or not verify_password(data.current_password, db_user.get("password_hash", "")):
        raise HTTPException(401, "Parola curentă este incorectă.")
    if data.current_password == data.new_password:
        raise HTTPException(400, "Parola nouă trebuie să fie diferită de cea curentă.")
    await db.users.update_one(
        {"_id": ObjectId(user["id"])},
        {"$set": {"password_hash": hash_password(data.new_password)}}
    )
    return {"ok": True}

# ============= GDPR — ACCOUNT EXPORT & DELETE =============
@api.post("/auth/account-export")
async def account_export(user: dict = Depends(get_current_user)):
    """Returns all user-owned data as JSON (GDPR Art. 20 — data portability)."""
    uid = user["id"]
    db_user = serialize_doc(await db.users.find_one({"_id": ObjectId(uid)}))
    properties = [serialize_doc(d) for d in await db.properties.find({"owner_id": uid}).to_list(500)]
    requests_as_client = [serialize_doc(d) for d in await db.requests.find({"client_id": uid}).to_list(500)]
    requests_as_specialist = [serialize_doc(d) for d in await db.requests.find({"specialist_id": uid}).to_list(500)]
    notifications = [serialize_doc(d) for d in await db.notifications.find({"user_id": uid}).to_list(500)]
    transactions = [serialize_doc(d) for d in await db.transactions.find({"user_id": uid}).to_list(500)]
    return {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "user": db_user,
        "properties": properties,
        "requests_as_client": requests_as_client,
        "requests_as_specialist": requests_as_specialist,
        "notifications": notifications,
        "transactions": transactions,
    }

class AccountDeleteIn(BaseModel):
    password: str
    confirmation: str  # must literally equal "STERGE"

@api.post("/auth/account-delete")
async def account_delete(data: AccountDeleteIn, response: Response, user: dict = Depends(get_current_user)):
    """Soft-deletes the user account (GDPR Art. 17). Anonymizes user document."""
    if data.confirmation != "STERGE":
        raise HTTPException(400, "Confirmarea trebuie să fie exact 'STERGE'.")
    db_user = await db.users.find_one({"_id": ObjectId(user["id"])})
    if not db_user or not verify_password(data.password, db_user.get("password_hash", "")):
        raise HTTPException(401, "Parolă incorectă.")
    # Anonymize (soft delete) to preserve referential integrity in disputes/requests
    anonymized = f"deleted_{user['id'][:8]}@propmanage.deleted"
    await db.users.update_one(
        {"_id": ObjectId(user["id"])},
        {"$set": {
            "email": anonymized,
            "name": "Utilizator șters",
            "phone": None,
            "avatar": None,
            "password_hash": hash_password(secrets.token_urlsafe(32)),
            "deleted_at": datetime.now(timezone.utc).isoformat(),
            "deleted": True,
        }}
    )
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"ok": True, "message": "Cont șters. Datele asociate au fost anonimizate conform GDPR."}


# ============= REFERRAL INFO =============
@api.get("/auth/referral")
async def referral_info(user: dict = Depends(get_current_user)):
    """Returns referral stats: how many users this person referred + how many converted (paid bonus)."""
    uid = user["id"]
    referred = await db.users.count_documents({"referrer_id": uid})
    converted = await db.users.count_documents({"referrer_id": uid, "referral_bonus_paid": True})
    return {
        "user_id": uid,
        "referred_total": referred,
        "converted_total": converted,
        "tokens_per_conversion": 500,
        "referral_url": f"/register?ref={uid}",
    }


# ============= CONTACT / SUPPORT FORM =============
class ContactIn(BaseModel):
    subject: str = Field(min_length=2, max_length=200)
    message: str = Field(min_length=5, max_length=5000)

@api.post("/support/contact")
async def support_contact(data: ContactIn, user: dict = Depends(get_current_user)):
    """User contact form → emails the support team + confirmation back to user."""
    admin_email = os.environ.get("SUPPORT_EMAIL", "admin@propmanage.io")
    safe_subject = data.subject.strip()
    safe_message = data.message.strip().replace("\n", "<br/>")
    body_admin = (
        f"<h2>Mesaj nou contact</h2>"
        f"<p><b>De la:</b> {user.get('name','—')} ({user.get('email','—')})</p>"
        f"<p><b>Rol:</b> {user.get('role','—')}</p>"
        f"<p><b>Subiect:</b> {safe_subject}</p>"
        f"<hr/><div>{safe_message}</div>"
    )
    body_user = (
        f"<h2>Mesajul tău a fost primit</h2>"
        f"<p>Salut {user.get('name','')},</p>"
        f"<p>Confirmăm primirea mesajului tău cu subiectul: <b>{safe_subject}</b>.</p>"
        f"<p>Echipa PropManage îți va răspunde în maximum 24h pe adresa <b>{user.get('email','')}</b>.</p>"
    )
    asyncio.create_task(send_email(admin_email, f"[PropManage Contact] {safe_subject}", body_admin))
    if user.get("email"):
        asyncio.create_task(send_email(user["email"], "Am primit mesajul tău - PropManage", body_user))
    return {"ok": True}


# ============= WEB PUSH (VAPID) — endpoints kept; helpers moved to services.py =============
class PushSubscriptionKeys(BaseModel):
    p256dh: str
    auth: str

class PushSubscriptionIn(BaseModel):
    endpoint: str
    keys: PushSubscriptionKeys
    expirationTime: Optional[int] = None

@api.get("/push/vapid-public-key")
async def push_vapid_public():
    if not VAPID_PUBLIC_KEY:
        raise HTTPException(503, "Push notifications nu sunt configurate pe server.")
    return {"public_key": VAPID_PUBLIC_KEY}

@api.post("/push/subscribe")
async def push_subscribe(data: PushSubscriptionIn, user: dict = Depends(get_current_user)):
    # Upsert by endpoint
    await db.push_subscriptions.update_one(
        {"endpoint": data.endpoint},
        {"$set": {
            "user_id": user["id"],
            "endpoint": data.endpoint,
            "keys": {"p256dh": data.keys.p256dh, "auth": data.keys.auth},
            "expiration_time": data.expirationTime,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        },
         "$setOnInsert": {"created_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    return {"ok": True}

@api.post("/push/unsubscribe")
async def push_unsubscribe(data: PushSubscriptionIn, user: dict = Depends(get_current_user)):
    await db.push_subscriptions.delete_one({"endpoint": data.endpoint, "user_id": user["id"]})
    return {"ok": True}


# ============= PROPERTIES (Client) =============
@api.post("/properties")
async def create_property(data: PropertyIn, user: dict = Depends(require_role("client"))):
    doc = {
        **data.model_dump(),
        "owner_id": user["id"],
        "health_score": 75,
        "structure_health": 90,
        "utilities_health": 82,
        "documents_health": 100,
        "twin_unlocked": False,
        "wallet_unlocked": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    res = await db.properties.insert_one(doc)
    doc["id"] = str(res.inserted_id)
    doc.pop("_id", None)
    return doc

@api.get("/properties")
async def list_properties(user: dict = Depends(get_current_user)):
    eff = effective_role(user)
    # Clients (and dual-role specialists in client view) see their own properties
    q = {"owner_id": user["id"]} if eff in ("client", "specialist") else {}
    docs = await db.properties.find(q).to_list(100)
    # Enrich with twin status (one query for all)
    prop_ids = [str(d["_id"]) for d in docs]
    twin_map = {}
    if prop_ids:
        async for t in db.twins.find({"property_id": {"$in": prop_ids}}):
            twin_map[t["property_id"]] = t.get("status")
    out = []
    for d in docs:
        s = serialize_doc(d)
        s["twin_status"] = twin_map.get(s["id"])  # None | 'pending_validation' | 'approved' | 'needs_revision'
        out.append(s)
    return out

@api.get("/properties/{prop_id}")
async def get_property(prop_id: str, user: dict = Depends(get_current_user)):
    doc = await db.properties.find_one({"_id": ObjectId(prop_id)})
    if not doc: raise HTTPException(404, "Property not found")
    return serialize_doc(doc)

@api.put("/properties/{prop_id}")
async def update_property(prop_id: str, data: PropertyUpdateIn, user: dict = Depends(require_role("client"))):
    """Update property (owner only)"""
    prop = await db.properties.find_one({"_id": ObjectId(prop_id), "owner_id": user["id"]})
    if not prop: raise HTTPException(404, "Property not found")
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    if update:
        await db.properties.update_one({"_id": ObjectId(prop_id)}, {"$set": update})
    return serialize_doc(await db.properties.find_one({"_id": ObjectId(prop_id)}))

@api.delete("/properties/{prop_id}")
async def delete_property(prop_id: str, user: dict = Depends(require_role("client"))):
    """Delete property (owner only, no active requests)"""
    prop = await db.properties.find_one({"_id": ObjectId(prop_id), "owner_id": user["id"]})
    if not prop: raise HTTPException(404, "Property not found")
    # Check for active requests
    active = await db.requests.count_documents({
        "property_id": prop_id,
        "status": {"$in": ["assigned", "in_progress", "completed"]}
    })
    if active > 0:
        raise HTTPException(400, f"Cannot delete: {active} active request(s)")
    await db.properties.delete_one({"_id": ObjectId(prop_id)})
    return {"ok": True}

# ============= REQUESTS =============
@api.post("/requests")
async def create_request(data: RequestIn, user: dict = Depends(require_role("client"))):
    prop = await db.properties.find_one({"_id": ObjectId(data.property_id), "owner_id": user["id"]})
    if not prop: raise HTTPException(404, "Property not found")
    doc = {
        **data.model_dump(),
        "client_id": user["id"],
        "client_name": user["name"],
        "property_name": prop["name"],
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

@api.get("/requests")
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

@api.get("/requests/{req_id}")
async def get_request(req_id: str, user: dict = Depends(get_current_user)):
    doc = await db.requests.find_one({"_id": ObjectId(req_id)})
    if not doc: raise HTTPException(404, "Request not found")
    return serialize_doc(doc)

# ============= SPECIALISTS / MARKETPLACE =============
@api.get("/specialists")
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

@api.post("/requests/{req_id}/accept")
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

@api.post("/requests/{req_id}/start")
async def start_work(req_id: str, user: dict = Depends(require_role("specialist"))):
    req = await db.requests.find_one({"_id": ObjectId(req_id), "specialist_id": user["id"]})
    if not req: raise HTTPException(404, "Request not found")
    await db.requests.update_one({"_id": ObjectId(req_id)}, {"$set": {"status": "in_progress", "started_at": datetime.now(timezone.utc).isoformat()}})
    await log_event(req_id, "work.started", actor=user)
    return {"ok": True}

@api.post("/requests/{req_id}/complete")
async def complete_work(req_id: str, user: dict = Depends(require_role("specialist"))):
    req = await db.requests.find_one({"_id": ObjectId(req_id), "specialist_id": user["id"]})
    if not req: raise HTTPException(404, "Request not found")
    await db.requests.update_one({"_id": ObjectId(req_id)}, {"$set": {"status": "completed", "completed_at": datetime.now(timezone.utc).isoformat()}})
    await notify(req["client_id"], "Lucrare finalizată", f"{user['name']} a marcat lucrarea '{req.get('title','')}' ca finalizată. Verifică și confirmă pentru a elibera plata.", type_="completion", link="/client")
    await log_event(req_id, "work.completed", actor=user)
    return {"ok": True}

@api.post("/requests/{req_id}/escrow")
async def place_escrow(req_id: str, amount: float, user: dict = Depends(require_role("client"))):
    """Client places funds in escrow"""
    req = await db.requests.find_one({"_id": ObjectId(req_id), "client_id": user["id"]})
    if not req: raise HTTPException(404, "Request not found")
    await db.requests.update_one(
        {"_id": ObjectId(req_id)},
        {"$set": {"escrow_amount": amount, "escrow_status": "held"}}
    )
    return {"ok": True, "amount": amount}

@api.post("/requests/{req_id}/confirm")
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

@api.post("/requests/{req_id}/review")
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

@api.get("/requests/{req_id}/timeline")
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

@api.get("/admin/activity-stream")
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

# ============= OPERATOR NON-CONFORMITY FLAG =============
class NonConformityIn(BaseModel):
    target_type: Literal["request", "property", "twin"]
    target_id: str
    reason: str = Field(min_length=5, max_length=2000)
    severity: Literal["low", "medium", "high"] = "medium"

@api.post("/operator/flag-nonconformity")
async def operator_flag_nonconformity(data: NonConformityIn, user: dict = Depends(require_role("operator"))):
    """Operator flags a request/property/twin as non-conformant. Notifies all admins + logs event."""
    # Validate target exists
    related_request_id = None
    related_property_id = None
    if data.target_type == "request":
        r = await db.requests.find_one({"_id": ObjectId(data.target_id)})
        if not r: raise HTTPException(404, "Cerere inexistentă.")
        related_request_id = data.target_id
        related_property_id = r.get("property_id")
    elif data.target_type == "property":
        p = await db.properties.find_one({"_id": ObjectId(data.target_id)})
        if not p: raise HTTPException(404, "Proprietate inexistentă.")
        related_property_id = data.target_id
    elif data.target_type == "twin":
        t = await db.twins.find_one({"_id": ObjectId(data.target_id)})
        if not t: raise HTTPException(404, "Twin inexistent.")
        related_property_id = t.get("property_id")

    doc = {
        "operator_id": user["id"],
        "operator_name": user["name"],
        "target_type": data.target_type,
        "target_id": data.target_id,
        "related_request_id": related_request_id,
        "related_property_id": related_property_id,
        "reason": data.reason,
        "severity": data.severity,
        "status": "open",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    res = await db.nonconformities.insert_one(doc)
    flag_id = str(res.inserted_id)
    # Log event
    await log_event(related_request_id, "operator.flagged_nonconformity", actor=user,
                    property_id=related_property_id,
                    payload={"target_type": data.target_type, "target_id": data.target_id, "severity": data.severity, "reason": data.reason[:200]})
    # Notify all admins
    async for admin in db.users.find({"role": "admin"}):
        await notify(
            str(admin["_id"]),
            f"⚠ Sesizare operator ({data.severity})",
            f"{user['name']} a raportat o neconformitate pe {data.target_type}. Motiv: {data.reason[:140]}",
            type_="nonconformity",
            link="/admin"
        )
    return {"ok": True, "id": flag_id}

@api.get("/admin/nonconformities")
async def list_nonconformities(user: dict = Depends(require_role("admin")), status: Optional[str] = None):
    q = {} if not status else {"status": status}
    docs = await db.nonconformities.find(q).sort("created_at", -1).to_list(200)
    return [serialize_doc(d) for d in docs]

class NonConformityResolveIn(BaseModel):
    resolution: str = Field(min_length=3, max_length=1000)

@api.post("/admin/nonconformities/{flag_id}/resolve")
async def resolve_nonconformity(flag_id: str, data: NonConformityResolveIn, user: dict = Depends(require_role("admin"))):
    flag = await db.nonconformities.find_one({"_id": ObjectId(flag_id)})
    if not flag: raise HTTPException(404, "Sesizare inexistentă.")
    await db.nonconformities.update_one(
        {"_id": ObjectId(flag_id)},
        {"$set": {
            "status": "resolved",
            "resolution": data.resolution,
            "resolved_by": user["id"],
            "resolved_at": datetime.now(timezone.utc).isoformat(),
        }}
    )
    await log_event(flag.get("related_request_id"), "admin.resolved_nonconformity", actor=user,
                    property_id=flag.get("related_property_id"),
                    payload={"flag_id": flag_id, "resolution": data.resolution[:200]})
    # Notify operator
    await notify(
        flag["operator_id"],
        "Sesizarea ta a fost rezolvată",
        f"Admin {user['name']}: {data.resolution[:200]}",
        type_="nonconformity_resolved",
        link="/operator"
    )
    return {"ok": True}

# ============= TRANSACTIONS / WALLET =============
@api.get("/transactions")
async def list_transactions(user: dict = Depends(get_current_user)):
    docs = await db.transactions.find({"user_id": user["id"]}).sort("created_at", -1).to_list(50)
    return [serialize_doc(d) for d in docs]

@api.post("/wallet/topup")
async def topup_wallet(amount: float, user: dict = Depends(get_current_user)):
    if amount <= 0 or amount > 10000:
        raise HTTPException(400, "Invalid amount")
    await db.users.update_one(
        {"_id": ObjectId(user["id"])},
        {"$inc": {"wallet_balance": amount}}
    )
    await db.transactions.insert_one({
        "user_id": user["id"],
        "type": "topup",
        "amount": amount,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"ok": True, "added": amount}

# ============= ADMIN =============
@api.get("/admin/stats")
async def admin_stats(user: dict = Depends(require_role("admin"))):
    users_count = await db.users.count_documents({})
    specialists_count = await db.users.count_documents({"role": "specialist"})
    verified_count = await db.users.count_documents({"role": "specialist", "verified": True})
    pending_count = await db.users.count_documents({"role": "specialist", "verified": False})
    active_jobs = await db.requests.count_documents({"status": {"$in": ["assigned", "in_progress"]}})
    completed_jobs = await db.requests.count_documents({"status": "confirmed"})
    return {
        "users": users_count,
        "specialists": specialists_count,
        "verified": verified_count,
        "pending_verification": pending_count,
        "active_jobs": active_jobs,
        "completed_jobs": completed_jobs
    }

@api.get("/admin/analytics")
async def admin_analytics(days: int = 14, user: dict = Depends(require_role("admin"))):
    """Live analytics: time-series of jobs/disputes/users + breakdowns by category/status"""
    if days < 1 or days > 90:
        days = 14
    now = datetime.now(timezone.utc)
    start = now - timedelta(days=days)
    start_iso = start.isoformat()

    # Time-series via single aggregation pipeline per collection (batch-optimized)
    async def daily_buckets(collection, date_field):
        pipeline = [
            {"$match": {date_field: {"$gte": start_iso}}},
            {"$project": {"day": {"$substr": [f"${date_field}", 0, 10]}}},
            {"$group": {"_id": "$day", "count": {"$sum": 1}}},
        ]
        docs = await collection.aggregate(pipeline).to_list(200)
        return {d["_id"]: d["count"] for d in docs}

    jobs_created_map, jobs_confirmed_map, users_map, disputes_map = await asyncio.gather(
        daily_buckets(db.requests, "created_at"),
        daily_buckets(db.requests, "confirmed_at"),
        daily_buckets(db.users, "created_at"),
        daily_buckets(db.disputes, "created_at"),
    )

    series = []
    for i in range(days):
        day = (start + timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        key = day.strftime("%Y-%m-%d")
        series.append({
            "date": day.strftime("%d %b"),
            "jobs_created": jobs_created_map.get(key, 0),
            "jobs_confirmed": jobs_confirmed_map.get(key, 0),
            "users": users_map.get(key, 0),
            "disputes": disputes_map.get(key, 0),
        })

    # Category + status breakdowns (parallel)
    cat_pipeline = [
        {"$match": {"created_at": {"$gte": start_iso}}},
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    status_pipeline = [{"$group": {"_id": "$status", "count": {"$sum": 1}}}]

    cat_docs, status_docs, confirmed_requests, leads_count, disputes_total, disputes_open, disputes_resolved = await asyncio.gather(
        db.requests.aggregate(cat_pipeline).to_list(20),
        db.requests.aggregate(status_pipeline).to_list(20),
        db.requests.find({"status": "confirmed", "escrow_amount": {"$gt": 0}, "confirmed_at": {"$gte": start_iso}}).to_list(2000),
        db.requests.count_documents({"specialist_id": {"$ne": None}, "assigned_at": {"$gte": start_iso}}),
        db.disputes.count_documents({}),
        db.disputes.count_documents({"status": "open"}),
        db.disputes.count_documents({"status": "resolved"}),
    )

    by_category = [{"name": (d["_id"] or "other"), "value": d["count"]} for d in cat_docs]
    by_status = [{"name": d["_id"] or "unknown", "value": d["count"]} for d in status_docs]

    gmv = sum((r.get("escrow_amount") or 0) for r in confirmed_requests)
    platform_revenue_fees = gmv * 0.05
    lead_fees = leads_count * 45.0
    avg_job_value = (gmv / len(confirmed_requests)) if confirmed_requests else 0

    # Top specialists - batch lookup users in 1 query
    top_pipeline = [
        {"$match": {"status": "confirmed", "specialist_id": {"$ne": None}}},
        {"$group": {"_id": "$specialist_id", "jobs": {"$sum": 1}, "revenue": {"$sum": "$escrow_amount"}}},
        {"$sort": {"jobs": -1}},
        {"$limit": 5},
    ]
    top_docs = await db.requests.aggregate(top_pipeline).to_list(5)
    spec_ids = [ObjectId(t["_id"]) for t in top_docs if t.get("_id")]
    specs_lookup = {}
    if spec_ids:
        async for sp in db.users.find({"_id": {"$in": spec_ids}}):
            specs_lookup[str(sp["_id"])] = sp
    top_specialists = []
    for t in top_docs:
        sp = specs_lookup.get(t.get("_id"))
        if sp:
            top_specialists.append({
                "id": str(sp["_id"]),
                "name": sp.get("name", "—"),
                "specialty": sp.get("specialty"),
                "rating": sp.get("rating"),
                "jobs": t["jobs"],
                "revenue": t["revenue"],
            })

    return {
        "series": series,
        "by_category": by_category,
        "by_status": by_status,
        "gmv": round(gmv, 2),
        "platform_revenue": round(platform_revenue_fees + lead_fees, 2),
        "lead_fees": round(lead_fees, 2),
        "avg_job_value": round(avg_job_value, 2),
        "disputes": {"total": disputes_total, "open": disputes_open, "resolved": disputes_resolved},
        "top_specialists": top_specialists,
    }

@api.get("/admin/specialists/pending")
async def pending_specialists(user: dict = Depends(require_role("admin"))):
    docs = await db.users.find({"role": "specialist", "verified": False}).to_list(100)
    return [serialize_doc(d) for d in docs]

@api.post("/admin/specialists/{spec_id}/verify")
async def verify_specialist(spec_id: str, user: dict = Depends(require_role("admin"))):
    spec = await db.users.find_one({"_id": ObjectId(spec_id), "role": "specialist"})
    if not spec:
        raise HTTPException(404, "Specialist not found")
    await db.users.update_one(
        {"_id": ObjectId(spec_id), "role": "specialist"},
        {"$set": {"verified": True, "tier": "VERIFIED"}}
    )
    await notify(spec_id, "Cont verificat ✓", "Felicitări! Contul tău este acum VERIFIED. Ai acces la marketplace-ul de premium leads.", type_="verification", link="/specialist")
    await send_template(tpl_specialist_verified, spec.get("name"), to=spec.get("email"))
    return {"ok": True}

@api.get("/admin/disputes")
async def list_disputes(user: dict = Depends(require_role("admin"))):
    docs = await db.disputes.find({}).sort("created_at", -1).to_list(50)
    # Batch enrich: collect all request_ids then fetch in 1 query, same for users
    req_ids = [ObjectId(d["request_id"]) for d in docs if d.get("request_id")]
    reqs_map = {}
    user_ids_set = set()
    if req_ids:
        async for r in db.requests.find({"_id": {"$in": req_ids}}):
            reqs_map[str(r["_id"])] = r
            if r.get("client_id"): user_ids_set.add(r["client_id"])
            if r.get("specialist_id"): user_ids_set.add(r["specialist_id"])
    users_map = {}
    if user_ids_set:
        async for u2 in db.users.find({"_id": {"$in": [ObjectId(uid) for uid in user_ids_set]}}):
            users_map[str(u2["_id"])] = u2
    out = []
    for d in docs:
        d = serialize_doc(d)
        req = reqs_map.get(d.get("request_id"))
        if req:
            d["request_title"] = req.get("title")
            d["request_status"] = req.get("status")
            d["escrow_amount"] = req.get("escrow_amount", 0)
            client_u = users_map.get(req.get("client_id"))
            spec_u = users_map.get(req.get("specialist_id"))
            d["client_name"] = client_u.get("name") if client_u else None
            d["specialist_name"] = spec_u.get("name") if spec_u else None
        out.append(d)
    return out

@api.get("/admin/specialists/{spec_id}")
async def admin_specialist_detail(spec_id: str, user: dict = Depends(require_role("admin"))):
    doc = await db.users.find_one({"_id": ObjectId(spec_id), "role": "specialist"})
    if not doc:
        raise HTTPException(404, "Specialist not found")
    return serialize_doc(doc)

@api.post("/admin/specialists/{spec_id}/reject")
async def reject_specialist(spec_id: str, data: SpecialistRejectIn, user: dict = Depends(require_role("admin"))):
    spec = await db.users.find_one({"_id": ObjectId(spec_id), "role": "specialist"})
    if not spec:
        raise HTTPException(404, "Specialist not found")
    await db.users.update_one(
        {"_id": ObjectId(spec_id)},
        {"$set": {
            "verified": False,
            "tier": "REJECTED",
            "rejection_reason": data.reason,
            "rejected_at": datetime.now(timezone.utc).isoformat(),
            "rejected_by": user["id"],
        }}
    )
    await notify(spec_id, "Verificare respinsă", f"Cererea de verificare a fost respinsă. Motiv: {data.reason}", type_="verification", link="/specialist")
    return {"ok": True}

@api.post("/admin/specialists/{spec_id}/documents/{doc_id}/review")
async def review_specialist_document(spec_id: str, doc_id: str, data: DocumentReviewIn, user: dict = Depends(require_role("admin"))):
    spec = await db.users.find_one({"_id": ObjectId(spec_id), "role": "specialist"})
    if not spec:
        raise HTTPException(404, "Specialist not found")
    docs = spec.get("documents") or []
    found = False
    for d in docs:
        if d.get("id") == doc_id:
            d["status"] = data.status
            d["reason"] = data.reason
            d["validated_at"] = datetime.now(timezone.utc).isoformat()
            d["validated_by"] = user["id"]
            found = True
            break
    if not found:
        raise HTTPException(404, "Document not found")
    await db.users.update_one({"_id": ObjectId(spec_id)}, {"$set": {"documents": docs}})
    title = "Document aprobat" if data.status == "approved" else "Document respins"
    msg = f"Documentul '{next((d['name'] for d in docs if d.get('id')==doc_id), '')}' a fost {('aprobat' if data.status=='approved' else 'respins')}."
    if data.reason:
        msg += f" Motiv: {data.reason}"
    await notify(spec_id, title, msg, type_="verification", link="/specialist")
    return {"ok": True}

# ============= SPECIALIST DOCUMENTS (self-upload) =============
@api.get("/specialist/documents")
async def list_my_documents(user: dict = Depends(require_role("specialist"))):
    spec = await db.users.find_one({"_id": ObjectId(user["id"])})
    return spec.get("documents") or []

@api.post("/specialist/documents")
async def upload_document(data: DocumentIn, user: dict = Depends(require_role("specialist"))):
    # Cap document payload size to prevent BSON overflow (each doc ≤ 4MB; array stays well under 16MB)
    if len(data.url) > 5_500_000:  # ~4MB base64 encoded
        raise HTTPException(413, "Document depășește 4MB. Folosește un fișier mai mic.")
    spec = await db.users.find_one({"_id": ObjectId(user["id"])})
    if len(spec.get("documents") or []) >= 20:
        raise HTTPException(400, "Maximum 20 documente. Șterge documente vechi pentru a încărca altele noi.")
    doc = {
        "id": str(uuid.uuid4()),
        "type": data.type,
        "name": data.name,
        "url": data.url,
        "status": "pending",
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.update_one(
        {"_id": ObjectId(user["id"])},
        {"$push": {"documents": doc}}
    )
    return doc

@api.delete("/specialist/documents/{doc_id}")
async def delete_document(doc_id: str, user: dict = Depends(require_role("specialist"))):
    await db.users.update_one(
        {"_id": ObjectId(user["id"])},
        {"$pull": {"documents": {"id": doc_id}}}
    )
    return {"ok": True}

# ============= DISPUTES =============
@api.post("/requests/{req_id}/dispute")
async def open_dispute(req_id: str, data: DisputeOpenIn, user: dict = Depends(get_current_user)):
    """Client or assigned specialist opens a dispute on a job"""
    req = await db.requests.find_one({"_id": ObjectId(req_id)})
    if not req:
        raise HTTPException(404, "Request not found")
    # Authorization: must be the request's client or the assigned specialist
    role = None
    if req.get("client_id") == user["id"]:
        role = "client"
    elif req.get("specialist_id") == user["id"]:
        role = "specialist"
    else:
        raise HTTPException(403, "Not allowed")
    # Only allow disputes on jobs that have funds in escrow or work started
    if req.get("status") not in ["assigned", "in_progress", "completed"]:
        raise HTTPException(400, "Disputes can only be opened on active jobs")
    # Block dispute after escrow is released (prevents race with client.confirm())
    if req.get("escrow_status") == "released":
        raise HTTPException(400, "Plata a fost deja eliberată din escrow - dispută indisponibilă")
    # Prevent duplicates
    existing = await db.disputes.find_one({"request_id": req_id, "status": "open"})
    if existing:
        raise HTTPException(400, "An open dispute already exists for this job")
    dispute = {
        "request_id": req_id,
        "opened_by": user["id"],
        "opened_by_role": role,
        "opened_by_name": user.get("name"),
        "reason": data.reason,
        "evidence_urls": data.evidence_urls or [],
        "status": "open",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    result = await db.disputes.insert_one(dispute)
    # Mark request as disputed
    await db.requests.update_one(
        {"_id": ObjectId(req_id)},
        {"$set": {"disputed": True, "escrow_status": "frozen"}}
    )
    # Notify the other party + admin (best-effort: pick first admin)
    other_user_id = req.get("specialist_id") if role == "client" else req.get("client_id")
    other_user_doc = None
    if other_user_id:
        other_user_doc = await db.users.find_one({"_id": ObjectId(other_user_id)})
        await notify(other_user_id, "Dispută deschisă", f"O dispută a fost deschisă pe lucrarea '{req.get('title','')}'. Echipa admin va analiza cazul.", type_="dispute", link="/" + ("specialist" if role == "client" else "client"))
        if other_user_doc and other_user_doc.get("email"):
            await send_template(
                tpl_dispute_opened,
                other_user_doc.get("name", ""),
                req.get("title", ""),
                role,
                data.reason,
                "specialist" if role == "client" else "client",
                to=other_user_doc["email"],
            )
    admins = await db.users.find({"role": "admin"}).to_list(10)
    for a in admins:
        await notify(str(a["_id"]), "Nouă dispută", f"Dispută deschisă pe '{req.get('title','')}' de către {role}.", type_="dispute", link="/admin")
    await log_event(req_id, "dispute.opened", actor=user, payload={"reason": data.reason[:200], "opened_by_role": role})
    return {"ok": True, "id": str(result.inserted_id)}

@api.get("/requests/{req_id}/dispute")
async def get_dispute_for_request(req_id: str, user: dict = Depends(get_current_user)):
    req = await db.requests.find_one({"_id": ObjectId(req_id)})
    if not req:
        raise HTTPException(404, "Request not found")
    if user["id"] not in [req.get("client_id"), req.get("specialist_id")] and user.get("role") != "admin":
        raise HTTPException(403, "Not allowed")
    doc = await db.disputes.find_one({"request_id": req_id})
    return serialize_doc(doc) if doc else None

@api.post("/admin/disputes/{dispute_id}/resolve")
async def resolve_dispute(dispute_id: str, data: DisputeResolveIn, user: dict = Depends(require_role("admin"))):
    dispute = await db.disputes.find_one({"_id": ObjectId(dispute_id)})
    if not dispute:
        raise HTTPException(404, "Dispute not found")
    if dispute.get("status") != "open":
        raise HTTPException(400, "Dispute already resolved")
    req = await db.requests.find_one({"_id": ObjectId(dispute["request_id"])})
    if not req:
        raise HTTPException(404, "Request not found")
    amount = req.get("escrow_amount") or 0
    client_id = req.get("client_id")
    specialist_id = req.get("specialist_id")
    
    if data.resolution == "refund_client":
        client_amount = amount
        specialist_amount = 0
    elif data.resolution == "pay_specialist":
        client_amount = 0
        specialist_amount = amount * 0.95  # 5% platform fee
    elif data.resolution == "split":
        pct = data.client_pct if data.client_pct is not None else 50
        if pct < 0 or pct > 100:
            raise HTTPException(400, "client_pct must be 0..100")
        client_amount = amount * (pct / 100)
        specialist_amount = (amount - client_amount) * 0.95
    else:
        raise HTTPException(400, "Invalid resolution")
    
    now_iso = datetime.now(timezone.utc).isoformat()
    if client_amount > 0 and client_id:
        await db.users.update_one({"_id": ObjectId(client_id)}, {"$inc": {"wallet_balance": client_amount}})
        await db.transactions.insert_one({
            "user_id": client_id, "type": "dispute_refund", "amount": client_amount,
            "request_id": dispute["request_id"], "created_at": now_iso,
        })
    if specialist_amount > 0 and specialist_id:
        await db.users.update_one({"_id": ObjectId(specialist_id)}, {"$inc": {"wallet_balance": specialist_amount}})
        await db.transactions.insert_one({
            "user_id": specialist_id, "type": "dispute_payment", "amount": specialist_amount,
            "request_id": dispute["request_id"], "created_at": now_iso,
        })
    
    await db.disputes.update_one(
        {"_id": ObjectId(dispute_id)},
        {"$set": {
            "status": "resolved",
            "resolution": data.resolution,
            "client_pct": data.client_pct,
            "client_amount": client_amount,
            "specialist_amount": specialist_amount,
            "notes": data.notes,
            "resolved_at": now_iso,
            "resolved_by": user["id"],
        }}
    )
    await db.requests.update_one(
        {"_id": ObjectId(dispute["request_id"])},
        {"$set": {"status": "confirmed", "escrow_status": "released", "disputed": False, "confirmed_at": now_iso}}
    )
    # Notify both parties
    if client_id:
        client_u = await db.users.find_one({"_id": ObjectId(client_id)})
        await notify(client_id, "Dispută rezolvată", f"Dispută rezolvată. Rambursare: {client_amount:.2f} RON.", type_="dispute", link="/client")
        if client_u and client_u.get("email") and client_amount > 0:
            await send_template(tpl_dispute_resolved, client_u.get("name", ""), req.get("title", ""), client_amount, "client", to=client_u["email"])
    if specialist_id:
        spec_u = await db.users.find_one({"_id": ObjectId(specialist_id)})
        await notify(specialist_id, "Dispută rezolvată", f"Dispută rezolvată. Plată: {specialist_amount:.2f} RON.", type_="dispute", link="/specialist")
        if spec_u and spec_u.get("email") and specialist_amount > 0:
            await send_template(tpl_dispute_resolved, spec_u.get("name", ""), req.get("title", ""), specialist_amount, "specialist", to=spec_u["email"])
    await log_event(dispute["request_id"], "dispute.resolved", actor=user,
                    payload={"client_amount": client_amount, "specialist_amount": specialist_amount, "client_pct": data.client_pct, "resolution": data.resolution[:200]})
    return {"ok": True, "client_amount": client_amount, "specialist_amount": specialist_amount}

# ============= OPERATOR (Maintenance validation) =============
@api.get("/operator/queue")
async def operator_queue(user: dict = Depends(require_role("operator", "admin"))):
    """Pending maintenance logs awaiting validation"""
    docs = await db.maintenance_logs.find({"status": "pending"}).to_list(50)
    return [serialize_doc(d) for d in docs]

@api.post("/operator/logs/{log_id}/validate")
async def validate_log(log_id: str, action: str, user: dict = Depends(require_role("operator", "admin"))):
    if action not in ["approve", "reject"]:
        raise HTTPException(400, "Invalid action")
    await db.maintenance_logs.update_one(
        {"_id": ObjectId(log_id)},
        {"$set": {"status": action, "validated_by": user["id"], "validated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"ok": True}

# ============= OPERATOR: DIGITAL TWIN =============
@api.post("/properties/{prop_id}/twin/request")
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

@api.get("/operator/twins")
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
        if prop:
            d["property_name"] = prop.get("name")
            d["property_address"] = prop.get("address")
            d["property_type"] = prop.get("type")
            d["property_surface"] = prop.get("surface")
            d["property_rooms"] = prop.get("rooms")
            owner = owners_map.get(prop.get("owner_id"))
            d["owner_name"] = owner.get("name") if owner else None
            d["owner_email"] = owner.get("email") if owner else None
        out.append(d)
    return out

@api.get("/operator/twins/{prop_id}")
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

@api.post("/operator/twins/{prop_id}")
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

@api.post("/operator/twins/{prop_id}/validate")
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
    await log_event(None, "twin.validated", actor=user, property_id=prop_id,
                    payload={"action": data.action, "new_status": new_status, "notes": (data.notes or "")[:200]})
    return {"ok": True, "status": new_status}

# ============= INTERIOR DESIGN (eligible only for clients with Digital Twin unlocked) =============

@api.get("/design/eligibility")
async def design_eligibility(user: dict = Depends(require_role("client"))):
    """Returns user's properties with twin_unlocked + rooms list per property."""
    props = await db.properties.find({"owner_id": user["id"], "twin_unlocked": True}).to_list(20)
    if not props:
        return {"eligible": False, "reason": "no_twin_unlocked", "properties": []}
    out = []
    for p in props:
        prop_id_str = str(p["_id"])
        twin = await db.twins.find_one({"property_id": prop_id_str, "status": "approved"})
        rooms = (twin or {}).get("rooms") or []
        out.append({
            "id": prop_id_str,
            "name": p.get("name"),
            "address": p.get("address"),
            "surface": p.get("surface"),
            "rooms": [{"id": r.get("id"), "name": r.get("name"), "type": r.get("type"), "area": r.get("area")} for r in rooms],
        })
    return {
        "eligible": True,
        "properties": out,
        "concept_price_per_room": DESIGN_CONCEPT_PRICE_PER_ROOM,
        "max_token_discount_pct": DESIGN_MAX_TOKEN_DISCOUNT_PCT,
        "available_tokens": user.get("tokens", 0),
    }

@api.post("/design/concept-request")
async def create_design_concept_request(data: DesignConceptIn, user: dict = Depends(require_role("client"))):
    """Create a design concept request after validating twin + room ids + tokens."""
    prop = await db.properties.find_one({"_id": ObjectId(data.property_id), "owner_id": user["id"]})
    if not prop:
        raise HTTPException(404, "Property not found")
    if not prop.get("twin_unlocked"):
        raise HTTPException(403, "Digital Twin nu este activat pentru această proprietate. Solicită activarea twin-ului mai întâi.")

    twin = await db.twins.find_one({"property_id": data.property_id, "status": "approved"})
    if not twin:
        raise HTTPException(403, "Digital Twin pentru proprietate nu este aprobat")

    twin_room_ids = {r.get("id") for r in (twin.get("rooms") or [])}
    invalid_rooms = [r for r in data.room_ids if r not in twin_room_ids]
    if invalid_rooms:
        raise HTTPException(400, f"Camere invalide: {', '.join(invalid_rooms)}")

    rooms_count = len(data.room_ids)
    full_price = DESIGN_CONCEPT_PRICE_PER_ROOM * rooms_count
    max_token_discount = full_price * (DESIGN_MAX_TOKEN_DISCOUNT_PCT / 100)
    tokens_to_use = max(0, min(data.tokens_to_use, int(max_token_discount), user.get("tokens", 0)))
    final_price = full_price - tokens_to_use

    # Snapshot room details for the request
    rooms_snapshot = []
    for rid in data.room_ids:
        r = next((x for x in twin.get("rooms", []) if x.get("id") == rid), None)
        if r:
            rooms_snapshot.append({"id": r.get("id"), "name": r.get("name"), "type": r.get("type"), "area": r.get("area")})

    desc_lines = [f"📐 Faza CONCEPT pentru {rooms_count} {'cameră' if rooms_count == 1 else 'camere'}:"]
    for r in rooms_snapshot:
        desc_lines.append(f"  • {r['name']} ({r['type']}, {r.get('area', 0)} m²)")
    desc_lines.append(f"\nPreț standard: {DESIGN_CONCEPT_PRICE_PER_ROOM:.0f} RON/cameră × {rooms_count} = {full_price:.0f} RON")
    if tokens_to_use > 0:
        desc_lines.append(f"Tokeni utilizați: -{tokens_to_use} RON")
    desc_lines.append(f"Preț final concept: {final_price:.0f} RON")
    if data.style_preference:
        desc_lines.append(f"\nStil preferat: {data.style_preference}")
    if data.notes:
        desc_lines.append(f"\nNote suplimentare: {data.notes}")
    desc_lines.append("\nDupă livrarea conceptului, specialistul va trimite oferte pentru faze ulterioare (proiect tehnic, execuție, achiziții) direct prin chat.")

    title = f"Design Interior - Concept ({rooms_count} {'cameră' if rooms_count == 1 else 'camere'})"
    now_iso = datetime.now(timezone.utc).isoformat()
    req_doc = {
        "client_id": user["id"],
        "client_name": user.get("name"),
        "property_id": data.property_id,
        "property_name": prop.get("name"),
        "category": "interior_design",
        "title": title,
        "description": "\n".join(desc_lines),
        "priority": "normal",
        "photos": [],
        "status": "open",
        "specialist_id": None,
        "specialist_name": None,
        "escrow_amount": 0,
        "escrow_status": "none",
        "budget_estimate": final_price,
        "design_concept": {
            "rooms": rooms_snapshot,
            "rooms_count": rooms_count,
            "full_price": full_price,
            "tokens_used": tokens_to_use,
            "final_price": final_price,
            "style_preference": data.style_preference,
        },
        "phases": [],
        "created_at": now_iso,
    }
    res = await db.requests.insert_one(req_doc)
    req_id = str(res.inserted_id)

    # Deduct tokens immediately + record transaction
    if tokens_to_use > 0:
        await db.users.update_one({"_id": ObjectId(user["id"])}, {"$inc": {"tokens": -tokens_to_use}})
        await db.transactions.insert_one({
            "user_id": user["id"], "type": "design_token_discount",
            "amount": 0, "tokens": -tokens_to_use,
            "request_id": req_id, "created_at": now_iso,
        })

    # Notify available interior_design specialists (idle/coverage match)
    matched_specs = await db.users.find({
        "role": "specialist",
        "verified": True,
        "service_categories": "interior_design",
    }).limit(20).to_list(20)
    for s in matched_specs:
        await notify(str(s["_id"]), "Lead Design Interior", f"Nouă cerere de concept design — {rooms_count} {'cameră' if rooms_count == 1 else 'camere'}, {final_price:.0f} RON", type_="lead", link="/specialist")

    req_doc["id"] = req_id
    req_doc.pop("_id", None)
    return req_doc


@api.post("/design/phase-quote")
async def create_phase_quote(data: DesignPhaseQuoteIn, user: dict = Depends(require_role("specialist"))):
    """Specialist proposes a follow-up phase quote on a design request."""
    req = await db.requests.find_one({"_id": ObjectId(data.request_id), "specialist_id": user["id"]})
    if not req:
        raise HTTPException(404, "Cererea nu există sau nu îți este asignată")
    if req.get("category") != "interior_design":
        raise HTTPException(400, "Quote-urile pe faze sunt disponibile doar pentru lucrări de Design Interior")
    if req.get("status") not in ["in_progress", "completed", "confirmed"]:
        raise HTTPException(400, "Faza concept trebuie să fie cel puțin în desfășurare pentru a propune faze ulterioare")

    quote = {
        "id": str(uuid.uuid4()),
        "phase_name": data.phase_name,
        "description": data.description,
        "price": data.price,
        "estimated_days": data.estimated_days,
        "status": "pending",  # pending | accepted | rejected | paid
        "created_at": datetime.now(timezone.utc).isoformat(),
        "specialist_id": user["id"],
    }
    await db.requests.update_one(
        {"_id": ObjectId(data.request_id)},
        {"$push": {"phases": quote}}
    )
    client_u = await db.users.find_one({"_id": ObjectId(req["client_id"])})
    await notify(req["client_id"], "Ofertă fază nouă", f"{user.get('name','Specialistul')} a propus o fază nouă: {data.phase_name} — {data.price:.0f} RON", type_="design_phase", link="/client")
    if client_u and client_u.get("email"):
        await send_template(
            tpl_design_phase_quote,
            client_u.get("name", ""),
            user.get("name", "Specialist"),
            req.get("title", ""),
            data.phase_name,
            data.price,
            data.estimated_days,
            data.description,
            to=client_u["email"],
        )
    return quote


@api.post("/design/phase-accept")
async def accept_phase_quote(data: DesignPhaseAcceptIn, request_id: str, user: dict = Depends(require_role("client"))):
    """Client accepts a phase quote — funds escrow from wallet (or via Stripe in future)."""
    req = await db.requests.find_one({"_id": ObjectId(request_id), "client_id": user["id"]})
    if not req:
        raise HTTPException(404, "Cerere inexistentă")
    phases = req.get("phases", [])
    quote = next((p for p in phases if p.get("id") == data.quote_id), None)
    if not quote:
        raise HTTPException(404, "Ofertă inexistentă")
    if quote.get("status") != "pending":
        raise HTTPException(400, "Această ofertă nu mai este disponibilă")

    if (user.get("wallet_balance") or 0) < quote["price"]:
        raise HTTPException(400, f"Sold insuficient. Necesar: {quote['price']:.0f} RON, Disponibil: {user.get('wallet_balance', 0):.0f} RON")

    now_iso = datetime.now(timezone.utc).isoformat()
    # Deduct from wallet, mark phase paid (held in escrow logically)
    await db.users.update_one({"_id": ObjectId(user["id"])}, {"$inc": {"wallet_balance": -quote["price"]}})
    await db.requests.update_one(
        {"_id": ObjectId(request_id), "phases.id": data.quote_id},
        {"$set": {"phases.$.status": "paid", "phases.$.paid_at": now_iso}}
    )
    await db.transactions.insert_one({
        "user_id": user["id"], "type": "design_phase_payment", "amount": -quote["price"],
        "request_id": request_id, "phase_id": data.quote_id, "created_at": now_iso,
    })
    await notify(quote["specialist_id"], "Plată fază confirmată", f"Clientul a achitat faza '{quote['phase_name']}' — {quote['price']:.0f} RON sunt în escrow", type_="design_phase", link="/specialist")
    return {"ok": True, "phase_id": data.quote_id}


@api.post("/design/phase-complete")
async def complete_phase(data: DesignPhaseAcceptIn, request_id: str, user: dict = Depends(require_role("client"))):
    """Client confirms phase completion — releases escrow to specialist wallet (95/5 split)."""
    req = await db.requests.find_one({"_id": ObjectId(request_id), "client_id": user["id"]})
    if not req:
        raise HTTPException(404, "Cerere inexistentă")
    phases = req.get("phases", [])
    quote = next((p for p in phases if p.get("id") == data.quote_id), None)
    if not quote:
        raise HTTPException(404, "Ofertă inexistentă")
    if quote.get("status") != "paid":
        raise HTTPException(400, "Această fază nu este în escrow")

    specialist_share = quote["price"] * 0.95
    now_iso = datetime.now(timezone.utc).isoformat()
    await db.users.update_one({"_id": ObjectId(quote["specialist_id"])}, {"$inc": {"wallet_balance": specialist_share}})
    await db.requests.update_one(
        {"_id": ObjectId(request_id), "phases.id": data.quote_id},
        {"$set": {"phases.$.status": "completed", "phases.$.completed_at": now_iso}}
    )
    await db.transactions.insert_one({
        "user_id": quote["specialist_id"], "type": "design_phase_payout", "amount": specialist_share,
        "request_id": request_id, "phase_id": data.quote_id, "created_at": now_iso,
    })
    await notify(quote["specialist_id"], "Fază finalizată", f"Faza '{quote['phase_name']}' confirmată — {specialist_share:.0f} RON adăugați în portofel", type_="design_phase", link="/specialist")
    return {"ok": True, "released_amount": specialist_share}


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

@api.get("/specialists/{spec_id}/portfolio")
async def list_portfolio(spec_id: str):
    """Public: list portfolio items of any specialist (no auth required)."""
    docs = await db.portfolio.find({"specialist_id": spec_id}).sort("created_at", -1).to_list(50)
    return [serialize_doc(d) for d in docs]

@api.get("/specialist/portfolio")
async def my_portfolio(user: dict = Depends(require_role("specialist"))):
    """List own portfolio items."""
    docs = await db.portfolio.find({"specialist_id": user["id"]}).sort("created_at", -1).to_list(50)
    return [serialize_doc(d) for d in docs]

@api.post("/specialist/portfolio")
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

@api.put("/specialist/portfolio/{item_id}")
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

@api.delete("/specialist/portfolio/{item_id}")
async def delete_portfolio_item(item_id: str, user: dict = Depends(require_role("specialist"))):
    res = await db.portfolio.delete_one({"_id": ObjectId(item_id), "specialist_id": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(404, "Item not found")
    return {"ok": True}


# ============= GOOGLE OAUTH (Emergent-managed) =============
# REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH

@api.post("/auth/google/session")
async def google_session_exchange(request: Request, response: Response):
    """Exchange Emergent session_id for our JWT cookie + user record"""
    session_id = request.headers.get("X-Session-ID")
    if not session_id:
        raise HTTPException(400, "Missing X-Session-ID header")
    
    # Call Emergent Auth backend
    async with httpx.AsyncClient(timeout=10) as http_client:
        try:
            r = await http_client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_id}
            )
            r.raise_for_status()
            data = r.json()
        except Exception as e:
            raise HTTPException(401, f"Invalid Emergent session: {e}")
    
    email = data.get("email", "").lower()
    name = data.get("name", "")
    picture = data.get("picture", "")
    
    # Find or create user
    existing = await db.users.find_one({"email": email})
    if existing:
        # Update picture/name if changed
        await db.users.update_one(
            {"_id": existing["_id"]},
            {"$set": {"picture": picture, "name": name, "google_auth": True}}
        )
        user = await db.users.find_one({"_id": existing["_id"]})
        uid = str(user["_id"])
    else:
        # Create new user as client by default
        new_user = {
            "email": email,
            "name": name,
            "picture": picture,
            "role": "client",
            "google_auth": True,
            "password_hash": "",  # No password for OAuth users
            "wallet_balance": 0.0,
            "tokens": 0,
            "rating": None,
            "reviews_count": 0,
            "verified": False,
            "tier": None,
            "phone": "",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        result = await db.users.insert_one(new_user)
        uid = str(result.inserted_id)
        user = new_user
        user["_id"] = result.inserted_id
    
    # Issue our JWT tokens (same cookies as email/password flow)
    access = create_access_token(uid, email, user.get("role", "client"))
    refresh = create_refresh_token(uid)
    set_auth_cookies(response, access, refresh)
    return serialize_doc(user)


# ============= STRIPE ESCROW =============

STRIPE_KEY = os.environ.get("STRIPE_API_KEY", "sk_test_emergent")
# Demo mode if key is the Emergent placeholder or doesn't look like a real Stripe key
DEMO_STRIPE = (STRIPE_KEY == "sk_test_emergent") or (not STRIPE_KEY.startswith(("sk_test_", "sk_live_")))

@api.post("/payments/checkout-session")
async def create_checkout_session(request_id: str, request: Request, user: dict = Depends(require_role("client"))):
    """Create Stripe Checkout session for escrow funding (real or demo)"""
    req = await db.requests.find_one({"_id": ObjectId(request_id), "client_id": user["id"]})
    if not req:
        raise HTTPException(404, "Request not found")
    if req.get("status") not in ["open", "assigned"]:
        raise HTTPException(400, "Request not eligible for payment")

    # Amount is SERVER-SIDE only (security) - derived from request budget
    amount = float(req.get("budget_estimate") or 100.0)
    if amount <= 0 or amount > 100000:
        raise HTTPException(400, "Invalid amount")

    # Origin from frontend (used for redirect URLs)
    origin = request.headers.get("origin") or request.headers.get("referer", "").rstrip("/")
    if not origin:
        raise HTTPException(400, "Missing origin header")

    # DEMO mode: stripe_test_emergent placeholder - simulate success
    if DEMO_STRIPE:
        fake_session_id = f"cs_demo_{uuid.uuid4().hex[:16]}"
        now_iso = datetime.now(timezone.utc).isoformat()
        await db.payment_transactions.insert_one({
            "session_id": fake_session_id,
            "request_id": request_id,
            "client_id": user["id"],
            "user_email": user.get("email"),
            "amount": amount,
            "currency": "ron",
            "status": "completed",
            "payment_status": "paid",
            "metadata": {"request_id": request_id, "client_id": user["id"]},
            "demo": True,
            "created_at": now_iso,
            "completed_at": now_iso,
        })
        await db.requests.update_one(
            {"_id": ObjectId(request_id)},
            {"$set": {"escrow_amount": amount, "escrow_status": "held", "paid_at": now_iso}}
        )
        await db.transactions.insert_one({
            "user_id": user["id"], "type": "escrow_deposit", "amount": -amount,
            "request_id": request_id, "session_id": fake_session_id, "demo": True,
            "created_at": now_iso,
        })
        await log_event(request_id, "escrow.paid", actor=user, payload={"amount": amount, "demo_mode": True})
        # Notify specialist + email
        if req.get("specialist_id"):
            spec_u = await db.users.find_one({"_id": ObjectId(req["specialist_id"])})
            if spec_u and spec_u.get("email"):
                await send_template(
                    tpl_escrow_funded, spec_u.get("name", ""), req.get("title", ""), amount, user.get("name", "Client"),
                    to=spec_u["email"],
                )
        return {"checkout_url": f"{origin}/client?payment=success&request={request_id}&session_id={fake_session_id}&demo=1", "session_id": fake_session_id, "demo_mode": True}

    # REAL Stripe via emergentintegrations
    host_url = origin
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_KEY, webhook_url=webhook_url)
    success_url = f"{origin}/client?payment=success&request={request_id}&session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/client?payment=cancelled&request={request_id}"
    checkout_req = CheckoutSessionRequest(
        amount=amount,
        currency="ron",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "request_id": request_id,
            "client_id": user["id"],
            "specialist_id": req.get("specialist_id") or "",
        },
    )
    try:
        session = await stripe_checkout.create_checkout_session(checkout_req)
    except Exception as e:
        raise HTTPException(500, f"Stripe error: {str(e)}")

    now_iso = datetime.now(timezone.utc).isoformat()
    await db.payment_transactions.insert_one({
        "session_id": session.session_id,
        "request_id": request_id,
        "client_id": user["id"],
        "user_email": user.get("email"),
        "amount": amount,
        "currency": "ron",
        "status": "initiated",
        "payment_status": "pending",
        "metadata": checkout_req.metadata,
        "created_at": now_iso,
    })
    return {"checkout_url": session.url, "session_id": session.session_id}


@api.get("/payments/status/{session_id}")
async def payment_status(session_id: str, request: Request, user: dict = Depends(get_current_user)):
    """Poll Stripe Checkout status. Idempotent: only fulfills escrow once."""
    payment = await db.payment_transactions.find_one({"session_id": session_id})
    if not payment:
        raise HTTPException(404, "Payment session not found")

    # Demo short-circuit
    if payment.get("demo"):
        return {
            "status": "complete",
            "payment_status": "paid",
            "amount": payment["amount"],
            "currency": payment.get("currency", "ron"),
            "request_id": payment["request_id"],
            "demo_mode": True,
        }

    # Idempotency: if already completed, return cached
    if payment.get("status") == "completed" and payment.get("payment_status") == "paid":
        return {
            "status": "complete",
            "payment_status": "paid",
            "amount": payment["amount"],
            "currency": payment.get("currency", "ron"),
            "request_id": payment["request_id"],
        }

    origin = request.headers.get("origin") or request.headers.get("referer", "").rstrip("/") or ""
    stripe_checkout = StripeCheckout(api_key=STRIPE_KEY, webhook_url=f"{origin}/api/webhook/stripe")
    try:
        status_resp = await stripe_checkout.get_checkout_status(session_id)
    except Exception as e:
        raise HTTPException(500, f"Stripe error: {e}")

    now_iso = datetime.now(timezone.utc).isoformat()
    payment_status_val = status_resp.payment_status
    session_status = status_resp.status

    # Fulfill on first 'paid' transition only
    if payment_status_val == "paid" and payment.get("payment_status") != "paid":
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {
                "status": "completed",
                "payment_status": "paid",
                "completed_at": now_iso,
            }}
        )
        await db.requests.update_one(
            {"_id": ObjectId(payment["request_id"])},
            {"$set": {"escrow_amount": payment["amount"], "escrow_status": "held", "paid_at": now_iso}}
        )
        await db.transactions.insert_one({
            "user_id": payment["client_id"],
            "type": "escrow_deposit",
            "amount": -payment["amount"],
            "request_id": payment["request_id"],
            "session_id": session_id,
            "created_at": now_iso,
        })
        # Log activity event (system actor since this happens after Stripe redirect)
        try:
            client_doc = await db.users.find_one({"_id": ObjectId(payment["client_id"])})
            await log_event(payment["request_id"], "escrow.paid",
                            actor={"id": payment["client_id"], "name": client_doc.get("name") if client_doc else "Client", "role": "client"},
                            payload={"amount": payment["amount"], "session_id": session_id})
        except Exception:
            pass
    elif session_status == "expired":
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {"status": "expired", "payment_status": "unpaid"}}
        )

    return {
        "status": session_status,
        "payment_status": payment_status_val,
        "amount": payment["amount"],
        "currency": payment.get("currency", "ron"),
        "request_id": payment["request_id"],
    }


@api.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events for payment confirmation"""
    if DEMO_STRIPE:
        return {"received": True, "demo": True}
    body = await request.body()
    signature = request.headers.get("Stripe-Signature", "")
    origin = request.headers.get("origin") or ""
    stripe_checkout = StripeCheckout(api_key=STRIPE_KEY, webhook_url=f"{origin}/api/webhook/stripe")
    try:
        evt = await stripe_checkout.handle_webhook(body, signature)
    except Exception as e:
        raise HTTPException(400, f"Webhook error: {e}")
    if evt.payment_status == "paid":
        payment = await db.payment_transactions.find_one({"session_id": evt.session_id})
        if payment and payment.get("payment_status") != "paid":
            now_iso = datetime.now(timezone.utc).isoformat()
            await db.payment_transactions.update_one(
                {"session_id": evt.session_id},
                {"$set": {"status": "completed", "payment_status": "paid", "completed_at": now_iso}}
            )
            await db.requests.update_one(
                {"_id": ObjectId(payment["request_id"])},
                {"$set": {"escrow_amount": payment["amount"], "escrow_status": "held", "paid_at": now_iso}}
            )
            await db.transactions.insert_one({
                "user_id": payment["client_id"], "type": "escrow_deposit", "amount": -payment["amount"],
                "request_id": payment["request_id"], "session_id": evt.session_id, "via_webhook": True,
                "created_at": now_iso,
            })
    return {"received": True, "event_type": evt.event_type, "session_id": evt.session_id}


# ============= WEBSOCKET CHAT =============

class ConnectionManager:
    def __init__(self):
        # request_id -> list of (user_id, websocket)
        self.active: Dict[str, List[tuple]] = {}
    
    async def connect(self, request_id: str, user_id: str, ws: WebSocket):
        await ws.accept()
        self.active.setdefault(request_id, []).append((user_id, ws))
    
    def disconnect(self, request_id: str, ws: WebSocket):
        if request_id in self.active:
            self.active[request_id] = [(u, w) for u, w in self.active[request_id] if w != ws]
            if not self.active[request_id]:
                del self.active[request_id]
    
    async def broadcast(self, request_id: str, message: dict):
        if request_id not in self.active:
            return
        dead = []
        for uid, ws in self.active[request_id]:
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for w in dead:
            self.disconnect(request_id, w)

manager = ConnectionManager()


@api.get("/chat/{request_id}/messages")
async def get_messages(request_id: str, user: dict = Depends(get_current_user)):
    """Get chat history for a request (client or assigned specialist only)"""
    req = await db.requests.find_one({"_id": ObjectId(request_id)})
    if not req:
        raise HTTPException(404, "Request not found")
    if user["role"] == "client" and req.get("client_id") != user["id"]:
        raise HTTPException(403, "Not your request")
    if user["role"] == "specialist" and req.get("specialist_id") != user["id"]:
        raise HTTPException(403, "Not assigned to you")
    
    msgs = await db.chat_messages.find({"request_id": request_id}).sort("timestamp", 1).to_list(200)
    return [serialize_doc(m) for m in msgs]


@app.websocket("/api/ws/chat/{request_id}")
async def chat_ws(websocket: WebSocket, request_id: str):
    """WebSocket endpoint for real-time chat. Auth via token query param."""
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4001)
        return
    
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        uid = payload["sub"]
        user = await db.users.find_one({"_id": ObjectId(uid)})
        if not user:
            await websocket.close(code=4001); return
        user_id = str(user["_id"])
        user_name = user.get("name", "User")
        user_role = user.get("role", "client")
    except Exception:
        await websocket.close(code=4001)
        return
    
    # Verify access to request
    req = await db.requests.find_one({"_id": ObjectId(request_id)})
    if not req:
        await websocket.close(code=4004); return
    if user_role == "client" and req.get("client_id") != user_id:
        await websocket.close(code=4003); return
    if user_role == "specialist" and req.get("specialist_id") != user_id:
        await websocket.close(code=4003); return
    
    await manager.connect(request_id, user_id, websocket)
    try:
        # Send system message: user joined
        join_msg = {
            "type": "system",
            "text": f"{user_name} a intrat în conversație",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        await manager.broadcast(request_id, join_msg)
        
        while True:
            data = await websocket.receive_json()
            text = (data.get("text") or "").strip()
            if not text:
                continue
            msg = {
                "type": "message",
                "request_id": request_id,
                "user_id": user_id,
                "user_name": user_name,
                "user_role": user_role,
                "text": text[:2000],
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
            # Persist
            await db.chat_messages.insert_one(dict(msg))
            # Broadcast (without _id)
            await manager.broadcast(request_id, msg)
    except WebSocketDisconnect:
        manager.disconnect(request_id, websocket)
    except Exception as e:
        logger.error(f"WS error: {e}")
        manager.disconnect(request_id, websocket)


# ============= SPECIALIST PUBLIC PROFILE =============

@api.get("/specialists/{spec_id}/profile")
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


# ============= EMAIL / NOTIFICATIONS / ACTIVITY LOG — helpers moved to services.py =============

@api.get("/notifications")
async def list_notifications(user: dict = Depends(get_current_user)):
    """Get in-app notifications for current user"""
    docs = await db.notifications.find({"user_id": user["id"]}).sort("created_at", -1).limit(50).to_list(50)
    return [serialize_doc(d) for d in docs]


@api.post("/notifications/{notif_id}/read")
async def mark_read(notif_id: str, user: dict = Depends(get_current_user)):
    await db.notifications.update_one(
        {"_id": ObjectId(notif_id), "user_id": user["id"]},
        {"$set": {"read": True}}
    )
    return {"ok": True}


# ============= 2FA (TOTP) =============

@api.post("/auth/2fa/setup")
async def setup_2fa(user: dict = Depends(get_current_user)):
    """Generate TOTP secret + QR code for setup. Does NOT enable until verified."""
    secret = pyotp.random_base32()
    # Store as pending (not enabled until verified)
    await db.users.update_one(
        {"_id": ObjectId(user["id"])},
        {"$set": {"totp_pending_secret": secret}}
    )
    issuer = "PropManage"
    otp_uri = pyotp.TOTP(secret).provisioning_uri(name=user["email"], issuer_name=issuer)
    # Generate QR code as base64 data URL
    img = qrcode.make(otp_uri)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    qr_data_url = f"data:image/png;base64,{b64.b64encode(buf.getvalue()).decode()}"
    return {"secret": secret, "otp_uri": otp_uri, "qr_code": qr_data_url}


@api.post("/auth/2fa/verify")
async def verify_2fa(data: TotpVerifyIn, user: dict = Depends(get_current_user)):
    """Verify code and activate 2FA"""
    full_user = await db.users.find_one({"_id": ObjectId(user["id"])})
    secret = full_user.get("totp_pending_secret")
    if not secret:
        raise HTTPException(400, "No 2FA setup in progress")
    totp = pyotp.TOTP(secret)
    if not totp.verify(data.code, valid_window=1):
        raise HTTPException(401, "Invalid code")
    await db.users.update_one(
        {"_id": ObjectId(user["id"])},
        {"$set": {"totp_enabled": True, "totp_secret": secret}, "$unset": {"totp_pending_secret": ""}}
    )
    return {"ok": True, "enabled": True}


@api.post("/auth/2fa/disable")
async def disable_2fa(data: TotpVerifyIn, user: dict = Depends(get_current_user)):
    """Disable 2FA - requires current code"""
    full_user = await db.users.find_one({"_id": ObjectId(user["id"])})
    if not full_user.get("totp_enabled"):
        raise HTTPException(400, "2FA not enabled")
    totp = pyotp.TOTP(full_user["totp_secret"])
    if not totp.verify(data.code, valid_window=1):
        raise HTTPException(401, "Invalid code")
    await db.users.update_one(
        {"_id": ObjectId(user["id"])},
        {"$unset": {"totp_enabled": "", "totp_secret": ""}}
    )
    return {"ok": True, "enabled": False}


@api.get("/auth/2fa/status")
async def status_2fa(user: dict = Depends(get_current_user)):
    full_user = await db.users.find_one({"_id": ObjectId(user["id"])})
    return {"enabled": bool(full_user.get("totp_enabled"))}


# ============= AI ASSISTANT (Claude Haiku 4.5) =============

class AiChatIn(BaseModel):
    message: str
    session_id: Optional[str] = None  # client-managed for conversation continuity


def _build_system_prompt(role: str) -> str:
    base = """Ești PropManage Assistant, un AI util pentru utilizatorii platformei PropManage (Property Operating System).
Răspunzi concis, prietenos, în română.

Despre PropManage:
- Marketplace pentru servicii de mentenanță proprietăți (HVAC, electric, sanitar, alte categorii)
- 4 roluri: Client (proprietar), Specialist (tehnician), Operator (validator), Admin
- Wallet: bani reali pentru plăți, Tokens pentru recompense (+100/job confirmat, +20/review, +500/referral)
- Specialiști plătesc 40-50 RON per lead acceptat
- Plățile sunt securizate în Escrow până la confirmarea lucrării (5% comision platformă)
- Specialiști au tier-uri: ENTRY → VERIFIED (10+ joburi, rating 4.8+) → PREMIUM
- Digital Twin = replică 3D a proprietății cu istoric mentenanță și scor sănătate
"""
    if role == "client":
        return base + """
Ești specializat să ajuți CLIENTUL:
- Diagnoză probleme: dacă utilizatorul spune "AC nu mai răcește" → sugerează categoria HVAC, prioritate Urgent, buget estimat 200-500 RON
- Format răspuns pentru diagnoză: "Categorie: X | Prioritate: Y | Buget estimat: Z RON | Sugestie titlu: ..."
- Răspunde FAQ despre escrow, tokens, cum funcționează platforma
"""
    elif role == "specialist":
        return base + """
Ești specializat să ajuți SPECIALISTUL:
- Sfaturi pentru a deveni VERIFIED rapid
- Cum să răspunzi profesional la clienți
- Cum funcționează lead-urile și plata fee-ului
- Cum să-ți construiești reputația
"""
    return base + "Răspunde la întrebări generale despre platformă."


@api.post("/ai/chat")
async def ai_chat(data: AiChatIn, user: dict = Depends(get_current_user)):
    """AI Assistant chat using Claude Haiku 4.5 via Emergent LLM key"""
    if not EMERGENT_LLM_KEY:
        raise HTTPException(503, "AI Assistant not configured")
    
    session_id = data.session_id or f"{user['id']}:default"
    role = user.get("role", "client")
    
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=session_id,
            system_message=_build_system_prompt(role),
        ).with_model("anthropic", "claude-haiku-4-5-20251001")
        
        # Send to LLM (multi-turn history maintained by library)
        response_text = await chat.send_message(UserMessage(text=data.message))
        
        # Persist both messages only on success (no orphans)
        now = datetime.now(timezone.utc).isoformat()
        await db.ai_messages.insert_many([
            {"session_id": session_id, "user_id": user["id"], "role": "user", "text": data.message, "created_at": now},
            {"session_id": session_id, "user_id": user["id"], "role": "assistant", "text": response_text, "created_at": now},
        ])
        
        return {"reply": response_text, "session_id": session_id}
    except Exception as e:
        logger.error(f"AI chat error: {e}")
        # Friendly fallback message
        err_str = str(e)
        if "budget" in err_str.lower() or "exceeded" in err_str.lower():
            raise HTTPException(503, "AI Assistant indisponibil - cota a fost depășită. Contactează administratorul pentru a alimenta cheia.")
        raise HTTPException(500, f"AI error: {err_str}")


@api.get("/ai/history")
async def ai_history(session_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    sid = session_id or f"{user['id']}:default"
    msgs = await db.ai_messages.find({"session_id": sid, "user_id": user["id"]}).sort("created_at", 1).to_list(100)
    return [serialize_doc(m) for m in msgs]


# ============= PUBLIC MARKETPLACE =============

@api.get("/marketplace/specialists")
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


# ============= PROPERTY TIMELINE =============

@api.get("/properties/{prop_id}/timeline")
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


# ============= REGIONS / ZONES =============

@api.get("/regions")
async def list_regions():
    """List all regions (country/city/zone hierarchy)"""
    docs = await db.regions.find({}).sort("country", 1).to_list(500)
    return [serialize_doc(d) for d in docs]


@api.post("/regions")
async def create_region(data: RegionIn, user: dict = Depends(require_role("admin"))):
    existing = await db.regions.find_one({"country": data.country, "city": data.city, "zone": data.zone})
    if existing:
        return serialize_doc(existing)
    doc = {**data.model_dump(), "created_at": datetime.now(timezone.utc).isoformat()}
    res = await db.regions.insert_one(doc)
    doc["id"] = str(res.inserted_id)
    doc.pop("_id", None)
    return doc


@api.put("/specialists/me/zones")
async def update_specialist_zones(data: SpecialistZonesIn, user: dict = Depends(require_role("specialist"))):
    """Specialist defines coverage zones and service categories"""
    await db.users.update_one(
        {"_id": ObjectId(user["id"])},
        {"$set": {"coverage_zones": data.zones, "service_categories": data.categories}}
    )
    return {"ok": True, "zones": data.zones, "categories": data.categories}


@api.put("/specialists/me/availability")
async def update_availability(data: AvailabilityIn, user: dict = Depends(require_role("specialist"))):
    """Toggle availability status + define hours"""
    update = {"availability_status": data.status}
    if data.available_hours:
        update["available_hours"] = data.available_hours
    await db.users.update_one({"_id": ObjectId(user["id"])}, {"$set": update})
    return {"ok": True, "status": data.status}


# ============= SMART MATCHING (Zone-based with fallback) =============

async def find_matching_specialists(category: str, user_zone: str, max_results: int = 5):
    """Smart match: primary (in-zone) + fallback (nearby zones with fee)"""
    # Primary: specialists in user's zone with the category
    primary = await db.users.find({
        "role": "specialist",
        "coverage_zones": user_zone,
        "service_categories": category,
        "availability_status": {"$ne": "offline"},
    }).sort([("rating", -1), ("reviews_count", -1)]).limit(max_results).to_list(max_results)
    
    # Fallback: other specialists (out of zone) sorted by rating, marked as fallback
    if len(primary) < max_results:
        fallback_q = {
            "role": "specialist",
            "service_categories": category,
            "availability_status": {"$ne": "offline"},
            "coverage_zones": {"$ne": user_zone},
        }
        already_ids = [s["_id"] for s in primary]
        if already_ids:
            fallback_q["_id"] = {"$nin": already_ids}
        fallback = await db.users.find(fallback_q).sort([("rating", -1)]).limit(max_results - len(primary)).to_list(max_results)
        for s in fallback:
            s["_fallback"] = True
        primary.extend(fallback)
    
    # Annotate matches with reason
    results = []
    for s in primary:
        match_reason = []
        if s.get("_fallback"):
            match_reason.append("Zonă apropiată · fee aplicabil")
        else:
            match_reason.append("Specialist în zona ta")
        if s.get("availability_status") == "available":
            match_reason.append("Disponibil acum")
        if (s.get("rating") or 0) >= 4.8:
            match_reason.append(f"Top rated ({s.get('rating')}★)")
        if s.get("verified"):
            match_reason.append("Verificat")
        
        results.append({
            "id": str(s["_id"]),
            "name": s.get("name"),
            "rating": s.get("rating"),
            "reviews_count": s.get("reviews_count", 0),
            "specialty": s.get("specialty"),
            "tier": s.get("tier"),
            "verified": s.get("verified", False),
            "availability_status": s.get("availability_status", "available"),
            "is_in_zone": not s.get("_fallback", False),
            "match_reasons": match_reason,
            "lead_fee": 0 if not s.get("_fallback") else 45,
        })
    return results


@api.get("/match")
async def smart_match(category: str, zone: Optional[str] = None, user: dict = Depends(get_current_user)):
    """Get smart-matched specialists for a category in user's (or given) zone"""
    user_zone = zone or user.get("zone") or "default"
    matches = await find_matching_specialists(category, user_zone)
    return {
        "zone": user_zone,
        "category": category,
        "matches": matches,
        "total": len(matches),
        "in_zone_count": sum(1 for m in matches if m["is_in_zone"]),
    }


# ============= SERVICE AVAILABILITY (Admin-controlled per region) =============

@api.get("/services/availability")
async def get_service_availability(zone: Optional[str] = None, user: Optional[dict] = None):
    """Returns which services are available in user's zone"""
    # Public endpoint - no auth required for browsing
    q = {}
    if zone:
        q["zone"] = zone
    docs = await db.service_availability.find(q).to_list(200)
    
    # Default services if none configured
    default_services = ["plumbing", "electric", "hvac", "maintenance", "interior_design"]
    result = {}
    for s in default_services:
        result[s] = {"state": "active", "min_specialists": 1}
    for d in docs:
        if d.get("service"):
            result[d["service"]] = {
                "state": d.get("state", "active"),
                "min_specialists": d.get("min_specialists", 1),
                "region_id": d.get("region_id"),
            }
    return result


@api.post("/admin/services/availability")
async def set_service_availability(data: ServiceAvailabilityIn, user: dict = Depends(require_role("admin"))):
    """Admin: enable/disable/limit services per region"""
    await db.service_availability.update_one(
        {"region_id": data.region_id, "service": data.service},
        {"$set": {**data.model_dump(), "updated_by": user["id"], "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    return {"ok": True, **data.model_dump()}


@api.get("/admin/services")
async def admin_list_services(user: dict = Depends(require_role("admin"))):
    """Admin: list all service availability configurations"""
    docs = await db.service_availability.find({}).to_list(500)
    return [serialize_doc(d) for d in docs]


# ============= ROOT =============
@api.get("/")
async def root():
    return {"message": "PropManage API", "version": "1.0"}

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ============= SEED + DIGEST builders moved to seed.py / digest.py =============


# ============= DIGEST PREFERENCE & ADMIN TRIGGER =============
class DigestPrefIn(BaseModel):
    enabled: bool

@api.post("/auth/digest-preference")
async def set_digest_preference(data: DigestPrefIn, user: dict = Depends(get_current_user)):
    await db.users.update_one(
        {"_id": ObjectId(user["id"])},
        {"$set": {"digest_disabled": not data.enabled}}
    )
    return {"ok": True, "digest_disabled": not data.enabled}

@api.post("/admin/digest/trigger")
async def trigger_daily_digest(user: dict = Depends(require_role("admin"))):
    """Manual trigger for testing — sends today's digest to all eligible users."""
    counts = await run_daily_digests()
    return {"ok": True, "counts": counts}

@api.post("/auth/digest/preview")
async def preview_my_digest(user: dict = Depends(get_current_user)):
    """Preview the user's own digest without sending email (testing/debug)."""
    builder = DIGEST_BUILDERS.get(user.get("role"))
    if not builder:
        raise HTTPException(400, "Rol fără digest configurat.")
    digest = await builder(user)
    return digest or {"summary": "Niciun conținut relevant astăzi.", "cards": "", "empty": True}


# ============= SCHEDULER (APScheduler @ 19:00 Europe/Bucharest) =============
scheduler = AsyncIOScheduler(timezone=pytz.timezone(BUCHAREST_TZ_NAME))

# Register all API routes
app.include_router(api)

@app.on_event("startup")
async def startup():
    await seed()
    # Schedule daily digest at 19:00 Europe/Bucharest (auto-handles EET/EEST switching)
    if not scheduler.running:
        scheduler.add_job(
            run_daily_digests,
            CronTrigger(hour=19, minute=0, timezone=pytz.timezone(BUCHAREST_TZ_NAME)),
            id="daily_digest",
            replace_existing=True,
            misfire_grace_time=3600,
        )
        scheduler.start()
        logging.info("Daily digest scheduler started (19:00 Europe/Bucharest).")

@app.on_event("shutdown")
async def shutdown():
    if scheduler.running:
        scheduler.shutdown(wait=False)
    client.close()
