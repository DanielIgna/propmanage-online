"""PropManage router: designer-led PROJECTS (multi-specialist coordination, ClickUp-style).

Concept:
- A `project` is created by a designer (specialist with `interior_design` in service_categories).
- The designer adds the client + 1..N specialists as members.
- Tasks are created inside the project and assigned to any member.
- Each member (client included) can view tasks, post comments, mark assigned tasks done.
"""
import logging
from typing import Optional, List, Literal
from datetime import datetime, timezone
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from db import db
from core_utils import serialize_doc
from deps import get_current_user
from services import notify, log_event

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["projects"])


# ============= MODELS =============
class ProjectIn(BaseModel):
    name: str = Field(min_length=3, max_length=200)
    description: Optional[str] = Field(default=None, max_length=4000)
    client_id: str
    property_id: Optional[str] = None
    style: Optional[str] = None
    budget_estimate: Optional[float] = None


class ProjectUpdateIn(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[Literal["active", "on_hold", "completed", "cancelled"]] = None
    style: Optional[str] = None
    budget_estimate: Optional[float] = None


class MemberAddIn(BaseModel):
    user_id: str
    role: Literal["specialist", "client", "observer"] = "specialist"
    specialty: Optional[str] = None  # parchet, zugravit, faianta, handyman etc.
    note: Optional[str] = None


class TaskIn(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    description: Optional[str] = Field(default=None, max_length=4000)
    assignee_id: Optional[str] = None
    due_date: Optional[str] = None
    priority: Literal["low", "normal", "high", "urgent"] = "normal"
    status: Literal["todo", "in_progress", "review", "done", "blocked"] = "todo"


class TaskUpdateIn(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    assignee_id: Optional[str] = None
    due_date: Optional[str] = None
    priority: Optional[Literal["low", "normal", "high", "urgent"]] = None
    status: Optional[Literal["todo", "in_progress", "review", "done", "blocked"]] = None


class CommentIn(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


# ============= HELPERS =============
def _is_designer(user: dict) -> bool:
    if user.get("role") != "specialist":
        return False
    cats = user.get("service_categories") or []
    return "interior_design" in cats or user.get("specialty") == "interior_design"


async def _load_project_or_403(project_id: str, user: dict, must_be_designer: bool = False) -> dict:
    proj = await db.projects.find_one({"_id": ObjectId(project_id)})
    if not proj:
        raise HTTPException(404, "Proiectul nu a fost găsit.")
    is_designer = proj.get("designer_id") == user["id"]
    if must_be_designer and not is_designer:
        raise HTTPException(403, "Doar designerul coordonator poate face această acțiune.")
    # Membership: designer, client, any specialist member
    member_ids = {m.get("user_id") for m in (proj.get("members") or [])}
    member_ids.add(proj.get("designer_id"))
    member_ids.add(proj.get("client_id"))
    if user["id"] not in member_ids and user.get("role") != "admin":
        raise HTTPException(403, "Nu ești membru al acestui proiect.")
    return proj


def _serialize_project(p: dict) -> dict:
    out = serialize_doc(p)
    return out


# ============= PROJECT CRUD =============
@router.post("/projects")
async def create_project(data: ProjectIn, user: dict = Depends(get_current_user)):
    """Designer creates a new project and invites the client as member."""
    if not _is_designer(user):
        raise HTTPException(403, "Doar designerii (interior_design) pot crea proiecte de coordonare.")
    client = await db.users.find_one({"_id": ObjectId(data.client_id), "role": "client"})
    if not client:
        raise HTTPException(404, "Clientul nu a fost găsit.")
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "name": data.name,
        "description": data.description,
        "designer_id": user["id"],
        "designer_name": user.get("name"),
        "client_id": data.client_id,
        "client_name": client.get("name"),
        "property_id": data.property_id,
        "style": data.style,
        "budget_estimate": data.budget_estimate,
        "status": "active",
        "members": [
            {"user_id": data.client_id, "name": client.get("name"), "role": "client", "added_at": now},
        ],
        "created_at": now,
        "updated_at": now,
    }
    res = await db.projects.insert_one(doc)
    pid = str(res.inserted_id)
    await notify(data.client_id, "Proiect nou", f"Designerul {user.get('name')} te-a inclus în proiectul '{data.name}'.", type_="project", link=f"/projects/{pid}")
    await log_event(None, "project.created", actor=user, payload={"project_id": pid, "name": data.name, "client_id": data.client_id})
    doc["_id"] = res.inserted_id
    return _serialize_project(doc)


@router.get("/projects")
async def list_my_projects(user: dict = Depends(get_current_user)):
    """List all projects where the current user is designer, client or member."""
    q = {"$or": [
        {"designer_id": user["id"]},
        {"client_id": user["id"]},
        {"members.user_id": user["id"]},
    ]}
    docs = await db.projects.find(q).sort("updated_at", -1).to_list(100)
    return [_serialize_project(d) for d in docs]


@router.get("/projects/{project_id}")
async def get_project(project_id: str, user: dict = Depends(get_current_user)):
    proj = await _load_project_or_403(project_id, user)
    # Enrich with tasks count by status
    tasks = await db.project_tasks.find({"project_id": project_id}).to_list(500)
    counts = {"todo": 0, "in_progress": 0, "review": 0, "done": 0, "blocked": 0, "total": len(tasks)}
    for t in tasks:
        counts[t.get("status", "todo")] = counts.get(t.get("status", "todo"), 0) + 1
    out = _serialize_project(proj)
    out["tasks_count"] = counts
    return out


@router.patch("/projects/{project_id}")
async def update_project(project_id: str, data: ProjectUpdateIn, user: dict = Depends(get_current_user)):
    proj = await _load_project_or_403(project_id, user, must_be_designer=True)
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    if update:
        update["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.projects.update_one({"_id": ObjectId(project_id)}, {"$set": update})
    refreshed = await db.projects.find_one({"_id": ObjectId(project_id)})
    return _serialize_project(refreshed)


# ============= MEMBERS =============
@router.post("/projects/{project_id}/members")
async def add_member(project_id: str, data: MemberAddIn, user: dict = Depends(get_current_user)):
    proj = await _load_project_or_403(project_id, user, must_be_designer=True)
    target = await db.users.find_one({"_id": ObjectId(data.user_id)})
    if not target:
        raise HTTPException(404, "Utilizator inexistent.")
    # Already member?
    if any(m.get("user_id") == data.user_id for m in (proj.get("members") or [])):
        raise HTTPException(400, "Deja membru.")
    now = datetime.now(timezone.utc).isoformat()
    member = {
        "user_id": data.user_id,
        "name": target.get("name"),
        "role": data.role,
        "specialty": data.specialty,
        "note": data.note,
        "added_at": now,
    }
    await db.projects.update_one(
        {"_id": ObjectId(project_id)},
        {"$push": {"members": member}, "$set": {"updated_at": now}}
    )
    await notify(data.user_id, "Invitat în proiect", f"Designerul {user.get('name')} te-a adăugat în proiectul '{proj.get('name')}'.", type_="project", link=f"/projects/{project_id}")
    await log_event(None, "project.member_added", actor=user, payload={"project_id": project_id, "member_id": data.user_id, "specialty": data.specialty})
    return {"ok": True, "member": member}


@router.delete("/projects/{project_id}/members/{user_id}")
async def remove_member(project_id: str, user_id: str, user: dict = Depends(get_current_user)):
    proj = await _load_project_or_403(project_id, user, must_be_designer=True)
    if user_id == proj.get("client_id"):
        raise HTTPException(400, "Clientul nu poate fi eliminat din propriul proiect.")
    now = datetime.now(timezone.utc).isoformat()
    await db.projects.update_one(
        {"_id": ObjectId(project_id)},
        {"$pull": {"members": {"user_id": user_id}}, "$set": {"updated_at": now}}
    )
    # Also unassign their tasks
    await db.project_tasks.update_many(
        {"project_id": project_id, "assignee_id": user_id},
        {"$set": {"assignee_id": None}}
    )
    return {"ok": True}


# ============= TASKS =============
@router.get("/projects/{project_id}/tasks")
async def list_tasks(project_id: str, user: dict = Depends(get_current_user)):
    await _load_project_or_403(project_id, user)
    docs = await db.project_tasks.find({"project_id": project_id}).sort("created_at", -1).to_list(500)
    return [serialize_doc(d) for d in docs]


@router.post("/projects/{project_id}/tasks")
async def create_task(project_id: str, data: TaskIn, user: dict = Depends(get_current_user)):
    proj = await _load_project_or_403(project_id, user, must_be_designer=True)
    now = datetime.now(timezone.utc).isoformat()
    assignee_name = None
    if data.assignee_id:
        # Validate assignee is a project member or the designer or the client
        member_ids = {m.get("user_id") for m in (proj.get("members") or [])}
        member_ids.add(proj.get("designer_id"))
        if data.assignee_id not in member_ids:
            raise HTTPException(400, "Asignatul nu este membru al proiectului.")
        atarget = await db.users.find_one({"_id": ObjectId(data.assignee_id)})
        assignee_name = (atarget or {}).get("name")
    doc = {
        "project_id": project_id,
        "title": data.title,
        "description": data.description,
        "assignee_id": data.assignee_id,
        "assignee_name": assignee_name,
        "due_date": data.due_date,
        "priority": data.priority,
        "status": data.status,
        "created_by": user["id"],
        "created_by_name": user.get("name"),
        "created_at": now,
        "updated_at": now,
        "comments_count": 0,
    }
    res = await db.project_tasks.insert_one(doc)
    await db.projects.update_one({"_id": ObjectId(project_id)}, {"$set": {"updated_at": now}})
    if data.assignee_id and data.assignee_id != user["id"]:
        await notify(data.assignee_id, "Task nou", f"Ai un task nou în proiectul '{proj.get('name')}': {data.title}", type_="task", link=f"/projects/{project_id}")
    doc["_id"] = res.inserted_id
    return serialize_doc(doc)


@router.patch("/tasks/{task_id}")
async def update_task(task_id: str, data: TaskUpdateIn, user: dict = Depends(get_current_user)):
    task = await db.project_tasks.find_one({"_id": ObjectId(task_id)})
    if not task:
        raise HTTPException(404, "Task inexistent.")
    proj = await _load_project_or_403(task["project_id"], user)
    is_designer = proj.get("designer_id") == user["id"]
    is_assignee = task.get("assignee_id") == user["id"]
    # Assignee can only change status (mark progress/done); designer can change everything
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    if not is_designer:
        allowed = {"status"}
        if not is_assignee or not set(update.keys()).issubset(allowed):
            raise HTTPException(403, "Doar designerul sau persoana asignată poate modifica acest task.")
    if "assignee_id" in update and update["assignee_id"]:
        atarget = await db.users.find_one({"_id": ObjectId(update["assignee_id"])})
        update["assignee_name"] = (atarget or {}).get("name")
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.project_tasks.update_one({"_id": ObjectId(task_id)}, {"$set": update})
    await db.projects.update_one({"_id": ObjectId(task["project_id"])}, {"$set": {"updated_at": update["updated_at"]}})
    refreshed = await db.project_tasks.find_one({"_id": ObjectId(task_id)})
    # Notify status change if assignee changed it
    if "status" in update and not is_designer:
        await notify(proj.get("designer_id"), "Task actualizat", f"{user.get('name')} a marcat '{task.get('title')}' ca {update['status']}.", type_="task", link=f"/projects/{task['project_id']}")
    return serialize_doc(refreshed)


# ============= COMMENTS =============
@router.get("/tasks/{task_id}/comments")
async def list_comments(task_id: str, user: dict = Depends(get_current_user)):
    task = await db.project_tasks.find_one({"_id": ObjectId(task_id)})
    if not task:
        raise HTTPException(404, "Task inexistent.")
    await _load_project_or_403(task["project_id"], user)
    docs = await db.task_comments.find({"task_id": task_id}).sort("created_at", 1).to_list(500)
    return [serialize_doc(d) for d in docs]


@router.post("/tasks/{task_id}/comments")
async def add_comment(task_id: str, data: CommentIn, user: dict = Depends(get_current_user)):
    task = await db.project_tasks.find_one({"_id": ObjectId(task_id)})
    if not task:
        raise HTTPException(404, "Task inexistent.")
    proj = await _load_project_or_403(task["project_id"], user)
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "task_id": task_id,
        "project_id": task["project_id"],
        "body": data.body,
        "author_id": user["id"],
        "author_name": user.get("name"),
        "author_role": user.get("role"),
        "created_at": now,
    }
    await db.task_comments.insert_one(doc)
    await db.project_tasks.update_one({"_id": ObjectId(task_id)}, {"$inc": {"comments_count": 1}, "$set": {"updated_at": now}})
    # Notify all OTHER members
    member_ids = {m.get("user_id") for m in (proj.get("members") or [])}
    member_ids.add(proj.get("designer_id"))
    member_ids.discard(user["id"])
    for mid in member_ids:
        await notify(mid, f"Comentariu nou în '{task.get('title')}'", data.body[:120], type_="task", link=f"/projects/{task['project_id']}")
    return serialize_doc(doc)
