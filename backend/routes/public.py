"""PropManage — Public Demo & Health endpoints (Phase 48).

- POST /api/public/demo-request — captures lead from landing "Book a Demo" CTA.
- GET  /api/health              — uptime + service readiness probe (no auth).
"""
import os
import re
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Body, HTTPException

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
    if not name or not EMAIL_RX.match(email):
        raise HTTPException(400, "Nume și email valid sunt obligatorii.")

    doc = {
        "name": name,
        "email": email,
        "company": company,
        "role": role,
        "message": message,
        "status": "new",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "source": "landing_book_demo",
    }
    # Idempotent on (email + day) so accidental double-click doesn't spam.
    day = doc["created_at"][:10]
    existing = await db.demo_leads.find_one({"email": email, "created_at": {"$regex": f"^{day}"}})
    if existing:
        await db.demo_leads.update_one({"_id": existing["_id"]}, {"$set": {"name": name, "company": company, "message": message, "role": role, "updated_at": doc["created_at"]}})
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
        html = _layout(
            title="📩 Cerere demo nouă",
            preheader=f"{name} de la {company or '—'} vrea o demonstrație",
            body_html=f"""
              <p>Un potențial client a completat formularul "Programează o demonstrație":</p>
              <table style="width:100%; background:#1a1a1f; border-radius:12px; padding:14px; margin:12px 0; color:#fff;">
                <tr><td><b>Nume:</b></td><td>{name}</td></tr>
                <tr><td><b>Email:</b></td><td><a href="mailto:{email}" style="color:#d4ff3a;">{email}</a></td></tr>
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
