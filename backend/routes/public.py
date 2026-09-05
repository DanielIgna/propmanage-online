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
        "tenant_id": "main",
        "status": "new",  # new, contacted, scheduled, closed_won, closed_lost
        "created_at": datetime.now(timezone.utc).isoformat(),
        "source": "landing_book_demo",
    }
    # Idempotent on (email + day) so accidental double-click doesn't spam.
    day = doc["created_at"][:10]
    existing = await db.demo_leads.find_one({"email": email, "created_at": {"$regex": f"^{day}"}})
    if existing:
        await db.demo_leads.update_one({"_id": existing["_id"]}, {"$set": {"name": name, "company": company, "message": message, "role": role, "whatsapp": whatsapp, "updated_at": doc["created_at"]}})
        from leads_store import sync_lead
        await sync_lead("demo", {**existing, "name": name, "company": company, "message": message})
        return {"ok": True, "deduped": True}
    ins = await db.demo_leads.insert_one(doc)
    from leads_store import sync_lead
    await sync_lead("demo", {**doc, "_id": ins.inserted_id})

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


# ============================================================================
# FRANCHISE APPLICATION — canal public de achiziție franchisees
# ============================================================================
# POST /api/public/franchise-application — capturează aplicația din pagina
# "Devino francizat PropManage" și o sincronizează în leads unificate cu
# source=franchise_application, segment triaged pe capacitate investițională.
INVESTMENT_TIERS = {
    "10-25k":  15000,
    "25-50k":  35000,
    "50-100k": 75000,
    "100k+":   150000,
}


@router.post("/public/franchise-application")
async def franchise_application(payload: dict = Body(...)):
    """Public — no auth. Aplicație francizat → franchise_applications + unified leads."""
    name = (payload.get("name") or "").strip()[:120]
    email = (payload.get("email") or "").strip().lower()[:160]
    phone = (payload.get("phone") or "").strip()[:32]
    city = (payload.get("city") or "").strip()[:80]
    occupation = (payload.get("occupation") or "").strip()[:160]
    investment = (payload.get("investment") or "").strip()[:32]  # tier key
    experience = (payload.get("experience") or "").strip()[:1200]
    message = (payload.get("message") or "").strip()[:1500]
    consent = bool(payload.get("consent"))

    if not name or not EMAIL_RX.match(email):
        raise HTTPException(400, "Nume și email valid sunt obligatorii.")
    if not phone or len(re.sub(r"\D", "", phone)) < 9:
        raise HTTPException(400, "Număr de telefon valid este obligatoriu.")
    if not city:
        raise HTTPException(400, "Orașul de interes este obligatoriu.")
    if not consent:
        raise HTTPException(400, "Consimțământul GDPR este obligatoriu.")

    estimated_value = INVESTMENT_TIERS.get(investment, 5000)

    now_iso = datetime.now(timezone.utc).isoformat()
    doc = {
        "name": name,
        "email": email,
        "phone": phone,
        "city": city,
        "occupation": occupation,
        "investment_tier": investment or "unknown",
        "estimated_value": estimated_value,
        "experience": experience,
        "message": message,
        "consent": consent,
        "status": "new",
        "tenant_id": "main",  # HQ owns franchisee acquisition
        "created_at": now_iso,
        "source": "franchise_application",
    }

    # Idempotent on (email + day)
    day = now_iso[:10]
    existing = await db.franchise_applications.find_one(
        {"email": email, "created_at": {"$regex": f"^{day}"}}
    )
    if existing:
        await db.franchise_applications.update_one(
            {"_id": existing["_id"]},
            {"$set": {**{k: v for k, v in doc.items() if k not in ("created_at",)},
                      "updated_at": now_iso}},
        )
        from leads_store import sync_lead
        await sync_lead("franchise_application", {**existing, **doc, "id": str(existing["_id"])})
        return {"ok": True, "deduped": True}

    ins = await db.franchise_applications.insert_one(doc)
    from leads_store import sync_lead
    await sync_lead("franchise_application", {**doc, "id": str(ins.inserted_id)})

    # Notify HQ admins
    try:
        from email_service import _layout, send_email as _send_email  # type: ignore
        admin_emails = []
        async for u in db.users.find({"role": "admin"}, {"email": 1}):
            if u.get("email"):
                admin_emails.append(u["email"])
        if not admin_emails:
            admin_emails = [os.environ.get("ADMIN_EMAIL", "admin@propmanage.io")]
        wa_html = ""
        digits = re.sub(r"\D", "", phone)
        if len(digits) >= 9:
            wa_html = f'<tr><td><b>WhatsApp:</b></td><td><a href="https://wa.me/{digits}" style="color:#25d366;">{phone} →</a></td></tr>'
        html = _layout(
            title="🏢 Aplicație nouă de francizat",
            preheader=f"{name} din {city} vrea să deschidă o franciză PropManage",
            body_html=f"""
              <p>O nouă aplicație pentru francizare PropManage a fost primită:</p>
              <table style="width:100%; background:#1a1a1f; border-radius:12px; padding:14px; margin:12px 0; color:#fff;">
                <tr><td><b>Nume:</b></td><td>{name}</td></tr>
                <tr><td><b>Email:</b></td><td><a href="mailto:{email}" style="color:#d4ff3a;">{email}</a></td></tr>
                <tr><td><b>Telefon:</b></td><td>{phone}</td></tr>
                {wa_html}
                <tr><td><b>Oraș:</b></td><td>{city}</td></tr>
                <tr><td><b>Ocupație curentă:</b></td><td>{occupation or '—'}</td></tr>
                <tr><td><b>Buget investiție:</b></td><td>{investment or '—'} EUR</td></tr>
                <tr><td valign="top"><b>Experiență:</b></td><td>{(experience or '—').replace(chr(10), '<br/>')}</td></tr>
                <tr><td valign="top"><b>Mesaj:</b></td><td>{(message or '—').replace(chr(10), '<br/>')}</td></tr>
              </table>
              <p style="color:#a8a8b0; font-size:13px;">Lead-ul apare automat în <b>Admin → Unified Leads</b> cu segment auto (hot/warm/nurture).</p>
            """,
        )
        await _send_email(admin_emails, f"[PropManage · Franciză] {name} din {city}", html)
    except Exception as e:  # noqa: BLE001
        logger.warning(f"[FranchiseApp] notify failed: {e}")

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
    """Dynamic XML sitemap — served at /api/public/sitemap.xml AND mirrored to
    the clean root /sitemap.xml (static file in frontend/public via write_sitemap_file)."""
    body = await build_sitemap_xml()
    return FastResponse(content=body, media_type="application/xml")


async def build_sitemap_xml() -> str:
    """Construiește XML-ul sitemap (folosit de endpoint + generatorul fișierului static root)."""
    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    static_pages = [
        ("/",                "1.0", "weekly"),
        ("/design-interior", "0.95", "weekly"),
        ("/devino-francizat", "0.9", "weekly"),
        ("/marketplace",     "0.9", "daily"),
        ("/ghiduri",         "0.85", "weekly"),
        ("/scorul-casei",    "0.9",  "weekly"),
        ("/checklist-cumparare", "0.9", "weekly"),
        ("/imobile-verificate", "0.9", "daily"),
        ("/digital-twin",    "0.7", "monthly"),
        ("/login",           "0.4", "monthly"),
        ("/register",        "0.5", "monthly"),
        ("/privacy",         "0.3", "yearly"),
        ("/privacy/notices", "0.3", "yearly"),
        ("/terms",           "0.3", "yearly"),
        ("/status",          "0.3", "weekly"),
    ]

    # Guide articles (mirror of frontend/src/data/ghiduri.js — keep in sync)
    guide_slugs = [
        ("cost-renovare-apartament-2-camere", "2026-02-29"),
        ("cum-alegi-designer-interior",        "2026-02-29"),
        ("cum-verifici-instalator",            "2026-02-29"),
        ("cost-instalatie-electrica-apartament", "2026-02-29"),
        ("cum-functioneaza-escrow-lucrari",    "2026-02-29"),
        ("cum-alegi-zugrav-bun",               "2026-02-29"),
        ("audit-tehnic-apartament-pret",       "2026-07-26"),
        ("verificare-apartament-inainte-de-cumparare", "2026-07-26"),
        ("ce-este-digital-twin-locuinta",      "2026-07-26"),
        ("imobile-verificate-cum-functioneaza", "2026-07-26"),
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

    # Guide articles — Article + FAQPage schema, high SEO value
    for gslug, gmod in guide_slugs:
        urls_xml.append(
            f"  <url>\n"
            f"    <loc>{_SITE_URL}/ghiduri/{gslug}</loc>\n"
            f"    <lastmod>{gmod}</lastmod>\n"
            f"    <changefreq>monthly</changefreq>\n"
            f"    <priority>0.75</priority>\n"
            f"  </url>"
        )

    # Pagini publice de prețuri („Cât costă X în 2026") — trafic organic long-tail
    from construction.price_seo import PRICE_SEO
    urls_xml.append(
        f"  <url>\n"
        f"    <loc>{_SITE_URL}/preturi</loc>\n"
        f"    <lastmod>{now_iso}</lastmod>\n"
        f"    <changefreq>weekly</changefreq>\n"
        f"    <priority>0.85</priority>\n"
        f"  </url>"
    )
    for pslug in PRICE_SEO:
        urls_xml.append(
            f"  <url>\n"
            f"    <loc>{_SITE_URL}/preturi/{pslug}</loc>\n"
            f"    <lastmod>{now_iso}</lastmod>\n"
            f"    <changefreq>weekly</changefreq>\n"
            f"    <priority>0.8</priority>\n"
            f"  </url>"
        )

    # SEO category-landing pages (e.g. /marketplace/electrician,
    # /marketplace/electrician-bucuresti) — drives long-tail local search traffic.
    from seo_slugs import all_landing_slugs
    for slug in all_landing_slugs():
        # Slugs without a city are higher priority (parent pages)
        is_with_city = "-" in slug and not slug.startswith("design-interior") or slug.count("-") >= (2 if slug.startswith("design-interior") else 1)
        # Simpler: split into parts and check if more than 1
        is_with_city = slug not in ("electrician", "instalator", "hvac", "design-interior", "tamplar", "zugrav", "firma-curatenie", "service-electrocasnice", "gradinar")
        urls_xml.append(
            f"  <url>\n"
            f"    <loc>{_SITE_URL}/marketplace/{slug}</loc>\n"
            f"    <lastmod>{now_iso}</lastmod>\n"
            f"    <changefreq>weekly</changefreq>\n"
            f"    <priority>{'0.7' if is_with_city else '0.85'}</priority>\n"
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
    return body


# Fișierul static la rădăcina domeniului: https://propmanage.ro/sitemap.xml
# (ingress-ul rutează /sitemap.xml către frontend, deci sitemap-ul trebuie să existe
#  ca fișier în frontend/public). Regenerat la startup + zilnic prin scheduler.
from pathlib import Path as _Path  # noqa: E402

_SITEMAP_FILE = _Path(__file__).resolve().parents[2] / "frontend" / "public" / "sitemap.xml"


async def write_sitemap_file() -> str:
    """Generează sitemap-ul și îl scrie ca fișier static în frontend/public/sitemap.xml."""
    xml = await build_sitemap_xml()
    try:
        _SITEMAP_FILE.parent.mkdir(parents=True, exist_ok=True)
        _SITEMAP_FILE.write_text(xml, encoding="utf-8")
        logger.info(f"sitemap.xml scris ({len(xml)} bytes) → {_SITEMAP_FILE}")
    except Exception as e:
        logger.warning(f"Nu am putut scrie sitemap.xml static: {e}")
    return xml
