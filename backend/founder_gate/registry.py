"""Founder Gate — Critical Actions Registry

Hardcoded list of 12 actions that REQUIRE dual-verification (email + SMS)
once the gate is fully activated (phases FG-2..FG-4).

Decision from founder (05.06.2026): Option B — extended list with 12 actions.

Schema per action:
  slug:              unique identifier used by middleware
  label:             human-readable name (RO)
  category:          grouping (financial / data / security / governance)
  severity:          critical | high
  requires_sms:      bool — if False, email-only confirmation is acceptable
  description:       what it protects
  example_endpoints: routes that would trigger this gate (for future wiring)
"""
from typing import Optional

CRITICAL_ACTIONS = [
    {
        "slug": "modify_commission_pct",
        "label": "Modificare comision platformă (%)",
        "category": "financial",
        "severity": "critical",
        "requires_sms": True,
        "description": "Schimbarea procentului de comision încasat de platformă (default 2.5%).",
        "example_endpoints": ["PUT /api/admin/app-settings (pricing.commission_pct)"],
    },
    {
        "slug": "modify_pricing",
        "label": "Modificare prețuri servicii (audit, twin, taxe)",
        "category": "financial",
        "severity": "critical",
        "requires_sms": True,
        "description": "Schimbarea prețurilor de bază pentru audit / Digital Twin / alte servicii.",
        "example_endpoints": ["PUT /api/admin/app-settings (pricing.*)"],
    },
    {
        "slug": "bulk_delete_collection",
        "label": "Ștergere bulk colecții (>50 rânduri sau drop)",
        "category": "data",
        "severity": "critical",
        "requires_sms": True,
        "description": "Orice operație de ștergere în masă pe colecții MongoDB.",
        "example_endpoints": ["DELETE /api/admin/* (bulk operations)"],
    },
    {
        "slug": "transfer_ownership",
        "label": "Transfer ownership cont / organizație",
        "category": "governance",
        "severity": "critical",
        "requires_sms": True,
        "description": "Transferul drepturilor de owner asupra unei proprietăți sau a organizației.",
        "example_endpoints": ["PUT /api/admin/users/{id}/transfer"],
    },
    {
        "slug": "gdpr_bulk_export",
        "label": "Export GDPR >100 rânduri",
        "category": "data",
        "severity": "high",
        "requires_sms": True,
        "description": "Export masiv de date personale (peste pragul GDPR de raportare).",
        "example_endpoints": ["POST /api/gdpr/export (bulk)"],
    },
    {
        "slug": "modify_admin_roles",
        "label": "Modificare roluri admin (adăugare/ștergere admin)",
        "category": "security",
        "severity": "critical",
        "requires_sms": True,
        "description": "Schimbarea rolurilor de admin (acordare/revocare permisiuni).",
        "example_endpoints": ["PUT /api/admin/users/{id}/role"],
    },
    {
        "slug": "deploy_backend_business_logic",
        "label": "Deploy backend cu impact business logic",
        "category": "governance",
        "severity": "high",
        "requires_sms": True,
        "description": "Deploy de cod backend care modifică logic business (nu doar UI sau fix-uri).",
        "example_endpoints": ["(manual via Emergent deploy button — alerting hook)"],
    },
    {
        "slug": "ai_agent_structural_change",
        "label": "Agent AI sugerează schimbare structurală majoră",
        "category": "governance",
        "severity": "high",
        "requires_sms": True,
        "description": "Când un agent AI propune modificare schema DB, business logic core, sau permisiuni.",
        "example_endpoints": ["(detected by ai_governance audit layer in Phase FG-2+)"],
    },
    {
        "slug": "modify_stripe_destination",
        "label": "Modificare destinație plăți Stripe",
        "category": "financial",
        "severity": "critical",
        "requires_sms": True,
        "description": "Schimbarea contului bancar / Stripe Connect către care merg banii.",
        "example_endpoints": ["PUT /api/admin/payments/stripe-account"],
    },
    {
        "slug": "modify_stripe_credentials",
        "label": "Modificare credențiale Stripe (API keys, webhook secrets)",
        "category": "security",
        "severity": "critical",
        "requires_sms": True,
        "description": "Schimbarea cheilor API Stripe sau secrete webhook (poate redirecționa plăți).",
        "example_endpoints": ["(env var update via deployment)"],
    },
    {
        "slug": "modify_api_keys",
        "label": "Modificare API keys / secrete externe (Resend, Twilio, etc.)",
        "category": "security",
        "severity": "high",
        "requires_sms": True,
        "description": "Rotire sau schimbare chei API pentru servicii externe critice.",
        "example_endpoints": ["(env var update via deployment)"],
    },
    {
        "slug": "modify_founder_email",
        "label": "Schimbare email founder / contact primar",
        "category": "governance",
        "severity": "critical",
        "requires_sms": True,
        "description": "Modificarea email-ului principal al founder-ului (poate prelua controlul gate-ului).",
        "example_endpoints": ["PUT /api/admin/app-settings (founder_contact.email)"],
    },
    {
        "slug": "disable_founder_gate",
        "label": "Dezactivare Founder Approval Gate însuși",
        "category": "governance",
        "severity": "critical",
        "requires_sms": True,
        "description": "Recursive lock — dezactivarea gate-ului necesită aprobarea founder-ului prin gate.",
        "example_endpoints": ["PUT /api/admin/app-settings (enable_founder_gate=false)"],
    },
]


def get_registry() -> list:
    """Return the immutable registry. NEVER mutate the returned list."""
    # Deep-ish copy: callers may iterate but shouldn't mutate; return list of dict copies.
    return [dict(a) for a in CRITICAL_ACTIONS]


def is_critical_action(slug: str) -> bool:
    """Return True if the given action slug is in the registry.

    Phase FG-0: ALWAYS returns the truth based on registry — but no enforcement.
    The middleware (Phase FG-2) will be the one that actually blocks.
    """
    return any(a["slug"] == slug for a in CRITICAL_ACTIONS)


def get_action(slug: str) -> Optional[dict]:
    """Return the full action metadata or None."""
    for a in CRITICAL_ACTIONS:
        if a["slug"] == slug:
            return dict(a)
    return None


def actions_by_category() -> dict:
    """Return registry grouped by category — useful for UI display."""
    grouped: dict = {}
    for a in CRITICAL_ACTIONS:
        grouped.setdefault(a["category"], []).append(dict(a))
    return grouped


def registry_stats() -> dict:
    """Lightweight summary used by admin dashboard."""
    total = len(CRITICAL_ACTIONS)
    by_severity: dict = {}
    by_category: dict = {}
    for a in CRITICAL_ACTIONS:
        by_severity[a["severity"]] = by_severity.get(a["severity"], 0) + 1
        by_category[a["category"]] = by_category.get(a["category"], 0) + 1
    return {
        "total": total,
        "by_severity": by_severity,
        "by_category": by_category,
        "requires_sms_count": sum(1 for a in CRITICAL_ACTIONS if a["requires_sms"]),
    }
