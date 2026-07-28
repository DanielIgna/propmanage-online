"""PropManage router: PropBenefits (PB-001) — motorul economic și de retenție."""
import logging

from fastapi import APIRouter, Body, Depends, HTTPException

from db import db
from deps import get_current_user, require_role
from propbenefits import ledger, campaigns, opportunities, membership, eligibility
from propbenefits.config import get_config, update_config, ensure_seed, CAMPAIGN_KINDS, CAMPAIGN_STATUSES
from propbenefits.health import subscription_health, ecosystem_health, subscription_impact_scores, health_snapshot_tick
from propbenefits.ai_agents import success_manager, growth_advisor
from propbenefits.referral_ext import referral_activation_tick

logger = logging.getLogger("propmanage.propbenefits")

user_router = APIRouter(prefix="/api/benefits", tags=["prop-benefits"])
admin_router = APIRouter(prefix="/api/admin/prop-benefits", tags=["prop-benefits-admin"])


# ============================================================================
# USER — oportunități, portofel, nivel, success manager
# ============================================================================
@user_router.get("/opportunities")
async def my_opportunities(user: dict = Depends(get_current_user)):
    await ensure_seed()
    return await opportunities.feed(user)


@user_router.get("/wallet")
async def my_wallet(user: dict = Depends(get_current_user)):
    return await ledger.wallet_summary(user["id"])


@user_router.get("/membership")
async def my_membership(user: dict = Depends(get_current_user)):
    ctx = await eligibility.user_context(user)
    return await membership.compute_membership(ctx)


@user_router.post("/claim/{campaign_id}")
async def claim_benefit(campaign_id: str, user: dict = Depends(get_current_user)):
    result = await campaigns.claim(user, campaign_id)
    if result.get("error"):
        raise HTTPException(result.get("code", 400), result["error"])
    return result


@user_router.post("/use/{benefit_id}")
async def use_benefit(benefit_id: str, user: dict = Depends(get_current_user)):
    result = await ledger.use_benefit(user["id"], benefit_id)
    if result.get("error"):
        raise HTTPException(409 if result["error"].startswith("status_") else 404,
                            {"not_found": "Beneficiu inexistent.",
                             "status_used": "Beneficiul a fost deja folosit.",
                             "status_expired": "Beneficiul a expirat.",
                             "status_pending_activation": "Beneficiul nu este încă activ."}.get(result["error"], result["error"]))
    return result


@user_router.get("/success-manager")
async def my_success_manager(user: dict = Depends(get_current_user)):
    return await success_manager(user)


# ============================================================================
# ADMIN — control complet FĂRĂ cod
# ============================================================================
@admin_router.get("/overview")
async def pb_overview(user=Depends(require_role("admin"))):
    await ensure_seed()
    eco = await ecosystem_health()
    return {
        "ecosystem": eco,
        "campaigns": {
            "active": await db.pb_campaigns.count_documents({"status": "active"}),
            "total": await db.pb_campaigns.count_documents({}),
        },
        "benefits": {
            "available": await db.pb_ledger.count_documents({"status": "available"}),
            "used": await db.pb_ledger.count_documents({"status": "used"}),
            "expired": await db.pb_ledger.count_documents({"status": "expired"}),
        },
        "referrals": {
            "pending": await db.pb_referral_pending.count_documents({"status": "pending_activation"}),
            "activated": await db.pb_referral_pending.count_documents({"status": "activated"}),
        },
        "health": {
            "at_risk": await db.pb_subscription_health.count_documents({"status": "at_risk"}),
            "watch": await db.pb_subscription_health.count_documents({"status": "watch"}),
            "healthy": await db.pb_subscription_health.count_documents({"status": "healthy"}),
        },
        "meta": {"kinds": CAMPAIGN_KINDS, "statuses": CAMPAIGN_STATUSES},
    }


@admin_router.get("/campaigns")
async def pb_campaigns_list(status: str = None, kind: str = None, user=Depends(require_role("admin"))):
    await ensure_seed()
    return {"items": await campaigns.list_campaigns(status, kind)}


@admin_router.post("/campaigns")
async def pb_campaign_create(body: dict = Body(...), user=Depends(require_role("admin"))):
    try:
        return await campaigns.create_campaign(body, user.get("email", "admin"))
    except ValueError as e:
        raise HTTPException(400, str(e))


@admin_router.patch("/campaigns/{cid}")
async def pb_campaign_update(cid: str, body: dict = Body(...), user=Depends(require_role("admin"))):
    try:
        return await campaigns.update_campaign(cid, body)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except LookupError as e:
        raise HTTPException(404, str(e))


@admin_router.get("/config")
async def pb_config_get(user=Depends(require_role("admin"))):
    cfg = await get_config()
    cfg.pop("_id", None)
    return cfg


@admin_router.patch("/config")
async def pb_config_patch(body: dict = Body(...), user=Depends(require_role("admin"))):
    try:
        cfg = await update_config(body, user.get("email", "admin"))
        cfg.pop("_id", None)
        return cfg
    except ValueError as e:
        raise HTTPException(400, str(e))


@admin_router.get("/subscription-health")
async def pb_sub_health(status: str = None, user=Depends(require_role("admin"))):
    q = {"status": status} if status else {}
    items = await db.pb_subscription_health.find(q, {"_id": 0}).sort("score", 1).to_list(200)
    return {"items": items}


@admin_router.get("/subscription-health/{email}")
async def pb_sub_health_user(email: str, user=Depends(require_role("admin"))):
    target = await db.users.find_one({"email": email.strip().lower()})
    if not target:
        raise HTTPException(404, f"Utilizator inexistent: {email}")
    target["id"] = target.get("id") or str(target["_id"])
    return await subscription_health(target)


@admin_router.get("/ecosystem-health")
async def pb_eco_health(user=Depends(require_role("admin"))):
    return await ecosystem_health()


@admin_router.get("/impact-scores")
async def pb_impact_scores(user=Depends(require_role("admin"))):
    return await subscription_impact_scores()


@admin_router.get("/growth-advisor")
async def pb_growth_advisor(refresh: bool = False, user=Depends(require_role("admin"))):
    return await growth_advisor(refresh=refresh)


@admin_router.post("/run-tick")
async def pb_run_tick(user=Depends(require_role("admin"))):
    return await pb_daily_tick()


# ============================================================================
# Tick zilnic — expirări, activări referral, snapshot Subscription Health
# ============================================================================
async def pb_daily_tick() -> dict:
    expired = await ledger.expire_tick()
    activated = await referral_activation_tick()
    snap = await health_snapshot_tick()
    result = {"benefits_expired": expired, "referrals_activated": activated, **snap}
    logger.info(f"[propbenefits] daily tick: {result}")
    return result
