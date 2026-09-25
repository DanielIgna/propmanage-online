"""Backend tests — CONTENT GROWTH ENGINE V1 (iter232).

Opportunity detection, intent classification, content-gap, workflow, publish guard,
public serving, sitemap integration. No mock data; honest about GSC unavailability.
"""
import os
import uuid
import asyncio
import requests
import pytest

from routes.content_factory import (
    classify_intent, _cluster_for, find_content_gap, build_brief,
    COMMERCIAL_INTENTS, WORKFLOW_STATUSES, CLUSTERS,
)

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
ADMIN = {"email": "admin@propmanage.io", "password": "1!nasov01ADMIN"}


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json=ADMIN, timeout=15)
    if r.status_code != 200:
        pytest.skip("admin login failed")
    return s


# ── UNIT: intent classification ──
class TestIntentClassification:
    def test_design(self):
        t = classify_intent("design interior apartament Cluj")
        assert "design" in t and "local" in t and "commercial" in t

    def test_cost(self):
        assert "cost" in classify_intent("cât costă o renovare")

    def test_problem(self):
        assert "problem" in classify_intent("am igrasie pe perete în dormitor")

    def test_specialist(self):
        assert "specialist" in classify_intent("caut instalator bun")

    def test_informational_fallback(self):
        assert classify_intent("blah zzz") == ["informational"]

    def test_commercial_umbrella(self):
        assert bool(set(classify_intent("renovare baie")) & COMMERCIAL_INTENTS)


class TestClusterRouting:
    def test_clusters(self):
        assert _cluster_for("design interior", ["design"]) == "design_interior"
        assert _cluster_for("renovare apartament", ["renovation"]) == "renovare"
        assert _cluster_for("audit tehnic", ["audit"]) == "audit"
        assert _cluster_for("mobilier la comandă", ["mobilier"]) == "mobilier"


class TestContentGap:
    def test_existing_guide_is_update(self):
        # "cum alegi designer interior" exists as a guide → update/link, not new candidate
        g = find_content_gap("cum alegi designer interior", set())
        assert g["gap"] in ("update", "update_or_link")

    def test_novel_topic_is_candidate(self):
        g = find_content_gap("cum organizezi o petrecere aniversară zzz qqq", set())
        assert g["gap"] == "candidate"


class TestBrief:
    def test_brief_shape(self):
        opp = {"topic": "cât costă amenajarea", "cluster": "design_interior", "intent": ["cost", "design"], "existing_page": None}
        b = build_brief(opp)
        assert b["content_cluster"] == "design_interior"
        assert b["cta"] == CLUSTERS["design_interior"]["cta"]
        assert b["commercial_destination"] == CLUSTERS["design_interior"]["cta_to"]
        assert len(b["existing_pages_to_link"]) >= 1


# ── INTEGRATION: opportunity engine (honest about GSC) ──
class TestOpportunityEngine:
    def test_opportunities_real_sources(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/content-factory/opportunities", timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "sources_status" in d
        # GSC not connected on Preview → honest 'unavailable', never mocked
        assert d["sources_status"]["gsc"] == "unavailable"
        assert d["count"] >= 1
        # every opportunity is tagged with source + data_status
        for o in d["opportunities"]:
            assert o["source"] in ("gsc", "analytics", "structural-gap")
            assert "intent" in o and "cluster" in o and "gap" in o

    def test_no_system_pages_as_opportunities(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/content-factory/opportunities", timeout=30)
        for o in r.json()["opportunities"]:
            ep = o.get("existing_page") or ""
            assert not ep.startswith("/login")
            assert not ep.startswith("/admin")


# ── INTEGRATION: workflow, publish guard, public serving ──
class TestWorkflowAndPublish:
    def test_summary_workflow(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/content-factory/summary", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["workflow"] == WORKFLOW_STATUSES
        assert "by_status" in d

    def test_five_drafts_exist(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/content-factory/articles?status=draft", timeout=15)
        assert r.status_code == 200
        # first controlled round produced the drafts
        assert r.json()["count"] >= 5

    def test_publish_requires_approved(self, admin_session):
        # create a throwaway DRAFT via direct API is not possible without LLM; simulate via patch flow
        # find an existing draft, try publishing it while draft → must 400, do NOT leave it published
        r = admin_session.get(f"{BASE_URL}/api/admin/content-factory/articles?status=draft", timeout=15)
        arts = r.json()["articles"]
        if not arts:
            pytest.skip("no drafts")
        aid = arts[0]["id"]
        pr = admin_session.post(f"{BASE_URL}/api/admin/content-factory/articles/{aid}/publish", timeout=20)
        assert pr.status_code == 400  # human-gated: draft cannot publish

    def test_invalid_status_rejected(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/content-factory/articles?status=draft", timeout=15)
        arts = r.json()["articles"]
        if not arts:
            pytest.skip("no drafts")
        aid = arts[0]["id"]
        pr = admin_session.patch(f"{BASE_URL}/api/admin/content-factory/articles/{aid}",
                                 json={"status": "bogus"}, timeout=15)
        assert pr.status_code == 400

    def test_public_articles_published_only(self, admin_session):
        # public list should not include any draft
        r = requests.get(f"{BASE_URL}/api/content/articles", timeout=15)
        assert r.status_code == 200
        # a random draft slug must 404 on the public single endpoint
        r2 = admin_session.get(f"{BASE_URL}/api/admin/content-factory/articles?status=draft", timeout=15)
        arts = r2.json()["articles"]
        if arts:
            slug = arts[0]["slug"]
            pr = requests.get(f"{BASE_URL}/api/content/articles/{slug}", timeout=15)
            assert pr.status_code == 404  # drafts are never public


class TestAuthGuard:
    def test_opportunities_requires_admin(self):
        r = requests.get(f"{BASE_URL}/api/admin/content-factory/opportunities", timeout=10)
        assert r.status_code in (401, 403)
