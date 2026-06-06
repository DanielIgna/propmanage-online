"""PropManage — AI Governance Deprecation Pulse

Weekly email digest (Thursdays 09:30 Europe/Bucharest) that surfaces:
  - Agents deprecated with target_retirement_date in next 30 days
  - Agents that share data sources with already-deprecated agents (overlap)
  - Provider risk alerts (agents on providers flagged as sunset-risk)

Goal: never forget pending migrations or accumulated dead code.

Config (db.deprecation_pulse_config, singleton _id="config"):
  - enabled: bool
  - recipients: ["email@..."]
  - alert_window_days: int (default 30)
  - last_sent_at: ISO

History: db.deprecation_pulse_history (capped 50)
"""
import logging
import re
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Body
from pydantic import BaseModel, Field

from db import db
from deps import require_role
from email_service import send_email
from ai_governance.agent_registry import get_agents, get_agent

logger = logging.getLogger("propmanage.deprecation_pulse")
router = APIRouter(prefix="/api/admin/deprecation-pulse", tags=["deprecation-pulse"])

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

DEPRECATION_COLLECTION = "ai_agent_deprecations"

# Providers we proactively warn about (sunset / EOL signals)
SUNSET_RISK_PROVIDERS = {
    "gpt_4o": "OpenAI sunset announced for GPT-4o family in favor of GPT-5.x",
    "claude_haiku": "Claude Haiku is being superseded by Claude Haiku 4.5 — verify model id",
}

DEFAULT_CONFIG = {
    "enabled": False,
    "recipients": [],
    "alert_window_days": 30,
}


async def _load_config() -> dict:
    doc = await db.deprecation_pulse_config.find_one({"_id": "config"})
    if not doc:
        return {**DEFAULT_CONFIG}
    return {
        "enabled": bool(doc.get("enabled", False)),
        "recipients": list(doc.get("recipients", [])),
        "alert_window_days": int(doc.get("alert_window_days", 30)),
        "last_sent_at": doc.get("last_sent_at"),
    }


async def _gather_pulse_data(alert_window_days: int = 30) -> dict:
    """Compute the 3 alert buckets."""
    now = datetime.now(timezone.utc)
    cutoff = now + timedelta(days=alert_window_days)

    # Bucket 1: upcoming retirements (active deprecations with target < cutoff)
    upcoming_retirements = []
    # Bucket 2: overlap alerts — agents still active using data_sources that are
    #           also referenced by a deprecated agent
    deprecated_data_sources: set = set()
    overlap_alerts = []

    cur = db[DEPRECATION_COLLECTION].find({"status": "deprecated"})
    deprecated_records: list = []
    async for d in cur:
        d.pop("_id", None)
        deprecated_records.append(d)
        for ds in (d.get("impact") or {}).get("data_sources", []) or []:
            deprecated_data_sources.add(ds)

    for d in deprecated_records:
        target_iso = d.get("target_retirement_date")
        if not target_iso:
            continue
        try:
            target_dt = datetime.fromisoformat(target_iso)
            if target_dt.tzinfo is None:
                target_dt = target_dt.replace(tzinfo=timezone.utc)
        except Exception:  # noqa: BLE001
            continue
        days_left = (target_dt - now).days
        if target_dt <= cutoff:
            agent = get_agent(d["slug"]) or {}
            upcoming_retirements.append({
                "slug": d["slug"],
                "name": agent.get("name", d["slug"]),
                "category": agent.get("category"),
                "target_retirement_date": target_iso,
                "days_left": days_left,
                "reason": d.get("reason"),
                "replacement": d.get("replacement"),
            })

    # Overlap detection: any non-deprecated agent that lists a deprecated data source
    deprecated_slugs = {d["slug"] for d in deprecated_records}
    for agent in get_agents():
        if agent["slug"] in deprecated_slugs:
            continue
        sources = set(agent.get("data_sources", []) or [])
        overlap = sources & deprecated_data_sources
        if overlap:
            overlap_alerts.append({
                "slug": agent["slug"],
                "name": agent["name"],
                "shared_sources": sorted(overlap),
                "advice": "Verifică dacă acest agent este afectat de retragerea agentului deprecat care folosește aceleași colecții.",
            })

    # Bucket 3: provider risk
    provider_risk = []
    for agent in get_agents():
        if agent["slug"] in deprecated_slugs:
            continue
        p = agent.get("provider")
        if p in SUNSET_RISK_PROVIDERS:
            provider_risk.append({
                "slug": agent["slug"],
                "name": agent["name"],
                "provider": p,
                "advice": SUNSET_RISK_PROVIDERS[p],
            })

    upcoming_retirements.sort(key=lambda x: x["days_left"])

    return {
        "upcoming_retirements": upcoming_retirements,
        "overlap_alerts": overlap_alerts,
        "provider_risk": provider_risk,
        "alert_window_days": alert_window_days,
        "generated_at": now.isoformat(),
        "counts": {
            "upcoming": len(upcoming_retirements),
            "overlap": len(overlap_alerts),
            "provider_risk": len(provider_risk),
            "total_signals": len(upcoming_retirements) + len(overlap_alerts) + len(provider_risk),
        },
    }


def _build_html(data: dict) -> str:
    up = data["upcoming_retirements"]
    ov = data["overlap_alerts"]
    pr = data["provider_risk"]
    window = data["alert_window_days"]

    def _section(title: str, items_html: str, empty_msg: str, count: int) -> str:
        body = items_html or f'<div style="padding:14px;color:#16a34a;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;font-size:13px">{empty_msg}</div>'
        return f"""
        <div style="margin-bottom:24px">
          <div style="font-size:14px;font-weight:600;color:#1f2937;margin-bottom:10px">{title} ({count})</div>
          {body}
        </div>"""

    up_rows = ""
    for r in up:
        days = r["days_left"]
        urgent_color = "#ef4444" if days <= 7 else ("#f59e0b" if days <= 14 else "#8b5cf6")
        up_rows += f"""
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:12px;margin-bottom:8px">
          <div style="font-size:10px;letter-spacing:.08em;color:{urgent_color};text-transform:uppercase">{r['slug']} · {r['category'] or ''}</div>
          <div style="font-size:14px;font-weight:600;color:#7f1d1d;margin-top:2px">{r['name']}</div>
          <div style="font-size:12px;color:#7f1d1d;margin-top:4px">
            🗓️ Retragere în <strong style="color:{urgent_color}">{days} zile</strong> ({r['target_retirement_date']})
          </div>
          {f'<div style="font-size:11px;color:#92400e;margin-top:4px">Înlocuit cu: <strong>{r["replacement"]}</strong></div>' if r.get("replacement") else ""}
          <div style="font-size:12px;color:#374151;margin-top:6px;font-style:italic">{r.get('reason') or ''}</div>
        </div>"""

    ov_rows = ""
    for r in ov:
        shared = ", ".join(r["shared_sources"])
        ov_rows += f"""
        <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:12px;margin-bottom:8px">
          <div style="font-size:10px;letter-spacing:.08em;color:#92400e;text-transform:uppercase">{r['slug']}</div>
          <div style="font-size:14px;font-weight:600;color:#78350f;margin-top:2px">{r['name']}</div>
          <div style="font-size:11px;color:#78350f;margin-top:4px">Colecții partajate cu un agent depreciat: <code style="background:#fef3c7;padding:2px 6px;border-radius:4px">{shared}</code></div>
          <div style="font-size:12px;color:#78350f;margin-top:6px;font-style:italic">{r['advice']}</div>
        </div>"""

    pr_rows = ""
    for r in pr:
        pr_rows += f"""
        <div style="background:#faf5ff;border:1px solid #ddd6fe;border-radius:10px;padding:12px;margin-bottom:8px">
          <div style="font-size:10px;letter-spacing:.08em;color:#6b21a8;text-transform:uppercase">{r['slug']} · provider: {r['provider']}</div>
          <div style="font-size:14px;font-weight:600;color:#4c1d95;margin-top:2px">{r['name']}</div>
          <div style="font-size:12px;color:#5b21b6;margin-top:6px;font-style:italic">{r['advice']}</div>
        </div>"""

    today_str = datetime.now(timezone.utc).strftime("%d %b %Y")

    return f"""
<html><body style="margin:0;background:#f6f7f9;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1f2937">
<div style="max-width:640px;margin:0 auto;padding:24px">
  <div style="background:#fff;border-radius:16px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,.06)">

    <div style="border-bottom:1px solid #e5e7eb;padding-bottom:14px;margin-bottom:18px">
      <div style="font-size:11px;letter-spacing:.1em;color:#ef4444;text-transform:uppercase">PropManage · AI Governance</div>
      <div style="font-size:22px;font-weight:700;margin-top:4px">Deprecation Pulse · {today_str}</div>
      <div style="font-size:13px;color:#6b7280;margin-top:4px">Alerte retragere, overlap colecții &amp; provider risk · fereastră {window} zile</div>
    </div>

    {_section("🗓️ Retrageri viitoare", up_rows, "✅ Nicio retragere în fereastra de alertă. Toate planurile sunt sub control.", len(up))}
    {_section("⚠️ Overlap colecții partajate", ov_rows, "✅ Nicio suprapunere — agenții activi nu împart date cu cei depreciati.", len(ov))}
    {_section("🔧 Provider risk", pr_rows, "✅ Niciun agent pe providerii flag-uiți ca sunset-risk.", len(pr))}

    <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:14px;text-align:center;margin-bottom:14px">
      <div style="font-size:13px;color:#0c4a6e;margin-bottom:8px">Vezi planul complet:</div>
      <a href="https://propmanage.ro/admin/ai-governance" style="display:inline-block;background:#ef4444;color:#fff;text-decoration:none;padding:8px 16px;border-radius:8px;font-size:13px;font-weight:600">Deschide AI Governance →</a>
    </div>

    <div style="padding-top:14px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;text-align:center">
      Trimis automat joi 09:30 (Europe/Bucharest) · Dezactivează din Admin → AI Governance → Pulse
    </div>
  </div>
</div>
</body></html>""".strip()


async def send_pulse(force: bool = False, override_recipients: Optional[list] = None) -> dict:
    cfg = await _load_config()
    if not force and not cfg["enabled"]:
        return {"skipped": "disabled"}
    recipients = override_recipients or cfg["recipients"]
    if not recipients:
        return {"skipped": "no_recipients"}

    data = await _gather_pulse_data(cfg["alert_window_days"])
    html = _build_html(data)
    c = data["counts"]
    subject = f"PropManage · Deprecation Pulse · {c['upcoming']} retrageri, {c['overlap']} overlap, {c['provider_risk']} provider-risk"

    try:
        await send_email(recipients, subject, html)
        sent_ok = True
        error = None
    except Exception as e:  # noqa: BLE001
        logger.warning(f"[deprecation_pulse] email send failed: {e}")
        sent_ok = False
        error = str(e)[:200]

    now_iso = datetime.now(timezone.utc).isoformat()
    if sent_ok:
        await db.deprecation_pulse_config.update_one(
            {"_id": "config"}, {"$set": {"last_sent_at": now_iso}}, upsert=True,
        )

    history_doc = {
        "sent_at": now_iso,
        "recipients": recipients,
        "subject": subject,
        "ok": sent_ok,
        "error": error,
        "counts": c,
        "forced": bool(force),
    }
    try:
        await db.deprecation_pulse_history.insert_one(history_doc)
        cur = db.deprecation_pulse_history.find({}, {"_id": 1}).sort("sent_at", -1).skip(50)
        old = [d["_id"] async for d in cur]
        if old:
            await db.deprecation_pulse_history.delete_many({"_id": {"$in": old}})
    except Exception as e:  # noqa: BLE001
        logger.warning(f"[deprecation_pulse] history persist failed: {e}")

    history_doc.pop("_id", None)
    return history_doc


async def run_deprecation_pulse_job() -> dict:
    """APScheduler entrypoint — Thursdays 09:30 Europe/Bucharest."""
    logger.info("[deprecation_pulse] scheduled run started")
    result = await send_pulse(force=False)
    logger.info(f"[deprecation_pulse] scheduled run done: {result.get('subject') or result.get('skipped')}")
    return result


# ----------------------------------------------------------------------
# API endpoints
# ----------------------------------------------------------------------

class ConfigPatch(BaseModel):
    enabled: Optional[bool] = None
    recipients: Optional[list] = None
    alert_window_days: Optional[int] = Field(default=None, ge=7, le=180)


class SendNowPayload(BaseModel):
    recipients: Optional[list] = None


@router.get("/config")
async def get_config(user=Depends(require_role("admin"))):
    return await _load_config()


@router.put("/config")
async def update_config(patch: ConfigPatch, user=Depends(require_role("admin"))):
    update = {}
    if patch.enabled is not None:
        update["enabled"] = patch.enabled
    if patch.recipients is not None:
        valid = [e.strip() for e in patch.recipients if isinstance(e, str) and EMAIL_RE.match(e.strip())]
        update["recipients"] = valid
    if patch.alert_window_days is not None:
        update["alert_window_days"] = int(patch.alert_window_days)
    if update:
        await db.deprecation_pulse_config.update_one(
            {"_id": "config"}, {"$set": update}, upsert=True,
        )
    return await _load_config()


@router.get("/preview")
async def preview_pulse(user=Depends(require_role("admin"))):
    cfg = await _load_config()
    data = await _gather_pulse_data(cfg["alert_window_days"])
    html = _build_html(data)
    return {"data": data, "html": html}


@router.post("/send-now")
async def send_now(payload: SendNowPayload = Body(default=None), user=Depends(require_role("admin"))):
    overrides = payload.recipients if payload else None
    result = await send_pulse(force=True, override_recipients=overrides)
    return result


@router.get("/history")
async def get_history(limit: int = 20, user=Depends(require_role("admin"))):
    cursor = db.deprecation_pulse_history.find({}).sort("sent_at", -1).limit(limit)
    items = []
    async for d in cursor:
        d.pop("_id", None)
        items.append(d)
    return {"items": items}
