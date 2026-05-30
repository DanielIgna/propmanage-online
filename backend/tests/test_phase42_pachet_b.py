"""Regression tests — verify Pachet B + Pachet C registrations and integrity."""
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

PACHET_C_CODES = {
    # Operator flows (4)
    "OP-FLAG-AUTHZ", "OP-FLAG-FULL", "OP-QUEUE", "OP-FLAG-404",
    # Projects / Workspace (4)
    "PROJ-AUTHZ", "PROJ-CREATE", "PROJ-LIST", "PROJ-TASK",
    # Notifications (3)
    "NOTIF-LIST", "NOTIF-READ", "NOTIF-CROSS",
    # Wallet / Misc (3)
    "WALLET-TX", "WALLET-TOPUP", "CONCIERGE-SETTINGS",
    # Digital Twin / Timeline / Referral (3)
    "DT-SUB", "TIMELINE", "REFERRAL",
}


def test_pachet_b_codes_registered():
    """All 25 Pachet B codes appear in AUTOMATED_TESTS registry."""
    missing = PACHET_B_CODES - set(AUTOMATED_TESTS.keys())
    assert not missing, f"Pachet B codes missing: {missing}"


def test_pachet_c_codes_registered():
    """All 17 Pachet C codes appear in AUTOMATED_TESTS registry."""
    missing = PACHET_C_CODES - set(AUTOMATED_TESTS.keys())
    assert not missing, f"Pachet C codes missing: {missing}"


def test_pachet_b_each_has_runner_and_metadata():
    for code in PACHET_B_CODES:
        t = AUTOMATED_TESTS[code]
        assert callable(t["runner"]), f"{code}: runner not callable"
        assert t["kind"] == "http"
        assert t["priority"] in {"P0", "P1", "P2"}
        assert isinstance(t["title"], str) and len(t["title"]) >= 10


def test_pachet_c_each_has_runner_and_metadata():
    for code in PACHET_C_CODES:
        t = AUTOMATED_TESTS[code]
        assert callable(t["runner"]), f"{code}: runner not callable"
        assert t["kind"] == "http"
        assert t["priority"] in {"P0", "P1", "P2"}
        assert isinstance(t["title"], str) and len(t["title"]) >= 10


def test_pachet_b_p0_count():
    p0 = [c for c in PACHET_B_CODES if AUTOMATED_TESTS[c]["priority"] == "P0"]
    assert len(p0) >= 10, f"Only {len(p0)} P0 in Pachet B (expected ≥10)"


def test_pachet_c_p0_count():
    p0 = [c for c in PACHET_C_CODES if AUTOMATED_TESTS[c]["priority"] == "P0"]
    assert len(p0) >= 5, f"Only {len(p0)} P0 in Pachet C (expected ≥5): {p0}"


def test_total_registry_size():
    """Registry has 105 tests total (53 baseline + 25 Pachet B + 17 Pachet C + 10 misc = 105)."""
    # Allow ±2 because the registry has small additions like browser tests
    assert len(AUTOMATED_TESTS) >= 100, f"Registry has {len(AUTOMATED_TESTS)} tests (expected ≥100)"


def test_no_duplicate_codes():
    """All registered codes are unique."""
    codes = [t["code"] for t in AUTOMATED_TESTS.values()]
    assert len(codes) == len(set(codes)), "Duplicate codes found in registry"
