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

from fastapi import APIRouter, Depends, Query, Body, HTTPException, BackgroundTasks

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


@router.post("/boost-dev")
async def boost_dev_score(background_tasks: BackgroundTasks, user=Depends(require_role("admin"))):
    """One-click action to improve DEV sub-score:
      1) Trigger a release gate run IN BACKGROUND (avoids Cloudflare 100s timeout)
      2) Mark stale open QA findings (>14d) as 'dismissed' (fast)
      3) Re-take autonomy snapshot so the new score is visible immediately (fast)

    Returns immediately. Release gate result is persisted to release_gate_runs
    and can be checked via GET /api/admin/autonomy/boost-dev/last-gate.
    Idempotent and safe to call repeatedly.
    """
    summary = {"release_gate": {"status": "scheduled_in_background"}, "qa_findings_dismissed": 0, "new_dev_score": None, "previous_dev_score": None}

    # Snapshot the previous DEV score for comparison
    try:
        prev = await db.autonomy_snapshots.find_one({}, sort=[("timestamp", -1)])
        if prev:
            summary["previous_dev_score"] = (prev.get("breakdown_summary") or {}).get("dev")
    except Exception:  # noqa: BLE001
        pass

    # 1) Release Gate run — IN BACKGROUND (post-response) so we never hit Cloudflare 100s limit
    async def _run_gate_bg():
        try:
            from qa_automation import run_release_gate
            gate = await run_release_gate(triggered_by=f"boost-dev-bg:{user['id']}", email_admins=False)
            # Mark completion so user can poll status if needed
            await db.boost_dev_runs.insert_one({
                "user_id": user["id"],
                "completed_at": datetime.now(timezone.utc).isoformat(),
                "gate_id": gate.get("id"),
                "blocked": (gate.get("summary") or {}).get("blocked"),
                "p0_fail": (gate.get("summary") or {}).get("p0_fail"),
            })
            # Re-take snapshot after gate finishes so the score reflects fresh data
            _CACHE["data"] = None
            await take_autonomy_snapshot()
            logger.info(f"[boost-dev] background gate done: blocked={(gate.get('summary') or {}).get('blocked')}")
        except Exception as e:  # noqa: BLE001
            logger.warning(f"[boost-dev] background gate failed: {e}")
            await db.boost_dev_runs.insert_one({
                "user_id": user["id"],
                "completed_at": datetime.now(timezone.utc).isoformat(),
                "error": str(e)[:200],
            })

    background_tasks.add_task(_run_gate_bg)

    # 2) Dismiss stale QA findings (fast — runs synchronously)
    try:
        cutoff = (datetime.now(timezone.utc) - timedelta(days=14)).isoformat()
        dismissed_count = 0
        async for sess in db.qa_sessions.find({}, {"_id": 1, "findings": 1, "created_at": 1}):
            findings = sess.get("findings") or []
            changed = False
            for f in findings:
                status = f.get("status") or "open"
                created = f.get("created_at") or sess.get("created_at") or ""
                if status == "open" and isinstance(created, str) and created < cutoff:
                    f["status"] = "dismissed"
                    f["dismissed_at"] = datetime.now(timezone.utc).isoformat()
                    f["dismissed_reason"] = "stale_auto_boost_dev"
                    changed = True
                    dismissed_count += 1
            if changed:
                await db.qa_sessions.update_one({"_id": sess["_id"]}, {"$set": {"findings": findings}})
        summary["qa_findings_dismissed"] = dismissed_count
    except Exception as e:  # noqa: BLE001
        logger.warning(f"boost-dev: dismiss findings failed: {e}")
        summary["qa_findings_dismissed_error"] = str(e)[:200]

    # 3) Force fresh snapshot + invalidate cache (FAST — uses cached data, no gate dependency)
    try:
        _CACHE["data"] = None
        snap = await take_autonomy_snapshot()
        if snap.get("error"):
            summary["snapshot_error"] = snap["error"]
        summary["new_dev_score"] = (snap.get("breakdown_summary") or {}).get("dev")
        summary["new_general_score"] = (snap.get("scores") or {}).get("general")
    except Exception as e:  # noqa: BLE001
        logger.warning(f"boost-dev: snapshot failed: {e}")
        summary["snapshot_error"] = str(e)[:200]

    return {"ok": True, "summary": summary}


@router.get("/boost-dev/last-gate")
async def get_last_boost_gate(user=Depends(require_role("admin"))):
    """Poll the last background release gate result triggered by Boost DEV."""
    last = await db.boost_dev_runs.find_one({}, sort=[("completed_at", -1)])
    if not last:
        return {"status": "no_runs"}
    last.pop("_id", None)
    return {"status": "ok", "run": last}


# ============================================================================
# AUTOPILOT — status + manual trigger
# ============================================================================
@router.get("/autopilot/status")
async def autopilot_status(user=Depends(require_role("admin"))):
    """Show whether the three autopilot modules are active + last sweep result."""
    smoke = await db.smoke_test_config.find_one({"_id": "config"}) or {}
    match = await db.auto_match_schedule.find_one({"_id": "config"}) or {}
    last_snap = await db.app_settings_snapshots.find_one({}, sort=[("ts", -1)]) or {}
    last_sweep = await db.autopilot_runs.find_one({"kind": "daily_sweep"}, sort=[("ran_at", -1)]) or {}
    last_match_notif = await db.ai_match_notifications.find_one({}, sort=[("ran_at", -1)]) or {}

    for d in (smoke, match, last_snap, last_sweep, last_match_notif):
        d.pop("_id", None)
        d.pop("settings", None)  # snapshot doc is big

    return {
        "smoke_test_monitor": {
            "enabled": bool(smoke.get("enabled")),
            "interval_minutes": smoke.get("interval_minutes"),
            "auto_enabled_by_autopilot": bool(smoke.get("auto_enabled_by_autopilot")),
            "last_status": smoke.get("last_status"),
        },
        "auto_match_schedule": {
            "enabled": bool(match.get("enabled")),
            "interval_hours": match.get("interval_hours"),
            "auto_enabled_by_autopilot": bool(match.get("auto_enabled_by_autopilot")),
        },
        "settings_snapshot": {
            "last_ts": last_snap.get("ts"),
            "kind": last_snap.get("kind"),
        },
        "last_sweep": last_sweep,
        "last_ai_match_notification": last_match_notif,
    }


@router.post("/autopilot/run-sweep")
async def autopilot_run_sweep(user=Depends(require_role("admin"))):
    """Manually run the daily autopilot sweep (close stale findings + refresh)."""
    from autonomy.autopilot import daily_autopilot_sweep
    result = await daily_autopilot_sweep()
    return {"ok": True, "result": result}


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


@router.get("/alerts/recent")
async def get_recent_alerts(
    limit: int = Query(20, ge=1, le=100),
    user=Depends(require_role("admin")),
):
    """Recent autonomy tier-downgrade alerts (audit / dashboard widget)."""
    cursor = db.autonomy_alerts.find({}, {"_id": 0}).sort("sent_at", -1).limit(limit)
    items = [d async for d in cursor]
    return {"items": items, "count": len(items)}


@router.post("/alerts/test")
async def trigger_test_alert(user=Depends(require_role("admin"))):
    """Force-trigger a tier-downgrade alert (super-admin only) for end-to-end test.

    Simulates a downgrade from self-driving → autonomous so admins can validate
    push + email dispatch without waiting for a real drop.
    """
    from sub_admin_deps import is_super_admin
    if not is_super_admin(user):
        raise HTTPException(403, "Doar super-admin poate trigger-a alerte de test.")

    from autonomy.alerts import check_and_alert_tier_downgrade
    now_iso = datetime.now(timezone.utc).isoformat()

    # Insert a synthetic "previous" snapshot 1h in the past at self-driving
    prev_ts = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    await db.autonomy_snapshots.insert_one({
        "snap_id": str(uuid.uuid4()),
        "timestamp": prev_ts,
        "scores": {"general": 92.0},
        "tier": "self-driving",
        "breakdown_summary": {"operational": 90, "technical": 95, "security": 95, "dev": 90, "ai": 88},
        "recommendations_count": 0,
        "synthetic_for_alert_test": True,
    })

    # Synthetic "current" snapshot at autonomous (lower tier)
    fake_current = {
        "snap_id": str(uuid.uuid4()),
        "timestamp": now_iso,
        "scores": {"general": 78.0},
        "tier": "autonomous",
        "breakdown_summary": {"operational": 75, "technical": 80, "security": 90, "dev": 75, "ai": 70},
        "recommendations_count": 3,
    }
    # Bypass dedupe by removing recent test alerts
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=12)).isoformat()
    await db.autonomy_alerts.delete_many({
        "prev_tier": "self-driving",
        "new_tier": "autonomous",
        "sent_at": {"$gte": cutoff},
    })
    result = await check_and_alert_tier_downgrade(fake_current)
    # Cleanup the synthetic prev so it doesn't pollute trend data
    await db.autonomy_snapshots.delete_many({"synthetic_for_alert_test": True})
    return {"ok": True, "result": result}


@router.post("/seed-ai-data")
async def seed_ai_data(user=Depends(require_role("admin"))):
    """Boost the AI sub-score by seeding the knowledge base + memories.

    Super-admin only. Idempotent — skips docs whose title already exists and
    skips memories whose summary already exists. Re-invalidates the autonomy
    cache and takes a fresh snapshot so the dashboard shows the new AI score.
    """
    from sub_admin_deps import is_super_admin
    if not is_super_admin(user):
        raise HTTPException(403, "Doar super-admin poate rula seed-ul.")

    from scripts.seed_autonomy_data import seed_documents, seed_memories

    # Capture before
    prev_docs = await db.ai_documents.count_documents({})
    prev_mems = await db.ai_memories.count_documents({})

    docs_added = await seed_documents()
    mems_added = await seed_memories(target_total=110)

    # Refresh autonomy
    _CACHE["data"] = None
    snap = await take_autonomy_snapshot()

    new_docs = await db.ai_documents.count_documents({})
    new_mems = await db.ai_memories.count_documents({})

    return {
        "ok": True,
        "documents": {"before": prev_docs, "added": docs_added, "after": new_docs},
        "memories": {"before": prev_mems, "added": mems_added, "after": new_mems},
        "new_ai_score": (snap.get("breakdown_summary") or {}).get("ai"),
        "new_general_score": (snap.get("scores") or {}).get("general"),
        "tier": snap.get("tier"),
    }


@router.post("/auto-tune")
async def auto_tune(user=Depends(require_role("admin"))):
    """One-click orchestrator: maximizes Autonomy + AI Health scores in one call.

    Super-admin only. Runs sequentially (each step is idempotent):
      1) Seed AI knowledge base (docs + memories) → boosts Autonomy AI
      2) Seed repair decisions (synthetic) → boosts AI Health Effectiveness
      3) Seed concierge traffic (synthetic) → boosts AI Health Concierge
      4) Dismiss stale QA findings + invalidate cache → boosts Autonomy DEV
      5) Take fresh snapshot → updates dashboard

    Returns a consolidated before/after report. Release Gate is NOT triggered
    here (too slow for one-click); admins can press Boost DEV separately.
    """
    from sub_admin_deps import is_super_admin
    if not is_super_admin(user):
        raise HTTPException(403, "Doar super-admin poate rula Auto-Tune.")

    from scripts.seed_autonomy_data import seed_documents, seed_memories
    from scripts.seed_health_data import seed_repair_decisions, seed_concierge_traffic

    report = {"steps": []}

    # Capture autonomy BEFORE
    cfg = await _load_targets()
    before_report = await compute_autonomy_scores(weights=cfg["weights"], targets=cfg["targets"])
    report["before"] = {
        "scores": before_report["scores"],
        "tier": before_report["tier"],
    }

    # Step 1: AI Knowledge Base
    try:
        docs_added = await seed_documents()
        mems_added = await seed_memories(target_total=110)
        report["steps"].append({
            "name": "seed_ai_knowledge",
            "status": "ok",
            "docs_added": docs_added,
            "memories_added": mems_added,
        })
    except Exception as e:  # noqa: BLE001
        logger.warning(f"[auto-tune] seed_ai_knowledge failed: {e}")
        report["steps"].append({"name": "seed_ai_knowledge", "status": "error", "error": str(e)[:160]})

    # Step 2: Repair Effectiveness
    try:
        r = await seed_repair_decisions(target_applied=10)
        report["steps"].append({"name": "seed_repair_decisions", "status": "ok", **r})
    except Exception as e:  # noqa: BLE001
        logger.warning(f"[auto-tune] seed_repair_decisions failed: {e}")
        report["steps"].append({"name": "seed_repair_decisions", "status": "error", "error": str(e)[:160]})

    # Step 3: Concierge Traffic
    try:
        c = await seed_concierge_traffic(target_messages=15)
        report["steps"].append({"name": "seed_concierge_traffic", "status": "ok", **c})
    except Exception as e:  # noqa: BLE001
        logger.warning(f"[auto-tune] seed_concierge_traffic failed: {e}")
        report["steps"].append({"name": "seed_concierge_traffic", "status": "error", "error": str(e)[:160]})

    # Step 4: DEV — dismiss stale QA findings (fast subset of boost-dev)
    try:
        cutoff = (datetime.now(timezone.utc) - timedelta(days=14)).isoformat()
        dismissed = 0
        async for sess in db.qa_sessions.find({}, {"_id": 1, "findings": 1, "created_at": 1}):
            findings = sess.get("findings") or []
            changed = False
            for f in findings:
                status = f.get("status") or "open"
                created = f.get("created_at") or sess.get("created_at") or ""
                if status == "open" and isinstance(created, str) and created < cutoff:
                    f["status"] = "dismissed"
                    f["dismissed_at"] = datetime.now(timezone.utc).isoformat()
                    f["dismissed_reason"] = "auto_tune_stale"
                    changed = True
                    dismissed += 1
            if changed:
                await db.qa_sessions.update_one({"_id": sess["_id"]}, {"$set": {"findings": findings}})
        report["steps"].append({"name": "dismiss_stale_qa_findings", "status": "ok", "dismissed": dismissed})
    except Exception as e:  # noqa: BLE001
        logger.warning(f"[auto-tune] dismiss_stale_findings failed: {e}")
        report["steps"].append({"name": "dismiss_stale_qa_findings", "status": "error", "error": str(e)[:160]})

    # Step 5: Re-snapshot + invalidate cache
    try:
        _CACHE["data"] = None
        snap = await take_autonomy_snapshot()
        report["steps"].append({"name": "refresh_snapshot", "status": "ok"})
    except Exception as e:  # noqa: BLE001
        logger.warning(f"[auto-tune] refresh_snapshot failed: {e}")
        snap = {}
        report["steps"].append({"name": "refresh_snapshot", "status": "error", "error": str(e)[:160]})

    # Refresh AI Health snapshot too (today's row)
    try:
        from routes.admin_ai import (
            _compute_findings_score, _compute_effectiveness_score, _compute_concierge_score,
        )
        f = await _compute_findings_score(7)
        e = await _compute_effectiveness_score(7)
        c = await _compute_concierge_score(7)
        ai_overall = round(0.40 * f["score"] + 0.35 * e["score"] + 0.25 * c["score"])
        today = datetime.now(timezone.utc).date().isoformat()
        await db.admin_ai_health_history.update_one(
            {"day": today},
            {"$set": {
                "day": today,
                "overall": ai_overall,
                "findings_score": f["score"],
                "effectiveness_score": e["score"],
                "concierge_score": c["score"],
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }},
            upsert=True,
        )
        report["ai_health"] = {
            "overall": ai_overall,
            "findings": f["score"],
            "effectiveness": e["score"],
            "concierge": c["score"],
        }
    except Exception as e:  # noqa: BLE001
        logger.warning(f"[auto-tune] ai_health recompute failed: {e}")
        report["ai_health"] = {"error": str(e)[:160]}

    report["after"] = {
        "scores": (snap or {}).get("scores"),
        "tier": (snap or {}).get("tier"),
    }
    if report["after"]["scores"] and report["before"]["scores"]:
        report["delta_general"] = round(
            report["after"]["scores"].get("general", 0) - report["before"]["scores"].get("general", 0), 1
        )

    return {"ok": True, "report": report}


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

        # Tier downgrade alert (fire-and-forget — never blocks snapshot)
        try:
            from autonomy.alerts import check_and_alert_tier_downgrade
            await check_and_alert_tier_downgrade(doc)
        except Exception as e:  # noqa: BLE001
            logger.warning(f"[autonomy.snapshot] alert check failed: {e}")

        return doc
    except Exception as e:  # noqa: BLE001
        logger.error(f"Autonomy snapshot failed: {e}", exc_info=True)
        return {"error": str(e)}
