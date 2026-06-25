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
from routes.autonomy import router as autonomy_router, take_autonomy_snapshot, weekly_auto_tune_job
from routes.twin import router as twin_router
from routes.house_health import router as house_health_router, admin_router as house_health_admin_router
from routes.house_health_plans import public_router as hh_plans_public_router, admin_router as hh_plans_admin_router
from routes.house_health_recommendations import router as hh_recommendations_router
from routes.house_health_billing import router as hh_billing_router, webhook_router as hh_webhook_router, seed_default_plans as hh_seed_default_plans
from routes.manual_tester import router as manual_tester_router
from routes.adaptive_ux import router as adaptive_ux_router, admin_router as adaptive_ux_admin_router
from routes.admin_tour import router as admin_tour_router
from autonomy.founder_digest import weekly_founder_digest
from autonomy.autopilot import bootstrap_autonomy_defaults, daily_autopilot_sweep
from routes.ai_activity import router as ai_activity_router
from routes.ai_weekly_briefing import router as ai_weekly_briefing_router, run_weekly_briefing_job
from routes.admin_todos import router as admin_todos_router
from routes.experience_spaces_bootstrap import router as es_bootstrap_router
from routes.future_ideas import router as future_ideas_router
from routes.future_ideas_digest import router as future_ideas_digest_router, run_future_ideas_digest_job
from routes.founder_gate_admin import router as founder_gate_admin_router
from routes.ai_governance import router as ai_governance_router
from routes.bug_memory_aggregator import router as bug_memory_router
from routes.deprecation_pulse import router as deprecation_pulse_router, run_deprecation_pulse_job
from routes.architecture_board import router as architecture_board_router
from routes.ai_pm import router as ai_pm_router
from routes.operating_manual import router as operating_manual_router
from routes.experience_tiers import (
    router as experience_tiers_router,
    self_router as experience_tiers_self_router,
    run_promotion_job as run_experience_tier_promotion_job,
)
from routes.feature_configurator import (
    router as feature_configurator_router,
    self_router as feature_configurator_self_router,
    evaluate_quests_job,
)
from routes.twin_orchestrator import router as twin_orchestrator_router
from routes.specialist_progression import router_admin as sp_admin_router, router_public as sp_public_router, run_auto_promotion
from routes.reviews_v2 import router as reviews_v2_router
from routes.marketplace_offers import router as marketplace_offers_router
from routes.premium_marketplace import router as premium_marketplace_router
from routes.bi_moe import router as bi_moe_router
from routes.community import router as community_router, seed_community_demo
from routes.tier_milestones import router as tier_milestones_router, cron_check_all_users
from routes.sub_admins import router as sub_admins_router
from routes.admin_approvals import router as admin_approvals_router
from routes.kyc import router as kyc_router
from routes.it_collaborators import router as it_collaborators_router
from routes.it_digest import router as it_digest_router, run_weekly_it_sprint_digest, _get_settings as _it_digest_get_settings
from routes.legal import router as legal_router, admin_router as legal_admin_router, seed_default_legal_documents
from middleware_scope import admin_scope_middleware
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
# Admin-scope HTTP middleware (Milestone 2): URL-pattern → required-scope map
app.middleware("http")(admin_scope_middleware)
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
    twin_router,
    house_health_router,
    house_health_admin_router,
    hh_plans_public_router,
    hh_plans_admin_router,
    hh_recommendations_router,
    hh_billing_router,
    hh_webhook_router,
    manual_tester_router,
    adaptive_ux_router,
    adaptive_ux_admin_router,
    admin_tour_router,
    ai_activity_router,
    ai_weekly_briefing_router,
    admin_todos_router,
    es_bootstrap_router,
    future_ideas_router,
    future_ideas_digest_router,
    founder_gate_admin_router,
    ai_governance_router,
    bug_memory_router,
    deprecation_pulse_router,
    architecture_board_router,
    ai_pm_router,
    operating_manual_router,
    experience_tiers_router,
    experience_tiers_self_router,
    feature_configurator_router,
    feature_configurator_self_router,
    twin_orchestrator_router,
    sp_admin_router,
    sp_public_router,
    reviews_v2_router,
    marketplace_offers_router,
    premium_marketplace_router,
    bi_moe_router,
    community_router,
    tier_milestones_router,
    sub_admins_router,
    admin_approvals_router,
    kyc_router,
    it_collaborators_router,
    it_digest_router,
    legal_router,
    legal_admin_router,
):
    app.include_router(r)

# Daily digest scheduler (19:00 Europe/Bucharest)
scheduler = AsyncIOScheduler(timezone=pytz.timezone(BUCHAREST_TZ_NAME))


@app.on_event("startup")
async def startup():
    await seed()
    try:
        await hh_seed_default_plans()
    except Exception as e:
        logger.warning(f"House Health plans seed failed: {e}")
    try:
        await seed_verified_estate_demo()
    except Exception as e:
        logger.warning(f"Verified Estate demo seed failed: {e}")
    try:
        await seed_community_demo()
    except Exception as e:
        logger.warning(f"Community demo seed failed: {e}")
    try:
        from tier_demo_seed import seed_tier_demo_users
        await seed_tier_demo_users()
    except Exception as e:
        logger.warning(f"Tier demo seed failed: {e}")
    # GDPR Phase 1 — backfill existing users with consent + verification fields (idempotent)
    try:
        from consent_backfill import run_consent_backfill
        await run_consent_backfill()
    except Exception as e:
        logger.warning(f"Consent backfill failed: {e}")
    # Autonomy autopilot — enable smoke-monitor, auto-match schedule, fresh snapshot (idempotent)
    try:
        await bootstrap_autonomy_defaults()
    except Exception as e:
        logger.warning(f"Autonomy autopilot bootstrap failed: {e}")
    # Sub-admin RBAC — seed demo scoped admins (testing/frontend/backend/security)
    try:
        from sub_admin_seed import seed_sub_admins
        await seed_sub_admins()
    except Exception as e:
        logger.warning(f"Sub-admin seed failed: {e}")
    try:
        await seed_default_legal_documents()
    except Exception as e:
        logger.warning(f"Legal docs seed failed: {e}")
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
        # Auto-Tune weekly orchestrator — every Monday 04:00 Europe/Bucharest.
        # Self-healing: keeps platform in self-driving tier without manual action.
        scheduler.add_job(
            weekly_auto_tune_job,
            CronTrigger(day_of_week="mon", hour=4, minute=0, timezone=pytz.timezone(BUCHAREST_TZ_NAME)),
            id="autonomy_auto_tune_weekly",
            replace_existing=True,
            misfire_grace_time=3600,
        )
        # Weekly Founders' Digest — Monday 09:30 (after Auto-Tune 04:00, after
        # AI Briefing 09:00). Sends a 1-email-per-week summary to super-admins.
        scheduler.add_job(
            weekly_founder_digest,
            CronTrigger(day_of_week="mon", hour=9, minute=30, timezone=pytz.timezone(BUCHAREST_TZ_NAME)),
            id="founder_digest_weekly",
            replace_existing=True,
            misfire_grace_time=3600,
        )
        # Sprint A — Auto-promotion engine: daily 03:30 (after autonomy snapshot)
        scheduler.add_job(
            run_auto_promotion,
            CronTrigger(hour=3, minute=30, timezone=pytz.timezone(BUCHAREST_TZ_NAME)),
            id="specialist_auto_promotion_daily",
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
        # Future Ideas Vault — weekly digest, Mondays 09:15 (after AI briefing)
        scheduler.add_job(
            run_future_ideas_digest_job,
            CronTrigger(day_of_week="mon", hour=9, minute=15, timezone=pytz.timezone(BUCHAREST_TZ_NAME)),
            id="future_ideas_digest",
            replace_existing=True,
            misfire_grace_time=7200,
        )
        # AI Governance — Deprecation Pulse, Thursdays 09:30 Europe/Bucharest
        scheduler.add_job(
            run_deprecation_pulse_job,
            CronTrigger(day_of_week="thu", hour=9, minute=30, timezone=pytz.timezone(BUCHAREST_TZ_NAME)),
            id="deprecation_pulse_weekly",
            replace_existing=True,
            misfire_grace_time=7200,
        )
        # Experience Tiers — daily auto-promotion, 03:30 Europe/Bucharest
        scheduler.add_job(
            run_experience_tier_promotion_job,
            CronTrigger(hour=3, minute=30, timezone=pytz.timezone(BUCHAREST_TZ_NAME)),
            id="experience_tier_daily_promotion",
            replace_existing=True,
            misfire_grace_time=7200,
        )
        # Quests — daily evaluation + voucher issuance, 03:45 Europe/Bucharest
        scheduler.add_job(
            evaluate_quests_job,
            CronTrigger(hour=3, minute=45, timezone=pytz.timezone(BUCHAREST_TZ_NAME)),
            id="quests_daily_evaluation",
            replace_existing=True,
            misfire_grace_time=7200,
        )
        # Tier milestones — daily sweep for missed 50/75/100% notifications, 04:00 Europe/Bucharest
        scheduler.add_job(
            cron_check_all_users,
            CronTrigger(hour=4, minute=0, timezone=pytz.timezone(BUCHAREST_TZ_NAME)),
            id="tier_milestone_daily_sweep",
            replace_existing=True,
            misfire_grace_time=7200,
        )
        # Autonomy autopilot daily sweep — 04:15 Europe/Bucharest (after tier milestones)
        scheduler.add_job(
            daily_autopilot_sweep,
            CronTrigger(hour=4, minute=15, timezone=pytz.timezone(BUCHAREST_TZ_NAME)),
            id="autonomy_autopilot_daily",
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
        # IT Sprint Health Digest — weekly AI-powered founder email (default Sun 18:00 Europe/Bucharest)
        try:
            _digest_settings = await _it_digest_get_settings()
            scheduler.add_job(
                run_weekly_it_sprint_digest,
                CronTrigger(
                    day_of_week=_digest_settings.get("day_of_week", "sun"),
                    hour=int(_digest_settings.get("hour", 18)),
                    minute=int(_digest_settings.get("minute", 0)),
                    timezone=pytz.timezone(BUCHAREST_TZ_NAME),
                ),
                id="it_sprint_digest_weekly",
                replace_existing=True,
                misfire_grace_time=7200,
            )
            logger.info(f"IT Sprint Digest scheduled: {_digest_settings.get('day_of_week','sun')} {_digest_settings.get('hour',18):02d}:{_digest_settings.get('minute',0):02d} Europe/Bucharest")
        except Exception as e:
            logger.warning(f"IT Sprint Digest schedule failed: {e}")
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
        logger.info("Autonomy Auto-Tune scheduler started (Mondays 04:00 Europe/Bucharest, self-healing + adaptive escalation).")
        logger.info("Founders' Digest scheduler started (Mondays 09:30 Europe/Bucharest, 1 email/week to super-admins).")
        # Hydrate Twin scheduled actions from DB (re-register all active ones)
        try:
            from twin_schedule import hydrate_schedules_on_startup
            n = await hydrate_schedules_on_startup(scheduler)
            logger.info(f"Twin Scheduled Actions: hydrated {n} active schedules from DB.")
        except Exception as e:  # noqa: BLE001
            logger.warning(f"Twin schedule hydration failed: {e}")
        logger.info("Weekly AI Briefing scheduler started (Mondays 09:00 Europe/Bucharest).")
        logger.info("Future Ideas digest scheduler started (Mondays 09:15 Europe/Bucharest).")


@app.on_event("shutdown")
async def shutdown():
    if scheduler.running:
        scheduler.shutdown(wait=False)
    client.close()
