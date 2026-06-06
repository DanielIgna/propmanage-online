"""PropManage — Autonomy Engine REST API.

Endpoints (admin-only):
  GET  /api/admin/autonomy/score      — Live snapshot (cached 5 min)
  GET  /api/admin/autonomy/history    — Trend from autonomy_snapshots
  POST /api/admin/autonomy/snapshot   — Force snapshot now (debug)
  GET  /api/admin/autonomy/targets    — Get configurable targets/weights
  PUT  /api/admin/autonomy/targets    — Update targets/weights
"""
import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query, Body, HTTPException

from db import db
from deps import require_role
from autonomy.engine import compute_autonomy_scores, DEFAULT_WEIGHTS, DEFAULT_TARGETS

logger = logging.getLogger("propmanage.autonomy_routes")
router = APIRouter(prefix="/api/admin/autonomy", tags=["admin-autonomy"])

# Simple in-memory cache (5 min TTL)
_CACHE = {"data": None, "ts": None}
_CACHE_TTL_SECONDS = 300


async def _load_targets() -> dict:
    doc = await db.autonomy_targets.find_one({"_id": "config"})
    if not doc:
        return {"weights": DEFAULT_WEIGHTS, "targets": DEFAULT_TARGETS}
    return {
        "weights": doc.get("weights") or DEFAULT_WEIGHTS,
        "targets": doc.get("targets") or DEFAULT_TARGETS,
    }


@router.get("/score")
async def get_autonomy_score(user=Depends(require_role("admin"))):
    """Live autonomy score — cached 5 min."""
    now = datetime.now(timezone.utc)
    if _CACHE["data"] and _CACHE["ts"] and (now - _CACHE["ts"]).total_seconds() < _CACHE_TTL_SECONDS:
        return {**_CACHE["data"], "cached": True}

    cfg = await _load_targets()
    report = await compute_autonomy_scores(weights=cfg["weights"], targets=cfg["targets"])
    _CACHE["data"] = report
    _CACHE["ts"] = now
    return {**report, "cached": False}


@router.get("/history")
async def get_autonomy_history(
    days: int = Query(30, ge=1, le=365),
    user=Depends(require_role("admin")),
):
    """Returns daily snapshots from autonomy_snapshots collection."""
    since = datetime.now(timezone.utc) - timedelta(days=days)
    cursor = db.autonomy_snapshots.find(
        {"timestamp": {"$gte": since.isoformat()}},
        {"_id": 0, "scores": 1, "timestamp": 1, "tier": 1},
    ).sort("timestamp", 1)
    items = [doc async for doc in cursor]
    return {"items": items, "days": days, "count": len(items)}


@router.post("/snapshot")
async def force_snapshot(user=Depends(require_role("admin"))):
    """Force a snapshot now — useful for testing / first-time bootstrap."""
    snap = await take_autonomy_snapshot()
    return snap


# ============================================================================
# V2: TASK GENERATION (from recommendations → admin_todos)
# ============================================================================
_PRIORITY_TODO_MAP = {"critical": "high", "high": "high", "medium": "medium", "low": "low"}
_AREA_LABEL = {
    "operational": "Operațional",
    "technical": "Tehnic",
    "security": "Securitate",
    "dev": "Dev",
    "ai": "AI",
}


@router.post("/generate-tasks")
async def generate_tasks(
    payload: dict = Body(default={}),
    user=Depends(require_role("admin")),
):
    """Materialize current recommendations as actionable TODOs in admin_todos.

    Body (optional):
      - max_items: int (default 6 — same as engine's hard cap)
      - min_impact: float (default 0.0 — filter low-impact recs)
      - dry_run: bool (default false — preview without insert)

    De-duplicates by text (case-insensitive). Returns list of injected + skipped.
    """
    max_items = int(payload.get("max_items", 6))
    min_impact = float(payload.get("min_impact", 0.0))
    dry_run = bool(payload.get("dry_run", False))

    # Always use a fresh report (no cache) so generated tasks reflect reality
    cfg = await _load_targets()
    report = await compute_autonomy_scores(weights=cfg["weights"], targets=cfg["targets"])
    recs = report.get("recommendations", []) or []
    recs = [r for r in recs if float(r.get("impact_points", 0)) >= min_impact][:max_items]

    now_iso = datetime.now(timezone.utc).isoformat()
    injected = []
    skipped = []
    for r in recs:
        area = r.get("area", "")
        area_label = _AREA_LABEL.get(area, area)
        priority = _PRIORITY_TODO_MAP.get(r.get("priority", "medium"), "medium")
        text = f"[Autonomy · {area_label}] {r.get('action','(no action)')}"
        text = text[:500]
        # de-dupe (case-insensitive)
        existing = await db.admin_todos.find_one({"text": {"$regex": f"^{text[:60]}", "$options": "i"}})
        if existing:
            skipped.append({"text": text, "reason": "duplicate"})
            continue
        todo_doc = {
            "id": str(uuid.uuid4()),
            "text": text,
            "priority": priority,
            "done": False,
            "source": f"autonomy_v2:{area}",
            "topic_title": f"Autonomy Engine · {area_label}",
            "created_at": now_iso,
            "meta": {
                "impact_points": r.get("impact_points"),
                "tier_at_creation": report.get("tier"),
                "general_score_at_creation": report.get("scores", {}).get("general"),
            },
        }
        if not dry_run:
            await db.admin_todos.insert_one({**todo_doc})
        injected.append({k: v for k, v in todo_doc.items() if k != "_id"})

    return {
        "ok": True,
        "dry_run": dry_run,
        "injected": injected,
        "skipped": skipped,
        "counts": {"injected": len(injected), "skipped": len(skipped), "considered": len(recs)},
        "general_score": report.get("scores", {}).get("general"),
        "tier": report.get("tier"),
    }


@router.get("/targets")
async def get_targets(user=Depends(require_role("admin"))):
    cfg = await _load_targets()
    return cfg


@router.put("/targets")
async def update_targets(
    payload: dict = Body(...),
    user=Depends(require_role("admin")),
):
    weights = payload.get("weights")
    targets = payload.get("targets")
    if weights:
        expected = set(DEFAULT_WEIGHTS.keys())
        provided = set(weights.keys())
        if provided != expected:
            raise HTTPException(400, f"Weights must include exactly these keys: {sorted(expected)}")
        # Normalize: weights must sum to ~1.0
        total = sum(weights.values())
        if total <= 0:
            raise HTTPException(400, "Sum of weights must be > 0")
        weights = {k: v / total for k, v in weights.items()}
    update = {"updated_at": datetime.now(timezone.utc).isoformat(), "updated_by": user["id"]}
    if weights:
        update["weights"] = weights
    if targets:
        update["targets"] = targets
    await db.autonomy_targets.update_one({"_id": "config"}, {"$set": update}, upsert=True)
    # Invalidate cache
    _CACHE["data"] = None
    return await _load_targets()


# ============================================================================
# Snapshot job (called from APScheduler)
# ============================================================================
async def take_autonomy_snapshot() -> dict:
    """Compute current autonomy + persist to autonomy_snapshots.

    Called daily at 03:15 Europe/Bucharest by the scheduler.
    Safe to call multiple times per day (creates separate doc per call).
    """
    try:
        cfg = await _load_targets()
        report = await compute_autonomy_scores(weights=cfg["weights"], targets=cfg["targets"])
        doc = {
            "snap_id": str(uuid.uuid4()),
            "timestamp": report["computed_at"],
            "scores": report["scores"],
            "tier": report["tier"],
            "breakdown_summary": {
                k: report["breakdown"][k]["score"]
                for k in ("operational", "technical", "security", "dev", "ai")
            },
            "recommendations_count": len(report["recommendations"]),
        }
        await db.autonomy_snapshots.insert_one(doc)
        logger.info(f"Autonomy snapshot recorded: general={report['scores']['general']} tier={report['tier']}")
        # Cleanup: keep max 400 snapshots
        cur = db.autonomy_snapshots.find({}, {"_id": 1}).sort("timestamp", -1).skip(400)
        old_ids = [d["_id"] async for d in cur]
        if old_ids:
            await db.autonomy_snapshots.delete_many({"_id": {"$in": old_ids}})
        doc.pop("_id", None)
        return doc
    except Exception as e:  # noqa: BLE001
        logger.error(f"Autonomy snapshot failed: {e}", exc_info=True)
        return {"error": str(e)}
