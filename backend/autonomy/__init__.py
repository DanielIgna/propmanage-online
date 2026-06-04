"""PropManage AI Autonomy Engine — core module.

Computes platform autonomy scores (0-100) per dimension based on existing
MongoDB signals. Read-only, no LLM calls, deterministic.

Sub-scores:
  - operational: % auto-handled requests, warranty auto-release, preset schedules
  - technical:   smoke test pass rate, snapshot freshness, healthcheck
  - security:    OAuth success rate, open security findings, GDPR
  - dev:         weekly release gate pass rate, AI dev team findings resolved
  - ai:          AI findings resolved %, QA copilot follow-through

General autonomy = weighted average.
"""
