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

PW_PYTHON = "/opt/plugins-venv/bin/python"
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
        "written_to_run": written,
    }
    return {"results": results, "summary": summary}
