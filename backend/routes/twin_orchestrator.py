"""Twin Orchestrator AI Agent — Phase 2.1 (Read-only insights).

Aggregates twin lifecycle info from existing collections (twins, maintenance_logs,
digital_twin_*) and generates AI insights on each twin without modifying any
data. SUGGEST permission level — never executes anything.

Insights produced:
  - lifecycle_status      (draft / active / stale / abandoned)
  - last_activity_at      (across all related collections)
  - maintenance_summary   (count by status)
  - completeness_score    (% fields filled)
  - ai_recommendations    (Claude-generated suggestions, cached)

Architecture:
  - Pure aggregation: no writes to twins/maintenance_logs.
  - Cache for AI insights: collection `twin_orchestrator_cache` (TTL 6h).
  - Feature flag: enable_twin_orchestrator (default OFF for safety).
"""
import logging
import hashlib
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from db import db
from deps import require_role
from ai_core import provider as ai_provider

logger = logging.getLogger("propmanage.twin_orchestrator")
router = APIRouter(prefix="/api/admin/twin-orchestrator", tags=["twin-orchestrator"])

ENABLE_FLAG_KEY = "enable_twin_orchestrator"
CACHE_COLL = "twin_orchestrator_cache"
CACHE_TTL_HOURS = 6


# ----- helpers --------------------------------------------------------------

async def _feature_flag_on() -> bool:
    doc = await db.app_settings.find_one({"_id": "app_settings"}, {ENABLE_FLAG_KEY: 1})
    return bool(doc and doc.get(ENABLE_FLAG_KEY, False))


def _iso(v) -> Optional[str]:
    if not v:
        return None
    return v.isoformat() if hasattr(v, "isoformat") else str(v)


def _completeness(twin: dict) -> int:
    """Rough completeness: count meaningful fields filled."""
    keys = ["name", "address", "model_url", "floorplan_url", "asset_registry",
            "description", "tags", "owner_user_id", "property_id"]
    filled = sum(1 for k in keys if twin.get(k))
    return int(filled / len(keys) * 100)


def _lifecycle_status(twin: dict, last_activity: Optional[datetime]) -> str:
    """Pure heuristic — no AI call."""
    status = (twin.get("status") or "").lower()
    if status in ("draft", "draft_pending"):
        return "draft"
    if not last_activity:
        return "active" if status == "active" else "draft"
    age_days = (datetime.now(timezone.utc) - last_activity).days
    if age_days > 180:
        return "abandoned"
    if age_days > 60:
        return "stale"
    return "active"


async def _gather_twin_context(twin_id: str) -> dict:
    """Aggregate everything we know about this twin from existing collections."""
    twin = await db.twins.find_one({"id": twin_id}) or await db.twins.find_one({"_id": twin_id})
    if not twin:
        return {}

    # Maintenance logs related
    maint_cur = db.maintenance_logs.find({"twin_id": twin_id}).sort("created_at", -1).limit(20)
    maint = []
    async for m in maint_cur:
        maint.append({
            "id": str(m.get("id") or m.get("_id")),
            "type": m.get("type"),
            "status": m.get("status"),
            "created_at": _iso(m.get("created_at")),
            "summary": (m.get("summary") or "")[:200],
        })

    # Comments + Pins (engagement signals)
    comments_count = await db.digital_twin_comments.count_documents({"twin_id": twin_id})
    pins_count = await db.digital_twin_pins.count_documents({"twin_id": twin_id})

    # Last activity across sources
    candidates = []
    for fld in ("updated_at", "created_at"):
        if twin.get(fld):
            candidates.append(twin[fld])
    if maint:
        candidates.append(maint[0].get("created_at"))
    last_activity: Optional[datetime] = None
    for c in candidates:
        if not c:
            continue
        dt = c if isinstance(c, datetime) else None
        if dt is None and isinstance(c, str):
            try:
                dt = datetime.fromisoformat(c.replace("Z", "+00:00"))
            except Exception:
                dt = None
        if dt and (last_activity is None or dt > last_activity):
            last_activity = dt

    # Maintenance summary
    by_status: dict = {}
    for m in maint:
        s = m.get("status") or "unknown"
        by_status[s] = by_status.get(s, 0) + 1

    return {
        "twin_id": twin_id,
        "name": twin.get("name"),
        "address": twin.get("address"),
        "status": twin.get("status"),
        "property_id": twin.get("property_id"),
        "owner_user_id": twin.get("owner_user_id"),
        "completeness_score": _completeness(twin),
        "lifecycle_status": _lifecycle_status(twin, last_activity),
        "last_activity_at": _iso(last_activity),
        "maintenance_summary": {"total": len(maint), "by_status": by_status, "recent": maint[:5]},
        "engagement": {"comments": comments_count, "pins": pins_count},
    }


# ----- API endpoints --------------------------------------------------------

@router.get("/status")
async def get_status(user=Depends(require_role("admin"))):
    flag = await _feature_flag_on()
    return {
        "phase": "Phase 2.1 (Read-only insights)",
        "feature_flag": ENABLE_FLAG_KEY,
        "feature_flag_value": flag,
        "ai_available": True,
        "permission_level": "suggest",
        "note": "Twin Orchestrator is observability + AI insights only. NEVER modifies twins or maintenance.",
    }


@router.get("/overview")
async def overview(user=Depends(require_role("admin"))):
    """Cross-twin KPIs (no AI calls)."""
    total = await db.twins.count_documents({})
    if total == 0:
        return {"total_twins": 0, "by_lifecycle": {}, "by_completeness": {},
                "stale_count": 0, "abandoned_count": 0}

    by_lifecycle: dict = {}
    completeness_buckets = {"0-25": 0, "26-50": 0, "51-75": 0, "76-100": 0}
    stale = 0
    abandoned = 0
    sample = []

    cur = db.twins.find({}).limit(200)
    async for twin in cur:
        last_activity = twin.get("updated_at") or twin.get("created_at")
        if isinstance(last_activity, str):
            try:
                last_activity = datetime.fromisoformat(last_activity.replace("Z", "+00:00"))
            except Exception:
                last_activity = None
        lc = _lifecycle_status(twin, last_activity)
        by_lifecycle[lc] = by_lifecycle.get(lc, 0) + 1
        if lc == "stale":
            stale += 1
        if lc == "abandoned":
            abandoned += 1
        comp = _completeness(twin)
        bucket = "0-25" if comp <= 25 else "26-50" if comp <= 50 else "51-75" if comp <= 75 else "76-100"
        completeness_buckets[bucket] += 1
        if len(sample) < 12:
            sample.append({
                "twin_id": twin.get("id") or str(twin.get("_id")),
                "name": twin.get("name") or "(unnamed)",
                "lifecycle_status": lc,
                "completeness_score": comp,
                "last_activity_at": _iso(last_activity),
            })

    return {
        "total_twins": total,
        "sampled": min(total, 200),
        "by_lifecycle": by_lifecycle,
        "by_completeness": completeness_buckets,
        "stale_count": stale,
        "abandoned_count": abandoned,
        "sample": sample,
    }


@router.get("/twin/{twin_id}")
async def twin_detail(twin_id: str, user=Depends(require_role("admin"))):
    """Full read-only profile + lifecycle of one twin (no AI call)."""
    ctx = await _gather_twin_context(twin_id)
    if not ctx:
        raise HTTPException(404, f"Twin not found: {twin_id}")
    return ctx


@router.post("/twin/{twin_id}/insights")
async def twin_insights(twin_id: str, force_refresh: bool = False,
                        user=Depends(require_role("admin"))):
    """Generate AI insights for a single twin (Claude). Cached 6h.

    Returns SUGGESTIONS only — never executes. Founder reviews and acts manually.
    """
    if not await _feature_flag_on():
        raise HTTPException(
            403,
            "Twin Orchestrator feature flag is OFF. Enable enable_twin_orchestrator in app_settings.",
        )

    ctx = await _gather_twin_context(twin_id)
    if not ctx:
        raise HTTPException(404, f"Twin not found: {twin_id}")

    cache_key = f"twin_insights_{twin_id}"
    if not force_refresh:
        cached = await db[CACHE_COLL].find_one({"_id": cache_key})
        if cached:
            generated_at = cached.get("generated_at")
            if isinstance(generated_at, str):
                try:
                    generated_at = datetime.fromisoformat(generated_at.replace("Z", "+00:00"))
                except Exception:
                    generated_at = None
            if generated_at and (datetime.now(timezone.utc) - generated_at) < timedelta(hours=CACHE_TTL_HOURS):
                cached.pop("_id", None)
                cached["from_cache"] = True
                return cached

    # Build prompt
    prompt = f"""You are the Twin Orchestrator AI for a property management platform.
Analyze this digital twin and give 3-5 actionable suggestions for the founder.
Stay SHORT (1 line per suggestion). Romanian language preferred.

Twin context (JSON):
{ctx}

Output strictly as JSON with this shape:
{{"summary": "1-2 sentence overview",
  "suggestions": [{{"title": "...", "priority": "high|medium|low",
                    "category": "maintenance|engagement|completeness|risk|opportunity",
                    "rationale": "1 short sentence"}}],
  "risk_score": 0-100,
  "opportunity_score": 0-100}}
"""

    try:
        llm_resp = await ai_provider.call_llm(
            system_message="You are the Twin Orchestrator AI for a property management platform. Output strictly valid JSON.",
            user_message=prompt,
        )
        if llm_resp.get("error"):
            raise RuntimeError(llm_resp["error"])
        # Best-effort JSON parse
        import json as _json
        text = llm_resp.get("text", "").strip()
        # Strip code fences if present
        if text.startswith("```"):
            text = text.split("```")[1].lstrip("json").strip()
            if text.endswith("```"):
                text = text[:-3].strip()
        try:
            response = _json.loads(text)
        except Exception:
            response = {"summary": text[:500], "suggestions": [], "risk_score": 0, "opportunity_score": 0,
                        "_parse_warning": "Non-JSON response from LLM"}
    except Exception as e:  # noqa: BLE001
        logger.warning(f"[twin_orchestrator] AI provider failed: {e}")
        raise HTTPException(503, f"AI provider unavailable: {str(e)[:200]}")

    payload = {
        "twin_id": twin_id,
        "twin_name": ctx.get("name"),
        "lifecycle_status": ctx.get("lifecycle_status"),
        "completeness_score": ctx.get("completeness_score"),
        "insights": response,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "from_cache": False,
    }
    try:
        await db[CACHE_COLL].update_one(
            {"_id": cache_key},
            {"$set": payload},
            upsert=True,
        )
    except Exception as e:  # noqa: BLE001
        logger.debug(f"[twin_orchestrator] cache persist failed: {e}")
    return payload
