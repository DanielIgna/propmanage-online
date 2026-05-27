"""PropManage Backend — FastAPI app entry point.

After Phase B refactor, all endpoints live in routes/*.py modules.
This file only wires the app: CORS, lifecycle hooks, scheduler, router includes.
"""
import logging
import os
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
import pytz
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Internal foundation modules
from db import client
from seed import seed
from digest import run_daily_digests, BUCHAREST_TZ_NAME
from routes.projects import auto_release_warranty_holds

# Routers (1 file per domain)
from routes.auth import router as auth_router
from routes.properties import router as properties_router
from routes.requests import router as requests_router
from routes.operator import router as operator_nonconformity_router
from routes.operator_twins import router as operator_twins_router
from routes.wallet import router as wallet_router
from routes.admin import router as admin_router
from routes.specialist_docs import router as specialist_docs_router
from routes.disputes import router as disputes_router
from routes.design import router as design_router
from routes.portfolio import router as portfolio_router
from routes.payments import router as payments_router
from routes.chat import router as chat_router
from routes.specialist_profile import router as specialist_profile_router
from routes.notifications import router as notifications_router
from routes.ai import router as ai_router
from routes.marketplace import router as marketplace_router
from routes.property_timeline import router as property_timeline_router
from routes.regions import router as regions_router
from routes.matching import router as matching_router
from routes.services_avail import router as services_avail_router
from routes.projects import router as projects_router
from routes.trust import router as trust_router
from routes.root import router as root_router
from routes.admin_console import router as admin_console_router, public_router as cms_public_router, run_due_preset_schedules, run_incident_spike_alert_check
from routes.digital_twin import run_dt_auto_reminders
from routes.admin_ai import router as admin_ai_router, run_daily_ai_digest, send_daily_ai_digest_email, run_ai_effectiveness_alert_check
from routes.security_guard import router as security_guard_router
from routes.concierge import router as concierge_router, admin_router as concierge_admin_router
from routes.public import router as public_router, admin_router as public_admin_router, record_health_ping
from routes.demo_time_machine import router as demo_time_machine_router
from routes.gdpr import router as gdpr_router, admin_router as gdpr_admin_router
from routes.digital_twin import router as digital_twin_router, admin_router as digital_twin_admin_router
from demo_reset import reset_demo_accounts

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="PropManage API")

# CORS: read from env, support "*" wildcard for dev OR comma-separated origins for prod.
_raw_origins = os.environ.get("CORS_ORIGINS", "*").strip()
if _raw_origins == "*" or not _raw_origins:
    _origins = ["*"]
    _allow_credentials = False  # Browsers reject credentials with "*"
else:
    _origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]
    _allow_credentials = True

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_origin_regex=os.environ.get("CORS_ORIGIN_REGEX") or None,
    allow_credentials=_allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)
logger = logging.getLogger(__name__)
logger.info(f"CORS configured: origins={_origins} credentials={_allow_credentials}")

# Register all routers
for r in (
    auth_router, properties_router, requests_router,
    operator_nonconformity_router, operator_twins_router,
    wallet_router, admin_router, specialist_docs_router,
    disputes_router, design_router, portfolio_router,
    payments_router, chat_router, specialist_profile_router,
    notifications_router, ai_router, marketplace_router,
    property_timeline_router, regions_router, matching_router,
    services_avail_router, projects_router, trust_router, root_router,
    admin_console_router, cms_public_router, admin_ai_router,
    security_guard_router, concierge_router, concierge_admin_router,
    public_router,
    public_admin_router,
    demo_time_machine_router,
    gdpr_router, gdpr_admin_router,
    digital_twin_router, digital_twin_admin_router,
):
    app.include_router(r)

# Daily digest scheduler (19:00 Europe/Bucharest)
scheduler = AsyncIOScheduler(timezone=pytz.timezone(BUCHAREST_TZ_NAME))


@app.on_event("startup")
async def startup():
    await seed()
    if not scheduler.running:
        scheduler.add_job(
            run_daily_digests,
            CronTrigger(hour=19, minute=0, timezone=pytz.timezone(BUCHAREST_TZ_NAME)),
            id="daily_digest",
            replace_existing=True,
            misfire_grace_time=3600,
        )
        scheduler.add_job(
            auto_release_warranty_holds,
            CronTrigger(hour=6, minute=0, timezone=pytz.timezone(BUCHAREST_TZ_NAME)),
            id="warranty_auto_release",
            replace_existing=True,
            misfire_grace_time=7200,
        )
        scheduler.add_job(
            run_due_preset_schedules,
            CronTrigger(minute="*", timezone=pytz.timezone(BUCHAREST_TZ_NAME)),
            id="preset_schedules",
            replace_existing=True,
            misfire_grace_time=60,
        )
        scheduler.add_job(
            run_incident_spike_alert_check,
            CronTrigger(day_of_week="mon", hour=8, minute=0, timezone=pytz.timezone(BUCHAREST_TZ_NAME)),
            id="incident_spike_alert",
            replace_existing=True,
            misfire_grace_time=86400,
        )
        scheduler.add_job(
            run_daily_ai_digest,
            CronTrigger(hour=3, minute=0, timezone=pytz.timezone(BUCHAREST_TZ_NAME)),
            id="ai_daily_scan",
            replace_existing=True,
            misfire_grace_time=3600,
        )
        scheduler.add_job(
            send_daily_ai_digest_email,
            CronTrigger(hour=8, minute=0, timezone=pytz.timezone(BUCHAREST_TZ_NAME)),
            id="ai_daily_digest_email",
            replace_existing=True,
            misfire_grace_time=3600,
        )
        scheduler.add_job(
            run_ai_effectiveness_alert_check,
            CronTrigger(day_of_week="mon", hour=9, minute=0, timezone=pytz.timezone(BUCHAREST_TZ_NAME)),
            id="ai_effectiveness_low_alert",
            replace_existing=True,
            misfire_grace_time=3600,
        )
        scheduler.add_job(
            reset_demo_accounts,
            CronTrigger(hour=2, minute=0, timezone=pytz.timezone(BUCHAREST_TZ_NAME)),
            id="demo_accounts_reset",
            replace_existing=True,
            misfire_grace_time=3600,
        )
        scheduler.add_job(
            record_health_ping,
            CronTrigger(minute="*/15", timezone=pytz.timezone(BUCHAREST_TZ_NAME)),
            id="health_ping",
            replace_existing=True,
            misfire_grace_time=900,
        )
        scheduler.add_job(
            run_dt_auto_reminders,
            CronTrigger(hour=8, minute=15, timezone=pytz.timezone(BUCHAREST_TZ_NAME)),
            id="dt_auto_reminders",
            replace_existing=True,
            misfire_grace_time=3600,
        )
        scheduler.start()
        # Record an immediate ping on startup so sparkline is non-empty from minute 1.
        try:
            await record_health_ping()
        except Exception:  # noqa: BLE001
            pass
        logger.info("Daily digest scheduler started (19:00 Europe/Bucharest).")
        logger.info("Warranty auto-release scheduler started (06:00 Europe/Bucharest).")
        logger.info("Preset schedules scheduler started (every minute, Europe/Bucharest).")
        logger.info("Incident spike alert scheduler started (Monday 08:00 Europe/Bucharest).")
        logger.info("AI daily auto-scan scheduler started (03:00 Europe/Bucharest).")
        logger.info("AI daily digest email scheduler started (08:00 Europe/Bucharest).")
        logger.info("AI effectiveness low-alert scheduler started (Monday 09:00 Europe/Bucharest).")
        logger.info("Demo accounts auto-reset scheduler started (daily 02:00 Europe/Bucharest).")
        logger.info("Health ping scheduler started (every 15 min, powers /status sparkline).")


@app.on_event("shutdown")
async def shutdown():
    if scheduler.running:
        scheduler.shutdown(wait=False)
    client.close()
