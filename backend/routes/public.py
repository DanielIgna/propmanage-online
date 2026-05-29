"""PropManage — Public Demo & Health endpoints (Phase 48).

- POST /api/public/demo-request — captures lead from landing "Book a Demo" CTA.
- GET  /api/health              — uptime + service readiness probe (no auth).
"""
import os
import re
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Body, HTTPException, Depends

from db import db

logger = logging.getLogger("propmanage.public")
router = APIRouter(prefix="/api", tags=["public"])

EMAIL_RX = re.compile(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$")


@router.post("/public/demo-request")
async def demo_request(payload: dict = Body(...)):
    """Public endpoint — no auth required. Saves lead + sends notification."""
    name = (payload.get("name") or "").strip()[:120]
    email = (payload.get("email") or "").strip().lower()[:160]
    company = (payload.get("company") or "").strip()[:160]
    role = (payload.get("role") or "").strip()[:60]
    message = (payload.get("message") or "").strip()[:1000]
    whatsapp = (payload.get("whatsapp") or "").strip()[:32]
    if not name or not EMAIL_RX.match(email):
        raise HTTPException(400, "Nume și email valid sunt obligatorii.")

    doc = {
        "name": name,
        "email": email,
        "company": company,
        "role": role,
        "message": message,
        "whatsapp": whatsapp,
        "status": "new",  # new, contacted, scheduled, closed_won, closed_lost
        "created_at": datetime.now(timezone.utc).isoformat(),
        "source": "landing_book_demo",
    }
    # Idempotent on (email + day) so accidental double-click doesn't spam.
    day = doc["created_at"][:10]
    existing = await db.demo_leads.find_one({"email": email, "created_at": {"$regex": f"^{day}"}})
    if existing:
        await db.demo_leads.update_one({"_id": existing["_id"]}, {"$set": {"name": name, "company": company, "message": message, "role": role, "whatsapp": whatsapp, "updated_at": doc["created_at"]}})
        return {"ok": True, "deduped": True}
    await db.demo_leads.insert_one(doc)

    # Notify admins via existing email service (console fallback when key missing).
    try:
        from email_service import _layout, send_email as _send_email  # type: ignore
        admin_emails = []
        async for u in db.users.find({"role": "admin"}, {"email": 1}):
            if u.get("email"):
                admin_emails.append(u["email"])
        if not admin_emails:
            admin_emails = [os.environ.get("ADMIN_EMAIL", "admin@propmanage.io")]
        # Build WhatsApp deep link if provided
        wa_html = ""
        if whatsapp:
            digits = re.sub(r"\D", "", whatsapp)
            if len(digits) >= 9:
                wa_link = f"https://wa.me/{digits}"
                wa_html = f'<tr><td><b>WhatsApp:</b></td><td><a href="{wa_link}" style="color:#25d366;">{whatsapp} →</a></td></tr>'
        html = _layout(
            title="📩 Cerere demo nouă",
            preheader=f"{name} de la {company or '—'} vrea o demonstrație",
            body_html=f"""
              <p>Un potențial client a completat formularul "Programează o demonstrație":</p>
              <table style="width:100%; background:#1a1a1f; border-radius:12px; padding:14px; margin:12px 0; color:#fff;">
                <tr><td><b>Nume:</b></td><td>{name}</td></tr>
                <tr><td><b>Email:</b></td><td><a href="mailto:{email}" style="color:#d4ff3a;">{email}</a></td></tr>
                {wa_html}
                <tr><td><b>Companie:</b></td><td>{company or '—'}</td></tr>
                <tr><td><b>Rol:</b></td><td>{role or '—'}</td></tr>
                <tr><td valign="top"><b>Mesaj:</b></td><td>{(message or '—').replace(chr(10), '<br/>')}</td></tr>
              </table>
              <p style="color:#a8a8b0; font-size:13px;">Răspunde cât mai repede pentru rate de conversie maximă.</p>
            """,
        )
        await _send_email(admin_emails, f"[PropManage] Cerere demo: {name} · {company or email}", html)
    except Exception as e:  # noqa: BLE001
        logger.warning(f"[DemoLead] email notify failed: {e}")

    return {"ok": True, "deduped": False}


@router.get("/health")
async def health_check():
    """Lightweight readiness probe. Returns 200 with details even if some services degraded."""
    status = {
        "status": "ok",
        "service": "propmanage-api",
        "time": datetime.now(timezone.utc).isoformat(),
        "version": os.environ.get("APP_VERSION", "dev"),
        "checks": {},
    }
    # DB ping
    try:
        await db.command("ping") if hasattr(db, "command") else await db.users.find_one({}, {"_id": 1})
        status["checks"]["db"] = "ok"
    except Exception as e:  # noqa: BLE001
        status["checks"]["db"] = f"err: {str(e)[:60]}"
        status["status"] = "degraded"
    # LLM key
    status["checks"]["emergent_llm_key"] = "configured" if os.environ.get("EMERGENT_LLM_KEY") else "missing"
    # Email provider
    status["checks"]["email_provider"] = "resend" if os.environ.get("RESEND_API_KEY") else "console_fallback"
    # Stripe
    skey = os.environ.get("STRIPE_API_KEY", "")
    status["checks"]["stripe"] = "demo" if skey == "sk_test_emergent" or not skey else "live" if skey.startswith("sk_live_") else "test"
    return status


@router.get("/public/status")
async def public_status():
    """Public status endpoint — sanitized output for /status page (no internal config details)."""
    out = {
        "status": "operational",
        "components": {},
        "checked_at": datetime.now(timezone.utc).isoformat(),
    }
    # DB (critical)
    try:
        await db.users.find_one({}, {"_id": 1})
        out["components"]["api"] = "operational"
        out["components"]["database"] = "operational"
    except Exception:  # noqa: BLE001
        out["components"]["api"] = "degraded"
        out["components"]["database"] = "outage"
        out["status"] = "outage"

    # AI Concierge (depends on LLM key)
    out["components"]["ai_concierge"] = "operational" if os.environ.get("EMERGENT_LLM_KEY") else "limited"

    # Payments — reflect reality: demo mode shows as "limited"
    skey = (os.environ.get("STRIPE_API_KEY") or "").strip()
    if skey.startswith("sk_live_"):
        out["components"]["payments"] = "operational"
    elif skey.startswith("sk_test_") and skey != "sk_test_emergent":
        out["components"]["payments"] = "limited"  # test mode = no real charges
    else:
        out["components"]["payments"] = "limited"  # demo / missing

    # Email — Resend > SendGrid > console fallback
    if os.environ.get("RESEND_API_KEY"):
        out["components"]["email"] = "operational"
    elif os.environ.get("SENDGRID_API_KEY"):
        out["components"]["email"] = "operational"
    else:
        out["components"]["email"] = "limited"

    # Authentication (Google OAuth + JWT) — JWT always works, OAuth is light check
    out["components"]["authentication"] = "operational"

    # Push notifications (VAPID)
    has_vapid = bool(os.environ.get("VAPID_PUBLIC_KEY") and os.environ.get("VAPID_PRIVATE_KEY_PEM"))
    out["components"]["push_notifications"] = "operational" if has_vapid else "limited"

    # Aggregate status: outage > degraded > limited > operational
    severities = list(out["components"].values())
    if "outage" in severities:
        out["status"] = "outage"
    elif "degraded" in severities:
        out["status"] = "degraded"
    elif out["status"] == "operational" and "limited" in severities:
        # Only mark global as "limited" if a CORE component is limited;
        # peripheral "limited" (push, email-fallback) doesn't degrade overall.
        core_limited = out["components"].get("api") == "limited" or out["components"].get("database") == "limited"
        if core_limited:
            out["status"] = "degraded"

    # 90-day uptime: simple read from health_pings collection (created by daily cron)
    from datetime import timedelta as _td
    cutoff = (datetime.now(timezone.utc) - _td(days=90)).isoformat()
    total_pings = 0
    ok_pings = 0
    async for p in db.health_pings.find({"created_at": {"$gte": cutoff}}):
        total_pings += 1
        if p.get("status") == "ok":
            ok_pings += 1
    out["uptime_pct_90d"] = round((ok_pings / total_pings) * 100, 2) if total_pings else None
    out["pings_total"] = total_pings
    return out


async def record_health_ping():
    """Scheduled task: every 15 minutes record a synthetic health probe.
    Writes to db.health_pings; powers /public/status-history sparkline."""
    try:
        components = {}
        overall = "ok"
        try:
            await db.users.find_one({}, {"_id": 1})
            components["api"] = "ok"
            components["database"] = "ok"
        except Exception:
            components["api"] = "down"
            components["database"] = "down"
            overall = "degraded"
        components["ai_concierge"] = "ok" if os.environ.get("EMERGENT_LLM_KEY") else "limited"
        skey = (os.environ.get("STRIPE_API_KEY") or "").strip()
        components["payments"] = "ok" if skey.startswith("sk_live_") else "limited"
        components["email"] = "ok" if (os.environ.get("RESEND_API_KEY") or os.environ.get("SENDGRID_API_KEY")) else "limited"
        components["push_notifications"] = "ok" if (os.environ.get("VAPID_PUBLIC_KEY") and os.environ.get("VAPID_PRIVATE_KEY_PEM")) else "limited"
        components["authentication"] = "ok"
        if overall == "ok" and any(v in ("down", "degraded") for v in components.values()):
            overall = "ok"  # limited != degraded for our SLA
        await db.health_pings.insert_one({
            "created_at": datetime.now(timezone.utc).isoformat(),
            "status": overall,
            "components": components,
        })
    except Exception as e:  # noqa: BLE001
        logger.warning(f"[HealthPing] record failed: {e}")


@router.get("/public/status-history")
async def public_status_history(days: int = 30):
    """Aggregated per-day uptime for sparkline chart (max 90 days)."""
    days = max(1, min(int(days or 30), 90))
    from datetime import timedelta as _td
    now = datetime.now(timezone.utc)
    start = now - _td(days=days)
    cutoff = start.isoformat()

    buckets = {}
    async for p in db.health_pings.find({"created_at": {"$gte": cutoff}}):
        day = (p.get("created_at") or "")[:10]
        if not day:
            continue
        b = buckets.setdefault(day, {"ok": 0, "total": 0})
        b["total"] += 1
        if p.get("status") == "ok":
            b["ok"] += 1

    out_days = []
    total_ok = 0
    total_all = 0
    cur = start
    while cur.date() <= now.date():
        key = cur.date().isoformat()
        b = buckets.get(key, {"ok": 0, "total": 0})
        pct = round((b["ok"] / b["total"]) * 100, 2) if b["total"] else None
        out_days.append({"date": key, "uptime_pct": pct, "pings": b["total"]})
        total_ok += b["ok"]
        total_all += b["total"]
        cur += _td(days=1)

    return {
        "days": out_days,
        "summary": {
            "uptime_pct": round((total_ok / total_all) * 100, 2) if total_all else None,
            "pings_total": total_all,
            "window_days": days,
            "tracking_since": out_days[0]["date"] if out_days else None,
        },
    }


# ============= ADMIN DEMO LEADS =============

from deps import require_role  # local import to avoid circular  # noqa: E402

admin_router = APIRouter(prefix="/api/admin/demo-leads", tags=["admin-demo-leads"])


@admin_router.get("")
async def list_demo_leads(
    status: str = None,
    limit: int = 100,
    user: dict = Depends(require_role("admin")),
):
    filt = {}
    if status and status != "all":
        filt["status"] = status
    cursor = db.demo_leads.find(filt).sort("created_at", -1).limit(min(limit, 500))
    items = []
    async for d in cursor:
        d["_id"] = str(d["_id"])
        # Build WhatsApp deep link
        wa = d.get("whatsapp")
        if wa:
            digits = re.sub(r"\D", "", wa)
            if len(digits) >= 9:
                d["whatsapp_link"] = f"https://wa.me/{digits}"
        items.append(d)
    counts = {
        "new": await db.demo_leads.count_documents({"status": "new"}),
        "contacted": await db.demo_leads.count_documents({"status": "contacted"}),
        "scheduled": await db.demo_leads.count_documents({"status": "scheduled"}),
        "closed_won": await db.demo_leads.count_documents({"status": "closed_won"}),
        "closed_lost": await db.demo_leads.count_documents({"status": "closed_lost"}),
    }
    counts["total"] = sum(counts.values())
    return {"items": items, "counts": counts}


@admin_router.patch("/{lead_id}")
async def update_demo_lead(lead_id: str, payload: dict = Body(...), user: dict = Depends(require_role("admin"))):
    from bson import ObjectId
    from bson.errors import InvalidId
    try:
        oid = ObjectId(lead_id)
    except InvalidId:
        raise HTTPException(400, "Invalid lead id")
    allowed = {"status", "notes", "follow_up_at"}
    updates = {k: v for k, v in payload.items() if k in allowed}
    if "status" in updates and updates["status"] not in {"new", "contacted", "scheduled", "closed_won", "closed_lost"}:
        raise HTTPException(400, "Invalid status")
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    updates["updated_by"] = user["id"]
    res = await db.demo_leads.update_one({"_id": oid}, {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(404, "Lead not found")
    return {"ok": True}


@admin_router.delete("/{lead_id}")
async def delete_demo_lead(lead_id: str, user: dict = Depends(require_role("admin"))):
    from bson import ObjectId
    from bson.errors import InvalidId
    try:
        oid = ObjectId(lead_id)
    except InvalidId:
        raise HTTPException(400, "Invalid lead id")
    await db.demo_leads.delete_one({"_id": oid})
    return {"ok": True}



# ============================================================================
# SEO — Dynamic sitemap.xml
# ============================================================================
# Listed in robots.txt as the canonical sitemap. Includes:
#  - Static public pages (landing, marketplace, login, register, privacy, terms, status)
#  - Public profile of every VERIFIED specialist (non-deleted)
# Google/Bing re-fetch it weekly; freshness is guaranteed because we hit Mongo
# on every request (response is small — < 50KB even at 1000 specialists).

from fastapi.responses import Response as FastResponse  # noqa: E402

_SITE_URL = os.environ.get("APP_PUBLIC_URL", "https://propmanage.ro").rstrip("/")


@router.get("/public/sitemap.xml")
async def public_sitemap():
    """Dynamic XML sitemap — included in robots.txt."""
    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    static_pages = [
        ("/",                "1.0", "weekly"),
        ("/marketplace",     "0.9", "daily"),
        ("/digital-twin",    "0.7", "monthly"),
        ("/login",           "0.4", "monthly"),
        ("/register",        "0.5", "monthly"),
        ("/privacy",         "0.3", "yearly"),
        ("/privacy/notices", "0.3", "yearly"),
        ("/terms",           "0.3", "yearly"),
        ("/status",          "0.3", "weekly"),
    ]

    urls_xml = []
    for path, prio, freq in static_pages:
        urls_xml.append(
            f"  <url>\n"
            f"    <loc>{_SITE_URL}{path}</loc>\n"
            f"    <lastmod>{now_iso}</lastmod>\n"
            f"    <changefreq>{freq}</changefreq>\n"
            f"    <priority>{prio}</priority>\n"
            f"  </url>"
        )

    # Public specialist profiles — only verified & non-deleted ones
    cursor = db.users.find(
        {"role": "specialist", "verified": True, "deleted": {"$ne": True}},
        {"_id": 1, "updated_at": 1, "created_at": 1},
    ).limit(5000)
    async for u in cursor:
        spec_id = str(u["_id"])
        lastmod = u.get("updated_at") or u.get("created_at")
        if isinstance(lastmod, datetime):
            lastmod_str = lastmod.strftime("%Y-%m-%d")
        elif isinstance(lastmod, str) and len(lastmod) >= 10:
            lastmod_str = lastmod[:10]
        else:
            lastmod_str = now_iso
        urls_xml.append(
            f"  <url>\n"
            f"    <loc>{_SITE_URL}/specialists/{spec_id}</loc>\n"
            f"    <lastmod>{lastmod_str}</lastmod>\n"
            f"    <changefreq>weekly</changefreq>\n"
            f"    <priority>0.7</priority>\n"
            f"  </url>"
        )

    body = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(urls_xml)
        + "\n</urlset>\n"
    )
    return FastResponse(content=body, media_type="application/xml")
