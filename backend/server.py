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
from routes.admin import router as admin_router, run_auto_match_cron_tick
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
from routes.auth import run_auth_health_alert_check
from routes.security_guard import router as security_guard_router
from routes.concierge import router as concierge_router, admin_router as concierge_admin_router
from routes.public import router as public_router, admin_router as public_admin_router, record_health_ping
from routes.demo_time_machine import router as demo_time_machine_router
from routes.gdpr import router as gdpr_router, admin_router as gdpr_admin_router
from routes.digital_twin import router as digital_twin_router, admin_router as digital_twin_admin_router, operator_router as digital_twin_operator_router
from routes.impersonation import router as impersonation_router
from routes.admin_smoketest import router as admin_smoketest_router, run_smoke_test_monitor_tick
from routes.admin_healthcheck import router as admin_healthcheck_router, briefing_router as admin_morning_briefing_router
from routes.admin_data_integrity import router as admin_data_integrity_router
from routes.admin_backups import router as admin_backups_router
from routes.public_trust import router as public_trust_router
from routes.admin_exec_briefing import router as admin_exec_briefing_router
from routes.admin_qa_maintenance import router as admin_qa_maintenance_router
from executive_briefing import run_exec_briefing_job
from routes.admin_dev_velocity import router as admin_dev_velocity_router
from routes.docs_routes import admin_router as admin_docs_router, public_router as public_help_router
from routes.incidents import admin_router as incidents_admin_router, public_router as incidents_public_router
from routes.admin_onboarding import router as admin_onboarding_router
from routes.admin_qa_playbook import router as admin_qa_playbook_router
from routes.admin_content_audit import router as admin_content_audit_router
from routes.admin_term_audit import router as admin_term_audit_router
from routes.verified_estate import router as verified_estate_router, seed_demo_listings as seed_verified_estate_demo
from routes.app_settings import router as app_settings_router, public_router as app_settings_public_router
from routes.qa_copilot import router as qa_copilot_router
from routes.ai_control import router as ai_control_router
from routes.digital_twin_qa import router as dt_qa_router
from routes.docs_ai import router as docs_ai_router
from routes.ai_dev_team import router as ai_dev_team_router
from routes.ai_security import router as ai_security_router
from routes.settings_snapshots import router as settings_snapshots_router, take_auto_snapshot
from routes.service_contracts import router as service_contracts_router
from routes.autonomy import router as autonomy_router, take_autonomy_snapshot
from routes.ai_activity import router as ai_activity_router
from routes.ai_weekly_briefing import router as ai_weekly_briefing_router, run_weekly_briefing_job
from routes.admin_todos import router as admin_todos_router
from admin_briefing_digest import run_morning_briefing_job
from backup_service import run_daily_backup_job
from dev_velocity_service import run_weekly_velocity_job
from onboarding_emails import run_onboarding_dispatch_job
from qa_automation import run_weekly_release_gate_job
from demo_reset import reset_demo_accounts

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="PropManage API")

# CORS: read from env, support "*" wildcard for dev OR comma-separated origins for prod.
# Default regex auto-permits both preview (*.preview.emergentagent.com) AND the production
# custom domain (*.propmanage.ro) so cookies/credentials work cross-origin out of the box.
_raw_origins = os.environ.get("CORS_ORIGINS", "*").strip()
_default_origin_regex = r"^https?://(.*\.)?(propmanage\.ro|propmanage\.io|preview\.emergentagent\.com|emergentagent\.com)$"
_origin_regex = os.environ.get("CORS_ORIGIN_REGEX") or _default_origin_regex
if _raw_origins == "*" or not _raw_origins:
    # Use empty allow_origins + regex so allow_credentials=True can still work
    # (browsers reject credentials only with literal "*", not with regex matches).
    _origins = []
    _allow_credentials = True
else:
    _origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]
    _allow_credentials = True

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_origin_regex=_origin_regex,
    allow_credentials=_allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)
logger = logging.getLogger(__name__)
logger.info(f"CORS configured: origins={_origins} regex={_origin_regex} credentials={_allow_credentials}")

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
    digital_twin_router, digital_twin_admin_router, digital_twin_operator_router,
    impersonation_router,
    admin_smoketest_router,
    admin_healthcheck_router,
    admin_morning_briefing_router,
    admin_data_integrity_router,
    admin_backups_router,
    public_trust_router,
    admin_exec_briefing_router,
    admin_qa_maintenance_router,
    admin_dev_velocity_router,
    admin_docs_router,
    public_help_router,
    incidents_admin_router,
    incidents_public_router,
    admin_onboarding_router,
    admin_qa_playbook_router,
    admin_content_audit_router,
    admin_term_audit_router,
    verified_estate_router,
    app_settings_router,
    app_settings_public_router,
    qa_copilot_router,
    ai_control_router,
    dt_qa_router,
    docs_ai_router,
    ai_dev_team_router,
    ai_security_router,
    settings_snapshots_router,
    service_contracts_router,
    autonomy_router,
    ai_activity_router,
    ai_weekly_briefing_router,
    admin_todos_router,
):
    app.include_router(r)

# Daily digest scheduler (19:00 Europe/Bucharest)
scheduler = AsyncIOScheduler(timezone=pytz.timezone(BUCHAREST_TZ_NAME))


@app.on_event("startup")
async def startup():
    await seed()
    try:
        await seed_verified_estate_demo()
    except Exception as e:
        logger.warning(f"Verified Estate demo seed failed: {e}")
    if not scheduler.running:
        scheduler.add_job(
            run_daily_digests,
            CronTrigger(hour=19, minute=0, timezone=pytz.timezone(BUCHAREST_TZ_NAME)),
            id="daily_digest",
            replace_existing=True,
            misfire_grace_time=3600,
        )
        scheduler.add_job(
            take_auto_snapshot,
            CronTrigger(hour=4, minute=0, timezone=pytz.timezone(BUCHAREST_TZ_NAME)),
            id="settings_snapshot_daily",
            replace_existing=True,
            misfire_grace_time=3600,
        )
        scheduler.add_job(
            take_autonomy_snapshot,
            CronTrigger(hour=3, minute=15, timezone=pytz.timezone(BUCHAREST_TZ_NAME)),
            id="autonomy_snapshot_daily",
            replace_existing=True,
            misfire_grace_time=3600,
        )
        # Auto-match cron tick — runs hourly, executes only when due
        # per `auto_match_schedule` config (enabled + interval_hours).
        scheduler.add_job(
            run_auto_match_cron_tick,
            CronTrigger(minute=23, timezone=pytz.timezone(BUCHAREST_TZ_NAME)),
            id="auto_match_cron_tick",
            replace_existing=True,
            misfire_grace_time=600,
        )
        # Weekly AI Briefing email — Mondays 09:00 Europe/Bucharest
        scheduler.add_job(
            run_weekly_briefing_job,
            CronTrigger(day_of_week="mon", hour=9, minute=0, timezone=pytz.timezone(BUCHAREST_TZ_NAME)),
            id="weekly_ai_briefing",
            replace_existing=True,
            misfire_grace_time=7200,
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
        # Google OAuth early-warning: check every 15 min, alert if success rate < 80% in last hour
        scheduler.add_job(
            run_auth_health_alert_check,
            CronTrigger(minute="*/15", timezone=pytz.timezone(BUCHAREST_TZ_NAME)),
            id="auth_health_alert",
            replace_existing=True,
            misfire_grace_time=900,
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
        # Email lifecycle sequences: drip reminders + weekly newsletter (Phase 67)
        try:
            from email_sequences import register_email_sequence_jobs
            register_email_sequence_jobs(scheduler)
        except Exception as e:
            logger.warning(f"Failed to register email sequence jobs: {e}")
        # Smoke Test auto-monitor — runs every 30 min, alerts admins on failure
        scheduler.add_job(
            run_smoke_test_monitor_tick,
            CronTrigger(minute="*/30", timezone=pytz.timezone(BUCHAREST_TZ_NAME)),
            id="smoke_test_monitor",
            replace_existing=True,
            misfire_grace_time=600,
        )
        # Morning Briefing digest — daily 09:00, sent only when warn/fail
        scheduler.add_job(
            run_morning_briefing_job,
            CronTrigger(hour=9, minute=0, timezone=pytz.timezone(BUCHAREST_TZ_NAME)),
            id="morning_briefing_digest",
            replace_existing=True,
            misfire_grace_time=3600,
        )
        # Daily MongoDB backup — 03:30 (before AI scan at 03:00 doesn't matter; this is its own slot)
        scheduler.add_job(
            run_daily_backup_job,
            CronTrigger(hour=3, minute=30, timezone=pytz.timezone(BUCHAREST_TZ_NAME)),
            id="daily_mongodb_backup",
            replace_existing=True,
            misfire_grace_time=7200,
        )
        # Weekly Dev Velocity — Mondays 09:30 Europe/Bucharest
        scheduler.add_job(
            run_weekly_velocity_job,
            CronTrigger(day_of_week="mon", hour=9, minute=30, timezone=pytz.timezone(BUCHAREST_TZ_NAME)),
            id="weekly_dev_velocity",
            replace_existing=True,
            misfire_grace_time=7200,
        )
        # Specialist onboarding email drip — every 15 minutes
        scheduler.add_job(
            run_onboarding_dispatch_job,
            CronTrigger(minute="*/15", timezone=pytz.timezone(BUCHAREST_TZ_NAME)),
            id="onboarding_email_dispatch",
            replace_existing=True,
            misfire_grace_time=900,
        )
        # Weekly Release Gate — Mondays 08:45 Europe/Bucharest
        # Silent unless any P0 fails (only then admins get alerted)
        scheduler.add_job(
            run_weekly_release_gate_job,
            CronTrigger(day_of_week="mon", hour=8, minute=45, timezone=pytz.timezone(BUCHAREST_TZ_NAME)),
            id="weekly_release_gate",
            replace_existing=True,
            misfire_grace_time=7200,
        )
        # Weekly Executive Briefing — Mondays 09:45 Europe/Bucharest (after morning briefing + release gate)
        scheduler.add_job(
            run_exec_briefing_job,
            CronTrigger(day_of_week="mon", hour=9, minute=45, timezone=pytz.timezone(BUCHAREST_TZ_NAME)),
            id="weekly_exec_briefing",
            replace_existing=True,
            misfire_grace_time=7200,
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
        logger.info("Smoke Test auto-monitor scheduler started (every 30 min — alerts on FAIL).")
        logger.info("Morning Briefing digest scheduler started (daily 09:00 Europe/Bucharest).")
        logger.info("Daily MongoDB backup scheduler started (03:30 Europe/Bucharest, emails admin).")
        logger.info("Weekly Dev Velocity scheduler started (Mondays 09:30 Europe/Bucharest).")
        logger.info("Autonomy snapshot scheduler started (daily 03:15 Europe/Bucharest).")
        logger.info("Weekly AI Briefing scheduler started (Mondays 09:00 Europe/Bucharest).")


@app.on_event("shutdown")
async def shutdown():
    if scheduler.running:
        scheduler.shutdown(wait=False)
    client.close()
