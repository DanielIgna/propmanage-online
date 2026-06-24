"""Manual Tester (Admin) — predefined test suites + AI test-case generator.

Endpoints:
    GET  /api/admin/manual-tester/suites         — bundled list of test suites + cases
    POST /api/admin/manual-tester/runs           — save a test-run session (PASS/FAIL/SKIP per case)
    GET  /api/admin/manual-tester/runs           — list past test-runs (last 30)
    POST /api/admin/manual-tester/suggest        — AI generates extra test cases for a topic

The "suites" are hardcoded here so QA stays version-controlled. Admin can
add ad-hoc / AI-suggested cases per run; they're persisted in the run doc.
"""
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from db import db
from deps import require_role

logger = logging.getLogger("propmanage.manual_tester")

router = APIRouter(prefix="/api/admin/manual-tester", tags=["admin-manual-tester"])


# ============================================================================
# PREDEFINED TEST SUITES (Romanian, structured for a human QA-er)
# ============================================================================
SUITES = [
    {
        "id": "auth_roles",
        "name": "Autentificare & Roluri",
        "icon": "🔐",
        "description": "Login, logout, switch view, integritate role în UI.",
        "cases": [
            {
                "id": "auth_login_client",
                "title": "Login ca CLIENT funcționează și afișează dashboard-ul corect",
                "steps": [
                    "Mergi la /login",
                    "Email: client@propmanage.io · Parola: Client123!",
                    "Apasă Login",
                ],
                "expected": "Redirecționare la /client. Header-ul afișează badge 'Client'. URL-ul rămâne /client (NU /specialist).",
            },
            {
                "id": "auth_login_specialist",
                "title": "Login ca SPECIALIST",
                "steps": [
                    "Logout (dacă ești logat)",
                    "Login cu specialist@propmanage.io / Spec123!",
                ],
                "expected": "Redirecționare la /specialist. Header arată badge 'Specialist'.",
            },
            {
                "id": "auth_login_admin",
                "title": "Login ca ADMIN",
                "steps": [
                    "Login cu admin@propmanage.io / 1!nasov01ADMIN",
                ],
                "expected": "Redirecționare la /admin. Apare sidebar admin cu toate categoriile.",
            },
            {
                "id": "auth_dual_role_consistency",
                "title": "Integritate dual-role (regression bug Feb 2026)",
                "steps": [
                    "Login ca client@propmanage.io",
                    "Verifică în consola browserului: localStorage e gol",
                    "Verifică în Network → /api/auth/me că răspunsul are role='client' și active_view='client'",
                ],
                "expected": "Niciun redirect anormal către /specialist. dual_role_enabled=false pentru contul demo.",
            },
            {
                "id": "auth_logout",
                "title": "Logout curăță sesiunea",
                "steps": [
                    "Fiind logat, apasă pe avatar → Logout",
                    "Încearcă să accesezi direct /client",
                ],
                "expected": "Redirecționare la /login. Niciun acces nu mai e permis fără re-autentificare.",
            },
            {
                "id": "auth_invalid_password",
                "title": "Login cu parolă greșită",
                "steps": [
                    "Mergi la /login",
                    "Email valid + parolă greșită",
                ],
                "expected": "Mesaj eroare clar în română. Niciun cookie nu e setat. Form rămâne pe loc.",
            },
        ],
    },
    {
        "id": "client_dashboard",
        "name": "Dashboard Client",
        "icon": "🏠",
        "description": "Funcționalitățile principale ale clientului.",
        "cases": [
            {
                "id": "client_dash_load",
                "title": "Dashboard se încarcă fără erori",
                "steps": ["Login ca client", "Verifică consola browser"],
                "expected": "Nu apar erori roșii. Toate widget-urile se încarcă (proprietăți, cereri, wallet, House Health card).",
            },
            {
                "id": "client_properties_list",
                "title": "Lista de proprietăți e vizibilă",
                "steps": ["Pe /client, scroll la secțiunea 'Proprietățile tale'"],
                "expected": "Sunt afișate proprietățile clientului cu nume, adresă, fotografii. Buton 'Adaugă proprietate' funcțional.",
            },
            {
                "id": "client_request_create",
                "title": "Creare cerere nouă de servicii",
                "steps": [
                    "Click 'Creează cerere'",
                    "Completează: categorie, titlu, descriere, buget",
                    "Submit",
                ],
                "expected": "Cererea apare în lista 'Cererile mele' cu status 'open'. Apare un toast de confirmare.",
            },
            {
                "id": "client_wallet",
                "title": "Wallet client are sold corect",
                "steps": ["Pe dashboard, verifică widget Wallet"],
                "expected": "Sold afișat în RON. Buton 'Reîncarcă' funcțional.",
            },
        ],
    },
    {
        "id": "house_health_core",
        "name": "House Health · Core",
        "icon": "❤",
        "description": "Modul House Health — Score, Air, Docs, History.",
        "cases": [
            {
                "id": "hh_card_visible",
                "title": "Cardul House Health apare pe dashboard client",
                "steps": ["Login ca client@propmanage.io", "Scroll pe /client"],
                "expected": "Apare un card 'House Health' cu badge subscription, scor, buton 'Deschide modul'.",
            },
            {
                "id": "hh_page_loads",
                "title": "Pagina House Health se deschide",
                "steps": [
                    "Click 'Deschide modul' pe cardul HH",
                    "URL devine /house-health/{twinId}",
                ],
                "expected": "Sidebar cu 9 tab-uri: Scor, Aer, Termic, Umiditate, Electric, Radon, Docs, Istoric, Recomandări. Tema dark.",
            },
            {
                "id": "hh_score_displayed",
                "title": "Tab Scor arată scor + clasificare",
                "steps": ["Tab 'Scor proprietate'"],
                "expected": "Scor /100 vizibil. Badge clasificare (Excellent/Good/Fair/Needs Attention) colorat corect.",
            },
            {
                "id": "hh_docs_upload_local",
                "title": "Upload document local",
                "steps": [
                    "Tab 'Documentație tehnică'",
                    "Mode: 'Fișier local'",
                    "Alege categoria, completează data + descriere",
                    "Selectează un PDF mic (<5MB)",
                    "Adaugă document",
                ],
                "expected": "Documentul apare în listă cu storage='local', mărime kb, link 'Descarcă' funcțional.",
            },
            {
                "id": "hh_docs_upload_link",
                "title": "Upload link extern (Google Drive/Dropbox)",
                "steps": [
                    "Mode: 'Link extern'",
                    "Selectează 'Google Drive'",
                    "Lipește un link valid",
                    "Adaugă",
                ],
                "expected": "Apare în listă cu badge 'link google_drive', buton 'Deschide' care merge la link-ul respectiv.",
            },
            {
                "id": "hh_docs_delete",
                "title": "Ștergere document funcționează",
                "steps": [
                    "Click pe iconița trash pe un document",
                    "Confirm dialog",
                ],
                "expected": "Documentul dispare din listă. Refresh confirmă ștergerea persistentă.",
            },
            {
                "id": "hh_history_timeline",
                "title": "Istoric verificări - timeline",
                "steps": ["Tab 'Istoric verificări'"],
                "expected": "Timeline vertical cu evaluările aprobate + rapoartele HH. Eveniment cel mai recent în top.",
            },
        ],
    },
    {
        "id": "house_health_recommendations",
        "name": "House Health · Recomandări + Marketplace",
        "icon": "💡",
        "description": "F4.2 + F4.4 — recomandări specialist și publicare în marketplace.",
        "cases": [
            {
                "id": "hh_rec_create",
                "title": "Specialist creează o recomandare nouă",
                "steps": [
                    "Login ca specialist@propmanage.io",
                    "Mergi la /house-health/2d0a899472b34e32a8eaf79b88d7c012",
                    "Tab 'Recomandări'",
                    "Click 'Recomandare nouă'",
                    "Completează: evaluare aprobată, titlu, descriere, prioritate URGENT, categorie air, cost 350€, deadline",
                    "Salvează",
                ],
                "expected": "Recomandarea apare în listă cu badge 'URGENT' rose. Specialist vede butoane '✓ Done' și 'trash'.",
            },
            {
                "id": "hh_rec_client_view",
                "title": "Client vede recomandările specialistului",
                "steps": [
                    "Logout din specialist · Login ca client",
                    "Mergi la /house-health/{twinId}",
                    "Tab 'Recomandări'",
                ],
                "expected": "Vede recomandările. NU vede butonul 'Recomandare nouă'. Vede butonul '📢 Publică în marketplace' pe recomandările Urgent/Recomandat.",
            },
            {
                "id": "hh_rec_publish_to_marketplace",
                "title": "Publish to marketplace funcționează",
                "steps": [
                    "Fiind client, click '📢 Publică în marketplace' pe o recomandare urgentă",
                    "Confirm dialog",
                ],
                "expected": "Alert: 'Publicat în marketplace! Request ID: ...'. Recomandarea afișează 'Publicat în marketplace' și butonul de publish dispare.",
            },
            {
                "id": "hh_rec_no_publish_monitor",
                "title": "Recomandare 'Monitorizare' NU poate fi publicată",
                "steps": [
                    "Specialist creează o recomandare cu prioritate 'Monitorizare'",
                    "Client vede recomandarea în tab",
                ],
                "expected": "Butonul '📢 Publică în marketplace' NU apare pe recomandarea cu prioritate Monitorizare.",
            },
        ],
    },
    {
        "id": "house_health_billing",
        "name": "House Health · Abonamente + Stripe",
        "icon": "💳",
        "description": "F4.1 + F4.3 — Plans CRUD, Scoring config, Stripe checkout.",
        "cases": [
            {
                "id": "hh_upgrade_page",
                "title": "Pagina /house-health/upgrade arată 3 planuri",
                "steps": ["Mergi la /house-health/upgrade ca client"],
                "expected": "3 carduri: Basic 9€, Pro 29€ (badge 'Recomandat'), Premium 79€. Features listate. Buton 'Activează acum' pe fiecare.",
            },
            {
                "id": "hh_stripe_redirect",
                "title": "Click pe plan redirecționează la Stripe",
                "steps": [
                    "Pe /house-health/upgrade",
                    "Click 'Activează acum' pe Premium",
                ],
                "expected": "Redirect către checkout.stripe.com/c/pay/... . NU completa plata în test mode — întoarce-te.",
            },
            {
                "id": "hh_admin_plans_crud",
                "title": "Admin: editează prețul unui plan",
                "steps": [
                    "Login ca admin",
                    "Mergi la /admin/house-health",
                    "Tab 'Planuri'",
                    "Click pe creion pe planul 'Basic'",
                    "Schimbă price la 12",
                    "Salvează",
                ],
                "expected": "Planul afișează noul preț. Pe /house-health/upgrade (după refresh) cardul Basic arată 12€.",
            },
            {
                "id": "hh_admin_scoring",
                "title": "Admin: ponderi formula scor — validare 100",
                "steps": [
                    "Pe /admin/house-health → tab 'Formula scor'",
                    "Schimbă o pondere astfel încât suma să fie 99",
                ],
                "expected": "Total se afișează în roșu. Buton 'Salvează' devine disabled. La revenire la 100, devine verde + activ.",
            },
        ],
    },
    {
        "id": "marketplace",
        "name": "Marketplace · Cereri & Oferte",
        "icon": "🛒",
        "description": "Flux complet client→specialist pentru o cerere.",
        "cases": [
            {
                "id": "mp_request_open",
                "title": "Cererea apare pentru specialist",
                "steps": [
                    "Login ca specialist",
                    "Mergi la dashboard sau /specialist/requests",
                ],
                "expected": "Lista de cereri 'open' include cea publicată din House Health (cu badge house_health_source).",
            },
            {
                "id": "mp_offer_create",
                "title": "Specialist face o ofertă",
                "steps": [
                    "Click pe o cerere open",
                    "Completează preț + descriere ofertă",
                    "Trimite",
                ],
                "expected": "Oferta apare în secțiunea ofertelor cererii. Client primește notificare.",
            },
            {
                "id": "mp_offer_accept",
                "title": "Client acceptă o ofertă (+ commission HH se capturează)",
                "steps": [
                    "Login ca client",
                    "Mergi la cererea respectivă",
                    "Click 'Acceptă' pe o ofertă",
                ],
                "expected": "Status devine 'in_progress'. Dacă cererea provine din House Health, audit log are 'commission_captured'.",
            },
        ],
    },
    {
        "id": "admin_panel",
        "name": "Admin Panel",
        "icon": "⚙",
        "description": "Funcționalități admin: Twin Orchestrator, alerte, costuri.",
        "cases": [
            {
                "id": "admin_twin_loaded",
                "title": "Twin Orchestrator se încarcă",
                "steps": ["Login ca admin", "Mergi la /admin/twin"],
                "expected": "Chat interface vizibilă. Lista de Scheduled Actions afișată.",
            },
            {
                "id": "admin_twin_ask",
                "title": "Twin răspunde la o întrebare",
                "steps": [
                    "Pe /admin/twin",
                    "Întreabă: 'Câți utilizatori activi sunt în ultimele 7 zile?'",
                ],
                "expected": "Răspuns coerent în română (cu cifre concrete dacă sunt disponibile).",
            },
            {
                "id": "admin_cost_roi",
                "title": "Card Cost & ROI",
                "steps": ["Pe /admin, scroll la card Cost & ROI"],
                "expected": "Afișează cheltuieli LLM/Stripe/email pe ultimele 30 zile.",
            },
        ],
    },
    {
        "id": "ux_general",
        "name": "UX General",
        "icon": "✨",
        "description": "Probleme generale de UI/UX.",
        "cases": [
            {
                "id": "ux_dark_mode",
                "title": "Dark theme consistent",
                "steps": ["Navigează prin: client, specialist, admin, house-health"],
                "expected": "Niciun ecran cu background alb pe paginile autentificate. Text lizibil în orice ecran.",
            },
            {
                "id": "ux_mobile_responsive",
                "title": "Responsiv pe mobile (375px)",
                "steps": [
                    "Deschide DevTools → viewport 375x812",
                    "Navigează: /client, /house-health/{twinId}, /admin",
                ],
                "expected": "Niciun overflow orizontal. Sidebar-uri se transformă în drawer sau tabs swipeable.",
            },
            {
                "id": "ux_cookie_banner",
                "title": "Cookie banner nu blochează interacțiunile",
                "steps": ["Login proaspăt, observă cookie banner-ul"],
                "expected": "Banner-ul nu acoperă butoanele critice. Click pe 'Accept toate' îl face să dispară.",
            },
            {
                "id": "ux_loading_states",
                "title": "Spinner-uri vs ecran gol",
                "steps": ["Navighează la o pagină care încarcă date"],
                "expected": "Apare un spinner / skeleton, NU ecran gol cu flash de date.",
            },
        ],
    },
]


# ============================================================================
# ENDPOINTS
# ============================================================================
@router.get("/suites")
async def list_suites(user=Depends(require_role("admin"))):
    """Return all predefined test suites."""
    total = sum(len(s["cases"]) for s in SUITES)
    return {"suites": SUITES, "suite_count": len(SUITES), "total_cases": total}


class TestResultIn(BaseModel):
    case_id: str
    status: str  # pass | fail | skip
    notes: Optional[str] = ""


class TestRunIn(BaseModel):
    suite_id: Optional[str] = None  # None = mixed run across suites
    label: Optional[str] = ""
    environment: Optional[str] = "preview"  # preview | production
    results: List[TestResultIn]


@router.post("/runs")
async def save_run(payload: TestRunIn, user=Depends(require_role("admin"))):
    valid = {"pass", "fail", "skip"}
    for r in payload.results:
        if r.status not in valid:
            raise HTTPException(400, f"Status invalid: {r.status}. Permis: pass/fail/skip.")
    doc = {
        "id": uuid.uuid4().hex,
        "suite_id": payload.suite_id,
        "label": payload.label or "",
        "environment": payload.environment or "preview",
        "tester_user_id": user["id"],
        "tester_email": user.get("email"),
        "results": [r.dict() for r in payload.results],
        "summary": {
            "total": len(payload.results),
            "pass": sum(1 for r in payload.results if r.status == "pass"),
            "fail": sum(1 for r in payload.results if r.status == "fail"),
            "skip": sum(1 for r in payload.results if r.status == "skip"),
        },
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.manual_test_runs.insert_one(doc)
    doc.pop("_id", None)
    return {"ok": True, "run": doc}


@router.get("/runs")
async def list_runs(limit: int = 30, user=Depends(require_role("admin"))):
    items = []
    async for r in db.manual_test_runs.find({}, {"_id": 0}).sort("created_at", -1).limit(limit):
        items.append(r)
    return {"items": items, "count": len(items)}


class SuggestIn(BaseModel):
    topic: str
    context: Optional[str] = ""


@router.post("/suggest")
async def suggest_cases(payload: SuggestIn, user=Depends(require_role("admin"))):
    """Use LLM to generate additional test cases for a given topic.

    Topic example: "Twin Orchestrator scheduling", "House Health checkout edge cases".
    """
    key = os.environ.get("EMERGENT_LLM_KEY")
    if not key:
        raise HTTPException(503, "EMERGENT_LLM_KEY nu este configurat.")

    system = (
        "Ești un QA engineer senior pentru o aplicație de management imobiliar (PropManage). "
        "Generezi cazuri de test manuale în română, structurate ca JSON. "
        "Fii pragmatic — focus pe edge cases, integritate de date, fluxuri end-to-end pentru utilizatori reali. "
        "Răspunde DOAR cu un array JSON valid, fără text suplimentar, fără markdown wrapper. "
        "Schema fiecărui caz: { id: string slug, title: string, steps: string[], expected: string }. "
        "Generează între 3 și 6 cazuri relevante pentru topicul cerut."
    )
    prompt = (
        f"Topic: {payload.topic}\n"
        + (f"Context suplimentar:\n{payload.context}\n" if payload.context else "")
        + "\nReturnează JSON array."
    )

    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(api_key=key, session_id=f"manual_tester_{uuid.uuid4().hex[:8]}",
                       system_message=system).with_model("anthropic", "claude-sonnet-4-5-20250929")
        raw = await chat.send_message(UserMessage(text=prompt))
        # Try to extract JSON
        import json
        text = (raw or "").strip()
        if text.startswith("```"):
            # strip fenced code
            text = "\n".join(line for line in text.splitlines() if not line.startswith("```"))
        # Find first '[' and last ']'
        i, j = text.find("["), text.rfind("]")
        if i == -1 or j == -1 or j <= i:
            raise HTTPException(502, "AI nu a returnat JSON valid.")
        cases = json.loads(text[i:j + 1])
        # Sanitize
        cleaned = []
        for c in cases[:8]:
            cleaned.append({
                "id": str(c.get("id") or uuid.uuid4().hex[:8])[:64],
                "title": str(c.get("title") or "(fără titlu)")[:200],
                "steps": [str(s)[:300] for s in (c.get("steps") or [])][:10],
                "expected": str(c.get("expected") or "")[:500],
                "ai_suggested": True,
            })
        return {"cases": cleaned, "count": len(cleaned), "raw_topic": payload.topic}
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        logger.exception(f"[manual_tester.suggest] failed: {e}")
        raise HTTPException(500, f"Eroare AI: {str(e)[:200]}")
