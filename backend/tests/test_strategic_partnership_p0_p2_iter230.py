"""Iter 230 - Strategic City Partnership + City nZEB (P0->P1->P2).

Covers: City Partner profile fields, lost_reason (city+marketplace), funnel,
taxonomy, agreements CRUD + exclusivity conflict 409/ack, check-conflicts dry-run,
commissions report, routing + history, RBAC, CSRF guard.
All test data prefixed TEST_ and hard-cleaned from Mongo in teardown.
"""
import os
import uuid
import pytest
import requests
from pymongo import MongoClient
from bson import ObjectId
from tests.test_config import OWNER_ADMIN_PASSWORD

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
SP = f"{BASE_URL}/api/admin/strategic-partners"
CP = f"{BASE_URL}/api/admin/city-partners"
MP = f"{BASE_URL}/api/admin/marketplace-partners"
TAG = uuid.uuid4().hex[:6]
CAT = f"TEST_Cat_{TAG}"
CAT2 = f"TEST_Cat2_{TAG}"
CITY = f"TEST_City_{TAG}"

_mc = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
mdb = _mc[os.environ.get("DB_NAME", "propmanage_db")]

CREATED = {"city": [], "mkt": [], "city_leads": [], "mkt_leads": [], "agr": [], "route": []}


def _login(email, pw):
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pw}, timeout=30)
    if r.status_code != 200:
        pytest.skip(f"login failed {email}: {r.status_code}")
    return s


@pytest.fixture(scope="module")
def admin():
    return _login("admin@propmanage.io", OWNER_ADMIN_PASSWORD)


@pytest.fixture(scope="module")
def client_s():
    return _login("client@propmanage.io", "Client123!")


@pytest.fixture(scope="module")
def spec_s():
    return _login("specialist@propmanage.io", "Spec123!")


@pytest.fixture(scope="module", autouse=True)
def cleanup():
    yield
    for k, col in (("city", "city_partners"), ("mkt", "marketplace_partners"),
                   ("city_leads", "city_partner_leads"), ("mkt_leads", "marketplace_leads"),
                   ("agr", "partner_agreements"), ("route", "partner_route_history")):
        ids = [ObjectId(x) for x in CREATED[k]]
        if ids:
            mdb[col].delete_many({"_id": {"$in": ids}})
    lids = CREATED["city_leads"] + CREATED["mkt_leads"]
    if lids:
        mdb.leads.delete_many({"meta.legacy_id": {"$in": lids}})
    # any route history for our TEST category
    mdb.partner_route_history.delete_many({"category": {"$regex": f"^TEST_.*{TAG}"}})
    mdb.partner_agreements.delete_many({"categories": {"$regex": TAG}})


@pytest.fixture(scope="module")
def city_partner(admin):
    r = admin.post(CP, json={
        "company": f"TEST_CityCo_{TAG}", "contact_name": "Test Contact",
        "contact_email": f"test_city_{TAG}@example.com", "city": CITY, "status": "active",
        "partner_type": "studio", "coverage": "regional", "categories": [CAT, "Audit energetic"],
        "zones": [f"TEST_Zone_{TAG}"], "services": ["design", "nzeb"], "units_managed": 600,
    })
    assert r.status_code == 200, r.text
    d = r.json()
    CREATED["city"].append(d["id"])
    return d


@pytest.fixture(scope="module")
def mkt_partner(admin):
    r = admin.post(MP, json={
        "company": f"TEST_MktCo_{TAG}", "contact_name": "Test Mkt",
        "contact_email": f"test_mkt_{TAG}@example.com", "city": CITY, "status": "active",
        "categories": [CAT], "tier": "premium",
    })
    assert r.status_code == 200, r.text
    d = r.json()
    CREATED["mkt"].append(d["id"])
    return d


# ── P0-1 profile fields ──
class TestProfileFields:
    def test_create_persists_profile(self, admin, city_partner):
        g = admin.get(f"{CP}/{city_partner['id']}")
        assert g.status_code == 200
        body = g.json()
        p = body.get("partner", body)
        assert p["partner_type"] == "studio"
        assert p["coverage"] == "regional"
        assert CAT in p["categories"]
        assert p["zones"] == [f"TEST_Zone_{TAG}"]
        assert p["services"] == ["design", "nzeb"]

    def test_patch_profile(self, admin, city_partner):
        r = admin.patch(f"{CP}/{city_partner['id']}", json={"coverage": "national", "services": ["audit"]})
        assert r.status_code == 200, r.text
        assert r.json()["coverage"] == "national" and r.json()["services"] == ["audit"]
        # revert to regional for later territory-based tests
        r = admin.patch(f"{CP}/{city_partner['id']}", json={"coverage": "regional"})
        assert r.json()["coverage"] == "regional"

    def test_invalid_partner_type(self, admin, city_partner):
        r = admin.patch(f"{CP}/{city_partner['id']}", json={"partner_type": "bogus"})
        assert r.status_code == 400
        r = admin.post(CP, json={"company": "TEST_bad", "contact_name": "xx",
                                 "contact_email": f"bad_{TAG}@example.com", "city": CITY, "coverage": "galaxy"})
        assert r.status_code == 400

    def test_legacy_partner_defaults(self, admin):
        res = mdb.city_partners.insert_one({"company": f"TEST_Legacy_{TAG}", "contact_name": "L",
                                            "contact_email": f"legacy_{TAG}@example.com", "city": CITY,
                                            "status": "lead"})
        CREATED["city"].append(str(res.inserted_id))
        g = admin.get(f"{CP}/{res.inserted_id}")
        assert g.status_code == 200, g.text
        body = g.json()
        p = body.get("partner", body)
        assert p["partner_type"] == "city" and p["coverage"] == "city"
        assert p["categories"] == [] and p["zones"] == [] and p["services"] == []
        lst = admin.get(CP)
        assert lst.status_code == 200
        assert any(i["id"] == str(res.inserted_id) for i in lst.json()["items"])


# ── P0-2 lost_reason ──
class TestLostReason:
    def test_city_lead_lost_reason(self, admin, city_partner):
        r = admin.post(f"{CP}/{city_partner['id']}/leads", json={"lead_name": "TEST_Lead City",
                                                                 "lead_email": "client@propmanage.io"})
        assert r.status_code == 200, r.text
        lid = r.json()["id"]
        CREATED["city_leads"].append(lid)
        r = admin.patch(f"{CP}/leads/{lid}", json={"stage": "lost", "lost_reason": "Preț prea mare"})
        assert r.status_code == 200 and r.json()["lost_reason"] == "Preț prea mare"
        lst = admin.get(f"{CP}/{city_partner['id']}/leads").json()
        items = lst.get("items", lst)
        assert any(i["id"] == lid and i["lost_reason"] == "Preț prea mare" for i in items)
        r = admin.patch(f"{CP}/leads/{lid}", json={"stage": "converted"})
        assert r.status_code == 200 and r.json()["lost_reason"] is None
        assert r.json()["conversion_date"]

    def test_mkt_lead_lost_reason(self, admin, mkt_partner):
        r = admin.post(f"{MP}/{mkt_partner['id']}/leads", json={"lead_name": "TEST_Lead Mkt"})
        assert r.status_code == 200, r.text
        lid = r.json()["id"]
        CREATED["mkt_leads"].append(lid)
        r = admin.patch(f"{MP}/leads/{lid}", json={"stage": "lost", "lost_reason": "Competitor"})
        assert r.status_code == 200 and r.json()["lost_reason"] == "Competitor"
        r = admin.patch(f"{MP}/leads/{lid}", json={"stage": "converted", "revenue_generated": 1000})
        assert r.status_code == 200 and r.json()["lost_reason"] is None
        assert r.json()["revenue_generated"] == 1000


# ── P0-3 funnel ──
class TestFunnel:
    def test_funnel_real_numbers(self, admin, city_partner):
        r = admin.get(f"{SP}/funnel")
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("invited", "activated_accounts", "activation_rate", "converted", "conversion_rate"):
            assert k in d["totals"]
        assert set(d["by_program"].keys()) == {"city_partner", "marketplace_partner"}
        row = next(x for x in d["rows"] if x["partner_id"] == city_partner["id"])
        # 1 lead w/ email client@propmanage.io (a real user) -> activated 1, converted 1
        assert row["invited"] == 1 and row["activated_accounts"] == 1 and row["converted"] == 1
        # totals equal DB counts for non-terminated partners
        active_ids = [p["_id"] for p in mdb.city_partners.find({"status": {"$ne": "terminated"}})]
        n = mdb.city_partner_leads.count_documents({"partner_id": {"$in": active_ids}})
        assert d["by_program"]["city_partner"]["leads"] == n


# ── P2-8 taxonomy ──
def test_taxonomy(admin):
    r = admin.get(f"{SP}/taxonomy")
    assert r.status_code == 200
    d = r.json()
    assert "Audit energetic" in d["category_groups"]["nZEB"]
    assert "terminated" in d["agreement_statuses"]
    assert d["coverage_levels"] == ["city", "regional", "national"]
    assert len(d["categories"]) > 5 and "studio" in d["partner_types"] and d["segments"]


# ── P1-4/5/6 agreements + conflicts ──
class TestAgreements:
    def _base(self, partner_id, kind="city", **kw):
        p = {"kind": kind, "partner_id": partner_id, "categories": [CAT], "territory_cities": [CITY],
             "status": "active", "exclusivity": True, "period_from": "2026-01-01", "period_to": "2026-12-31"}
        p.update(kw)
        return p

    def test_partner_missing_404(self, admin):
        r = admin.post(f"{SP}/agreements", json=self._base(str(ObjectId())))
        assert r.status_code == 404
        r = admin.post(f"{SP}/agreements", json=self._base("notanid"))
        assert r.status_code == 404
        r = admin.post(f"{SP}/agreements", json=self._base(str(ObjectId()), kind="weird"))
        assert r.status_code == 400

    def test_conflict_flow(self, admin, city_partner, mkt_partner):
        r = admin.post(f"{SP}/agreements", json=self._base(city_partner["id"]))
        assert r.status_code == 200, r.text
        a1 = r.json()
        CREATED["agr"].append(a1["id"])
        assert a1["partner_name"] == city_partner["company"] and a1["exclusivity"] is True

        # dry-run detects, no persistence
        before = mdb.partner_agreements.count_documents({})
        r = admin.post(f"{SP}/agreements/check-conflicts", json=self._base(mkt_partner["id"], kind="marketplace"))
        assert r.status_code == 200 and r.json()["has_conflicts"] is True
        assert any(c["agreement_id"] == a1["id"] for c in r.json()["conflicts"])
        assert mdb.partner_agreements.count_documents({}) == before

        # 409 without ack
        r = admin.post(f"{SP}/agreements", json=self._base(mkt_partner["id"], kind="marketplace"))
        assert r.status_code == 409, r.text
        det = r.json()["detail"]
        assert det["conflicts"] and det["conflicts"][0]["agreement_id"] == a1["id"]
        assert mdb.partner_agreements.count_documents({}) == before

        # ack -> 200
        r = admin.post(f"{SP}/agreements", json=self._base(mkt_partner["id"], kind="marketplace",
                                                           acknowledge_conflicts=True))
        assert r.status_code == 200, r.text
        a2 = r.json()
        CREATED["agr"].append(a2["id"])
        assert a2["approved_by"] == "admin@propmanage.io"
        assert a1["id"] in a2["acknowledged_conflicts"]

    def test_non_overlaps_no_409(self, admin, mkt_partner):
        cases = [
            self._base(mkt_partner["id"], kind="marketplace", categories=[CAT2]),
            self._base(mkt_partner["id"], kind="marketplace", period_from="2027-01-01", period_to="2027-12-31"),
            self._base(mkt_partner["id"], kind="marketplace", status="draft"),
            self._base(mkt_partner["id"], kind="marketplace", territory_cities=[f"TEST_Other_{TAG}"]),
        ]
        for c in cases:
            r = admin.post(f"{SP}/agreements", json=c)
            assert r.status_code == 200, f"{c} -> {r.status_code} {r.text}"
            CREATED["agr"].append(r.json()["id"])

    def test_list_get_patch_delete(self, admin):
        aid = CREATED["agr"][0]
        r = admin.get(f"{SP}/agreements")
        assert r.status_code == 200 and any(i["id"] == aid for i in r.json()["items"])
        r = admin.get(f"{SP}/agreements", params={"status": "draft"})
        assert all(i["status"] == "draft" for i in r.json()["items"])
        r = admin.get(f"{SP}/agreements/{aid}")
        assert r.status_code == 200 and r.json()["id"] == aid
        r = admin.patch(f"{SP}/agreements/{aid}", json={"notes": "TEST_note", "commission_terms": "5%"})
        # still conflicting with a2 (both active, exclusive) -> patch re-check yields 409
        assert r.status_code in (200, 409), r.text
        if r.status_code == 409:
            r = admin.patch(f"{SP}/agreements/{aid}", json={"notes": "TEST_note", "acknowledge_conflicts": True})
            assert r.status_code == 200
        assert admin.get(f"{SP}/agreements/{aid}").json()["notes"] == "TEST_note"
        r = admin.patch(f"{SP}/agreements/{aid}", json={"status": "bogus"})
        assert r.status_code == 400
        r = admin.get(f"{SP}/agreements/{ObjectId()}")
        assert r.status_code == 404

    def test_patch_draft_to_active_conflict(self, admin):
        # draft agreement (index 4 created above) -> activate -> 409
        draft_id = next(i for i in CREATED["agr"]
                        if mdb.partner_agreements.find_one({"_id": ObjectId(i)})["status"] == "draft")
        r = admin.patch(f"{SP}/agreements/{draft_id}", json={"status": "active"})
        assert r.status_code == 409, r.text
        assert mdb.partner_agreements.find_one({"_id": ObjectId(draft_id)})["status"] == "draft"

    def test_soft_delete(self, admin):
        aid = CREATED["agr"][-1]
        r = admin.delete(f"{SP}/agreements/{aid}")
        assert r.status_code == 200 and r.json()["archived"] is True
        assert admin.get(f"{SP}/agreements/{aid}").json()["status"] == "terminated"
        assert admin.delete(f"{SP}/agreements/{ObjectId()}").status_code == 404


# ── P1-7 commissions ──
def test_commissions_report(admin, mkt_partner):
    r = admin.post(f"{MP}/{mkt_partner['id']}/commissions", json={"type": "percent", "percent": 10})
    assert r.status_code == 200, r.text
    r = admin.get(f"{SP}/commissions-report")
    assert r.status_code == 200
    d = r.json()
    assert "Fără plăți" in d["disclaimer"]
    row = next(x for x in d["rows"] if x["partner_id"] == mkt_partner["id"])
    assert row["converted"] == 1 and row["revenue"] == 1000
    assert row["eligible_one_time"] == 100.0 and row["commission_type"] == "percent"
    admin.post(f"{MP}/{mkt_partner['id']}/commissions", json={"type": "subscription", "monthly_subscription": 299})
    row = next(x for x in admin.get(f"{SP}/commissions-report").json()["rows"] if x["partner_id"] == mkt_partner["id"])
    assert row["eligible_recurring_monthly"] == 299.0 and row["eligible_one_time"] == 0
    admin.post(f"{MP}/{mkt_partner['id']}/commissions", json={"type": "per_lead", "per_lead": 25})
    row = next(x for x in admin.get(f"{SP}/commissions-report").json()["rows"] if x["partner_id"] == mkt_partner["id"])
    assert row["eligible_one_time"] == 25.0


# ── P2-9 routing ──
class TestRouting:
    def test_route_rank_and_history(self, admin, city_partner, mkt_partner):
        r = admin.post(f"{SP}/route-request", json={"category": CAT, "city": CITY})
        assert r.status_code == 200, r.text
        d = r.json()
        CREATED["route"].append(d["id"])
        ids = [x["partner_id"] for x in d["ranked"]]
        assert city_partner["id"] in ids and mkt_partner["id"] in ids
        assert d["recommended_partner_id"] == d["ranked"][0]["partner_id"]
        top = d["ranked"][0]
        assert top["has_active_agreement"] is True and top["score"] >= 60 and top["reasons"]
        scores = [x["score"] for x in d["ranked"]]
        assert scores == sorted(scores, reverse=True)
        h = admin.get(f"{SP}/route-history")
        assert h.status_code == 200 and any(i["id"] == d["id"] for i in h.json()["items"])

    def test_route_profile_match_zone(self, admin, city_partner):
        r = admin.post(f"{SP}/route-request", json={"category": "Audit energetic", "city": f"TEST_Zone_{TAG}"})
        assert r.status_code == 200
        CREATED["route"].append(r.json()["id"])
        c = next((x for x in r.json()["ranked"] if x["partner_id"] == city_partner["id"]), None)
        assert c is not None and "categorie în profil" in c["reasons"]

    def test_route_validation(self, admin):
        assert admin.post(f"{SP}/route-request", json={"category": "x"}).status_code == 422

    def test_terminated_excluded(self, admin, city_partner):
        assert admin.delete(f"{CP}/{city_partner['id']}").status_code == 200
        r = admin.post(f"{SP}/route-request", json={"category": CAT, "city": CITY})
        CREATED["route"].append(r.json()["id"])
        assert city_partner["id"] not in [x["partner_id"] for x in r.json()["ranked"]]


# ── RBAC + CSRF ──
ENDPOINTS_GET = ["funnel", "taxonomy", "agreements", "commissions-report", "route-history", "dashboard"]


@pytest.mark.parametrize("who", ["client_s", "spec_s"])
def test_rbac_non_admin(request, who):
    s = request.getfixturevalue(who)
    for ep in ENDPOINTS_GET:
        r = s.get(f"{SP}/{ep}")
        assert r.status_code in (401, 403), f"{who} {ep} -> {r.status_code}"
    assert s.post(f"{SP}/route-request", json={"category": "HVAC", "city": "Cluj"}).status_code in (401, 403)
    assert s.post(f"{SP}/agreements", json={"kind": "city", "partner_id": str(ObjectId())}).status_code in (401, 403)
    assert s.post(f"{SP}/agreements/check-conflicts", json={"kind": "city", "partner_id": "x"}).status_code in (401, 403)
    assert s.get(CP).status_code in (401, 403)
    assert s.get(MP).status_code in (401, 403)
    assert s.patch(f"{CP}/leads/{ObjectId()}", json={"stage": "lost"}).status_code in (401, 403)


def test_unauthenticated():
    assert requests.get(f"{SP}/funnel").status_code in (401, 403)


def test_csrf_guard(admin):
    r = admin.post(f"{SP}/route-request", json={"category": "HVAC"}, headers={"Origin": "https://evil.example.com"})
    assert r.status_code == 403
    r = admin.post(f"{SP}/route-request", json={"category": "HVAC"}, headers={"Origin": BASE_URL})
    assert r.status_code == 403  # missing X-PM-Client
    r = admin.post(f"{SP}/route-request", json={"category": f"TEST_csrf_{TAG}"},
                   headers={"Origin": BASE_URL, "X-PM-Client": "propmanage-app"})
    assert r.status_code == 200
    CREATED["route"].append(r.json()["id"])


def test_regression_dashboard(admin):
    for u in (f"{SP}/dashboard", f"{SP}/opportunities", f"{CP}/stats", f"{MP}/stats", CP, MP):
        assert admin.get(u).status_code == 200, u
