"""AI Command Center — unified daily feed + Top 5 AI recommendations.

The admin no longer hunts for information: the platform surfaces priorities.
Feed = today's stats + warnings (requests >48h, escrow held/frozen, incomplete
specialist profiles, open disputes). Claude turns the snapshot into 5 actions.
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends

from db import db
from deps import require_role

router = APIRouter(prefix="/api/admin/command-center", tags=["command-center"])
logger = logging.getLogger("propmanage.command_center")

WAIT_STATUSES = ["open", "pending"]


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime) -> str:
    return dt.isoformat()


async def _build_feed() -> dict[str, Any]:
    now = _now()
    day_ago = _iso(now - timedelta(hours=24))
    d7 = _iso(now - timedelta(days=7))
    d14 = _iso(now - timedelta(days=14))
    h48 = _iso(now - timedelta(hours=48))

    new_requests_24h = await db.requests.count_documents({"created_at": {"$gte": day_ago}})
    new_users_24h = await db.users.count_documents({"created_at": {"$gte": day_ago}})
    completed_24h = await db.requests.count_documents({"completed_at": {"$gte": day_ago}})
    req_7d = await db.requests.count_documents({"created_at": {"$gte": d7}})
    req_prev_7d = await db.requests.count_documents({"created_at": {"$gte": d14, "$lt": d7}})
    marketplace_trend = round((req_7d - req_prev_7d) / req_prev_7d * 100, 1) if req_prev_7d else None

    waiting_48h = await db.requests.count_documents({"status": {"$in": WAIT_STATUSES}, "created_at": {"$lt": h48}})

    escrow_held_amount = 0.0
    escrow_held_count = 0
    escrow_frozen_count = 0
    async for r in db.requests.find({"escrow_status": {"$in": ["held", "frozen"]}}, {"escrow_status": 1, "escrow_amount": 1}):
        if r["escrow_status"] == "held":
            escrow_held_count += 1
            escrow_held_amount += float(r.get("escrow_amount") or 0)
        else:
            escrow_frozen_count += 1

    incomplete_specialists = await db.users.count_documents({
        "role": "specialist",
        "$or": [{"specialty": None}, {"specialty": {"$exists": False}}, {"verified": {"$ne": True}}],
    })
    open_disputes = await db.disputes.count_documents({"status": {"$in": ["open", "pending", "in_review"]}})
    pending_payments = await db.payment_transactions.count_documents({"payment_status": {"$in": ["pending", "initiated"]}})

    stats = [
        {"key": "new_requests", "label": "Cereri noi (24h)", "value": new_requests_24h, "icon": "inbox"},
        {"key": "new_users", "label": "Utilizatori noi (24h)", "value": new_users_24h, "icon": "users"},
        {"key": "completed", "label": "Lucrări finalizate (24h)", "value": completed_24h, "icon": "check"},
        {"key": "trend", "label": "Marketplace 7z vs 7z", "value": f"{'+' if (marketplace_trend or 0) >= 0 else ''}{marketplace_trend}%" if marketplace_trend is not None else "—", "icon": "trend"},
    ]

    warnings = []
    if waiting_48h:
        warnings.append({"key": "waiting_48h", "label": f"{waiting_48h} cereri așteaptă de peste 48h fără specialist", "severity": "high"})
    if escrow_held_amount:
        warnings.append({"key": "escrow_held", "label": f"Escrow de {escrow_held_amount:,.0f} lei neconfirmat ({escrow_held_count} cereri)", "severity": "high"})
    if escrow_frozen_count:
        warnings.append({"key": "escrow_frozen", "label": f"{escrow_frozen_count} escrow-uri înghețate (dispute active)", "severity": "high"})
    if open_disputes:
        warnings.append({"key": "disputes", "label": f"{open_disputes} dispute deschise necesită triaj", "severity": "medium"})
    if incomplete_specialists:
        warnings.append({"key": "incomplete_spec", "label": f"{incomplete_specialists} specialiști cu profil incomplet (fără specialitate sau neverificați)", "severity": "medium"})
    if pending_payments:
        warnings.append({"key": "pending_pay", "label": f"{pending_payments} plăți inițiate dar nefinalizate", "severity": "low"})

    return {
        "generated_at": _iso(now),
        "stats": stats,
        "warnings": warnings,
        "raw": {
            "new_requests_24h": new_requests_24h, "new_users_24h": new_users_24h,
            "completed_24h": completed_24h, "req_7d": req_7d, "req_prev_7d": req_prev_7d,
            "marketplace_trend_pct": marketplace_trend, "waiting_48h": waiting_48h,
            "escrow_held_amount": escrow_held_amount, "escrow_held_count": escrow_held_count,
            "escrow_frozen_count": escrow_frozen_count, "incomplete_specialists": incomplete_specialists,
            "open_disputes": open_disputes, "pending_payments": pending_payments,
        },
    }


@router.get("/feed")
async def command_feed(_admin=Depends(require_role("admin"))):
    return await _build_feed()


@router.post("/recommendations")
async def generate_recommendations(_admin=Depends(require_role("admin"))):
    feed = await _build_feed()
    raw = feed["raw"]
    try:
        from orchestrator.llm import claude_json
        system = (
            "Ești directorul de operațiuni AI al PropManage — marketplace românesc de servicii pentru proprietate "
            "cu escrow, specialiști verificați și lead fees. Primești snapshot-ul operațional zilnic și returnezi "
            "TOP 5 acțiuni concrete pe care adminul să le facă AZI, ordonate după impact. "
            "Răspunde STRICT JSON: {\"recommendations\": [{\"action\": str RO imperativ ≤120c, "
            "\"why\": str RO ≤150c, \"severity\": \"high|medium|low\", \"module\": str (ex: Escrow, Marketplace, Specialiști)}]}. "
            "Fii specific cifrelor primite, nu generic."
        )
        prompt = (
            f"Snapshot azi: cereri noi 24h={raw['new_requests_24h']}, useri noi={raw['new_users_24h']}, "
            f"finalizate={raw['completed_24h']}, trend marketplace 7z={raw['marketplace_trend_pct']}%, "
            f"cereri >48h fără specialist={raw['waiting_48h']}, escrow neconfirmat={raw['escrow_held_amount']:.0f} lei "
            f"({raw['escrow_held_count']} cereri), escrow înghețat={raw['escrow_frozen_count']}, "
            f"dispute deschise={raw['open_disputes']}, specialiști profil incomplet={raw['incomplete_specialists']}, "
            f"plăți nefinalizate={raw['pending_payments']}."
        )
        result = await claude_json(system=system, prompt=prompt, session_prefix="command-center")
        recos = [
            {
                "action": str(r.get("action") or "")[:160],
                "why": str(r.get("why") or "")[:200],
                "severity": r.get("severity") if r.get("severity") in ("high", "medium", "low") else "medium",
                "module": str(r.get("module") or "")[:40],
            }
            for r in (result.get("recommendations") or [])[:5] if isinstance(r, dict) and r.get("action")
        ]
        if not recos:
            raise ValueError("Zero recomandări valide")
        ai_generated = True
    except Exception as e:  # noqa: BLE001
        logger.warning(f"[command-center] LLM fail: {e} — fallback")
        recos = [
            {"action": f"Rezolvă cele {raw['waiting_48h']} cereri care așteaptă >48h", "why": "Cererile neonorate duc la abandon.", "severity": "high", "module": "Marketplace"},
            {"action": f"Confirmă escrow-ul de {raw['escrow_held_amount']:.0f} lei", "why": "Banii blocați erodează încrederea.", "severity": "high", "module": "Escrow"},
            {"action": f"Contactează {raw['incomplete_specialists']} specialiști cu profil incomplet", "why": "Profilele incomplete reduc conversia.", "severity": "medium", "module": "Specialiști"},
        ]
        ai_generated = False

    doc = {"generated_at": _iso(_now()), "recommendations": recos, "ai_generated": ai_generated, "snapshot": raw}
    await db.command_center_recos.update_one({"_id": "latest"}, {"$set": doc}, upsert=True)
    return doc


@router.get("/recommendations/latest")
async def latest_recommendations(_admin=Depends(require_role("admin"))):
    doc = await db.command_center_recos.find_one({"_id": "latest"}, {"_id": 0})
    return doc or {"recommendations": None}
