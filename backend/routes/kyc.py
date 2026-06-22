"""KYC (Know Your Customer) — specialist identity verification.

Pipeline:
  not_started → uploaded → reviewing → approved | rejected

Specialist uploads 3 documents (base64-encoded, < 3MB each):
  - id_front: front side of national ID
  - id_back: back side of national ID
  - selfie: live selfie holding the ID

Admin (or any sub-admin with scope=security) can approve/reject from a
review queue. On approve: sets ``user.verified=true``, ``tier=VERIFIED``,
``kyc_approved_at`` timestamp, and runs the existing tier milestone hook.

Storage: documents persisted in the ``kyc_documents`` collection. Base64
strings (max ~3MB each) — small enough for MongoDB document size limits.
Future migration target: object storage via Emergent integration.
"""
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional, Literal

from bson import ObjectId
from fastapi import APIRouter, Body, Depends, HTTPException
from pydantic import BaseModel, Field

from db import db
from deps import get_current_user, require_role

logger = logging.getLogger("propmanage.kyc")
router = APIRouter(prefix="/api/kyc", tags=["kyc"])

MAX_B64_SIZE = 4_500_000  # ~3.4MB binary after base64 decode

KycStatus = Literal["not_started", "uploaded", "reviewing", "approved", "rejected"]


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _strip_data_url(b64: str) -> str:
    if not b64:
        return ""
    if b64.startswith("data:"):
        # data:image/jpeg;base64,XXXXXX
        try:
            return b64.split(",", 1)[1]
        except IndexError:
            return ""
    return b64


def _validate_image(name: str, b64: str) -> None:
    if not b64:
        raise HTTPException(400, f"Câmpul '{name}' este obligatoriu")
    if len(b64) > MAX_B64_SIZE:
        raise HTTPException(413, f"'{name}' depășește limita de ~3MB")


class KYCUploadIn(BaseModel):
    id_front: str = Field(..., description="Base64 (with or without data:url prefix)")
    id_back: str
    selfie: str
    full_name_on_id: Optional[str] = None
    national_id_number: Optional[str] = None  # CNP (masked server-side)


class KYCDecisionIn(BaseModel):
    note: Optional[str] = Field(default=None, max_length=500)


def _public_payload(doc: dict, include_files: bool = False) -> dict:
    """Serialize a kyc_documents row safely. Files are heavy → omit by default."""
    payload = {
        "id": doc.get("id"),
        "user_id": doc.get("user_id"),
        "user_email": doc.get("user_email"),
        "user_name": doc.get("user_name"),
        "status": doc.get("status"),
        "submitted_at": doc.get("submitted_at"),
        "reviewed_at": doc.get("reviewed_at"),
        "reviewed_by_email": doc.get("reviewed_by_email"),
        "review_note": doc.get("review_note"),
        "full_name_on_id": doc.get("full_name_on_id"),
        "national_id_masked": doc.get("national_id_masked"),
    }
    if include_files:
        payload["id_front"] = doc.get("id_front")
        payload["id_back"] = doc.get("id_back")
        payload["selfie"] = doc.get("selfie")
    return payload


def _mask_cnp(cnp: Optional[str]) -> Optional[str]:
    if not cnp:
        return None
    s = "".join(ch for ch in cnp if ch.isdigit())
    if len(s) < 6:
        return "***"
    return f"{s[:3]}******{s[-2:]}"


# ============================================================================
# SPECIALIST ENDPOINTS
# ============================================================================
@router.get("/status")
async def my_kyc_status(user: dict = Depends(get_current_user)):
    """Return the current user's KYC state (any role can call)."""
    latest = await db.kyc_documents.find_one(
        {"user_id": user["id"]},
        sort=[("submitted_at", -1)],
    )
    if not latest:
        return {
            "status": "not_started",
            "can_upload": user.get("role") == "specialist",
            "verified_in_user_doc": bool(user.get("verified")),
        }
    return {
        **_public_payload(latest, include_files=False),
        "can_upload": latest.get("status") in {"rejected", "not_started"},
        "verified_in_user_doc": bool(user.get("verified")),
    }


@router.post("/upload")
async def upload_kyc(payload: KYCUploadIn, user: dict = Depends(require_role("specialist"))):
    """Specialist uploads ID front + back + selfie. Idempotent if rejected (creates new row)."""
    id_front = _strip_data_url(payload.id_front)
    id_back = _strip_data_url(payload.id_back)
    selfie = _strip_data_url(payload.selfie)
    _validate_image("id_front", id_front)
    _validate_image("id_back", id_back)
    _validate_image("selfie", selfie)

    # Block re-upload if currently uploaded/reviewing/approved
    latest = await db.kyc_documents.find_one(
        {"user_id": user["id"]},
        sort=[("submitted_at", -1)],
    )
    if latest and latest.get("status") in {"uploaded", "reviewing", "approved"}:
        raise HTTPException(
            409,
            f"KYC deja '{latest.get('status')}'. Așteaptă review-ul administratorului.",
        )

    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "user_email": user.get("email"),
        "user_name": user.get("name"),
        "status": "uploaded",
        "submitted_at": _now_iso(),
        "id_front": id_front,
        "id_back": id_back,
        "selfie": selfie,
        "full_name_on_id": (payload.full_name_on_id or "").strip()[:120] or None,
        "national_id_masked": _mask_cnp(payload.national_id_number),
        # raw CNP stored hashed/encrypted in a real system; we keep masked only for demo
    }
    await db.kyc_documents.insert_one(doc)
    # Notify admins (security scope) + super admin
    try:
        from services import notify
        async for reviewer in db.users.find({
            "role": "admin",
            "$or": [{"admin_scope": "general"}, {"admin_scope": "security"}],
            "is_active": {"$ne": False},
        }):
            try:
                await notify(
                    str(reviewer["_id"]),
                    "📋 KYC nou de revizuit",
                    f"{user.get('email')} a trimis documentele de identitate pentru verificare.",
                    type_="kyc_pending",
                    link="/admin",
                )
            except Exception:  # noqa: BLE001
                pass
    except Exception:  # noqa: BLE001
        pass
    return _public_payload(doc, include_files=False)


# ============================================================================
# ADMIN / OPERATOR REVIEW ENDPOINTS
# ============================================================================
@router.get("/admin/queue")
async def kyc_queue(
    status: Optional[str] = None,
    limit: int = 50,
    user: dict = Depends(get_current_user),
):
    """Admin / operator: list KYC submissions."""
    if user.get("role") not in {"admin", "operator"}:
        raise HTTPException(403, "Admin/operator role required")
    q: dict = {}
    if status and status not in {"all", "default"}:
        q["status"] = status
    elif status is None:
        # default view = pending review
        q["status"] = {"$in": ["uploaded", "reviewing"]}
    # else: "all" → no status filter
    limit = max(1, min(int(limit), 200))
    cursor = db.kyc_documents.find(q, sort=[("submitted_at", -1)]).limit(limit)
    items = [_public_payload(d, include_files=False) async for d in cursor]
    # Counters per status for chips
    counts: dict = {}
    async for d in db.kyc_documents.aggregate([
        {"$group": {"_id": "$status", "n": {"$sum": 1}}},
    ]):
        counts[d.get("_id") or "unknown"] = d.get("n", 0)
    return {"items": items, "count": len(items), "counts": counts}


@router.get("/admin/{kyc_id}")
async def kyc_detail(kyc_id: str, user: dict = Depends(get_current_user)):
    """Admin/operator: fetch full KYC doc with base64 files for review modal."""
    if user.get("role") not in {"admin", "operator"}:
        raise HTTPException(403, "Admin/operator role required")
    doc = await db.kyc_documents.find_one({"id": kyc_id})
    if not doc:
        raise HTTPException(404, "KYC not found")
    return _public_payload(doc, include_files=True)


@router.post("/admin/{kyc_id}/approve")
async def kyc_approve(
    kyc_id: str,
    payload: KYCDecisionIn = Body(default=None),
    user: dict = Depends(require_role("admin")),
):
    doc = await db.kyc_documents.find_one({"id": kyc_id})
    if not doc:
        raise HTTPException(404, "KYC not found")
    if doc.get("status") not in {"uploaded", "reviewing"}:
        raise HTTPException(400, f"KYC e deja '{doc.get('status')}'")
    note = (payload.note if payload else None) or ""
    now_iso = _now_iso()
    await db.kyc_documents.update_one(
        {"id": kyc_id},
        {"$set": {
            "status": "approved",
            "reviewed_at": now_iso,
            "reviewed_by": user["id"],
            "reviewed_by_email": user.get("email"),
            "review_note": note[:500],
        }},
    )
    # Promote the user — mirror logic of /api/admin/specialists/{id}/verify
    try:
        from bson import ObjectId as _OID
        spec = await db.users.find_one({"_id": _OID(doc["user_id"])})
        if spec and spec.get("role") == "specialist":
            await db.users.update_one(
                {"_id": spec["_id"]},
                {"$set": {
                    "verified": True,
                    "tier": "VERIFIED",
                    "verified_at": now_iso,
                    "kyc_id": kyc_id,
                    "kyc_approved_at": now_iso,
                }},
            )
            try:
                from services import notify
                await notify(
                    doc["user_id"],
                    "✅ KYC aprobat",
                    "Documentele tale au fost verificate. Contul tău este acum VERIFIED.",
                    type_="kyc_approved",
                    link="/specialist",
                )
            except Exception:  # noqa: BLE001
                pass
            try:
                from routes.tier_milestones import check_tier_milestones
                await check_tier_milestones(doc["user_id"])
            except Exception:  # noqa: BLE001
                pass
    except Exception as e:  # noqa: BLE001
        logger.warning(f"[kyc] failed to promote user after approve: {e}")
    return {"ok": True, "status": "approved", "id": kyc_id}


@router.post("/admin/{kyc_id}/reject")
async def kyc_reject(
    kyc_id: str,
    payload: KYCDecisionIn = Body(default=None),
    user: dict = Depends(require_role("admin")),
):
    doc = await db.kyc_documents.find_one({"id": kyc_id})
    if not doc:
        raise HTTPException(404, "KYC not found")
    if doc.get("status") not in {"uploaded", "reviewing"}:
        raise HTTPException(400, f"KYC e deja '{doc.get('status')}'")
    note = (payload.note if payload else None) or ""
    await db.kyc_documents.update_one(
        {"id": kyc_id},
        {"$set": {
            "status": "rejected",
            "reviewed_at": _now_iso(),
            "reviewed_by": user["id"],
            "reviewed_by_email": user.get("email"),
            "review_note": note[:500],
        }},
    )
    try:
        from services import notify
        await notify(
            doc["user_id"],
            "❌ KYC respins",
            f"Documentele au fost respinse. Motiv: {note or 'necunoscut'}. Poți încărca din nou.",
            type_="kyc_rejected",
            link="/kyc",
        )
    except Exception:  # noqa: BLE001
        pass
    return {"ok": True, "status": "rejected", "id": kyc_id}
