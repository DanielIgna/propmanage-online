"""Weekly Founders' Digest — Monday 09:30 Europe/Bucharest.

Aggregates top KPIs and emails super-admins (role=admin + admin_scope=general)
so they don't need to open the dashboard daily. Runs AFTER ``weekly_auto_tune_job``
so the digest reflects the freshly-tuned scores.
"""
import logging
from datetime import datetime, timezone, timedelta
from db import db

logger = logging.getLogger("propmanage.founder_digest")


async def _get_super_admins() -> list:
    out = []
    async for u in db.users.find(
        {"role": "admin", "$or": [{"admin_scope": "general"}, {"admin_scope": None}, {"admin_scope": {"$exists": False}}]},
        {"email": 1, "name": 1},
    ):
        if u.get("email"):
            out.append({"email": u["email"], "name": u.get("name") or "Founder"})
    return out


async def _gather_kpis() -> dict:
    """Compute the 5 headline numbers for the digest."""
    kpis = {}

    # 1. Autonomy general + tier (latest snapshot)
    snap = await db.autonomy_snapshots.find_one({}, sort=[("timestamp", -1)])
    kpis["autonomy_general"] = (snap or {}).get("scores", {}).get("general")
    kpis["autonomy_tier"] = (snap or {}).get("tier", "unknown")

    # 2. AI Health (today's row)
    today = datetime.now(timezone.utc).date().isoformat()
    h = await db.admin_ai_health_history.find_one({"day": today}) or {}
    kpis["ai_health_overall"] = h.get("overall")

    # 3. ROI saved (7 days) — approximate using ROI minute estimates
    cutoff_7d = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    auto_tune_runs = await db.autopilot_runs.count_documents({"kind": "auto_tune", "ran_at": {"$gte": cutoff_7d}})
    daily_sweeps = await db.autopilot_runs.count_documents({"kind": "daily_sweep", "ran_at": {"$gte": cutoff_7d}})
    auto_matched = await db.requests.count_documents({"created_at": {"$gte": cutoff_7d}, "specialist_id": {"$exists": True, "$ne": None}})
    auto_kyc = await db.kyc_documents.count_documents({"reviewed_at": {"$gte": cutoff_7d}, "auto_approved": True})
    minutes = (auto_tune_runs * 30) + (daily_sweeps * 10) + (auto_matched * 5) + (auto_kyc * 15)
    kpis["roi_hours_7d"] = round(minutes / 60.0, 1)
    kpis["roi_ron_7d"] = round((minutes / 60.0) * 150, 0)

    # 4. Tier streak — count consecutive days in current tier from snapshots
    streak_days = 0
    if kpis["autonomy_tier"]:
        cursor = db.autonomy_snapshots.find({}, {"tier": 1, "timestamp": 1}).sort("timestamp", -1).limit(60)
        async for s in cursor:
            if s.get("tier") == kpis["autonomy_tier"]:
                streak_days += 1
            else:
                break
    kpis["tier_streak_days"] = streak_days

    # 5. Auto-matched + auto-approved KYC counts (7 days)
    kpis["auto_matched_requests_7d"] = auto_matched
    kpis["auto_approved_kyc_7d"] = auto_kyc

    # 6. Tier downgrade alerts in last 7 days (count)
    kpis["downgrade_alerts_7d"] = await db.autonomy_alerts.count_documents({"sent_at": {"$gte": cutoff_7d}})

    return kpis


def _tier_color(tier: str) -> str:
    return {
        "self-driving": "#10b981",
        "autonomous": "#0ea5e9",
        "assisted": "#f59e0b",
        "manual": "#64748b",
    }.get(tier, "#64748b")


def _build_html(name: str, kpis: dict) -> str:
    tier = kpis.get("autonomy_tier") or "unknown"
    tier_label = tier.replace("-", " ").title()
    color = _tier_color(tier)
    streak_label = f"{kpis['tier_streak_days']} zi{'le' if kpis['tier_streak_days'] != 1 else ''}"
    return f"""
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:620px;margin:0 auto;color:#0f172a">
  <div style="background:linear-gradient(135deg,#7c3aed 0%,#0ea5e9 100%);border-radius:16px;padding:24px;color:white;margin-bottom:20px">
    <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.12em;opacity:0.85;font-weight:700">PropManage · Founders' Digest</div>
    <div style="font-size:24px;font-weight:800;margin-top:6px">Bună, {name} 👋</div>
    <div style="font-size:14px;opacity:0.9;margin-top:4px">Rezumat săptămânal autonomie (7 zile)</div>
  </div>

  <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
    <tr>
      <td style="background:{color}15;border:1px solid {color}40;border-radius:12px;padding:16px;width:50%" valign="top">
        <div style="font-size:10px;color:{color};text-transform:uppercase;letter-spacing:0.1em;font-weight:700">Autonomy Tier</div>
        <div style="font-size:22px;font-weight:800;color:{color};margin-top:4px">{tier_label}</div>
        <div style="font-size:13px;color:#475569;margin-top:2px">Scor general: <strong>{kpis.get('autonomy_general', '—')}</strong>/100</div>
        <div style="font-size:11px;color:#64748b;margin-top:6px">🔥 Streak: <strong>{streak_label}</strong> consecutive</div>
      </td>
      <td style="width:8px"></td>
      <td style="background:#ecfdf5;border:1px solid #10b98140;border-radius:12px;padding:16px;width:50%" valign="top">
        <div style="font-size:10px;color:#059669;text-transform:uppercase;letter-spacing:0.1em;font-weight:700">ROI 7 zile</div>
        <div style="font-size:22px;font-weight:800;color:#059669;margin-top:4px">{int(kpis.get('roi_ron_7d', 0)):,} RON</div>
        <div style="font-size:13px;color:#475569;margin-top:2px">Timp salvat: <strong>{kpis.get('roi_hours_7d', 0)}h</strong></div>
        <div style="font-size:11px;color:#64748b;margin-top:6px">≈ {int(kpis.get('roi_hours_7d', 0) / 8)} zile admin economisite</div>
      </td>
    </tr>
  </table>

  <div style="background:#f8fafc;border-radius:12px;padding:16px;margin-bottom:16px">
    <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;font-weight:700;margin-bottom:10px">Activitate automată (7 zile)</div>
    <table style="width:100%;font-size:14px">
      <tr>
        <td style="padding:6px 0;color:#475569">🎯 Cereri auto-asignate AI</td>
        <td style="padding:6px 0;text-align:right;font-weight:700">{kpis.get('auto_matched_requests_7d', 0)}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;color:#475569;border-top:1px solid #e2e8f0">🪪 KYC auto-aprobate AI</td>
        <td style="padding:6px 0;text-align:right;font-weight:700;border-top:1px solid #e2e8f0">{kpis.get('auto_approved_kyc_7d', 0)}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;color:#475569;border-top:1px solid #e2e8f0">🧠 AI Health Score</td>
        <td style="padding:6px 0;text-align:right;font-weight:700;border-top:1px solid #e2e8f0">{kpis.get('ai_health_overall', '—')}/100</td>
      </tr>
      <tr>
        <td style="padding:6px 0;color:#475569;border-top:1px solid #e2e8f0">⚠ Tier downgrade alerts</td>
        <td style="padding:6px 0;text-align:right;font-weight:700;border-top:1px solid #e2e8f0;color:{'#dc2626' if kpis.get('downgrade_alerts_7d', 0) > 0 else '#10b981'}">{kpis.get('downgrade_alerts_7d', 0)}</td>
      </tr>
    </table>
  </div>

  <div style="text-align:center;margin:24px 0">
    <a href="https://propmanage.ro/admin/autonomy"
       style="display:inline-block;background:#0f172a;color:white;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px">
      Vezi Autonomy Engine →
    </a>
  </div>

  <div style="text-align:center;font-size:11px;color:#94a3b8;margin-top:20px;padding-top:16px;border-top:1px solid #e2e8f0">
    Digest generat automat luni 09:30 Europa/București · trimis super-adminilor.<br>
    PropManage Autopilot · self-healing platform.
  </div>
</div>
""".strip()


async def weekly_founder_digest() -> dict:
    """APScheduler callable — sends weekly digest to super-admins."""
    logger.info("[founder_digest] starting...")
    kpis = await _gather_kpis()
    admins = await _get_super_admins()
    if not admins:
        return {"ok": False, "reason": "no_super_admins"}

    from services import send_email
    sent = 0
    failed = 0
    subject = f"📊 PropManage · {kpis.get('autonomy_tier', 'unknown').title()} · {int(kpis.get('roi_ron_7d', 0)):,} RON saved"

    for adm in admins:
        try:
            html = _build_html(adm["name"].split()[0], kpis)
            await send_email(adm["email"], subject, html)
            sent += 1
        except Exception as e:  # noqa: BLE001
            logger.warning(f"[founder_digest] failed for {adm['email']}: {e}")
            failed += 1

    try:
        await db.founder_digest_log.insert_one({
            "ran_at": datetime.now(timezone.utc).isoformat(),
            "kpis": kpis,
            "recipients_count": len(admins),
            "sent": sent,
            "failed": failed,
        })
    except Exception:  # noqa: BLE001
        pass

    logger.info(f"[founder_digest] done — sent={sent} failed={failed} tier={kpis.get('autonomy_tier')}")
    return {"ok": True, "sent": sent, "failed": failed, "kpis": kpis}
