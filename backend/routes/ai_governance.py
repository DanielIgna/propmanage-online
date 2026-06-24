"""AI Governance Center — API (Phase 1, observability + lifecycle management)

Read-only observability over the existing AI ecosystem PLUS an operational
deprecation workflow that lets the founder retire legacy agents in a
controlled fashion (without touching the static registry source code).

Endpoints:
  GET  /api/admin/ai-governance/summary             — high-level KPIs
  GET  /api/admin/ai-governance/agents              — list all agents with live stats
  GET  /api/admin/ai-governance/agents/{slug}       — single agent detail with metrics
  GET  /api/admin/ai-governance/costs               — rough monthly cost estimate
  GET  /api/admin/ai-governance/audit-trail         — unified recent events across sources
  GET  /api/admin/ai-governance/deprecation-plan    — timeline of deprecations
  POST /api/admin/ai-governance/agents/{slug}/deprecate     — mark agent as deprecated
  POST /api/admin/ai-governance/agents/{slug}/undeprecate   — restore lifecycle
"""
import logging
import uuid
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Body, Depends, HTTPException

from db import db
from deps import require_role
from ai_governance.agent_registry import (
    get_agents, get_agent, agents_by_category, registry_summary,
    PROVIDER_AVG_COST_PER_CALL_EUR,
)

# Persistent deprecation overrides live in this collection. Each doc:
#   { _id, slug, status: "deprecated"|"restored", reason, replacement,
#     target_retirement_date, impact: {...}, by, by_email, at, history: [...] }
DEPRECATION_COLLECTION = "ai_agent_deprecations"

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


async def _load_deprecations() -> dict:
    """Return {slug: deprecation_doc} for all *active* (status=deprecated) overrides."""
    out: dict = {}
    try:
        cur = db[DEPRECATION_COLLECTION].find({"status": "deprecated"})
        async for d in cur:
            d.pop("_id", None)
            out[d["slug"]] = d
    except Exception as e:  # noqa: BLE001
        logger.debug(f"[governance] load deprecations failed: {e}")
    return out


def _merge_deprecation(agent: dict, dep: dict | None) -> dict:
    """Overlay deprecation metadata onto static agent dict (non-destructive)."""
    if not dep:
        return agent
    return {
        **agent,
        "lifecycle": "deprecated",
        "deprecation": {
            "reason": dep.get("reason"),
            "replacement": dep.get("replacement"),
            "target_retirement_date": dep.get("target_retirement_date"),
            "impact": dep.get("impact", {}),
            "by": dep.get("by"),
            "by_email": dep.get("by_email"),
            "at": dep.get("at"),
        },
    }


@router.get("/agents")
async def list_agents(user=Depends(require_role("admin"))):
    """Return all agents with live stats from their data sources."""
    deprecations = await _load_deprecations()
    out = []
    for agent in get_agents():
        stats = await _agent_live_stats(agent)
        merged = _merge_deprecation(agent, deprecations.get(agent["slug"]))
        out.append({**merged, "live": stats})
    return {"agents": out}


@router.get("/agents/by-category")
async def list_by_category(user=Depends(require_role("admin"))):
    return {"groups": agents_by_category()}


@router.get("/agents/{slug}")
async def get_one_agent(slug: str, user=Depends(require_role("admin"))):
    agent = get_agent(slug)
    if not agent:
        raise HTTPException(404, f"Agent not found: {slug}")
    deprecations = await _load_deprecations()
    merged = _merge_deprecation(agent, deprecations.get(slug))
    stats = await _agent_live_stats(agent)
    return {**merged, "live": stats}


# ----- Deprecation lifecycle --------------------------------------------------

@router.post("/agents/{slug}/deprecate")
async def deprecate_agent(
    slug: str,
    payload: dict = Body(...),
    user=Depends(require_role("admin")),
):
    """Mark a legacy/active agent as deprecated.

    Body:
      reason: str (required)
      replacement: str (optional — slug or human-readable name)
      target_retirement_date: ISO date (optional, default now+90d)
    """
    agent = get_agent(slug)
    if not agent:
        raise HTTPException(404, f"Agent not found: {slug}")

    reason = (payload.get("reason") or "").strip()
    if not reason or len(reason) < 4:
        raise HTTPException(400, "Reason is required (min 4 chars).")
    replacement = (payload.get("replacement") or "").strip() or None
    target_iso = (payload.get("target_retirement_date") or "").strip()
    if target_iso:
        try:
            datetime.fromisoformat(target_iso.replace("Z", "+00:00"))
        except Exception:  # noqa: BLE001
            raise HTTPException(400, "Invalid target_retirement_date (use ISO 8601).")
    else:
        target_iso = (datetime.now(timezone.utc) + timedelta(days=90)).date().isoformat()

    # Capture an impact snapshot from live stats — so the timeline shows what
    # this deprecation will affect at decision-time.
    stats = await _agent_live_stats(agent)
    impact = {
        "data_sources": agent.get("data_sources", []),
        "items_total_at_decision": stats.get("total_items", 0),
        "items_24h_at_decision": stats.get("items_24h", 0),
        "items_7d_at_decision": stats.get("items_7d", 0),
        "latest_activity_at": stats.get("latest_activity_at"),
        "provider": agent.get("provider"),
        "category": agent.get("category"),
        "previous_lifecycle": agent.get("lifecycle"),
    }

    now_iso = datetime.now(timezone.utc).isoformat()
    doc = {
        "slug": slug,
        "status": "deprecated",
        "reason": reason,
        "replacement": replacement,
        "target_retirement_date": target_iso,
        "impact": impact,
        "by": user.get("id"),
        "by_email": user.get("email"),
        "at": now_iso,
    }
    history_entry = {
        "action": "deprecate",
        "at": now_iso,
        "by_email": user.get("email"),
        "reason": reason,
        "replacement": replacement,
        "target_retirement_date": target_iso,
    }

    existing = await db[DEPRECATION_COLLECTION].find_one({"slug": slug})
    if existing:
        await db[DEPRECATION_COLLECTION].update_one(
            {"slug": slug},
            {"$set": {**doc}, "$push": {"history": history_entry}},
        )
    else:
        await db[DEPRECATION_COLLECTION].insert_one({
            **doc, "id": str(uuid.uuid4()), "history": [history_entry],
        })
    return {"ok": True, "slug": slug, "deprecation": doc}


@router.post("/agents/{slug}/undeprecate")
async def undeprecate_agent(
    slug: str,
    payload: dict = Body(default={}),
    user=Depends(require_role("admin")),
):
    """Restore an agent from the deprecation list (audit-logged)."""
    existing = await db[DEPRECATION_COLLECTION].find_one({"slug": slug})
    if not existing:
        raise HTTPException(404, f"Agent {slug} is not deprecated.")
    note = (payload.get("note") or "").strip() or None
    now_iso = datetime.now(timezone.utc).isoformat()
    history_entry = {
        "action": "restore",
        "at": now_iso,
        "by_email": user.get("email"),
        "note": note,
    }
    await db[DEPRECATION_COLLECTION].update_one(
        {"slug": slug},
        {"$set": {"status": "restored", "restored_at": now_iso}, "$push": {"history": history_entry}},
    )
    return {"ok": True, "slug": slug, "status": "restored"}


@router.get("/deprecation-plan")
async def deprecation_plan(user=Depends(require_role("admin"))):
    """Return the deprecation timeline (active + historical) sorted by target date."""
    plan = []
    history_only = []
    try:
        cur = db[DEPRECATION_COLLECTION].find({}).sort("target_retirement_date", 1)
        async for d in cur:
            d.pop("_id", None)
            agent = get_agent(d["slug"]) or {}
            entry = {
                "slug": d["slug"],
                "name": agent.get("name", d["slug"]),
                "category": agent.get("category"),
                "provider": agent.get("provider"),
                "purpose": agent.get("purpose"),
                "status": d.get("status"),
                "reason": d.get("reason"),
                "replacement": d.get("replacement"),
                "target_retirement_date": d.get("target_retirement_date"),
                "impact": d.get("impact", {}),
                "by_email": d.get("by_email"),
                "at": d.get("at"),
                "restored_at": d.get("restored_at"),
                "history": d.get("history", []),
            }
            if d.get("status") == "deprecated":
                plan.append(entry)
            else:
                history_only.append(entry)
    except Exception as e:  # noqa: BLE001
        logger.warning(f"[governance] deprecation_plan failed: {e}")

    # Suggest legacy candidates from static registry that are not yet planned
    deprecated_slugs = {p["slug"] for p in plan}
    suggestions = []
    for a in get_agents():
        if a["lifecycle"] == "legacy" and a["slug"] not in deprecated_slugs:
            suggestions.append({
                "slug": a["slug"],
                "name": a["name"],
                "category": a["category"],
                "purpose": a["purpose"],
                "provider": a["provider"],
            })

    return {
        "plan": plan,
        "history": history_only,
        "suggested_candidates": suggestions,
        "counts": {
            "active_deprecations": len(plan),
            "restored": len(history_only),
            "legacy_candidates": len(suggestions),
        },
    }


# ----- Costs (deprecation-aware) ---------------------------------------------


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


# ----- Health monitoring ------------------------------------------------------

def _classify_health(agent: dict, stats: dict, dep: dict | None) -> dict:
    """Derive a coarse health status for an agent from its live stats."""
    if dep:
        return {"status": "deprecated", "reason": dep.get("reason", "marked deprecated"), "since_hours": None}

    items_7d = stats.get("items_7d", 0)
    items_24h = stats.get("items_24h", 0)
    total = stats.get("total_items", 0)
    latest = stats.get("latest_activity_at")
    provider = agent.get("provider")

    if not agent.get("data_sources"):
        return {"status": "healthy", "reason": "infra agent (no data sources)", "since_hours": None}

    if total == 0:
        return {"status": "silent", "reason": "no activity ever recorded", "since_hours": None}

    if items_7d == 0:
        hours_since = None
        if latest:
            try:
                dt = datetime.fromisoformat(latest.replace("Z", "+00:00"))
                hours_since = int((datetime.now(timezone.utc) - dt).total_seconds() // 3600)
            except Exception:  # noqa: BLE001
                pass
        return {"status": "silent", "reason": f"no activity in 7d (last: {latest or 'unknown'})", "since_hours": hours_since}

    if items_7d >= 20 and items_24h == 0:
        return {"status": "degraded", "reason": "active over 7d but silent in 24h", "since_hours": 24}

    if provider in ("gpt_4o",) and items_7d > 0:
        return {"status": "healthy", "reason": "active · provider gpt_4o (sunset-risk)", "since_hours": None}

    return {"status": "healthy", "reason": f"{items_24h} items in 24h, {items_7d} in 7d", "since_hours": None}


@router.get("/health")
async def get_health(user=Depends(require_role("admin"))):
    """Per-agent health status + global health KPIs."""
    deprecations = await _load_deprecations()
    rows = []
    counts: dict = {"healthy": 0, "degraded": 0, "silent": 0, "deprecated": 0, "error": 0}
    for agent in get_agents():
        stats = await _agent_live_stats(agent)
        dep = deprecations.get(agent["slug"])
        health = _classify_health(agent, stats, dep)
        counts[health["status"]] = counts.get(health["status"], 0) + 1
        rows.append({
            "slug": agent["slug"],
            "name": agent["name"],
            "category": agent["category"],
            "provider": agent["provider"],
            "permission_level": agent["permission_level"],
            "lifecycle": "deprecated" if dep else agent["lifecycle"],
            "items_24h": stats.get("items_24h", 0),
            "items_7d": stats.get("items_7d", 0),
            "total_items": stats.get("total_items", 0),
            "latest_activity_at": stats.get("latest_activity_at"),
            "health": health,
        })
    order = {"degraded": 0, "silent": 1, "error": 2, "healthy": 3, "deprecated": 4}
    rows.sort(key=lambda r: order.get(r["health"]["status"], 9))
    overall = "healthy"
    if counts.get("degraded", 0) > 0 or counts.get("error", 0) > 0:
        overall = "degraded"
    elif counts.get("silent", 0) >= max(1, len(rows) // 3):
        overall = "warning"
    return {
        "overall": overall,
        "counts": counts,
        "total_agents": len(rows),
        "rows": rows,
        "computed_at": datetime.now(timezone.utc).isoformat(),
    }


# ----- Permissions matrix -----------------------------------------------------

_PERMISSION_RISK = {
    "read":                       {"level": 0, "label": "Read-only"},
    "suggest":                    {"level": 1, "label": "Sugestii"},
    "execute-with-approval":      {"level": 2, "label": "Execută cu aprobare"},
    "execute":                    {"level": 3, "label": "Execută direct"},
    "autonomous":                 {"level": 4, "label": "Autonom"},
}


@router.get("/permissions-matrix")
async def permissions_matrix(user=Depends(require_role("admin"))):
    """Group agents by permission_level and surface risk hotspots."""
    deprecations = await _load_deprecations()
    groups: dict = {k: [] for k in _PERMISSION_RISK.keys()}
    risk_hotspots = []
    for agent in get_agents():
        if agent["slug"] in deprecations:
            continue
        groups.setdefault(agent["permission_level"], []).append({
            "slug": agent["slug"],
            "name": agent["name"],
            "category": agent["category"],
            "provider": agent["provider"],
            "lifecycle": agent["lifecycle"],
            "purpose": agent["purpose"],
        })
        if agent["permission_level"] in ("execute", "autonomous") and agent["lifecycle"] == "active":
            risk_hotspots.append({
                "slug": agent["slug"],
                "name": agent["name"],
                "permission_level": agent["permission_level"],
                "reason": "Activ + permisiune ridicată — auditează regulat.",
            })

    out_groups = []
    for level, meta in _PERMISSION_RISK.items():
        agents_in = groups.get(level, [])
        out_groups.append({
            "permission_level": level,
            "label": meta["label"],
            "risk_level": meta["level"],
            "count": len(agents_in),
            "agents": agents_in,
        })

    return {
        "groups": out_groups,
        "risk_hotspots": risk_hotspots,
        "total_active": sum(len(g["agents"]) for g in out_groups),
        "principles": [
            "Read = 0 risc; Suggest = 1; Execute-with-approval = 2; Execute = 3; Autonomous = 4",
            "Orice agent 'execute' sau 'autonomous' trebuie auditat lunar.",
            "Promovarea unui agent la un nivel mai înalt va trece prin Founder Gate (FG-2 când va fi activ).",
        ],
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
