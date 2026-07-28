"""PropBenefits · Config — totul configurabil de admin FĂRĂ cod (pb_config singleton)."""
from datetime import datetime, timezone

from db import db

CAMPAIGN_KINDS = ["active_benefit", "seasonal", "local", "city_partner", "digital_twin",
                  "audit", "house_health", "fair_price", "community", "referral"]
CAMPAIGN_STATUSES = ["draft", "preparing", "scheduled", "active", "ended"]

DEFAULT_CONFIG = {
    "_id": "pb_config",
    "levels": [
        {"key": "explorer", "name": "Explorer", "rank": 0, "min_points": 0,
         "perks": ["Acces la Beneficiile Active de bază"]},
        {"key": "bronze", "name": "Bronze", "rank": 1, "min_points": 20,
         "perks": ["Prioritate la campaniile locale"]},
        {"key": "silver", "name": "Silver", "rank": 2, "min_points": 40,
         "perks": ["Acces la campaniile sezoniere dedicate"]},
        {"key": "gold", "name": "Gold", "rank": 3, "min_points": 60,
         "perks": ["Prioritate la specialiștii de top", "Beneficii cu valoare mai mare"]},
        {"key": "verified", "name": "Verified", "rank": 4, "min_points": 80,
         "perks": ["Acces la campaniile exclusive Digital Twin"]},
        {"key": "elite", "name": "Elite", "rank": 5, "min_points": 95,
         "perks": ["Acces anticipat la orice campanie", "AI Success Manager prioritar"]},
    ],
    "level_points": {
        "subscription_active": 25, "digital_twin": 15, "documents_5plus": 10,
        "house_health": 10, "completed_jobs_3plus": 15, "referrals_2plus": 10,
        "account_90days": 5, "email_verified": 5, "experience_tier_verified": 5,
    },
    "referral_benefit": {
        "enabled": True,
        "trigger": "subscription_or_first_paid_service",
        "inviter": {"benefit_key": "referral_inviter", "value_estimate": 25,
                    "title": "Beneficiu Comunitate: o lună House Health cadou la reînnoire"},
        "invitee": {"benefit_key": "referral_invitee", "value_estimate": 15,
                    "title": "Beneficiu de bun venit: verificare tehnică prioritară"},
        "expires_days": 90,
    },
    "subscription_health_weights": {
        "activity": 20, "documents": 15, "house_health": 15, "digital_twin": 10,
        "campaigns": 10, "benefits_used": 10, "referrals": 10, "ai_usage": 10,
    },
    "notifications": {"success_manager_enabled": True, "max_per_week": 2},
    "ecosystem_targets": {"subscriptions": 100, "twins": 100, "hh_subs": 50,
                          "campaigns_active": 5, "specialists_active": 25,
                          "city_partners": 5, "retention_pct": 60},
}

SEED_CAMPAIGNS = [
    {"id": "pbcamp_hh_check", "title": "Verificare centrală gratuită",
     "description": "Beneficiu Activ pentru membrii cu abonament: o verificare a centralei termice inclusă, realizată de un specialist verificat.",
     "kind": "house_health", "status": "active", "priority": 4,
     "budget_total": 500, "max_claims": 20, "max_per_user": 1,
     "eligibility": {"subscription_active": True},
     "estimated_impact": {"activation": 7, "retention": 9, "conversion": 5},
     "benefit": {"benefit_key": "hh_boiler_check", "title": "Verificare centrală gratuită",
                 "value_estimate": 25, "expires_days": 60,
                 "instructions": "Programează verificarea din Calendarul de mentenanță — specialistul vine gratuit."}},
    {"id": "pbcamp_twin_audit", "title": "Audit Digital Twin cu beneficiu de membru -70%",
     "description": "Oportunitate exclusivă: audit tehnic complet al locuinței cu acoperire de 70% din valoare pentru membrii cu Digital Twin activ.",
     "kind": "audit", "status": "active", "priority": 5,
     "budget_total": 1000, "max_claims": 10, "max_per_user": 1,
     "eligibility": {"has_digital_twin": True},
     "estimated_impact": {"activation": 8, "retention": 8, "conversion": 7},
     "benefit": {"benefit_key": "twin_audit_70", "title": "Audit Digital Twin acoperit 70%",
                 "value_estimate": 100, "expires_days": 45,
                 "instructions": "Auditul se programează cu un specialist certificat PropManage."}},
    {"id": "pbcamp_design_consult", "title": "Consultanță Design Interior",
     "description": "Beneficiu sezonier: o sesiune de consultanță de design interior pentru proprietarii cu Cartea Casei începută.",
     "kind": "seasonal", "status": "active", "priority": 3,
     "budget_total": 300, "max_claims": 15, "max_per_user": 1,
     "eligibility": {"min_documents": 1},
     "estimated_impact": {"activation": 5, "retention": 6, "conversion": 6},
     "benefit": {"benefit_key": "design_consult", "title": "Sesiune consultanță design interior",
                 "value_estimate": 20, "expires_days": 60,
                 "instructions": "Sesiunea se ține online cu un designer partener."}},
    {"id": "pbcamp_community_ref", "title": "Beneficiu Comunitate — adu un vecin",
     "description": "Când vecinul invitat de tine își activează abonamentul sau primul serviciu plătit, amândoi primiți un beneficiu de comunitate.",
     "kind": "community", "status": "active", "priority": 4,
     "budget_total": 0, "max_claims": 0, "max_per_user": 0,
     "eligibility": {},
     "estimated_impact": {"activation": 6, "retention": 7, "conversion": 9},
     "benefit": {"benefit_key": "referral_inviter", "title": "Beneficiu Comunitate",
                 "value_estimate": 25, "expires_days": 90,
                 "instructions": "Se acordă automat la activarea vecinului — trimite invitația din Setări → Invită și câștigă."}},
]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def get_config() -> dict:
    doc = await db.pb_config.find_one({"_id": "pb_config"})
    if not doc:
        doc = {**DEFAULT_CONFIG, "updated_at": _now()}
        await db.pb_config.insert_one(doc)
    return doc


async def update_config(patch: dict, updated_by: str) -> dict:
    allowed = {"levels", "level_points", "referral_benefit", "subscription_health_weights",
               "notifications", "ecosystem_targets"}
    clean = {k: v for k, v in patch.items() if k in allowed}
    if not clean:
        raise ValueError("Nicio cheie validă de configurare.")
    if "levels" in clean:
        if not isinstance(clean["levels"], list) or len(clean["levels"]) < 2:
            raise ValueError("levels trebuie să fie o listă cu minimum 2 niveluri.")
        for lv in clean["levels"]:
            if not all(k in lv for k in ("key", "name", "rank", "min_points")):
                raise ValueError("Fiecare nivel necesită key, name, rank, min_points.")
    clean["updated_at"] = _now()
    clean["updated_by"] = updated_by
    await db.pb_config.update_one({"_id": "pb_config"}, {"$set": clean}, upsert=True)
    return await get_config()


async def ensure_seed():
    await get_config()
    for c in SEED_CAMPAIGNS:
        exists = await db.pb_campaigns.find_one({"id": c["id"]}, {"_id": 1})
        if not exists:
            await db.pb_campaigns.insert_one({**c, "budget_used": 0, "claims_count": 0,
                                              "city": c.get("city"), "starts_at": None, "ends_at": None,
                                              "created_by": "seed", "created_at": _now(), "updated_at": _now()})
