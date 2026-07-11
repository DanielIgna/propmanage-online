"""Meniu de navigare unificat (Desktop + Mobile), administrat din CMS.

Un singur sistem de navigare stocat în DB — colecția `site_menu` (doc key="main").
Public: GET /api/public/site-menu (doar iteme active; vizibilitatea o filtrează frontend-ul).
Admin: GET/PUT /api/admin/site-menu + POST reset la structura implicită.
"""
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Body, Depends, HTTPException, Request

from db import db
from deps import require_role

router = APIRouter(prefix="/api", tags=["site-menu"])
logger = logging.getLogger("propmanage.site_menu")

# visibility: "all" | "guests" (doar vizitatori) | "auth" (doar autentificați)
DEFAULT_MENU = [
    {"id": "acasa", "label": "Acasă", "href": "/", "icon": "Home", "active": True, "visibility": "all", "children": []},
    {"id": "servicii", "label": "Servicii", "href": "", "icon": "Layers", "active": True, "visibility": "all", "children": [
        {"id": "imobile_verificate", "label": "Imobile Verificate", "href": "/imobile-verificate", "icon": "BadgeCheck", "active": True, "visibility": "all"},
        {"id": "digital_twin", "label": "Digital Twin", "href": "/#twin", "icon": "Box", "active": True, "visibility": "all"},
        {"id": "design_interior", "label": "Design Interior", "href": "/design-interior", "icon": "Palette", "active": True, "visibility": "all"},
        {"id": "design_exterior", "label": "Design Exterior", "href": "/marketplace?categorie=design-exterior", "icon": "Trees", "active": True, "visibility": "all"},
        {"id": "arhitectura", "label": "Arhitectură", "href": "/marketplace?categorie=arhitectura", "icon": "Compass", "active": True, "visibility": "all"},
        {"id": "constructii", "label": "Construcții", "href": "/marketplace?categorie=constructii", "icon": "Hammer", "active": True, "visibility": "all"},
        {"id": "renovari", "label": "Renovări", "href": "/marketplace?categorie=renovari", "icon": "Paintbrush", "active": True, "visibility": "all"},
        {"id": "mobilier", "label": "Mobilier la comandă", "href": "/marketplace?categorie=mobilier", "icon": "Armchair", "active": True, "visibility": "all"},
        {"id": "instalatii", "label": "Instalații", "href": "/marketplace?categorie=instalatii", "icon": "Wrench", "active": True, "visibility": "all"},
        {"id": "amenajari", "label": "Amenajări", "href": "/marketplace?categorie=amenajari", "icon": "Brush", "active": True, "visibility": "all"},
        {"id": "specialisti", "label": "Specialiști", "href": "/marketplace", "icon": "Users", "active": True, "visibility": "all"},
        {"id": "consultanta", "label": "Consultanță", "href": "/marketplace?categorie=consultanta", "icon": "MessageCircle", "active": True, "visibility": "all"},
    ]},
    {"id": "proprietari", "label": "Pentru Proprietari", "href": "", "icon": "KeyRound", "active": True, "visibility": "all", "children": [
        {"id": "cum_functioneaza", "label": "Cum funcționează", "href": "/#journey", "icon": "PlayCircle", "active": True, "visibility": "all"},
        {"id": "beneficii", "label": "Beneficii", "href": "/de-ce-noi", "icon": "Sparkles", "active": True, "visibility": "all"},
        {"id": "tarife", "label": "Tarife", "href": "/preturi", "icon": "CircleDollarSign", "active": True, "visibility": "all"},
        {"id": "faq", "label": "Întrebări frecvente", "href": "/#faq", "icon": "HelpCircle", "active": True, "visibility": "all"},
    ]},
    {"id": "companie", "label": "Companie", "href": "", "icon": "Building2", "active": True, "visibility": "all", "children": [
        {"id": "despre", "label": "Despre noi", "href": "/de-ce-noi", "icon": "Info", "active": True, "visibility": "all"},
        {"id": "blog", "label": "Blog", "href": "/community", "icon": "BookOpen", "active": True, "visibility": "all"},
        {"id": "contact", "label": "Contact", "href": "mailto:contact@propmanage.ro", "icon": "Mail", "active": True, "visibility": "all"},
    ]},
    {"id": "cont_guest", "label": "Cont", "href": "", "icon": "UserCircle", "active": True, "visibility": "guests", "children": [
        {"id": "login", "label": "Autentificare", "href": "/login", "icon": "LogIn", "active": True, "visibility": "guests"},
        {"id": "register", "label": "Creează cont", "href": "/register", "icon": "UserPlus", "active": True, "visibility": "guests"},
    ]},
    {"id": "cont_auth", "label": "Contul meu", "href": "", "icon": "UserCircle", "active": True, "visibility": "auth", "children": [
        {"id": "dashboard", "label": "Dashboard", "href": "/dashboard", "icon": "LayoutDashboard", "active": True, "visibility": "auth"},
        {"id": "proiecte", "label": "Proiectele mele", "href": "/dashboard#proiecte", "icon": "FolderKanban", "active": True, "visibility": "auth"},
        {"id": "mesaje", "label": "Mesaje", "href": "/dashboard#mesaje", "icon": "MessageSquare", "active": True, "visibility": "auth"},
        {"id": "notificari", "label": "Notificări", "href": "/dashboard#notificari", "icon": "Bell", "active": True, "visibility": "auth"},
        {"id": "setari", "label": "Setări cont", "href": "/dashboard#setari", "icon": "Settings", "active": True, "visibility": "auth"},
        {"id": "logout", "label": "Logout", "href": "#logout", "icon": "LogOut", "active": True, "visibility": "auth"},
    ]},
]

_ALLOWED_KEYS = {"id", "label", "href", "icon", "active", "visibility", "children"}
_VISIBILITIES = {"all", "guests", "auth"}


def _sanitize_items(items: list, depth: int = 0) -> list:
    if depth > 1:
        return []
    out = []
    for it in items:
        if not isinstance(it, dict) or not str(it.get("label", "")).strip() or not str(it.get("id", "")).strip():
            continue
        clean = {
            "id": str(it["id"])[:60],
            "label": str(it["label"])[:80],
            "href": str(it.get("href") or "")[:300],
            "icon": str(it.get("icon") or "")[:40],
            "active": bool(it.get("active", True)),
            "visibility": it.get("visibility") if it.get("visibility") in _VISIBILITIES else "all",
            "children": _sanitize_items(it.get("children") or [], depth + 1),
        }
        out.append(clean)
    return out


async def _get_menu_doc() -> dict:
    doc = await db.site_menu.find_one({"key": "main"})
    if not doc:
        doc = {"key": "main", "items": DEFAULT_MENU, "updated_at": datetime.now(timezone.utc).isoformat()}
        await db.site_menu.insert_one(dict(doc))
    return doc


def _public_items(items: list) -> list:
    out = []
    for it in items:
        if not it.get("active", True):
            continue
        out.append({
            "id": it["id"], "label": it["label"], "href": it.get("href", ""),
            "icon": it.get("icon", ""), "visibility": it.get("visibility", "all"),
            "children": _public_items(it.get("children") or []),
        })
    return out


@router.get("/public/site-menu")
async def public_site_menu():
    doc = await _get_menu_doc()
    return {"items": _public_items(doc.get("items") or [])}


@router.post("/public/site-menu/track")
async def track_menu_click(request: Request, item_id: str = Body(..., embed=True), label: str = Body("", embed=True), href: str = Body("", embed=True)):
    await db.menu_clicks.insert_one({
        "item_id": str(item_id)[:60], "label": str(label)[:80], "href": str(href)[:300],
        "ts": datetime.now(timezone.utc).isoformat(),
        "authenticated": bool(request.cookies.get("access_token")),
        "tenant_id": "main",
    })
    return {"ok": True}


@router.get("/admin/site-menu/analytics")
async def menu_analytics(days: int = 30, _admin=Depends(require_role("admin"))):
    from datetime import timedelta
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    pipeline = [
        {"$match": {"ts": {"$gte": since}}},
        {"$group": {"_id": {"item_id": "$item_id", "label": "$label"}, "clicks": {"$sum": 1},
                    "auth_clicks": {"$sum": {"$cond": ["$authenticated", 1, 0]}}}},
        {"$sort": {"clicks": -1}},
        {"$limit": 20},
    ]
    rows = await db.menu_clicks.aggregate(pipeline).to_list(20)
    total = await db.menu_clicks.count_documents({"ts": {"$gte": since}})
    return {"days": days, "total_clicks": total, "top": [
        {"item_id": r["_id"]["item_id"], "label": r["_id"]["label"], "clicks": r["clicks"], "auth_clicks": r["auth_clicks"]}
        for r in rows
    ]}


@router.post("/admin/site-menu/auto-reorder")
async def set_auto_reorder(enabled: bool = Body(..., embed=True), admin=Depends(require_role("admin"))):
    await db.site_menu.update_one(
        {"key": "main"},
        {"$set": {"auto_reorder": bool(enabled), "updated_at": datetime.now(timezone.utc).isoformat(), "updated_by": admin.get("email")}},
        upsert=True,
    )
    return {"ok": True, "auto_reorder": bool(enabled)}


@router.post("/admin/site-menu/auto-reorder/run")
async def run_auto_reorder_now(_admin=Depends(require_role("admin"))):
    result = await menu_popularity_reorder_tick(force=True)
    return {"ok": True, **result}


async def menu_popularity_reorder_tick(force: bool = False) -> dict:
    """Autonomy: reordonează sub-serviciile din grupul «Servicii» după popularitate (click-uri 30z)."""
    from datetime import timedelta
    doc = await db.site_menu.find_one({"key": "main"})
    if not doc:
        return {"status": "skipped", "reason": "no menu"}
    if not force and not doc.get("auto_reorder", True):
        return {"status": "skipped", "reason": "auto_reorder disabled"}
    since = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    rows = await db.menu_clicks.aggregate([
        {"$match": {"ts": {"$gte": since}}},
        {"$group": {"_id": "$item_id", "clicks": {"$sum": 1}}},
    ]).to_list(500)
    clicks = {r["_id"]: r["clicks"] for r in rows}
    items = doc.get("items") or []
    changed = False
    for group in items:
        if group.get("id") != "servicii" or not group.get("children"):
            continue
        old_order = [c["id"] for c in group["children"]]
        group["children"] = sorted(group["children"], key=lambda c: -clicks.get(c["id"], 0))
        new_order = [c["id"] for c in group["children"]]
        changed = old_order != new_order
    if changed:
        await db.site_menu.update_one(
            {"key": "main"},
            {"$set": {"items": items, "updated_at": datetime.now(timezone.utc).isoformat(), "updated_by": "autonomy:menu_optimizer"}},
        )
    await db.playbook_executions.insert_one({
        "playbook_id": "menu_popularity_optimizer",
        "status": "applied" if changed else "no_change",
        "human_needed": False,
        "detail": {"clicks_30d": clicks, "reordered": changed},
        "ts": datetime.now(timezone.utc).isoformat(),
    })
    logger.info(f"[site-menu] popularity reorder: changed={changed}")
    return {"status": "applied" if changed else "no_change", "clicks_30d": clicks}


@router.get("/admin/site-menu")
async def admin_get_menu(_admin=Depends(require_role("admin"))):
    doc = await _get_menu_doc()
    return {"items": doc.get("items") or [], "updated_at": doc.get("updated_at"), "auto_reorder": doc.get("auto_reorder", True)}


@router.put("/admin/site-menu")
async def admin_put_menu(items: list = Body(..., embed=True), admin=Depends(require_role("admin"))):
    clean = _sanitize_items(items)
    if not clean:
        raise HTTPException(400, "Meniul nu poate fi gol.")
    await db.site_menu.update_one(
        {"key": "main"},
        {"$set": {"items": clean, "updated_at": datetime.now(timezone.utc).isoformat(), "updated_by": admin.get("email")}},
        upsert=True,
    )
    return {"ok": True, "items": clean}


@router.post("/admin/site-menu/reset")
async def admin_reset_menu(admin=Depends(require_role("admin"))):
    await db.site_menu.update_one(
        {"key": "main"},
        {"$set": {"items": DEFAULT_MENU, "updated_at": datetime.now(timezone.utc).isoformat(), "updated_by": admin.get("email")}},
        upsert=True,
    )
    return {"ok": True, "items": DEFAULT_MENU}
