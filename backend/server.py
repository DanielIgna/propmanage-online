"""PropManage Backend - FastAPI + MongoDB + JWT Auth + Marketplace"""
from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import jwt
import bcrypt
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Literal
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from pydantic import BaseModel, EmailStr, Field
import uuid

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

class PropertyIn(BaseModel):
    name: str
    address: str
    type: str  # apartment, house, villa
    surface: float
    rooms: int

class RequestIn(BaseModel):
    property_id: str
    category: str  # electric, plumbing, hvac, etc.
    title: str
    description: str
    priority: Literal["normal", "urgent"] = "normal"
    budget_estimate: Optional[float] = None

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
    return doc

@api.get("/requests")
async def list_requests(user: dict = Depends(get_current_user)):
    if user["role"] == "client":
        q = {"client_id": user["id"]}
    elif user["role"] == "specialist":
        # show open requests + assigned to this specialist
        q = {"$or": [{"status": "open"}, {"specialist_id": user["id"]}]}
    else:  # admin/operator
        q = {}
    docs = await db.requests.find(q).sort("created_at", -1).to_list(200)
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
