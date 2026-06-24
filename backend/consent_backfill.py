"""Idempotent backfill for GDPR consent + email verification fields.

Called once at backend startup. Grandfather-clauses existing users:
  - terms_accepted = True
  - privacy_policy_accepted = True
  - marketing_consent = False (must be opt-in)
  - email_verified = True (existing users are trusted)
  - phone_verified = False (none verified yet — SMS not implemented)
  - consent_grandfathered = True (mark for audit purposes)

Safe to re-run: only updates docs missing the fields. Never overwrites existing values.
"""
import logging
from datetime import datetime, timezone
from db import db

logger = logging.getLogger("propmanage.consent_backfill")


async def run_consent_backfill():
    """Backfill consent + verification fields for users created before GDPR Phase 1."""
    try:
        # Match users missing the new fields (any one of them missing)
        query = {
            "$or": [
                {"terms_accepted": {"$exists": False}},
                {"privacy_policy_accepted": {"$exists": False}},
                {"email_verified": {"$exists": False}},
            ]
        }
        count = await db.users.count_documents(query)
        if count == 0:
            logger.info("[consent_backfill] no users need backfill — skipping")
            return {"backfilled": 0}

        now_iso = datetime.now(timezone.utc).isoformat()
        # Iterate and update each missing field per user (preserve any existing flags)
        backfilled = 0
        async for u in db.users.find(query, {"_id": 1, "email": 1, "terms_accepted": 1, "privacy_policy_accepted": 1, "email_verified": 1, "marketing_consent": 1, "phone_verified": 1}):
            updates = {}
            if "terms_accepted" not in u:
                updates["terms_accepted"] = True
            if "privacy_policy_accepted" not in u:
                updates["privacy_policy_accepted"] = True
            if "marketing_consent" not in u:
                updates["marketing_consent"] = False
            if "email_verified" not in u:
                updates["email_verified"] = True
            if "phone_verified" not in u:
                updates["phone_verified"] = False
            if updates:
                updates["consent_grandfathered"] = True
                updates["consent_updated_at"] = now_iso
                await db.users.update_one({"_id": u["_id"]}, {"$set": updates})
                backfilled += 1
        logger.info(f"[consent_backfill] grandfathered {backfilled} existing users")
        return {"backfilled": backfilled}
    except Exception as e:  # noqa: BLE001
        logger.error(f"[consent_backfill] failed: {e}", exc_info=True)
        return {"error": str(e)}
