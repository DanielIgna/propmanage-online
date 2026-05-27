"""PropManage — Digital Twin module (Phase A: infrastructure).

Isolated module. Touches only its own collections:
  - digital_twin_projects
  - digital_twin_models  (placeholder, real upload comes in Phase B)
  - digital_twin_pins
  - digital_twin_comments

Subscription gate: user.digital_twin_pro == True (admin grants for now;
Stripe wiring is Phase E). Admin and operator can bypass.
"""
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional, List
import base64
import io
import os
import shutil
import uuid

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, Body, Query, UploadFile, File
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, Field

from db import db
from deps import get_current_user, require_role
from core_utils import JWT_SECRET, JWT_ALGORITHM
import jwt as _jwt
from email_service import (
    send_template,
    tpl_dt_pin_created,
    tpl_dt_comment_added,
    tpl_dt_pin_status_changed,
    tpl_dt_model_uploaded,
    tpl_dt_plan_uploaded,
    tpl_dt_issue_report,
    send_email_with_attachments,
)
from services import notify

router = APIRouter(prefix="/api/digital-twin", tags=["digital-twin"])


# ----------------- storage config -----------------

UPLOAD_ROOT = Path(os.environ.get("DT_UPLOAD_DIR") or "/app/backend/uploads/digital_twin")
UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)

ALLOWED_EXTS = {".glb", ".gltf", ".skp"}
ALLOWED_PLAN_EXTS = {".pdf"}
# Extensions that can't be rendered in-browser; we store them as downloadable archives only.
DOWNLOAD_ONLY_EXTS = {".skp"}
MAX_UPLOAD_BYTES = 200 * 1024 * 1024  # 200 MB hard cap
MAX_PLAN_BYTES = 50 * 1024 * 1024  # 50 MB cap for PDFs

PLAN_TYPES = {"floorplan", "section", "elevation", "detail", "site", "other"}


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


async def _project_stakeholders(project: dict, exclude_user_id: str | None = None) -> list:
    """All people who should be notified about a project event: owner + members.
    Excludes the actor and any without email. Returns list of {id, name, email}."""
    ids = [project.get("owner_id")]
    for m in (project.get("members") or []):
        if m.get("user_id"):
            ids.append(m["user_id"])
    ids = [i for i in ids if i and i != exclude_user_id]
    if not ids:
        return []
    out = []
    seen = set()
    for uid in ids:
        if uid in seen:
            continue
        seen.add(uid)
        u = await db.users.find_one(_user_filter(uid), {"_id": 1, "email": 1, "name": 1})
        if u and u.get("email"):
            out.append({"id": str(u["_id"]), "name": u.get("name") or u["email"], "email": u["email"]})
    return out


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
        "plan_count": 0,
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
    p["plan_count"] = await db.digital_twin_plans.count_documents({"project_id": project_id})
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
    await db.digital_twin_plans.delete_many({"project_id": project_id})
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
        raise HTTPException(400, "Format permis: .glb, .gltf sau .skp (SketchUp, descărcabil — pentru randare în browser folosește .glb/.gltf).")

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
    is_archive = ext in DOWNLOAD_ONLY_EXTS
    model_doc = {
        "id": _new_id(),
        "project_id": project_id,
        "filename": raw_name,
        "stored_as": safe_name,
        "size_bytes": total,
        "url": public_path,
        "kind": "archive" if is_archive else "model",  # "archive" = .skp (download only), "model" = .glb/.gltf
        "ext": ext,
        "uploaded_by": user["id"],
        "uploaded_by_name": user.get("name") or user.get("email"),
        "uploaded_by_role": user.get("role"),
        "uploaded_at": _now_iso(),
    }
    await db.digital_twin_models.insert_one(model_doc)
    # Only set as the active model_url if it's actually viewable (.glb/.gltf)
    update_set = {"updated_at": _now_iso()}
    if not is_archive:
        update_set["model_url"] = public_path
    await db.digital_twin_projects.update_one(
        {"id": project_id},
        {"$set": update_set, "$inc": {"model_count": 1}},
    )
    # Phase G: notify stakeholders the architect updated the model
    actor_name = user.get("name") or user.get("email") or "Utilizator"
    project_name = p.get("name", "Proiect")
    size_mb = total / (1024 * 1024)
    stakeholders = await _project_stakeholders(p, exclude_user_id=user["id"])
    for s in stakeholders:
        await notify(
            s["id"],
            "🏗️ Model 3D actualizat",
            f"{actor_name} a încărcat {raw_name} pe {project_name}",
            type_="dt_model",
            link="/digital-twin",
        )
        await send_template(
            tpl_dt_model_uploaded,
            s["name"], project_name, raw_name, size_mb, actor_name,
            to=s["email"],
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
    fn_lower = filename.lower()
    if fn_lower.endswith(".glb"):
        media = "model/gltf-binary"
    elif fn_lower.endswith(".gltf"):
        media = "model/gltf+json"
    elif fn_lower.endswith(".skp"):
        media = "application/octet-stream"
    else:
        media = "application/octet-stream"
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
    project = await _ensure_project_access(project_id, user)
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
        "plan_anchors": [],
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
    }
    await db.digital_twin_pins.insert_one(doc)
    await db.digital_twin_projects.update_one(
        {"id": project_id},
        {"$set": {"updated_at": _now_iso()}, "$inc": {"pin_count": 1}},
    )
    # Notify stakeholders (fire-and-forget): in-app + email + push
    stakeholders = await _project_stakeholders(project, exclude_user_id=user["id"])
    actor_name = user.get("name") or user.get("email") or "Utilizator"
    project_name = project.get("name", "Proiect")
    for s in stakeholders:
        await notify(
            s["id"],
            f"📌 Pin nou pe {project_name}",
            f"{actor_name}: {doc['title']}",
            type_="dt_pin",
            link="/digital-twin",
        )
        await send_template(
            tpl_dt_pin_created,
            s["name"], project_name, doc["title"], doc["category"], doc["priority"], actor_name,
            to=s["email"],
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
    project = await _ensure_project_access(pin["project_id"], user)
    updates = {k: v for k, v in payload.model_dump(exclude_none=True).items()}
    if not updates:
        return _clean(pin)
    old_status = pin.get("status")
    updates["updated_at"] = _now_iso()
    await db.digital_twin_pins.update_one({"id": pin_id}, {"$set": updates})
    pin_after = await db.digital_twin_pins.find_one({"id": pin_id})

    # Phase G: workflow notification on status change
    new_status = updates.get("status")
    if new_status and new_status != old_status:
        actor_name = user.get("name") or user.get("email") or "Utilizator"
        project_name = project.get("name", "Proiect")
        # Notify pin author (if not the actor) + all stakeholders
        recipients_ids = set()
        if pin.get("author_id") and pin["author_id"] != user["id"]:
            recipients_ids.add(pin["author_id"])
        stakeholders = await _project_stakeholders(project, exclude_user_id=user["id"])
        status_label = {"open": "Deschis", "in_review": "În analiză", "resolved": "Rezolvat", "rejected": "Respins"}.get(new_status, new_status)
        for s in stakeholders:
            recipients_ids.add(s["id"])
            await send_template(
                tpl_dt_pin_status_changed,
                s["name"], project_name, pin_after["title"], old_status, new_status, actor_name,
                to=s["email"],
            )
        # Always also email the original author if not the actor
        if pin.get("author_id") and pin["author_id"] != user["id"]:
            author = await db.users.find_one(_user_filter(pin["author_id"]), {"_id": 1, "email": 1, "name": 1})
            if author and author.get("email") and not any(s["id"] == pin["author_id"] for s in stakeholders):
                await send_template(
                    tpl_dt_pin_status_changed,
                    author.get("name") or author["email"], project_name, pin_after["title"], old_status, new_status, actor_name,
                    to=author["email"],
                )
        # In-app notification for everyone touched
        for uid in recipients_ids:
            await notify(
                uid,
                f"🔄 Pin {status_label.lower()}",
                f"{pin_after['title']} pe {project_name}",
                type_="dt_pin_status",
                link="/digital-twin",
            )
    return _clean(pin_after)


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


# ----------------- pin → plan anchors (Phase H: 3D ↔ 2D sync) -----------------

class PlanAnchorIn(BaseModel):
    plan_id: str
    page: int = Field(1, ge=1, le=200)
    x_pct: float = Field(..., ge=0.0, le=1.0)
    y_pct: float = Field(..., ge=0.0, le=1.0)


@router.post("/pins/{pin_id}/anchors")
async def add_pin_anchor(pin_id: str, payload: PlanAnchorIn, user: dict = Depends(get_current_user)):
    """Anchor a 3D pin to a (x_pct, y_pct) on a 2D plan PDF page."""
    await _ensure_dt_access(user)
    pin = await db.digital_twin_pins.find_one({"id": pin_id})
    if not pin:
        raise HTTPException(404, "Pin not found.")
    await _ensure_project_access(pin["project_id"], user)
    # Verify the plan belongs to the same project
    plan = await db.digital_twin_plans.find_one({"id": payload.plan_id, "project_id": pin["project_id"]})
    if not plan:
        raise HTTPException(404, "Plan not found in this project.")
    # Bug fix: validate against the actual PDF page count if known
    plan_pages = int(plan.get("page_count") or 0)
    if plan_pages and payload.page > plan_pages:
        raise HTTPException(400, f"Pagina {payload.page} nu există. Planul are doar {plan_pages} pagini.")
    anchor = {
        "id": _new_id(),
        "plan_id": payload.plan_id,
        "plan_title": plan.get("title"),
        "page": payload.page,
        "x_pct": payload.x_pct,
        "y_pct": payload.y_pct,
        "created_at": _now_iso(),
        "created_by": user["id"],
        "created_by_name": user.get("name") or user.get("email"),
    }
    # Replace any existing anchor on the same (plan_id, page) to keep one marker per page per pin
    existing = [a for a in (pin.get("plan_anchors") or []) if not (a.get("plan_id") == payload.plan_id and int(a.get("page", 1)) == payload.page)]
    existing.append(anchor)
    await db.digital_twin_pins.update_one(
        {"id": pin_id},
        {"$set": {"plan_anchors": existing, "updated_at": _now_iso()}},
    )
    return {"ok": True, "anchor": anchor, "plan_anchors": existing}


@router.delete("/pins/{pin_id}/anchors/{anchor_id}")
async def remove_pin_anchor(pin_id: str, anchor_id: str, user: dict = Depends(get_current_user)):
    await _ensure_dt_access(user)
    pin = await db.digital_twin_pins.find_one({"id": pin_id})
    if not pin:
        raise HTTPException(404, "Pin not found.")
    await _ensure_project_access(pin["project_id"], user)
    anchors = pin.get("plan_anchors") or []
    target = next((a for a in anchors if a.get("id") == anchor_id), None)
    if not target:
        raise HTTPException(404, "Anchor not found.")
    # Bug fix: any project member (verified via _ensure_project_access) can cleanup anchors.
    # _ensure_project_access already raised 403 for non-members. No extra owner-only gate.
    new_anchors = [a for a in anchors if a.get("id") != anchor_id]
    await db.digital_twin_pins.update_one(
        {"id": pin_id},
        {"$set": {"plan_anchors": new_anchors, "updated_at": _now_iso()}},
    )
    return {"ok": True, "plan_anchors": new_anchors}


# ----------------- Phase I: Issue Report PDF + Email -----------------

APP_URL = os.environ.get("APP_URL", "https://propmanage.io").rstrip("/")
REPORT_APPROVAL_TTL_DAYS = 30


def _make_report_approval_token(pin_id: str, report_id: str, recipient_email: str) -> str:
    payload = {
        "type": "dt_report_approval",
        "pin_id": pin_id,
        "report_id": report_id,
        "recipient": recipient_email.lower().strip(),
        "exp": datetime.now(timezone.utc) + timedelta(days=REPORT_APPROVAL_TTL_DAYS),
    }
    return _jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def _decode_report_approval_token(token: str) -> dict:
    try:
        data = _jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except _jwt.ExpiredSignatureError:
        raise HTTPException(410, "Linkul a expirat (valid 30 zile de la trimitere).")
    except Exception:
        raise HTTPException(400, "Token invalid.")
    if data.get("type") != "dt_report_approval":
        raise HTTPException(400, "Token de tip greșit.")
    return data


class IssueReportIn(BaseModel):
    recipient_email: Optional[str] = Field(None, description="Override recipient; if absent, use project owner email.")
    custom_message: Optional[str] = Field(None, max_length=4000)
    screenshot_3d: Optional[str] = Field(None, description="Base64 PNG capture of the viewer canvas.")
    include_thread: bool = True


@router.post("/pins/{pin_id}/issue-report")
async def send_issue_report(pin_id: str, payload: IssueReportIn, user: dict = Depends(get_current_user)):
    """Generate a PDF report for a pin and email it to the architect/owner.

    Includes: pin meta, description, optional custom message, 3D screenshot,
    2D plan extract from first anchor, comments thread.
    """
    from dt_issue_report import build_issue_report_pdf

    await _ensure_dt_access(user)
    pin = await db.digital_twin_pins.find_one({"id": pin_id})
    if not pin:
        raise HTTPException(404, "Pin not found.")
    project = await _ensure_project_access(pin["project_id"], user)

    # Resolve recipient email
    recipient_email = (payload.recipient_email or "").strip().lower()
    recipient_name = None
    if not recipient_email:
        # Default: project owner
        owner_id = project.get("owner_id")
        if owner_id:
            owner = await db.users.find_one(_user_filter(owner_id), {"_id": 1, "email": 1, "name": 1})
            if owner and owner.get("email"):
                recipient_email = owner["email"]
                recipient_name = owner.get("name")
    if not recipient_email:
        raise HTTPException(400, "Nu există email destinatar (nu există owner sau email explicit).")
    if not recipient_name:
        # Try to resolve a friendly name for the override email
        u = await db.users.find_one({"email": recipient_email}, {"_id": 1, "email": 1, "name": 1})
        recipient_name = (u.get("name") if u else None) or recipient_email.split("@")[0]

    # Collect comments
    comments = []
    if payload.include_thread:
        async for c in db.digital_twin_comments.find({"pin_id": pin_id}).sort("created_at", 1):
            comments.append(_clean(c))

    # Plan extract from first anchor (if any)
    plan_file_path = None
    plan_page = 1
    plan_title = None
    anchors = pin.get("plan_anchors") or []
    if anchors:
        first = anchors[0]
        plan = await db.digital_twin_plans.find_one({"id": first.get("plan_id")})
        if plan:
            plan_title = plan.get("title")
            plan_page = int(first.get("page", 1))
            candidate = UPLOAD_ROOT / pin["project_id"] / "plans" / plan.get("stored_as", "")
            if candidate.exists() and candidate.is_file():
                plan_file_path = str(candidate)

    # Build PDF
    pdf_buf = build_issue_report_pdf(
        project=project,
        pin=pin,
        comments=comments,
        sender={"name": user.get("name") or user.get("email"), "email": user.get("email"), "role": user.get("role")},
        custom_message=payload.custom_message,
        screenshot_3d_b64=payload.screenshot_3d,
        plan_file_path=plan_file_path,
        plan_page=plan_page,
        plan_title=plan_title,
    )
    pdf_bytes = pdf_buf.getvalue()
    pdf_b64 = base64.b64encode(pdf_bytes).decode("ascii")
    pdf_filename = f"raport_{pin.get('title', 'pin')[:40].replace(' ', '_')}.pdf"

    # Generate signed approval token (30-day TTL)
    report_id = _new_id()
    approval_token = _make_report_approval_token(pin_id, report_id, recipient_email)
    approval_url = f"{APP_URL}/report-respond/{approval_token}"

    # Send the email with attachment + approval CTAs
    tpl = tpl_dt_issue_report(
        recipient_name=recipient_name,
        project_name=project.get("name", "Proiect"),
        pin_title=pin.get("title", "—"),
        pin_category=pin.get("category", "general"),
        pin_priority=pin.get("priority", "normal"),
        pin_status=pin.get("status", "open"),
        sender_name=user.get("name") or user.get("email") or "Utilizator",
        sender_role=user.get("role") or "—",
        custom_message=payload.custom_message,
        approval_url=approval_url,
    )
    await send_email_with_attachments(
        to=recipient_email,
        subject=tpl["subject"],
        html=tpl["html"],
        attachments=[{"filename": pdf_filename, "content": pdf_b64, "type": "application/pdf"}],
    )

    # Log to pin history
    history_entry = {
        "id": report_id,
        "type": "issue_report_sent",
        "recipient_email": recipient_email,
        "recipient_name": recipient_name,
        "sender_id": user["id"],
        "sender_name": user.get("name") or user.get("email"),
        "sender_role": user.get("role"),
        "custom_message_preview": (payload.custom_message or "")[:120],
        "comment_count": len(comments),
        "has_screenshot": bool(payload.screenshot_3d),
        "has_plan_extract": bool(plan_file_path),
        "pdf_size_bytes": len(pdf_bytes),
        "approval_url": approval_url,
        "approval_status": "pending",
        "created_at": _now_iso(),
    }
    await db.digital_twin_pins.update_one(
        {"id": pin_id},
        {"$push": {"report_history": history_entry}, "$set": {"updated_at": _now_iso()}},
    )

    # In-app notification to recipient (if known user)
    recipient_user = await db.users.find_one({"email": recipient_email}, {"_id": 1})
    if recipient_user:
        rid = str(recipient_user["_id"])
        await notify(
            rid,
            f"🚨 Raport problemă: {pin.get('title', 'Pin')}",
            f"{history_entry['sender_name']} a trimis raport PDF pe {project.get('name', 'proiect')}",
            type_="dt_issue_report",
            link="/digital-twin",
        )

    return {
        "ok": True,
        "report": history_entry,
        "pdf_size_bytes": len(pdf_bytes),
        "recipient_email": recipient_email,
    }


# ----------------- Public approval endpoints (no auth — token-validated) -----------------

@router.get("/reports/approve/info", tags=["digital-twin-public"])
async def report_approval_info(token: str = Query(...)):
    """Resolve a signed approval token and return the linked report context (public, no auth)."""
    data = _decode_report_approval_token(token)
    pin = await db.digital_twin_pins.find_one({"id": data["pin_id"]})
    if not pin:
        raise HTTPException(404, "Pin-ul nu mai există.")
    report = next(
        (h for h in (pin.get("report_history") or []) if h.get("id") == data["report_id"]),
        None,
    )
    if not report:
        raise HTTPException(404, "Raportul nu a fost găsit.")
    project = await db.digital_twin_projects.find_one({"id": pin["project_id"]})
    return {
        "ok": True,
        "pin_title": pin.get("title"),
        "pin_category": pin.get("category"),
        "pin_priority": pin.get("priority"),
        "pin_status": pin.get("status"),
        "project_name": project.get("name") if project else "—",
        "sender_name": report.get("sender_name"),
        "recipient_name": report.get("recipient_name"),
        "recipient_email": report.get("recipient_email"),
        "custom_message_preview": report.get("custom_message_preview"),
        "comment_count": report.get("comment_count"),
        "has_screenshot": report.get("has_screenshot"),
        "has_plan_extract": report.get("has_plan_extract"),
        "created_at": report.get("created_at"),
        "approval_status": report.get("approval_status", "pending"),
        "decision": report.get("decision"),
        "decision_comment": report.get("decision_comment"),
        "decided_at": report.get("decided_at"),
    }


class ReportDecisionIn(BaseModel):
    token: str
    decision: str = Field(..., pattern="^(confirmed|needs_changes)$")
    comment: Optional[str] = Field(None, max_length=2000)


@router.post("/reports/approve/decide", tags=["digital-twin-public"])
async def report_approval_decide(payload: ReportDecisionIn):
    """Record the recipient's decision on a report (public, token-validated, single-use semantics)."""
    data = _decode_report_approval_token(payload.token)
    pin = await db.digital_twin_pins.find_one({"id": data["pin_id"]})
    if not pin:
        raise HTTPException(404, "Pin-ul nu mai există.")
    report = next(
        (h for h in (pin.get("report_history") or []) if h.get("id") == data["report_id"]),
        None,
    )
    if not report:
        raise HTTPException(404, "Raportul nu a fost găsit.")
    if report.get("approval_status") and report["approval_status"] != "pending":
        raise HTTPException(409, "Ai răspuns deja la acest raport. Nu poți schimba decizia ulterior.")

    now_iso = _now_iso()
    update = {
        "report_history.$[r].approval_status": payload.decision,
        "report_history.$[r].decision": payload.decision,
        "report_history.$[r].decision_comment": (payload.comment or "").strip(),
        "report_history.$[r].decided_at": now_iso,
        "report_history.$[r].decided_by_email": data["recipient"],
        "updated_at": now_iso,
    }
    await db.digital_twin_pins.update_one(
        {"id": data["pin_id"]},
        {"$set": update},
        array_filters=[{"r.id": data["report_id"]}],
    )

    # Notify the original sender (in-app + email if available)
    sender_id = report.get("sender_id")
    if sender_id:
        sender = await db.users.find_one(_user_filter(sender_id), {"_id": 1, "email": 1, "name": 1})
        decision_label = "Confirmat" if payload.decision == "confirmed" else "Necesită modificări"
        emoji = "✅" if payload.decision == "confirmed" else "📝"
        await notify(
            sender_id,
            f"{emoji} Raport {decision_label.lower()}: {pin.get('title', 'Pin')}",
            f"{report.get('recipient_name') or data['recipient']} a răspuns la raportul tău.",
            type_="dt_report_decision",
            link="/digital-twin",
        )
        if sender and sender.get("email"):
            from email_service import _layout, send_email  # noqa: PLC0415
            project = await db.digital_twin_projects.find_one({"id": pin["project_id"]})
            project_name = project.get("name", "Proiect") if project else "—"
            color = "#10b981" if payload.decision == "confirmed" else "#f59e0b"
            comment_block = ""
            if payload.comment and payload.comment.strip():
                comment_block = f"""
                  <div style="background:#0f172a; border-left:3px solid {color}; padding:14px 18px; border-radius:12px; margin:18px 0;">
                    <div style="font-size:11px; text-transform:uppercase; letter-spacing:0.5px; color:{color}; margin-bottom:6px;">Răspuns destinatar</div>
                    <div style="color:#e5e5e5; line-height:1.6; white-space:pre-wrap;">{payload.comment.strip()}</div>
                  </div>
                """
            html_body = f"""
              <p>Bună {sender.get('name') or sender['email']},</p>
              <p><strong style="color:{color};">{report.get('recipient_name') or data['recipient']}</strong> a răspuns la raportul tău pentru <em>"{pin.get('title')}"</em> din proiectul <strong>{project_name}</strong>.</p>
              <div style="background:{color}15; border:1px solid {color}40; border-radius:14px; padding:18px; margin:18px 0; text-align:center;">
                <div style="font-size:11px; text-transform:uppercase; letter-spacing:1px; color:{color}; margin-bottom:6px; font-weight:700;">Decizie</div>
                <div style="color:{color}; font-size:24px; font-weight:700;">{emoji} {decision_label}</div>
              </div>
              {comment_block}
            """
            tpl_html = _layout(
                "Răspuns la raport",
                f"{pin.get('title')} → {decision_label}",
                html_body,
                f"{APP_URL}/digital-twin",
                "Vezi pin-ul în viewer",
            )
            await send_email(sender["email"], f"{emoji} Răspuns raport: {pin.get('title')}", tpl_html)

    return {
        "ok": True,
        "decision": payload.decision,
        "decided_at": now_iso,
    }




# ----------------- Sent reports dashboard + reminder (Phase I+) -----------------

@router.get("/reports/sent")
async def list_sent_reports(
    status: Optional[str] = Query(None, pattern="^(pending|confirmed|needs_changes|all)?$"),
    overdue_only: bool = Query(False),
    limit: int = Query(200, ge=1, le=500),
    user: dict = Depends(get_current_user),
):
    """List all issue reports the current user has sent (across all their pins)."""
    pipeline = [
        {"$match": {"report_history.sender_id": user["id"]}},
        {"$project": {
            "_id": 0,
            "pin_id": "$id",
            "pin_title": "$title",
            "pin_category": "$category",
            "pin_priority": "$priority",
            "pin_status": "$status",
            "project_id": "$project_id",
            "report_history": "$report_history",
        }},
        {"$unwind": "$report_history"},
        {"$match": {"report_history.sender_id": user["id"]}},
        {"$sort": {"report_history.created_at": -1}},
        {"$limit": limit},
    ]
    raw = await db.digital_twin_pins.aggregate(pipeline).to_list(length=limit)
    # Resolve project names in bulk
    project_ids = list({r["project_id"] for r in raw})
    projects = {}
    if project_ids:
        async for p in db.digital_twin_projects.find({"id": {"$in": project_ids}}, {"_id": 0, "id": 1, "name": 1}):
            projects[p["id"]] = p.get("name")

    now = datetime.now(timezone.utc)
    items = []
    for r in raw:
        h = r["report_history"]
        h_status = h.get("approval_status", "pending")
        if status and status != "all" and h_status != status:
            continue
        # Compute age in days
        created_at = h.get("created_at")
        age_days = 0
        try:
            if created_at:
                dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
                age_days = max(0, (now - dt).days)
        except Exception:  # noqa: BLE001
            age_days = 0
        is_overdue = h_status == "pending" and age_days >= 7
        if overdue_only and not is_overdue:
            continue
        items.append({
            "report_id": h.get("id"),
            "pin_id": r["pin_id"],
            "pin_title": r["pin_title"],
            "pin_category": r["pin_category"],
            "pin_priority": r["pin_priority"],
            "pin_status": r["pin_status"],
            "project_id": r["project_id"],
            "project_name": projects.get(r["project_id"], "—"),
            "recipient_email": h.get("recipient_email"),
            "recipient_name": h.get("recipient_name"),
            "approval_status": h_status,
            "decision_comment": h.get("decision_comment"),
            "decided_at": h.get("decided_at"),
            "created_at": created_at,
            "age_days": age_days,
            "is_overdue": is_overdue,
            "has_screenshot": h.get("has_screenshot"),
            "has_plan_extract": h.get("has_plan_extract"),
            "pdf_size_bytes": h.get("pdf_size_bytes"),
            "approval_url": h.get("approval_url"),
            "reminders_sent": h.get("reminders_sent", []),
            "reminder_count": len(h.get("reminders_sent", []) or []),
            "auto_reminders_enabled": h.get("auto_reminders_enabled", True),
            "reminder_thresholds_days": h.get("reminder_thresholds_days") or [7, 14, 21],
            "paused_until": h.get("paused_until"),
            "auto_reminders_stopped": h.get("auto_reminders_stopped", False),
            "auto_reminders_fired_thresholds": h.get("auto_reminders_fired_thresholds") or [],
            "last_auto_reminder_at": h.get("last_auto_reminder_at"),
        })

    # Counters for UI badges
    counters = {
        "total": 0,
        "pending": 0,
        "confirmed": 0,
        "needs_changes": 0,
        "overdue": 0,
    }
    # Recount (without filter) for accurate badges
    all_pipeline = [
        {"$match": {"report_history.sender_id": user["id"]}},
        {"$unwind": "$report_history"},
        {"$match": {"report_history.sender_id": user["id"]}},
        {"$project": {"_id": 0, "approval_status": "$report_history.approval_status", "created_at": "$report_history.created_at"}},
    ]
    async for r in db.digital_twin_pins.aggregate(all_pipeline):
        counters["total"] += 1
        st = r.get("approval_status", "pending")
        if st in counters:
            counters[st] += 1
        if st == "pending":
            try:
                dt = datetime.fromisoformat(r["created_at"].replace("Z", "+00:00"))
                if (now - dt).days >= 7:
                    counters["overdue"] += 1
            except Exception:  # noqa: BLE001
                pass

    return {"items": items, "count": len(items), "counters": counters}


@router.post("/reports/{report_id}/remind")
async def send_report_reminder(
    report_id: str,
    payload: dict = Body(default_factory=dict),
    user: dict = Depends(get_current_user),
):
    """Re-send the approval email for a still-pending report (same token, no PDF regen)."""
    # Find the pin owning this report by sender_id + report_id (security)
    pin = await db.digital_twin_pins.find_one({
        "report_history.id": report_id,
        "report_history.sender_id": user["id"],
    })
    if not pin:
        raise HTTPException(404, "Raport inexistent sau nu ești expeditorul.")
    custom_note = (payload.get("note") or "").strip() if isinstance(payload, dict) else ""
    if len(custom_note) > 1000:
        raise HTTPException(400, "Notă prea lungă (max 1000 caractere).")
    try:
        result = await _dispatch_reminder(pin, report_id, custom_note=custom_note, actor=user, auto=False)
    except ValueError as e:
        raise HTTPException(409, str(e)) from e
    return {"ok": True, **result}


class ReminderSettings(BaseModel):
    auto_reminders_enabled: Optional[bool] = None
    thresholds_days: Optional[List[int]] = None
    paused_until: Optional[str] = None  # ISO date, e.g. "2026-03-01"
    stopped: Optional[bool] = None


@router.patch("/reports/{report_id}/reminder-settings")
async def update_reminder_settings(
    report_id: str,
    payload: ReminderSettings,
    user: dict = Depends(get_current_user),
):
    """Configure auto-reminder behavior for a specific report (per-report opt-out/snooze/stop)."""
    pin = await db.digital_twin_pins.find_one({
        "report_history.id": report_id,
        "report_history.sender_id": user["id"],
    })
    if not pin:
        raise HTTPException(404, "Raport inexistent sau nu ești expeditorul.")
    updates = {}
    if payload.auto_reminders_enabled is not None:
        updates["report_history.$.auto_reminders_enabled"] = payload.auto_reminders_enabled
    if payload.thresholds_days is not None:
        clean = sorted({int(d) for d in payload.thresholds_days if 1 <= int(d) <= 365})
        if not clean:
            raise HTTPException(400, "Trebuie cel puțin un prag de reminder (între 1-365 zile).")
        updates["report_history.$.reminder_thresholds_days"] = clean
    if payload.paused_until is not None:
        if payload.paused_until == "":
            updates["report_history.$.paused_until"] = None
        else:
            try:
                _ = datetime.fromisoformat(payload.paused_until)
            except Exception:
                raise HTTPException(400, "Format dată invalid (folosește YYYY-MM-DD).")
            updates["report_history.$.paused_until"] = payload.paused_until
    if payload.stopped is not None:
        updates["report_history.$.auto_reminders_stopped"] = payload.stopped
    if not updates:
        raise HTTPException(400, "Nimic de actualizat.")
    updates["updated_at"] = _now_iso()
    await db.digital_twin_pins.update_one(
        {"id": pin["id"], "report_history.id": report_id},
        {"$set": updates},
    )
    pin2 = await db.digital_twin_pins.find_one({"id": pin["id"]})
    report = next((h for h in pin2.get("report_history") or [] if h.get("id") == report_id), None)
    return {
        "ok": True,
        "report_id": report_id,
        "auto_reminders_enabled": report.get("auto_reminders_enabled", True),
        "reminder_thresholds_days": report.get("reminder_thresholds_days") or [7, 14, 21],
        "paused_until": report.get("paused_until"),
        "auto_reminders_stopped": report.get("auto_reminders_stopped", False),
        "auto_reminders_fired_thresholds": report.get("auto_reminders_fired_thresholds") or [],
    }


async def _dispatch_reminder(
    pin: dict,
    report_id: str,
    custom_note: str,
    actor: Optional[dict],
    auto: bool = False,
) -> dict:
    """Internal helper: send reminder email + log entry. Raises ValueError if not pending."""
    report = next((h for h in pin.get("report_history") or [] if h.get("id") == report_id), None)
    if not report:
        raise ValueError("Raport inexistent.")
    if report.get("approval_status", "pending") != "pending":
        raise ValueError("Raportul a primit deja un răspuns — reminder nu mai e necesar.")
    approval_url = report.get("approval_url")
    if not approval_url:
        raise ValueError("Raport vechi fără approval_url.")

    project = await db.digital_twin_projects.find_one({"id": pin["project_id"]})
    project_name = project.get("name", "Proiect") if project else "—"

    from email_service import _layout, send_email  # noqa: PLC0415
    days_pending = 0
    try:
        if report.get("created_at"):
            dt = datetime.fromisoformat(report["created_at"].replace("Z", "+00:00"))
            days_pending = max(0, (datetime.now(timezone.utc) - dt).days)
    except Exception:  # noqa: BLE001
        days_pending = 0

    sender_name = (actor.get("name") if actor else None) or (actor.get("email") if actor else None) or report.get("sender_name") or "Sistem"

    note_block = ""
    if custom_note:
        note_block = f"""
          <div style="background:#0f172a; border-left:3px solid #d4ff3a; padding:14px 18px; border-radius:12px; margin:18px 0;">
            <div style="font-size:11px; text-transform:uppercase; letter-spacing:0.5px; color:#d4ff3a; margin-bottom:6px;">Notă suplimentară</div>
            <div style="color:#e5e5e5; line-height:1.6; white-space:pre-wrap;">{custom_note}</div>
          </div>
        """
    auto_label = "🤖 Reminder automat" if auto else "Reminder amabil"
    body = f"""
      <p>Bună {report.get('recipient_name') or report.get('recipient_email')},</p>
      <p>Acesta este un <strong style="color:#f59e0b;">{auto_label.lower()}</strong> pentru raportul trimis de <strong style="color:#10b981;">{sender_name}</strong> acum <strong>{days_pending} zile</strong> pe proiectul <em>"{project_name}"</em>.</p>
      <div style="background:#1a1a1f; border:1px solid #ffffff15; border-radius:14px; padding:18px; margin:18px 0;">
        <div style="font-size:11px; text-transform:uppercase; letter-spacing:0.5px; color:#888893; margin-bottom:6px;">Pin în așteptare</div>
        <div style="color:#ffffff; font-size:17px; font-weight:600;">{pin.get('title', '—')}</div>
      </div>
      {note_block}
      <div style="background:#1a1a1f; border:1px solid #ffffff15; border-radius:14px; padding:22px; margin:22px 0; text-align:center;">
        <div style="font-size:11px; text-transform:uppercase; letter-spacing:1px; color:#d4ff3a; margin-bottom:10px; font-weight:700;">⚡ Răspuns rapid · fără login</div>
        <table border="0" cellpadding="0" cellspacing="0" style="margin:0 auto;">
          <tr>
            <td style="padding:0 6px;">
              <a href="{approval_url}?decision=confirmed" style="display:inline-block; padding:12px 22px; border-radius:999px; background:#10b981; color:#ffffff; text-decoration:none; font-size:14px; font-weight:700;">✅ Confirmat</a>
            </td>
            <td style="padding:0 6px;">
              <a href="{approval_url}?decision=needs_changes" style="display:inline-block; padding:12px 22px; border-radius:999px; background:#f59e0b; color:#ffffff; text-decoration:none; font-size:14px; font-weight:700;">📝 Necesită modificări</a>
            </td>
          </tr>
        </table>
      </div>
    """
    subject_prefix = "🤖 Reminder automat:" if auto else "⏰ Reminder:"
    html = _layout(
        f"{auto_label} raport problemă",
        f"{pin.get('title', '—')} · pending de {days_pending} zile",
        body,
        approval_url,
        "Răspunde acum",
    )
    await send_email(report["recipient_email"], f"{subject_prefix} {pin.get('title', 'Raport')} · {project_name}", html)

    reminder_entry = {
        "id": _new_id(),
        "sent_at": _now_iso(),
        "sent_by": actor["id"] if actor else "system",
        "sent_by_name": sender_name,
        "note": custom_note,
        "days_pending_at_send": days_pending,
        "automatic": auto,
    }
    await db.digital_twin_pins.update_one(
        {"id": pin["id"], "report_history.id": report_id},
        {"$push": {"report_history.$.reminders_sent": reminder_entry},
         "$set": {"updated_at": _now_iso()}},
    )

    recipient_user = await db.users.find_one({"email": report["recipient_email"]}, {"_id": 1})
    if recipient_user:
        title_emoji = "🤖" if auto else "⏰"
        await notify(
            str(recipient_user["_id"]),
            f"{title_emoji} Reminder raport: {pin.get('title', 'Pin')}",
            f"{sender_name} așteaptă răspunsul tău de {days_pending} zile.",
            type_="dt_report_reminder",
            link="/digital-twin",
        )

    return {
        "reminder": reminder_entry,
        "recipient_email": report["recipient_email"],
        "days_pending": days_pending,
    }


async def run_dt_auto_reminders() -> dict:
    """Daily job: scan pending reports + send reminders at configured thresholds (default 7/14/21 days)."""
    now = datetime.now(timezone.utc)
    today_iso = now.date().isoformat()
    sent = 0
    skipped = 0
    failed = 0
    seen = 0
    pipeline = [
        {"$match": {"report_history": {"$elemMatch": {"approval_status": "pending"}}}},
        {"$project": {"_id": 0, "id": 1, "title": 1, "project_id": 1, "report_history": 1}},
    ]
    async for pin in db.digital_twin_pins.aggregate(pipeline):
        for h in pin.get("report_history") or []:
            seen += 1
            if h.get("approval_status", "pending") != "pending":
                continue
            if h.get("auto_reminders_stopped"):
                skipped += 1
                continue
            if h.get("auto_reminders_enabled") is False:
                skipped += 1
                continue
            paused = h.get("paused_until")
            if paused and paused >= today_iso:
                skipped += 1
                continue
            if not h.get("approval_url"):
                skipped += 1
                continue
            try:
                dt = datetime.fromisoformat(h["created_at"].replace("Z", "+00:00"))
            except Exception:
                skipped += 1
                continue
            age_days = max(0, (now - dt).days)
            thresholds = h.get("reminder_thresholds_days") or [7, 14, 21]
            fired = set(h.get("auto_reminders_fired_thresholds") or [])
            due_threshold = None
            for th in sorted(thresholds):
                if age_days >= th and th not in fired:
                    due_threshold = th
                    break
            if due_threshold is None:
                continue
            try:
                await _dispatch_reminder(pin, h["id"], custom_note="", actor=None, auto=True)
                await db.digital_twin_pins.update_one(
                    {"id": pin["id"], "report_history.id": h["id"]},
                    {"$addToSet": {"report_history.$.auto_reminders_fired_thresholds": due_threshold},
                     "$set": {"report_history.$.last_auto_reminder_at": _now_iso()}},
                )
                sent += 1
            except Exception:  # noqa: BLE001
                failed += 1
    summary = {"checked_reports": seen, "sent": sent, "skipped": skipped, "failed": failed, "at": _now_iso()}
    # Persist last run summary for admin visibility
    await db.scheduler_runs.update_one(
        {"_id": "dt_auto_reminders"},
        {"$set": {"last_run": summary, "updated_at": _now_iso()}},
        upsert=True,
    )
    return summary


@router.get("/pins/{pin_id}/issue-report/preview")
async def preview_issue_report(pin_id: str, screenshot_3d: Optional[str] = Query(None), user: dict = Depends(get_current_user)):
    """Generate the PDF in-line WITHOUT sending email (for review/download)."""
    from dt_issue_report import build_issue_report_pdf

    await _ensure_dt_access(user)
    pin = await db.digital_twin_pins.find_one({"id": pin_id})
    if not pin:
        raise HTTPException(404, "Pin not found.")
    project = await _ensure_project_access(pin["project_id"], user)

    comments = []
    async for c in db.digital_twin_comments.find({"pin_id": pin_id}).sort("created_at", 1):
        comments.append(_clean(c))

    plan_file_path = None
    plan_page = 1
    plan_title = None
    anchors = pin.get("plan_anchors") or []
    if anchors:
        first = anchors[0]
        plan = await db.digital_twin_plans.find_one({"id": first.get("plan_id")})
        if plan:
            plan_title = plan.get("title")
            plan_page = int(first.get("page", 1))
            candidate = UPLOAD_ROOT / pin["project_id"] / "plans" / plan.get("stored_as", "")
            if candidate.exists() and candidate.is_file():
                plan_file_path = str(candidate)

    pdf_buf = build_issue_report_pdf(
        project=project,
        pin=pin,
        comments=comments,
        sender={"name": user.get("name") or user.get("email"), "email": user.get("email"), "role": user.get("role")},
        screenshot_3d_b64=screenshot_3d,
        plan_file_path=plan_file_path,
        plan_page=plan_page,
        plan_title=plan_title,
    )
    return StreamingResponse(
        io.BytesIO(pdf_buf.getvalue()),
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="report_preview_{pin_id[:8]}.pdf"'},
    )


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
    project = await _ensure_project_access(pin["project_id"], user)
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

    # Phase G: workflow notification on comment added
    actor_name = doc["author_name"] or "Utilizator"
    project_name = project.get("name", "Proiect")
    # Recipients: pin author (if not actor) + all project stakeholders + all previous commenters on this pin
    recipient_ids = set()
    if pin.get("author_id") and pin["author_id"] != user["id"]:
        recipient_ids.add(pin["author_id"])
    # Previous commenters in the thread
    async for prev in db.digital_twin_comments.find({"pin_id": pin_id, "author_id": {"$ne": user["id"]}}, {"author_id": 1}):
        if prev.get("author_id"):
            recipient_ids.add(prev["author_id"])
    stakeholders = await _project_stakeholders(project, exclude_user_id=user["id"])
    for s in stakeholders:
        recipient_ids.add(s["id"])
    # Email each unique recipient (resolve email for non-stakeholder IDs too)
    emailed = set()
    for s in stakeholders:
        if s["email"] not in emailed:
            emailed.add(s["email"])
            await send_template(
                tpl_dt_comment_added,
                s["name"], project_name, pin["title"], actor_name, user.get("role"), doc["message"],
                to=s["email"],
            )
    # Email pin author + thread commenters even if not stakeholders
    extra_ids = recipient_ids - {s["id"] for s in stakeholders}
    for uid in extra_ids:
        u = await db.users.find_one(_user_filter(uid), {"_id": 1, "email": 1, "name": 1})
        if u and u.get("email") and u["email"] not in emailed:
            emailed.add(u["email"])
            await send_template(
                tpl_dt_comment_added,
                u.get("name") or u["email"], project_name, pin["title"], actor_name, user.get("role"), doc["message"],
                to=u["email"],
            )
    # In-app notification
    for uid in recipient_ids:
        await notify(
            uid,
            "💬 Răspuns pe pin",
            f"{actor_name}: {pin['title']}",
            type_="dt_comment",
            link="/digital-twin",
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


# ----------------- 2D Plans (PDF) — Phase F -----------------

class PlanCreateMeta(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    plan_type: str = Field("floorplan")


@router.post("/projects/{project_id}/plans")
async def upload_plan(
    project_id: str,
    file: UploadFile = File(...),
    title: str = Query(..., min_length=1, max_length=200),
    description: Optional[str] = Query(None, max_length=2000),
    plan_type: str = Query("floorplan"),
    user: dict = Depends(get_current_user),
):
    """Upload a 2D architectural PDF (floor plan, section, elevation, detail)."""
    await _ensure_dt_access(user)
    p = await _ensure_project_access(project_id, user)
    if user.get("role") not in ("admin", "operator") and p.get("owner_id") != user["id"]:
        # Project members can also upload plans (architects, specialists need to share schedules)
        is_member = any(m.get("user_id") == user["id"] for m in (p.get("members") or []))
        if not is_member:
            raise HTTPException(403, "Doar proprietarul sau membrii proiectului pot încărca planuri.")

    plan_type_clean = plan_type if plan_type in PLAN_TYPES else "other"

    raw_name = file.filename or "plan.pdf"
    ext = Path(raw_name).suffix.lower()
    if ext not in ALLOWED_PLAN_EXTS:
        raise HTTPException(400, "Format permis: .pdf")

    plans_dir = UPLOAD_ROOT / project_id / "plans"
    plans_dir.mkdir(parents=True, exist_ok=True)
    safe_stem = uuid.uuid4().hex[:12]
    safe_name = f"{safe_stem}{ext}"
    dest = plans_dir / safe_name

    total = 0
    try:
        with dest.open("wb") as out:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                total += len(chunk)
                if total > MAX_PLAN_BYTES:
                    out.close()
                    dest.unlink(missing_ok=True)
                    raise HTTPException(413, f"Fișier prea mare (max {MAX_PLAN_BYTES // (1024*1024)} MB pentru PDF).")
                out.write(chunk)
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        dest.unlink(missing_ok=True)
        raise HTTPException(500, f"Upload failed: {e}") from e

    public_path = f"/api/digital-twin/plans/{project_id}/{safe_name}"
    # Extract page count via pypdf (bug fix: enable Phase H page validation)
    page_count = 0
    try:
        from pypdf import PdfReader  # type: ignore
        with dest.open("rb") as fr:
            reader = PdfReader(fr)
            page_count = len(reader.pages)
    except Exception:  # noqa: BLE001
        page_count = 0
    doc = {
        "id": _new_id(),
        "project_id": project_id,
        "filename": raw_name,
        "stored_as": safe_name,
        "size_bytes": total,
        "page_count": page_count,
        "url": public_path,
        "title": title.strip(),
        "description": (description or "").strip(),
        "plan_type": plan_type_clean,
        "uploaded_by": user["id"],
        "uploaded_by_name": user.get("name") or user.get("email"),
        "uploaded_at": _now_iso(),
    }
    await db.digital_twin_plans.insert_one(doc)
    await db.digital_twin_projects.update_one(
        {"id": project_id},
        {"$set": {"updated_at": _now_iso()}, "$inc": {"plan_count": 1}},
    )
    # Phase G: notify stakeholders a new 2D plan was uploaded
    actor_name = user.get("name") or user.get("email") or "Utilizator"
    project_name = p.get("name", "Proiect")
    stakeholders = await _project_stakeholders(p, exclude_user_id=user["id"])
    for s in stakeholders:
        await notify(
            s["id"],
            f"📐 Plan 2D nou: {doc['title']}",
            f"{actor_name} pe {project_name}",
            type_="dt_plan",
            link="/digital-twin",
        )
        await send_template(
            tpl_dt_plan_uploaded,
            s["name"], project_name, doc["title"], doc["plan_type"], actor_name,
            to=s["email"],
        )
    return _clean(doc)


@router.get("/projects/{project_id}/plans")
async def list_plans(
    project_id: str,
    plan_type: Optional[str] = Query(None),
    user: dict = Depends(get_current_user),
):
    await _ensure_dt_access(user)
    await _ensure_project_access(project_id, user)
    q = {"project_id": project_id}
    if plan_type and plan_type in PLAN_TYPES:
        q["plan_type"] = plan_type
    items = []
    async for pl in db.digital_twin_plans.find(q).sort("uploaded_at", -1):
        items.append(_clean(pl))
    return {"items": items, "count": len(items)}


@router.get("/plans/{project_id}/{filename}")
async def serve_plan_file(project_id: str, filename: str, user: dict = Depends(get_current_user)):
    """Serve uploaded PDF plan. Permission-checked."""
    await _ensure_dt_access(user)
    await _ensure_project_access(project_id, user)
    if "/" in filename or "\\" in filename or filename.startswith(".."):
        raise HTTPException(400, "Invalid filename.")
    file_path = UPLOAD_ROOT / project_id / "plans" / filename
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(404, "Plan file not found.")
    return FileResponse(
        file_path,
        media_type="application/pdf",
        filename=filename,
        headers={"Cache-Control": "private, max-age=3600"},
    )


class PlanUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    plan_type: Optional[str] = None


@router.patch("/plans/{plan_id}")
async def update_plan(plan_id: str, payload: PlanUpdate, user: dict = Depends(get_current_user)):
    await _ensure_dt_access(user)
    plan = await db.digital_twin_plans.find_one({"id": plan_id})
    if not plan:
        raise HTTPException(404, "Plan not found.")
    proj = await _ensure_project_access(plan["project_id"], user)
    if (
        user.get("role") not in ("admin", "operator")
        and plan.get("uploaded_by") != user["id"]
        and proj.get("owner_id") != user["id"]
    ):
        raise HTTPException(403, "Cannot edit this plan.")
    updates = {k: (v.strip() if isinstance(v, str) else v) for k, v in payload.model_dump(exclude_none=True).items()}
    if "plan_type" in updates and updates["plan_type"] not in PLAN_TYPES:
        updates["plan_type"] = "other"
    if not updates:
        return _clean(plan)
    await db.digital_twin_plans.update_one({"id": plan_id}, {"$set": updates})
    plan = await db.digital_twin_plans.find_one({"id": plan_id})
    return _clean(plan)


@router.delete("/plans/{plan_id}")
async def delete_plan(plan_id: str, user: dict = Depends(get_current_user)):
    await _ensure_dt_access(user)
    plan = await db.digital_twin_plans.find_one({"id": plan_id})
    if not plan:
        raise HTTPException(404, "Plan not found.")
    proj = await _ensure_project_access(plan["project_id"], user)
    if (
        user.get("role") not in ("admin", "operator")
        and plan.get("uploaded_by") != user["id"]
        and proj.get("owner_id") != user["id"]
    ):
        raise HTTPException(403, "Cannot delete this plan.")
    # Remove the physical file
    file_path = UPLOAD_ROOT / plan["project_id"] / "plans" / plan["stored_as"]
    file_path.unlink(missing_ok=True)
    await db.digital_twin_plans.delete_one({"id": plan_id})
    await db.digital_twin_projects.update_one(
        {"id": plan["project_id"]},
        {"$inc": {"plan_count": -1}, "$set": {"updated_at": _now_iso()}},
    )
    return {"ok": True}


# ----------------- operator: digital twin onboarding for clients -----------------

operator_router = APIRouter(prefix="/api/operator/digital-twin", tags=["digital-twin-operator"])


class SubGrant(BaseModel):
    user_id: str
    active: bool = True


@operator_router.post("/grant-access")
async def operator_grant_access(payload: SubGrant, user: dict = Depends(require_role("operator", "admin"))):
    """Operator (or admin) grants/revokes Digital Twin Pro access to a client.
    Audit-logged. Required so the operator can prepare projects for paying clients."""
    target = await db.users.find_one(_user_filter(payload.user_id))
    if not target:
        raise HTTPException(404, "Client inexistent.")
    if target.get("role") != "client":
        raise HTTPException(400, "Acces Digital Twin Pro se acordă doar clienților.")
    await db.users.update_one(
        _user_filter(payload.user_id),
        {"$set": {"digital_twin_pro": payload.active, "digital_twin_pro_updated_at": _now_iso()}},
    )
    await db.audit_log.insert_one({
        "actor": user["id"],
        "actor_role": user.get("role"),
        "action": "digital_twin.subscription." + ("grant" if payload.active else "revoke"),
        "target_user": payload.user_id,
        "via": "operator_panel" if user.get("role") == "operator" else "admin_panel",
        "created_at": _now_iso(),
    })
    if payload.active:
        await notify(
            payload.user_id,
            "🧊 Digital Twin Pro activat",
            f"{user.get('name') or 'Echipa PropManage'} ti-a activat accesul la modulul Digital Twin Pro. Mergi la 'Digital Twin' pentru a-ti vedea proiectul.",
            type_="dt_subscription",
            link="/digital-twin",
        )
    return {"ok": True, "user_id": payload.user_id, "active": payload.active}


@operator_router.get("/clients-queue")
async def operator_clients_queue(
    status: str = Query("all", pattern="^(all|needs_setup|in_progress|delivered)$"),
    user: dict = Depends(require_role("operator", "admin")),  # noqa: ARG001
):
    """Lists clients eligible for / using Digital Twin Pro. Three statuses:
       - needs_setup: digital_twin_pro=true AND project_count==0 (no project created yet)
       - in_progress: digital_twin_pro=true AND has projects but model_count==0
       - delivered: digital_twin_pro=true AND has projects with model uploaded
       - all: union of the above
    """
    cursor = db.users.find({"role": "client", "digital_twin_pro": True})
    items = []
    async for u in cursor:
        cid = str(u["_id"])
        project_count = await db.digital_twin_projects.count_documents({"owner_id": cid})
        model_count = 0
        plan_count = 0
        projects = []
        if project_count:
            async for p in db.digital_twin_projects.find({"owner_id": cid}).sort("updated_at", -1):
                model_count += p.get("model_count", 0)
                plan_count += p.get("plan_count", 0)
                projects.append({
                    "id": p["id"],
                    "name": p.get("name"),
                    "model_count": p.get("model_count", 0),
                    "plan_count": p.get("plan_count", 0),
                    "pin_count": p.get("pin_count", 0),
                    "updated_at": p.get("updated_at"),
                })
        if project_count == 0:
            client_status = "needs_setup"
        elif model_count == 0:
            client_status = "in_progress"
        else:
            client_status = "delivered"
        if status != "all" and status != client_status:
            continue
        items.append({
            "client_id": cid,
            "client_name": u.get("name") or u.get("email"),
            "client_email": u.get("email"),
            "client_phone": u.get("phone"),
            "zone": u.get("zone"),
            "granted_at": u.get("digital_twin_pro_updated_at"),
            "project_count": project_count,
            "model_count": model_count,
            "plan_count": plan_count,
            "projects": projects,
            "status": client_status,
        })
    items.sort(key=lambda x: (x["status"] != "needs_setup", x["status"] != "in_progress", -(len(x["projects"]) or 0)))
    counters = {
        "needs_setup": sum(1 for x in items if x["status"] == "needs_setup"),
        "in_progress": sum(1 for x in items if x["status"] == "in_progress"),
        "delivered": sum(1 for x in items if x["status"] == "delivered"),
        "total": len(items),
    }
    return {"items": items, "counters": counters}


class OperatorProjectCreate(BaseModel):
    client_id: str
    name: str = Field(..., min_length=2, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)


@operator_router.post("/clients/{client_id}/projects")
async def operator_create_project_for_client(
    client_id: str,
    payload: OperatorProjectCreate,
    user: dict = Depends(require_role("operator", "admin")),
):
    """Creates a Digital Twin project owned by the client (not the operator).
    The operator is recorded as `created_by_operator_id` for audit / project routing."""
    if payload.client_id != client_id:
        raise HTTPException(400, "client_id mismatch.")
    client = await db.users.find_one(_user_filter(client_id))
    if not client:
        raise HTTPException(404, "Client inexistent.")
    if (client.get("role") or "").lower() != "client":
        raise HTTPException(400, "Doar clientii pot avea proiecte Digital Twin.")
    if not client.get("digital_twin_pro"):
        raise HTTPException(400, "Clientul nu are acces Digital Twin Pro. Acordă mai întâi accesul.")
    pid = _new_id()
    now = _now_iso()
    doc = {
        "id": pid,
        "name": payload.name.strip(),
        "description": (payload.description or "").strip(),
        "model_url": None,
        "owner_id": client_id,
        "owner_name": client.get("name") or client.get("email"),
        "members": [],
        "model_count": 0,
        "plan_count": 0,
        "pin_count": 0,
        "created_at": now,
        "updated_at": now,
        "created_by_operator_id": user["id"],
        "created_by_operator_name": user.get("name") or user.get("email"),
    }
    await db.digital_twin_projects.insert_one(doc)
    await db.audit_log.insert_one({
        "actor": user["id"],
        "actor_role": user.get("role"),
        "action": "digital_twin.project.create_for_client",
        "target_user": client_id,
        "project_id": pid,
        "created_at": now,
    })
    await notify(
        client_id,
        "🏗️ Proiect Digital Twin creat",
        f"{user.get('name') or 'Echipa PropManage'} a creat proiectul '{payload.name}' pentru tine. Va incarca in curand modelul 3D si planurile.",
        type_="dt_project",
        link="/digital-twin",
    )
    return _clean(doc)


# ----------------- admin: subscription grant -----------------

admin_router = APIRouter(prefix="/api/admin/digital-twin", tags=["digital-twin-admin"])


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
        "plans": await db.digital_twin_plans.count_documents({}),
        "pins": await db.digital_twin_pins.count_documents({}),
        "comments": await db.digital_twin_comments.count_documents({}),
        "pro_users": await db.users.count_documents({"digital_twin_pro": True}),
    }



@admin_router.post("/auto-reminders/run-now")
async def admin_run_auto_reminders_now(user: dict = Depends(require_role("admin"))):  # noqa: ARG001
    """Manually trigger the auto-reminder scheduler (idempotent — won't double-fire same threshold)."""
    return await run_dt_auto_reminders()


@admin_router.get("/auto-reminders/last-run")
async def admin_auto_reminders_last_run(user: dict = Depends(require_role("admin"))):  # noqa: ARG001
    doc = await db.scheduler_runs.find_one({"_id": "dt_auto_reminders"})
    return doc.get("last_run") if doc else {"never_ran": True}
