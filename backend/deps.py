"""FastAPI dependencies for auth (get_current_user, require_role)."""
import jwt
from bson import ObjectId
from fastapi import Request, Depends, HTTPException

from db import db
from core_utils import JWT_SECRET, JWT_ALGORITHM, serialize_doc


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        h = request.headers.get("Authorization", "")
        if h.startswith("Bearer "):
            token = h[7:]
    if not token:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(401, "Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(401, "User not found")
        return serialize_doc(user)
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")


def require_role(*allowed):
    async def dep(user: dict = Depends(get_current_user)):
        if user.get("role") in allowed:
            return user
        # Dual-role: verified specialist with active_view=client can access client-only endpoints
        if (
            user.get("role") == "specialist"
            and user.get("dual_role_enabled") is True
            and user.get("active_view") in allowed
        ):
            return user
        raise HTTPException(403, "Insufficient permissions")
    return dep
