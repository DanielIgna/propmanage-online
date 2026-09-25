"""Backend regression — DESIGN ECOSYSTEM Faza 4A (iter231).

Irene's World studio node + City Partners network schema prep + 17-step semantic map.
No new tracking system, no parallel registry, no invented data.
"""
import os
import requests
import pytest

from routes.admin_seo import _classify
from design_ecosystem import ecosystem_map, STAGE_ENTITY_MAP, PROJECT_RELATION_CHAIN

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
ADMIN = {"email": "admin@propmanage.io", "password": "1!nasov01ADMIN"}


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json=ADMIN, timeout=15)
    if r.status_code != 200:
        pytest.skip("admin login failed")
    return s


class TestSemanticMap:
    def test_17_stages(self):
        assert len(STAGE_ENTITY_MAP) == 17
        assert all("roles" in s and s["roles"] for s in STAGE_ENTITY_MAP)

    def test_design_stage_has_studio_role(self):
        design = next(s for s in STAGE_ENTITY_MAP if s["n"] == 8)
        assert "studio" in design["roles"]

    def test_materials_stage_has_brand_material(self):
        mats = next(s for s in STAGE_ENTITY_MAP if s["n"] == 9)
        assert "brand" in mats["roles"] and "material" in mats["roles"]

    def test_project_chain(self):
        for k in ("city", "style", "studio", "partner", "brand", "material", "cta"):
            assert k in PROJECT_RELATION_CHAIN

    def test_map_helper(self):
        m = ecosystem_map()
        assert m["stage_count"] == 17
        assert "entity_sources" in m


class TestClassifyStudio:
    def test_irenes_world_is_studio(self):
        t, cluster, commercial = _classify("/design-interior/irenes-world")
        assert t == "studio"
        assert cluster == "design_interior"
        assert commercial is True


class TestIrenesWorldSEO:
    def test_in_static_sitemap(self):
        r = requests.get(f"{BASE_URL}/api/public/sitemap-static.xml", timeout=15)
        if r.status_code != 200:
            pytest.skip("sitemap unreachable")
        assert "/design-interior/irenes-world" in r.text

    def test_gate_index_true(self):
        r = requests.get(f"{BASE_URL}/api/public/seo/gate?path=/design-interior/irenes-world", timeout=15)
        if r.status_code != 200:
            pytest.skip("gate unreachable")
        assert r.json()["index"] is True

    def test_ecosystem_has_irenes_world_first(self):
        r = requests.get(f"{BASE_URL}/api/interior-design/content", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d.get("content_version") >= 10
        links = d.get("ecosystem", {}).get("links", [])
        assert links and links[0]["title"] == "Irene's World"
        assert links[0]["href"] == "/design-interior/irenes-world"


class TestPartnerNetworkSchema:
    def test_ecosystem_map_endpoint(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/city-partners/ecosystem-map", timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["semantic_map"]["stage_count"] == 17
        assert "by_partner_type" in d["partner_network"]
        assert "materials_total" in d["catalog"]  # real, may be 0
        assert isinstance(d["gaps"], list)

    def test_create_partner_with_network_fields(self, admin_session):
        import uuid
        email = f"studio_{uuid.uuid4().hex[:8]}@example.com"
        payload = {
            "company": "Test Studio Node", "contact_name": "Test Person",
            "contact_email": email, "city": "Cluj-Napoca",
            "partner_type": "studio", "coverage": "regional", "region": "Transilvania",
            "services": ["design interior"], "design_stages": [8, 9], "brands": [],
        }
        r = admin_session.post(f"{BASE_URL}/api/admin/city-partners", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["partner_type"] == "studio"
        assert d["coverage"] == "regional"
        assert d["region"] == "Transilvania"
        assert d["design_stages"] == [8, 9]
        assert d["projects"] == []
        # cleanup
        admin_session.delete(f"{BASE_URL}/api/admin/city-partners/{d['id']}", timeout=10)

    def test_invalid_partner_type_rejected(self, admin_session):
        import uuid
        payload = {
            "company": "Bad Type", "contact_name": "Valid Name",
            "contact_email": f"bad_{uuid.uuid4().hex[:8]}@example.com", "city": "Cluj",
            "partner_type": "not_a_type",
        }
        r = admin_session.post(f"{BASE_URL}/api/admin/city-partners", json=payload, timeout=15)
        assert r.status_code == 400
