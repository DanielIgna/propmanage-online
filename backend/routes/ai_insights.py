"""AI Insights v2 — analiză LLM (Claude) per modul, cu cache 6h (control cost).

GET /api/admin/insights/llm?module={analytics|finance|marketplace|overview|control_tower}
Returnează {bullets, alerts, recommendations, generated_at, cached}.
"""
import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException

from db import db
from deps import require_role

router = APIRouter(prefix="/api/admin/insights", tags=["ai-insights"])
logger = logging.getLogger("propmanage.ai_insights")

CACHE_HOURS = 6
MODULES = {"analytics", "finance", "marketplace", "overview", "control_tower"}


async def _context_for(module: str, user: dict) -> dict:
    if module == "analytics":
        from routes.analytics_growth import analytics_overview
        d = await analytics_overview("week", "", "", user)
        return {"kpi": d["kpi"], "kpi_prev": d.get("kpi_prev"), "sources": d["sources"][:5], "funnel": d["funnel"]}
    if module == "finance":
        total_wallet = 0
        async for row in db.users.aggregate([{"$group": {"_id": None, "s": {"$sum": "$wallet_balance"}}}]):
            total_wallet = row["s"]
        tx = []
        since = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        async for row in db.transactions.aggregate([
            {"$match": {"created_at": {"$gte": since}}},
            {"$group": {"_id": "$type", "count": {"$sum": 1}, "total": {"$sum": "$amount"}}},
        ]):
            tx.append({"type": row["_id"], "count": row["count"], "total": row["total"]})
        return {"total_wallet": total_wallet, "tx_by_type_30d": tx}
    if module == "marketplace":
        by_status = {}
        async for row in db.marketplace_partners.aggregate([{"$group": {"_id": "$status", "n": {"$sum": 1}}}]):
            by_status[row["_id"]] = row["n"]
        leads = await db.partner_leads.count_documents({})
        return {"partners_by_status": by_status, "total_leads": leads}
    if module == "overview" or module == "control_tower":
        since = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        ledger = await db.orchestrator_ledger.find({"test": {"$ne": True}, "ts": {"$gte": since}}, {"_id": 0, "playbook_name": 1, "escalated": 1}).to_list(1000)
        by_pb = {}
        for x in ledger:
            k = x.get("playbook_name") or "—"
            by_pb.setdefault(k, {"runs": 0, "escalated": 0})
            by_pb[k]["runs"] += 1
            by_pb[k]["escalated"] += 1 if x.get("escalated") else 0
        return {
            "pulse": {
                "open_requests": await db.requests.count_documents({"status": "open"}),
                "active_jobs": await db.requests.count_documents({"status": {"$in": ["accepted", "in_progress"]}}),
                "kyc_pending": await db.users.count_documents({"kyc_status": "pending"}),
                "disputes_open": await db.disputes.count_documents({"status": "open"}),
            },
            "playbook_activity_7d": by_pb,
        }
    return {}


@router.get("/llm")
async def llm_insights(module: str, force: bool = False, user=Depends(require_role("admin"))):
    if module not in MODULES:
        raise HTTPException(400, f"Modul necunoscut. Valide: {sorted(MODULES)}")

    cutoff = (datetime.now(timezone.utc) - timedelta(hours=CACHE_HOURS)).isoformat()
    if not force:
        cached = await db.ai_insights_cache.find_one({"module": module, "generated_at": {"$gte": cutoff}}, {"_id": 0})
        if cached:
            return {**cached["result"], "generated_at": cached["generated_at"], "cached": True}

    context = await _context_for(module, user)
    try:
        from orchestrator.llm import claude_json
        result = await claude_json(
            system=("Ești analistul de business al platformei PropManage (marketplace de lucrări + administrare "
                    "imobile, România). Primești datele unui modul și livrezi insights EXECUTABILE, concrete, în română. "
                    "Răspunde STRICT JSON: {\"bullets\": [max 4 constatări scurte], \"alerts\": [max 2 riscuri urgente sau gol], "
                    "\"recommendations\": [max 3 acțiuni concrete]}. Fii specific cu cifrele din date, fără generalități."),
            prompt=f"Modul: {module}\nDate curente:\n{context}\n\nAnalizează și livrează insights.",
            session_prefix=f"insights-{module}",
        )
        if not isinstance(result, dict) or "bullets" not in result:
            raise ValueError("Răspuns LLM invalid")
        payload = {
            "bullets": (result.get("bullets") or [])[:4],
            "alerts": (result.get("alerts") or [])[:2],
            "recommendations": (result.get("recommendations") or [])[:3],
        }
    except Exception as e:  # noqa: BLE001
        logger.warning(f"[ai-insights] LLM fail ({module}): {e}")
        raise HTTPException(503, "Analiza AI e temporar indisponibilă — reîncearcă în câteva minute.")

    now = datetime.now(timezone.utc).isoformat()
    await db.ai_insights_cache.update_one(
        {"module": module},
        {"$set": {"module": module, "generated_at": now, "result": payload}},
        upsert=True,
    )
    return {**payload, "generated_at": now, "cached": False}
