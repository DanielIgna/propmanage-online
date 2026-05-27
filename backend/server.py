"""PropManage Backend — FastAPI app entry point.

After Phase B refactor, all endpoints live in routes/*.py modules.
This file only wires the app: CORS, lifecycle hooks, scheduler, router includes.
"""
import logging
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
from routes.admin_ai import router as admin_ai_router, run_daily_ai_digest, send_daily_ai_digest_email
from routes.security_guard import router as security_guard_router
from routes.concierge import router as concierge_router, admin_router as concierge_admin_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="PropManage API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
        scheduler.start()
        logger.info("Daily digest scheduler started (19:00 Europe/Bucharest).")
        logger.info("Warranty auto-release scheduler started (06:00 Europe/Bucharest).")
        logger.info("Preset schedules scheduler started (every minute, Europe/Bucharest).")
        logger.info("Incident spike alert scheduler started (Monday 08:00 Europe/Bucharest).")
        logger.info("AI daily auto-scan scheduler started (03:00 Europe/Bucharest).")
        logger.info("AI daily digest email scheduler started (08:00 Europe/Bucharest).")


@app.on_event("shutdown")
async def shutdown():
    if scheduler.running:
        scheduler.shutdown(wait=False)
    client.close()
