"""House Health (Sănătatea Casei) — Phase 1 Foundation.

Premium subscription-based health audit module for Digital Twin owners.

Endpoints (F1 scope):
    GET  /api/house-health/eligibility         — DT active + subscription gate
    GET  /api/house-health/dashboard           — card payload for client dashboard
    GET  /api/house-health/feature-flag        — public flag check (also embeds eligibility)

Collections (created lazily by MongoDB):
    hh_subscriptions, hh_evaluations, hh_measurements, hh_documents,
    hh_recommendations, hh_scores, hh_plans, hh_scoring_config, hh_audit_log

Feature flag: ``app_settings.house_health.enabled`` (bool, default False).
Rollback: set the flag to False — all endpoints return ``enabled=False`` and
the card hides itself client-side. No data loss; existing records preserved.
"""
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from db import db
from deps import get_current_user

logger = logging.getLogger("propmanage.house_health")

router = APIRouter(prefix="/api/house-health", tags=["house-health"])


async def _is_feature_enabled() -> bool:
    """Read the global feature flag from app_settings.house_health.enabled."""
    s = await db.app_settings.find_one({"_id": "house_health"})
    return bool((s or {}).get("enabled", False))


async def _user_has_active_twin(user_id: str) -> Optional[dict]:
    """Return the first DT project owned by user, or None."""
    p = await db.digital_twin_projects.find_one(
        {"owner_id": user_id},
        {"_id": 0, "id": 1, "name": 1, "property_id": 1, "created_at": 1},
    )
    return p


async def _user_active_subscription(user_id: str) -> Optional[dict]:
    """Return active hh_subscriptions doc for user (status=active OR trial)."""
    now_iso = datetime.now(timezone.utc).isoformat()
    sub = await db.hh_subscriptions.find_one({
        "user_id": user_id,
        "status": {"$in": ["active", "trial", "grace"]},
        "$or": [
            {"expires_at": {"$gt": now_iso}},
            {"expires_at": None},
            {"expires_at": {"$exists": False}},
        ],
    }, {"_id": 0})
    return sub


@router.get("/feature-flag")
async def feature_flag(user=Depends(get_current_user)):
    """Lightweight check used by ClientDashboard to decide if card renders."""
    enabled = await _is_feature_enabled()
    return {"enabled": enabled}


@router.get("/eligibility")
async def eligibility(user=Depends(get_current_user)):
    """Check if the current user can access House Health.

    Returns:
        {
          enabled: bool (feature flag),
          has_twin: bool,
          has_subscription: bool,
          twin: {id, name, property_id} or None,
          subscription: {plan, status, expires_at} or None,
          gate_message: str
        }
    """
    enabled = await _is_feature_enabled()
    if not enabled:
        return {
            "enabled": False,
            "has_twin": False,
            "has_subscription": False,
            "twin": None,
            "subscription": None,
            "gate_message": "Modulul House Health nu este activat pe această platformă.",
        }

    twin = await _user_has_active_twin(user["id"])
    sub = await _user_active_subscription(user["id"])

    if not twin:
        gate = "Serviciul House Health este disponibil doar proprietăților cu Digital Twin activ."
    elif not sub:
        gate = "Activează un abonament House Health pentru a accesa secțiunile."
    else:
        gate = ""

    return {
        "enabled": True,
        "has_twin": bool(twin),
        "has_subscription": bool(sub),
        "twin": twin,
        "subscription": (
            {
                "plan": sub.get("plan"),
                "status": sub.get("status"),
                "expires_at": sub.get("expires_at"),
            }
            if sub
            else None
        ),
        "gate_message": gate,
    }


@router.get("/dashboard")
async def dashboard(user=Depends(get_current_user)):
    """Payload for the HouseHealth card on ClientDashboard.

    Returns nullable fields so the UI can render a graceful skeleton when
    data is not yet populated (typical for F1 — fresh module).
    """
    enabled = await _is_feature_enabled()
    if not enabled:
        return {"enabled": False}

    twin = await _user_has_active_twin(user["id"])
    sub = await _user_active_subscription(user["id"])

    if not twin:
        return {
            "enabled": True,
            "locked": True,
            "lock_reason": "no_twin",
            "lock_message": "Serviciul House Health este disponibil doar proprietăților cu Digital Twin activ.",
        }

    twin_id = twin.get("id")

    # Score (latest)
    score_doc = await db.hh_scores.find_one({"twin_project_id": twin_id}, sort=[("computed_at", -1)])
    score_overall = (score_doc or {}).get("overall")
    classification = (score_doc or {}).get("classification")

    # Last + next evaluation
    last_eval = await db.hh_evaluations.find_one(
        {"twin_project_id": twin_id, "status": "approved"},
        sort=[("date", -1)],
    )
    last_eval_date = (last_eval or {}).get("date")
    next_eval_date = None
    if last_eval_date:
        try:
            d = datetime.fromisoformat(last_eval_date.replace("Z", "+00:00"))
            next_eval_date = d.replace(year=d.year + 1).isoformat()
        except Exception:  # noqa: BLE001
            next_eval_date = None

    # Document count
    docs_count = await db.hh_documents.count_documents({"twin_project_id": twin_id})

    # Last report (most recent doc with category=hh_report or last approved eval)
    last_report = await db.hh_documents.find_one(
        {"twin_project_id": twin_id, "category": "hh_report"},
        sort=[("doc_date", -1)],
    )

    return {
        "enabled": True,
        "locked": not sub,
        "lock_reason": None if sub else "no_subscription",
        "lock_message": "" if sub else "Activează un abonament House Health pentru a accesa secțiunile.",
        "twin": twin,
        "subscription": sub,
        "score_overall": score_overall,
        "classification": classification,
        "last_evaluation_date": last_eval_date,
        "next_evaluation_date": next_eval_date,
        "documents_count": docs_count,
        "last_report_id": (last_report or {}).get("id"),
    }
