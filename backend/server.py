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
    return [serialize_doc(d) for d in docs]

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
        {"email": "admin@propmanage.io", "password": "Admin123!", "name": "Administrator", "role": "admin", "phone": ""},
        {"email": "operator@propmanage.io", "password": "Op123!", "name": "Lucian Stan", "role": "operator", "phone": ""},
    ]
    
    user_ids = {}
    for u in demo_users:
        existing = await db.users.find_one({"email": u["email"]})
        if existing:
            user_ids[u["email"]] = str(existing["_id"])
            # Update password if changed
            if not verify_password(u["password"], existing["password_hash"]):
                await db.users.update_one(
                    {"_id": existing["_id"]},
                    {"$set": {"password_hash": hash_password(u["password"])}}
                )
            continue
        doc = {
            "email": u["email"],
            "password_hash": hash_password(u["password"]),
            "name": u["name"],
            "role": u["role"],
            "phone": u.get("phone", ""),
            "wallet_balance": 800.0 if u["role"] == "specialist" else (5000.0 if u["role"] == "client" else 0.0),
            "tokens": 250 if u["role"] == "client" else 0,
            "rating": 4.9 if u["role"] == "specialist" else None,
            "reviews_count": 24 if u["role"] == "specialist" else 0,
            "verified": u["role"] == "specialist",
            "tier": "VERIFIED" if u["role"] == "specialist" else None,
            "specialty": u.get("specialty"),
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
