"""PropManage — Founder Approval Gate
=====================================

Foundation module for the dual-verification approval gate that protects
critical business actions from accidental or malicious modification.

CRITICAL RULES:
- Feature flag `enable_founder_gate` MUST be OFF by default.
- This module is INACTIVE until ALL phases complete and founder explicitly
  enables it via admin setting.
- Phase FG-0 ships:
    • critical_actions_registry (hardcoded list, 12 actions)
    • is_critical_action() helper
    • read-only admin route to view registry
    • feature flag boolean in app_settings
    • seed function (idempotent) called at startup
- Phase FG-0 does NOT:
    • intercept any requests
    • require any approval
    • send any email/SMS
    • activate Twilio
- Subsequent phases (FG-1..FG-5) will wire actual enforcement.
"""

ENABLE_FLAG_KEY = "enable_founder_gate"  # in app_settings doc
