"""Iteration 233 — Partner portal multi-user (viewer/operator), invites, notifications, isolation."""
import os
import uuid
import pytest
import requests
from bson import ObjectId
from dotenv import dotenv_values
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
HDR = {"Content-Type": "application/json", "X-PM-Client": "propmanage-app"}
BUCIN_ID = "6adf5b65219980e1e22a386f"
OTHER_PID = "6ab6d89300ef836651823783"  # TEST_Partner_ed20ae91 (has leads)
ADMIN = ("admin@propmanage.io", "1!nasov01ADMIN")
VIEWER = ("viewer.bucinmob@test.propmanage.io", "ViewerPass123!")

_env = dotenv_values("/app/backend/.env")
mdb = MongoClient(_env["MONGO_URL"])[_env["DB_NAME"]]

STATE = {}


def _login(email, pw):
    s = requests.Session()
    s.headers.update(HDR)
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pw}, timeout=20)
    return s if r.status_code == 200 else None


@pytest.fixture(scope="module")
def admin():
    s = _login(*ADMIN)
    if not s:
        pytest.skip("admin login failed")
    return s


@pytest.fixture(scope="module")
def viewer():
    s = _login(*VIEWER)
    if not s:
        pytest.skip("viewer login failed")
    return s


@pytest.fixture(scope="module", autouse=True)
def cleanup():
    yield
    for lid in STATE.get("leads", []):
        mdb.city_partner_leads.delete_one({"_id": ObjectId(lid)})
        mdb.partner_notifications.delete_many({"lead_id": lid})
    for em in STATE.get("emails", []):
        u = mdb.users.find_one({"email": em})
        if u:
            mdb.city_partners.update_many({}, {"$pull": {"portal_users": {"user_id": str(u["_id"])}}})
            mdb.partner_invites.delete_many({"user_id": str(u["_id"])})
            mdb.users.delete_one({"_id": u["_id"]})
    # restore Bucin lead stage
    if STATE.get("bucin_lead"):
        mdb.city_partner_leads.update_one({"_id": ObjectId(STATE["bucin_lead"])}, {"$set": {"stage": "introduced"}})


# --- Admin: portal users management ---
class TestAdminUsers:
    def test_list_users(self, admin):
        r = admin.get(f"{BASE_URL}/api/admin/city-partners/{BUCIN_ID}/users")
        assert r.status_code == 200
        d = r.json()
        assert d["roles"] == ["operator", "viewer"]
        assert any(u["email"] == VIEWER[0] and u["role"] == "viewer" for u in d["items"])

    def test_add_invalid_role(self, admin):
        r = admin.post(f"{BASE_URL}/api/admin/city-partners/{BUCIN_ID}/users", json={"email": "TEST_x@test.propmanage.io", "role": "owner"})
        assert r.status_code == 400

    def test_add_existing_admin_email_rejected(self, admin):
        r = admin.post(f"{BASE_URL}/api/admin/city-partners/{BUCIN_ID}/users", json={"email": ADMIN[0], "role": "viewer"})
        assert r.status_code == 400

    def test_add_operator_manual(self, admin):
        em = f"test_op_{uuid.uuid4().hex[:6]}@test.propmanage.io"
        STATE.setdefault("emails", []).append(em)
        r = admin.post(f"{BASE_URL}/api/admin/city-partners/{BUCIN_ID}/users", json={"email": em, "name": "TEST Op", "role": "operator"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["role"] == "operator" and d["temp_password"]
        STATE["op"] = {"email": em, "uid": d["user_id"], "pw": d["temp_password"]}
        lst = admin.get(f"{BASE_URL}/api/admin/city-partners/{BUCIN_ID}/users").json()["items"]
        assert any(u["user_id"] == d["user_id"] and u["role"] == "operator" for u in lst)

    def test_temp_password_login(self):
        op = STATE["op"]
        s = _login(op["email"], op["pw"])
        assert s is not None, "temp password login failed"
        r = s.get(f"{BASE_URL}/api/partner/portal")
        assert r.status_code == 200, r.text
        assert r.json()["role"] == "operator"

    def test_invite_and_accept(self, admin):
        op = STATE["op"]
        r = admin.post(f"{BASE_URL}/api/admin/city-partners/{BUCIN_ID}/users/{op['uid']}/invite")
        assert r.status_code == 200, r.text
        d = r.json()
        assert "accept-invite?token=" in d["invite_url"] and d["invite_url"].startswith("http")
        assert isinstance(d["email_sent"], bool)
        token = d["invite_url"].split("token=")[1]
        info = requests.get(f"{BASE_URL}/api/partner/invite/{token}", headers=HDR).json()
        assert info["valid"] is True and info["partner_company"] == "Bucin Mob SRL" and info["email"] == op["email"]
        short = requests.post(f"{BASE_URL}/api/partner/accept-invite", json={"token": token, "password": "short"}, headers=HDR)
        assert short.status_code == 422
        ok = requests.post(f"{BASE_URL}/api/partner/accept-invite", json={"token": token, "password": "OperatorNew123!"}, headers=HDR)
        assert ok.status_code == 200
        reuse = requests.post(f"{BASE_URL}/api/partner/accept-invite", json={"token": token, "password": "OperatorNew123!"}, headers=HDR)
        assert reuse.status_code == 400
        assert requests.get(f"{BASE_URL}/api/partner/invite/{token}", headers=HDR).json()["valid"] is False
        op["pw"] = "OperatorNew123!"
        assert _login(op["email"], op["pw"]) is not None

    def test_invalid_token(self):
        r = requests.get(f"{BASE_URL}/api/partner/invite/bogus-token-xyz", headers=HDR)
        assert r.status_code == 200 and r.json()["valid"] is False


# --- Operator edit path & isolation ---
class TestOperator:
    def test_operator_patch_own_lead(self):
        s = _login(STATE["op"]["email"], STATE["op"]["pw"])
        leads = s.get(f"{BASE_URL}/api/partner/leads").json()["items"]
        assert leads and all(l["partner_id"] == BUCIN_ID for l in leads)
        lid = leads[0]["id"]
        STATE["bucin_lead"] = lid
        r = s.patch(f"{BASE_URL}/api/partner/leads/{lid}", json={"stage": "contacted"})
        assert r.status_code == 200 and r.json()["stage"] == "contacted"
        again = [l for l in s.get(f"{BASE_URL}/api/partner/leads").json()["items"] if l["id"] == lid][0]
        assert again["stage"] == "contacted"

    def test_operator_invalid_stage(self):
        s = _login(STATE["op"]["email"], STATE["op"]["pw"])
        r = s.patch(f"{BASE_URL}/api/partner/leads/{STATE['bucin_lead']}", json={"stage": "hacked"})
        assert r.status_code == 400

    def test_operator_cross_partner_404(self, admin):
        other = admin.get(f"{BASE_URL}/api/admin/city-partners/{OTHER_PID}/leads").json()["items"]
        assert other
        s = _login(STATE["op"]["email"], STATE["op"]["pw"])
        r = s.patch(f"{BASE_URL}/api/partner/leads/{other[0]['id']}", json={"stage": "lost"})
        assert r.status_code == 404
        after = admin.get(f"{BASE_URL}/api/admin/city-partners/{OTHER_PID}/leads").json()["items"][0]
        assert after["stage"] == other[0]["stage"]


# --- Viewer read-only ---
class TestViewer:
    def test_viewer_portal_role(self, viewer):
        d = viewer.get(f"{BASE_URL}/api/partner/portal").json()
        assert d["role"] == "viewer"
        assert all(l["partner_id"] == BUCIN_ID for l in d["leads"])

    def test_viewer_patch_403(self, viewer):
        r = viewer.patch(f"{BASE_URL}/api/partner/leads/{STATE['bucin_lead']}", json={"stage": "lost"})
        assert r.status_code == 403

    def test_viewer_create_lead_blocked(self, viewer):
        r = viewer.post(f"{BASE_URL}/api/partner/leads", json={"lead_name": "TEST_viewer_lead", "stage": "introduced"})
        if r.status_code == 200:
            STATE.setdefault("leads", []).append(r.json()["id"])
        assert r.status_code == 403, f"viewer could create lead: {r.status_code}"

    def test_admin_endpoints_denied_to_partner(self, viewer):
        r = viewer.get(f"{BASE_URL}/api/admin/city-partners")
        assert r.status_code in (401, 403)


# --- Notifications ---
class TestNotifications:
    def test_create_lead_notifies(self, admin, viewer):
        before = viewer.get(f"{BASE_URL}/api/partner/notifications").json()["unread"]
        r = admin.post(f"{BASE_URL}/api/admin/city-partners/{BUCIN_ID}/leads", json={"lead_name": "TEST_Notif_Lead", "stage": "introduced"})
        assert r.status_code == 200, r.text
        lid = r.json()["id"]
        STATE.setdefault("leads", []).append(lid)
        d = viewer.get(f"{BASE_URL}/api/partner/notifications").json()
        assert d["unread"] == before + 1
        assert d["items"][0]["lead_id"] == lid and "TEST_Notif_Lead" in d["items"][0]["title"]
        STATE["note_id"] = d["items"][0]["id"]

    def test_stage_change_notifies(self, admin, viewer):
        before = viewer.get(f"{BASE_URL}/api/partner/notifications").json()["unread"]
        r = admin.patch(f"{BASE_URL}/api/admin/city-partners/leads/{STATE['leads'][-1]}", json={"stage": "contacted"})
        assert r.status_code == 200
        assert viewer.get(f"{BASE_URL}/api/partner/notifications").json()["unread"] == before + 1

    def test_mark_read(self, viewer):
        before = viewer.get(f"{BASE_URL}/api/partner/notifications").json()["unread"]
        r = viewer.post(f"{BASE_URL}/api/partner/notifications/{STATE['note_id']}/read")
        assert r.status_code == 200
        d = viewer.get(f"{BASE_URL}/api/partner/notifications").json()
        assert d["unread"] == before - 1
        assert [n for n in d["items"] if n["id"] == STATE["note_id"]][0]["read"] is True

    def test_read_is_per_user(self):
        s = _login(STATE["op"]["email"], STATE["op"]["pw"])
        items = s.get(f"{BASE_URL}/api/partner/notifications").json()["items"]
        n = [x for x in items if x["id"] == STATE["note_id"]][0]
        assert n["read"] is False

    def test_demo_no_side_effects(self, admin, viewer):
        before = viewer.get(f"{BASE_URL}/api/partner/notifications").json()
        r = admin.get(f"{BASE_URL}/api/partner/portal/demo?partner_id={BUCIN_ID}")
        assert r.status_code == 200 and r.json().get("demo") is True
        after = viewer.get(f"{BASE_URL}/api/partner/notifications").json()
        assert len(after["items"]) == len(before["items"])


# --- Removal / owner protection / portal access ---
class TestRemoval:
    def test_portal_access_enable_with_portal_users(self, admin):
        r = admin.post(f"{BASE_URL}/api/admin/city-partners/{BUCIN_ID}/portal-access", json={"enabled": True})
        assert r.status_code == 200 and r.json()["portal_access_enabled"] is True

    def test_remove_owner_blocked(self, admin):
        owner_pid = "6a3cf6645108a83d3d6c0776"
        p = admin.get(f"{BASE_URL}/api/admin/city-partners/{owner_pid}").json()
        r = admin.delete(f"{BASE_URL}/api/admin/city-partners/{owner_pid}/users/{p['linked_user_id']}")
        assert r.status_code == 400

    def test_remove_operator_revokes(self, admin):
        op = STATE["op"]
        r = admin.delete(f"{BASE_URL}/api/admin/city-partners/{BUCIN_ID}/users/{op['uid']}")
        assert r.status_code == 200
        lst = admin.get(f"{BASE_URL}/api/admin/city-partners/{BUCIN_ID}/users").json()["items"]
        assert not any(u["user_id"] == op["uid"] for u in lst)
        s = _login(op["email"], op["pw"])
        if s:
            assert s.get(f"{BASE_URL}/api/partner/portal").status_code in (403, 404)

    def test_delete_foreign_user_does_not_unlink(self, admin):
        """DELETE /{A}/users/{owner_of_B} must not strip B owner's partner_id."""
        owner_pid = "6a3cf6645108a83d3d6c0776"
        p = admin.get(f"{BASE_URL}/api/admin/city-partners/{owner_pid}").json()
        uid = p["linked_user_id"]
        before = mdb.users.find_one({"_id": ObjectId(uid)}) or {}
        r = admin.delete(f"{BASE_URL}/api/admin/city-partners/{BUCIN_ID}/users/{uid}")
        after = mdb.users.find_one({"_id": ObjectId(uid)}) or {}
        # restore if broken
        if before.get("partner_id") and not after.get("partner_id"):
            mdb.users.update_one({"_id": ObjectId(uid)}, {"$set": {"partner_id": before["partner_id"]}})
        assert after.get("partner_id") == before.get("partner_id"), f"status={r.status_code}; foreign user's partner_id was unset"
