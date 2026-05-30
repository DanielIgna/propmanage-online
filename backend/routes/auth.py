"""Auth router: register, login, logout, me, ws-token, dual-role, profile, password,
GDPR export/delete, referral, support/contact, push subscribe, 2FA, Google OAuth,
digest preference/preview."""
import os
import io
import logging
import jwt
import asyncio
import secrets
import base64 as b64
import httpx
import pyotp
import qrcode
from typing import Optional, Dict, List, Literal
from datetime import datetime, timezone, timedelta
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field

from db import db
from core_utils import (
    hash_password, verify_password, create_access_token, create_refresh_token,
    serialize_doc, set_auth_cookies, JWT_SECRET, JWT_ALGORITHM,
)
from deps import get_current_user, require_role, block_in_impersonation, block_impersonation_dep
from services import send_email, VAPID_PUBLIC_KEY
from models import (
    RegisterIn, LoginIn, TotpVerifyIn, ALLOWED_SPECIALTIES,
)
from email_service import send_template, tpl_welcome
from digest import DIGEST_BUILDERS, run_daily_digests

logger = logging.getLogger(__name__)


# --- Admin whitelist enforcement ---
def _admin_whitelist() -> set:
    raw = os.environ.get("ADMIN_EMAILS", "")
    return {e.strip().lower() for e in raw.split(",") if e.strip()}


async def _enforce_admin_role(user: dict) -> dict:
    """If user email is in ADMIN_EMAILS → ensure role=admin. Otherwise demote off admin.
    Returns the (possibly mutated) user dict; persists changes to DB."""
    if not user:
        return user
    email = (user.get("email") or "").lower()
    role = user.get("role")
    whitelist = _admin_whitelist()
    if email in whitelist and role != "admin":
        await db.users.update_one({"_id": user["_id"]}, {"$set": {"role": "admin"}})
        user["role"] = "admin"
    elif email not in whitelist and role == "admin":
        # demote stray admins to operator (keeps moderate access for testing)
        await db.users.update_one({"_id": user["_id"]}, {"$set": {"role": "operator"}})
        user["role"] = "operator"
    return user

router = APIRouter(prefix="/api", tags=["auth"])


# ============= REGISTER =============
@router.post("/auth/register")
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
        "wallet_balance": 500.0 if data.role == "specialist" else 0.0,
        "tokens": 0,
        "rating": 5.0 if data.role == "specialist" else None,
        "reviews_count": 0,
        "verified": False,
        "tier": "ENTRY" if data.role == "specialist" else None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    if data.role == "specialist":
        cats = data.service_categories or ([data.specialty] if data.specialty else [])
        cats = [c for c in cats if c]
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
    if data.referrer_id:
        try:
            sponsor = await db.users.find_one({"_id": ObjectId(data.referrer_id)})
            if sponsor and not sponsor.get("deleted"):
                user["referrer_id"] = data.referrer_id
                user["referral_bonus_paid"] = False
        except Exception:
            pass
    result = await db.users.insert_one(user)
    uid = str(result.inserted_id)
    access = create_access_token(uid, email, data.role)
    refresh = create_refresh_token(uid)
    set_auth_cookies(response, access, refresh)
    user["id"] = uid
    user.pop("_id", None)
    user.pop("password_hash", None)
    await send_template(tpl_welcome, data.name, data.role, to=email)
    # Schedule 3-email onboarding drip for new specialists (Day 1, 3, 7) — best-effort
    if data.role == "specialist":
        try:
            from onboarding_emails import enqueue_specialist_onboarding
            await enqueue_specialist_onboarding(uid, email, data.name)
        except Exception as _e:  # noqa: BLE001
            import logging
            logging.getLogger("propmanage.auth").warning(f"[Onboarding] enqueue failed: {_e}")
    # Auto-send role-specific training doc (best-effort, non-blocking)
    try:
        from docs_service import email_doc_to_user
        from docs_content import get_doc
        # Map user role to doc slug (qa users would be admins; specialist/operator/client/admin)
        doc_slug = data.role if get_doc(data.role) else None
        if doc_slug:
            await email_doc_to_user(
                doc_slug, email,
                recipient_name=data.name,
                include_pdf=True,
                sent_by="auto-onboarding",
            )
    except Exception as e:
        import logging
        logging.getLogger("propmanage.auth").warning(f"[Onboarding] doc send failed: {e}")
    return user


# ============= LOGIN (with rate limit + 2FA) =============
_login_attempts: Dict[str, List[datetime]] = {}
LOGIN_MAX_ATTEMPTS = 8
LOGIN_WINDOW_SECONDS = 60


def _check_login_rate_limit(ip: str):
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(seconds=LOGIN_WINDOW_SECONDS)
    attempts = [t for t in _login_attempts.get(ip, []) if t > cutoff]
    _login_attempts[ip] = attempts
    if len(attempts) >= LOGIN_MAX_ATTEMPTS:
        raise HTTPException(429, "Prea multe încercări. Reîncearcă în 60 secunde.")


def _record_failed_login(ip: str):
    _login_attempts.setdefault(ip, []).append(datetime.now(timezone.utc))


@router.post("/auth/login")
async def login(data: LoginIn, request: Request, response: Response):
    ip = request.client.host if request.client else "unknown"
    _check_login_rate_limit(ip)
    email = data.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(data.password, user["password_hash"]):
        _record_failed_login(ip)
        raise HTTPException(401, "Invalid credentials")

    if user.get("totp_enabled"):
        if not data.totp_code:
            raise HTTPException(202, {"error": "totp_required", "message": "2FA code required"})
        totp = pyotp.TOTP(user["totp_secret"])
        if not totp.verify(data.totp_code, valid_window=1):
            _record_failed_login(ip)
            raise HTTPException(401, "Invalid 2FA code")

    _login_attempts.pop(ip, None)
    user = await _enforce_admin_role(user)
    uid = str(user["_id"])
    # Track last_seen for beta engagement analytics
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"last_seen": datetime.now(timezone.utc).isoformat()}}
    )
    access = create_access_token(uid, email, user.get("role", "client"))
    refresh = create_refresh_token(uid)
    set_auth_cookies(response, access, refresh)
    return serialize_doc(user)


@router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    # Also clear any stashed admin token (impersonation safety)
    response.delete_cookie("admin_access_token", path="/")
    return {"ok": True}


@router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    # Load tutorial seen flag fresh from DB so it reflects across sessions
    doc = await db.users.find_one({"_id": ObjectId(user["id"])}, {"tutorial_seen": 1, "ai_admin_tour_seen": 1, "dashboard_tour_completed": 1, "email": 1, "role": 1, "password_hash": 1, "google_auth": 1})
    user["tutorial_seen"] = bool((doc or {}).get("tutorial_seen", False))
    user["ai_admin_tour_seen"] = bool((doc or {}).get("ai_admin_tour_seen", False))
    user["dashboard_tour_completed"] = bool((doc or {}).get("dashboard_tour_completed", False))
    # `has_password` lets frontend show "Backup password" button only for Google-only accounts
    user["has_password"] = bool((doc or {}).get("password_hash"))
    user["google_auth"] = bool((doc or {}).get("google_auth"))
    # Enforce admin whitelist on every /me call to catch direct DB tampering or stale tokens.
    if doc:
        fresh = {"_id": doc["_id"], "email": doc.get("email"), "role": doc.get("role")}
        await _enforce_admin_role(fresh)
        user["role"] = fresh["role"]
    # `impersonation` field is already injected by get_current_user when applicable.
    return user


class PasswordForgotIn(BaseModel):
    email: str


class PasswordResetIn(BaseModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)


@router.post("/auth/password/forgot")
async def password_forgot(data: PasswordForgotIn):
    """Send a password reset magic link to the user's email if the account exists.
    Always returns 200 + identical message (no email enumeration leak).
    Token is signed JWT with 1h TTL + single-use via jti rotation."""
    email = data.email.strip().lower()
    if not email or "@" not in email:
        # Same response — don't leak validation
        return {"ok": True, "message": "Dacă există un cont cu acest email, vei primi un link în câteva minute."}
    user = await db.users.find_one({"email": email})
    if user and not user.get("banned"):
        token_payload = {
            "sub": str(user["_id"]),
            "email": email,
            "type": "password_reset",
            "jti": secrets.token_urlsafe(12),
            "exp": datetime.now(timezone.utc) + timedelta(hours=1),
        }
        token = jwt.encode(token_payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
        # Store jti so it can only be used once
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {
                "pw_reset_jti": token_payload["jti"],
                "pw_reset_requested_at": datetime.now(timezone.utc).isoformat(),
            }}
        )
        front_url = os.environ.get("FRONTEND_URL", "https://propmanage.ro")
        reset_url = f"{front_url}/reset-password?token={token}"
        name = user.get("name") or "utilizator"
        html = (
            f"<div style='font-family: Inter, sans-serif; max-width:560px; margin:0 auto; "
            f"background:#0a0a0b; color:#fafaf9; padding:24px; border-radius:12px;'>"
            f"<h2 style='font-family: Georgia, serif; color:#d4ff3a;'>Resetează parola PropManage</h2>"
            f"<p>Salut {name},</p>"
            f"<p>Ai cerut resetarea parolei pentru contul <strong>{email}</strong>.</p>"
            f"<p style='margin:24px 0;text-align:center;'>"
            f"<a href='{reset_url}' style='display:inline-block;background:#d4ff3a;color:#0a0a0b;"
            f"padding:14px 28px;text-decoration:none;border-radius:8px;font-weight:bold;'>"
            f"Setează parolă nouă</a></p>"
            f"<p style='color:#a8a29e;font-size:13px;'>Link-ul expiră în <strong>1 oră</strong> și poate fi folosit o singură dată.</p>"
            f"<p style='color:#a8a29e;font-size:13px;'>Dacă NU ai cerut tu această resetare, ignoră emailul — parola ta veche rămâne neschimbată.</p>"
            f"<hr style='border:none;border-top:1px solid #292524; margin:24px 0;'/>"
            f"<p style='color:#78716c;font-size:11px;text-align:center;word-break:break-all;'>"
            f"Dacă butonul nu funcționează, deschide acest link în browser:<br/>{reset_url}</p>"
            f"</div>"
        )
        try:
            await send_email(email, "Resetează parola PropManage", html)
        except Exception as e:
            logger.warning(f"Failed to send reset email to {email}: {e}")
    # Always return success to prevent email enumeration
    return {"ok": True, "message": "Dacă există un cont cu acest email, vei primi un link în câteva minute."}


@router.post("/auth/password/reset")
async def password_reset(data: PasswordResetIn):
    """Consume reset token + set new password. Token must be valid + match stored jti."""
    try:
        payload = jwt.decode(data.token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "password_reset":
            raise HTTPException(400, "Token invalid.")
    except jwt.ExpiredSignatureError:
        raise HTTPException(400, "Link-ul a expirat. Cere un nou link de resetare.")
    except jwt.InvalidTokenError:
        raise HTTPException(400, "Token invalid sau corupt.")

    user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
    if not user:
        raise HTTPException(404, "Utilizator inexistent.")
    if user.get("banned"):
        raise HTTPException(403, "Cont suspendat.")
    if user.get("pw_reset_jti") != payload.get("jti"):
        raise HTTPException(400, "Link-ul a fost deja folosit. Cere un nou link de resetare.")

    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {
            "password_hash": hash_password(data.new_password),
            "pw_reset_jti": None,
            "pw_reset_used_at": datetime.now(timezone.utc).isoformat(),
        }}
    )
    return {"ok": True, "email": user.get("email")}


@router.post("/auth/password/send-backup")
async def send_backup_password(user: dict = Depends(get_current_user)):
    """Generate a temporary password, set it on the account, and email it to the user.
    Designed for users logged-in via Google OAuth who have no password and need a
    backup login method (e.g. when SSO is down or on a different device).
    """
    block_in_impersonation(user, "generarea parolei de backup")
    db_user = await db.users.find_one({"_id": ObjectId(user["id"])})
    if not db_user:
        raise HTTPException(404, "Utilizator inexistent.")

    # Generate a strong, human-readable temp password
    temp_pw = secrets.token_urlsafe(9)  # 12-char base64 (e.g. "Vh3K8L_4mPq")
    await db.users.update_one(
        {"_id": db_user["_id"]},
        {"$set": {
            "password_hash": hash_password(temp_pw),
            "password_temp_issued_at": datetime.now(timezone.utc).isoformat(),
        }}
    )

    # Send email with the temp password (we never log it server-side)
    email = db_user.get("email")
    name = db_user.get("name") or "utilizator"
    front_url = os.environ.get("FRONTEND_URL", "https://propmanage.ro")
    html = (
        f"<div style='font-family: Inter, sans-serif; max-width:560px; margin:0 auto; "
        f"background:#0a0a0b; color:#fafaf9; padding:24px; border-radius:12px;'>"
        f"<h2 style='font-family: Georgia, serif; color:#d4ff3a;'>Parola ta de backup PropManage</h2>"
        f"<p>Salut {name},</p>"
        f"<p>Ai cerut o parolă de backup pentru contul <strong>{email}</strong>.</p>"
        f"<p>Folosește această parolă pentru a te loga la "
        f"<a href='{front_url}/login' style='color:#d4ff3a;'>{front_url}/login</a> "
        f"când Google OAuth nu este disponibil:</p>"
        f"<div style='background:#fff; color:#0a0a0b; font-family: monospace; font-size:18px; "
        f"font-weight:bold; padding:12px 16px; border-radius:8px; letter-spacing:1px; text-align:center; margin:16px 0;'>"
        f"{temp_pw}"
        f"</div>"
        f"<p style='color:#a8a29e; font-size:13px;'>⚠ Această parolă <strong>înlocuiește</strong> orice "
        f"parolă veche de pe contul tău. Recomandăm să o schimbi imediat după login (Profil → Setări → Parolă).</p>"
        f"<p style='color:#a8a29e; font-size:13px;'>Dacă NU ai cerut tu această parolă, contul tău poate fi "
        f"compromis. Loghează-te imediat și schimbă-o, sau scrie la "
        f"<a href='mailto:contact@propmanage.ro' style='color:#d4ff3a;'>contact@propmanage.ro</a>.</p>"
        f"<hr style='border:none;border-top:1px solid #292524; margin:24px 0;'/>"
        f"<p style='color:#78716c; font-size:11px; text-align:center;'>"
        f"PropManage SRL · {front_url}</p>"
        f"</div>"
    )
    try:
        await send_email(email, "Parola ta de backup PropManage", html)
    except Exception as e:
        logger.warning(f"Failed to send backup password email to {email}: {e}")
        # Don't reveal email-send failure to the user beyond a generic message;
        # the password IS set in DB regardless, so future logins work.
        raise HTTPException(502, "Parola a fost generată dar email-ul nu a putut fi trimis. Contactează support.")

    return {"ok": True, "email_to": email, "expires_note": "Parola nu expiră — schimb-o din Setări după login."}


@router.post("/auth/tutorial-seen")
async def mark_tutorial_seen(user: dict = Depends(get_current_user)):
    """Mark the first-login tutorial as completed/dismissed by the user."""
    await db.users.update_one(
        {"_id": ObjectId(user["id"])},
        {"$set": {"tutorial_seen": True, "tutorial_seen_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"ok": True}


@router.post("/auth/tutorial-reset")
async def reset_tutorial(user: dict = Depends(get_current_user)):
    """Allow user to re-trigger the tutorial."""
    await db.users.update_one(
        {"_id": ObjectId(user["id"])},
        {"$unset": {"tutorial_seen": "", "tutorial_seen_at": "", "dashboard_tour_completed": "", "dashboard_tour_completed_at": ""}}
    )
    return {"ok": True}


@router.post("/auth/dashboard-tour-done")
async def mark_dashboard_tour_done(user: dict = Depends(get_current_user)):
    """Mark the role-specific Driver.js dashboard tour as completed/dismissed."""
    await db.users.update_one(
        {"_id": ObjectId(user["id"])},
        {"$set": {"dashboard_tour_completed": True, "dashboard_tour_completed_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"ok": True}


@router.post("/auth/ai-admin-tour-seen")
async def mark_ai_admin_tour_seen(user: dict = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin only")
    await db.users.update_one(
        {"_id": ObjectId(user["id"])},
        {"$set": {"ai_admin_tour_seen": True, "ai_admin_tour_seen_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"ok": True}


@router.post("/auth/ai-admin-tour-reset")
async def reset_ai_admin_tour(user: dict = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin only")
    await db.users.update_one(
        {"_id": ObjectId(user["id"])},
        {"$unset": {"ai_admin_tour_seen": "", "ai_admin_tour_seen_at": ""}}
    )
    return {"ok": True}


@router.get("/auth/ws-token")
async def ws_token(user: dict = Depends(get_current_user)):
    """Issue a short-lived JWT for WebSocket connections."""
    token = create_access_token(user["id"], user["email"], user["role"])
    return {"token": token}


# ============= DUAL-ROLE SWITCHER =============
class SwitchViewIn(BaseModel):
    view: Literal["client", "specialist"]


@router.post("/auth/switch-view")
async def switch_view(data: SwitchViewIn, user: dict = Depends(get_current_user)):
    """Verified specialists can toggle between specialist and client view."""
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


# ============= PROFILE / PASSWORD =============
class ProfileUpdateIn(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=80)
    phone: Optional[str] = Field(default=None, max_length=30)
    zone: Optional[str] = Field(default=None, max_length=80)
    avatar: Optional[str] = Field(default=None, max_length=2_000_000)
    # Specialist-only fields — allowed only when current user has role=specialist (validated below)
    service_categories: Optional[list[str]] = Field(default=None, max_length=20)
    coverage_zones: Optional[list[str]] = Field(default=None, max_length=20)


@router.patch("/auth/profile")
async def update_profile(data: ProfileUpdateIn, user: dict = Depends(get_current_user)):
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    # Specialist-scope guard: refuse to set categories/zones on a non-specialist account
    if user.get("role") != "specialist":
        update.pop("service_categories", None)
        update.pop("coverage_zones", None)
    if not update:
        raise HTTPException(400, "Niciun câmp de actualizat.")
    await db.users.update_one({"_id": ObjectId(user["id"])}, {"$set": update})
    refreshed = await db.users.find_one({"_id": ObjectId(user["id"])})
    return serialize_doc(refreshed)


class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6)


@router.post("/auth/change-password")
async def change_password(data: ChangePasswordIn, user: dict = Depends(block_impersonation_dep("schimbarea parolei"))):
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


# ============= GDPR EXPORT & DELETE =============
@router.post("/auth/account-export")
async def account_export(user: dict = Depends(get_current_user)):
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
    confirmation: str


@router.post("/auth/account-delete")
async def account_delete(data: AccountDeleteIn, response: Response, user: dict = Depends(block_impersonation_dep("ștergerea contului"))):
    if data.confirmation != "STERGE":
        raise HTTPException(400, "Confirmarea trebuie să fie exact 'STERGE'.")
    db_user = await db.users.find_one({"_id": ObjectId(user["id"])})
    if not db_user or not verify_password(data.password, db_user.get("password_hash", "")):
        raise HTTPException(401, "Parolă incorectă.")
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


# ============= REFERRAL =============
@router.get("/auth/referral")
async def referral_info(user: dict = Depends(get_current_user)):
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


# ============= SUPPORT / CONTACT =============
class ContactIn(BaseModel):
    subject: str = Field(min_length=2, max_length=200)
    message: str = Field(min_length=5, max_length=5000)


@router.post("/support/contact")
async def support_contact(data: ContactIn, user: dict = Depends(get_current_user)):
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


# ============= WEB PUSH SUBSCRIPTIONS =============
class PushSubscriptionKeys(BaseModel):
    p256dh: str
    auth: str


class PushSubscriptionIn(BaseModel):
    endpoint: str
    keys: PushSubscriptionKeys
    expirationTime: Optional[int] = None


@router.get("/push/vapid-public-key")
async def push_vapid_public():
    if not VAPID_PUBLIC_KEY:
        raise HTTPException(503, "Push notifications nu sunt configurate pe server.")
    return {"public_key": VAPID_PUBLIC_KEY}


@router.post("/push/subscribe")
async def push_subscribe(data: PushSubscriptionIn, user: dict = Depends(get_current_user)):
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


@router.post("/push/unsubscribe")
async def push_unsubscribe(data: PushSubscriptionIn, user: dict = Depends(get_current_user)):
    await db.push_subscriptions.delete_one({"endpoint": data.endpoint, "user_id": user["id"]})
    return {"ok": True}


# ============= 2FA (TOTP) =============
@router.post("/auth/2fa/setup")
async def setup_2fa(user: dict = Depends(get_current_user)):
    block_in_impersonation(user, "configurarea 2FA")
    secret = pyotp.random_base32()
    await db.users.update_one(
        {"_id": ObjectId(user["id"])},
        {"$set": {"totp_pending_secret": secret}}
    )
    issuer = "PropManage"
    otp_uri = pyotp.TOTP(secret).provisioning_uri(name=user["email"], issuer_name=issuer)
    img = qrcode.make(otp_uri)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    qr_data_url = f"data:image/png;base64,{b64.b64encode(buf.getvalue()).decode()}"
    return {"secret": secret, "otp_uri": otp_uri, "qr_code": qr_data_url}


@router.post("/auth/2fa/verify")
async def verify_2fa(data: TotpVerifyIn, user: dict = Depends(block_impersonation_dep("activarea 2FA"))):
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


@router.post("/auth/2fa/disable")
async def disable_2fa(data: TotpVerifyIn, user: dict = Depends(block_impersonation_dep("dezactivarea 2FA"))):
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


@router.get("/auth/2fa/status")
async def status_2fa(user: dict = Depends(get_current_user)):
    full_user = await db.users.find_one({"_id": ObjectId(user["id"])})
    return {"enabled": bool(full_user.get("totp_enabled"))}


# ============= GOOGLE OAUTH (Emergent-managed) =============
@router.post("/auth/google/session")
async def google_session_exchange(request: Request, response: Response):
    """Exchange Emergent session_id for our JWT cookie + user record."""
    session_id = request.headers.get("X-Session-ID")
    if not session_id:
        raise HTTPException(400, "Lipsește header-ul X-Session-ID")
    upstream_status = None
    upstream_body = None
    async with httpx.AsyncClient(timeout=10) as http_client:
        try:
            r = await http_client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_id}
            )
            upstream_status = r.status_code
            try:
                upstream_body = r.text[:300]
            except Exception:
                upstream_body = "(no body)"
            if r.status_code != 200:
                # Surface the EXACT upstream error so we can diagnose redirect-URL whitelist /
                # session expiry / wrong client_id from the user's side.
                logger.warning(f"Emergent OAuth exchange failed: status={upstream_status} body={upstream_body[:200]}")
                raise HTTPException(
                    401,
                    f"Emergent OAuth a refuzat sesiunea (upstream HTTP {upstream_status}). "
                    f"Detaliu: {upstream_body[:200]}. Cauze posibile: (1) session_id expirat — încearcă din nou rapid, "
                    f"(2) propmanage.ro/auth/callback nu este whitelisted în panoul OAuth Emergent — "
                    f"contactează support@emergent.sh."
                )
            data = r.json()
        except HTTPException:
            raise
        except httpx.HTTPError as e:
            logger.error(f"Emergent OAuth network failure: {e!r}")
            raise HTTPException(502, f"Nu pot contacta serverul OAuth Emergent: {e}")

    email = data.get("email", "").lower()
    name = data.get("name", "")
    picture = data.get("picture", "")

    existing = await db.users.find_one({"email": email})
    if existing:
        await db.users.update_one(
            {"_id": existing["_id"]},
            {"$set": {"picture": picture, "name": name, "google_auth": True}}
        )
        user = await db.users.find_one({"_id": existing["_id"]})
        uid = str(user["_id"])
    else:
        new_user = {
            "email": email,
            "name": name,
            "picture": picture,
            "role": "client",
            "google_auth": True,
            "password_hash": "",
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

    user = await _enforce_admin_role(user)
    # Track last_seen for beta engagement analytics
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"last_seen": datetime.now(timezone.utc).isoformat()}}
    )
    access = create_access_token(uid, email, user.get("role", "client"))
    refresh = create_refresh_token(uid)
    set_auth_cookies(response, access, refresh)
    return serialize_doc(user)


# ============= DIGEST PREFERENCE & PREVIEW =============
class DigestPrefIn(BaseModel):
    enabled: bool


@router.post("/auth/digest-preference")
async def set_digest_preference(data: DigestPrefIn, user: dict = Depends(get_current_user)):
    await db.users.update_one(
        {"_id": ObjectId(user["id"])},
        {"$set": {"digest_disabled": not data.enabled}}
    )
    return {"ok": True, "digest_disabled": not data.enabled}


@router.post("/admin/digest/trigger")
async def trigger_daily_digest(user: dict = Depends(require_role("admin"))):
    """Manual trigger for testing — sends today's digest to all eligible users."""
    counts = await run_daily_digests()
    return {"ok": True, "counts": counts}


@router.post("/auth/digest/preview")
async def preview_my_digest(user: dict = Depends(get_current_user)):
    builder = DIGEST_BUILDERS.get(user.get("role"))
    if not builder:
        raise HTTPException(400, "Rol fără digest configurat.")
    digest = await builder(user)
    return digest or {"summary": "Niciun conținut relevant astăzi.", "cards": "", "empty": True}
