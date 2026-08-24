"""PropManage — Central Entitlement Layer.

Punct unic de adevăr pentru „utilizatorul X are acces la feature Y?".
Reutilizează colecțiile existente `hh_subscriptions` + `hh_plans`.
Nu duplică infrastructura: doar traduce starea existentă a subscription-ului
într-un vocabular de FEATURES + TIERS pe care îl folosesc frontend, backend
și viitoarele module.

Design:
  - Tier-urile actuale recunoscute: FREE, CLIENT_BASIC, CLIENT_PRO, CLIENT_PREMIUM
  - Feature-urile sunt string-uri stabile (ex. "house_health_basic")
  - Mapping-ul TIER → set(features) e centralizat aici (o singură sursă)
  - Admin/operator/franchise_admin au acces TOTAL (bypass entitlement)
  - Specialist rămâne pe fluxul propriu (nu e afectat de acest gate)
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import Depends, HTTPException

from db import db
from deps import get_current_user

logger = logging.getLogger("propmanage.entitlements")

# =============================================================================
# TIERS + FEATURES CATALOG (SINGURA SURSĂ)
# =============================================================================
TIER_FREE = "FREE"
TIER_CLIENT_BASIC = "CLIENT_BASIC"
TIER_CLIENT_PRO = "CLIENT_PRO"
TIER_CLIENT_PREMIUM = "CLIENT_PREMIUM"

# Ordine crescătoare (fiecare tier moștenește tot ce e sub el)
TIER_ORDER = [TIER_FREE, TIER_CLIENT_BASIC, TIER_CLIENT_PRO, TIER_CLIENT_PREMIUM]

# Mapare slug hh_plans → tier PropManage (nu redenumim datele existente)
PLAN_SLUG_TO_TIER = {
    "basic": TIER_CLIENT_BASIC,
    "pro": TIER_CLIENT_PRO,
    "premium": TIER_CLIENT_PREMIUM,
    "custom": TIER_CLIENT_PRO,  # custom = tratat ca PRO by default
}

# Feature-uri stabile (identificatori unici — nu se schimbă niciodată)
F_PROPERTY_CREATE = "property_create"
F_PROPERTY_TECHNICAL_RECORD = "property_technical_record"
F_HOUSE_HEALTH_BASIC = "house_health_basic"
F_HOUSE_HEALTH_ADVANCED = "house_health_advanced"
F_DIGITAL_TWIN_ADVANCED = "digital_twin_advanced"

# Tier → features acordate (fără moștenire — moștenirea se calculează runtime)
TIER_FEATURES: dict[str, set[str]] = {
    TIER_FREE: {
        F_PROPERTY_CREATE,
        F_PROPERTY_TECHNICAL_RECORD,
    },
    TIER_CLIENT_BASIC: {
        F_HOUSE_HEALTH_BASIC,
    },
    TIER_CLIENT_PRO: {
        F_HOUSE_HEALTH_ADVANCED,
    },
    TIER_CLIENT_PREMIUM: {
        F_DIGITAL_TWIN_ADVANCED,
    },
}

# Metadata prezentabil pentru UI (nu e sursă de adevăr, doar helper)
FEATURE_LABELS = {
    F_PROPERTY_CREATE: "Adăugare proprietate",
    F_PROPERTY_TECHNICAL_RECORD: "Dosar Tehnic",
    F_HOUSE_HEALTH_BASIC: "House Health Basic",
    F_HOUSE_HEALTH_ADVANCED: "House Health avansat",
    F_DIGITAL_TWIN_ADVANCED: "Digital Twin avansat",
}

TIER_LABELS = {
    TIER_FREE: "Gratuit",
    TIER_CLIENT_BASIC: "PropManage Basic",
    TIER_CLIENT_PRO: "PropManage Pro",
    TIER_CLIENT_PREMIUM: "PropManage Premium",
}


# =============================================================================
# CORE — starea de entitlement pentru un user
# =============================================================================
async def _fetch_active_subscription(user_id: str) -> Optional[dict]:
    """Reutilizează structura existentă hh_subscriptions (status active/trial/grace)."""
    now_iso = datetime.now(timezone.utc).isoformat()
    return await db.hh_subscriptions.find_one(
        {
            "user_id": user_id,
            "status": {"$in": ["active", "trial", "grace"]},
            "$or": [
                {"expires_at": {"$gt": now_iso}},
                {"expires_at": None},
                {"expires_at": {"$exists": False}},
            ],
        },
        {"_id": 0},
    )


def _tier_from_role_and_sub(role: Optional[str], sub: Optional[dict]) -> str:
    """Admin/operator/franchise_admin primesc automat cel mai înalt tier.
    Specialist e pe canal separat (nu e utilizator plătitor) — tier=FREE tehnic dar
    nu e afectat de gate-urile pentru clienți."""
    if role in ("admin", "operator", "franchise_admin"):
        return TIER_CLIENT_PREMIUM
    if not sub:
        return TIER_FREE
    slug = (sub.get("plan") or "").lower()
    return PLAN_SLUG_TO_TIER.get(slug, TIER_CLIENT_BASIC)


def _resolve_features(tier: str) -> set[str]:
    """Un user cu tier X primește toate feature-urile din toate tier-urile ≤ X."""
    if tier not in TIER_ORDER:
        return set(TIER_FEATURES.get(TIER_FREE, set()))
    idx = TIER_ORDER.index(tier)
    features: set[str] = set()
    for t in TIER_ORDER[: idx + 1]:
        features |= TIER_FEATURES.get(t, set())
    return features


async def get_user_entitlements(user: dict) -> dict:
    """Contract stabil pentru orice caller (route, dependency, admin lookup).

    Returns:
      {
        user_id, role, tier, tier_label,
        subscription: {plan, status, expires_at} sau None,
        features: [feature_ids],
        is_admin_bypass: bool
      }
    """
    role = user.get("active_view") or user.get("role")
    is_admin_bypass = role in ("admin", "operator", "franchise_admin")
    sub = None if is_admin_bypass else await _fetch_active_subscription(str(user["id"]))
    tier = _tier_from_role_and_sub(role, sub)
    features = _resolve_features(tier)
    return {
        "user_id": str(user["id"]),
        "role": role,
        "tier": tier,
        "tier_label": TIER_LABELS.get(tier, tier),
        "subscription": (
            {
                "plan": sub.get("plan"),
                "status": sub.get("status"),
                "expires_at": sub.get("expires_at"),
            }
            if sub
            else None
        ),
        "features": sorted(features),
        "is_admin_bypass": is_admin_bypass,
    }


async def user_has_feature(user: dict, feature: str) -> bool:
    ent = await get_user_entitlements(user)
    return feature in set(ent["features"])


# =============================================================================
# FASTAPI DEPENDENCY — protecție API centralizată
# =============================================================================
def require_entitlement(feature: str):
    """Folosit ca dependency FastAPI:
        @router.post(...)
        async def endpoint(user=Depends(require_entitlement(F_HOUSE_HEALTH_BASIC))):
            ...
    """
    async def _dep(user: dict = Depends(get_current_user)) -> dict:
        if not feature or feature not in FEATURE_LABELS:
            # feature necunoscut → nu blocăm silențios, dar log
            logger.warning("require_entitlement: feature necunoscut %r", feature)
        ent = await get_user_entitlements(user)
        if feature in set(ent["features"]):
            return user
        raise HTTPException(
            status_code=402,  # Payment Required — semantic corect pentru gating
            detail={
                "error": "entitlement_required",
                "feature": feature,
                "feature_label": FEATURE_LABELS.get(feature, feature),
                "current_tier": ent["tier"],
                "current_tier_label": ent["tier_label"],
                "message": f"„{FEATURE_LABELS.get(feature, feature)}” este inclus în PropManage Basic. Activează abonamentul pentru a accesa această funcție.",
            },
        )
    return _dep


def get_tier_catalog() -> dict:
    """Snapshot al catalogului tier→features (folosit de admin UI / debug)."""
    return {
        "tiers": [
            {"id": t, "label": TIER_LABELS[t], "features": sorted(TIER_FEATURES.get(t, set()))}
            for t in TIER_ORDER
        ],
        "features": [
            {"id": f, "label": lbl}
            for f, lbl in FEATURE_LABELS.items()
        ],
    }
