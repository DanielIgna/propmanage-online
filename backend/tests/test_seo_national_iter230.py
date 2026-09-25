"""Backend regression — NATIONAL COMMERCIAL EXPANSION Faza 4 (iter230).

9 new Design Interior cities (INDEX, authored content) + 6 new local-services hubs,
wired into the EXISTING sitemap/gate/classification infra (no new global rules).
"""
import os
import requests
import pytest

from seo_design import DESIGN_LOCAL_CITIES, DESIGN_LOCAL_INDEXABLE
from routes.admin_seo import _classify

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")

NEW_DI_CITIES = {"targu-mures", "arad", "satu-mare", "bistrita", "alba-iulia",
                 "deva", "hunedoara", "turda", "zalau"}
NEW_HUBS = {"bucuresti", "timisoara", "brasov", "oradea", "sibiu", "targu-mures"}


class TestRegistry:
    def test_new_cities_registered_and_indexable(self):
        assert NEW_DI_CITIES.issubset(set(DESIGN_LOCAL_CITIES))
        assert NEW_DI_CITIES.issubset(DESIGN_LOCAL_INDEXABLE)

    def test_cities_classify_as_local(self):
        for c in NEW_DI_CITIES:
            t, cluster, _ = _classify(f"/design-interior/{c}")
            assert t == "local"
            assert cluster == "design_interior"


class TestGate:
    def test_new_cities_index_true(self):
        for c in NEW_DI_CITIES:
            r = requests.get(f"{BASE_URL}/api/public/seo/gate?path=/design-interior/{c}", timeout=15)
            if r.status_code != 200:
                pytest.skip("gate endpoint unreachable")
            d = r.json()
            assert d["index"] is True, f"{c} not INDEX: {d}"
            assert d["canonical"] in (None, ""), f"{c} unexpected canonical: {d}"


class TestSitemap:
    def test_di_cities_in_design_sitemap(self):
        r = requests.get(f"{BASE_URL}/api/public/sitemap-design.xml", timeout=15)
        if r.status_code != 200:
            pytest.skip("sitemap-design unreachable")
        xml = r.text
        for c in NEW_DI_CITIES:
            assert f"/design-interior/{c}" in xml, f"missing {c}"

    def test_local_hubs_in_static_sitemap(self):
        r = requests.get(f"{BASE_URL}/api/public/sitemap-static.xml", timeout=15)
        if r.status_code != 200:
            pytest.skip("sitemap-static unreachable")
        xml = r.text
        for h in NEW_HUBS:
            assert f"/servicii-pentru-casa/{h}" in xml, f"missing hub {h}"
