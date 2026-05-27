"""PropManage — Digital Twin module (Phase A: infrastructure).

Isolated module. Touches only its own collections:
  - digital_twin_projects
  - digital_twin_models  (placeholder, real upload comes in Phase B)
  - digital_twin_pins
  - digital_twin_comments

Subscription gate: user.digital_twin_pro == True (admin grants for now;
Stripe wiring is Phase E). Admin and operator can bypass.
"""
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
import os
import shutil
import uuid

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, Body, Query, UploadFile, File
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from db import db
from deps import get_current_user, require_role

router = APIRouter(prefix="/api/digital-twin", tags=["digital-twin"])


# ----------------- storage config -----------------

UPLOAD_ROOT = Path(os.environ.get("DT_UPLOAD_DIR") or "/app/backend/uploads/digital_twin")
UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)

ALLOWED_EXTS = {".glb", ".gltf"}
MAX_UPLOAD_BYTES = 200 * 1024 * 1024  # 200 MB hard cap


# ----------------- helpers -----------------

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _new_id() -> str:
    return uuid.uuid4().hex


def _user_filter(user_id: str) -> dict:
    """Build a Mongo filter that matches a user by id (string or ObjectId hex)."""
    try:
        return {"_id": ObjectId(user_id)}
    except (InvalidId, TypeError):
        return {"id": user_id}


async def _has_dt_access(user: dict) -> bool:
    """User has Digital Twin Pro access? Admin/operator always; others via flag."""
    if user.get("role") in ("admin", "operator"):
        return True
    fresh = await db.users.find_one(_user_filter(user["id"]), {"digital_twin_pro": 1})
    return bool(fresh and fresh.get("digital_twin_pro"))


async def _ensure_dt_access(user: dict) -> None:
    if not await _has_dt_access(user):
        raise HTTPException(403, "Subscription Digital Twin Pro required.")


async def _ensure_project_access(project_id: str, user: dict) -> dict:
    """Returns project doc if user is owner, member, or admin/operator."""
    p = await db.digital_twin_projects.find_one({"id": project_id})
    if not p:
        raise HTTPException(404, "Project not found.")
    if user.get("role") in ("admin", "operator"):
        return p
    if p.get("owner_id") == user["id"]:
        return p
    members = p.get("members") or []
    if any(m.get("user_id") == user["id"] for m in members):
        return p
    raise HTTPException(403, "No access to this project.")


def _clean(d: dict) -> dict:
    """Remove Mongo _id before returning."""
    d.pop("_id", None)
    return d


# ----------------- subscription check -----------------

@router.get("/subscription")
async def my_subscription(user: dict = Depends(get_current_user)):
    """Tell the frontend whether user can access Digital Twin Pro."""
    has = await _has_dt_access(user)
    return {
        "active": has,
        "reason": "role_bypass" if user.get("role") in ("admin", "operator") else ("flag" if has else "inactive"),
        "tier": "digital_twin_pro" if has else None,
    }


# ----------------- projects -----------------

class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    property_id: Optional[str] = None
    description: Optional[str] = Field(None, max_length=2000)
    model_url: Optional[str] = Field(None, max_length=2000)  # Phase B: external .glb URL


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    model_url: Optional[str] = Field(None, max_length=2000)


@router.post("/projects")
async def create_project(payload: ProjectCreate, user: dict = Depends(get_current_user)):
    await _ensure_dt_access(user)
    pid = _new_id()
    now = _now_iso()
    doc = {
        "id": pid,
        "name": payload.name.strip(),
        "property_id": payload.property_id,
        "description": (payload.description or "").strip(),
        "model_url": (payload.model_url or "").strip() or None,
        "owner_id": user["id"],
        "owner_name": user.get("name") or user.get("email"),
        "members": [],
        "model_count": 0,
        "pin_count": 0,
        "created_at": now,
        "updated_at": now,
    }
    await db.digital_twin_projects.insert_one(doc)
    return _clean(doc)


@router.get("/projects")
async def list_projects(user: dict = Depends(get_current_user)):
    await _ensure_dt_access(user)
    # Admin/operator see all; others see owned + member-of.
    if user.get("role") in ("admin", "operator"):
        q = {}
    else:
        q = {"$or": [{"owner_id": user["id"]}, {"members.user_id": user["id"]}]}
    items = []
    async for p in db.digital_twin_projects.find(q).sort("updated_at", -1).limit(200):
        items.append(_clean(p))
    return {"items": items, "count": len(items)}


@router.get("/projects/{project_id}")
async def get_project(project_id: str, user: dict = Depends(get_current_user)):
    await _ensure_dt_access(user)
    p = await _ensure_project_access(project_id, user)
    # Attach lightweight counts.
    p["pin_count"] = await db.digital_twin_pins.count_documents({"project_id": project_id})
    p["model_count"] = await db.digital_twin_models.count_documents({"project_id": project_id})
    return _clean(p)


class MemberAdd(BaseModel):
    user_id: str
    role: str = Field("specialist", pattern="^(specialist|client|architect|viewer)$")


@router.post("/projects/{project_id}/members")
async def add_member(project_id: str, payload: MemberAdd, user: dict = Depends(get_current_user)):
    await _ensure_dt_access(user)
    p = await _ensure_project_access(project_id, user)
    # Only owner / admin / operator can add members.
    if user.get("role") not in ("admin", "operator") and p.get("owner_id") != user["id"]:
        raise HTTPException(403, "Only project owner can add members.")
    target = await db.users.find_one(_user_filter(payload.user_id), {"_id": 1, "name": 1, "email": 1})
    if not target:
        raise HTTPException(404, "User not found.")
    existing = [m for m in (p.get("members") or []) if m.get("user_id") != payload.user_id]
    existing.append({
        "user_id": payload.user_id,
        "name": target.get("name") or target.get("email"),
        "role": payload.role,
        "added_at": _now_iso(),
    })
    await db.digital_twin_projects.update_one(
        {"id": project_id},
        {"$set": {"members": existing, "updated_at": _now_iso()}},
    )
    return {"ok": True, "members": existing}


@router.delete("/projects/{project_id}/members/{user_id}")
async def remove_member(project_id: str, user_id: str, user: dict = Depends(get_current_user)):
    await _ensure_dt_access(user)
    p = await _ensure_project_access(project_id, user)
    if user.get("role") not in ("admin", "operator") and p.get("owner_id") != user["id"]:
        raise HTTPException(403, "Only project owner can remove members.")
    members = [m for m in (p.get("members") or []) if m.get("user_id") != user_id]
    await db.digital_twin_projects.update_one(
        {"id": project_id},
        {"$set": {"members": members, "updated_at": _now_iso()}},
    )
    return {"ok": True, "members": members}


@router.patch("/projects/{project_id}")
async def update_project(project_id: str, payload: ProjectUpdate, user: dict = Depends(get_current_user)):
    await _ensure_dt_access(user)
    p = await _ensure_project_access(project_id, user)
    if user.get("role") not in ("admin", "operator") and p.get("owner_id") != user["id"]:
        raise HTTPException(403, "Only owner can update.")
    updates = {k: (v.strip() if isinstance(v, str) else v) for k, v in payload.model_dump(exclude_none=True).items()}
    if not updates:
        return _clean(p)
    updates["updated_at"] = _now_iso()
    await db.digital_twin_projects.update_one({"id": project_id}, {"$set": updates})
    p = await db.digital_twin_projects.find_one({"id": project_id})
    return _clean(p)


@router.delete("/projects/{project_id}")
async def delete_project(project_id: str, user: dict = Depends(get_current_user)):
    await _ensure_dt_access(user)
    p = await _ensure_project_access(project_id, user)
    if user.get("role") not in ("admin", "operator") and p.get("owner_id") != user["id"]:
        raise HTTPException(403, "Only owner can delete.")
    await db.digital_twin_projects.delete_one({"id": project_id})
    await db.digital_twin_models.delete_many({"project_id": project_id})
    pins = await db.digital_twin_pins.find({"project_id": project_id}, {"id": 1}).to_list(length=10000)
    pin_ids = [pin["id"] for pin in pins]
    if pin_ids:
        await db.digital_twin_comments.delete_many({"pin_id": {"$in": pin_ids}})
    await db.digital_twin_pins.delete_many({"project_id": project_id})
    # Remove any uploaded files
    project_dir = UPLOAD_ROOT / project_id
    if project_dir.exists():
        shutil.rmtree(project_dir, ignore_errors=True)
    return {"ok": True}


# ----------------- model upload & serve (Phase B) -----------------

@router.post("/projects/{project_id}/upload")
async def upload_model(
    project_id: str,
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    """Upload a .glb/.gltf model for the project. Stored locally and served via /files/."""
    await _ensure_dt_access(user)
    p = await _ensure_project_access(project_id, user)
    if user.get("role") not in ("admin", "operator") and p.get("owner_id") != user["id"]:
        raise HTTPException(403, "Only owner can upload models.")

    # Validate extension
    raw_name = file.filename or "model.glb"
    ext = Path(raw_name).suffix.lower()
    if ext not in ALLOWED_EXTS:
        raise HTTPException(400, "Format permis: .glb sau .gltf. Pentru .skp conversie prealabilă în SketchUp Free → File → Export → glTF.")

    # Persist to disk with streaming (chunks of 1 MB) to avoid loading 200MB in RAM
    project_dir = UPLOAD_ROOT / project_id
    project_dir.mkdir(parents=True, exist_ok=True)
    safe_stem = uuid.uuid4().hex[:12]
    safe_name = f"{safe_stem}{ext}"
    dest = project_dir / safe_name

    total = 0
    try:
        with dest.open("wb") as out:
            while True:
                chunk = await file.read(1024 * 1024)  # 1 MB
                if not chunk:
                    break
                total += len(chunk)
                if total > MAX_UPLOAD_BYTES:
                    out.close()
                    dest.unlink(missing_ok=True)
                    raise HTTPException(413, f"Fișier prea mare (max {MAX_UPLOAD_BYTES // (1024*1024)} MB).")
                out.write(chunk)
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        dest.unlink(missing_ok=True)
        raise HTTPException(500, f"Upload failed: {e}") from e

    # Build the public URL. Use APP_PUBLIC_URL when set, else relative path the frontend will resolve.
    public_path = f"/api/digital-twin/files/{project_id}/{safe_name}"

    # Save model metadata + set as current model on project
    model_doc = {
        "id": _new_id(),
        "project_id": project_id,
        "filename": raw_name,
        "stored_as": safe_name,
        "size_bytes": total,
        "url": public_path,
        "uploaded_by": user["id"],
        "uploaded_by_name": user.get("name") or user.get("email"),
        "uploaded_at": _now_iso(),
    }
    await db.digital_twin_models.insert_one(model_doc)
    await db.digital_twin_projects.update_one(
        {"id": project_id},
        {"$set": {"model_url": public_path, "updated_at": _now_iso()}, "$inc": {"model_count": 1}},
    )
    return _clean(model_doc)


@router.get("/files/{project_id}/{filename}")
async def serve_model_file(project_id: str, filename: str, user: dict = Depends(get_current_user)):
    """Serve uploaded model files. Permission-checked: only project members + admin/operator."""
    await _ensure_dt_access(user)
    await _ensure_project_access(project_id, user)
    # Sanitize: filename must be a bare name, no path traversal
    if "/" in filename or "\\" in filename or filename.startswith(".."):
        raise HTTPException(400, "Invalid filename.")
    file_path = UPLOAD_ROOT / project_id / filename
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(404, "Model file not found.")
    media = "model/gltf-binary" if filename.lower().endswith(".glb") else "model/gltf+json"
    return FileResponse(
        file_path,
        media_type=media,
        filename=filename,
        headers={"Cache-Control": "private, max-age=3600"},
    )


@router.get("/projects/{project_id}/models")
async def list_models(project_id: str, user: dict = Depends(get_current_user)):
    """List all uploaded model versions for a project."""
    await _ensure_dt_access(user)
    await _ensure_project_access(project_id, user)
    items = []
    async for m in db.digital_twin_models.find({"project_id": project_id}).sort("uploaded_at", -1):
        items.append(_clean(m))
    return {"items": items, "count": len(items)}


# ----------------- pins (3D markup) -----------------

class Pin3D(BaseModel):
    x: float
    y: float
    z: float


class PinCreate(BaseModel):
    model_id: Optional[str] = None
    position: Pin3D
    element_id: Optional[str] = None  # IFC GlobalId if available
    title: str = Field(..., min_length=2, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    priority: str = Field("normal", pattern="^(low|normal|high|urgent)$")
    category: str = Field("general", pattern="^(general|structural|plumbing|electrical|hvac|finish|defect)$")


@router.post("/projects/{project_id}/pins")
async def create_pin(project_id: str, payload: PinCreate, user: dict = Depends(get_current_user)):
    await _ensure_dt_access(user)
    await _ensure_project_access(project_id, user)
    pid = _new_id()
    doc = {
        "id": pid,
        "project_id": project_id,
        "model_id": payload.model_id,
        "position": payload.position.model_dump(),
        "element_id": payload.element_id,
        "title": payload.title.strip(),
        "description": (payload.description or "").strip(),
        "priority": payload.priority,
        "category": payload.category,
        "status": "open",
        "author_id": user["id"],
        "author_name": user.get("name") or user.get("email"),
        "author_role": user.get("role"),
        "comment_count": 0,
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
    }
    await db.digital_twin_pins.insert_one(doc)
    await db.digital_twin_projects.update_one(
        {"id": project_id},
        {"$set": {"updated_at": _now_iso()}, "$inc": {"pin_count": 1}},
    )
    return _clean(doc)


@router.get("/projects/{project_id}/pins")
async def list_pins(
    project_id: str,
    status: Optional[str] = Query(None, pattern="^(open|in_review|resolved|rejected)$"),
    category: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    await _ensure_dt_access(user)
    await _ensure_project_access(project_id, user)
    q = {"project_id": project_id}
    if status:
        q["status"] = status
    if category:
        q["category"] = category
    items = []
    async for p in db.digital_twin_pins.find(q).sort("created_at", -1).limit(500):
        items.append(_clean(p))
    return {"items": items, "count": len(items)}


class PinUpdate(BaseModel):
    status: Optional[str] = Field(None, pattern="^(open|in_review|resolved|rejected)$")
    priority: Optional[str] = Field(None, pattern="^(low|normal|high|urgent)$")
    title: Optional[str] = Field(None, min_length=2, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)


@router.patch("/pins/{pin_id}")
async def update_pin(pin_id: str, payload: PinUpdate, user: dict = Depends(get_current_user)):
    await _ensure_dt_access(user)
    pin = await db.digital_twin_pins.find_one({"id": pin_id})
    if not pin:
        raise HTTPException(404, "Pin not found.")
    await _ensure_project_access(pin["project_id"], user)
    updates = {k: v for k, v in payload.model_dump(exclude_none=True).items()}
    if not updates:
        return _clean(pin)
    updates["updated_at"] = _now_iso()
    await db.digital_twin_pins.update_one({"id": pin_id}, {"$set": updates})
    pin = await db.digital_twin_pins.find_one({"id": pin_id})
    return _clean(pin)


@router.delete("/pins/{pin_id}")
async def delete_pin(pin_id: str, user: dict = Depends(get_current_user)):
    await _ensure_dt_access(user)
    pin = await db.digital_twin_pins.find_one({"id": pin_id})
    if not pin:
        raise HTTPException(404, "Pin not found.")
    proj = await _ensure_project_access(pin["project_id"], user)
    # Only author / project owner / admin / operator can delete.
    if (
        user.get("role") not in ("admin", "operator")
        and pin.get("author_id") != user["id"]
        and proj.get("owner_id") != user["id"]
    ):
        raise HTTPException(403, "Cannot delete this pin.")
    await db.digital_twin_pins.delete_one({"id": pin_id})
    await db.digital_twin_comments.delete_many({"pin_id": pin_id})
    await db.digital_twin_projects.update_one(
        {"id": pin["project_id"]},
        {"$inc": {"pin_count": -1}, "$set": {"updated_at": _now_iso()}},
    )
    return {"ok": True}


# ----------------- comments (per pin thread) -----------------

class CommentCreate(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    attachments: Optional[list] = None  # storage URLs added in Phase B


@router.post("/pins/{pin_id}/comments")
async def add_comment(pin_id: str, payload: CommentCreate, user: dict = Depends(get_current_user)):
    await _ensure_dt_access(user)
    pin = await db.digital_twin_pins.find_one({"id": pin_id})
    if not pin:
        raise HTTPException(404, "Pin not found.")
    await _ensure_project_access(pin["project_id"], user)
    doc = {
        "id": _new_id(),
        "pin_id": pin_id,
        "project_id": pin["project_id"],
        "author_id": user["id"],
        "author_name": user.get("name") or user.get("email"),
        "author_role": user.get("role"),
        "message": payload.message.strip(),
        "attachments": payload.attachments or [],
        "created_at": _now_iso(),
    }
    await db.digital_twin_comments.insert_one(doc)
    await db.digital_twin_pins.update_one(
        {"id": pin_id},
        {"$inc": {"comment_count": 1}, "$set": {"updated_at": _now_iso()}},
    )
    return _clean(doc)


@router.get("/pins/{pin_id}/comments")
async def list_comments(pin_id: str, user: dict = Depends(get_current_user)):
    await _ensure_dt_access(user)
    pin = await db.digital_twin_pins.find_one({"id": pin_id})
    if not pin:
        raise HTTPException(404, "Pin not found.")
    await _ensure_project_access(pin["project_id"], user)
    items = []
    async for c in db.digital_twin_comments.find({"pin_id": pin_id}).sort("created_at", 1):
        items.append(_clean(c))
    return {"items": items, "count": len(items)}


# ----------------- admin: subscription grant -----------------

admin_router = APIRouter(prefix="/api/admin/digital-twin", tags=["digital-twin-admin"])


class SubGrant(BaseModel):
    user_id: str
    active: bool = True


@admin_router.post("/subscription/grant")
async def grant_subscription(payload: SubGrant, user: dict = Depends(require_role("admin"))):
    """Admin can manually grant/revoke Digital Twin Pro access until Stripe wiring."""
    r = await db.users.update_one(
        _user_filter(payload.user_id),
        {"$set": {"digital_twin_pro": payload.active, "digital_twin_pro_updated_at": _now_iso()}},
    )
    if not r.matched_count:
        raise HTTPException(404, "User not found.")
    await db.audit_log.insert_one({
        "actor": user["id"],
        "action": "digital_twin.subscription." + ("grant" if payload.active else "revoke"),
        "target_user": payload.user_id,
        "created_at": _now_iso(),
    })
    return {"ok": True, "user_id": payload.user_id, "active": payload.active}


@admin_router.get("/stats")
async def admin_stats(user: dict = Depends(require_role("admin"))):  # noqa: ARG001
    return {
        "projects": await db.digital_twin_projects.count_documents({}),
        "models": await db.digital_twin_models.count_documents({}),
        "pins": await db.digital_twin_pins.count_documents({}),
        "comments": await db.digital_twin_comments.count_documents({}),
        "pro_users": await db.users.count_documents({"digital_twin_pro": True}),
    }
