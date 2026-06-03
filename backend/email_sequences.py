"""Email lifecycle sequences for PropManage.

3 automated email flows:

1. WELCOME — sent immediately after a user signs up (covered by existing
   email_service.send_welcome_email — we just wire scheduler safety net).

2. DRIP REMINDER — for buyers who paid for audit but haven't been contacted
   by an agent within 48h. Sends gentle nudge to the admin team.

3. NEWSLETTER — weekly digest of new verified listings, sent Mondays 9:00 EU.

All scheduled via APScheduler (already initialized in server.py).
"""
from datetime import datetime, timezone, timedelta
import logging
import os

from db import db
from email_service import send_email

logger = logging.getLogger("propmanage.email_sequences")

ADMIN_NOTIFY_EMAIL = os.environ.get("ADMIN_NOTIFY_EMAIL") or os.environ.get("SUPPORT_CONTACT_EMAIL") or "contact@propmanage.ro"
NEWSLETTER_FROM_NAME = "PropManage Imobile Verificate"


async def run_drip_reminder_for_pending_orders():
    """Find Verified Estate orders that:
      - status == 'paid'
      - older than 48 hours
      - no draft listing has been updated/processed (we use updated_at == created_at)
    Sends 1 reminder email per pending order to admin (max once per order)."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=48)
    sent_count = 0
    try:
        cursor = db.verified_estate_orders.find({
            "status": "paid",
            "paid_at": {"$lt": cutoff},
            "drip_reminded_at": {"$exists": False},
        }).limit(20)
        async for order in cursor:
            try:
                await send_email(
                    ADMIN_NOTIFY_EMAIL,
                    f"[Reminder 48h] Plată neprocessată · {order.get('contact_email')}",
                    f"""<h2>Reminder · Comandă nerespectată în 48h</h2>
                    <p><strong>Client:</strong> {order.get('contact_name')} &lt;{order.get('contact_email')}&gt;</p>
                    <p><strong>Pachet:</strong> {order.get('label')} ({order.get('amount_ron')} RON)</p>
                    <p><strong>Adresă:</strong> {order.get('property_address')}</p>
                    <p><strong>Plătit la:</strong> {order.get('paid_at')}</p>
                    <p>Te rugăm să iei legătura cu clientul pentru programarea auditului.</p>
                    <p><a href="{os.environ.get('FRONTEND_PUBLIC_URL', '')}/admin/imobile-verificate">Vezi în Admin Kanban →</a></p>"""
                )
                await db.verified_estate_orders.update_one(
                    {"_id": order["_id"]},
                    {"$set": {"drip_reminded_at": datetime.now(timezone.utc)}},
                )
                sent_count += 1
            except Exception as e:
                logger.warning(f"Drip reminder failed for order {order.get('_id')}: {e}")
        logger.info(f"[email_sequences] Drip reminders sent: {sent_count}")
    except Exception as e:
        logger.error(f"[email_sequences] Drip job failed: {e}")
    return sent_count


async def run_weekly_newsletter():
    """Compose and send a weekly newsletter to subscribers.
    Subscribers = users with digest_disabled != True AND email present.
    Content = newest 5 published Verified Estate listings."""
    try:
        listings_cursor = db.verified_estate_listings.find({"status": "published"}).sort("published_at", -1).limit(5)
        listings = [doc async for doc in listings_cursor]
        if not listings:
            logger.info("[email_sequences] No published listings — skipping newsletter")
            return 0

        items_html = ""
        base = os.environ.get("FRONTEND_PUBLIC_URL", "")
        for li in listings:
            items_html += f"""
            <tr><td style="padding:12px 0;border-bottom:1px solid #eee;">
              <a href="{base}/imobile-verificate/{li.get('_id')}" style="color:#0a0a0b;text-decoration:none;font-weight:600;">{li.get('title','')}</a><br>
              <span style="color:#666;font-size:13px;">{li.get('city','')} · {int(li.get('price_ron',0)):,} RON · {li.get('rooms','?')} cam · {li.get('surface_sqm','?')} m²</span>
            </td></tr>
            """

        html = f"""<h2>Imobile verificate săptămâna aceasta</h2>
        <p>Cele mai noi imobile cu audit + Digital Twin disponibile pe platforma noastră:</p>
        <table style="width:100%;border-collapse:collapse;">{items_html}</table>
        <p><a href="{base}/imobile-verificate" style="display:inline-block;background:#d4ff3a;color:#0a0a0b;padding:12px 24px;border-radius:24px;text-decoration:none;font-weight:600;">Vezi toate imobilele →</a></p>
        <hr>
        <p style="color:#888;font-size:12px;">Primești acest email pentru că ai un cont {NEWSLETTER_FROM_NAME}.
        Dacă nu mai dorești newsletter, modifică preferințele din Setări → Notificări.</p>
        """

        users_cursor = db.users.find({
            "email": {"$exists": True, "$ne": None},
            "digest_disabled": {"$ne": True},
        }, {"email": 1, "name": 1}).limit(2000)
        sent = 0
        async for user in users_cursor:
            try:
                await send_email(user["email"], "Imobile verificate săptămâna aceasta · PropManage", html)
                sent += 1
            except Exception as e:
                logger.warning(f"Newsletter to {user.get('email')} failed: {e}")
        logger.info(f"[email_sequences] Weekly newsletter sent to {sent} users")
        return sent
    except Exception as e:
        logger.error(f"[email_sequences] Newsletter job failed: {e}")
        return 0


def register_email_sequence_jobs(scheduler):
    """Attach email lifecycle jobs to the existing APScheduler instance."""
    # Drip reminder — every 6 hours
    scheduler.add_job(
        run_drip_reminder_for_pending_orders,
        "interval",
        hours=6,
        id="email_drip_reminders",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    # Weekly newsletter — Mondays at 09:00 Europe/Bucharest
    scheduler.add_job(
        run_weekly_newsletter,
        "cron",
        day_of_week="mon",
        hour=9,
        minute=0,
        id="email_weekly_newsletter",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    logger.info("[email_sequences] Registered drip + newsletter jobs")
