"""Daily digest email builders + scheduler runner (19:00 Europe/Bucharest)."""
import os
import asyncio
import logging
from typing import Optional
from datetime import datetime, timezone, timedelta
from bson import ObjectId

from db import db
from core_utils import serialize_doc
from services import send_email, send_web_push

DIGEST_FROM_NAME = "PropManage"
BUCHAREST_TZ_NAME = "Europe/Bucharest"


def _digest_card_html(title: str, items: list, empty_text: str) -> str:
    """Render a section card. items = list of {label, sub?, link?}"""
    if not items:
        body = f'<p style="color:#888;font-size:13px;margin:8px 0 0 0">{empty_text}</p>'
    else:
        rows = []
        for it in items:
            sub = f'<div style="color:#888;font-size:12px;margin-top:2px">{it["sub"]}</div>' if it.get("sub") else ""
            rows.append(
                f'<div style="padding:10px 12px;background:#0f0f10;border-radius:10px;margin-bottom:6px">'
                f'<div style="color:#e7e5e4;font-size:13px;font-weight:500">{it["label"]}</div>{sub}</div>'
            )
        body = "".join(rows)
    return (
        f'<div style="background:#161617;border-radius:14px;padding:16px;margin-bottom:14px">'
        f'<div style="color:#d4ff3a;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">{title}</div>'
        f'{body}</div>'
    )


async def _build_client_digest(user: dict) -> Optional[dict]:
    uid = user["id"]
    active = await db.requests.find({"client_id": uid, "status": {"$in": ["assigned", "in_progress", "completed"]}}).sort("created_at", -1).to_list(20)
    open_reqs = await db.requests.find({"client_id": uid, "status": "open"}).sort("created_at", -1).to_list(10)
    today_start = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    notifs_unread = await db.notifications.count_documents({"user_id": uid, "read": False})
    notifs_today = await db.notifications.count_documents({"user_id": uid, "created_at": {"$gte": today_start}})

    if not (active or open_reqs) and notifs_unread == 0:
        return None

    active_items = [{
        "label": r.get("title", "—"),
        "sub": f"Status: {r.get('status','?')} · Specialist: {r.get('specialist_name') or '—'}"
    } for r in active]
    open_items = [{
        "label": r.get("title", "—"),
        "sub": f"Buget: {r.get('budget_estimate','—')} RON · Categoria: {r.get('category','—')}"
    } for r in open_reqs]
    cards = [
        _digest_card_html(f"Lucrări active ({len(active_items)})", active_items, "Nicio lucrare activă."),
        _digest_card_html(f"Cereri deschise în așteptare oferte ({len(open_items)})", open_items, "Nicio cerere deschisă."),
    ]
    summary = f"Ai {notifs_unread} notificări necitite · {notifs_today} mesaje primite astăzi."
    return {"summary": summary, "cards": "".join(cards), "cta_label": "Vezi dashboard-ul", "cta_link": "/client"}


async def _build_specialist_digest(user: dict) -> Optional[dict]:
    uid = user["id"]
    today_start = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    spec_query = {"status": "open"}
    if user.get("specialty"):
        spec_query["$or"] = [{"category": user["specialty"]}, {"category": None}]
    open_leads = await db.requests.find(spec_query).sort("created_at", -1).to_list(15)
    new_24h = [r for r in open_leads if r.get("created_at", "") >= today_start]
    active = await db.requests.find({"specialist_id": uid, "status": {"$in": ["assigned", "in_progress", "completed"]}}).sort("assigned_at", -1).to_list(20)

    if not (new_24h or active):
        return None

    new_items = [{
        "label": r.get("title", "—"),
        "sub": f"{r.get('property_name','—')} · Buget: {r.get('budget_estimate','—')} RON · {r.get('priority','normal')}"
    } for r in new_24h[:10]]
    active_items = [{
        "label": r.get("title", "—"),
        "sub": f"Status: {r.get('status','?')} · Client: {r.get('client_name','—')}"
    } for r in active]
    cards = [
        _digest_card_html(f"Lead-uri noi (ultimele 24h) ({len(new_items)})", new_items, "Niciun lead nou."),
        _digest_card_html(f"Lucrările mele active ({len(active_items)})", active_items, "Nicio lucrare activă."),
    ]
    summary = f"Sold lead-uri: {user.get('wallet_balance', 0):.0f} RON · Tier {user.get('tier','ENTRY')}"
    return {"summary": summary, "cards": "".join(cards), "cta_label": "Vezi oportunitățile", "cta_link": "/specialist"}


async def _build_admin_digest(user: dict) -> Optional[dict]:
    open_disputes = await db.disputes.find({"status": "open"}).sort("created_at", -1).to_list(20)
    open_nc = await db.nonconformities.find({"status": "open"}).sort("created_at", -1).to_list(20)
    pending_specs = await db.users.count_documents({"role": "specialist", "verified": {"$ne": True}})
    today_start = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    events_24h = await db.activity_events.count_documents({"created_at": {"$gte": today_start}})

    if not (open_disputes or open_nc) and pending_specs == 0:
        return None

    disp_items = [{
        "label": d.get("reason", "Dispută")[:80],
        "sub": f"Cerere: {d.get('request_id','—')[-6:]} · {d.get('opened_by_role','?')}"
    } for d in open_disputes]
    nc_items = [{
        "label": f"[{n.get('severity','?').upper()}] {n.get('reason','')[:80]}",
        "sub": f"De la operator: {n.get('operator_name','—')} · {n.get('target_type','?')}"
    } for n in open_nc]
    cards = [
        _digest_card_html(f"Dispute deschise ({len(disp_items)})", disp_items, "Nicio dispută deschisă."),
        _digest_card_html(f"Sesizări operator nerezolvate ({len(nc_items)})", nc_items, "Nicio sesizare deschisă."),
    ]
    summary = f"Specialiști în așteptare verificare: {pending_specs} · Evenimente platformă astăzi: {events_24h}"
    return {"summary": summary, "cards": "".join(cards), "cta_label": "Deschide Admin", "cta_link": "/admin"}


async def _build_operator_digest(user: dict) -> Optional[dict]:
    pending = await db.twins.find({"status": "pending_validation"}).sort("requested_at", -1).to_list(20)
    revision = await db.twins.find({"status": "needs_revision"}).sort("requested_at", -1).to_list(10)
    if not (pending or revision):
        return None
    pending_items = []
    for t in pending:
        prop = await db.properties.find_one({"_id": ObjectId(t["property_id"])}) if t.get("property_id") else None
        pending_items.append({
            "label": (prop or {}).get("name", "Proprietate"),
            "sub": f"{(prop or {}).get('address','—')} · Camere: {len(t.get('rooms') or [])}"
        })
    cards = [
        _digest_card_html(f"Twins în validare ({len(pending_items)})", pending_items, "Niciun twin în coadă."),
        _digest_card_html(f"Twins necesită revizie ({len(revision)})", [], f"{len(revision)} twin-uri așteaptă client.") if revision else "",
    ]
    summary = f"Coadă lucru: {len(pending)} twin-uri noi · {len(revision)} în revizie"
    return {"summary": summary, "cards": "".join(cards), "cta_label": "Deschide cozile", "cta_link": "/operator"}


DIGEST_BUILDERS = {
    "client": _build_client_digest,
    "specialist": _build_specialist_digest,
    "admin": _build_admin_digest,
    "operator": _build_operator_digest,
}


async def send_digest_to_user(user: dict) -> bool:
    """Build + send digest email to a single user. Returns True if email was sent."""
    role = user.get("role")
    builder = DIGEST_BUILDERS.get(role)
    if not builder or not user.get("email") or user.get("deleted") or user.get("digest_disabled"):
        return False
    digest = await builder(user)
    if not digest:
        return False
    today_str = datetime.now(timezone.utc).strftime("%d %B %Y")
    html = (
        f'<div style="font-family:Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a0a0b;padding:24px;color:#e7e5e4">'
        f'<div style="text-align:center;margin-bottom:24px">'
        f'<div style="display:inline-block;background:#d4ff3a;color:#000;padding:6px 14px;border-radius:20px;font-size:11px;font-weight:bold;letter-spacing:1px;text-transform:uppercase">{DIGEST_FROM_NAME}</div>'
        f'</div>'
        f'<h1 style="font-family:Georgia,serif;color:#fff;font-size:24px;margin:0 0 4px 0">Rezumat zilnic</h1>'
        f'<p style="color:#888;font-size:13px;margin:0 0 4px 0">{today_str}</p>'
        f'<p style="color:#d4ff3a;font-size:13px;margin:8px 0 20px 0">{digest["summary"]}</p>'
        f'{digest["cards"]}'
        f'<div style="text-align:center;margin-top:24px">'
        f'<a href="{os.environ.get("FRONTEND_URL", "https://propmanage.io")}{digest["cta_link"]}" style="display:inline-block;background:#d4ff3a;color:#000;text-decoration:none;padding:12px 24px;border-radius:24px;font-weight:bold;font-size:14px">{digest["cta_label"]}</a>'
        f'</div>'
        f'<p style="color:#666;font-size:11px;margin-top:32px;text-align:center">'
        f'Vrei să oprești aceste rezumate? Setări → Notificări zilnice → OFF.'
        f'</p></div>'
    )
    await send_email(user["email"], f"Rezumat zilnic PropManage · {today_str}", html)
    asyncio.create_task(send_web_push(user["id"], "Rezumat zilnic", digest["summary"], digest["cta_link"]))
    return True


async def run_daily_digests() -> dict:
    """Iterate over all eligible users and send digests. Returns counts per role."""
    counts = {"client": 0, "specialist": 0, "admin": 0, "operator": 0, "skipped": 0}
    async for user in db.users.find({"role": {"$in": list(DIGEST_BUILDERS.keys())}, "deleted": {"$ne": True}}):
        u = serialize_doc(user)
        sent = await send_digest_to_user(u)
        if sent:
            counts[u.get("role")] = counts.get(u.get("role"), 0) + 1
        else:
            counts["skipped"] += 1
    logging.info(f"Daily digests sent: {counts}")
    return counts
