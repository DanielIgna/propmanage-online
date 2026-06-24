"""PropManage — AI Activity Stream

Unified read-only timeline of autonomous AI actions across the platform.
Aggregates events from:
  - autonomy_snapshots     (daily autonomy score taken)
  - auto_match_runs        (specialist auto-assigned by admin or cron)
  - admin_ai_findings      (AI investigator detected anomalies)
  - admin_ai_scans         (AI scan completed)
  - smoke_test_runs        (smoke test pass/fail)
  - app_settings_snapshots (settings auto-snapshot)
  - security_ai_runs       (security guardian scan)

Returns a normalized event list, newest first. No writes.
"""
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query

from db import db
from deps import require_role

logger = logging.getLogger("propmanage.ai_activity")
router = APIRouter(prefix="/api/admin/ai-activity", tags=["admin-ai-activity"])


def _normalize_ts(ts) -> Optional[str]:
    if not ts:
        return None
    if isinstance(ts, datetime):
        return ts.isoformat()
    return str(ts)


def _event(kind: str, ts: str, title: str, summary: str = "",
           severity: str = "info", icon: str = "Activity",
           meta: Optional[dict] = None, source: str = "") -> dict:
    return {
        "kind": kind,
        "ts": ts,
        "title": title,
        "summary": summary,
        "severity": severity,  # info | success | warning | critical
        "icon": icon,
        "meta": meta or {},
        "source": source,
    }


async def _collect_autonomy_snapshots(since_iso: str) -> list:
    events = []
    cursor = db.autonomy_snapshots.find(
        {"timestamp": {"$gte": since_iso}},
        {"timestamp": 1, "scores": 1, "tier": 1, "_id": 0},
    ).sort("timestamp", -1).limit(15)
    async for d in cursor:
        general = (d.get("scores") or {}).get("general", 0)
        tier = d.get("tier", "?")
        events.append(_event(
            kind="autonomy.snapshot",
            ts=d.get("timestamp"),
            title=f"Autonomy snapshot · {general}/100",
            summary=f"Tier: {tier} · scor general înregistrat în istoric",
            severity="success" if general >= 75 else "info",
            icon="Gauge",
            meta={"general": general, "tier": tier},
            source="autonomy_snapshots",
        ))
    return events


async def _collect_auto_match_runs(since_iso: str) -> list:
    events = []
    cursor = db.auto_match_runs.find(
        {"executed_at": {"$gte": since_iso}, "assigned_count": {"$gt": 0}},
        {"_id": 0},
    ).sort("executed_at", -1).limit(20)
    async for d in cursor:
        kind_src = (d.get("triggered_by") or {}).get("kind", "manual")
        assigned = d.get("assigned_count", 0)
        skipped = d.get("skipped_count", 0)
        events.append(_event(
            kind="auto_match.run",
            ts=d.get("executed_at"),
            title=f"Auto-match · {assigned} cereri asignate",
            summary=f"Trigger: {kind_src}" + (f" · {skipped} sărite" if skipped else ""),
            severity="success",
            icon="Zap",
            meta={"assigned": assigned, "skipped": skipped, "trigger": kind_src},
            source="auto_match_runs",
        ))
    # Also surface cron ticks that were debounced/disabled if recent (for visibility)
    return events


async def _collect_findings(since_iso: str) -> list:
    events = []
    # Recent NEW findings (first_seen_at)
    cursor = db.admin_ai_findings.find(
        {"first_seen_at": {"$gte": since_iso}},
        {"_id": 1, "label": 1, "severity": 1, "first_seen_at": 1, "pattern": 1, "status": 1},
    ).sort("first_seen_at", -1).limit(15)
    async for d in cursor:
        sev = d.get("severity", "low")
        sev_map = {"high": "critical", "warning": "warning", "low": "info"}
        events.append(_event(
            kind="ai.finding.detected",
            ts=d.get("first_seen_at"),
            title=f"AI a detectat: {d.get('label') or d.get('pattern') or 'anomalie'}",
            summary=f"Severitate: {sev} · status: {d.get('status', 'open')}",
            severity=sev_map.get(sev, "info"),
            icon="AlertTriangle",
            meta={"finding_id": str(d["_id"]), "pattern": d.get("pattern"), "severity": sev},
            source="admin_ai_findings",
        ))
    # Recent RESOLVED findings
    cursor = db.admin_ai_findings.find(
        {"resolved_at": {"$gte": since_iso}, "status": {"$in": ["resolved", "dismissed"]}},
        {"_id": 1, "label": 1, "resolved_at": 1, "status": 1, "resolved_by_name": 1, "pattern": 1},
    ).sort("resolved_at", -1).limit(10)
    async for d in cursor:
        action = "rezolvat" if d.get("status") == "resolved" else "dismis"
        events.append(_event(
            kind="ai.finding.resolved",
            ts=d.get("resolved_at"),
            title=f"Finding {action}: {d.get('label') or d.get('pattern') or '?'}",
            summary=f"De: {d.get('resolved_by_name') or 'admin'}",
            severity="success",
            icon="CheckCircle2",
            meta={"finding_id": str(d["_id"]), "status": d.get("status")},
            source="admin_ai_findings",
        ))
    return events


async def _collect_ai_scans(since_iso: str) -> list:
    events = []
    cursor = db.admin_ai_scans.find(
        {"started_at": {"$gte": since_iso}},
        {"_id": 0, "started_at": 1, "patterns_run": 1, "new_findings": 1,
         "updated_findings": 1, "duration_ms": 1},
    ).sort("started_at", -1).limit(8)
    async for d in cursor:
        nf = d.get("new_findings", 0)
        uf = d.get("updated_findings", 0)
        events.append(_event(
            kind="ai.scan.completed",
            ts=d.get("started_at"),
            title=f"AI scan terminat · {nf} noi, {uf} actualizate",
            summary=f"Durata: {(d.get('duration_ms') or 0) // 1000}s",
            severity="info",
            icon="Search",
            meta={"new": nf, "updated": uf},
            source="admin_ai_scans",
        ))
    return events


async def _collect_smoke_tests(since_iso: str) -> list:
    events = []
    cursor = db.smoke_test_runs.find(
        {"started_at": {"$gte": since_iso}},
        {"_id": 0, "started_at": 1, "ok": 1, "passed": 1, "failed": 1, "total": 1,
         "triggered_by": 1},
    ).sort("started_at", -1).limit(8)
    async for d in cursor:
        ok = bool(d.get("ok"))
        events.append(_event(
            kind="smoke_test.run",
            ts=d.get("started_at"),
            title=f"Smoke test · {d.get('passed', 0)}/{d.get('total', 0)} {'PASS' if ok else 'FAIL'}",
            summary=f"Trigger: {d.get('triggered_by') or 'cron'}",
            severity="success" if ok else "critical",
            icon="ShieldCheck" if ok else "AlertTriangle",
            meta={"ok": ok, "passed": d.get("passed", 0), "total": d.get("total", 0)},
            source="smoke_test_runs",
        ))
    return events


async def _collect_settings_snapshots(since_iso: str) -> list:
    events = []
    cursor = db.app_settings_snapshots.find(
        {"created_at": {"$gte": since_iso}},
        {"_id": 0, "created_at": 1, "kind": 1, "label": 1, "created_by": 1},
    ).sort("created_at", -1).limit(5)
    async for d in cursor:
        kind_src = d.get("kind", "manual")
        events.append(_event(
            kind="settings.snapshot",
            ts=d.get("created_at"),
            title=f"Snapshot setări · {kind_src}",
            summary=d.get("label") or "Backup automat zilnic",
            severity="info",
            icon="Save",
            meta={"kind": kind_src, "by": d.get("created_by")},
            source="app_settings_snapshots",
        ))
    return events


async def _collect_security_runs(since_iso: str) -> list:
    events = []
    cursor = db.security_ai_runs.find(
        {"executed_at": {"$gte": since_iso}},
        {"_id": 0},
    ).sort("executed_at", -1).limit(5)
    async for d in cursor:
        risk = d.get("risk_score", 0)
        events.append(_event(
            kind="security.scan",
            ts=d.get("executed_at"),
            title=f"Security Guardian · risk {risk}/100",
            summary=f"{d.get('threats_detected', 0)} amenințări detectate",
            severity="warning" if risk >= 40 else "info",
            icon="Shield",
            meta={"risk_score": risk},
            source="security_ai_runs",
        ))
    return events


@router.get("")
async def get_ai_activity(
    hours: int = Query(72, ge=1, le=720),
    limit: int = Query(60, ge=5, le=200),
    user=Depends(require_role("admin")),
):
    """Unified AI activity timeline. Newest first.

    Default window: last 72h. Cap: 200 events.
    """
    since = datetime.now(timezone.utc) - timedelta(hours=hours)
    since_iso = since.isoformat()

    events: list = []
    for collector in (
        _collect_autonomy_snapshots,
        _collect_auto_match_runs,
        _collect_findings,
        _collect_ai_scans,
        _collect_smoke_tests,
        _collect_settings_snapshots,
        _collect_security_runs,
    ):
        try:
            sub = await collector(since_iso)
            events.extend(sub)
        except Exception as e:  # noqa: BLE001
            logger.warning(f"[ai-activity] collector {collector.__name__} failed: {e}")

    # Sort desc by ts (best-effort: ISO strings sort lexicographically)
    events.sort(key=lambda e: e.get("ts") or "", reverse=True)
    events = events[:limit]

    # Summary counts
    by_kind: dict = {}
    by_severity = {"info": 0, "success": 0, "warning": 0, "critical": 0}
    for e in events:
        by_kind[e["kind"]] = by_kind.get(e["kind"], 0) + 1
        if e["severity"] in by_severity:
            by_severity[e["severity"]] += 1

    return {
        "items": events,
        "count": len(events),
        "hours": hours,
        "summary": {
            "by_kind": by_kind,
            "by_severity": by_severity,
        },
    }
