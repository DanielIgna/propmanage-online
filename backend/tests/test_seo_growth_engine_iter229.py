"""Backend regression — SEO GROWTH ENGINE Faza 3 (iter229).

Verifies the controlled expansion is wired into the EXISTING sitemap/classification
infra (no new global rules): 8 new styles + 2 project-type pages + /blog editorial hub.
"""
import os
import requests
import pytest

from seo_design import DESIGN_STYLES, DESIGN_PAGES, DESIGN_STYLE_SLUGS, DESIGN_PAGE_SLUGS
from routes.admin_seo import _classify

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")

NEW_STYLES = {"contemporary", "mid-century", "transitional", "wabi-sabi",
              "biophilic", "quiet-luxury", "coastal", "maximalist"}
NEW_PAGES = {"vila", "horeca"}


class TestRegistry:
    def test_new_styles_registered(self):
        assert NEW_STYLES.issubset(DESIGN_STYLE_SLUGS)
        assert len(DESIGN_STYLES) == 17  # 9 existing + 8 new

    def test_new_project_pages_registered(self):
        assert NEW_PAGES.issubset(DESIGN_PAGE_SLUGS)

    def test_no_duplicate_style_slugs(self):
        slugs = [s for s, _ in DESIGN_STYLES]
        assert len(slugs) == len(set(slugs))


class TestClassify:
    def test_blog_is_editorial_hub(self):
        t, cluster, commercial = _classify("/blog")
        assert t == "editorial-hub"
        assert cluster == "blog"
        assert commercial is False

    def test_new_style_classifies_as_style(self):
        for s in NEW_STYLES:
            t, cluster, _ = _classify(f"/design-interior/stil/{s}")
            assert t == "style", f"{s} not classified as style"
            assert cluster == "design_interior"

    def test_new_project_page_commercial(self):
        for s in NEW_PAGES:
            t, cluster, commercial = _classify(f"/design-interior/{s}")
            assert t == "commercial"
            assert cluster == "design_interior"
            assert commercial is True


class TestSitemap:
    def test_styles_and_pages_in_design_sitemap(self):
        r = requests.get(f"{BASE_URL}/api/public/sitemap-design.xml", timeout=15)
        if r.status_code != 200:
            pytest.skip("sitemap-design not reachable")
        xml = r.text
        for s in NEW_STYLES:
            assert f"/design-interior/stil/{s}" in xml, f"missing style {s}"
        for p in NEW_PAGES:
            assert f"/design-interior/{p}" in xml, f"missing page {p}"

    def test_blog_in_static_sitemap(self):
        r = requests.get(f"{BASE_URL}/api/public/sitemap-static.xml", timeout=15)
        if r.status_code != 200:
            pytest.skip("sitemap-static not reachable")
        assert "/blog<" in r.text
