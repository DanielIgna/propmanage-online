# Marketplace cleanup (test/demo specialists excluded) + demand capture regression tests
import os
import re
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
TEST_RE = re.compile(
    r"(^(test[_\-]|qa[_\-]|wv-test|specnew|pending@))|(@(propmanage\.io|test\.com|test\.io|test\.ro|example\.com)$)",
    re.I,
)


@pytest.fixture(scope="module")
def client_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": "client@propmanage.io", "password": "Client123!"})
    if r.status_code != 200:
        pytest.skip(f"client login failed {r.status_code}")
    return s


# --- Public marketplace listing ---
class TestPublicMarketplace:
    def test_specialists_empty(self):
        r = requests.get(f"{BASE_URL}/api/marketplace/specialists")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) == 0, f"expected 0, got {len(data)}: {[d.get('email') or d.get('name') for d in data[:5]]}"

    @pytest.mark.parametrize("params", [
        {"category": "electric"}, {"verified_only": "true"}, {"sort": "rating"},
        {"sort": "reviews"}, {"sort": "recent"}, {"sort": "bogus"},
        {"category": "electric", "verified_only": "true", "sort": "reviews"},
        {"min_rating": "4"}, {"city": "Cluj-Napoca"}, {"zone": "Sector 1"}, {"style": "modern"},
    ])
    def test_specialists_filters(self, params):
        r = requests.get(f"{BASE_URL}/api/marketplace/specialists", params=params)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert isinstance(data, list)
        for d in data:
            assert not TEST_RE.search(d.get("email") or ""), d.get("email")
        assert len(data) == 0

    def test_filters_endpoint(self):
        r = requests.get(f"{BASE_URL}/api/marketplace/filters")
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert isinstance(data, dict)
        print("filters payload keys:", list(data.keys()), str(data)[:600])


# --- Demand capture with empty marketplace ---
class TestDemandCapture:
    def test_properties_and_requests_list(self, client_session):
        r = client_session.get(f"{BASE_URL}/api/properties")
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        r2 = client_session.get(f"{BASE_URL}/api/requests")
        assert r2.status_code == 200
        assert isinstance(r2.json(), list)

    def test_create_request_open(self, client_session):
        props = client_session.get(f"{BASE_URL}/api/properties").json()
        assert props, "client has no properties"
        pid = props[0].get("id")
        payload = {"property_id": pid, "category": "electric", "title": "TEST_demand_capture_iter229",
                   "description": "TEST request created by testing agent", "priority": "normal",
                   "budget_estimate": 300}
        r = client_session.post(f"{BASE_URL}/api/requests", json=payload)
        assert r.status_code in (200, 201), r.text[:300]
        doc = r.json()
        assert doc["status"] == "open"
        assert doc["specialist_id"] is None
        assert doc["title"] == payload["title"]
        rid = doc["id"]
        lst = client_session.get(f"{BASE_URL}/api/requests").json()
        assert any(x.get("id") == rid for x in lst), "created request not in list"

    def test_create_request_unauth(self):
        r = requests.post(f"{BASE_URL}/api/requests", json={"property_id": "x", "category": "a", "title": "t", "description": "d"})
        assert r.status_code in (401, 403)

    def test_create_request_invalid_property_id(self, client_session):
        r = client_session.post(f"{BASE_URL}/api/requests", json={"property_id": "not-an-objectid", "category": "electric",
                                                                   "title": "TEST_x", "description": "d"})
        assert r.status_code in (400, 404, 422), f"got {r.status_code}"
