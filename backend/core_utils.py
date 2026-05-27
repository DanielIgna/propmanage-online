"""Pure utility helpers — JWT, password hashing, serialization. No DB."""
import os
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from fastapi import Response

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = "HS256"


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


def create_impersonation_token(target_user_id: str, target_email: str, target_role: str,
                               admin_id: str, admin_email: str, log_id: str,
                               ttl_seconds: int = 7200) -> str:
    """Special access token signed for a target user, but tagged with the impersonating admin.
    TTL defaults to 2h (user choice 4.c). Cannot be refreshed."""
    return jwt.encode({
        "sub": target_user_id, "email": target_email, "role": target_role,
        "exp": datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds),
        "type": "access",
        "impersonation": {
            "admin_id": admin_id,
            "admin_email": admin_email,
            "log_id": log_id,
            "started_at": datetime.now(timezone.utc).isoformat(),
        }
    }, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    return jwt.encode({
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "refresh"
    }, JWT_SECRET, algorithm=JWT_ALGORITHM)


def serialize_doc(doc):
    if doc is None:
        return None
    doc = dict(doc)
    if "_id" in doc:
        doc["id"] = str(doc.pop("_id"))
    doc.pop("password_hash", None)
    # Dual-role: ensure active_view + dual_role_enabled are always present
    if doc.get("role") in ("client", "specialist", "admin", "operator"):
        is_verified_spec = doc.get("role") == "specialist" and doc.get("verified") is True
        doc["dual_role_enabled"] = is_verified_spec
        av = doc.get("active_view")
        if doc.get("role") == "specialist" and is_verified_spec and av == "client":
            doc["active_view"] = "client"
        else:
            doc["active_view"] = doc.get("role")
    return doc


def set_auth_cookies(response: Response, access: str, refresh: str):
    response.set_cookie("access_token", access, httponly=True, secure=False, samesite="lax", max_age=86400, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")


def effective_role(user: dict) -> str:
    """Returns active_view for dual-role specialists, otherwise the user's primary role."""
    if user.get("role") == "specialist" and user.get("dual_role_enabled") is True:
        return user.get("active_view") or "specialist"
    return user.get("role", "client")
