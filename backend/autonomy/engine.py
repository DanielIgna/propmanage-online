"""Autonomy Engine — deterministic compute functions.

Reads existing MongoDB collections, returns sub-scores + breakdown + recommendations.
No writes, no LLM calls. Safe to call frequently (cached upstream).
"""
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

from db import db

logger = logging.getLogger("propmanage.autonomy")

# ============================================================================
# Default weights (can be overridden via `autonomy_targets` doc)
# ============================================================================
DEFAULT_WEIGHTS = {
    "operational": 0.30,
    "technical": 0.25,
    "security": 0.20,
    "dev": 0.10,
    "ai": 0.15,
}

DEFAULT_TARGETS = {
    "general": 90,
    "operational": 95,
    "technical": 85,
    "security": 90,
    "dev": 75,
    "ai": 80,
}


def _clamp(v: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, v))


def _pct(numer: int, denom: int, fallback: float = 0.0) -> float:
    if denom <= 0:
        return fallback
    return _clamp((numer / denom) * 100.0)


# ============================================================================
# Sub-score: OPERATIONAL
# ============================================================================
async def _score_operational() -> dict:
    """Operational autonomy = how much of the day-to-day handles itself."""
    since_30d = datetime.now(timezone.utc) - timedelta(days=30)

    # Signal 1: % requests auto-matched (have specialist_id within 24h of created_at)
    total_requests = await db.requests.count_documents({"created_at": {"$gte": since_30d.isoformat()}})
    auto_matched = await db.requests.count_documents({
        "created_at": {"$gte": since_30d.isoformat()},
        "specialist_id": {"$exists": True, "$ne": None},
    })
    auto_matched_pct = _pct(auto_matched, total_requests, fallback=50.0)

    # Signal 2: % requests completed (lifecycle automation)
    completed = await db.requests.count_documents({
        "created_at": {"$gte": since_30d.isoformat()},
        "status": {"$in": ["confirmed", "completed"]},
    })
    completed_pct = _pct(completed, total_requests, fallback=50.0)

    # Signal 3: preset schedules / scheduler health (proxy: smoke test runs in last 24h)
    since_24h = datetime.now(timezone.utc) - timedelta(hours=24)
    smoke_runs_24h = await db.smoke_test_runs.count_documents({"started_at": {"$gte": since_24h.isoformat()}})
    # Expected: ~48 runs/day (every 30 min). >=24 = healthy.
    scheduler_health_pct = _clamp((smoke_runs_24h / 24.0) * 100.0)

    # Signal 4: open incidents (penalty: each open incident -5pt)
    open_incidents = await db.incidents.count_documents({"resolved_at": None})
    incidents_score = _clamp(100.0 - (open_incidents * 5.0))

    score = (
        auto_matched_pct * 0.35
        + completed_pct * 0.25
        + scheduler_health_pct * 0.20
        + incidents_score * 0.20
    )

    return {
        "score": round(score, 1),
        "signals": {
            "auto_matched_requests_pct": round(auto_matched_pct, 1),
            "completed_requests_pct": round(completed_pct, 1),
            "scheduler_health_pct": round(scheduler_health_pct, 1),
            "incidents_score": round(incidents_score, 1),
            "raw": {
                "total_requests_30d": total_requests,
                "auto_matched": auto_matched,
                "completed": completed,
                "smoke_runs_24h": smoke_runs_24h,
                "open_incidents": open_incidents,
            },
        },
    }


# ============================================================================
# Sub-score: TECHNICAL
# ============================================================================
async def _score_technical() -> dict:
    """Technical autonomy = system runs itself (tests pass, snapshots fresh)."""
    since_7d = datetime.now(timezone.utc) - timedelta(days=7)

    # Signal 1: smoke test pass rate (last 7 days)
    total_smoke = await db.smoke_test_runs.count_documents({"started_at": {"$gte": since_7d.isoformat()}})
    passed_smoke = await db.smoke_test_runs.count_documents({
        "started_at": {"$gte": since_7d.isoformat()},
        "ok": True,
    })
    smoke_pass_pct = _pct(passed_smoke, total_smoke, fallback=70.0)

    # Signal 2: latest snapshot freshness (< 36h = 100, > 7d = 0)
    # snapshots use `ts` field (set in settings_snapshots._take_snapshot)
    latest_snap = await db.app_settings_snapshots.find_one({}, sort=[("ts", -1)])
    snap_freshness_pct = 0.0
    if latest_snap and (latest_snap.get("ts") or latest_snap.get("created_at")):
        try:
            ts = latest_snap.get("ts") or latest_snap.get("created_at")
            if isinstance(ts, str):
                ts = datetime.fromisoformat(ts.replace("Z", "+00:00"))
            age_hours = (datetime.now(timezone.utc) - ts).total_seconds() / 3600.0
            if age_hours <= 36:
                snap_freshness_pct = 100.0
            elif age_hours >= 168:  # 7 days
                snap_freshness_pct = 0.0
            else:
                snap_freshness_pct = _clamp(100.0 - ((age_hours - 36) / (168 - 36)) * 100.0)
        except Exception:
            snap_freshness_pct = 50.0

    # Signal 3: release gate pass rate (last 4 runs) — "pass" = not blocked + no P0 failures
    cursor = db.release_gates.find({}, {"summary": 1}).sort("started_at", -1).limit(4)
    gates = [g async for g in cursor]
    if gates:
        gate_pass = sum(
            1 for g in gates
            if not (g.get("summary") or {}).get("blocked", True)
            and ((g.get("summary") or {}).get("p0_fail", 1)) == 0
        )
        gate_pass_pct = _pct(gate_pass, len(gates))
    else:
        gate_pass_pct = 60.0  # neutral when no data

    score = smoke_pass_pct * 0.45 + snap_freshness_pct * 0.30 + gate_pass_pct * 0.25

    return {
        "score": round(score, 1),
        "signals": {
            "smoke_test_pass_pct_7d": round(smoke_pass_pct, 1),
            "snapshot_freshness_pct": round(snap_freshness_pct, 1),
            "release_gate_pass_pct": round(gate_pass_pct, 1),
            "raw": {
                "smoke_runs_7d": total_smoke,
                "smoke_passed_7d": passed_smoke,
                "release_gates_last_n": len(gates),
            },
        },
    }


# ============================================================================
# Sub-score: SECURITY
# ============================================================================
async def _score_security() -> dict:
    """Security autonomy = system self-defends (auth healthy, findings handled)."""
    since_24h = datetime.now(timezone.utc) - timedelta(hours=24)

    # Signal 1: OAuth success rate (last 24h)
    total_oauth = await db.oauth_health.count_documents({"timestamp": {"$gte": since_24h.isoformat()}})
    success_oauth = await db.oauth_health.count_documents({
        "timestamp": {"$gte": since_24h.isoformat()},
        "status": "success",
    })
    oauth_pct = _pct(success_oauth, total_oauth, fallback=95.0)

    # Signal 2: AI security findings — open vs total
    total_findings = await db.admin_ai_findings.count_documents({
        "category": {"$regex": "security", "$options": "i"},
    }) or await db.admin_ai_findings.count_documents({})
    open_findings = await db.admin_ai_findings.count_documents({"status": "open"})
    if total_findings > 0:
        resolved_pct = _pct(total_findings - open_findings, total_findings)
    else:
        resolved_pct = 100.0  # no findings = good

    # Signal 3: critical open findings penalty
    critical_open = await db.admin_ai_findings.count_documents({
        "status": "open",
        "severity": "high",
    })
    critical_score = _clamp(100.0 - (critical_open * 10.0))

    score = oauth_pct * 0.40 + resolved_pct * 0.35 + critical_score * 0.25

    return {
        "score": round(score, 1),
        "signals": {
            "oauth_success_pct_24h": round(oauth_pct, 1),
            "findings_resolved_pct": round(resolved_pct, 1),
            "critical_open_penalty": round(critical_score, 1),
            "raw": {
                "oauth_events_24h": total_oauth,
                "oauth_success_24h": success_oauth,
                "findings_total": total_findings,
                "findings_open": open_findings,
                "findings_critical_open": critical_open,
            },
        },
    }


# ============================================================================
# Sub-score: DEV
# ============================================================================
async def _score_dev() -> dict:
    """Dev autonomy = automated quality gates + AI dev team findings."""
    since_30d = datetime.now(timezone.utc) - timedelta(days=30)

    # Signal 1: release gates passed (30 days) — "pass" = not blocked + no P0 failures
    cursor = db.release_gates.find({"started_at": {"$gte": since_30d.isoformat()}}, {"summary": 1})
    gates = [g async for g in cursor]
    if gates:
        gate_pass = sum(
            1 for g in gates
            if not (g.get("summary") or {}).get("blocked", True)
            and ((g.get("summary") or {}).get("p0_fail", 1)) == 0
        )
        gate_pct = _pct(gate_pass, len(gates))
    else:
        gate_pct = 50.0  # neutral default when nothing ran yet

    # Signal 2: QA copilot — findings resolved ratio
    total_qa = 0
    resolved_qa = 0
    async for s in db.qa_sessions.find({}, {"findings": 1}):
        for f in (s.get("findings") or []):
            total_qa += 1
            if f.get("status") == "resolved":
                resolved_qa += 1
    qa_pct = _pct(resolved_qa, total_qa, fallback=50.0)

    # Signal 3: smoke test stability (proxy for dev hygiene) — last 7 days
    since_7d = datetime.now(timezone.utc) - timedelta(days=7)
    fail_runs = await db.smoke_test_runs.count_documents({
        "started_at": {"$gte": since_7d.isoformat()},
        "ok": False,
    })
    stability_score = _clamp(100.0 - (fail_runs * 3.0))

    score = gate_pct * 0.45 + qa_pct * 0.30 + stability_score * 0.25

    return {
        "score": round(score, 1),
        "signals": {
            "release_gate_pass_pct_30d": round(gate_pct, 1),
            "qa_findings_resolved_pct": round(qa_pct, 1),
            "smoke_stability_pct": round(stability_score, 1),
            "raw": {
                "release_gates_30d": len(gates),
                "qa_findings_total": total_qa,
                "qa_findings_resolved": resolved_qa,
                "smoke_failures_7d": fail_runs,
            },
        },
    }


# ============================================================================
# Sub-score: AI
# ============================================================================
async def _score_ai() -> dict:
    """AI autonomy = AI findings resolved, AI follow-through."""
    # Signal 1: AI findings — resolved / total (open vs closed)
    total = await db.admin_ai_findings.count_documents({})
    resolved = await db.admin_ai_findings.count_documents({"status": "resolved"})
    dismissed = await db.admin_ai_findings.count_documents({"status": "dismissed"})
    closed = resolved + dismissed
    if total > 0:
        closure_pct = _pct(closed, total)
    else:
        closure_pct = 50.0  # neutral

    # Memoize collection list once (defensive: list_collection_names can be
    # restricted on some Atlas serverless tiers — degrade gracefully)
    coll_names: set
    try:
        coll_names = set(await db.list_collection_names())
    except Exception as e:  # noqa: BLE001
        logger.warning(f"list_collection_names unavailable, falling back: {e}")
        coll_names = {"ai_memories", "ai_documents"}  # assume present; counts will be 0 if not

    # Signal 2: AI memories accumulated (proxy for learning) — > 50 = mature
    memories = 0
    if "ai_memories" in coll_names:
        try:
            memories = await db.ai_memories.count_documents({})
        except Exception:
            memories = 0
    maturity_pct = _clamp((memories / 200.0) * 100.0)

    # Signal 3: docs RAG ingest count (proxy for knowledge base) — > 10 docs = good
    docs_count = 0
    if "ai_documents" in coll_names:
        try:
            docs_count = await db.ai_documents.count_documents({})
        except Exception:
            docs_count = 0
    knowledge_pct = _clamp((docs_count / 20.0) * 100.0)

    score = closure_pct * 0.50 + maturity_pct * 0.25 + knowledge_pct * 0.25

    return {
        "score": round(score, 1),
        "signals": {
            "findings_closure_pct": round(closure_pct, 1),
            "memory_maturity_pct": round(maturity_pct, 1),
            "knowledge_base_pct": round(knowledge_pct, 1),
            "raw": {
                "findings_total": total,
                "findings_resolved": resolved,
                "findings_dismissed": dismissed,
                "memories_count": memories,
                "docs_count": docs_count,
            },
        },
    }


# ============================================================================
# RECOMMENDATIONS (deterministic — no LLM)
# ============================================================================
def _recommendations(scores: dict, breakdown: dict, targets: dict) -> list:
    """Generate prioritized recommendations to close gaps to target."""
    recs = []

    # Operational gaps
    op = breakdown["operational"]["signals"]
    if op["auto_matched_requests_pct"] < 80:
        recs.append({
            "area": "operational",
            "priority": "high",
            "action": f"Crește rata de auto-matching (acum {op['auto_matched_requests_pct']}%). Activează matching agresiv pentru categorii sub 500 RON.",
            "impact_points": round((80 - op["auto_matched_requests_pct"]) * 0.35 * 0.30, 1),
        })
    if op["raw"]["open_incidents"] > 3:
        recs.append({
            "area": "operational",
            "priority": "high",
            "action": f"Rezolvă {op['raw']['open_incidents']} incidente deschise — fiecare scade Operational cu 5pt.",
            "impact_points": min(op["raw"]["open_incidents"] * 5 * 0.30, 15.0),
        })

    # Technical gaps
    tech = breakdown["technical"]["signals"]
    if tech["smoke_test_pass_pct_7d"] < 90:
        recs.append({
            "area": "technical",
            "priority": "medium",
            "action": f"Smoke test pass rate {tech['smoke_test_pass_pct_7d']}% — investighează failure-uri recente în Admin → Smoke Test.",
            "impact_points": round((90 - tech["smoke_test_pass_pct_7d"]) * 0.45 * 0.25, 1),
        })
    if tech["snapshot_freshness_pct"] < 80:
        recs.append({
            "area": "technical",
            "priority": "low",
            "action": "Snapshot setări vechi. Verifică job-ul APScheduler `settings_snapshot_daily`.",
            "impact_points": 5.0,
        })

    # Security gaps
    sec = breakdown["security"]["signals"]
    if sec["raw"]["findings_critical_open"] > 0:
        recs.append({
            "area": "security",
            "priority": "critical",
            "action": f"{sec['raw']['findings_critical_open']} probleme critice deschise în AI Findings. Rezolvă-le acum.",
            "impact_points": min(sec["raw"]["findings_critical_open"] * 10 * 0.20, 20.0),
        })
    if sec["oauth_success_pct_24h"] < 90 and sec["raw"]["oauth_events_24h"] > 10:
        recs.append({
            "area": "security",
            "priority": "high",
            "action": f"Rata succes OAuth doar {sec['oauth_success_pct_24h']}% — verifică Auth Health Page.",
            "impact_points": round((90 - sec["oauth_success_pct_24h"]) * 0.40 * 0.20, 1),
        })

    # Dev gaps
    dev = breakdown["dev"]["signals"]
    if dev["release_gate_pass_pct_30d"] < 75 and dev["raw"]["release_gates_30d"] > 0:
        recs.append({
            "area": "dev",
            "priority": "medium",
            "action": f"Release gate pass rate {dev['release_gate_pass_pct_30d']}% — review Weekly Release Gate.",
            "impact_points": round((75 - dev["release_gate_pass_pct_30d"]) * 0.45 * 0.10, 1),
        })

    # AI gaps
    ai = breakdown["ai"]["signals"]
    if ai["findings_closure_pct"] < 70 and ai["raw"]["findings_total"] > 5:
        recs.append({
            "area": "ai",
            "priority": "medium",
            "action": f"Doar {ai['findings_closure_pct']}% din AI findings sunt închise. Triaj în AI Control Center.",
            "impact_points": round((70 - ai["findings_closure_pct"]) * 0.50 * 0.15, 1),
        })
    if ai["raw"]["docs_count"] < 5:
        recs.append({
            "area": "ai",
            "priority": "low",
            "action": "Upload mai multe documente PDF/DOCX în Document Intelligence ca AI să răspundă mai precis.",
            "impact_points": 5.0,
        })

    # Sort by priority then impact
    priority_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    recs.sort(key=lambda r: (priority_order.get(r["priority"], 9), -r["impact_points"]))
    return recs[:6]  # cap at 6


# ============================================================================
# MAIN: compute_autonomy_scores
# ============================================================================
async def compute_autonomy_scores(weights: Optional[dict] = None, targets: Optional[dict] = None) -> dict:
    """Public entrypoint — returns full autonomy report."""
    w = {**DEFAULT_WEIGHTS, **(weights or {})}
    t = {**DEFAULT_TARGETS, **(targets or {})}

    breakdown = {
        "operational": await _score_operational(),
        "technical": await _score_technical(),
        "security": await _score_security(),
        "dev": await _score_dev(),
        "ai": await _score_ai(),
    }

    scores = {k: breakdown[k]["score"] for k in breakdown}
    general = sum(scores[k] * w[k] for k in w)
    scores["general"] = round(general, 1)

    # Determine tier
    if general >= 90:
        tier = "self-driving"
    elif general >= 75:
        tier = "autonomous"
    elif general >= 50:
        tier = "assisted"
    else:
        tier = "manual"

    recommendations = _recommendations(scores, breakdown, t)

    return {
        "scores": scores,
        "tier": tier,
        "weights": w,
        "targets": t,
        "breakdown": breakdown,
        "recommendations": recommendations,
        "computed_at": datetime.now(timezone.utc).isoformat(),
    }
