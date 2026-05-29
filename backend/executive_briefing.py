"""PropManage — Weekly Executive Briefing.

Aggregates platform health KPIs over the last 7 days and emails a single
shareable HTML report to ADMIN_EMAILS every Monday 09:30 (after the daily
Morning Briefing at 09:00). The output is intentionally "investor-ready":
- WoW (week-over-week) deltas for the most important metrics
- Top 3 dispute root causes (NLP keyword cluster from `reason` field)
- Release-gate health: total runs + total pass + total fail + max P0 fail
- GMV, completed jobs, new signups, verified specialists growth

Endpoint helpers live in `routes/admin_exec_briefing.py`.
"""
from __future__ import annotations

import os
import re
import logging
from collections import Counter
from datetime import datetime, timezone, timedelta
from typing import Optional

from db import db

logger = logging.getLogger("propmanage.exec_briefing")


# ---------------------------------------------------------------------------
# Window helpers
# ---------------------------------------------------------------------------

def _windows() -> dict:
    now = datetime.now(timezone.utc)
    return {
        "now": now,
        "wk_start": now - timedelta(days=7),
        "prev_wk_start": now - timedelta(days=14),
        "prev_wk_end": now - timedelta(days=7),
    }


def _delta(curr: int, prev: int) -> dict:
    diff = curr - prev
    pct = (diff / prev * 100) if prev else (100.0 if curr else 0.0)
    return {"curr": curr, "prev": prev, "diff": diff, "pct": round(pct, 1)}


# ---------------------------------------------------------------------------
# Metric aggregators
# ---------------------------------------------------------------------------

async def _user_metrics(w: dict) -> dict:
    verified_curr = await db.users.count_documents({"role": "specialist", "verified": True})
    new_specialists = await db.users.count_documents({
        "role": "specialist", "created_at": {"$gte": w["wk_start"].isoformat()},
    })
    new_clients = await db.users.count_documents({
        "role": "client", "created_at": {"$gte": w["wk_start"].isoformat()},
    })
    new_specialists_prev = await db.users.count_documents({
        "role": "specialist",
        "created_at": {"$gte": w["prev_wk_start"].isoformat(), "$lt": w["prev_wk_end"].isoformat()},
    })
    new_clients_prev = await db.users.count_documents({
        "role": "client",
        "created_at": {"$gte": w["prev_wk_start"].isoformat(), "$lt": w["prev_wk_end"].isoformat()},
    })
    # Verified delta — count "verified_at" if present, otherwise count those created+verified in window
    verified_in_week = await db.users.count_documents({
        "role": "specialist", "verified": True,
        "verified_at": {"$gte": w["wk_start"].isoformat()},
    })
    return {
        "verified_total": verified_curr,
        "verified_in_week": verified_in_week,
        "new_specialists": _delta(new_specialists, new_specialists_prev),
        "new_clients": _delta(new_clients, new_clients_prev),
    }


async def _job_metrics(w: dict) -> dict:
    completed_week = await db.requests.count_documents({
        "status": "completed", "completed_at": {"$gte": w["wk_start"].isoformat()},
    })
    completed_prev = await db.requests.count_documents({
        "status": "completed",
        "completed_at": {"$gte": w["prev_wk_start"].isoformat(), "$lt": w["prev_wk_end"].isoformat()},
    })
    active = await db.requests.count_documents({"status": {"$in": ["assigned", "in_progress"]}})

    # GMV — sum escrow_amount on completed jobs this week
    gmv_curr = 0.0
    async for d in db.requests.find(
        {"status": "completed", "completed_at": {"$gte": w["wk_start"].isoformat()}},
        {"escrow_amount": 1},
    ):
        gmv_curr += float(d.get("escrow_amount") or 0)
    gmv_prev = 0.0
    async for d in db.requests.find(
        {
            "status": "completed",
            "completed_at": {"$gte": w["prev_wk_start"].isoformat(), "$lt": w["prev_wk_end"].isoformat()},
        },
        {"escrow_amount": 1},
    ):
        gmv_prev += float(d.get("escrow_amount") or 0)

    return {
        "completed": _delta(completed_week, completed_prev),
        "active": active,
        "gmv": _delta(int(gmv_curr), int(gmv_prev)),
    }


async def _dispute_metrics(w: dict) -> dict:
    """Group disputes opened this week by simple keyword buckets in `reason`."""
    new_disputes = await db.disputes.count_documents({
        "opened_at": {"$gte": w["wk_start"].isoformat()},
    })
    prev_disputes = await db.disputes.count_documents({
        "opened_at": {"$gte": w["prev_wk_start"].isoformat(), "$lt": w["prev_wk_end"].isoformat()},
    })
    resolved_week = await db.disputes.count_documents({
        "resolved_at": {"$gte": w["wk_start"].isoformat()},
    })

    # Top 3 reason clusters (heuristic — fast and dependency-free)
    buckets = {
        "lucrare incompletă / nefinalizată": re.compile(r"incomplet|nefinaliz|abandon|nu (a )?venit|nu (a )?făcut|nu a finalizat", re.I),
        "calitate slabă a execuției": re.compile(r"calita|prost|defect|stricat|nu funcț|reface|nerespect", re.I),
        "întârziere termen": re.compile(r"întârz|târziu|termen|amân|deadline", re.I),
        "facturare / preț neclar": re.compile(r"factur|pretul|prea scump|extra|suplim|costuri", re.I),
        "comunicare / dispariție": re.compile(r"nu răspunde|comunic|ignor|nu mai", re.I),
    }
    counter: Counter = Counter()
    async for d in db.disputes.find(
        {"opened_at": {"$gte": w["wk_start"].isoformat()}},
        {"reason": 1},
    ):
        reason = (d.get("reason") or "").strip()
        matched = False
        for label, pat in buckets.items():
            if pat.search(reason):
                counter[label] += 1
                matched = True
                break
        if not matched and reason:
            counter["altă cauză"] += 1

    top3 = counter.most_common(3)
    return {
        "new": _delta(new_disputes, prev_disputes),
        "resolved": resolved_week,
        "top3_reasons": [{"label": lbl, "count": n} for lbl, n in top3],
    }


async def _release_gate_metrics(w: dict) -> dict:
    cursor = db.release_gates.find(
        {"started_at": {"$gte": w["wk_start"].isoformat()}},
        {"summary": 1, "started_at": 1, "triggered_by": 1, "gate_id": 1},
    ).sort("started_at", -1)
    total_runs = 0
    total_pass = 0
    total_fail = 0
    max_p0 = 0
    last_run: Optional[dict] = None
    async for d in cursor:
        s = d.get("summary") or {}
        total_runs += 1
        total_pass += int(s.get("pass") or 0)
        total_fail += int(s.get("fail") or 0)
        max_p0 = max(max_p0, int(s.get("p0_fail") or 0))
        if last_run is None:
            last_run = {
                "gate_id": d.get("gate_id"),
                "verdict": s.get("verdict") or ("BLOCKED" if s.get("blocked") else "READY"),
                "pass": s.get("pass"),
                "total": s.get("total"),
                "fail": s.get("fail"),
                "p0_fail": s.get("p0_fail"),
                "ran_at": d.get("started_at"),
                "triggered_by": d.get("triggered_by"),
            }
    return {
        "total_runs": total_runs,
        "total_pass": total_pass,
        "total_fail": total_fail,
        "max_p0_fail": max_p0,
        "last_run": last_run,
    }


async def compute_exec_briefing() -> dict:
    w = _windows()
    users = await _user_metrics(w)
    jobs = await _job_metrics(w)
    disputes = await _dispute_metrics(w)
    gate = await _release_gate_metrics(w)
    return {
        "generated_at": w["now"].isoformat(),
        "window_start": w["wk_start"].isoformat(),
        "window_end": w["now"].isoformat(),
        "users": users,
        "jobs": jobs,
        "disputes": disputes,
        "release_gate": gate,
    }


# ---------------------------------------------------------------------------
# HTML rendering
# ---------------------------------------------------------------------------

def _delta_chip(d: dict, unit: str = "") -> str:
    diff, pct = d["diff"], d["pct"]
    if diff > 0:
        color, sign = "#34d399", "▲"
    elif diff < 0:
        color, sign = "#fca5a5", "▼"
    else:
        color, sign = "#9ca3af", "→"
    return (
        f'<span style="display:inline-block;font-size:11px;color:{color};font-weight:600;">'
        f'{sign} {abs(diff)}{unit} ({pct:+.1f}%)</span>'
    )


def _metric_row(label: str, value: str, delta_html: str = "") -> str:
    return (
        f'<tr><td style="padding:10px 14px;border-bottom:1px solid #232329;">'
        f'<div style="color:#9ca3af;font-size:11px;text-transform:uppercase;letter-spacing:1px;">{label}</div>'
        f'<div style="color:#fff;font-size:18px;font-weight:600;margin-top:2px;">{value} {delta_html}</div>'
        f"</td></tr>"
    )


def _render_exec_briefing_html(payload: dict, app_url: str) -> str:
    u = payload["users"]
    j = payload["jobs"]
    d = payload["disputes"]
    g = payload["release_gate"]
    last_gate = g.get("last_run") or {}

    week_label = (
        datetime.fromisoformat(payload["window_start"].replace("Z", "+00:00")).strftime("%d %b")
        + " → "
        + datetime.fromisoformat(payload["window_end"].replace("Z", "+00:00")).strftime("%d %b %Y")
    )

    gate_ok = (last_gate.get("verdict") == "READY")
    gate_color = "#34d399" if gate_ok else "#ef4444"
    gate_label = "READY" if gate_ok else "BLOCKED"

    rows: list[str] = []
    rows.append(_metric_row("Lucrări finalizate", str(j["completed"]["curr"]), _delta_chip(j["completed"])))
    rows.append(_metric_row("GMV (RON)", f"{j['gmv']['curr']:,}".replace(",", "."), _delta_chip(j["gmv"], " RON")))
    rows.append(_metric_row("Specialiști noi", str(u["new_specialists"]["curr"]), _delta_chip(u["new_specialists"])))
    rows.append(_metric_row("Clienți noi", str(u["new_clients"]["curr"]), _delta_chip(u["new_clients"])))
    rows.append(_metric_row(
        "Specialiști VERIFIED (total)",
        str(u["verified_total"]),
        f'<span style="font-size:11px;color:#9ca3af;">+{u["verified_in_week"]} această săptămână</span>',
    ))
    rows.append(_metric_row("Dispute deschise", str(d["new"]["curr"]), _delta_chip(d["new"])))
    rows.append(_metric_row("Dispute rezolvate", str(d["resolved"]), ""))
    rows.append(_metric_row("Lucrări active acum", str(j["active"]), ""))
    rows_html = "".join(rows)

    # Top 3 dispute reasons
    if d["top3_reasons"]:
        reason_items = "".join(
            f'<li style="margin-bottom:6px;color:#d1d5db;"><strong style="color:#fff;">{r["count"]}×</strong> {r["label"]}</li>'
            for r in d["top3_reasons"]
        )
        reasons_html = (
            f'<div style="margin:18px 0;background:#1a1a1f;border:1px solid #232329;border-radius:12px;padding:14px 18px;">'
            f'<div style="color:#fbbf24;font-size:11px;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:8px;">Top 3 cauze dispute săptămâna asta</div>'
            f'<ol style="margin:0;padding-left:18px;">{reason_items}</ol>'
            f"</div>"
        )
    else:
        reasons_html = (
            '<div style="margin:18px 0;background:#0f3a2a;border:1px solid #34d39944;border-radius:12px;padding:14px 18px;color:#a7f3d0;font-size:13px;">'
            "Niciun litigiu deschis săptămâna asta. 🎉</div>"
        )

    # Release gate panel
    rg_html = (
        f'<div style="margin:18px 0;background:{gate_color}15;border:1px solid {gate_color}55;border-radius:12px;padding:14px 18px;">'
        f'<div style="color:{gate_color};font-size:11px;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:6px;">Release Gate · {gate_label}</div>'
        f'<div style="color:#fff;font-size:14px;">'
        f'{g["total_runs"]} runs această săptămână · ultimul: <strong>{last_gate.get("pass") or 0}/{last_gate.get("total") or 0} pass</strong>'
        f' · P0 fail max: <strong>{g["max_p0_fail"]}</strong></div>'
        f"</div>"
    )

    return f"""
      <p style="color:#c8c8cc;">Bună dimineața,</p>
      <p style="color:#c8c8cc;">Iată briefing-ul executiv <strong>PropManage</strong> pentru săptămâna <strong>{week_label}</strong>:</p>

      {rg_html}

      <table border="0" cellpadding="0" cellspacing="0" style="width:100%;background:#1a1a1f;border-radius:14px;margin:18px 0;overflow:hidden;">
        {rows_html}
      </table>

      {reasons_html}

      <p style="color:#a8a8b0;font-size:13px;margin-top:22px;">Pentru detalii live: <a href="{app_url}/admin" style="color:#d4ff3a;">Admin Console</a> · <a href="{app_url}/trust" style="color:#d4ff3a;">Trust Center</a></p>

      <p>
        <a href="{app_url}/admin" style="display:inline-block;padding:12px 22px;background:#d4ff3a;color:#0a0a0b;text-decoration:none;border-radius:999px;font-weight:700;font-size:13px;letter-spacing:0.3px;">
          Deschide Admin Console
        </a>
      </p>
      <p style="color:#666;font-size:11px;margin-top:18px;">
        Briefing executiv săptămânal · expediat Luni 09:30 (Europe/Bucharest). Investor-ready: share cu board, board observer sau echipa core.
      </p>
    """


# ---------------------------------------------------------------------------
# Sender
# ---------------------------------------------------------------------------

def _admin_recipients() -> list[str]:
    raw = os.environ.get("ADMIN_EMAILS", "") or os.environ.get("ADMIN_EMAIL", "")
    return [e.strip() for e in raw.split(",") if e.strip()]


async def send_exec_briefing_email(force: bool = True) -> dict:
    """Send the weekly executive briefing. Defaults force=True (always send on schedule)."""
    payload = await compute_exec_briefing()
    recipients = _admin_recipients()
    if not recipients:
        logger.warning("[ExecBriefing] no ADMIN_EMAILS configured")
        return {"sent": False, "reason": "no_recipients", "recipients": 0}

    app_url = os.environ.get("APP_PUBLIC_URL", "https://propmanage.ro")
    from email_service import _layout, send_email  # lazy import

    body_html = _render_exec_briefing_html(payload, app_url)
    week_label = datetime.fromisoformat(payload["window_end"].replace("Z", "+00:00")).strftime("%d %b %Y")
    subject = f"📈 PropManage Executive Briefing · săptămâna {week_label}"
    html = _layout(
        title="Executive Briefing",
        preheader="KPI-uri săptămânale: GMV, lucrări, specialiști, dispute, release gate",
        body_html=body_html,
        cta_url=f"{app_url}/admin",
        cta_label="Vezi în Admin",
    )

    sent_count = 0
    for r in recipients:
        try:
            res = await send_email(r, subject, html)
            if res.get("ok"):
                sent_count += 1
        except Exception as e:  # noqa: BLE001
            logger.error(f"[ExecBriefing] send to {r} failed: {e}")

    # Persist for the admin preview / audit
    try:
        await db.exec_briefings.insert_one({
            "sent_at": payload["generated_at"],
            "recipients": recipients,
            "sent_count": sent_count,
            "payload": payload,
            "forced": bool(force),
        })
    except Exception as e:  # noqa: BLE001
        logger.warning(f"[ExecBriefing] persist failed: {e}")

    logger.info(f"[ExecBriefing] sent to {sent_count}/{len(recipients)} admin(s)")
    return {
        "sent": sent_count > 0,
        "reason": "delivered" if sent_count > 0 else "all_failed",
        "recipients": sent_count,
        "total_recipients": len(recipients),
    }


async def run_exec_briefing_job() -> None:
    """APScheduler entrypoint — fire-and-forget, never raises."""
    try:
        await send_exec_briefing_email(force=True)
    except Exception as e:  # noqa: BLE001
        logger.error(f"[ExecBriefing][cron] failed: {e}")
