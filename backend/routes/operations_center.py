"""Operations Center — inima operațională până la PMF (Directivă COO Operations Center).

Optimizat pentru VIZIBILITATE și EXECUȚIE, nu automatizare:
- pipeline unificat de leads cu stages complete + acțiuni rapide
- plăți manuale (cash/transfer/POS) până la Stripe LIVE → deblocheză venitul real
- Specialist Gap Engine v1 (cereri marketplace fără specialist, pe categorii)
- raport COO zilnic + One Win Per Day log
"""
import logging
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Body, Depends, HTTPException
from bson import ObjectId
from bson.errors import InvalidId

import leads_store
from db import db
from deps import require_role

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/admin/operations", tags=["operations-center"])

PIPELINE_STAGES = [
    "new", "contacted", "qualified", "audit_scheduled", "audit_completed",
    "offer_sent", "waiting_decision", "payment_received", "project_active",
    "completed", "follow_up", "lost",
]
MANUAL_METHODS = ["cash", "bank_transfer", "pos", "payment_link", "manual_stripe", "other"]
OPEN_REQ_EXCLUDE = ["completed", "cancelled", "closed", "rejected"]


@router.get("")
async def operations_center(user=Depends(require_role("admin"))):
    now = datetime.now(timezone.utc)
    today_iso = now.isoformat()[:10]

    leads = await leads_store.list_leads(None, None, None, 300)

    ve_orders_pending = []
    async for o in db.verified_estate_orders.find({"status": "pending"}).sort("created_at", -1).limit(30):
        ve_orders_pending.append({
            "id": str(o["_id"]), "session_id": o.get("session_id"), "package": o.get("package"),
            "label": o.get("label", ""), "amount_ron": o.get("amount_ron"),
            "contact_name": o.get("contact_name", ""), "contact_email": o.get("contact_email", ""),
            "contact_phone": o.get("contact_phone", ""), "property_address": o.get("property_address", ""),
            "created_at": str(o.get("created_at", "")), "demo_mode": o.get("demo_mode", False),
        })

    inquiries_new = await db.verified_estate_inquiries.count_documents({"status": "new"})
    external_new = await db.verified_estate_external_requests.count_documents({"status": "new"})

    # Specialist Gap Engine v1
    gaps = []
    async for g in db.requests.aggregate([
        {"$match": {"status": {"$nin": OPEN_REQ_EXCLUDE},
                    "$or": [{"specialist_id": None}, {"specialist_id": ""}, {"specialist_id": {"$exists": False}}]}},
        {"$group": {"_id": "$category", "count": {"$sum": 1},
                    "est_lost_revenue": {"$sum": {"$ifNull": ["$budget_estimate", 0]}}}},
        {"$sort": {"count": -1}}, {"$limit": 10},
    ]):
        gaps.append({
            "category": g["_id"] or "necategorizat", "waiting_requests": g["count"],
            "est_lost_revenue_ron": round(g["est_lost_revenue"], 0),
            "recommendation": f"Recrutează specialiști: {g['_id'] or 'necategorizat'}",
        })
    unassigned_total = sum(g["waiting_requests"] for g in gaps)

    # COO daily report
    new_leads_today = sum(1 for l in leads if str(l.get("created_at", ""))[:10] == today_iso)
    revenue_pending = round(sum(o["amount_ron"] or 0 for o in ve_orders_pending if not o["demo_mode"]), 2)
    payments_received = await db.verified_estate_orders.count_documents({"status": "paid", "demo_mode": {"$ne": True}})
    stage_new = [l for l in leads if l.get("stage") == "new"]
    oldest_waiting = min(stage_new, key=lambda l: str(l.get("created_at", "")), default=None)

    if payments_received == 0 and revenue_pending == 0 and len(stage_new) == 0:
        bottleneck = "Pipeline gol — lipsesc vizitatorii/leads. Distribuie /scorul-casei."
        top_action = "Postează calculatorul Scorul Casei într-un grup Facebook local (15 min)."
    elif len(stage_new) > 0:
        bottleneck = f"{len(stage_new)} leads în stage NEW fără contact."
        top_action = f"Contactează cel mai vechi lead: {oldest_waiting.get('name') if oldest_waiting else '—'}."
    elif revenue_pending > 0:
        bottleneck = f"{revenue_pending:.0f} RON în comenzi neplătite."
        top_action = "Urmărește comenzile pending — oferă plată manuală (transfer/cash)."
    else:
        bottleneck = "Niciun bottleneck operațional intern."
        top_action = "Cere review + referral de la ultimul client servit."

    coo_report = {
        "new_leads_today": new_leads_today,
        "open_leads": len([l for l in leads if l.get("stage") not in ("completed", "lost", "won")]),
        "revenue_pending_ron": revenue_pending,
        "payments_received_real": payments_received,
        "requests_without_specialist": unassigned_total,
        "top_demand_category": gaps[0]["category"] if gaps else None,
        "oldest_waiting_lead": {"name": oldest_waiting.get("name"), "created_at": str(oldest_waiting.get("created_at"))} if oldest_waiting else None,
        "biggest_bottleneck": bottleneck,
        "top_founder_action": top_action,
    }

    win_today = await db.daily_wins.find_one({"day": today_iso})
    yesterday = (now - timedelta(days=1)).isoformat()[:10]
    win_yesterday = await db.daily_wins.find_one({"day": yesterday})

    return {
        "generated_at": now.isoformat(),
        "stages": PIPELINE_STAGES,
        "manual_methods": MANUAL_METHODS,
        "leads": leads,
        "ve_orders_pending": ve_orders_pending,
        "inquiries_new": inquiries_new,
        "external_requests_new": external_new,
        "gaps": gaps,
        "coo_report": coo_report,
        "one_win": {
            "today": {"text": win_today.get("text"), "day": today_iso} if win_today else None,
            "yesterday": {"text": win_yesterday.get("text"), "day": yesterday} if win_yesterday else None,
        },
    }


@router.patch("/leads/{lead_id}")
async def update_lead(lead_id: str, payload: dict = Body(...), user=Depends(require_role("admin"))):
    try:
        oid = ObjectId(lead_id)
    except InvalidId:
        raise HTTPException(404, "Lead inexistent")
    updates = {}
    stage = payload.get("stage")
    if stage:
        if stage not in PIPELINE_STAGES:
            raise HTTPException(400, f"Stage invalid. Permise: {', '.join(PIPELINE_STAGES)}")
        updates["stage"] = stage
    if payload.get("next_action") is not None:
        updates["next_action"] = str(payload["next_action"])[:300]
    ops = {"$set": {**updates, "updated_at": datetime.now(timezone.utc).isoformat()}}
    note = (payload.get("note") or "").strip()
    if note:
        ops["$push"] = {"notes": {"text": note[:500], "by": str(user.get("id")),
                                  "at": datetime.now(timezone.utc).isoformat()}}
    res = await db.leads.update_one({"_id": oid}, ops)
    if res.matched_count == 0:
        raise HTTPException(404, "Lead inexistent")
    return {"ok": True}


@router.post("/manual-payment")
async def register_manual_payment(payload: dict = Body(...), user=Depends(require_role("admin"))):
    """Plată manuală VERIFIED (cash/transfer/POS) pentru comenzi VE — până la Stripe LIVE."""
    order_id = payload.get("order_id")
    method = payload.get("method")
    reference = (payload.get("reference") or "").strip()[:200]
    if method not in MANUAL_METHODS:
        raise HTTPException(400, f"Metodă invalidă. Permise: {', '.join(MANUAL_METHODS)}")
    try:
        oid = ObjectId(order_id)
    except (InvalidId, TypeError):
        raise HTTPException(404, "Comandă inexistentă")
    order = await db.verified_estate_orders.find_one({"_id": oid})
    if not order:
        raise HTTPException(404, "Comandă inexistentă")
    if order.get("status") == "paid":
        raise HTTPException(400, "Comanda este deja plătită")

    await db.verified_estate_orders.update_one(
        {"_id": oid},
        {"$set": {"payment_method": method, "payment_reference": reference,
                  "manual_payment": True, "manual_verified": True,
                  "verified_by": str(user.get("id")), "demo_mode": False}},
    )
    from routes.verified_estate import mark_order_paid
    await mark_order_paid(order.get("session_id"))
    logger.info(f"[Ops] Manual payment VERIFIED: order={order_id} method={method} by={user.get('id')}")
    return {"ok": True, "order_id": order_id, "method": method}


@router.post("/win")
async def set_daily_win(payload: dict = Body(...), user=Depends(require_role("admin"))):
    """One Win Per Day — înregistrează victoria zilei."""
    text = (payload.get("text") or "").strip()[:300]
    if not text:
        raise HTTPException(400, "Textul victoriei este obligatoriu")
    day = datetime.now(timezone.utc).isoformat()[:10]
    await db.daily_wins.update_one(
        {"day": day},
        {"$set": {"text": text, "by": str(user.get("id")), "at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return {"ok": True, "day": day}
