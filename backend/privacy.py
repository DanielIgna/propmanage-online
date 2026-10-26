"""Public-facing privacy helpers.

Individuals (persoane fizice) must be shown with a partially anonymized name in
PUBLIC contexts (cards, public profiles, search, public APIs):
    "Lucian Faragau" -> "Lucian F.."
    "Călin Tulus"    -> "Călin T.."
Company accounts (account_type == "company" / is_company) keep their full name.

These helpers NEVER mutate stored data — they only transform the value returned
by public endpoints.
"""
from __future__ import annotations


def anonymize_person_name(name) -> str:
    """Return 'First L..' for an individual. Single-token names are returned as-is."""
    if not name:
        return name
    parts = [p for p in str(name).strip().split() if p]
    if len(parts) < 2:
        return parts[0] if parts else name
    first = parts[0]
    last_initial = parts[-1][0].upper()
    return f"{first} {last_initial}.."


def is_company_account(doc: dict) -> bool:
    if not doc:
        return False
    if doc.get("is_company") is True:
        return True
    return str(doc.get("account_type") or "").lower() == "company"


def public_person_name(doc: dict):
    """Full name for company accounts; anonymized for individuals."""
    if not doc:
        return None
    if is_company_account(doc):
        return doc.get("name")
    return anonymize_person_name(doc.get("name"))
