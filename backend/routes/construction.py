"""CIP-A — Construction Intelligence REST API.

Public:
  GET  /api/construction/taxonomy/public       — arbore doar noduri vizibile
Admin:
  GET    /api/construction/taxonomy            — arbore complet + flags
  POST   /api/construction/taxonomy            — nod nou
  PATCH  /api/construction/taxonomy/{id}       — redenumire / activare
  DELETE /api/construction/taxonomy/{id}       — doar noduri fără copii
  POST   /api/construction/refresh-visibility  — gate prin Orchestrator
  GET    /api/construction/overview            — KPI + hidden-with-potential
  GET    /api/construction/projects            — vedere centrală cereri (filtre)
  GET    /api/construction/projects/export     — CSV
"""
import csv
import io
import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, Body, HTTPException, Query
from fastapi.responses import StreamingResponse

from db import db
from deps import require_role
from construction.taxonomy import (
    build_tree, refresh_category_visibility, slugify, seed_construction_taxonomy,
)

logger = logging.getLogger("propmanage.construction_routes")
router = APIRouter(prefix="/api/construction", tags=["construction"])


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _clean(n: dict) -> dict:
    n = dict(n)
    n.pop("_id", None)
    return n


# ============================ TAXONOMY ============================
@router.get("/taxonomy/public")
async def public_taxonomy():
    nodes = [_clean(d) async for d in db.construction_taxonomy.find({"is_publicly_visible": True})]
    return {"tree": build_tree(nodes), "count": len(nodes)}


@router.get("/taxonomy")
async def full_taxonomy(user=Depends(require_role("admin"))):
    nodes = [_clean(d) async for d in db.construction_taxonomy.find({})]
    return {
        "tree": build_tree(nodes),
        "count": len(nodes),
        "visible_count": sum(1 for n in nodes if n.get("is_publicly_visible")),
    }


@router.post("/taxonomy")
async def create_node(payload: dict = Body(...), user=Depends(require_role("admin"))):
    name = (payload.get("name") or "").strip()
    if len(name) < 2:
        raise HTTPException(400, "Numele trebuie să aibă minim 2 caractere")
    parent_id = payload.get("parent_id")
    if parent_id:
        parent = await db.construction_taxonomy.find_one({"id": parent_id})
        if not parent:
            raise HTTPException(404, "Nodul părinte nu există")
        if parent.get("depth_level", 0) >= 2:
            raise HTTPException(400, "Adâncime maximă 3 niveluri (categorie → subcategorie → serviciu)")
        depth = parent["depth_level"] + 1
        legacy = parent["legacy_category"]
    else:
        depth = 0
        legacy = payload.get("legacy_category") or slugify(name)
    siblings = await db.construction_taxonomy.count_documents({"parent_id": parent_id})
    doc = {
        "id": uuid.uuid4().hex,
        "name": name,
        "slug": slugify(name),
        "parent_id": parent_id,
        "depth_level": depth,
        "legacy_category": legacy,
        "is_active": True,
        "is_publicly_visible": False,
        "specialist_count": 0,
        "order": siblings,
        "source": "admin",
        "created_at": _now(),
        "updated_at": _now(),
    }
    await db.construction_taxonomy.insert_one({**doc})
    await refresh_category_visibility()
    fresh = await db.construction_taxonomy.find_one({"id": doc["id"]})
    return _clean(fresh)


@router.patch("/taxonomy/{node_id}")
async def patch_node(node_id: str, payload: dict = Body(...), user=Depends(require_role("admin"))):
    node = await db.construction_taxonomy.find_one({"id": node_id})
    if not node:
        raise HTTPException(404, "Nod inexistent")
    updates = {}
    if "name" in payload:
        name = (payload["name"] or "").strip()
        if len(name) < 2:
            raise HTTPException(400, "Nume invalid")
        updates["name"] = name
        updates["slug"] = slugify(name)
    if "is_active" in payload:
        updates["is_active"] = bool(payload["is_active"])
    if not updates:
        raise HTTPException(400, "Nimic de actualizat")
    updates["updated_at"] = _now()
    await db.construction_taxonomy.update_one({"id": node_id}, {"$set": updates})
    if "is_active" in updates:
        await refresh_category_visibility()
    fresh = await db.construction_taxonomy.find_one({"id": node_id})
    return _clean(fresh)


@router.delete("/taxonomy/{node_id}")
async def delete_node(node_id: str, user=Depends(require_role("admin"))):
    children = await db.construction_taxonomy.count_documents({"parent_id": node_id})
    if children > 0:
        raise HTTPException(409, f"Nodul are {children} sub-noduri — șterge-le sau mută-le mai întâi")
    res = await db.construction_taxonomy.delete_one({"id": node_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Nod inexistent")
    return {"deleted": True}


@router.post("/refresh-visibility")
async def refresh_visibility(user=Depends(require_role("admin"))):
    """Manual trigger — routed through Autonomy Orchestrator (playbook + ledger)."""
    from orchestrator.engine import emit_signal
    result = await emit_signal("category_visibility_refresh", {"trigger": f"manual:{user.get('email')}"})
    return result


@router.post("/seed")
async def force_seed(user=Depends(require_role("admin"))):
    out = await seed_construction_taxonomy()
    await refresh_category_visibility()
    return out


# ============================ OVERVIEW ============================
@router.get("/overview")
async def overview(user=Depends(require_role("admin"))):
    nodes = [_clean(d) async for d in db.construction_taxonomy.find({})]
    roots = [n for n in nodes if n.get("depth_level") == 0]
    from construction.taxonomy import get_specialist_counts, _requests_per_category
    counts = await get_specialist_counts()
    demand = await _requests_per_category()
    coverage = [
        {
            "legacy_category": r["legacy_category"],
            "name": r["name"],
            "specialists": counts.get(r["legacy_category"], 0),
            "requests_90d": demand.get(r["legacy_category"], 0),
            "visible": bool(r.get("is_publicly_visible")),
            "active": bool(r.get("is_active", True)),
        }
        for r in sorted(roots, key=lambda x: x.get("order", 0))
    ]
    hidden_with_potential = [c for c in coverage if c["specialists"] == 0 and c["requests_90d"] > 0]
    return {
        "total_nodes": len(nodes),
        "visible_nodes": sum(1 for n in nodes if n.get("is_publicly_visible")),
        "root_categories": len(roots),
        "roots_visible": sum(1 for r in roots if r.get("is_publicly_visible")),
        "coverage": coverage,
        "hidden_with_potential": hidden_with_potential,
    }


# ============================ PROJECT CENTRAL ============================
async def _query_projects(
    category: Optional[str], city: Optional[str], status: Optional[str],
    q: Optional[str], min_value: Optional[float], max_value: Optional[float],
    limit: int,
) -> list:
    query: dict = {}
    if category and category != "all":
        query["category"] = category
    if status and status != "all":
        query["status"] = status
    if q:
        rx = {"$regex": re.escape(q), "$options": "i"}
        query["$or"] = [{"title": rx}, {"client_name": rx}, {"specialist_name": rx}]
    if min_value is not None or max_value is not None:
        rng = {}
        if min_value is not None:
            rng["$gte"] = min_value
        if max_value is not None:
            rng["$lte"] = max_value
        query["budget_estimate"] = rng

    items = []
    async for d in db.requests.find(query).sort("created_at", -1).limit(int(limit) * 3):
        items.append(d)

    # Attach city from properties (batch)
    prop_ids = {d.get("property_id") for d in items if d.get("property_id")}
    cities = {}
    obj_ids = []
    for pid in prop_ids:
        try:
            obj_ids.append(ObjectId(pid))
        except Exception:  # noqa: BLE001
            pass
    if obj_ids:
        async for p in db.properties.find({"_id": {"$in": obj_ids}}, {"city": 1, "zone": 1}):
            cities[str(p["_id"])] = p.get("city") or p.get("zone") or ""

    out = []
    for d in items:
        row = {
            "id": str(d.get("_id")),
            "title": d.get("title"),
            "category": d.get("category"),
            "subcategory": d.get("subcategory"),
            "status": d.get("status"),
            "budget_estimate": d.get("budget_estimate"),
            "escrow_amount": d.get("escrow_amount"),
            "client_name": d.get("client_name"),
            "specialist_name": d.get("specialist_name"),
            "city": cities.get(d.get("property_id"), ""),
            "created_at": d.get("created_at"),
        }
        if city and city.lower() not in (row["city"] or "").lower():
            continue
        out.append(row)
        if len(out) >= limit:
            break
    return out


@router.get("/projects")
async def project_central(
    category: Optional[str] = None,
    city: Optional[str] = None,
    status: Optional[str] = None,
    q: Optional[str] = None,
    min_value: Optional[float] = Query(default=None),
    max_value: Optional[float] = Query(default=None),
    limit: int = 100,
    user=Depends(require_role("admin")),
):
    limit = max(1, min(int(limit), 500))
    items = await _query_projects(category, city, status, q, min_value, max_value, limit)
    return {"items": items, "count": len(items)}


@router.get("/projects/export")
async def export_projects_csv(
    category: Optional[str] = None,
    city: Optional[str] = None,
    status: Optional[str] = None,
    q: Optional[str] = None,
    min_value: Optional[float] = Query(default=None),
    max_value: Optional[float] = Query(default=None),
    user=Depends(require_role("admin")),
):
    items = await _query_projects(category, city, status, q, min_value, max_value, 2000)
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["ID", "Titlu", "Categorie", "Subcategorie", "Status", "Buget (RON)",
                     "Escrow (RON)", "Client", "Specialist", "Oraș", "Creat la"])
    for r in items:
        writer.writerow([r["id"], r["title"], r["category"], r.get("subcategory") or "",
                         r["status"], r.get("budget_estimate") or "", r.get("escrow_amount") or "",
                         r.get("client_name") or "", r.get("specialist_name") or "",
                         r.get("city") or "", r.get("created_at") or ""])
    buf.seek(0)
    fname = f"construction_projects_{datetime.now(timezone.utc).date().isoformat()}.csv"
    return StreamingResponse(
        iter([buf.getvalue().encode("utf-8-sig")]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={fname}"},
    )
