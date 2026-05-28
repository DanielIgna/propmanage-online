"""PropManage — Admin Smoke Test (E2E health probe)

Runs a sequence of real API calls against the live backend to verify the
critical user flow is healthy (login → me → create property → list → delete
→ logout). Results are stored in `db.smoke_test_runs` for history.

Triggered manually by admin from AI Investigator panel. Designed to be safe to
run repeatedly — uses an isolated demo client account, marks created data with
a `[SMOKE]` prefix, and cleans up after itself.
"""
import os
import time
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, List

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query

from db import db
from deps import require_role

logger = logging.getLogger("propmanage.admin_smoketest")
router = APIRouter(prefix="/api/admin/smoke-test", tags=["admin-smoketest"])

# Demo credentials used for the smoke test. These must always exist (seed) and
# are reset nightly by demo_reset.py, so a smoke test never corrupts real data.
SMOKE_EMAIL = "client@propmanage.io"
SMOKE_PASSWORD = "Client123!"

# Default base URL preference:
# 1. SMOKE_TEST_BASE_URL (explicit override)
# 2. http://localhost:8001 (safest — tests the backend pod itself, works in both
#    preview and production without depending on external DNS / OAuth whitelist).
# Admin can pass `?base_url=https://propmanage.ro` to test the external prod URL.
DEFAULT_BASE = (
    os.environ.get("SMOKE_TEST_BASE_URL")
    or "http://localhost:8001"
).rstrip("/")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _record_step(steps: List[dict], name: str, started: float, ok: bool,
                       status_code: Optional[int] = None,
                       error: Optional[str] = None,
                       payload: Optional[dict] = None) -> None:
    duration_ms = int((time.perf_counter() - started) * 1000)
    steps.append({
        "name": name,
        "ok": ok,
        "status_code": status_code,
        "duration_ms": duration_ms,
        "error": error,
        "payload": payload,
    })


async def _run_smoke_sequence(base_url: str) -> dict:
    """Runs the full smoke test against `base_url`. Returns a structured report."""
    steps: List[dict] = []
    run_id = str(uuid.uuid4())
    started_at = _now()
    overall_ok = True
    created_property_id: Optional[str] = None
    auth_cookie_header: Optional[str] = None  # raw "Cookie: access_token=..." value

    async with httpx.AsyncClient(
        base_url=base_url,
        timeout=15.0,
        follow_redirects=True,
    ) as cli:
        # === 1. LOGIN ===
        t = time.perf_counter()
        try:
            r = await cli.post(
                "/api/auth/login",
                json={"email": SMOKE_EMAIL, "password": SMOKE_PASSWORD},
            )
            # Extract access_token from Set-Cookie. Backend marks it Secure, which
            # blocks the cookie jar from auto-sending it back over HTTP (localhost).
            # We forward it manually via Cookie header for subsequent requests.
            token = r.cookies.get("access_token")
            ok = r.status_code == 200 and bool(token)
            if ok:
                auth_cookie_header = f"access_token={token}"
            await _record_step(
                steps, "Login (demo client)", t, ok,
                status_code=r.status_code,
                error=None if ok else (r.text[:200] if r.text else "no cookie"),
            )
            if not ok:
                overall_ok = False
                raise RuntimeError("login failed")
        except Exception as e:  # noqa: BLE001
            if not steps or steps[-1]["name"] != "Login (demo client)":
                await _record_step(steps, "Login (demo client)", t, False, error=str(e)[:200])
            overall_ok = False
            return _finalize(run_id, started_at, steps, overall_ok, base_url)

        auth_headers = {"Cookie": auth_cookie_header} if auth_cookie_header else {}

        # === 2. GET /auth/me ===
        t = time.perf_counter()
        try:
            r = await cli.get("/api/auth/me", headers=auth_headers)
            data = r.json() if r.status_code == 200 else {}
            ok = r.status_code == 200 and data.get("role") == "client" and data.get("email") == SMOKE_EMAIL
            await _record_step(
                steps, "GET /auth/me", t, ok,
                status_code=r.status_code,
                error=None if ok else f"unexpected response: {str(data)[:120]}",
                payload={"email": data.get("email"), "role": data.get("role")} if ok else None,
            )
            if not ok:
                overall_ok = False
        except Exception as e:  # noqa: BLE001
            await _record_step(steps, "GET /auth/me", t, False, error=str(e)[:200])
            overall_ok = False

        # === 3. CREATE PROPERTY ===
        t = time.perf_counter()
        marker = f"[SMOKE {run_id[:8]}]"
        try:
            r = await cli.post(
                "/api/properties",
                headers=auth_headers,
                json={
                    "name": f"{marker} Test Apartment",
                    "address": "Strada Test nr. 1, București",
                    "type": "apartament",
                    "surface": 65.5,
                    "rooms": 2,
                },
            )
            ok = r.status_code == 200 and bool(r.json().get("id"))
            if ok:
                created_property_id = r.json()["id"]
            await _record_step(
                steps, "POST /properties (creare apartament)", t, ok,
                status_code=r.status_code,
                error=None if ok else r.text[:200],
                payload={"id": created_property_id} if ok else None,
            )
            if not ok:
                overall_ok = False
        except Exception as e:  # noqa: BLE001
            await _record_step(steps, "POST /properties (creare apartament)", t, False, error=str(e)[:200])
            overall_ok = False

        # === 4. LIST PROPERTIES → verify it's there ===
        t = time.perf_counter()
        try:
            r = await cli.get("/api/properties", headers=auth_headers)
            items = r.json() if r.status_code == 200 else []
            found = any(p.get("id") == created_property_id for p in items) if created_property_id else False
            ok = r.status_code == 200 and (found or not created_property_id)
            await _record_step(
                steps, "GET /properties (listare + verificare)", t, ok,
                status_code=r.status_code,
                error=None if ok else f"property not in list (count={len(items)})",
                payload={"count": len(items)},
            )
            if not ok:
                overall_ok = False
        except Exception as e:  # noqa: BLE001
            await _record_step(steps, "GET /properties (listare + verificare)", t, False, error=str(e)[:200])
            overall_ok = False

        # === 5. DELETE the test property (cleanup) ===
        if created_property_id:
            t = time.perf_counter()
            try:
                r = await cli.delete(f"/api/properties/{created_property_id}", headers=auth_headers)
                ok = r.status_code in (200, 204)
                await _record_step(
                    steps, "DELETE /properties (cleanup)", t, ok,
                    status_code=r.status_code,
                    error=None if ok else r.text[:200],
                )
                if not ok:
                    overall_ok = False
            except Exception as e:  # noqa: BLE001
                await _record_step(steps, "DELETE /properties (cleanup)", t, False, error=str(e)[:200])
                overall_ok = False

        # === 6. LOGOUT ===
        t = time.perf_counter()
        try:
            r = await cli.post("/api/auth/logout", headers=auth_headers)
            ok = r.status_code in (200, 204)
            await _record_step(
                steps, "POST /auth/logout", t, ok,
                status_code=r.status_code,
                error=None if ok else r.text[:200],
            )
            if not ok:
                overall_ok = False
        except Exception as e:  # noqa: BLE001
            await _record_step(steps, "POST /auth/logout", t, False, error=str(e)[:200])
            overall_ok = False

    return _finalize(run_id, started_at, steps, overall_ok, base_url)


def _finalize(run_id: str, started_at: str, steps: list, overall_ok: bool, base_url: str) -> dict:
    total_duration_ms = sum(s.get("duration_ms", 0) for s in steps)
    return {
        "id": run_id,
        "started_at": started_at,
        "finished_at": _now(),
        "ok": overall_ok,
        "base_url": base_url,
        "total_duration_ms": total_duration_ms,
        "steps": steps,
        "passed": sum(1 for s in steps if s["ok"]),
        "failed": sum(1 for s in steps if not s["ok"]),
        "total": len(steps),
    }


@router.post("/run")
async def run_smoke_test(
    base_url: Optional[str] = Query(None, description="Override base URL (default: APP_PUBLIC_URL)"),
    user: dict = Depends(require_role("admin")),
):
    """Run the smoke test sequence and persist the result."""
    target = (base_url or DEFAULT_BASE).rstrip("/")
    logger.info(f"[SmokeTest] starting against {target} (triggered by {user.get('email')})")
    report = await _run_smoke_sequence(target)
    report["triggered_by"] = user.get("email")
    try:
        await db.smoke_test_runs.insert_one(report.copy())
    except Exception as e:  # noqa: BLE001
        logger.warning(f"[SmokeTest] failed to persist run: {e}")
    logger.info(f"[SmokeTest] done — ok={report['ok']} passed={report['passed']}/{report['total']}")
    return report


@router.get("/history")
async def list_smoke_test_runs(
    limit: int = Query(20, le=100),
    user: dict = Depends(require_role("admin")),
):
    """Return last N smoke test runs (newest first)."""
    cursor = db.smoke_test_runs.find({}, {"_id": 0}).sort("started_at", -1).limit(limit)
    items = await cursor.to_list(limit)
    return {"items": items, "count": len(items)}
