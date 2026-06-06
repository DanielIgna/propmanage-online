"""PropManage — AI Governance Center (Phase 1 — Observability-Only)
=====================================================================

Read-only observability layer over the existing AI ecosystem.

CRITICAL RULES (Phase 1):
- ZERO modifications to existing agents.
- ZERO enforcement of policies.
- ZERO new audit log writes (we AGGREGATE existing audit sources).
- Cost data is best-effort estimate based on collection counts × per-call
  average (no token-level logging exists yet — that's Phase 2 scope).

The goal of Phase 1 is to give the founder a SINGLE PANE OF GLASS to see:
  - All AI agents and their lifecycle status (active / legacy / experimental)
  - Estimated monthly cost per agent (rough)
  - Recent activity per agent (last 24h / 7d)
  - Unified audit trail across QA, AI Dev Team, Security, Autonomy

Phase 2 will add: real token logging, cost center, permissions, risk scoring.
"""
