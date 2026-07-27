"""Repair Center API — Health Repair Engine (PM-AI-REPAIR-001).

  GET  /api/admin/repair-center/status   — scoruri live + motoare + ultima rulare
  POST /api/admin/repair-center/run      — rulează ciclul (body: {domains: [...]} opțional)
  GET  /api/admin/repair-center/runs     — istoric rulări
"""
import logging

from fastapi import APIRouter, Body, Depends, HTTPException

from db import db
from deps import require_role
from health_repair import DOMAIN_ENGINES, run_repair_cycle

logger = logging.getLogger("propmanage.repair_center")
router = APIRouter(prefix="/api/admin/repair-center", tags=["repair-center"])


@router.get("/status")
async def repair_status(user=Depends(require_role("admin"))):
    from routes.enterprise_health import _get_formulas, _collect_metrics, _domain_result, DOMAIN_LABELS
    formulas = await _get_formulas()
    metrics = await _collect_metrics()
    last_run = await db.health_repair_runs.find_one({}, {"_id": 0}, sort=[("ts", -1)])
    last_by_domain = {r["domain"]: r for r in (last_run or {}).get("results", [])}

    domains = []
    for key in DOMAIN_ENGINES:
        f = formulas.get(key)
        if not f or f.get("status") != "active":
            continue
        res = _domain_result(f, metrics)
        lr = last_by_domain.get(key)
        domains.append({
            "domain": key,
            "label": DOMAIN_LABELS.get(key, key),
            "score": res["score"],
            "warning_threshold": f.get("warning_threshold", 80),
            "has_engine": True,
            "last_repair": {"ts": last_run["ts"], "problems": len(lr["problems"]),
                            "actions": len(lr["actions"]), "delta": lr.get("delta")} if lr else None,
        })
    domains.sort(key=lambda d: d["score"])
    return {"domains": domains, "last_run": last_run,
            "runs_total": await db.health_repair_runs.count_documents({})}


@router.post("/run")
async def repair_run(payload: dict = Body(default={}), user=Depends(require_role("admin"))):
    domains = payload.get("domains")
    if domains is not None:
        if not isinstance(domains, list) or not domains:
            raise HTTPException(400, "domains trebuie să fie o listă nevidă")
        invalid = [d for d in domains if d not in DOMAIN_ENGINES]
        if invalid:
            raise HTTPException(400, f"Domenii invalide: {invalid}. Valide: {list(DOMAIN_ENGINES)}")
    # Rulare în background — ciclul complet poate depăși timeout-ul gateway-ului.
    import asyncio
    asyncio.create_task(run_repair_cycle(domains=domains, trigger=f"manual:{user.get('email')}"))
    return {"started": True, "domains": domains or "all"}


@router.get("/runs")
async def repair_runs(limit: int = 10, user=Depends(require_role("admin"))):
    limit = max(1, min(int(limit), 50))
    items = [d async for d in db.health_repair_runs.find({}, {"_id": 0}).sort("ts", -1).limit(limit)]
    return {"items": items}
