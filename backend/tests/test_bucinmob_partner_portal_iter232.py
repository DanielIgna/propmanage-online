"""Iteration 232 — Bucin Mob strategic prospect + shared partner portal (/api/partner/portal, DEMO) + admin activation."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
HDR = {"Content-Type": "application/json", "X-PM-Client": "propmanage-app"}
BUCIN_ID = "6adf5b65219980e1e22a386f"
ADMIN = ("admin@propmanage.io", "1!nasov01ADMIN")
CLIENT = ("client@propmanage.io", "Client123!")
EXPECTED_CATS = 6


def _login(email, pw):
    s = requests.Session()
    s.headers.update(HDR)
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pw}, timeout=20)
    if r.status_code != 200:
        return None
    return s


@pytest.fixture(scope="module")
def admin():
    s = _login(*ADMIN)
    if not s:
        pytest.skip("admin login failed")
    return s


@pytest.fixture(scope="module")
def client():
    s = _login(*CLIENT)
    if not s:
        pytest.skip("client login failed")
    return s


# --- Bucin Mob prospect record ---
class TestBucinMobRecord:
    def test_get_bucinmob(self, admin):
        r = admin.get(f"{BASE_URL}/api/admin/city-partners/{BUCIN_ID}")
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["company"] == "Bucin Mob SRL"
        assert d["status"] == "negotiation"
        assert d.get("collaboration_agreed") is False
        assert d.get("portal_access_enabled") is False
        assert d.get("linked_user_id") in (None, "")
        assert len(d.get("categories") or []) == EXPECTED_CATS, d.get("categories")

    def test_no_duplicate_bucinmob(self, admin):
        r = admin.get(f"{BASE_URL}/api/admin/city-partners")
        assert r.status_code == 200
        body = r.json()
        items = body.get("items", body) if isinstance(body, dict) else body
        matches = [i for i in items if "bucin" in (i.get("company") or "").lower()]
        assert len(matches) == 1, [m.get("id") for m in matches]

    def test_no_user_account_for_bucinmob(self, admin):
        r = admin.get(f"{BASE_URL}/api/admin/city-partners/{BUCIN_ID}")
        email = (r.json().get("contact_email") or "").lower()
        # Login with no password can't verify; ensure linked_user_id empty (above) + email noted
        assert r.json().get("linked_user_id") in (None, "")
        print("contact_email:", email)


# --- DEMO portal ---
class TestDemoPortal:
    def test_demo_admin(self, admin):
        r = admin.get(f"{BASE_URL}/api/partner/portal/demo", params={"partner_id": BUCIN_ID})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["demo"] is True
        assert len(d["leads"]) == 5
        assert all(l["lead_name"].startswith("DEMO —") for l in d["leads"])
        assert len(d["catalog"]) == 2
        assert d["agreement"]["status"] == "demo"
        assert d["stats"]["leads_total"] == 5
        assert d["stats"]["leads_by_stage"]["converted"] == 1
        assert d["stats"]["conversion_rate"] == 20.0
        assert d["partner"]["company"] == "Bucin Mob SRL"

    def test_demo_client_forbidden(self, client):
        r = client.get(f"{BASE_URL}/api/partner/portal/demo", params={"partner_id": BUCIN_ID})
        assert r.status_code == 403

    def test_demo_invalid_id(self, admin):
        r = admin.get(f"{BASE_URL}/api/partner/portal/demo", params={"partner_id": "bad"})
        assert r.status_code == 400

    def test_demo_unauth(self):
        r = requests.get(f"{BASE_URL}/api/partner/portal/demo", params={"partner_id": BUCIN_ID}, headers=HDR)
        assert r.status_code in (401, 403)

    def test_demo_does_not_change_state(self, admin):
        d = admin.get(f"{BASE_URL}/api/admin/city-partners/{BUCIN_ID}").json()
        assert d["portal_access_enabled"] is False and d["linked_user_id"] in (None, "")


# --- Real portal permission guard ---
class TestRealPortalGuard:
    def test_portal_client_403(self, client):
        r = client.get(f"{BASE_URL}/api/partner/portal")
        assert r.status_code == 403

    def test_portal_admin_403(self, admin):
        r = admin.get(f"{BASE_URL}/api/partner/portal")
        assert r.status_code == 403

    def test_portal_unauth(self):
        r = requests.get(f"{BASE_URL}/api/partner/portal", headers=HDR)
        assert r.status_code in (401, 403)

    def test_admin_endpoints_client_403(self, client):
        r = client.get(f"{BASE_URL}/api/admin/city-partners/{BUCIN_ID}")
        assert r.status_code == 403
        r = client.post(f"{BASE_URL}/api/admin/city-partners/{BUCIN_ID}/portal-access", json={"enabled": True})
        assert r.status_code == 403


# --- Admin activation ---
class TestActivation:
    def test_portal_access_blocked_without_login(self, admin):
        r = admin.post(f"{BASE_URL}/api/admin/city-partners/{BUCIN_ID}/portal-access", json={"enabled": True})
        assert r.status_code == 400
        d = admin.get(f"{BASE_URL}/api/admin/city-partners/{BUCIN_ID}").json()
        assert d["portal_access_enabled"] is False

    def test_patch_categories_zones_persist(self, admin):
        orig = admin.get(f"{BASE_URL}/api/admin/city-partners/{BUCIN_ID}").json()
        new_cats = (orig.get("categories") or []) + ["TEST_cat"]
        new_zones = ["TEST_Reghin", "TEST_Mures"]
        try:
            r = admin.patch(f"{BASE_URL}/api/admin/city-partners/{BUCIN_ID}",
                            json={"categories": new_cats, "zones": new_zones})
            assert r.status_code == 200, r.text
            g = admin.get(f"{BASE_URL}/api/admin/city-partners/{BUCIN_ID}").json()
            assert g["categories"] == new_cats
            assert g["zones"] == new_zones
            assert g["status"] == "negotiation"
            assert g["portal_access_enabled"] is False
        finally:
            admin.patch(f"{BASE_URL}/api/admin/city-partners/{BUCIN_ID}",
                        json={"categories": orig.get("categories") or [], "zones": orig.get("zones") or []})
        g = admin.get(f"{BASE_URL}/api/admin/city-partners/{BUCIN_ID}").json()
        assert g["categories"] == orig.get("categories")

    def test_patch_cannot_bypass_portal_access_guard(self, admin):
        """PATCH with portal_access_enabled=true should not bypass the 'create login first' guard."""
        try:
            r = admin.patch(f"{BASE_URL}/api/admin/city-partners/{BUCIN_ID}", json={"portal_access_enabled": True})
            g = admin.get(f"{BASE_URL}/api/admin/city-partners/{BUCIN_ID}").json()
            assert g["portal_access_enabled"] is False, f"PATCH bypass: status={r.status_code} now enabled={g['portal_access_enabled']}"
        finally:
            admin.patch(f"{BASE_URL}/api/admin/city-partners/{BUCIN_ID}", json={"portal_access_enabled": False})
            g = admin.get(f"{BASE_URL}/api/admin/city-partners/{BUCIN_ID}").json()
            assert g["portal_access_enabled"] is False
