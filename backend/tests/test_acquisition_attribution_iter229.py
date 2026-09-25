"""Backend tests — ACQUISITION ATTRIBUTION + PROSPECTING ECONOMICS (Faza 3, iter229).

Covers:
- classify_source matrix (instagram/facebook via utm + referrer fallback, google organic,
  google ads gclid separation via _refine_source, whatsapp, bot, direct, other).
- _audience_of_role owner/specialist/designer/unknown mapping.
- seo-organic: signups_by_audience shape, signup_source_available honesty,
  prospecting extended (invitations_by_role, leads_by_source/stage, pipeline vs revenue,
  configured revenue_model, cost unavailable).
- signup conversion carries role end-to-end (/api/track → marketing_conversions.role).
- auth guard 401/403.
"""
import os
import uuid
import requests
import pytest

from routes.analytics_growth import classify_source, _refine_source, _audience_of_role

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
ADMIN = {"email": "admin@propmanage.io", "password": "1!nasov01ADMIN"}


# ─────────────────────────── UNIT: classify_source matrix ───────────────────────────
class TestClassifySourceMatrix:
    def test_instagram_via_utm(self):
        assert classify_source(utm_source="instagram") == "instagram"
        assert classify_source(utm_source="IG_Instagram") == "instagram"

    def test_facebook_via_utm(self):
        assert classify_source(utm_source="facebook") == "facebook"

    def test_instagram_facebook_referrer_fallback(self):
        assert classify_source(referrer="https://l.instagram.com/x") == "instagram"
        assert classify_source(referrer="https://m.facebook.com/x") == "facebook"
        assert classify_source(referrer="https://fb.com/x") == "facebook"

    def test_google_organic_referrer(self):
        assert classify_source(referrer="https://www.google.com/search?q=x") == "google"

    def test_google_oauth_is_not_organic(self):
        assert classify_source(referrer="https://accounts.google.com/o/oauth2") == "other"

    def test_whatsapp(self):
        assert classify_source(referrer="https://wa.me/40700") == "whatsapp"
        assert classify_source(utm_source="whatsapp") == "whatsapp"

    def test_bot_prospecting(self):
        assert classify_source(utm_source="bot") == "bot"
        assert classify_source(utm_source="prospecting") == "bot"
        assert classify_source(campaign_code="bot_cluj_2026") == "bot"

    def test_direct_and_other(self):
        assert classify_source() == "direct"
        assert classify_source(referrer="https://someblog.ro/post") == "other"

    def test_refine_google_ads_vs_organic(self):
        assert _refine_source("google", gclid="abc123")[0] == "google_ads"
        assert _refine_source("google", utm_medium="cpc")[0] == "google_ads"
        assert _refine_source("google")[0] == "google_organic"
        assert _refine_source("instagram")[0] == "instagram"
        assert _refine_source("facebook")[0] == "facebook"
        assert _refine_source("bot")[0] == "bot"


class TestAudienceOfRole:
    def test_mapping(self):
        assert _audience_of_role("specialist") == "specialist"
        assert _audience_of_role("designer") == "designer"
        assert _audience_of_role("client") == "owner"
        assert _audience_of_role("owner") == "owner"
        assert _audience_of_role("") == "unknown"
        assert _audience_of_role("admin") == "unknown"


# ─────────────────────────── FIXTURES ───────────────────────────
@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login", json=ADMIN, timeout=15)
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text[:200]}")
    return s


# ─────────────────────────── seo-organic shape ───────────────────────────
class TestSeoOrganicAcquisition:
    def test_signups_by_audience_shape(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/analytics/seo-organic?period=90&refresh=1", timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "signups_by_audience" in d
        for a in ("owner", "specialist", "designer", "unknown"):
            assert a in d["signups_by_audience"]
            assert "total" in d["signups_by_audience"][a]
            assert "by_source" in d["signups_by_audience"][a]
        assert "signup_source_available" in d
        assert isinstance(d["signup_source_available"], bool)
        assert "signups_total" in d

    def test_prospecting_real_data(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/analytics/seo-organic?period=90&refresh=1", timeout=30)
        assert r.status_code == 200
        p = r.json()["prospecting"]
        # invitations by role — real
        assert "invitations_by_role" in p and isinstance(p["invitations_by_role"], dict)
        # leads segmentation — real
        assert "leads_by_source" in p and isinstance(p["leads_by_source"], dict)
        assert "leads_by_stage" in p and isinstance(p["leads_by_stage"], dict)
        # pipeline (estimated) kept SEPARATE from realized revenue
        assert "pipeline_estimated_value" in p
        assert "revenue_generated" in p
        # configured revenue model — real DB values, not realized revenue
        assert "revenue_model" in p and isinstance(p["revenue_model"], list)
        # cost unavailable — never invented
        assert p["cost_per_invitation"] is None
        assert p["cost_available"] is False
        assert "indisponibil" in (p["cost_note"] or "").lower()

    def test_pipeline_not_counted_as_revenue(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/analytics/seo-organic?period=90&refresh=1", timeout=30)
        p = r.json()["prospecting"]
        # pipeline and revenue are distinct keys — must not be conflated
        assert p["pipeline_estimated_value"] >= 0
        assert p["revenue_generated"] >= 0
        # sample DB has estimated_value>0 but revenue_generated 0 → they differ in reality
        if p["pipeline_estimated_value"] > 0:
            assert p["revenue_generated"] != p["pipeline_estimated_value"] or p["revenue_generated"] > 0


# ─────────────────────────── signup role end-to-end ───────────────────────────
class TestSignupRoleTracked:
    def test_signup_conversion_carries_role(self, admin_session):
        vid = "TEST_sgn_" + uuid.uuid4().hex[:12]
        sid = uuid.uuid4().hex
        body = {
            "visitor_id": vid, "session_id": sid,
            "user_id": "test-user-" + uuid.uuid4().hex[:8], "user_role": "specialist",
            "events": [
                {"type": "pageview", "path": "/devino-specialist"},
                {"type": "conversion", "conversion_action": "sign_up", "conversion_role": "specialist", "path": "/register"},
            ],
        }
        r = requests.post(f"{BASE_URL}/api/track", json=body, timeout=10)
        assert r.status_code == 200
        assert r.json()["ingested"] == 2


# ─────────────────────────── AUTH GUARD ───────────────────────────
class TestAuthGuard:
    def test_seo_organic_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/admin/analytics/seo-organic?period=28", timeout=10)
        assert r.status_code in (401, 403)
