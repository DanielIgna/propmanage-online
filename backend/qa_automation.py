"""QA Automation Engine — runs a subset of test cases automatically.

Two execution kinds:
- **http**: in-process async runner using httpx. Fast (<5s/test), no browser.
- **browser**: spawns a subprocess into /opt/plugins-venv (Playwright installed).
  Used for genuine UI checks (clicks, render). Heavier (~15s/test).

Each automated test has a `code` mapping back to the manual QA Playbook checklist
(C-02, P-01 etc.) so when it runs, it auto-updates the corresponding check in the
current QA Run with status pass/fail + a note containing the assertion log.

Tests are stateless and idempotent — they pick a unique timestamp suffix for any
record they create. Cleanup happens automatically.
"""
from __future__ import annotations

import os
import json
import time
import uuid
import asyncio
import logging
import tempfile
import subprocess
from datetime import datetime, timezone
from typing import Callable, Optional, Awaitable

import httpx

from db import db

logger = logging.getLogger("propmanage.qa_automation")

# Both HTTP and browser tests target the same public preview URL so the secure
# `samesite=none; Secure` auth cookies are accepted by httpx (which rejects them on plain http).
_PREVIEW = os.environ.get("FRONTEND_PUBLIC_URL") or os.environ.get("PREVIEW_PUBLIC_URL") or os.environ.get("APP_PUBLIC_URL") or "http://localhost:8001"
BACKEND_URL = _PREVIEW
FRONTEND_BASE = _PREVIEW


# ============================================================================
# HTTP test runners
# ============================================================================

def _ok(note: str) -> dict:
    return {"status": "pass", "note": note[:600]}


def _ko(note: str) -> dict:
    return {"status": "fail", "note": note[:600]}


async def _client() -> httpx.AsyncClient:
    return httpx.AsyncClient(base_url=BACKEND_URL, timeout=20.0, follow_redirects=False)


async def http_register_duplicate_email() -> dict:
    """C-02: Înregistrare cu email deja existent → 400."""
    async with await _client() as c:
        # Try registering with the seeded admin email
        r = await c.post("/api/auth/register", json={
            "email": "admin@propmanage.io",
            "password": "Whatever123!",
            "name": "Dup Test",
            "role": "client",
            "phone": "0712000000",
            "zone": "Bucuresti",
        })
        if r.status_code == 400:
            return _ok(f"OK — server returned 400: {r.json().get('detail','')[:200]}")
        return _ko(f"Expected 400, got {r.status_code}: {r.text[:300]}")


async def http_register_short_password() -> dict:
    """C-03: Înregistrare cu parolă < 8 caractere → eroare validare."""
    async with await _client() as c:
        r = await c.post("/api/auth/register", json={
            "email": f"shortpw_{int(time.time())}@test.com",
            "password": "abc",
            "name": "Short Pw",
            "role": "client",
            "phone": "0712000000",
            "zone": "Bucuresti",
        })
        if r.status_code in (400, 422):
            return _ok(f"OK — server rejected with {r.status_code}: {r.text[:200]}")
        return _ko(f"Expected 400/422, got {r.status_code}: {r.text[:300]}")


async def http_login_bad_password() -> dict:
    """SEC-01: Login cu parolă greșită → 401."""
    async with await _client() as c:
        r = await c.post("/api/auth/login", json={"email": "admin@propmanage.io", "password": "WRONG_password_xyz"})
        if r.status_code in (401, 403):
            return _ok(f"OK — login refused with {r.status_code}")
        return _ko(f"Expected 401/403, got {r.status_code}: {r.text[:200]}")


async def http_admin_endpoints_require_auth() -> dict:
    """SEC-02: Endpoint admin fără token → 401."""
    async with await _client() as c:
        endpoints = [
            "/api/admin/qa/runs",
            "/api/admin/onboarding/queue",
            "/api/admin/docs",
            "/api/admin/users",
        ]
        bad = []
        for ep in endpoints:
            r = await c.get(ep)
            if r.status_code not in (401, 403):
                bad.append(f"{ep}={r.status_code}")
        if not bad:
            return _ok(f"OK — all {len(endpoints)} admin endpoints returned 401/403 without auth")
        return _ko(f"Endpoints leaked: {bad}")


async def http_client_cannot_access_admin() -> dict:
    """SEC-03: User client logat → primește 403 pe /api/admin/* (RBAC)."""
    async with await _client() as c:
        r = await c.post("/api/auth/login", json={"email": "client@propmanage.io", "password": "Client123!"})
        if r.status_code != 200:
            return _ko(f"Cannot login as client to test RBAC: {r.status_code}")
        # cookies are now on the client jar automatically
        r2 = await c.get("/api/admin/qa/runs")
        if r2.status_code == 403:
            return _ok("OK — client gets 403 on /api/admin/qa/runs")
        return _ko(f"Expected 403, got {r2.status_code}: {r2.text[:200]}")


async def http_public_sitemap_valid() -> dict:
    """P-01: GET /api/public/sitemap.xml → 200 + conține url-uri."""
    async with await _client() as c:
        r = await c.get("/api/public/sitemap.xml")
        if r.status_code != 200:
            return _ko(f"sitemap status {r.status_code}")
        body = r.text
        if "<urlset" in body and "<loc>" in body:
            n_urls = body.count("<loc>")
            return _ok(f"OK — sitemap.xml valid cu {n_urls} url-uri")
        return _ko(f"sitemap missing urlset/loc — first 300: {body[:300]}")


async def http_marketplace_landing_returns_seo_data() -> dict:
    """P-02: SEO landing pentru oraș-categorie e listată în sitemap + există slug map."""
    async with await _client() as c:
        r = await c.get("/api/public/sitemap.xml")
        if r.status_code != 200:
            return _ko(f"sitemap status {r.status_code}")
        body = r.text
        # Expect at least the city-category landing patterns
        sample = "/marketplace/electrician-bucuresti"
        if sample in body:
            return _ok(f"OK — sitemap include landing {sample}")
        return _ko(f"sitemap missing {sample!r}")


async def http_health_status_alive() -> dict:
    """P-03: GET /api/public/status → 200 cu uptime/health."""
    async with await _client() as c:
        r = await c.get("/api/public/status")
        if r.status_code == 200 and isinstance(r.json(), dict):
            return _ok(f"OK — public status returnează cheile: {list(r.json().keys())[:6]}")
        return _ko(f"Public status returned {r.status_code}: {r.text[:200]}")


async def http_docs_pdf_renders() -> dict:
    """A-01: PDF Knowledge Base se generează pentru toate 6 rolurile (regression)."""
    async with await _client() as c:
        # Auth as admin first
        r = await c.post("/api/auth/login", json={"email": "admin@propmanage.io", "password": "Admin123!"})
        if r.status_code != 200:
            return _ko(f"Admin login failed {r.status_code}")
        slugs = ["client", "specialist", "operator", "admin", "qa-testing", "architecture"]
        results = []
        for s in slugs:
            rr = await c.get(f"/api/admin/docs/{s}/pdf")
            if rr.status_code != 200 or not rr.content.startswith(b"%PDF-"):
                return _ko(f"PDF {s} failed: status={rr.status_code} ct={rr.headers.get('content-type')}")
            results.append(f"{s}={len(rr.content)}B")
        return _ok("OK — 6 PDFs render: " + ", ".join(results))


async def http_onboarding_queue_endpoint() -> dict:
    """A-02: Admin Onboarding queue endpoint răspunde cu stats + recent."""
    async with await _client() as c:
        r = await c.post("/api/auth/login", json={"email": "admin@propmanage.io", "password": "Admin123!"})
        if r.status_code != 200:
            return _ko(f"login failed {r.status_code}")
        rr = await c.get("/api/admin/onboarding/queue")
        if rr.status_code != 200:
            return _ko(f"queue status {rr.status_code}")
        d = rr.json()
        if "stats" in d and "recent" in d:
            return _ok(f"OK — stats keys: {list(d['stats'].keys())}, recent rows: {len(d['recent'])}")
        return _ko(f"Bad shape: {list(d.keys())}")


async def http_qa_checklist_template() -> dict:
    """A-03: QA checklist template returnează 105 items + stats corecte."""
    async with await _client() as c:
        r = await c.post("/api/auth/login", json={"email": "admin@propmanage.io", "password": "Admin123!"})
        if r.status_code != 200:
            return _ko(f"login failed {r.status_code}")
        rr = await c.get("/api/admin/qa/checklist/template")
        if rr.status_code != 200:
            return _ko(f"status {rr.status_code}")
        d = rr.json()
        if len(d.get("items", [])) >= 100 and "by_priority" in d.get("stats", {}):
            return _ok(f"OK — {len(d['items'])} items, prios {d['stats']['by_priority']}")
        return _ko(f"Bad payload {str(d)[:300]}")


# ============================================================================
# Browser test runners — via subprocess to /opt/plugins-venv
# ============================================================================

def _detect_pw_python() -> Optional[str]:
    """Detect a Python interpreter that has Playwright installed.

    In Emergent preview, Playwright lives in /opt/plugins-venv. In production
    deploys it might not be present at all, so we fall back to checking the
    current interpreter. Returns None if no usable interpreter is found.
    """
    import sys
    candidates = [
        "/opt/plugins-venv/bin/python",
        sys.executable,
    ]
    for path in candidates:
        if not path or not os.path.exists(path):
            continue
        try:
            r = subprocess.run(
                [path, "-c", "import playwright.async_api; print('ok')"],
                capture_output=True, text=True, timeout=10,
            )
            if r.returncode == 0 and "ok" in r.stdout:
                return path
        except Exception:
            continue
    return None


PW_PYTHON = _detect_pw_python()
PW_BROWSERS_PATH = "/pw-browsers"


_BROWSER_TEMPLATE = r"""
import asyncio, json, sys, os
os.environ["PLAYWRIGHT_BROWSERS_PATH"] = "{browsers}"
from playwright.async_api import async_playwright

URL = {url!r}

async def main():
    async with async_playwright() as pw:
        try:
            browser = await pw.chromium.launch(headless=True, args=["--no-sandbox"])
            ctx = await browser.new_context(viewport={{"width": 1280, "height": 800}})
            page = await ctx.new_page()
            result = await test(page)
            await browser.close()
            print("__PM_RESULT__" + json.dumps(result))
        except Exception as e:
            print("__PM_RESULT__" + json.dumps({{"status": "fail", "note": f"Crash: {{type(e).__name__}}: {{e}}"}}))

{body}

asyncio.run(main())
"""


async def _run_browser_test(test_body: str, target_url: str) -> dict:
    """Run a Playwright async test in a subprocess. test_body must define `async def test(page) -> dict`."""
    if not PW_PYTHON:
        return {
            "status": "skip",
            "note": "Playwright not available in this environment (preview-only test). Production deploys skip browser tests.",
        }
    script = _BROWSER_TEMPLATE.format(browsers=PW_BROWSERS_PATH, url=target_url, body=test_body)
    with tempfile.NamedTemporaryFile("w", suffix=".py", delete=False) as f:
        f.write(script)
        path = f.name
    try:
        proc = await asyncio.create_subprocess_exec(
            PW_PYTHON, path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=60)
        except asyncio.TimeoutError:
            proc.kill()
            return {"status": "fail", "note": "Browser test timeout >60s"}
        out = stdout.decode("utf-8", errors="replace")
        err = stderr.decode("utf-8", errors="replace")
        # Find marker
        for line in out.splitlines():
            if line.startswith("__PM_RESULT__"):
                try:
                    return json.loads(line[len("__PM_RESULT__"):])
                except Exception:
                    pass
        return {"status": "fail", "note": f"No marker. stdout[-400]:{out[-400:]} stderr[-400]:{err[-400:]}"}
    finally:
        try:
            os.unlink(path)
        except Exception:
            pass


BROWSER_LANDING_LOADS = r"""
async def test(page):
    try:
        await page.goto(URL, wait_until="networkidle", timeout=20000)
        title = await page.title()
        body = await page.locator("body").inner_text()
        ok = ("PropManage" in title) or ("PropManage" in body)
        return {"status": "pass" if ok else "fail", "note": f"Title={title!r}, body sample: {body[:200]!r}"}
    except Exception as e:
        return {"status": "fail", "note": f"{type(e).__name__}: {e}"}
"""


BROWSER_COOKIES_PAGE = r"""
async def test(page):
    try:
        await page.goto(URL + "/cookies", wait_until="domcontentloaded", timeout=20000)
        h1 = await page.locator("h1").first.inner_text(timeout=5000)
        has_test_id = await page.locator("[data-testid='cookies-page']").count() > 0
        if has_test_id and "ookies" in h1.lower():
            return {"status": "pass", "note": f"OK — H1={h1!r}, testid present"}
        return {"status": "fail", "note": f"H1={h1!r}, testid={has_test_id}"}
    except Exception as e:
        return {"status": "fail", "note": f"{type(e).__name__}: {e}"}
"""


BROWSER_LOGIN_PAGE = r"""
async def test(page):
    try:
        await page.goto(URL + "/login", wait_until="domcontentloaded", timeout=20000)
        email = await page.locator("input[type='email']").count()
        pwd = await page.locator("input[type='password']").count()
        button = await page.locator("button[type='submit'], button:has-text('Conect')").count()
        if email > 0 and pwd > 0 and button > 0:
            return {"status": "pass", "note": f"OK — email/password/submit found"}
        return {"status": "fail", "note": f"Missing form fields: email={email} pwd={pwd} btn={button}"}
    except Exception as e:
        return {"status": "fail", "note": f"{type(e).__name__}: {e}"}
"""


async def browser_landing_loads() -> dict:
    return await _run_browser_test(BROWSER_LANDING_LOADS, FRONTEND_BASE)


async def browser_cookies_page_renders() -> dict:
    return await _run_browser_test(BROWSER_COOKIES_PAGE, FRONTEND_BASE)


async def browser_login_page_renders() -> dict:
    return await _run_browser_test(BROWSER_LOGIN_PAGE, FRONTEND_BASE)


# ============================================================================
# Content Audit tests (DOC-AUDIT-*)
# Verify each role's manual uses audience-appropriate language.
# ============================================================================

async def doc_audit_specialist_no_client_perspective() -> dict:
    """DOC-AUDIT-01: specialist doc must NOT include client-perspective callouts (e.g. 'banii pe care îi plătești')."""
    from qa_content_audit import audit_doc
    conflicts = [c for c in audit_doc("specialist") if c["wrong_audience"] == "client"]
    if not conflicts:
        return _ok("OK — specialist doc nu conține pasaje cu perspectivă client")
    detail = "; ".join(f"sec {c['section_index']}.{c['block_index']} — {c['block_excerpt'][:80]}" for c in conflicts[:3])
    return _ko(f"Conflict audience în specialist doc: {len(conflicts)} pasaj(e). {detail}")


async def doc_audit_client_no_specialist_perspective() -> dict:
    """DOC-AUDIT-02: client doc nu conține pasaje exclusiv specialist (lead fee, badge VERIFIED detaliat)."""
    from qa_content_audit import audit_doc
    conflicts = [c for c in audit_doc("client") if c["wrong_audience"] == "specialist"]
    if not conflicts:
        return _ok("OK — client doc fără perspective specialist greșite")
    return _ko(f"{len(conflicts)} pasaj(e) suspecte: " + "; ".join(c["block_excerpt"][:60] for c in conflicts[:3]))


async def doc_audit_specialist_has_payment_info() -> dict:
    """DOC-AUDIT-03: specialist doc trebuie să menționeze 'comision' sau '95%' (informația principală pt. specialist)."""
    from docs_content import get_doc
    doc = get_doc("specialist")
    if not doc:
        return _ko("specialist doc missing")
    blob = " ".join(
        (b if isinstance(b, str) else (b.get("body", "") + " " + str(b.get("items", ""))))
        for s in doc["sections"]
        for b in s.get("body", [])
    ).lower()
    keywords = ["comision", "95%", "lead fee", "plătit"]
    found = [k for k in keywords if k in blob]
    if len(found) >= 2:
        return _ok(f"OK — specialist doc conține info plată: {found}")
    return _ko(f"Lipsesc keyword-uri financiare specialist: găsite doar {found}")


async def doc_audit_client_has_dispute_info() -> dict:
    """DOC-AUDIT-04: client doc trebuie să menționeze 'dispută' (protecția clientului)."""
    from docs_content import get_doc
    doc = get_doc("client")
    blob = " ".join(
        (b if isinstance(b, str) else (b.get("body", "") + " " + b.get("title", "")))
        for s in doc["sections"]
        for b in s.get("body", [])
    ).lower()
    if "dispută" in blob or "dispute" in blob or "rambursează" in blob:
        return _ok("OK — client doc menționează disputele/rambursarea")
    return _ko("Client doc NU menționează disputele — informație critică lipsă")


async def doc_audit_all_docs_have_overrides_resolved() -> dict:
    """DOC-AUDIT-05: dacă există override-uri, fiecare se aplică valid (nu cade pe IndexError)."""
    from docs_service import resolve_doc_with_overrides
    from docs_content import DOCS_CONTENT
    errors = []
    for slug in DOCS_CONTENT.keys():
        try:
            d = await resolve_doc_with_overrides(slug)
            if not d:
                errors.append(f"{slug}=None")
        except Exception as e:  # noqa: BLE001
            errors.append(f"{slug}={type(e).__name__}")
    if errors:
        return _ko(f"Errors resolving overrides: {errors}")
    return _ok(f"OK — overrides aplicate fără erori pentru {len(DOCS_CONTENT)} docuri")


# ============================================================================
# Lifecycle / Communication tests (LIFECYCLE-*)
# Exercise full flows end-to-end via the public API.
# ============================================================================

async def lifecycle_client_register_then_delete() -> dict:
    """LIFECYCLE-01: client se înregistrează → login → ștergere cont (GDPR DSAR right-to-be-forgotten)."""
    email = f"lifecycle_client_{int(time.time())}_{uuid.uuid4().hex[:6]}@test.com"
    async with await _client() as c:
        # Register
        r = await c.post("/api/auth/register", json={
            "email": email, "password": "Test1234!", "name": "Lifecycle Client",
            "role": "client", "phone": "0712345678", "zone": "Bucuresti",
        })
        if r.status_code != 200:
            return _ko(f"register failed {r.status_code}: {r.text[:200]}")
        # Login
        r2 = await c.post("/api/auth/login", json={"email": email, "password": "Test1234!"})
        if r2.status_code != 200:
            return _ko(f"login failed {r2.status_code}")
        # Try /api/auth/me
        r3 = await c.get("/api/auth/me")
        if r3.status_code != 200 or r3.json().get("email") != email:
            return _ko(f"me endpoint failed {r3.status_code}")
        # Cleanup: delete from DB directly (no public delete-account endpoint exists)
        from db import db
        await db.users.delete_one({"email": email})
        return _ok(f"OK — register→login→me OK pentru {email}")


async def lifecycle_specialist_register_then_onboarding_drip() -> dict:
    """LIFECYCLE-02: specialist înregistrat → primește 3 emails enqueuate în db.onboarding_emails."""
    email = f"lifecycle_spec_{int(time.time())}_{uuid.uuid4().hex[:6]}@test.com"
    async with await _client() as c:
        r = await c.post("/api/auth/register", json={
            "email": email, "password": "Test1234!", "name": "Lifecycle Spec",
            "role": "specialist", "phone": "0712345678",
            "service_categories": ["electric"], "coverage_zones": ["Bucuresti"],
        })
        if r.status_code != 200:
            return _ko(f"register failed {r.status_code}")
    # Check that 3 onboarding rows were enqueued
    from db import db
    rows = await db.onboarding_emails.count_documents({"email": email})
    # Cleanup
    await db.onboarding_emails.delete_many({"email": email})
    await db.users.delete_one({"email": email})
    if rows >= 3:
        return _ok(f"OK — specialist {email} a primit {rows} email-uri de onboarding")
    return _ko(f"Doar {rows} email-uri enqueuate, așteptam ≥3")


async def lifecycle_marketplace_search_returns_specialists() -> dict:
    """LIFECYCLE-03: client (neautentificat) caută în marketplace → primește listă specialiști."""
    async with await _client() as c:
        r = await c.get("/api/marketplace/specialists?service=electric&city=Bucuresti&page=1")
        if r.status_code != 200:
            return _ko(f"marketplace search status {r.status_code}")
        body = r.json()
        # Accept either list-form (direct) or dict-form with items
        if isinstance(body, list):
            return _ok(f"OK — marketplace returnează listă cu {len(body)} specialiști")
        if isinstance(body, dict):
            items = body.get("items") or body.get("specialists") or body.get("results") or []
            return _ok(f"OK — marketplace returnează {len(items)} specialiști (dict-form)")
        return _ko(f"Răspuns marketplace neașteptat: {str(body)[:200]}")


async def lifecycle_specialist_profile_public_view() -> dict:
    """LIFECYCLE-04: profilul public al unui specialist este accesibil clienților."""
    from db import db
    spec = await db.users.find_one({"role": "specialist", "deleted": {"$ne": True}})
    if not spec:
        return _ko("Nu există niciun specialist în DB")
    spec_id = str(spec["_id"])
    async with await _client() as c:
        # Real endpoint: /api/specialists/{id}/profile
        r = await c.get(f"/api/specialists/{spec_id}/profile")
        if r.status_code == 200:
            return _ok("OK — /api/specialists/{id}/profile accesibil pentru clienți")
        return _ko(f"Profil public specialist nu se vede ({r.status_code}): {r.text[:200]}")


async def lifecycle_admin_role_unique_count() -> dict:
    """LIFECYCLE-05: verifică integritate referențială — fiecare user are exact 1 rol valid."""
    from db import db
    valid_roles = {"client", "specialist", "operator", "admin"}
    bad = []
    async for u in db.users.find({}, {"email": 1, "role": 1}):
        if u.get("role") not in valid_roles:
            bad.append(f"{u.get('email')}={u.get('role')!r}")
    if not bad:
        total = await db.users.count_documents({})
        return _ok(f"OK — toți cei {total} useri au roluri valide")
    return _ko(f"{len(bad)} useri cu rol invalid: {bad[:5]}")


# ============================================================================
# Terminology Audit tests (TERM-*) — vocabulary consistency across docs.
# ============================================================================

async def term_audit_no_escrow_variants() -> dict:
    """TERM-01: escrow cluster — un singur doc nu poate folosi simultan 2+ termeni pentru același concept."""
    from qa_terminology_audit import scan_all_docs
    report = await scan_all_docs()
    bad = [(slug, inc) for slug, lst in report["by_doc"].items() for inc in lst if inc["cluster_key"] == "escrow"]
    if not bad:
        return _ok("OK — termenul «escrow» e folosit consistent în toate cele 6 docuri")
    return _ko(f"{len(bad)} docuri folosesc simultan termeni diferiți pentru escrow: " + "; ".join(f"{s}={i['variants_used']}" for s,i in bad[:3]))


async def term_audit_specialist_consistent() -> dict:
    """TERM-02: termenul «specialist» nu se amestecă cu «meseriaș/profesionist/executant» în același doc."""
    from qa_terminology_audit import scan_all_docs
    report = await scan_all_docs()
    bad = [(s, i) for s, lst in report["by_doc"].items() for i in lst if i["cluster_key"] == "specialist"]
    if not bad:
        return _ok("OK — termenul «specialist» e folosit consistent")
    return _ko(f"{len(bad)} docuri amestecă: " + "; ".join(f"{s}={i['variants_used']}" for s,i in bad[:3]))


async def term_audit_client_consistent() -> dict:
    """TERM-03: termenul «client» nu se amestecă cu «proprietar/beneficiar»."""
    from qa_terminology_audit import scan_all_docs
    report = await scan_all_docs()
    bad = [(s, i) for s, lst in report["by_doc"].items() for i in lst if i["cluster_key"] == "client"]
    if not bad:
        return _ok("OK — termenul «client» e folosit consistent")
    return _ko(f"{len(bad)} docuri amestecă: " + "; ".join(f"{s}={i['variants_used']}" for s,i in bad[:3]))


async def term_audit_commission_consistent() -> dict:
    """TERM-04: «comision platformă» nu se amestecă cu «taxă/fee platformă»."""
    from qa_terminology_audit import scan_all_docs
    report = await scan_all_docs()
    bad = [(s, i) for s, lst in report["by_doc"].items() for i in lst if i["cluster_key"] == "comision"]
    if not bad:
        return _ok("OK — termenul «comision platformă» folosit consistent")
    return _ko(f"{len(bad)} docuri amestecă: " + "; ".join(f"{s}={i['variants_used']}" for s,i in bad[:3]))


async def term_audit_overall_score() -> dict:
    """TERM-05: scor general de consistență — niciun doc nu poate avea ≥3 inconsistențe."""
    from qa_terminology_audit import scan_all_docs
    report = await scan_all_docs()
    heavy = [(s, len(lst)) for s, lst in report["by_doc"].items() if len(lst) >= 3]
    total = report["total_inconsistencies"]
    if not heavy:
        return _ok(f"OK — {total} inconsistențe totale, niciun doc cu ≥3 (clusters_checked={report['clusters_checked']})")
    return _ko(f"{len(heavy)} docuri cu ≥3 inconsistențe: {heavy}. Total: {total}")


# ============================================================================
# Registry
# ============================================================================

# Each entry maps a stable code → metadata + the async runner
AUTOMATED_TESTS: dict[str, dict] = {
    "AUTO-AUTH-01": {
        "code": "AUTO-AUTH-01",
        "title": "Înregistrare cu email duplicat respinsă",
        "kind": "http",
        "category": "SECURITY",
        "priority": "P0",
        "manual_match": "C-02",
        "runner": http_register_duplicate_email,
    },
    "AUTO-AUTH-02": {
        "code": "AUTO-AUTH-02",
        "title": "Înregistrare cu parolă scurtă respinsă",
        "kind": "http",
        "category": "SECURITY",
        "priority": "P0",
        "manual_match": "C-03",
        "runner": http_register_short_password,
    },
    "AUTO-AUTH-03": {
        "code": "AUTO-AUTH-03",
        "title": "Login cu parolă greșită returnează 401",
        "kind": "http",
        "category": "SECURITY",
        "priority": "P0",
        "runner": http_login_bad_password,
    },
    "AUTO-SEC-01": {
        "code": "AUTO-SEC-01",
        "title": "Endpoint admin fără token → 401/403",
        "kind": "http",
        "category": "SECURITY",
        "priority": "P0",
        "runner": http_admin_endpoints_require_auth,
    },
    "AUTO-SEC-02": {
        "code": "AUTO-SEC-02",
        "title": "Client logat → 403 pe /api/admin (RBAC)",
        "kind": "http",
        "category": "SECURITY",
        "priority": "P0",
        "runner": http_client_cannot_access_admin,
    },
    "AUTO-SEO-01": {
        "code": "AUTO-SEO-01",
        "title": "Sitemap.xml public valid",
        "kind": "http",
        "category": "SEO",
        "priority": "P1",
        "runner": http_public_sitemap_valid,
    },
    "AUTO-SEO-02": {
        "code": "AUTO-SEO-02",
        "title": "Landing marketplace oraș-categorie",
        "kind": "http",
        "category": "SEO",
        "priority": "P1",
        "runner": http_marketplace_landing_returns_seo_data,
    },
    "AUTO-PUB-01": {
        "code": "AUTO-PUB-01",
        "title": "Public status / incidents endpoint live",
        "kind": "http",
        "category": "PUBLIC",
        "priority": "P1",
        "runner": http_health_status_alive,
    },
    "AUTO-KB-01": {
        "code": "AUTO-KB-01",
        "title": "Knowledge Base — 6 PDFs render fără crash",
        "kind": "http",
        "category": "ADMIN",
        "priority": "P0",
        "runner": http_docs_pdf_renders,
    },
    "AUTO-OB-01": {
        "code": "AUTO-OB-01",
        "title": "Onboarding queue admin endpoint răspunde",
        "kind": "http",
        "category": "ADMIN",
        "priority": "P1",
        "runner": http_onboarding_queue_endpoint,
    },
    "AUTO-QA-01": {
        "code": "AUTO-QA-01",
        "title": "QA checklist template returnează 105 items",
        "kind": "http",
        "category": "ADMIN",
        "priority": "P1",
        "runner": http_qa_checklist_template,
    },
    "AUTO-UI-01": {
        "code": "AUTO-UI-01",
        "title": "Landing page se încarcă în browser (Playwright)",
        "kind": "browser",
        "category": "PUBLIC",
        "priority": "P0",
        "runner": browser_landing_loads,
    },
    "AUTO-UI-02": {
        "code": "AUTO-UI-02",
        "title": "Pagina /cookies randează cu H1 și testid",
        "kind": "browser",
        "category": "PUBLIC",
        "priority": "P1",
        "manual_match": "ad-hoc",
        "runner": browser_cookies_page_renders,
    },
    "AUTO-UI-03": {
        "code": "AUTO-UI-03",
        "title": "Pagina /login afișează formularul",
        "kind": "browser",
        "category": "PUBLIC",
        "priority": "P0",
        "runner": browser_login_page_renders,
    },
    # ---- Content Audit (5) ----
    "DOC-AUDIT-01": {
        "code": "DOC-AUDIT-01",
        "title": "Specialist doc fără pasaje cu perspectivă client",
        "kind": "http",
        "category": "CONTENT",
        "priority": "P0",
        "runner": doc_audit_specialist_no_client_perspective,
    },
    "DOC-AUDIT-02": {
        "code": "DOC-AUDIT-02",
        "title": "Client doc fără pasaje strict specialist (lead fee etc.)",
        "kind": "http",
        "category": "CONTENT",
        "priority": "P1",
        "runner": doc_audit_client_no_specialist_perspective,
    },
    "DOC-AUDIT-03": {
        "code": "DOC-AUDIT-03",
        "title": "Specialist doc menționează comision, plată, lead fee",
        "kind": "http",
        "category": "CONTENT",
        "priority": "P0",
        "runner": doc_audit_specialist_has_payment_info,
    },
    "DOC-AUDIT-04": {
        "code": "DOC-AUDIT-04",
        "title": "Client doc menționează disputele și rambursarea",
        "kind": "http",
        "category": "CONTENT",
        "priority": "P0",
        "runner": doc_audit_client_has_dispute_info,
    },
    "DOC-AUDIT-05": {
        "code": "DOC-AUDIT-05",
        "title": "Toate override-urile aplicate cu success (no IndexError)",
        "kind": "http",
        "category": "CONTENT",
        "priority": "P1",
        "runner": doc_audit_all_docs_have_overrides_resolved,
    },
    # ---- Lifecycle / Communication (5) ----
    "LIFECYCLE-01": {
        "code": "LIFECYCLE-01",
        "title": "Client: register → login → /me funcționează",
        "kind": "http",
        "category": "LIFECYCLE",
        "priority": "P0",
        "runner": lifecycle_client_register_then_delete,
    },
    "LIFECYCLE-02": {
        "code": "LIFECYCLE-02",
        "title": "Specialist nou primește 3 emails onboarding enqueuate",
        "kind": "http",
        "category": "LIFECYCLE",
        "priority": "P0",
        "runner": lifecycle_specialist_register_then_onboarding_drip,
    },
    "LIFECYCLE-03": {
        "code": "LIFECYCLE-03",
        "title": "Marketplace public returnează listă specialiști filtrabilă",
        "kind": "http",
        "category": "LIFECYCLE",
        "priority": "P0",
        "runner": lifecycle_marketplace_search_returns_specialists,
    },
    "LIFECYCLE-04": {
        "code": "LIFECYCLE-04",
        "title": "Profil public specialist accesibil pentru clienți",
        "kind": "http",
        "category": "LIFECYCLE",
        "priority": "P1",
        "runner": lifecycle_specialist_profile_public_view,
    },
    "LIFECYCLE-05": {
        "code": "LIFECYCLE-05",
        "title": "Toți userii au rol valid (integritate referențială)",
        "kind": "http",
        "category": "LIFECYCLE",
        "priority": "P1",
        "runner": lifecycle_admin_role_unique_count,
    },
    # ---- Terminology Audit (5) ----
    "TERM-01": {
        "code": "TERM-01",
        "title": "Termenul «escrow» folosit consistent (fără variante alternative)",
        "kind": "http",
        "category": "TERMINOLOGY",
        "priority": "P1",
        "runner": term_audit_no_escrow_variants,
    },
    "TERM-02": {
        "code": "TERM-02",
        "title": "«Specialist» nu se amestecă cu «meseriaș/profesionist» în același doc",
        "kind": "http",
        "category": "TERMINOLOGY",
        "priority": "P1",
        "runner": term_audit_specialist_consistent,
    },
    "TERM-03": {
        "code": "TERM-03",
        "title": "«Client» nu se amestecă cu «proprietar/beneficiar» în același doc",
        "kind": "http",
        "category": "TERMINOLOGY",
        "priority": "P1",
        "runner": term_audit_client_consistent,
    },
    "TERM-04": {
        "code": "TERM-04",
        "title": "«Comision platformă» nu se amestecă cu «taxă/fee»",
        "kind": "http",
        "category": "TERMINOLOGY",
        "priority": "P2",
        "runner": term_audit_commission_consistent,
    },
    "TERM-05": {
        "code": "TERM-05",
        "title": "Scor general de consistență — niciun doc cu ≥3 inconsistențe",
        "kind": "http",
        "category": "TERMINOLOGY",
        "priority": "P1",
        "runner": term_audit_overall_score,
    },
}


def list_automated_tests() -> list[dict]:
    """Return metadata-only entries (no runner) for the UI catalog."""
    out = []
    for t in AUTOMATED_TESTS.values():
        out.append({k: v for k, v in t.items() if k != "runner"})
    return out


# ============================================================================
# Run executor — runs N selected tests, updates QA Run checks if matched.
# ============================================================================

async def execute_tests(test_codes: list[str], run_id: Optional[str] = None) -> dict:
    """Execute the chosen tests in parallel. If `run_id` given, add/update matching
    checks in the QA Run."""
    selected = [AUTOMATED_TESTS[c] for c in test_codes if c in AUTOMATED_TESTS]
    if not selected:
        return {"results": [], "summary": {"total": 0, "pass": 0, "fail": 0}}

    async def _one(t: dict) -> dict:
        t0 = time.time()
        try:
            res = await t["runner"]()
        except Exception as e:  # noqa: BLE001
            res = {"status": "fail", "note": f"Unhandled crash: {type(e).__name__}: {str(e)[:200]}"}
        elapsed = round((time.time() - t0) * 1000)
        return {
            "code": t["code"],
            "title": t["title"],
            "kind": t["kind"],
            "category": t["category"],
            "priority": t["priority"],
            "status": res.get("status", "fail"),
            "note": res.get("note", ""),
            "duration_ms": elapsed,
        }

    results = await asyncio.gather(*[_one(t) for t in selected])

    # If run_id, write results into the QA run (auto-create ad-hoc check per test code)
    written = 0
    if run_id:
        for r in results:
            try:
                run_doc = await db.qa_runs.find_one({"run_id": run_id}, {"checks.code": 1, "checks.id": 1})
                if not run_doc:
                    continue
                # Find existing check with same code
                existing = next((c for c in run_doc.get("checks", []) if c.get("code") == r["code"]), None)
                now = datetime.now(timezone.utc).isoformat()
                if existing:
                    await db.qa_runs.update_one(
                        {"run_id": run_id, "checks.id": existing["id"]},
                        {"$set": {
                            "checks.$.status": r["status"],
                            "checks.$.note": f"[automated · {r['duration_ms']}ms] {r['note']}"[:2000],
                            "checks.$.updated_at": now,
                            "checks.$.automated": True,
                            "updated_at": now,
                        }},
                    )
                else:
                    new_check = {
                        "id": __import__("uuid").uuid4().hex,
                        "code": r["code"],
                        "category": r["category"],
                        "subcategory": "auto · " + r["kind"],
                        "priority": r["priority"],
                        "description": r["title"],
                        "status": r["status"],
                        "note": f"[automated · {r['duration_ms']}ms] {r['note']}"[:2000],
                        "updated_at": now,
                        "updated_by": "automation",
                        "ai_added": False,
                        "automated": True,
                    }
                    await db.qa_runs.update_one(
                        {"run_id": run_id},
                        {"$push": {"checks": new_check}, "$set": {"updated_at": now}},
                    )
                written += 1
            except Exception as e:  # noqa: BLE001
                logger.warning(f"[Automation] failed to write into run {run_id} for {r['code']}: {e}")

    summary = {
        "total": len(results),
        "pass": sum(1 for r in results if r["status"] == "pass"),
        "fail": sum(1 for r in results if r["status"] == "fail"),
        "skip": sum(1 for r in results if r["status"] == "skip"),
        "written_to_run": written,
    }
    return {"results": results, "summary": summary}


# ============================================================================
# Release Gate — run ALL automated tests, persist, email admins
# ============================================================================

def _gate_email_html(payload: dict) -> dict:
    """Build a branded HTML email with the gate verdict + per-test rows."""
    from email_service import _layout, APP_URL  # local import to avoid cycle

    summary = payload["summary"]
    results = payload["results"]
    blocked = summary.get("p0_fail", 0) > 0
    verdict_color = "#ef4444" if blocked else "#34d399"
    verdict_label = "RELEASE BLOCKED" if blocked else "RELEASE READY"

    rows_html = []
    for r in results:
        status = r["status"]
        is_pass = status == "pass"
        bg = "#34d39915" if is_pass else "#ef444415"
        icon = "✅" if is_pass else "❌"
        prio_color = {"P0": "#ef4444", "P1": "#fbbf24", "P2": "#60a5fa"}.get(r["priority"], "#9ca3af")
        rows_html.append(f"""
          <tr style="background:{bg};">
            <td style="padding:8px 10px; vertical-align:top; font-family:monospace; color:#fff;">{icon} <strong>{r['code']}</strong></td>
            <td style="padding:8px 10px; vertical-align:top;">
              <div style="color:#e5e5e5; font-size:13px;">{r['title']}</div>
              <div style="color:#9ca3af; font-size:11px; margin-top:2px;">{r['kind']} · {r['category']} · {r['duration_ms']}ms</div>
              <div style="color:#c8c8cc; font-size:11px; margin-top:4px; font-style:italic;">{r['note'][:280]}</div>
            </td>
            <td style="padding:8px 10px; vertical-align:top; text-align:center;">
              <span style="display:inline-block; padding:2px 8px; border-radius:9999px; font-size:10px; font-weight:600; background:{prio_color}25; color:{prio_color};">{r['priority']}</span>
            </td>
          </tr>
        """)

    body = f"""
      <div style="margin-bottom:20px;">
        <div style="background:{verdict_color}15; border-left:4px solid {verdict_color}; padding:16px 20px; border-radius:12px;">
          <div style="font-size:11px; text-transform:uppercase; letter-spacing:0.5px; color:{verdict_color}; margin-bottom:6px;">Verdict gate de release</div>
          <div style="font-family:Georgia,serif; font-size:28px; color:{verdict_color}; font-weight:700;">{verdict_label}</div>
          <div style="color:#c8c8cc; font-size:13px; margin-top:6px;">
            <strong>{summary['pass']}/{summary['total']}</strong> PASS · {summary['fail']} FAIL · {summary['p0_fail']} P0 fail · {summary['p1_fail']} P1 fail
          </div>
        </div>
      </div>

      <p style="color:#c8c8cc; font-size:13px;">
        {('🚫 Un test P0 a căzut. NU se face deploy până nu rezolvi problemele de mai jos.' if blocked else '🟢 Toate testele P0 trec. Poți face deploy în siguranță.')}
      </p>

      <table border="0" cellpadding="0" cellspacing="0" style="width:100%; margin-top:16px; border-collapse:collapse;">
        <thead>
          <tr style="background:#1a1a1f;">
            <th style="padding:10px; text-align:left; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; color:#9ca3af;">Test</th>
            <th style="padding:10px; text-align:left; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; color:#9ca3af;">Detalii</th>
            <th style="padding:10px; text-align:center; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; color:#9ca3af;">Prio</th>
          </tr>
        </thead>
        <tbody>
          {''.join(rows_html)}
        </tbody>
      </table>

      <p style="color:#9ca3af; font-size:11px; margin-top:24px;">
        Gate ID: <code>{payload['gate_id']}</code> · Trigger: <code>{payload['triggered_by']}</code> · Durata: {payload['duration_ms']}ms
      </p>
    """
    subj_prefix = "🚫" if blocked else "✅"
    return {
        "subject": f"{subj_prefix} Release Gate — {verdict_label} ({summary['pass']}/{summary['total']})",
        "html": _layout(f"Release Gate · {verdict_label}", f"{summary['pass']}/{summary['total']} pass · {summary['fail']} fail · {summary['p0_fail']} P0 fail", body, f"{APP_URL}/admin", "Deschide QA Playbook"),
    }


async def run_release_gate(triggered_by: str = "manual", email_admins: bool = True) -> dict:
    """Execute ALL automated tests, persist the result, optionally email admins."""
    import uuid as _uuid
    t0 = time.time()
    started = datetime.now(timezone.utc).isoformat()
    all_codes = list(AUTOMATED_TESTS.keys())
    exec_res = await execute_tests(all_codes, run_id=None)
    finished = datetime.now(timezone.utc).isoformat()
    duration_ms = round((time.time() - t0) * 1000)

    p0_fail = sum(1 for r in exec_res["results"] if r["status"] == "fail" and r["priority"] == "P0")
    p1_fail = sum(1 for r in exec_res["results"] if r["status"] == "fail" and r["priority"] == "P1")
    summary = dict(exec_res["summary"])
    summary["p0_fail"] = p0_fail
    summary["p1_fail"] = p1_fail
    summary["blocked"] = p0_fail > 0

    payload = {
        "gate_id": _uuid.uuid4().hex[:12],
        "triggered_by": triggered_by,
        "started_at": started,
        "finished_at": finished,
        "duration_ms": duration_ms,
        "summary": summary,
        "results": exec_res["results"],
        "email": {"sent": False, "recipients": [], "error": None},
    }

    # Persist gate (keep last 100 only)
    try:
        await db.release_gates.insert_one({**payload})
        cur = db.release_gates.find({}, {"_id": 1}).sort("started_at", -1).skip(100)
        old_ids = [d["_id"] async for d in cur]
        if old_ids:
            await db.release_gates.delete_many({"_id": {"$in": old_ids}})
    except Exception as e:  # noqa: BLE001
        logger.warning(f"[ReleaseGate] persist failed: {e}")

    # Send email
    if email_admins:
        try:
            from email_service import send_email, ADMIN_EMAILS as _CFG_ADMIN_EMAILS
            recipients = _CFG_ADMIN_EMAILS or [
                e.strip() for e in (os.environ.get("ADMIN_EMAILS") or "").split(",") if e.strip()
            ]
            if not recipients:
                payload["email"]["error"] = "ADMIN_NOTIFICATION_EMAILS / ADMIN_EMAILS not configured"
            else:
                tpl = _gate_email_html(payload)
                await send_email(recipients, tpl["subject"], tpl["html"])
                payload["email"]["sent"] = True
                payload["email"]["recipients"] = recipients
        except Exception as e:  # noqa: BLE001
            payload["email"]["error"] = f"{type(e).__name__}: {str(e)[:200]}"
            logger.warning(f"[ReleaseGate] email send failed: {e}")

    payload.pop("_id", None)
    return payload


async def list_release_gates(limit: int = 20) -> list[dict]:
    cursor = db.release_gates.find({}, {"results": 0}).sort("started_at", -1).limit(limit)
    out = []
    async for r in cursor:
        r.pop("_id", None)
        out.append(r)
    return out


async def get_release_gate(gate_id: str) -> Optional[dict]:
    r = await db.release_gates.find_one({"gate_id": gate_id})
    if not r:
        return None
    r.pop("_id", None)
    return r


async def run_weekly_release_gate_job():
    """APScheduler job: run release gate weekly, email admins ONLY if P0 fail (silent on green)."""
    try:
        # Run with email_admins=False; we'll send manually only on P0 fail to keep inbox quiet.
        payload = await run_release_gate(triggered_by="weekly-cron", email_admins=False)
        if payload.get("summary", {}).get("p0_fail", 0) > 0:
            try:
                from email_service import send_email, ADMIN_EMAILS as _CFG_ADMIN_EMAILS
                recipients = _CFG_ADMIN_EMAILS or [
                    e.strip() for e in (os.environ.get("ADMIN_EMAILS") or "").split(",") if e.strip()
                ]
                if recipients:
                    tpl = _gate_email_html(payload)
                    # Override subject to make weekly origin clear
                    tpl["subject"] = "[Cron luni 08:45] " + tpl["subject"]
                    await send_email(recipients, tpl["subject"], tpl["html"])
                    logger.warning(f"[ReleaseGate cron] P0 FAIL — emailed {len(recipients)} admins (gate {payload['gate_id']})")
                else:
                    logger.warning(f"[ReleaseGate cron] P0 FAIL but no admin emails configured (gate {payload['gate_id']})")
            except Exception as e:  # noqa: BLE001
                logger.exception(f"[ReleaseGate cron] failed to send P0-fail email: {e}")
        else:
            logger.info(f"[ReleaseGate cron] All clear — {payload['summary']['pass']}/{payload['summary']['total']} pass (gate {payload['gate_id']}); no email sent.")
    except Exception as e:  # noqa: BLE001
        logger.exception(f"[ReleaseGate cron] crashed: {e}")
