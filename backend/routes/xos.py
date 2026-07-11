"""Experience OS (XOS) — Layout Builder, Dynamic UI Rules, Theme & Content Manager.

- xos_layouts: ordinea/vizibilitatea widget-urilor per suprafață (prima: client_home)
- ui_rules: reguli vizuale DACĂ [condiție] ATUNCI [ascunde/arată] element (meniu sau widget)
- site_content: banner anunțuri + override texte hero, editabile din admin
"""
import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Body, Depends, HTTPException, Request

from db import db
from deps import get_current_user, require_role

router = APIRouter(prefix="/api", tags=["xos"])
logger = logging.getLogger("propmanage.xos")

# ── Widget registry per suprafață ─────────────────────────────────────────────
SURFACES = {
    "client_home": {
        "label": "Dashboard Client · Acasă",
        "widgets": [
            {"id": "hero", "label": "Hero adaptiv", "desc": "Cardul principal contextual (proprietate / cerere activă / solicită)"},
            {"id": "quick_actions", "label": "Acțiuni rapide", "desc": "Grid 4: Solicită, Proprietatea, Lucrări, Întreabă AI"},
            {"id": "copilot", "label": "AI Copilot", "desc": "Asistent AI cu sumar și acțiuni recomandate"},
            {"id": "contextual", "label": "Noutăți pentru tine", "desc": "Carduri contextuale: oferte, plăți, confirmări"},
            {"id": "discover", "label": "Descoperă", "desc": "Carusel: Digital Twin, House Health, Ghid întreținere"},
        ],
    },
}


def _default_layout(surface: str) -> list:
    return [{"id": w["id"], "enabled": True} for w in SURFACES[surface]["widgets"]]


async def _get_layout(surface: str) -> list:
    if surface not in SURFACES:
        raise HTTPException(404, "Suprafață necunoscută.")
    doc = await db.xos_layouts.find_one({"surface": surface})
    if not doc:
        return _default_layout(surface)
    valid_ids = {w["id"] for w in SURFACES[surface]["widgets"]}
    items = [i for i in (doc.get("items") or []) if i.get("id") in valid_ids]
    saved_ids = {i["id"] for i in items}
    items += [{"id": w["id"], "enabled": True} for w in SURFACES[surface]["widgets"] if w["id"] not in saved_ids]
    return items


@router.get("/xos/layout/{surface}")
async def public_layout(surface: str):
    return {"surface": surface, "items": await _get_layout(surface)}


@router.get("/admin/xos/surfaces")
async def admin_surfaces(_admin=Depends(require_role("admin"))):
    return {"surfaces": [
        {"surface": k, "label": v["label"], "widgets": v["widgets"], "items": await _get_layout(k)}
        for k, v in SURFACES.items()
    ]}


@router.put("/admin/xos/layout/{surface}")
async def admin_put_layout(surface: str, items: list = Body(..., embed=True), admin=Depends(require_role("admin"))):
    if surface not in SURFACES:
        raise HTTPException(404, "Suprafață necunoscută.")
    valid_ids = {w["id"] for w in SURFACES[surface]["widgets"]}
    clean = [{"id": i["id"], "enabled": bool(i.get("enabled", True))} for i in items if isinstance(i, dict) and i.get("id") in valid_ids]
    if not clean:
        raise HTTPException(400, "Layout gol.")
    await db.xos_layouts.update_one(
        {"surface": surface},
        {"$set": {"items": clean, "updated_at": datetime.now(timezone.utc).isoformat(), "updated_by": admin.get("email")}},
        upsert=True,
    )
    return {"ok": True, "items": clean}


@router.post("/admin/xos/layout/{surface}/reset")
async def admin_reset_layout(surface: str, _admin=Depends(require_role("admin"))):
    if surface not in SURFACES:
        raise HTTPException(404, "Suprafață necunoscută.")
    await db.xos_layouts.delete_one({"surface": surface})
    return {"ok": True, "items": _default_layout(surface)}


# ── Dynamic UI Rules ──────────────────────────────────────────────────────────
_RULE_FIELDS = {"role", "verified", "projects_completed", "account_age_days"}
_RULE_OPS = {"eq", "neq", "gte", "lte"}


def _sanitize_rules(rules: list) -> list:
    out = []
    for r in rules:
        if not isinstance(r, dict) or r.get("target_type") not in ("menu", "widget") or not str(r.get("target_id", "")).strip():
            continue
        conds = []
        for c in r.get("conditions") or []:
            if isinstance(c, dict) and c.get("field") in _RULE_FIELDS and c.get("op") in _RULE_OPS:
                conds.append({"field": c["field"], "op": c["op"], "value": c.get("value")})
        out.append({
            "id": str(r.get("id") or uuid.uuid4().hex[:10]),
            "name": str(r.get("name") or "Regulă")[:100],
            "target_type": r["target_type"],
            "target_id": str(r["target_id"])[:60],
            "action": r.get("action") if r.get("action") in ("hide", "show_if") else "hide",
            "conditions": conds,
            "active": bool(r.get("active", True)),
        })
    return out


async def _get_rules() -> list:
    doc = await db.ui_rules.find_one({"key": "main"})
    return (doc or {}).get("rules") or []


def _cond_match(cond: dict, ctx: dict) -> bool:
    actual = ctx.get(cond["field"])
    val = cond.get("value")
    if cond["field"] == "verified":
        val = str(val).lower() in ("true", "1", "da", "yes")
    elif cond["field"] in ("projects_completed", "account_age_days"):
        try:
            val = float(val)
            actual = float(actual or 0)
        except (TypeError, ValueError):
            return False
    op = cond["op"]
    if op == "eq":
        return actual == val
    if op == "neq":
        return actual != val
    if op == "gte":
        return actual >= val
    if op == "lte":
        return actual <= val
    return False


async def _user_ctx(request: Request) -> dict:
    try:
        user = await get_current_user(request)
    except HTTPException:
        user = None
    if not user:
        return {"role": "guest", "verified": False, "projects_completed": 0, "account_age_days": 0}
    age_days = 0
    try:
        created = datetime.fromisoformat(str(user.get("created_at", "")).replace("Z", "+00:00"))
        age_days = (datetime.now(timezone.utc) - created).days
    except (ValueError, TypeError):
        pass
    projects = await db.requests.count_documents({"client_id": user.get("id"), "status": "confirmed"})
    return {
        "role": user.get("role", "guest"),
        "verified": bool(user.get("verified")),
        "projects_completed": projects,
        "account_age_days": age_days,
    }


@router.get("/ui-rules/my")
async def my_ui_rules(request: Request):
    rules = [r for r in await _get_rules() if r.get("active")]
    if not rules:
        return {"hidden": []}
    ctx = await _user_ctx(request)
    hidden = []
    for r in rules:
        match = all(_cond_match(c, ctx) for c in r["conditions"]) if r["conditions"] else True
        if (r["action"] == "hide" and match) or (r["action"] == "show_if" and not match):
            hidden.append(f"{r['target_type']}:{r['target_id']}")
    return {"hidden": hidden}


@router.get("/admin/ui-rules")
async def admin_get_rules(_admin=Depends(require_role("admin"))):
    return {"rules": await _get_rules()}


@router.put("/admin/ui-rules")
async def admin_put_rules(rules: list = Body(..., embed=True), admin=Depends(require_role("admin"))):
    clean = _sanitize_rules(rules)
    await db.ui_rules.update_one(
        {"key": "main"},
        {"$set": {"rules": clean, "updated_at": datetime.now(timezone.utc).isoformat(), "updated_by": admin.get("email")}},
        upsert=True,
    )
    return {"ok": True, "rules": clean}


# ── Theme & Content Manager ───────────────────────────────────────────────────
DEFAULT_CONTENT = {
    "banner": {"active": False, "text": "🎉 Ofertă de lansare: primul proiect de design interior cu 20% reducere!", "link": "/design-interior", "link_label": "Vezi oferta", "variant": "promo"},
    "hero": {"title1": "", "title2": "", "title3": "", "subtitle": ""},
    "entries": [],
}


async def _get_content() -> dict:
    doc = await db.site_content.find_one({"key": "main"})
    if not doc:
        return dict(DEFAULT_CONTENT)
    return {
        "banner": {**DEFAULT_CONTENT["banner"], **(doc.get("banner") or {})},
        "hero": {**DEFAULT_CONTENT["hero"], **(doc.get("hero") or {})},
        "entries": doc.get("entries") or [],
    }


@router.get("/public/site-content")
async def public_content():
    return await _get_content()


@router.get("/admin/site-content")
async def admin_get_content(_admin=Depends(require_role("admin"))):
    return await _get_content()


@router.put("/admin/site-content")
async def admin_put_content(payload: dict = Body(...), admin=Depends(require_role("admin"))):
    banner = payload.get("banner") or {}
    hero = payload.get("hero") or {}
    entries = [
        {"key": str(e.get("key", ""))[:80], "value": str(e.get("value", ""))[:2000]}
        for e in (payload.get("entries") or []) if isinstance(e, dict) and str(e.get("key", "")).strip()
    ]
    clean = {
        "banner": {
            "active": bool(banner.get("active")),
            "text": str(banner.get("text", ""))[:300],
            "link": str(banner.get("link", ""))[:300],
            "link_label": str(banner.get("link_label", ""))[:60],
            "variant": banner.get("variant") if banner.get("variant") in ("promo", "info", "warning") else "info",
        },
        "hero": {k: str(hero.get(k, ""))[:300] for k in ("title1", "title2", "title3", "subtitle")},
        "entries": entries,
    }
    await db.site_content.update_one(
        {"key": "main"},
        {"$set": {**clean, "updated_at": datetime.now(timezone.utc).isoformat(), "updated_by": admin.get("email")}},
        upsert=True,
    )
    return {"ok": True, **clean}
