"""PropManage — Weekly AI Briefing

Each Monday 09:00 Europe/Bucharest, Claude Sonnet summarizes the AI activity
of the past 7 days and emails it to configured admins.

Source data:
  - /api/admin/ai-activity collectors (same source as the Activity Stream)
  - autonomy_snapshots delta (current vs 7d ago)

Config (db.ai_weekly_briefing_config, singleton _id="config"):
  - enabled: bool
  - recipients: ["email@..."]
  - last_sent_at: ISO

History: db.ai_weekly_briefing_history (capped 50)
"""
import logging
import re
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Body, HTTPException

from db import db
from deps import require_role
from ai_core.provider import call_llm
from email_service import send_email
from routes.ai_activity import (
    _collect_autonomy_snapshots, _collect_auto_match_runs,
    _collect_findings, _collect_ai_scans, _collect_smoke_tests,
    _collect_settings_snapshots, _collect_security_runs,
)

logger = logging.getLogger("propmanage.ai_weekly_briefing")
router = APIRouter(prefix="/api/admin/ai-weekly-briefing", tags=["admin-ai-weekly-briefing"])

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

DEFAULT_CONFIG = {
    "enabled": False,
    "recipients": [],
}


async def _load_config() -> dict:
    doc = await db.ai_weekly_briefing_config.find_one({"_id": "config"})
    if not doc:
        return {**DEFAULT_CONFIG}
    return {
        "enabled": bool(doc.get("enabled", False)),
        "recipients": list(doc.get("recipients") or []),
        "last_sent_at": doc.get("last_sent_at"),
    }


async def _gather_week_activity() -> dict:
    """Aggregate the same events as the Activity Stream, over last 7d."""
    since = datetime.now(timezone.utc) - timedelta(days=7)
    since_iso = since.isoformat()
    all_events: list = []
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
            all_events.extend(sub)
        except Exception as e:  # noqa: BLE001
            logger.warning(f"[weekly-briefing] collector {collector.__name__}: {e}")
    all_events.sort(key=lambda e: e.get("ts") or "", reverse=True)

    # Compact stats
    by_kind: dict = {}
    auto_match_assigned = 0
    findings_resolved = 0
    findings_detected = 0
    smoke_pass = 0
    smoke_fail = 0
    for e in all_events:
        by_kind[e["kind"]] = by_kind.get(e["kind"], 0) + 1
        if e["kind"] == "auto_match.run":
            auto_match_assigned += (e.get("meta") or {}).get("assigned", 0)
        elif e["kind"] == "ai.finding.resolved":
            findings_resolved += 1
        elif e["kind"] == "ai.finding.detected":
            findings_detected += 1
        elif e["kind"] == "smoke_test.run":
            if (e.get("meta") or {}).get("ok"):
                smoke_pass += 1
            else:
                smoke_fail += 1

    # Autonomy delta — current vs 7d ago snapshot
    current_doc = await db.autonomy_snapshots.find_one(
        {}, sort=[("timestamp", -1)],
    )
    week_ago_doc = await db.autonomy_snapshots.find_one(
        {"timestamp": {"$lte": since_iso}},
        sort=[("timestamp", -1)],
    )
    autonomy = {
        "current": (current_doc or {}).get("scores", {}),
        "week_ago": (week_ago_doc or {}).get("scores", {}),
        "current_tier": (current_doc or {}).get("tier", "?"),
    }

    return {
        "events_count": len(all_events),
        "by_kind": by_kind,
        "auto_match_assigned": auto_match_assigned,
        "findings_resolved": findings_resolved,
        "findings_detected": findings_detected,
        "smoke_pass": smoke_pass,
        "smoke_fail": smoke_fail,
        "autonomy": autonomy,
        "top_events": all_events[:15],
        "since": since_iso,
    }


async def _llm_summarize(stats: dict) -> str:
    """Ask Claude to write a friendly Romanian summary. Falls back to a
    deterministic template if LLM fails."""
    cur = stats["autonomy"]["current"].get("general", 0)
    prev = stats["autonomy"]["week_ago"].get("general", 0)
    delta = round(cur - prev, 1)

    facts = [
        f"Tier curent: {stats['autonomy']['current_tier']}",
        f"Autonomy: {cur}/100 (delta vs acum 7 zile: {'+' if delta >= 0 else ''}{delta})",
        f"Auto-match: {stats['auto_match_assigned']} cereri asignate automat",
        f"Findings: {stats['findings_detected']} detectate / {stats['findings_resolved']} rezolvate",
        f"Smoke tests: {stats['smoke_pass']} OK / {stats['smoke_fail']} FAIL",
        f"Total evenimente AI în săptămână: {stats['events_count']}",
    ]
    by_kind_str = ", ".join(f"{k}={v}" for k, v in stats["by_kind"].items())
    facts.append(f"Distribuție: {by_kind_str}")

    system = (
        "Ești asistentul AI executiv al platformei PropManage. "
        "Scrie un briefing săptămânal scurt, prietenos, în limba română, în maxim 5 paragrafe scurte. "
        "Folosește un ton încurajator, factual, fără jargon. Evidențiază: ce a funcționat bine, "
        "ce necesită atenție, și o singură acțiune concretă recomandată pentru următoarea săptămână."
    )
    user = "Iată faptele pentru ultimele 7 zile:\n- " + "\n- ".join(facts)
    res = await call_llm(system_message=system, user_message=user, session_id=f"weekly-{uuid.uuid4().hex[:8]}")
    if res.get("text"):
        return res["text"]

    # Fallback: deterministic template
    direction = "în creștere 📈" if delta > 0 else ("stabilă ➖" if delta == 0 else "în scădere 📉")
    return (
        f"Săptămâna aceasta autonomia platformei a fost {direction}: scor general {cur}/100 "
        f"(diferență {'+' if delta >= 0 else ''}{delta} puncte). "
        f"Sistemul a asignat automat {stats['auto_match_assigned']} cereri, a rezolvat "
        f"{stats['findings_resolved']} probleme detectate (din {stats['findings_detected']} noi) "
        f"și a rulat {stats['smoke_pass']} smoke teste OK. "
        f"Pentru săptămâna următoare, recomandăm revizuirea findings-urilor deschise în AI Control Center."
    )


def _build_html(summary_md: str, stats: dict) -> str:
    cur = stats["autonomy"]["current"].get("general", 0)
    prev = stats["autonomy"]["week_ago"].get("general", 0)
    delta = round(cur - prev, 1)
    delta_color = "#10b981" if delta >= 0 else "#ef4444"
    delta_sign = "+" if delta >= 0 else ""
    # markdown-light: convert double newlines to <p>
    body_html = "".join(f"<p style='margin:0 0 12px;line-height:1.55'>{para.strip()}</p>"
                        for para in summary_md.split("\n\n") if para.strip())

    return f"""
<!doctype html>
<html><body style="margin:0;background:#f6f7f9;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1f2937">
<div style="max-width:600px;margin:0 auto;padding:24px">
  <div style="background:#fff;border-radius:16px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,.06)">
    <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #e5e7eb;padding-bottom:14px;margin-bottom:18px">
      <div>
        <div style="font-size:11px;letter-spacing:.1em;color:#6b7280;text-transform:uppercase">PropManage · Weekly AI Briefing</div>
        <div style="font-size:20px;font-weight:600;margin-top:4px">Săptămâna AI · {datetime.now(timezone.utc).strftime('%d %b %Y')}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:28px;font-weight:700">{cur}<span style="font-size:14px;color:#9ca3af">/100</span></div>
        <div style="font-size:12px;color:{delta_color};font-weight:600">{delta_sign}{delta} pct</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:18px">
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:12px">
        <div style="font-size:10px;color:#16a34a;letter-spacing:.08em;text-transform:uppercase">Cereri asignate auto</div>
        <div style="font-size:22px;font-weight:700;color:#166534;margin-top:2px">{stats['auto_match_assigned']}</div>
      </div>
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:12px">
        <div style="font-size:10px;color:#2563eb;letter-spacing:.08em;text-transform:uppercase">Findings rezolvate</div>
        <div style="font-size:22px;font-weight:700;color:#1e3a8a;margin-top:2px">{stats['findings_resolved']}</div>
      </div>
      <div style="background:#fefce8;border:1px solid #fde68a;border-radius:12px;padding:12px">
        <div style="font-size:10px;color:#ca8a04;letter-spacing:.08em;text-transform:uppercase">Findings noi</div>
        <div style="font-size:22px;font-weight:700;color:#854d0e;margin-top:2px">{stats['findings_detected']}</div>
      </div>
      <div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:12px;padding:12px">
        <div style="font-size:10px;color:#7c3aed;letter-spacing:.08em;text-transform:uppercase">Smoke OK / FAIL</div>
        <div style="font-size:22px;font-weight:700;color:#5b21b6;margin-top:2px">{stats['smoke_pass']} / {stats['smoke_fail']}</div>
      </div>
    </div>

    <div style="font-size:14px;color:#374151">
      {body_html}
    </div>

    <div style="margin-top:18px;padding-top:14px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;text-align:center">
      Generat automat de Claude Sonnet · vezi detalii complete în <a href="#" style="color:#7c3aed;text-decoration:none">Activity AI</a> pe Admin Dashboard
    </div>
  </div>
</div>
</body></html>
""".strip()


async def send_weekly_briefing(force: bool = False, override_recipients: Optional[list] = None) -> dict:
    """Generate + send the briefing. Called by scheduler or manually."""
    cfg = await _load_config()
    if not force and not cfg["enabled"]:
        return {"skipped": "disabled"}
    recipients = override_recipients or cfg["recipients"]
    if not recipients:
        return {"skipped": "no_recipients"}

    stats = await _gather_week_activity()
    summary = await _llm_summarize(stats)
    html = _build_html(summary, stats)
    subject = f"PropManage · Săptămâna AI · scor {stats['autonomy']['current'].get('general', 0)}/100"

    try:
        await send_email(recipients, subject, html)
        sent_ok = True
        error = None
    except Exception as e:  # noqa: BLE001
        logger.warning(f"[weekly-briefing] email send failed: {e}")
        sent_ok = False
        error = str(e)[:200]

    now_iso = datetime.now(timezone.utc).isoformat()
    if sent_ok:
        await db.ai_weekly_briefing_config.update_one(
            {"_id": "config"}, {"$set": {"last_sent_at": now_iso}}, upsert=True,
        )

    history_doc = {
        "sent_at": now_iso,
        "recipients": recipients,
        "subject": subject,
        "ok": sent_ok,
        "error": error,
        "summary_text": summary,
        "stats": {k: v for k, v in stats.items() if k != "top_events"},
        "forced": bool(force),
    }
    try:
        await db.ai_weekly_briefing_history.insert_one(history_doc)
        # cap at 50
        cur = db.ai_weekly_briefing_history.find({}, {"_id": 1}).sort("sent_at", -1).skip(50)
        old = [d["_id"] async for d in cur]
        if old:
            await db.ai_weekly_briefing_history.delete_many({"_id": {"$in": old}})
    except Exception as e:  # noqa: BLE001
        logger.warning(f"[weekly-briefing] history persist failed: {e}")

    history_doc.pop("_id", None)
    return history_doc


async def run_weekly_briefing_job() -> dict:
    """APScheduler entrypoint — Mondays 09:00 Europe/Bucharest."""
    try:
        return await send_weekly_briefing(force=False)
    except Exception as e:  # noqa: BLE001
        logger.exception(f"[weekly-briefing] job failed: {e}")
        return {"error": str(e)}


# ============================================================================
# REST endpoints
# ============================================================================

@router.get("/config")
async def get_briefing_config(user=Depends(require_role("admin"))):
    return await _load_config()


@router.put("/config")
async def update_briefing_config(payload: dict = Body(...), user=Depends(require_role("admin"))):
    cfg = await _load_config()
    if "enabled" in payload:
        cfg["enabled"] = bool(payload["enabled"])
    if "recipients" in payload:
        recipients = payload["recipients"]
        if not isinstance(recipients, list):
            raise HTTPException(400, "recipients must be a list of emails")
        # basic email validation
        clean = []
        for r in recipients:
            r = str(r).strip()
            if EMAIL_RE.match(r):
                clean.append(r)
        cfg["recipients"] = clean
    cfg["updated_at"] = datetime.now(timezone.utc).isoformat()
    cfg["updated_by"] = user["id"]
    await db.ai_weekly_briefing_config.update_one({"_id": "config"}, {"$set": cfg}, upsert=True)
    return await _load_config()


@router.post("/send-now")
async def trigger_send(payload: dict = Body(default={}), user=Depends(require_role("admin"))):
    """Force-send the briefing now. Optional: override recipients in body."""
    override = payload["recipients"] if "recipients" in payload else None
    if override is not None and not isinstance(override, list):
        raise HTTPException(400, "recipients must be a list")
    return await send_weekly_briefing(force=True, override_recipients=override)


@router.get("/history")
async def list_history(limit: int = 10, user=Depends(require_role("admin"))):
    limit = max(1, min(50, int(limit)))
    cursor = db.ai_weekly_briefing_history.find({}, {"_id": 0}).sort("sent_at", -1).limit(limit)
    items = [d async for d in cursor]
    return {"items": items, "count": len(items)}
