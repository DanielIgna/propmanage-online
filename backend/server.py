"""PropManage Backend - FastAPI + MongoDB + JWT Auth + Marketplace + Stripe + Google OAuth + WebSocket"""
from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import jwt
import bcrypt
import logging
import json
import uuid
import asyncio
import httpx
import stripe
import pyotp
import qrcode
import io
import base64 as b64
from emergentintegrations.llm.chat import LlmChat, UserMessage
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Literal, Dict
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, status, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from pydantic import BaseModel, EmailStr, Field

# Stripe configuration
stripe.api_key = os.environ.get("STRIPE_API_KEY", "sk_test_emergent")

# LLM key for AI assistant
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

# ============= DB SETUP =============
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = "HS256"

app = FastAPI(title="PropManage API")
api = APIRouter(prefix="/api")

# ============= HELPERS =============
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode(), hashed.encode())
    except Exception:
        return False

def create_access_token(user_id: str, email: str, role: str) -> str:
    return jwt.encode({
        "sub": user_id, "email": email, "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=24),
        "type": "access"
    }, JWT_SECRET, algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    return jwt.encode({
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "refresh"
    }, JWT_SECRET, algorithm=JWT_ALGORITHM)

def serialize_doc(doc):
    if doc is None: return None
    doc = dict(doc)
    if "_id" in doc:
        doc["id"] = str(doc.pop("_id"))
    doc.pop("password_hash", None)
    return doc

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        h = request.headers.get("Authorization", "")
        if h.startswith("Bearer "): token = h[7:]
    if not token:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(401, "Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user: raise HTTPException(401, "User not found")
        return serialize_doc(user)
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")

def require_role(*allowed):
    async def dep(user: dict = Depends(get_current_user)):
        if user.get("role") not in allowed:
            raise HTTPException(403, "Insufficient permissions")
        return user
    return dep

def set_auth_cookies(response: Response, access: str, refresh: str):
    response.set_cookie("access_token", access, httponly=True, secure=False, samesite="lax", max_age=86400, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")

# ============= MODELS =============
Role = Literal["client", "specialist", "admin", "operator"]

class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str
    role: Role = "client"
    phone: Optional[str] = None

class LoginIn(BaseModel):
    email: EmailStr
    password: str
    totp_code: Optional[str] = None  # Required if 2FA enabled

class TotpVerifyIn(BaseModel):
    code: str

class PropertyIn(BaseModel):
    name: str
    address: str
    type: str  # apartment, house, villa
    surface: float
    rooms: int

class PropertyUpdateIn(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    type: Optional[str] = None
    surface: Optional[float] = None
    rooms: Optional[int] = None

# ============= REGIONS / ZONES =============
class RegionIn(BaseModel):
    country: str
    city: str
    zone: str  # neighborhood

class SpecialistZonesIn(BaseModel):
    zones: List[str]  # list of zone IDs the specialist covers
    categories: List[str]  # service categories

class AvailabilityIn(BaseModel):
    status: Literal["available", "busy", "offline"]
    available_hours: Optional[Dict] = None  # {monday: [{start: "09:00", end: "17:00"}], ...}

class ServiceAvailabilityIn(BaseModel):
    region_id: str
    service: str  # plumbing, electric, hvac, interior_design, etc.
    state: Literal["active", "inactive", "limited", "premium_only"]
    min_specialists: int = 1

class InteriorDesignIn(BaseModel):
    property_id: str
    rooms_to_design: List[str]  # ["living", "bedroom", ...]
    style: str
    budget_total: float
    tokens_to_apply: int  # how many tokens to redeem

class RequestIn(BaseModel):
    property_id: str
    category: str  # electric, plumbing, hvac, etc.
    title: str
    description: str
    priority: Literal["normal", "urgent"] = "normal"
    budget_estimate: Optional[float] = None
    photos: Optional[List[str]] = None  # base64 data URLs

class OfferIn(BaseModel):
    request_id: str
    price: float
    eta_hours: int
    message: str

class ReviewIn(BaseModel):
    job_id: str
    rating: int = Field(ge=1, le=5)
    comment: Optional[str] = None

class DocumentIn(BaseModel):
    type: Literal["id_card", "insurance", "certification", "company_cui", "other"]
    name: str
    url: str  # base64 data URL or http URL

class DocumentReviewIn(BaseModel):
    status: Literal["approved", "rejected"]
    reason: Optional[str] = None

class SpecialistRejectIn(BaseModel):
    reason: str = Field(min_length=3)

class DisputeOpenIn(BaseModel):
    reason: str = Field(min_length=10)
    evidence_urls: Optional[List[str]] = None  # photos

class DisputeResolveIn(BaseModel):
    resolution: Literal["refund_client", "pay_specialist", "split"]
    client_pct: Optional[int] = None  # 0-100 if split
    notes: Optional[str] = None

# ============= DIGITAL TWIN MODELS =============
class TwinRoom(BaseModel):
    id: str
    name: str
    type: Literal["living", "bedroom", "kitchen", "bathroom", "hallway", "balcony", "office", "storage", "other"]
    area: float = 0  # m²
    x: float = 0
    y: float = 0
    w: float = 100
    h: float = 100

class TwinAsset(BaseModel):
    id: str
    type: Literal["hvac", "boiler", "electric_panel", "water_meter", "gas_meter", "appliance", "lighting", "plumbing", "other"]
    name: str
    room_id: Optional[str] = None
    x: float = 0
    y: float = 0
    condition: Literal["good", "fair", "needs_service", "critical"] = "good"
    last_service_date: Optional[str] = None
    notes: Optional[str] = None

class TwinUpsertIn(BaseModel):
    rooms: List[TwinRoom] = []
    assets: List[TwinAsset] = []
    model_url: Optional[str] = None
    notes: Optional[str] = None

class TwinValidateIn(BaseModel):
    action: Literal["approve", "request_revision"]
    notes: Optional[str] = None

# ============= AUTH ENDPOINTS =============
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
    result = await db.users.insert_one(user)
    uid = str(result.inserted_id)
    access = create_access_token(uid, email, data.role)
    refresh = create_refresh_token(uid)
    set_auth_cookies(response, access, refresh)
    user["id"] = uid
    user.pop("_id", None)
    user.pop("password_hash", None)
    return user

@api.post("/auth/login")
async def login(data: LoginIn, response: Response):
    email = data.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(401, "Invalid credentials")
    
    # 2FA gate
    if user.get("totp_enabled"):
        if not data.totp_code:
            raise HTTPException(202, {"error": "totp_required", "message": "2FA code required"})
        totp = pyotp.TOTP(user["totp_secret"])
        if not totp.verify(data.totp_code, valid_window=1):
            raise HTTPException(401, "Invalid 2FA code")
    
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
    q = {"owner_id": user["id"]} if user["role"] == "client" else {}
    docs = await db.properties.find(q).to_list(100)
    return [serialize_doc(d) for d in docs]

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
    return [serialize_doc(d) for d in docs]

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

@api.post("/requests/{req_id}/accept")
async def accept_request(req_id: str, user: dict = Depends(require_role("specialist"))):
    """Specialist accepts a lead - pays 45 RON fee"""
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
    # Update request
    await db.requests.update_one(
        {"_id": ObjectId(req_id)},
        {"$set": {
            "status": "assigned",
            "specialist_id": user["id"],
            "specialist_name": user["name"],
            "assigned_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    # Log transaction
    await db.transactions.insert_one({
        "user_id": user["id"],
        "type": "lead_fee",
        "amount": -LEAD_FEE,
        "request_id": req_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    # Notify client that specialist accepted
    await notify(
        req["client_id"],
        f"Specialist alocat: {user['name']}",
        f"{user['name']} a acceptat solicitarea ta '{req.get('title','')}'.",
        type_="assignment",
        link="/client"
    )
    return {"ok": True, "balance_after": (specialist.get("wallet_balance") or 0) - LEAD_FEE}

@api.post("/requests/{req_id}/start")
async def start_work(req_id: str, user: dict = Depends(require_role("specialist"))):
    req = await db.requests.find_one({"_id": ObjectId(req_id), "specialist_id": user["id"]})
    if not req: raise HTTPException(404, "Request not found")
    await db.requests.update_one({"_id": ObjectId(req_id)}, {"$set": {"status": "in_progress", "started_at": datetime.now(timezone.utc).isoformat()}})
    return {"ok": True}

@api.post("/requests/{req_id}/complete")
async def complete_work(req_id: str, user: dict = Depends(require_role("specialist"))):
    req = await db.requests.find_one({"_id": ObjectId(req_id), "specialist_id": user["id"]})
    if not req: raise HTTPException(404, "Request not found")
    await db.requests.update_one({"_id": ObjectId(req_id)}, {"$set": {"status": "completed", "completed_at": datetime.now(timezone.utc).isoformat()}})
    await notify(req["client_id"], "Lucrare finalizată", f"{user['name']} a marcat lucrarea '{req.get('title','')}' ca finalizată. Verifică și confirmă pentru a elibera plata.", type_="completion", link="/client")
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
    
    # Update property health (+5%)
    await db.properties.update_one(
        {"_id": ObjectId(req["property_id"])},
        {"$inc": {"health_score": 5, "utilities_health": 3}}
    )
    
    await db.requests.update_one(
        {"_id": ObjectId(req_id)},
        {"$set": {"status": "confirmed", "escrow_status": "released", "confirmed_at": datetime.now(timezone.utc).isoformat()}}
    )
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

@api.get("/admin/specialists/pending")
async def pending_specialists(user: dict = Depends(require_role("admin"))):
    docs = await db.users.find({"role": "specialist", "verified": False}).to_list(100)
    return [serialize_doc(d) for d in docs]

@api.post("/admin/specialists/{spec_id}/verify")
async def verify_specialist(spec_id: str, user: dict = Depends(require_role("admin"))):
    await db.users.update_one(
        {"_id": ObjectId(spec_id), "role": "specialist"},
        {"$set": {"verified": True, "tier": "VERIFIED"}}
    )
    return {"ok": True}

@api.get("/admin/disputes")
async def list_disputes(user: dict = Depends(require_role("admin"))):
    docs = await db.disputes.find({}).sort("created_at", -1).to_list(50)
    # Enrich with request + client + specialist names
    out = []
    for d in docs:
        d = serialize_doc(d)
        req = await db.requests.find_one({"_id": ObjectId(d["request_id"])}) if d.get("request_id") else None
        if req:
            d["request_title"] = req.get("title")
            d["request_status"] = req.get("status")
            d["escrow_amount"] = req.get("escrow_amount", 0)
            client_u = await db.users.find_one({"_id": ObjectId(req["client_id"])}) if req.get("client_id") else None
            spec_u = await db.users.find_one({"_id": ObjectId(req["specialist_id"])}) if req.get("specialist_id") else None
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
    if other_user_id:
        await notify(other_user_id, "Dispută deschisă", f"O dispută a fost deschisă pe lucrarea '{req.get('title','')}'. Echipa admin va analiza cazul.", type_="dispute", link="/" + ("specialist" if role == "client" else "client"))
    admins = await db.users.find({"role": "admin"}).to_list(10)
    for a in admins:
        await notify(str(a["_id"]), "Nouă dispută", f"Dispută deschisă pe '{req.get('title','')}' de către {role}.", type_="dispute", link="/admin")
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
        await notify(client_id, "Dispută rezolvată", f"Dispută rezolvată. Rambursare: {client_amount:.2f} RON.", type_="dispute", link="/client")
    if specialist_id:
        await notify(specialist_id, "Dispută rezolvată", f"Dispută rezolvată. Plată: {specialist_amount:.2f} RON.", type_="dispute", link="/specialist")
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
    return {"ok": True}

@api.get("/operator/twins")
async def operator_list_twins(user: dict = Depends(require_role("operator", "admin"))):
    """List all twins (pending + approved)"""
    docs = await db.twins.find({}).sort("requested_at", -1).to_list(100)
    out = []
    for d in docs:
        d = serialize_doc(d)
        # Enrich with property + owner
        prop = await db.properties.find_one({"_id": ObjectId(d["property_id"])}) if d.get("property_id") else None
        if prop:
            d["property_name"] = prop.get("name")
            d["property_address"] = prop.get("address")
            d["property_type"] = prop.get("type")
            d["property_surface"] = prop.get("surface")
            d["property_rooms"] = prop.get("rooms")
            owner = await db.users.find_one({"_id": ObjectId(prop["owner_id"])}) if prop.get("owner_id") else None
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
    return {"ok": True, "status": new_status}

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

@api.post("/payments/checkout-session")
async def create_checkout_session(request_id: str, request: Request, user: dict = Depends(require_role("client"))):
    """Create Stripe Checkout session for escrow funding"""
    req = await db.requests.find_one({"_id": ObjectId(request_id), "client_id": user["id"]})
    if not req:
        raise HTTPException(404, "Request not found")
    if req.get("status") not in ["open", "assigned"]:
        raise HTTPException(400, "Request not eligible for payment")
    
    amount = req.get("budget_estimate") or 100.0
    amount_cents = int(amount * 100)
    
    # Derive origin from request for dynamic redirect URLs
    origin = request.headers.get("origin") or request.headers.get("referer", "").rstrip("/")
    if not origin:
        raise HTTPException(400, "Missing origin header")
    
    # Demo mode: if Stripe key is the placeholder, simulate a successful payment
    if stripe.api_key in ("sk_test_emergent", "", None) or not stripe.api_key.startswith("sk_"):
        fake_session_id = f"cs_demo_{uuid.uuid4().hex[:16]}"
        await db.payments.insert_one({
            "session_id": fake_session_id,
            "request_id": request_id,
            "client_id": user["id"],
            "amount": amount,
            "status": "demo_pending",
            "demo": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        # In demo mode, we immediately mark as paid and redirect to success
        await db.payments.update_one(
            {"session_id": fake_session_id},
            {"$set": {"status": "completed", "completed_at": datetime.now(timezone.utc).isoformat()}}
        )
        await db.requests.update_one(
            {"_id": ObjectId(request_id)},
            {"$set": {"escrow_amount": amount, "escrow_status": "held", "paid_at": datetime.now(timezone.utc).isoformat()}}
        )
        await db.transactions.insert_one({
            "user_id": user["id"],
            "type": "escrow_deposit",
            "amount": -amount,
            "request_id": request_id,
            "session_id": fake_session_id,
            "demo": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        return {"checkout_url": f"{origin}/client?payment=success&request={request_id}&demo=1", "session_id": fake_session_id, "demo_mode": True}
    
    try:
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[{
                "price_data": {
                    "currency": "ron",
                    "product_data": {
                        "name": f"Escrow: {req.get('title', 'Service')}",
                        "description": f"Property service deposit - {req.get('property_name', '')}",
                    },
                    "unit_amount": amount_cents,
                },
                "quantity": 1,
            }],
            mode="payment",
            success_url=f"{origin}/client?payment=success&request={request_id}",
            cancel_url=f"{origin}/client?payment=cancelled",
            metadata={
                "request_id": request_id,
                "client_id": user["id"],
                "specialist_id": req.get("specialist_id") or "",
                "amount_ron": str(amount),
            },
        )
        
        # Track the payment session
        await db.payments.insert_one({
            "session_id": session.id,
            "request_id": request_id,
            "client_id": user["id"],
            "amount": amount,
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        
        return {"checkout_url": session.url, "session_id": session.id}
    except stripe.error.StripeError as e:
        raise HTTPException(500, f"Stripe error: {str(e)}")


@api.get("/payments/status/{session_id}")
async def payment_status(session_id: str, user: dict = Depends(get_current_user)):
    """Check Stripe Checkout session status and finalize escrow if paid"""
    payment = await db.payments.find_one({"session_id": session_id})
    if not payment:
        raise HTTPException(404, "Payment session not found")
    
    # Demo mode short-circuit
    if payment.get("demo"):
        return {
            "status": "paid",
            "amount": payment["amount"],
            "request_id": payment["request_id"],
            "stripe_status": "complete",
            "demo_mode": True,
        }
    
    try:
        session = stripe.checkout.Session.retrieve(session_id)
    except stripe.error.StripeError as e:
        raise HTTPException(500, f"Stripe error: {e}")
    
    status_val = session.payment_status  # "paid", "unpaid", "no_payment_required"
    
    # Update payment record (idempotent)
    if status_val == "paid" and payment.get("status") != "completed":
        await db.payments.update_one(
            {"session_id": session_id},
            {"$set": {"status": "completed", "completed_at": datetime.now(timezone.utc).isoformat()}}
        )
        # Place funds in escrow on the request
        await db.requests.update_one(
            {"_id": ObjectId(payment["request_id"])},
            {"$set": {"escrow_amount": payment["amount"], "escrow_status": "held", "paid_at": datetime.now(timezone.utc).isoformat()}}
        )
        # Log transaction
        await db.transactions.insert_one({
            "user_id": payment["client_id"],
            "type": "escrow_deposit",
            "amount": -payment["amount"],
            "request_id": payment["request_id"],
            "session_id": session_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    
    return {
        "status": status_val,
        "amount": payment["amount"],
        "request_id": payment["request_id"],
        "stripe_status": session.status,
    }


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


# ============= EMAIL NOTIFICATIONS =============
SENDGRID_API_KEY = os.environ.get("SENDGRID_API_KEY", "")
SENDGRID_SENDER = os.environ.get("SENDGRID_SENDER", "noreply@propmanage.io")

async def send_email(to_email: str, subject: str, html_body: str):
    """Send email via SendGrid with graceful fallback to console logging."""
    if not SENDGRID_API_KEY or not SENDGRID_API_KEY.startswith("SG."):
        # Demo mode: log to console + persist to db.email_log for in-app review
        logger.info(f"[EMAIL DEMO] To: {to_email} | Subject: {subject}")
        await db.email_log.insert_one({
            "to": to_email,
            "subject": subject,
            "body": html_body,
            "demo": True,
            "sent_at": datetime.now(timezone.utc).isoformat(),
        })
        return {"status": "demo", "to": to_email}
    
    # Real SendGrid call
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(
                "https://api.sendgrid.com/v3/mail/send",
                headers={"Authorization": f"Bearer {SENDGRID_API_KEY}", "Content-Type": "application/json"},
                json={
                    "personalizations": [{"to": [{"email": to_email}]}],
                    "from": {"email": SENDGRID_SENDER, "name": "PropManage"},
                    "subject": subject,
                    "content": [{"type": "text/html", "value": html_body}],
                }
            )
            await db.email_log.insert_one({
                "to": to_email, "subject": subject,
                "status_code": r.status_code,
                "sent_at": datetime.now(timezone.utc).isoformat(),
            })
            return {"status": "sent" if r.status_code < 300 else "failed", "code": r.status_code}
    except Exception as e:
        logger.error(f"SendGrid error: {e}")
        return {"status": "error", "error": str(e)}


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


async def notify(user_id: str, title: str, message: str, type_: str = "info", link: str = None):
    """Create in-app notification + send email if user has email"""
    await db.notifications.insert_one({
        "user_id": user_id,
        "title": title,
        "message": message,
        "type": type_,
        "link": link,
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    # Best-effort email
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if user and user.get("email"):
        html = f"<h2>{title}</h2><p>{message}</p>"
        if link:
            html += f'<p><a href="{link}">Vezi detalii</a></p>'
        await send_email(user["email"], f"PropManage: {title}", html)


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


# ============= PREMIUM SERVICE: INTERIOR DESIGN =============

INTERIOR_DESIGN_MIN_TOKENS = 3000
TOKEN_VALUE_EUR = 0.20  # 1 token = 0.20 EUR (so 1000 tokens = 200 EUR)
TOKEN_MAX_DISCOUNT_PCT = 0.70  # 70% max coverage
TOKEN_MIN_DISCOUNT_PCT = 0.50  # 50% min if applied


@api.get("/services/interior-design/eligibility")
async def check_interior_design_eligibility(user: dict = Depends(get_current_user)):
    """Check if user can access Interior Design (Digital Twin + Wallet activated + token threshold)"""
    if user["role"] != "client":
        return {"eligible": False, "reason": "Only clients can request design"}
    
    # Check user has at least one property with twin/wallet unlocked
    has_twin = await db.properties.find_one({"owner_id": user["id"], "twin_unlocked": True})
    has_wallet = await db.properties.find_one({"owner_id": user["id"], "wallet_unlocked": True})
    tokens = user.get("tokens", 0)
    
    reasons = []
    if not has_twin:
        reasons.append("Digital Twin nu este activat pe nicio proprietate")
    if not has_wallet:
        reasons.append("Wallet nu este activat")
    if tokens < INTERIOR_DESIGN_MIN_TOKENS:
        reasons.append(f"Sub minimul de {INTERIOR_DESIGN_MIN_TOKENS} tokens (ai {tokens})")
    
    return {
        "eligible": len(reasons) == 0,
        "reasons": reasons,
        "current_tokens": tokens,
        "min_tokens_required": INTERIOR_DESIGN_MIN_TOKENS,
        "has_twin": bool(has_twin),
        "has_wallet": bool(has_wallet),
    }


@api.post("/services/interior-design/calculate")
async def calculate_interior_design_cost(budget_total: float, tokens_to_apply: int, user: dict = Depends(get_current_user)):
    """Calculate token discount preview"""
    if budget_total <= 0:
        raise HTTPException(400, "Invalid budget")
    
    tokens_available = user.get("tokens", 0)
    tokens_used = min(tokens_to_apply, tokens_available)
    
    # Convert tokens to EUR value
    token_value_eur = tokens_used * TOKEN_VALUE_EUR
    
    # Apply 50-70% discount rule
    min_discount = budget_total * TOKEN_MIN_DISCOUNT_PCT
    max_discount = budget_total * TOKEN_MAX_DISCOUNT_PCT
    
    actual_discount = min(token_value_eur, max_discount)
    if actual_discount < min_discount and tokens_used > 0:
        actual_discount = min(min_discount, token_value_eur)
    
    final_payable = budget_total - actual_discount
    
    return {
        "budget_total": budget_total,
        "tokens_available": tokens_available,
        "tokens_to_apply": tokens_used,
        "token_value_eur": round(token_value_eur, 2),
        "discount_applied": round(actual_discount, 2),
        "discount_pct": round((actual_discount / budget_total) * 100, 1),
        "final_payable": round(final_payable, 2),
        "min_discount_pct": int(TOKEN_MIN_DISCOUNT_PCT * 100),
        "max_discount_pct": int(TOKEN_MAX_DISCOUNT_PCT * 100),
    }


@api.post("/services/interior-design/request")
async def request_interior_design(data: InteriorDesignIn, user: dict = Depends(require_role("client"))):
    """Create Interior Design premium request"""
    # Verify eligibility
    elig = await check_interior_design_eligibility(user)
    if not elig["eligible"]:
        raise HTTPException(403, f"Not eligible: {', '.join(elig['reasons'])}")
    
    # Verify property
    prop = await db.properties.find_one({"_id": ObjectId(data.property_id), "owner_id": user["id"]})
    if not prop or not prop.get("twin_unlocked"):
        raise HTTPException(400, "Property must have Digital Twin activated")
    
    # Calculate cost
    calc = await calculate_interior_design_cost(data.budget_total, data.tokens_to_apply, user)
    
    # Deduct tokens
    if calc["tokens_to_apply"] > 0:
        await db.users.update_one(
            {"_id": ObjectId(user["id"])},
            {"$inc": {"tokens": -calc["tokens_to_apply"]}}
        )
        await db.transactions.insert_one({
            "user_id": user["id"],
            "type": "tokens_redeem_interior_design",
            "tokens": -calc["tokens_to_apply"],
            "discount_eur": calc["discount_applied"],
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    
    # Create premium request
    doc = {
        "client_id": user["id"],
        "client_name": user["name"],
        "property_id": data.property_id,
        "property_name": prop["name"],
        "service_type": "interior_design",
        "category": "interior_design",
        "title": f"Design Interior - {prop['name']}",
        "description": f"Stil: {data.style} · Camere: {', '.join(data.rooms_to_design)}",
        "rooms_to_design": data.rooms_to_design,
        "style": data.style,
        "budget_total": data.budget_total,
        "tokens_used": calc["tokens_to_apply"],
        "discount_applied": calc["discount_applied"],
        "final_payable": calc["final_payable"],
        "status": "open",
        "priority": "normal",
        "is_premium": True,
        "required_tier": "VERIFIED",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    res = await db.requests.insert_one(doc)
    doc["id"] = str(res.inserted_id)
    doc.pop("_id", None)
    
    # Notify verified specialists with interior_design category
    specs = await db.users.find({
        "role": "specialist",
        "verified": True,
        "$or": [{"service_categories": "interior_design"}, {"specialty": "interior_design"}]
    }).to_list(20)
    for s in specs:
        await notify(
            str(s["_id"]),
            "🎨 Premium Request: Design Interior",
            f"Cerere premium: {prop['name']} · Buget {data.budget_total}€. Doar Verified Specialists pot accepta.",
            type_="premium_lead",
            link="/specialist"
        )
    
    return doc


# ============= ROOT =============
@api.get("/")
async def root():
    return {"message": "PropManage API", "version": "1.0"}

app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ============= SEED DEMO DATA =============
async def seed():
    """Seed demo accounts + properties + sample requests (idempotent)"""
    await db.users.create_index("email", unique=True)
    
    demo_users = [
        {"email": "client@propmanage.io", "password": "Client123!", "name": "Andrei Popescu", "role": "client", "phone": "+40 712 345 678"},
        {"email": "specialist@propmanage.io", "password": "Spec123!", "name": "Mihai Ionescu", "role": "specialist", "specialty": "hvac", "phone": "+40 723 456 789"},
        {"email": "specialist2@propmanage.io", "password": "Spec123!", "name": "Elena Dumitru", "role": "specialist", "specialty": "plumbing", "phone": "+40 734 567 890"},
        {"email": "pending@propmanage.io", "password": "Spec123!", "name": "Vasile Constantinescu", "role": "specialist", "specialty": "electric", "phone": "+40 745 678 901", "_pending": True},
        {"email": "admin@propmanage.io", "password": "Admin123!", "name": "Administrator", "role": "admin", "phone": ""},
        {"email": "operator@propmanage.io", "password": "Op123!", "name": "Lucian Stan", "role": "operator", "phone": ""},
    ]
    
    user_ids = {}
    for u in demo_users:
        existing = await db.users.find_one({"email": u["email"]})
        if existing:
            user_ids[u["email"]] = str(existing["_id"])
            # Update password if changed
            update_fields = {}
            if not verify_password(u["password"], existing["password_hash"]):
                update_fields["password_hash"] = hash_password(u["password"])
            # Always sync new zone/availability/categories fields
            if u["role"] == "specialist":
                update_fields["coverage_zones"] = ["Bucuresti-Sector1", "Bucuresti-Sector2"]
                update_fields["service_categories"] = [u.get("specialty"), "interior_design"] if u.get("specialty") else ["interior_design"]
                update_fields["availability_status"] = existing.get("availability_status") or "available"
                # Preserve pending status across restarts
                if u.get("_pending") and existing.get("verified"):
                    update_fields["verified"] = False
                    update_fields["tier"] = None
                    update_fields["rating"] = None
                    update_fields["reviews_count"] = 0
                    if not (existing.get("documents") or []):
                        now_iso = datetime.now(timezone.utc).isoformat()
                        update_fields["documents"] = [
                            {"id": str(uuid.uuid4()), "type": "id_card", "name": "CI Vasile Constantinescu.pdf", "url": "data:application/pdf;base64,JVBERi0xLjQK", "status": "pending", "uploaded_at": now_iso},
                            {"id": str(uuid.uuid4()), "type": "certification", "name": "Atestat ANRE electrician.jpg", "url": "https://via.placeholder.com/600x400.jpg?text=Atestat+ANRE", "status": "pending", "uploaded_at": now_iso},
                            {"id": str(uuid.uuid4()), "type": "insurance", "name": "Asigurare RCA.pdf", "url": "data:application/pdf;base64,JVBERi0xLjQK", "status": "pending", "uploaded_at": now_iso},
                        ]
            elif u["role"] == "client":
                update_fields["zone"] = existing.get("zone") or "Bucuresti-Sector1"
                # Bump tokens to 3500 if currently below 3000 (for demo eligibility)
                if (existing.get("tokens") or 0) < 3000:
                    update_fields["tokens"] = 3500
            if update_fields:
                await db.users.update_one({"_id": existing["_id"]}, {"$set": update_fields})
            continue
        doc = {
            "email": u["email"],
            "password_hash": hash_password(u["password"]),
            "name": u["name"],
            "role": u["role"],
            "phone": u.get("phone", ""),
            "wallet_balance": 800.0 if u["role"] == "specialist" else (5000.0 if u["role"] == "client" else 0.0),
            "tokens": 3500 if u["role"] == "client" else 0,  # client gets enough tokens for interior design demo
            "rating": 4.9 if u["role"] == "specialist" and not u.get("_pending") else None,
            "reviews_count": 24 if u["role"] == "specialist" and not u.get("_pending") else 0,
            "verified": u["role"] == "specialist" and not u.get("_pending"),
            "tier": "VERIFIED" if u["role"] == "specialist" and not u.get("_pending") else None,
            "specialty": u.get("specialty"),
            "zone": "Bucuresti-Sector1" if u["role"] == "client" else None,
            "coverage_zones": ["Bucuresti-Sector1", "Bucuresti-Sector2"] if u["role"] == "specialist" else [],
            "service_categories": [u.get("specialty"), "interior_design"] if u["role"] == "specialist" and u.get("specialty") else [],
            "availability_status": "available" if u["role"] == "specialist" else None,
            "documents": [
                {"id": str(uuid.uuid4()), "type": "id_card", "name": "CI Vasile Constantinescu.pdf", "url": "data:application/pdf;base64,placeholder", "status": "pending", "uploaded_at": datetime.now(timezone.utc).isoformat()},
                {"id": str(uuid.uuid4()), "type": "certification", "name": "Atestat ANRE electrician.pdf", "url": "data:application/pdf;base64,placeholder", "status": "pending", "uploaded_at": datetime.now(timezone.utc).isoformat()},
            ] if u.get("_pending") else [],
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        res = await db.users.insert_one(doc)
        user_ids[u["email"]] = str(res.inserted_id)
    
    # Seed property for client
    client_id = user_ids.get("client@propmanage.io")
    if client_id:
        existing_prop = await db.properties.find_one({"owner_id": client_id})
        if not existing_prop:
            prop = {
                "name": "Skyline Loft A4",
                "address": "Str. Unirii 42, București",
                "type": "apartment",
                "surface": 92.0,
                "rooms": 3,
                "owner_id": client_id,
                "health_score": 75,
                "structure_health": 90,
                "utilities_health": 82,
                "documents_health": 100,
                "twin_unlocked": True,
                "wallet_unlocked": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            prop_res = await db.properties.insert_one(prop)
            prop_id = str(prop_res.inserted_id)
            
            # Seed sample requests
            spec_id = user_ids.get("specialist@propmanage.io")
            sample_requests = [
                {
                    "client_id": client_id, "client_name": "Andrei Popescu",
                    "property_id": prop_id, "property_name": "Skyline Loft A4",
                    "category": "hvac", "title": "Reparație Centrală Termică",
                    "description": "Centrala face zgomot ciudat și nu mai încălzește optim.",
                    "priority": "urgent", "budget_estimate": 450.0,
                    "status": "in_progress", "specialist_id": spec_id, "specialist_name": "Mihai Ionescu",
                    "escrow_amount": 450.0, "escrow_status": "held",
                    "created_at": (datetime.now(timezone.utc) - timedelta(hours=4)).isoformat(),
                    "assigned_at": (datetime.now(timezone.utc) - timedelta(hours=3)).isoformat(),
                    "started_at": (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat(),
                },
                {
                    "client_id": client_id, "client_name": "Andrei Popescu",
                    "property_id": prop_id, "property_name": "Skyline Loft A4",
                    "category": "electric", "title": "Înlocuire prize bucătărie",
                    "description": "Două prize din bucătărie nu mai funcționează.",
                    "priority": "normal", "budget_estimate": 200.0,
                    "status": "open", "specialist_id": None, "specialist_name": None,
                    "created_at": (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat(),
                },
                {
                    "client_id": client_id, "client_name": "Andrei Popescu",
                    "property_id": prop_id, "property_name": "Skyline Loft A4",
                    "category": "plumbing", "title": "Scurgere baie",
                    "description": "Scurgere detectată sub chiuvetă.",
                    "priority": "urgent", "budget_estimate": 350.0,
                    "status": "open",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                },
            ]
            for r in sample_requests:
                await db.requests.insert_one(r)
    
    # Seed a sample Digital Twin pending validation
    if client_id:
        prop_for_twin = await db.properties.find_one({"owner_id": client_id})
        if prop_for_twin:
            prop_id_str = str(prop_for_twin["_id"])
            existing_twin = await db.twins.find_one({"property_id": prop_id_str})
            if not existing_twin:
                now_iso = datetime.now(timezone.utc).isoformat()
                await db.twins.insert_one({
                    "property_id": prop_id_str,
                    "status": "pending_validation",
                    "rooms": [
                        {"id": str(uuid.uuid4()), "name": "Living", "type": "living", "area": 32, "x": 50, "y": 50, "w": 220, "h": 180},
                        {"id": str(uuid.uuid4()), "name": "Dormitor", "type": "bedroom", "area": 16, "x": 280, "y": 50, "w": 160, "h": 130},
                        {"id": str(uuid.uuid4()), "name": "Bucătărie", "type": "kitchen", "area": 12, "x": 50, "y": 240, "w": 140, "h": 120},
                        {"id": str(uuid.uuid4()), "name": "Baie", "type": "bathroom", "area": 6, "x": 200, "y": 240, "w": 90, "h": 120},
                        {"id": str(uuid.uuid4()), "name": "Hol", "type": "hallway", "area": 8, "x": 300, "y": 200, "w": 140, "h": 160},
                    ],
                    "assets": [
                        {"id": str(uuid.uuid4()), "type": "boiler", "name": "Centrală termică", "x": 220, "y": 280, "condition": "good"},
                        {"id": str(uuid.uuid4()), "name": "Panou electric", "type": "electric_panel", "x": 330, "y": 220, "condition": "good"},
                        {"id": str(uuid.uuid4()), "name": "HVAC living", "type": "hvac", "x": 150, "y": 120, "condition": "fair"},
                    ],
                    "requested_at": now_iso,
                    "created_at": now_iso,
                })
    
    # Seed regions
    sample_regions = [
        {"country": "România", "city": "București", "zone": "Bucuresti-Sector1"},
        {"country": "România", "city": "București", "zone": "Bucuresti-Sector2"},
        {"country": "România", "city": "București", "zone": "Bucuresti-Sector3"},
        {"country": "România", "city": "Cluj-Napoca", "zone": "Centru"},
        {"country": "România", "city": "Timișoara", "zone": "Iosefin"},
    ]
    for r in sample_regions:
        existing = await db.regions.find_one(r)
        if not existing:
            await db.regions.insert_one({**r, "created_at": datetime.now(timezone.utc).isoformat()})
    
    # Write test credentials
    creds_path = Path("/app/memory/test_credentials.md")
    creds_path.parent.mkdir(exist_ok=True)
    creds_path.write_text("""# PropManage Test Credentials

## Demo Accounts (Pre-seeded, idempotent)

| Role | Email | Password |
|------|-------|----------|
| Client | client@propmanage.io | Client123! |
| Specialist (HVAC, verified) | specialist@propmanage.io | Spec123! |
| Specialist (Plumbing, verified) | specialist2@propmanage.io | Spec123! |
| Admin | admin@propmanage.io | Admin123! |
| Operator | operator@propmanage.io | Op123! |

## Auth Endpoints
- POST /api/auth/login - Body: {email, password}
- POST /api/auth/register - Body: {email, password, name, role}
- POST /api/auth/logout
- GET /api/auth/me

## Test Flow
1. Login as client → see properties + requests
2. Login as specialist → see open requests, accept lead (pays 45 RON)
3. Login as admin → see stats, verify specialists
4. Login as operator → validate maintenance logs

Client starts with 5000 RON wallet + 250 tokens
Specialists start with 800 RON wallet, 4.9 rating, 24 reviews, VERIFIED tier
""")
    logger.info("Seed complete. Demo accounts ready.")

@app.on_event("startup")
async def startup():
    await seed()

@app.on_event("shutdown")
async def shutdown():
    client.close()
