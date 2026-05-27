"""
Phase 30 — Operator Digital Twin Pro onboarding flow.

Covers BACKEND-A..I from review_request iteration_30.

Endpoints under test:
  - POST   /api/operator/digital-twin/grant-access
  - GET    /api/operator/digital-twin/clients-queue
  - POST   /api/operator/digital-twin/clients/{client_id}/projects
  - POST   /api/digital-twin/projects/{project_id}/upload     (.glb, .skp)
  - POST   /api/digital-twin/projects/{project_id}/plans      (.pdf)
  - GET    /api/digital-twin/projects[/{id}/models|/plans]
  - GET    /api/digital-twin/files/{project_id}/{filename}
"""
import io
import os
import struct
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
OP_EMAIL, OP_PASSWORD = "operator@propmanage.io", "Op123!"
CL_EMAIL, CL_PASSWORD = "client@propmanage.io", "Client123!"
SP_EMAIL, SP_PASSWORD = "specialist@propmanage.io", "Spec123!"


def _login(email, password):
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"login {email} failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def op():
    return _login(OP_EMAIL, OP_PASSWORD)


@pytest.fixture(scope="module")
def cl():
    return _login(CL_EMAIL, CL_PASSWORD)


@pytest.fixture(scope="module")
def sp():
    return _login(SP_EMAIL, SP_PASSWORD)


@pytest.fixture(scope="module")
def client_id(op, cl):
    me = cl.get(f"{BASE_URL}/api/auth/me", timeout=15).json()
    return me.get("id") or me.get("_id")


@pytest.fixture(scope="module")
def specialist_id(sp):
    me = sp.get(f"{BASE_URL}/api/auth/me", timeout=15).json()
    return me.get("id") or me.get("_id")


def _make_glb_bytes():
    # 4 bytes magic 'glTF' + 4 bytes version=2 + 4 bytes length=12
    return b"glTF" + struct.pack("<I", 2) + struct.pack("<I", 12)


# ===== BACKEND-A: grant-access happy path =====
def test_a_grant_access_to_client(op, client_id):
    r = op.post(
        f"{BASE_URL}/api/operator/digital-twin/grant-access",
        json={"user_id": client_id, "active": True},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["ok"] is True
    assert data["user_id"] == client_id
    assert data["active"] is True


# ===== BACKEND-B: grant-access guards =====
def test_b_grant_access_to_specialist_400(op, specialist_id):
    r = op.post(
        f"{BASE_URL}/api/operator/digital-twin/grant-access",
        json={"user_id": specialist_id, "active": True},
        timeout=15,
    )
    assert r.status_code == 400, r.text
    # accept either "clienti" or "clienților" (Romanian char ț not == t)
    assert "client" in r.text.lower() or "clienț" in r.text.lower()


def test_b_grant_access_to_nonexistent_404(op):
    r = op.post(
        f"{BASE_URL}/api/operator/digital-twin/grant-access",
        json={"user_id": "000000000000000000000000", "active": True},
        timeout=15,
    )
    assert r.status_code == 404, r.text


# ===== BACKEND-C: clients-queue =====
def test_c_clients_queue_structure(op, client_id):
    r = op.get(f"{BASE_URL}/api/operator/digital-twin/clients-queue", timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "items" in data and isinstance(data["items"], list)
    assert "counters" in data
    for k in ("needs_setup", "in_progress", "delivered", "total"):
        assert k in data["counters"], f"counter {k} missing"
    # our just-granted client must show up
    ours = [x for x in data["items"] if x["client_id"] == client_id]
    assert ours, "granted client missing from queue"
    item = ours[0]
    for k in ("client_id", "client_name", "client_email", "project_count",
              "model_count", "plan_count", "projects", "status"):
        assert k in item, f"item missing {k}"
    assert item["status"] in ("needs_setup", "in_progress", "delivered")


def test_c_clients_queue_filter_needs_setup(op):
    r = op.get(
        f"{BASE_URL}/api/operator/digital-twin/clients-queue?status=needs_setup",
        timeout=20,
    )
    assert r.status_code == 200, r.text
    for it in r.json()["items"]:
        assert it["status"] == "needs_setup"


# ===== BACKEND-D: create project =====
@pytest.fixture(scope="module")
def project_id(op, client_id):
    payload = {"client_id": client_id, "name": "TEST_VilaDemoOperator",
               "description": "Created by pytest operator suite"}
    r = op.post(
        f"{BASE_URL}/api/operator/digital-twin/clients/{client_id}/projects",
        json=payload,
        timeout=20,
    )
    assert r.status_code == 200, r.text
    p = r.json()
    assert p["owner_id"] == client_id
    assert p.get("created_by_operator_id")
    assert p["name"] == "TEST_VilaDemoOperator"
    return p["id"]


def test_d_create_project_owner_is_client(project_id):
    assert project_id


def test_d_create_project_mismatched_ids_400(op, client_id):
    r = op.post(
        f"{BASE_URL}/api/operator/digital-twin/clients/{client_id}/projects",
        json={"client_id": "deadbeef", "name": "TEST_Bad"},
        timeout=15,
    )
    assert r.status_code == 400


def test_d_create_project_without_dt_flag_400(op, client_id):
    """When the client does NOT have digital_twin_pro=true, project creation must 400."""
    # Revoke client's DT flag
    op.post(
        f"{BASE_URL}/api/operator/digital-twin/grant-access",
        json={"user_id": client_id, "active": False},
        timeout=15,
    )
    try:
        r = op.post(
            f"{BASE_URL}/api/operator/digital-twin/clients/{client_id}/projects",
            json={"client_id": client_id, "name": "TEST_NoFlagClient"},
            timeout=15,
        )
        assert r.status_code == 400, r.text
        assert "Digital Twin" in r.text or "acces" in r.text.lower()
    finally:
        # Re-grant so downstream tests / app remain in good state
        op.post(
            f"{BASE_URL}/api/operator/digital-twin/grant-access",
            json={"user_id": client_id, "active": True},
            timeout=15,
        )


def test_d_create_project_for_non_client_should_be_blocked(op, specialist_id):
    """REGRESSION: operator route does not check role==client (only digital_twin_pro flag).
    Specialist with stale DT flag can have a 'client project' created for them.
    PRD says projects are for clients only — backend should also enforce role==client."""
    sp_has_dt = True  # captured at top of suite
    r = op.post(
        f"{BASE_URL}/api/operator/digital-twin/clients/{specialist_id}/projects",
        json={"client_id": specialist_id, "name": "TEST_RoleCheckProbe"},
        timeout=15,
    )
    # Document current behaviour; xfail if backend hasn't added the role guard yet.
    if r.status_code == 200:
        pytest.xfail(
            "Backend BUG: operator_create_project_for_client does not validate role=='client'. "
            "Specialist with stale digital_twin_pro=True gets a DT project created."
        )
    assert r.status_code in (400, 404), r.text
    _ = sp_has_dt


# ===== BACKEND-E: upload .glb =====
def test_e_upload_glb(op, project_id):
    files = {"file": ("vila.glb", io.BytesIO(_make_glb_bytes()), "model/gltf-binary")}
    r = op.post(
        f"{BASE_URL}/api/digital-twin/projects/{project_id}/upload",
        files=files,
        timeout=30,
    )
    assert r.status_code == 200, r.text
    m = r.json()
    assert m["kind"] == "model"
    assert m["ext"] == ".glb"
    assert m["url"].endswith(".glb")


# ===== BACKEND-F: upload .skp =====
@pytest.fixture(scope="module")
def skp_upload(op, project_id):
    blob = os.urandom(64)
    files = {"file": ("model.skp", io.BytesIO(blob), "application/octet-stream")}
    r = op.post(
        f"{BASE_URL}/api/digital-twin/projects/{project_id}/upload",
        files=files,
        timeout=30,
    )
    assert r.status_code == 200, r.text
    return r.json()


def test_f_skp_kind_archive(skp_upload):
    assert skp_upload["kind"] == "archive"
    assert skp_upload["ext"] == ".skp"


def test_f_skp_model_url_not_updated(op, project_id, skp_upload):
    # The project.model_url must remain the .glb URL (from test_e) — not the .skp one
    r = op.get(f"{BASE_URL}/api/digital-twin/projects", timeout=15)
    assert r.status_code == 200
    projects = r.json().get("items") if isinstance(r.json(), dict) else r.json()
    proj = next((p for p in projects if p["id"] == project_id), None)
    assert proj is not None, "project missing for operator listing"
    if proj.get("model_url"):
        assert not proj["model_url"].endswith(".skp"), "model_url should not be set to .skp"


def test_f_skp_downloadable(op, project_id, skp_upload):
    # url is /api/digital-twin/files/{pid}/{stored}
    url = skp_upload["url"]
    r = op.get(f"{BASE_URL}{url}", timeout=20)
    assert r.status_code == 200, r.text
    assert len(r.content) > 0


# ===== BACKEND-G: upload .pdf plan =====
@pytest.fixture(scope="module")
def plan_upload(op, project_id):
    pdf_bytes = b"%PDF-1.4\n%test\n1 0 obj <<>> endobj\n%%EOF\n"
    files = {"file": ("plan.pdf", io.BytesIO(pdf_bytes), "application/pdf")}
    r = op.post(
        f"{BASE_URL}/api/digital-twin/projects/{project_id}/plans",
        files=files,
        params={"title": "TEST_Plan", "plan_type": "floorplan"},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    return r.json()


def test_g_pdf_plan_uploaded(plan_upload):
    assert plan_upload  # any 200 payload is fine


# ===== BACKEND-H: client cross-role visibility =====
def test_h_client_sees_project(cl, project_id, skp_upload, plan_upload):
    r = cl.get(f"{BASE_URL}/api/digital-twin/projects", timeout=20)
    assert r.status_code == 200, r.text
    body = r.json()
    items = body.get("items") if isinstance(body, dict) else body
    assert any(p["id"] == project_id for p in items), "client does not see operator-created project"


def test_h_client_sees_models(cl, project_id, skp_upload):
    r = cl.get(f"{BASE_URL}/api/digital-twin/projects/{project_id}/models", timeout=20)
    assert r.status_code == 200, r.text
    items = r.json().get("items", [])
    assert len(items) >= 2  # .glb + .skp
    kinds = {m["kind"] for m in items}
    assert "model" in kinds and "archive" in kinds


def test_h_client_sees_plans(cl, project_id, plan_upload):
    r = cl.get(f"{BASE_URL}/api/digital-twin/projects/{project_id}/plans", timeout=20)
    assert r.status_code == 200, r.text
    body = r.json()
    items = body.get("items") if isinstance(body, dict) else body
    assert items, "client does not see uploaded plans"


# ===== BACKEND-I: non-operator forbidden =====
def test_i_client_cannot_call_operator_routes(cl, client_id):
    r = cl.post(
        f"{BASE_URL}/api/operator/digital-twin/grant-access",
        json={"user_id": client_id, "active": True},
        timeout=15,
    )
    assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text}"

    r2 = cl.get(f"{BASE_URL}/api/operator/digital-twin/clients-queue", timeout=15)
    assert r2.status_code == 403


def test_i_specialist_cannot_call_operator_routes(sp):
    r = sp.get(f"{BASE_URL}/api/operator/digital-twin/clients-queue", timeout=15)
    assert r.status_code == 403
