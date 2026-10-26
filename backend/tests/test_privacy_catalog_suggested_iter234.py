# Iter234: marketplace privacy (anonymization + demo exclusion), nZEB catalog, suggested services
import os
import uuid
import pytest
import requests
from pymongo import MongoClient
from bson import ObjectId
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
load_dotenv("/app/frontend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
CLIENT = {"email": "client@propmanage.io", "password": "Client123!"}
ADMIN = {"email": "admin@propmanage.io", "password": "1!nasov01ADMIN"}


def _login(creds):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=creds, timeout=20)
    if r.status_code != 200:
        pytest.skip(f"login failed {creds['email']}: {r.status_code}")
    tok = r.json().get("token") or r.json().get("access_token")
    if tok:
        s.headers["Authorization"] = f"Bearer {tok}"
    return s


@pytest.fixture(scope="module")
def client_s():
    return _login(CLIENT)


@pytest.fixture(scope="module")
def admin_s():
    return _login(ADMIN)


@pytest.fixture(scope="module")
def mdb():
    c = MongoClient(os.environ["MONGO_URL"])
    yield c[os.environ["DB_NAME"]]
    c.close()


@pytest.fixture(scope="module")
def transient_specs(mdb):
    """Insert 3 transient specialists (individual, company, branded demo). Removed after."""
    tag = uuid.uuid4().hex[:6]
    base = {"role": "specialist", "verified": True, "rating": 4.8, "reviews_count": 7,
            "specialty": "hvac", "service_categories": ["hvac"], "coverage_zones": ["Oradea"],
            "created_at": "2026-01-01T00:00:00+00:00"}
    docs = {
        "indiv": {**base, "name": "Lucian Faragau", "email": f"lucianf{tag}@gmail.com"},
        "company": {**base, "name": "Termo Instal SRL", "email": f"termo{tag}@gmail.com", "account_type": "company"},
        "demo": {**base, "name": "PropManage Oradea", "email": f"pmoradea{tag}@gmail.com"},
    }
    ids = {}
    for k, d in docs.items():
        ids[k] = str(mdb.users.insert_one(d).inserted_id)
    yield ids
    mdb.users.delete_many({"_id": {"$in": [ObjectId(i) for i in ids.values()]}})


# --- Privacy / marketplace ---
class TestMarketplacePrivacy:
    def test_marketplace_anonymizes_individual(self, transient_specs):
        r = requests.get(f"{API}/marketplace/specialists", params={"limit": 500}, timeout=30)
        assert r.status_code == 200
        items = r.json() if isinstance(r.json(), list) else r.json().get("items", [])
        by_id = {i["id"]: i for i in items}
        assert transient_specs["indiv"] in by_id, "real individual missing from marketplace"
        assert by_id[transient_specs["indiv"]]["name"] == "Lucian F.."
        assert "Faragau" not in r.text

    def test_marketplace_company_full_name(self, transient_specs):
        r = requests.get(f"{API}/marketplace/specialists", params={"limit": 500}, timeout=30)
        items = r.json() if isinstance(r.json(), list) else r.json().get("items", [])
        by_id = {i["id"]: i for i in items}
        assert transient_specs["company"] in by_id
        assert by_id[transient_specs["company"]]["name"] == "Termo Instal SRL"

    def test_marketplace_excludes_propmanage_demo(self, transient_specs):
        r = requests.get(f"{API}/marketplace/specialists", params={"limit": 500}, timeout=30)
        items = r.json() if isinstance(r.json(), list) else r.json().get("items", [])
        ids = {i["id"] for i in items}
        assert transient_specs["demo"] not in ids
        assert all(not (i.get("name") or "").lower().startswith("propmanage") for i in items)

    def test_profile_demo_404(self, transient_specs):
        r = requests.get(f"{API}/specialists/{transient_specs['demo']}/profile", timeout=20)
        assert r.status_code == 404

    def test_profile_individual_anonymized(self, transient_specs):
        r = requests.get(f"{API}/specialists/{transient_specs['indiv']}/profile", timeout=20)
        assert r.status_code == 200
        assert r.json()["name"] == "Lucian F.."
        assert "email" not in r.json()

    def test_profile_company_full(self, transient_specs):
        r = requests.get(f"{API}/specialists/{transient_specs['company']}/profile", timeout=20)
        assert r.status_code == 200
        assert r.json()["name"] == "Termo Instal SRL"

    def test_db_name_unchanged(self, transient_specs, mdb):
        d = mdb.users.find_one({"_id": ObjectId(transient_specs["indiv"])})
        assert d["name"] == "Lucian Faragau"

    def test_trust_score_public_name_leak(self, transient_specs):
        """Public (no-auth) trust-score endpoint — should not leak full last name."""
        r = requests.get(f"{API}/specialists/{transient_specs['indiv']}/trust-score", timeout=20)
        assert r.status_code == 200
        assert r.json().get("name") != "Lucian Faragau", f"full name leaked: {r.json().get('name')}"


# --- Catalog nZEB ---
NZEB = ["Audit energetic", "Certificat de performanță energetică", "Consultanță nZEB", "Sistem fotovoltaic",
        "Pompă de căldură aer-apă", "Ventilație cu recuperare de căldură (nZEB)",
        "Test etanșeitate (Blower Door)", "Eliminare punți termice"]


def _flatten(tree):
    out = []
    for n in tree:
        out.append(n)
        out.extend(_flatten(n.get("children") or []))
    return out


class TestCatalog:
    def test_admin_taxonomy_has_nzeb(self, admin_s):
        r = admin_s.get(f"{API}/construction/taxonomy", timeout=20)
        assert r.status_code == 200
        tree = r.json()["tree"]
        roots = [n for n in tree if n.get("legacy_category") == "eficienta_energetica"]
        assert roots and roots[0]["name"] == "Eficiență energetică & nZEB"
        names = {n["name"] for n in _flatten(roots[0].get("children") or [])}
        missing = [s for s in NZEB if s not in names]
        assert not missing, f"missing nZEB services: {missing}; have {names}"

    def test_public_taxonomy_ok(self):
        r = requests.get(f"{API}/construction/taxonomy/public", timeout=20)
        assert r.status_code == 200
        assert "tree" in r.json()


# --- Suggested services ---
class TestSuggested:
    state = {}

    def test_unauth_submit_401(self):
        r = requests.post(f"{API}/suggested-services", json={"name": "TEST_x"}, timeout=20)
        assert r.status_code in (401, 403)

    def test_submit_too_short_422(self, client_s):
        r = client_s.post(f"{API}/suggested-services", json={"name": "a"}, timeout=20)
        assert r.status_code == 422

    def test_submit_creates_pending(self, client_s):
        name = f"TEST Wallbox Montaj {uuid.uuid4().hex[:5]}"
        r = client_s.post(f"{API}/suggested-services", json={"name": name}, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "pending" and d["votes"] == 1 and d["name"] == name
        TestSuggested.state["id"] = d["id"]
        TestSuggested.state["name"] = name

    def test_submit_dedup(self, client_s):
        name = "  " + TestSuggested.state["name"].upper().replace(" ", "   ") + " "
        r = client_s.post(f"{API}/suggested-services", json={"name": name}, timeout=20)
        assert r.status_code == 200
        assert r.json()["id"] == TestSuggested.state["id"]
        assert r.json()["votes"] == 2

    def test_client_list_403(self, client_s):
        r = client_s.get(f"{API}/admin/suggested-services", timeout=20)
        assert r.status_code == 403

    def test_admin_list(self, admin_s):
        r = admin_s.get(f"{API}/admin/suggested-services", params={"status": "pending"}, timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert set(d["counts"].keys()) == {"pending", "approved", "rejected"}
        assert any(i["id"] == TestSuggested.state["id"] for i in d["items"])
        assert all("_id" not in i for i in d["items"])

    def test_client_approve_403(self, client_s):
        r = client_s.post(f"{API}/admin/suggested-services/{TestSuggested.state['id']}/approve", json={}, timeout=20)
        assert r.status_code == 403

    def test_admin_approve_with_parent(self, admin_s, mdb):
        tree = admin_s.get(f"{API}/construction/taxonomy", timeout=20).json()["tree"]
        parent = next(n for n in tree if n.get("legacy_category") == "eficienta_energetica")
        r = admin_s.post(f"{API}/admin/suggested-services/{TestSuggested.state['id']}/approve",
                         json={"parent_id": parent["id"]}, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "approved" and d["taxonomy_node_id"]
        node = mdb.construction_taxonomy.find_one({"id": d["taxonomy_node_id"]})
        assert node and node["source"] == "suggested" and node["parent_id"] == parent["id"]
        assert node["legacy_category"] == "eficienta_energetica" and node["depth_level"] == 1
        TestSuggested.state["node_id"] = d["taxonomy_node_id"]

    def test_approve_idempotent(self, admin_s, mdb):
        r = admin_s.post(f"{API}/admin/suggested-services/{TestSuggested.state['id']}/approve", json={}, timeout=20)
        assert r.status_code == 200
        assert mdb.construction_taxonomy.count_documents({"suggested_service_id": TestSuggested.state["id"]}) == 1

    def test_reject(self, client_s, admin_s):
        name = f"TEST Reject Service {uuid.uuid4().hex[:5]}"
        sid = client_s.post(f"{API}/suggested-services", json={"name": name}, timeout=20).json()["id"]
        r = admin_s.post(f"{API}/admin/suggested-services/{sid}/reject", json={"reason": "TEST duplicate"}, timeout=20)
        assert r.status_code == 200
        assert r.json()["status"] == "rejected" and r.json()["reject_reason"] == "TEST duplicate"
        lst = admin_s.get(f"{API}/admin/suggested-services", params={"status": "rejected"}, timeout=20).json()
        assert any(i["id"] == sid for i in lst["items"])

    def test_invalid_id_400_and_missing_404(self, admin_s):
        assert admin_s.post(f"{API}/admin/suggested-services/bad/reject", json={}, timeout=20).status_code == 400
        assert admin_s.post(f"{API}/admin/suggested-services/{ObjectId()}/approve", json={}, timeout=20).status_code == 404

    def test_request_links_suggestion(self, client_s, admin_s):
        props = client_s.get(f"{API}/properties", timeout=20).json()
        props = props if isinstance(props, list) else props.get("items", [])
        if not props:
            pytest.skip("client has no property")
        name = f"TEST Request Linked Svc {uuid.uuid4().hex[:5]}"
        r = client_s.post(f"{API}/requests", json={
            "property_id": props[0]["id"], "category": "altul", "title": "TEST suggested svc req",
            "description": "TEST created by testing agent", "priority": "normal",
            "budget_estimate": 100, "suggested_service_name": name}, timeout=30)
        assert r.status_code in (200, 201), r.text
        rid = r.json()["id"]
        lst = admin_s.get(f"{API}/admin/suggested-services", params={"status": "pending"}, timeout=20).json()
        it = next((i for i in lst["items"] if i["name"] == name), None)
        assert it and rid in it["request_ids"]
