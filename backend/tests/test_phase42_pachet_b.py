"""Regression test — verify Pachet B (25 new E2E tests) is registered and importable.

We do NOT execute the 25 tests here (they are run by the Release Gate). We only
assert that the registry contains the new codes and they are unique.
"""
import pytest

from qa_automation import AUTOMATED_TESTS


PACHET_B_CODES = {
    # Payment / Escrow edge cases (8)
    "PAY-INSUFF", "PAY-CONFIRM-AUTHZ", "PAY-START-AUTHZ", "PAY-ESCROW-AUTHZ",
    "PAY-TX-LEAD", "PAY-TX-RELEASE", "PAY-FROZEN-NOCONF", "PAY-COMPLETE-AUTHZ",
    # Dispute escalations (5)
    "DISP-NO-DUP", "DISP-RESOLVE-AUTHZ", "DISP-AFTER-RELEASE", "DISP-EVID", "DISP-STATUS-OPEN",
    # SEO heavy (5)
    "SEO-SITEMAP-COUNT", "SEO-SITEMAP-XML", "SEO-LANDING-CITIES",
    "SEO-GUIDES-IN-SITEMAP", "SEO-MKT-API",
    # Marketplace filters (3)
    "MKT-CAT", "MKT-ZONE", "MKT-CITY-NORES",
    # Admin tooling (4)
    "ADMIN-USERS-LIST", "ADMIN-INC-LIST", "ADMIN-IMP-ADMIN-BLOCK", "ADMIN-IMP-CLIENT",
}


def test_pachet_b_codes_registered():
    """All 25 Pachet B codes appear in AUTOMATED_TESTS registry."""
    missing = PACHET_B_CODES - set(AUTOMATED_TESTS.keys())
    assert not missing, f"Codes missing from registry: {missing}"


def test_pachet_b_each_has_runner_and_metadata():
    """Each Pachet B entry has runner callable + required metadata."""
    for code in PACHET_B_CODES:
        t = AUTOMATED_TESTS[code]
        assert callable(t["runner"]), f"{code}: runner not callable"
        assert t["kind"] == "http", f"{code}: expected kind=http, got {t['kind']}"
        assert t["priority"] in {"P0", "P1", "P2"}, f"{code}: bad priority {t['priority']}"
        assert t["category"] in {"E2E", "SEO", "PUBLIC", "ADMIN"}, f"{code}: bad category {t['category']}"
        assert isinstance(t["title"], str) and len(t["title"]) >= 10


def test_pachet_b_p0_tests_count():
    """At least 10 of the 25 Pachet B tests are P0 (security/critical flows)."""
    p0 = [c for c in PACHET_B_CODES if AUTOMATED_TESTS[c]["priority"] == "P0"]
    assert len(p0) >= 10, f"Only {len(p0)} P0 tests in Pachet B (expected ≥10): {p0}"


def test_total_registry_size_grew_by_pachet_b():
    """Registry has at least 78 tests (53 baseline + 25 Pachet B)."""
    assert len(AUTOMATED_TESTS) >= 78, f"Registry has {len(AUTOMATED_TESTS)} tests, expected ≥78"
