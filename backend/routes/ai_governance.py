"""AI Governance Center — API (Phase 1, observability-only)

Read-only endpoints over the existing AI ecosystem. Aggregates data from
existing collections without modifying any agent or audit source.

Endpoints:
  GET /api/admin/ai-governance/summary       — high-level KPIs
  GET /api/admin/ai-governance/agents        — list all agents with live stats
  GET /api/admin/ai-governance/agents/{slug} — single agent detail with metrics
  GET /api/admin/ai-governance/costs         — rough monthly cost estimate
  GET /api/admin/ai-governance/audit-trail   — unified recent events across sources
"""
import logging
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException

from db import db
from deps import require_role
from ai_governance.agent_registry import (
    get_agents, get_agent, agents_by_category, registry_summary,
    PROVIDER_AVG_COST_PER_CALL_EUR,
)

logger = logging.getLogger("propmanage.ai_governance")
router = APIRouter(prefix="/api/admin/ai-governance", tags=["ai-governance"])


# Safe collection name resolver — handles missing collections gracefully
async def _safe_count(coll_name: str, query: dict | None = None) -> int:
    try:
        coll = db[coll_name]
        return await coll.count_documents(query or {})
    except Exception as e:  # noqa: BLE001
        logger.debug(f"[governance] count failed on {coll_name}: {e}")
        return 0


async def _safe_latest_timestamp(coll_name: str, date_fields: list = None) -> str | None:
    """Return ISO of most recent document, trying common date field names."""
    date_fields = date_fields or ["created_at", "updated_at", "sent_at", "run_at", "ran_at", "ts", "timestamp", "at"]
    try:
        coll = db[coll_name]
        for fld in date_fields:
            doc = await coll.find_one({fld: {"$exists": True}}, sort=[(fld, -1)])
            if doc and doc.get(fld):
                v = doc[fld]
                return v.isoformat() if hasattr(v, "isoformat") else str(v)
        return None
    except Exception as e:  # noqa: BLE001
        logger.debug(f"[governance] latest_ts failed on {coll_name}: {e}")
        return None


async def _agent_live_stats(agent: dict) -> dict:
    """Compute live metrics for one agent from its declared data sources."""
    sources = agent.get("data_sources", [])
    total_items = 0
    latest_iso: str | None = None
    items_24h = 0
    items_7d = 0

    now = datetime.now(timezone.utc)
    cutoff_24h = now - timedelta(hours=24)
    cutoff_7d = now - timedelta(days=7)

    for src in sources:
        cnt = await _safe_count(src)
        total_items += cnt

        # Try to count in time windows (best effort across common date fields)
        for fld in ["created_at", "updated_at", "sent_at", "run_at", "ran_at", "ts", "at"]:
            try:
                c24 = await db[src].count_documents({fld: {"$gte": cutoff_24h}})
                if c24:
                    items_24h += c24
                    break
            except Exception:
                continue
        for fld in ["created_at", "updated_at", "sent_at", "run_at", "ran_at", "ts", "at"]:
            try:
                c7 = await db[src].count_documents({fld: {"$gte": cutoff_7d}})
                if c7:
                    items_7d += c7
                    break
            except Exception:
                continue

        ts = await _safe_latest_timestamp(src)
        if ts and (latest_iso is None or ts > latest_iso):
            latest_iso = ts

    return {
        "total_items": total_items,
        "items_24h": items_24h,
        "items_7d": items_7d,
        "latest_activity_at": latest_iso,
    }


@router.get("/summary")
async def get_summary(user=Depends(require_role("admin"))):
    """High-level dashboard KPIs."""
    reg = registry_summary()

    # Sum activity across all agents (rough but useful)
    total_24h = 0
    total_7d = 0
    for agent in get_agents():
        stats = await _agent_live_stats(agent)
        total_24h += stats["items_24h"]
        total_7d += stats["items_7d"]

    return {
        "phase": "Governance Phase 1 (Observability-Only)",
        "enforcement_active": False,
        **reg,
        "global_activity_24h": total_24h,
        "global_activity_7d": total_7d,
        "providers_tracked": list(PROVIDER_AVG_COST_PER_CALL_EUR.keys()),
        "note": (
            "Phase 1 is read-only. Cost figures are best-effort estimates "
            "based on collection counts. Token-level logging arrives in Phase 2."
        ),
    }


@router.get("/agents")
async def list_agents(user=Depends(require_role("admin"))):
    """Return all agents with live stats from their data sources."""
    out = []
    for agent in get_agents():
        stats = await _agent_live_stats(agent)
        out.append({**agent, "live": stats})
    return {"agents": out}


@router.get("/agents/by-category")
async def list_by_category(user=Depends(require_role("admin"))):
    return {"groups": agents_by_category()}


@router.get("/agents/{slug}")
async def get_one_agent(slug: str, user=Depends(require_role("admin"))):
    agent = get_agent(slug)
    if not agent:
        raise HTTPException(404, f"Agent not found: {slug}")
    stats = await _agent_live_stats(agent)
    return {**agent, "live": stats}


@router.get("/costs")
async def get_costs(user=Depends(require_role("admin"))):
    """Best-effort monthly cost estimate per agent.

    Formula: (items_7d * 4.3 weeks) * avg_cost_per_call(provider)
    This is INTENTIONALLY rough — Phase 2 will add real token logging.
    """
    breakdown = []
    total_monthly_eur = 0.0
    for agent in get_agents():
        if agent.get("provider") == "none":
            continue
        stats = await _agent_live_stats(agent)
        weekly = stats["items_7d"]
        monthly_calls = int(weekly * 4.3)
        per_call = PROVIDER_AVG_COST_PER_CALL_EUR.get(agent["provider"], 0.005)
        monthly_eur = round(monthly_calls * per_call, 2)
        total_monthly_eur += monthly_eur
        breakdown.append({
            "slug": agent["slug"],
            "name": agent["name"],
            "provider": agent["provider"],
            "calls_last_7d": weekly,
            "estimated_monthly_calls": monthly_calls,
            "avg_eur_per_call": per_call,
            "estimated_monthly_eur": monthly_eur,
        })
    breakdown.sort(key=lambda x: x["estimated_monthly_eur"], reverse=True)
    return {
        "estimated_total_monthly_eur": round(total_monthly_eur, 2),
        "currency": "EUR",
        "method": "weekly_count_extrapolated",
        "breakdown": breakdown,
        "disclaimer": (
            "Estimate-only. Real cost depends on token count per call which "
            "isn't logged yet. Use Profile → Universal Key → Billing for actuals."
        ),
    }


# Unified audit trail across existing audit sources
_AUDIT_SOURCES = [
    {"collection": "qa_sessions",                  "kind": "qa",          "date_field": "created_at", "title_field": "title"},
    {"collection": "admin_ai_findings",            "kind": "ai_finding",  "date_field": "created_at", "title_field": "title"},
    {"collection": "admin_ai_scans",               "kind": "ai_scan",     "date_field": "created_at", "title_field": "scan_type"},
    {"collection": "security_ai_runs",             "kind": "security",    "date_field": "created_at", "title_field": "scan_type"},
    {"collection": "autonomy_snapshots",           "kind": "autonomy",    "date_field": "created_at", "title_field": "tier"},
    {"collection": "auto_match_runs",              "kind": "match",       "date_field": "created_at", "title_field": "status"},
    {"collection": "ai_weekly_briefing_history",   "kind": "briefing",    "date_field": "sent_at",    "title_field": "subject"},
    {"collection": "future_ideas_digest_history",  "kind": "digest",      "date_field": "sent_at",    "title_field": "subject"},
    {"collection": "smoke_test_runs",              "kind": "smoke_test",  "date_field": "created_at", "title_field": "result"},
]


@router.get("/audit-trail")
async def get_audit_trail(limit_per_source: int = 5, user=Depends(require_role("admin"))):
    """Aggregate last N items from each existing audit source."""
    limit_per_source = max(1, min(limit_per_source, 25))
    events = []
    for src in _AUDIT_SOURCES:
        try:
            coll = db[src["collection"]]
            cursor = coll.find({}, {
                src["date_field"]: 1,
                src["title_field"]: 1,
                "id": 1,
            }).sort(src["date_field"], -1).limit(limit_per_source)
            async for doc in cursor:
                ts = doc.get(src["date_field"])
                title = doc.get(src["title_field"]) or "(untitled)"
                events.append({
                    "source": src["collection"],
                    "kind": src["kind"],
                    "title": str(title)[:160],
                    "at": ts.isoformat() if hasattr(ts, "isoformat") else str(ts) if ts else None,
                    "item_id": doc.get("id"),
                })
        except Exception as e:  # noqa: BLE001
            logger.debug(f"[governance] audit source {src['collection']} skipped: {e}")
    events.sort(key=lambda e: e["at"] or "", reverse=True)
    return {"events": events[:50], "sources_count": len(_AUDIT_SOURCES)}
