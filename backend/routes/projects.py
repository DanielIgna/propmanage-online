"""PropManage router: designer-led PROJECTS (multi-specialist coordination, ClickUp-style).

Concept:
- A `project` is created by a designer (specialist with `interior_design` in service_categories).
- The designer adds the client + 1..N specialists as members.
- Tasks are created inside the project and assigned to any member.
- Each member (client included) can view tasks, post comments, mark assigned tasks done.
- Milestone-based escrow payments (4 tranches of 25%) with 30-day warranty on final release.
"""
import logging
import uuid
from typing import Optional, List, Literal
from datetime import datetime, timezone, timedelta
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from db import db
from core_utils import serialize_doc
from deps import get_current_user
from services import notify, log_event

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["projects"])

WARRANTY_DAYS_DEFAULT = 30
DEFAULT_TRANCHE_PCTS = [25, 25, 25, 25]
DEFAULT_TRANCHE_NAMES = [
    "Avans la semnare",
    "Începere lucrare",
    "Lucrare 75% finalizată",
    "Finalizare + garanție",
]
DEFAULT_TRANCHE_DESCRIPTIONS = [
    "Plată inițială. Banii rămân blocați în escrow până când designerul confirmă începerea lucrării.",
    "Eliberare automată către specialiști când lucrarea pornește efectiv. Următoarea tranșă se cere la 50% progres.",
    "Tranșă intermediară. Se cere când lucrarea ajunge la 75% finalizare.",
    "Tranșă finală. Se blochează 30 de zile pentru garanție. Dacă apar probleme, specialistul le rezolvă, apoi se eliberează.",
]


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



# ============= MILESTONE PAYMENTS (4-tranche escrow with 30-day warranty) =============
class MilestoneInitIn(BaseModel):
    total_budget: float = Field(gt=0)
    custom_names: Optional[List[str]] = None  # override default tranche names if needed


class MilestoneFundIn(BaseModel):
    # In real production this would create a Stripe PaymentIntent. For now: client confirms transfer to escrow.
    confirm: bool = True


class MilestoneReleaseIn(BaseModel):
    note: Optional[str] = None


class WarrantyClaimIn(BaseModel):
    reason: str = Field(min_length=10, max_length=2000)


def _build_default_milestones(total_budget: float, names: Optional[List[str]] = None) -> List[dict]:
    final_names = (names + DEFAULT_TRANCHE_NAMES[len(names):])[:4] if names else DEFAULT_TRANCHE_NAMES
    out = []
    for i, pct in enumerate(DEFAULT_TRANCHE_PCTS):
        out.append({
            "id": str(uuid.uuid4()),
            "name": final_names[i],
            "description": DEFAULT_TRANCHE_DESCRIPTIONS[i],
            "pct": pct,
            "amount": round(total_budget * pct / 100, 2),
            "status": "pending_funding",  # pending_funding -> funded -> released -> warranty_hold -> warranty_released
            "is_final": i == len(DEFAULT_TRANCHE_PCTS) - 1,
            "warranty_days": WARRANTY_DAYS_DEFAULT if i == len(DEFAULT_TRANCHE_PCTS) - 1 else 0,
            "funded_at": None,
            "released_at": None,
            "warranty_release_at": None,
            "warranty_dispute_open": False,
            "warranty_dispute_reason": None,
        })
    return out


@router.post("/projects/{project_id}/milestones/init")
async def init_milestones(project_id: str, data: MilestoneInitIn, user: dict = Depends(get_current_user)):
    """Designer initializes the 4-tranche payment plan (25/25/25/25) for the project."""
    proj = await _load_project_or_403(project_id, user, must_be_designer=True)
    if proj.get("milestones"):
        raise HTTPException(400, "Planul de plată este deja configurat.")
    milestones = _build_default_milestones(data.total_budget, data.custom_names)
    now = datetime.now(timezone.utc).isoformat()
    await db.projects.update_one(
        {"_id": ObjectId(project_id)},
        {"$set": {"milestones": milestones, "total_budget": data.total_budget, "updated_at": now}}
    )
    await log_event(None, "project.milestones_initialized", actor=user, payload={"project_id": project_id, "total_budget": data.total_budget})
    await notify(proj.get("client_id"), "Plan de plăți disponibil", f"Designerul a setat planul de plăți pentru '{proj.get('name')}'. Avansul de 25% așteaptă confirmarea ta.", type_="payment", link=f"/projects/{project_id}")
    return {"ok": True, "milestones": milestones, "total_budget": data.total_budget}


@router.get("/projects/{project_id}/milestones")
async def get_milestones(project_id: str, user: dict = Depends(get_current_user)):
    proj = await _load_project_or_403(project_id, user)
    return {
        "total_budget": proj.get("total_budget"),
        "milestones": proj.get("milestones") or [],
    }


def _find_milestone(proj: dict, mid: str) -> tuple:
    for i, m in enumerate(proj.get("milestones") or []):
        if m.get("id") == mid:
            return i, m
    raise HTTPException(404, "Tranșă inexistentă.")


@router.post("/projects/{project_id}/milestones/{mid}/fund")
async def fund_milestone(project_id: str, mid: str, data: MilestoneFundIn, user: dict = Depends(get_current_user)):
    """Client funds a tranche into escrow. The amount is deducted from client wallet (demo mode)."""
    proj = await _load_project_or_403(project_id, user)
    if user["id"] != proj.get("client_id"):
        raise HTTPException(403, "Doar clientul proiectului poate finanța tranșele.")
    idx, m = _find_milestone(proj, mid)
    if m.get("status") != "pending_funding":
        raise HTTPException(400, f"Tranșa este în starea '{m.get('status')}', nu poate fi finanțată.")
    # Sequential funding rule: previous tranche must be released
    if idx > 0:
        prev = proj["milestones"][idx - 1]
        if prev.get("status") not in ("released", "warranty_hold", "warranty_released"):
            raise HTTPException(400, "Trebuie să eliberezi tranșa anterioară înainte de a finanța următoarea.")
    # Demo wallet deduction (in production: Stripe PaymentIntent → webhook → mark funded)
    client_doc = await db.users.find_one({"_id": ObjectId(user["id"])})
    if (client_doc.get("wallet_balance") or 0) < m["amount"]:
        raise HTTPException(402, f"Sold insuficient în portofel. Necesar: {m['amount']} RON.")
    now = datetime.now(timezone.utc).isoformat()
    await db.users.update_one({"_id": ObjectId(user["id"])}, {"$inc": {"wallet_balance": -m["amount"]}})
    await db.transactions.insert_one({
        "user_id": user["id"], "type": "escrow_fund",
        "amount": -m["amount"], "project_id": project_id, "milestone_id": mid,
        "description": f"Escrow: {m['name']} (tranșa {idx+1}/4)",
        "created_at": now,
    })
    proj["milestones"][idx]["status"] = "funded"
    proj["milestones"][idx]["funded_at"] = now
    await db.projects.update_one({"_id": ObjectId(project_id)}, {"$set": {"milestones": proj["milestones"], "updated_at": now}})
    await log_event(None, "project.milestone_funded", actor=user, payload={"project_id": project_id, "milestone_id": mid, "amount": m["amount"], "pct": m["pct"]})
    await notify(proj.get("designer_id"), f"Tranșă {idx+1}/4 finanțată", f"Clientul a plătit {m['amount']} RON în escrow pentru '{m['name']}'. Eliberează când e cazul.", type_="payment", link=f"/projects/{project_id}")
    return {"ok": True, "milestone": proj["milestones"][idx]}


@router.post("/projects/{project_id}/milestones/{mid}/release")
async def release_milestone(project_id: str, mid: str, data: MilestoneReleaseIn, user: dict = Depends(get_current_user)):
    """Designer releases a funded milestone. Money credits specialists (split equally among non-client members).
    For the final milestone: enters warranty_hold (30 days) before actually crediting specialists.
    """
    proj = await _load_project_or_403(project_id, user, must_be_designer=True)
    idx, m = _find_milestone(proj, mid)
    if m.get("status") != "funded":
        raise HTTPException(400, f"Tranșa este în starea '{m.get('status')}', nu poate fi eliberată.")
    now_dt = datetime.now(timezone.utc)
    now = now_dt.isoformat()
    if m.get("is_final"):
        # Enter warranty hold
        proj["milestones"][idx]["status"] = "warranty_hold"
        proj["milestones"][idx]["released_at"] = now
        proj["milestones"][idx]["warranty_release_at"] = (now_dt + timedelta(days=m.get("warranty_days", WARRANTY_DAYS_DEFAULT))).isoformat()
        await db.projects.update_one({"_id": ObjectId(project_id)}, {"$set": {"milestones": proj["milestones"], "updated_at": now}})
        await log_event(None, "project.milestone_warranty_hold", actor=user, payload={"project_id": project_id, "milestone_id": mid, "release_at": proj["milestones"][idx]["warranty_release_at"]})
        await notify(proj.get("client_id"), "Lucrare finalizată — perioadă de garanție", f"Designerul a marcat lucrarea ca finalizată. Tranșa finală ({m['amount']} RON) e blocată 30 zile. Dacă apar probleme, raportează-le din workspace.", type_="payment", link=f"/projects/{project_id}")
        return {"ok": True, "milestone": proj["milestones"][idx], "warranty_hold": True}
    # Regular release: credit specialists
    member_ids = [mm.get("user_id") for mm in (proj.get("members") or []) if mm.get("role") == "specialist"]
    if not member_ids:
        member_ids = [proj.get("designer_id")]  # fallback: designer takes it all
    share = round(m["amount"] / len(member_ids), 2)
    for uid in member_ids:
        await db.users.update_one({"_id": ObjectId(uid)}, {"$inc": {"wallet_balance": share}})
        await db.transactions.insert_one({
            "user_id": uid, "type": "escrow_release",
            "amount": share, "project_id": project_id, "milestone_id": mid,
            "description": f"Eliberare escrow: {m['name']} (tranșa {idx+1}/4, proiect '{proj.get('name')}')",
            "created_at": now,
        })
        await notify(uid, f"Plată primită: {share} RON", f"Tranșa '{m['name']}' a fost eliberată în portofelul tău din proiectul '{proj.get('name')}'.", type_="payment", link=f"/projects/{project_id}")
    proj["milestones"][idx]["status"] = "released"
    proj["milestones"][idx]["released_at"] = now
    await db.projects.update_one({"_id": ObjectId(project_id)}, {"$set": {"milestones": proj["milestones"], "updated_at": now}})
    await log_event(None, "project.milestone_released", actor=user, payload={"project_id": project_id, "milestone_id": mid, "amount": m["amount"], "split_to": len(member_ids)})
    return {"ok": True, "milestone": proj["milestones"][idx]}


@router.post("/projects/{project_id}/milestones/{mid}/warranty-claim")
async def warranty_claim(project_id: str, mid: str, data: WarrantyClaimIn, user: dict = Depends(get_current_user)):
    """Client raises a warranty issue within the 30-day period. Pauses auto-release."""
    proj = await _load_project_or_403(project_id, user)
    if user["id"] != proj.get("client_id"):
        raise HTTPException(403, "Doar clientul poate raporta probleme de garanție.")
    idx, m = _find_milestone(proj, mid)
    if m.get("status") != "warranty_hold":
        raise HTTPException(400, "Această tranșă nu este în perioadă de garanție.")
    now = datetime.now(timezone.utc).isoformat()
    proj["milestones"][idx]["warranty_dispute_open"] = True
    proj["milestones"][idx]["warranty_dispute_reason"] = data.reason
    proj["milestones"][idx]["warranty_dispute_opened_at"] = now
    await db.projects.update_one({"_id": ObjectId(project_id)}, {"$set": {"milestones": proj["milestones"], "updated_at": now}})
    await log_event(None, "project.warranty_claim_opened", actor=user, payload={"project_id": project_id, "milestone_id": mid, "reason": data.reason[:100]})
    await notify(proj.get("designer_id"), "Reclamație în garanție", f"Clientul a raportat o problemă în perioada de garanție pentru '{proj.get('name')}'. Rezolvă pentru a debloca plata.", type_="warranty", link=f"/projects/{project_id}")
    # Notify all specialists too
    for mm in (proj.get("members") or []):
        if mm.get("role") == "specialist":
            await notify(mm["user_id"], "Reclamație în garanție", f"Există o problemă raportată în proiectul '{proj.get('name')}' care necesită intervenție.", type_="warranty", link=f"/projects/{project_id}")
    return {"ok": True, "milestone": proj["milestones"][idx]}


@router.post("/projects/{project_id}/milestones/{mid}/warranty-resolve")
async def warranty_resolve(project_id: str, mid: str, user: dict = Depends(get_current_user)):
    """Designer or client marks warranty claim as resolved. Releases the final tranche to specialists."""
    proj = await _load_project_or_403(project_id, user)
    idx, m = _find_milestone(proj, mid)
    if m.get("status") != "warranty_hold":
        raise HTTPException(400, "Tranșa nu este în garanție.")
    if user["id"] not in (proj.get("designer_id"), proj.get("client_id")):
        raise HTTPException(403, "Doar designerul sau clientul pot închide reclamația.")
    now = datetime.now(timezone.utc).isoformat()
    # Now credit specialists
    member_ids = [mm.get("user_id") for mm in (proj.get("members") or []) if mm.get("role") == "specialist"]
    if not member_ids:
        member_ids = [proj.get("designer_id")]
    share = round(m["amount"] / len(member_ids), 2)
    for uid in member_ids:
        await db.users.update_one({"_id": ObjectId(uid)}, {"$inc": {"wallet_balance": share}})
        await db.transactions.insert_one({
            "user_id": uid, "type": "escrow_release_warranty",
            "amount": share, "project_id": project_id, "milestone_id": mid,
            "description": f"Eliberare după garanție: {m['name']} (proiect '{proj.get('name')}')",
            "created_at": now,
        })
        await notify(uid, f"Garanție închisă — plată: {share} RON", f"Tranșa finală a fost eliberată în portofelul tău.", type_="payment", link=f"/projects/{project_id}")
    proj["milestones"][idx]["status"] = "warranty_released"
    proj["milestones"][idx]["warranty_dispute_open"] = False
    proj["milestones"][idx]["warranty_released_at"] = now
    await db.projects.update_one({"_id": ObjectId(project_id)}, {"$set": {"milestones": proj["milestones"], "updated_at": now, "status": "completed"}})
    await log_event(None, "project.warranty_resolved", actor=user, payload={"project_id": project_id, "milestone_id": mid})
    await notify(proj.get("client_id"), "Garanție închisă — proiect finalizat", f"Tranșa finală a fost eliberată. Proiectul '{proj.get('name')}' este oficial complet.", type_="payment", link=f"/projects/{project_id}")
    return {"ok": True, "milestone": proj["milestones"][idx]}


async def auto_release_warranty_holds():
    """Cron-like job: auto-release any warranty_hold milestone past its warranty_release_at AND without open dispute."""
    now_dt = datetime.now(timezone.utc)
    cursor = db.projects.find({"milestones.status": "warranty_hold"})
    released = 0
    async for proj in cursor:
        changed = False
        for idx, m in enumerate(proj.get("milestones") or []):
            if m.get("status") != "warranty_hold":
                continue
            if m.get("warranty_dispute_open"):
                continue
            release_at = m.get("warranty_release_at")
            if not release_at:
                continue
            if datetime.fromisoformat(release_at) <= now_dt:
                # Credit specialists
                member_ids = [mm.get("user_id") for mm in (proj.get("members") or []) if mm.get("role") == "specialist"]
                if not member_ids:
                    member_ids = [proj.get("designer_id")]
                share = round(m["amount"] / len(member_ids), 2)
                now = now_dt.isoformat()
                for uid in member_ids:
                    await db.users.update_one({"_id": ObjectId(uid)}, {"$inc": {"wallet_balance": share}})
                    await db.transactions.insert_one({
                        "user_id": uid, "type": "escrow_release_warranty_auto",
                        "amount": share, "project_id": str(proj["_id"]), "milestone_id": m["id"],
                        "description": f"Eliberare automată după 30 zile: {m['name']}",
                        "created_at": now,
                    })
                    await notify(uid, f"Plată finală: {share} RON", "Garanția a expirat fără reclamații. Banii sunt în portofel.", type_="payment", link=f"/projects/{proj['_id']}")
                proj["milestones"][idx]["status"] = "warranty_released"
                proj["milestones"][idx]["warranty_released_at"] = now
                proj["milestones"][idx]["auto_released"] = True
                changed = True
                released += 1
        if changed:
            await db.projects.update_one({"_id": proj["_id"]}, {"$set": {"milestones": proj["milestones"], "updated_at": now_dt.isoformat(), "status": "completed"}})
    logging.info(f"Auto-released {released} warranty milestones.")
    return {"released": released}


# ============= TASK ATTACHMENTS =============
class AttachmentIn(BaseModel):
    url: str = Field(min_length=10, max_length=3_000_000)  # base64 data URL or http URL
    name: str = Field(min_length=1, max_length=200)
    mime: Optional[str] = None


@router.post("/tasks/{task_id}/attachments")
async def add_attachment(task_id: str, data: AttachmentIn, user: dict = Depends(get_current_user)):
    task = await db.project_tasks.find_one({"_id": ObjectId(task_id)})
    if not task:
        raise HTTPException(404, "Task inexistent.")
    await _load_project_or_403(task["project_id"], user)
    att = {
        "id": str(uuid.uuid4()),
        "url": data.url,
        "name": data.name,
        "mime": data.mime,
        "uploaded_by": user["id"],
        "uploaded_by_name": user.get("name"),
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.project_tasks.update_one({"_id": ObjectId(task_id)}, {"$push": {"attachments": att}, "$set": {"updated_at": att["uploaded_at"]}})
    return {"ok": True, "attachment": att}


@router.delete("/tasks/{task_id}/attachments/{att_id}")
async def remove_attachment(task_id: str, att_id: str, user: dict = Depends(get_current_user)):
    task = await db.project_tasks.find_one({"_id": ObjectId(task_id)})
    if not task:
        raise HTTPException(404, "Task inexistent.")
    proj = await _load_project_or_403(task["project_id"], user)
    is_designer = proj.get("designer_id") == user["id"]
    # Only designer or uploader can remove
    att = next((a for a in (task.get("attachments") or []) if a.get("id") == att_id), None)
    if not att:
        raise HTTPException(404, "Atașament inexistent.")
    if not is_designer and att.get("uploaded_by") != user["id"]:
        raise HTTPException(403, "Doar designerul sau încărcătorul pot șterge atașamentul.")
    await db.project_tasks.update_one(
        {"_id": ObjectId(task_id)},
        {"$pull": {"attachments": {"id": att_id}}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"ok": True}
