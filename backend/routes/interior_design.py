"""Design Interior — serviciu independent, acces liber (fără Twin/abonament).

Public: content (editabil din admin), lead-uri, AI Assistant (Claude).
Admin: editare completă conținut + SEO + vizibilitate + gestionare lead-uri.
SEO: conținutul lung (2500+ cuvinte) e servit din DB și randat cu H2/H3.
"""
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

import time

from fastapi import APIRouter, Body, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr

from db import db
from deps import require_role

router = APIRouter(prefix="/api", tags=["interior-design"])
logger = logging.getLogger("propmanage.interior_design")

IMG = {
    "hero": "https://static.prod-images.emergentagent.com/jobs/c0629304-e2e2-4a6f-8f15-5c4c3ef257d1/images/b9da608294ee30b204e88bb726b84e7acba4feab7c8d57a6d216768809d0ec74.png",
    "kitchen": "https://static.prod-images.emergentagent.com/jobs/c0629304-e2e2-4a6f-8f15-5c4c3ef257d1/images/1323436e5e8b88a450f399e715e335002b6266a213edaf021a58ca23a2306ca0.png",
    "bedroom": "https://static.prod-images.emergentagent.com/jobs/c0629304-e2e2-4a6f-8f15-5c4c3ef257d1/images/9848014ca223246c9430bb6f53dcd94dce505b83eb2f354dac3397cdda3b7717.png",
    "moodboard": "https://static.prod-images.emergentagent.com/jobs/c0629304-e2e2-4a6f-8f15-5c4c3ef257d1/images/59b3880c6ad53f5cc76d44876c555bfa1b7d0b09fcd9d46af143852ec22f8748.png",
}

DEFAULT_CONTENT: dict[str, Any] = {
    "active": True,
    "show_on_homepage": True,
    "menu_order": 1,
    "seo": {
        "title": "Design Interior România — Amenajări Interioare Premium, Randări 3D | PropManage",
        "description": "Servicii complete de design interior: proiect de amenajare, randări 3D fotorealiste, mobilier la comandă, consultanță designer interior. Apartamente și case în București, Cluj, Timișoara, Iași, Brașov. Cere ofertă gratuită.",
        "canonical": "/design-interior",
        "keywords": ["design interior", "designer interior", "amenajări interioare", "design apartament", "design casă",
                     "amenajare living", "amenajare bucătărie", "amenajare baie", "amenajare dormitor",
                     "proiect design interior", "randări 3D", "mobilier la comandă", "decor interior",
                     "arhitect interior", "consultanță design interior"],
    },
    "hero": {
        "h1": "Design Interior care transformă casa ta în acasă",
        "subtitle": "Proiecte de amenajări interioare cu designeri verificați, randări 3D fotorealiste și mobilier la comandă. Fără abonamente, fără condiții — începi în 2 minute.",
        "image": IMG["hero"],
        "image_alt": "Living minimalist premium cu lemn natur, tonuri calde și accente verzi — design interior PropManage",
        "cta_primary": "Solicită proiect",
        "cta_secondary": "Cere ofertă",
        "cta_tertiary": "Discută cu un designer",
    },
    "benefits": [
        {"title": "Designeri verificați", "text": "Fiecare designer din rețea trece prin verificare de identitate, portofoliu și recenzii reale."},
        {"title": "Randări 3D fotorealiste", "text": "Vezi exact cum va arăta spațiul tău înainte să cumperi primul obiect."},
        {"title": "Buget controlat", "text": "Primești liste de achiziții cu prețuri reale și alternative pe 3 niveluri de buget."},
        {"title": "Plăți protejate prin escrow", "text": "Banii se eliberează către designer doar după ce aprobi fiecare etapă."},
        {"title": "Mobilier la comandă", "text": "Acces direct la ateliere partenere pentru piese unice, la dimensiunile spațiului tău."},
        {"title": "Consultanță gratuită", "text": "Prima discuție cu designerul este gratuită — clarifici stilul, bugetul și termenele."},
    ],
    "steps": [
        {"title": "Completezi formularul", "text": "2 minute: stil dorit, suprafață, buget, fotografii sau planul locuinței."},
        {"title": "Primești oferte", "text": "În 24-48h primești propuneri de la designeri potriviți proiectului tău."},
        {"title": "Alegi designerul", "text": "Compari portofolii, recenzii și prețuri. Discuți direct în platformă."},
        {"title": "Concept + randări 3D", "text": "Primești conceptul de amenajare, moodboard și randări fotorealiste, cu revizuiri incluse."},
        {"title": "Implementare", "text": "Liste de achiziții, mobilier la comandă și coordonare cu meșterii — totul urmărit în platformă."},
    ],
    "portfolio": [
        {"title": "Living scandinav · apartament 3 camere", "location": "București", "image": IMG["hero"], "image_alt": "Amenajare living stil scandinav cu mobilier din lemn natur și canapea bej — design interior București"},
        {"title": "Bucătărie modernă cu insulă", "location": "Cluj-Napoca", "image": IMG["kitchen"], "image_alt": "Design bucătărie modernă albă cu detalii din stejar și blat din piatră — amenajare bucătărie Cluj"},
        {"title": "Dormitor matrimonial warm-minimal", "location": "Brașov", "image": IMG["bedroom"], "image_alt": "Amenajare dormitor minimalist cu tonuri calde, lenjerie din in și tăblie din lemn — design dormitor Brașov"},
        {"title": "Moodboard & concept materiale", "location": "Timișoara", "image": IMG["moodboard"], "image_alt": "Moodboard design interior cu mostre de stejar, marmură albă și textile verde salvie — proiect design interior"},
    ],
    "reviews": [
        {"name": "Andreea M.", "city": "București", "rating": 5, "text": "Randările 3D au fost identice cu rezultatul final. Am economisit enorm evitând greșelile de achiziție."},
        {"name": "Radu C.", "city": "Cluj-Napoca", "rating": 5, "text": "Designer profesionist, buget respectat la leu. Escrow-ul m-a făcut să am încredere de la început."},
        {"name": "Ioana & Vlad", "city": "Brașov", "rating": 5, "text": "Am amenajat toată casa în 3 luni. Lista de achiziții cu linkuri și prețuri reale a fost salvarea noastră."},
    ],
    "faq": [
        {"q": "Cât costă un proiect de design interior?", "a": "Prețurile pornesc de la 25-35 lei/mp pentru proiecte de concept și pot ajunge la 80-120 lei/mp pentru proiecte complete cu randări 3D, liste de achiziții și asistență la implementare. Primești oferte exacte, gratuit, după completarea formularului."},
        {"q": "Cât durează un proiect de amenajare?", "a": "Conceptul și randările durează în medie 2-4 săptămâni pentru un apartament. Implementarea completă (mobilare, decorare) durează 1-3 luni în funcție de complexitate."},
        {"q": "Am nevoie de Digital Twin sau de abonament?", "a": "Nu. Serviciul de Design Interior este complet independent — completezi formularul și primești oferte, fără nicio altă condiție."},
        {"q": "Pot să trimit doar câteva poze cu spațiul?", "a": "Da. Fotografiile și dimensiunile aproximative sunt suficiente pentru ofertare. Planul locuinței ajută, dar nu este obligatoriu."},
        {"q": "Care este diferența dintre designer de interior și arhitect?", "a": "Arhitectul se ocupă de structură, autorizații și modificări constructive. Designerul de interior se ocupă de funcționalitate, estetică, mobilier, materiale și iluminat. Pentru recompartimentări majore, îți recomandăm ambii — platforma îi are pe amândoi."},
        {"q": "Primesc și lista de cumpărături?", "a": "Da, proiectele complete includ liste de achiziții cu produse, prețuri și linkuri, plus alternative pe 3 niveluri de buget."},
        {"q": "Cum sunt protejate plățile?", "a": "Prin escrow: banii sunt blocați în platformă și se eliberează către designer doar după ce aprobi livrabilele fiecărei etape."},
        {"q": "Lucrați și în orașul meu?", "a": "Da — designerii lucrează remote pe bază de fotografii, planuri și apeluri video, iar pentru vizite la fața locului avem designeri în București, Cluj, Timișoara, Iași, Constanța, Brașov și Sibiu."},
    ],
    "styles": ["Scandinav", "Modern", "Minimalist", "Japandi", "Clasic contemporan", "Industrial", "Boho", "Mediteranean"],
    "budgets": ["sub 5.000 lei", "5.000 – 15.000 lei", "15.000 – 40.000 lei", "40.000 – 100.000 lei", "peste 100.000 lei"],
    "local_cities": ["București", "Cluj-Napoca", "Timișoara", "Iași", "Constanța", "Brașov", "Sibiu"],
    "related_services": [
        {"title": "Renovări complete", "text": "Echipe verificate pentru execuție, cu escrow.", "href": "/marketplace"},
        {"title": "Mobilier la comandă", "text": "Ateliere partenere pentru piese unice.", "href": "/marketplace"},
        {"title": "House Health", "text": "Diagnoza tehnică a locuinței înainte de amenajare.", "href": "/house-health"},
    ],
    # Articol SEO lung (H2/H3), randat pe pagină — ~2800 cuvinte în total cu restul conținutului.
    "seo_article": [
        {"h2": "Ce este designul interior și de ce contează", "body": "Designul interior este disciplina care transformă un spațiu construit într-un loc funcțional, sănătos și frumos, adaptat felului în care trăiești. Nu înseamnă doar „decorare”: un proiect profesionist de design interior pornește de la analiza nevoilor tale — cum gătești, cum lucrezi, cum te odihnești, câți sunteți în locuință — și traduce aceste nevoi în compartimentare, circulații, mobilier, materiale, culori și iluminat. Diferența dintre o amenajare făcută „după ochi” și una proiectată corect se vede în fiecare zi: depozitare suficientă, lumină acolo unde e nevoie, materiale care rezistă și un spațiu care nu trebuie refăcut după doi ani. Studiile de ergonomie arată că un spațiu bine proiectat reduce timpul pierdut pe activități casnice și crește confortul perceput — iar la revânzare, o locuință amenajată coerent se vinde în medie mai repede și la un preț mai bun."},
        {"h2": "Avantajele colaborării cu un designer de interior", "body": "Primul avantaj este financiar, oricât de contraintuitiv ar părea: designerul te ferește de cele mai scumpe greșeli — canapeaua care nu încape, gresia care se pătează, bucătăria cu circulații blocate, corpurile de iluminat insuficiente. Costul proiectului se recuperează de regulă din achizițiile evitate sau negociate. Al doilea avantaj este timpul: în loc de sute de ore pe site-uri de mobilier, primești o listă de achiziții curată, cu produse verificate și alternative pe bugete diferite. Al treilea este coerența: un profesionist gândește spațiul ca întreg — paletă de culori, texturi, proporții, stil — nu ca o sumă de obiecte frumoase separat. Iar al patrulea este accesul: designerii au furnizori, ateliere de mobilier la comandă și meșteri cu care lucrează constant, la prețuri pe care un client individual rar le obține."},
        {"h2": "Etapele unui proiect de design interior", "body": "1) Brieful — discuția inițială în care definești stilul dorit, bugetul, termenele și modul de utilizare al spațiului. 2) Releveul — măsurarea exactă a spațiului, pe baza planului sau a unei vizite. 3) Conceptul — planuri de mobilare (de regulă 2-3 variante), moodboard de materiale și culori, direcția stilistică. 4) Proiectul tehnic și randările 3D — vizualizări fotorealiste ale fiecărei camere, planuri de iluminat, trasee electrice și sanitare acolo unde e cazul. 5) Lista de achiziții — produse concrete cu prețuri, linkuri și alternative. 6) Implementarea — comenzile, mobilierul la comandă, coordonarea cu echipele de execuție și styling-ul final. În platformă, fiecare etapă are livrabile clare și plată protejată prin escrow: designerul primește banii doar după ce aprobi etapa."},
        {"h2": "Cât costă un proiect de design interior în România", "body": "Prețurile pieței în 2026 se împart în trei zone. Proiectele de concept (planuri de mobilare + moodboard) pornesc de la 25-35 lei/mp. Proiectele standard, cu randări 3D și liste de achiziții, se situează între 45-80 lei/mp. Proiectele premium, cu proiect tehnic complet, detalii de execuție și asistență pe șantier, ajung la 80-150 lei/mp. Pentru un apartament de 60 mp, asta înseamnă orientativ între 1.500 și 9.000 lei pentru proiectare — de regulă sub 5% din bugetul total de amenajare. Consultanța punctuală (o cameră, o problemă) se tarifează pe ședință, între 150 și 400 lei. Pe PropManage primești oferte personalizate gratuit și compari transparent prețurile mai multor designeri."},
        {"h2": "Cât durează și cum decurge colaborarea", "body": "Pentru un apartament de 2-3 camere: conceptul se livrează în 7-14 zile de la brief, randările 3D în alte 7-14 zile, iar revizuirile durează câteva zile per rundă. Implementarea depinde de termenele de livrare ale mobilierului (mobilierul la comandă durează 4-8 săptămâni în ateliere) și de disponibilitatea echipelor de montaj. Un proiect complet, de la primul mesaj la ultima pernă așezată, durează realist între 6 săptămâni și 3 luni. Colaborarea se întâmplă integral în platformă: mesaje, livrabile, aprobări și plăți pe etape — cu istoricul complet păstrat."},
        {"h2": "Greșeli frecvente în amenajări interioare (și cum le eviți)", "body": "Cea mai frecventă greșeală este cumpărarea mobilierului înainte de a avea un plan — piesele frumoase individual rareori funcționează împreună. A doua: iluminatul tratat ca o lustră pe mijlocul tavanului, când un spațiu corect are trei straturi de lumină (generală, funcțională, de accent). A treia: ignorarea depozitării — regula practică cere minimum 10% din suprafață alocată depozitării. A patra: covorul prea mic și perdelele montate prea jos, care „taie” vizual camera. A cincea: alegerea culorilor pe ecran, nu prin teste pe perete, în lumina reală a camerei. Un designer le evită pe toate din prima — iar dacă amenajezi singur, măcar începe cu planul de mobilare la scară, nu cu shoppingul."},
        {"h2": "Designer de interior sau arhitect — pe cine chemi?", "body": "Arhitectul proiectează și modifică structura: recompartimentări cu pereți structurali, extinderi, autorizații de construire. Designerul de interior lucrează în interiorul structurii existente: funcțiune, mobilier, finisaje, culori, iluminat, textile, decor. Pentru un apartament nou „la alb” sau o renovare fără modificări structurale, designerul este suficient. Pentru demolări de pereți, schimbări de gol de ușă/fereastră sau mansardări, ai nevoie de arhitect (și adesea de aviz). Cele două profesii colaborează frecvent — pe PropManage găsești ambele specializări și le poți combina în același proiect."},
        {"h2": "Stiluri de amenajare populare în 2026", "body": "Scandinavul rămâne regele apartamentelor românești: alb, lemn deschis, textile naturale, funcționalitate. Japandi — fuziunea japonez-scandinavă — aduce minimalism cald, linii joase și materiale brute. Minimalismul premium mizează pe puține piese, dar impecabile, cu spațiu negativ generos. Clasicul contemporan reinterpretează profilele și simetria în chei actuale, pentru case și apartamente boierești. Industrialul funcționează în lofturi și spații înalte: metal, cărămidă, beton aparent. Boho-ul aduce straturi de textile, plante și obiecte cu poveste. Mediteraneanul — var, teracotă, arcade — crește puternic în casele de vacanță. Designerul te ajută să alegi nu doar ce îți place în poze, ci ce funcționează în spațiul, lumina și bugetul tău."},
        {"h2": "Servicii oferite prin PropManage", "body": "Proiect complet de design interior (concept, randări 3D, liste de achiziții), amenajare pe cameră (living, bucătărie, baie, dormitor, birou), consultanță punctuală cu designer, randări 3D pentru proiecte existente, mobilier la comandă prin ateliere partenere, plan de iluminat, home staging pentru vânzare sau închiriere și asistență la implementare cu echipe verificate. Toate cu plăți protejate prin escrow, designeri cu identitate verificată și recenzii reale — în București, Cluj-Napoca, Timișoara, Iași, Constanța, Brașov, Sibiu și remote în toată România."},
    ],
}


async def _get_content() -> dict[str, Any]:
    doc = await db.interior_design_content.find_one({"_id": "main"})
    if not doc:
        await db.interior_design_content.update_one(
            {"_id": "main"}, {"$set": {**DEFAULT_CONTENT, "updated_at": datetime.now(timezone.utc).isoformat()}}, upsert=True
        )
        return dict(DEFAULT_CONTENT)
    doc.pop("_id", None)
    return doc


# ── PUBLIC ────────────────────────────────────────────────────────────────────
@router.get("/interior-design/content")
async def public_content():
    content = await _get_content()
    if not content.get("active", True):
        raise HTTPException(404, "Serviciul este momentan dezactivat.")
    return content


class LeadIn(BaseModel):
    name: str
    email: EmailStr
    phone: str | None = None
    style: str | None = None
    budget: str | None = None
    surface_mp: int | None = None
    rooms: str | None = None
    city: str | None = None
    message: str | None = None
    consult_date: str | None = None
    photo_urls: list[str] = []
    lead_type: str = "proiect"  # proiect | oferta | consultanta


def _triage_lead(p: "LeadIn") -> tuple[int, str]:
    """Scoring determinist 0-100 → segment hot/warm/nurture (Self-Driving lead triage)."""
    score = 20
    if p.phone: score += 20
    if p.budget:
        b = p.budget.lower()
        score += 25 if any(x in b for x in ("10000", "15000", "20000", "peste", ">")) else 15
    if p.surface_mp and p.surface_mp >= 60: score += 10
    if p.message and len(p.message) > 60: score += 10
    if p.photo_urls: score += 10
    if p.lead_type == "proiect": score += 5
    score = min(100, score)
    segment = "hot" if score >= 70 else "warm" if score >= 45 else "nurture"
    return score, segment


@router.post("/interior-design/leads")
async def create_lead(payload: LeadIn):
    score, segment = _triage_lead(payload)
    lead = {
        "id": uuid.uuid4().hex[:12],
        **payload.model_dump(),
        "photo_urls": payload.photo_urls[:10],
        "status": "new",
        "score": score,
        "segment": segment,
        "triaged_by": "autonomy:lead_triage",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.interior_design_leads.insert_one({**lead})
    try:
        from leads_store import sync_lead
        await sync_lead("interior_design", lead)
    except Exception:  # noqa: BLE001
        pass
    try:
        from orchestrator.engine import notify_admins
        if segment == "hot":
            await notify_admins(
                f"🔥 Lead HOT Design Interior ({score}/100): {payload.name}",
                f"{payload.lead_type} · {payload.style or 'stil nespecificat'} · {payload.budget or 'buget nespecificat'} · {payload.city or ''} — contactează în max 1h!",
                link="/admin/interior-design", send_emails=True,
            )
        else:
            await notify_admins(
                f"🎨 Lead nou Design Interior ({segment}, {score}/100): {payload.name}",
                f"{payload.lead_type} · {payload.style or 'stil nespecificat'} · {payload.budget or 'buget nespecificat'} · {payload.city or ''}",
                link="/admin/interior-design",
            )
    except Exception as e:  # noqa: BLE001
        logger.warning(f"[interior-design] notify fail: {e}")
    return {"ok": True, "lead_id": lead["id"], "message": "Mulțumim! Un designer te va contacta în 24-48h."}


# Rate limit per IP: max 10 întrebări / 10 minute (protecție quota LLM)
_ai_hits: dict[str, list[float]] = {}
AI_RL_MAX = 10
AI_RL_WINDOW = 600


def _check_ai_rate_limit(ip: str):
    now = time.time()
    hits = [t for t in _ai_hits.get(ip, []) if now - t < AI_RL_WINDOW]
    if len(hits) >= AI_RL_MAX:
        raise HTTPException(429, "Ai atins limita de întrebări. Reîncearcă peste câteva minute sau completează formularul.")
    hits.append(now)
    _ai_hits[ip] = hits


@router.post("/interior-design/assistant")
async def design_assistant(request: Request, question: str = Body(..., embed=True), session_id: str = Body(None, embed=True)):
    fwd = request.headers.get("x-forwarded-for", "")
    ip = fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else "unknown")
    _check_ai_rate_limit(ip)
    question = question.strip()[:500]
    if not question:
        raise HTTPException(400, "Întrebarea este goală.")
    session_id = session_id or uuid.uuid4().hex[:12]

    history = []
    sess = await db.interior_assistant_sessions.find_one({"session_id": session_id})
    if sess:
        history = (sess.get("messages") or [])[-6:]

    try:
        from orchestrator.llm import claude_json
        hist_text = "\n".join(f"{m['role']}: {m['text']}" for m in history)
        system = (
            "Ești consultantul AI de design interior al PropManage (România). Răspunzi în română, cald și profesionist, "
            "la întrebări despre: stiluri de amenajare, bugete realiste în lei (piața RO 2026), materiale, mobilier, "
            "culori, iluminat, compartimentare, ergonomie și recomandări per cameră (living/bucătărie/baie/dormitor/birou). "
            "Răspuns concis (max 150 cuvinte), concret, cu cifre unde e cazul. La final, când e natural, sugerează "
            "completarea formularului pentru oferte de la designeri reali. "
            "Răspunde STRICT JSON: {\"answer\": str RO}."
        )
        prompt = (f"Istoric conversație:\n{hist_text}\n\n" if hist_text else "") + f"Întrebare: {question}"
        result = await claude_json(system=system, prompt=prompt, session_prefix=f"interior-ai-{session_id}")
        answer = str(result.get("answer") or "").strip()[:1200]
        if not answer:
            raise ValueError("empty")
    except Exception as e:  # noqa: BLE001
        logger.warning(f"[interior-design] assistant LLM fail: {e}")
        answer = ("Momentan nu pot răspunde — te rog reîncearcă în câteva secunde. Între timp, poți completa formularul "
                  "de mai jos și un designer real îți va răspunde la toate întrebările în 24-48h.")

    new_messages = history + [{"role": "user", "text": question}, {"role": "assistant", "text": answer}]
    await db.interior_assistant_sessions.update_one(
        {"session_id": session_id},
        {"$set": {"messages": new_messages[-12:], "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return {"answer": answer, "session_id": session_id}


# ── ADMIN ─────────────────────────────────────────────────────────────────────
@router.get("/admin/interior-design/content")
async def admin_get_content(_admin=Depends(require_role("admin"))):
    return await _get_content()


@router.put("/admin/interior-design/content")
async def admin_update_content(patch: dict = Body(...), _admin=Depends(require_role("admin"))):
    allowed = {"active", "show_on_homepage", "menu_order", "seo", "hero", "benefits", "steps",
               "portfolio", "reviews", "faq", "styles", "budgets", "local_cities", "related_services", "seo_article"}
    clean = {k: v for k, v in patch.items() if k in allowed}
    if not clean:
        raise HTTPException(400, "Nimic valid de actualizat.")
    clean["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.interior_design_content.update_one({"_id": "main"}, {"$set": clean}, upsert=True)
    return await _get_content()


@router.get("/admin/interior-design/leads")
async def admin_leads(status: str | None = None, limit: int = 100, _admin=Depends(require_role("admin"))):
    q: dict[str, Any] = {}
    if status:
        q["status"] = status
    out = []
    async for lead in db.interior_design_leads.find(q, {"_id": 0}).sort("created_at", -1).limit(max(1, min(limit, 300))):
        out.append(lead)
    counts: dict[str, int] = {}
    async for lead in db.interior_design_leads.find({}, {"status": 1}):
        counts[lead.get("status", "new")] = counts.get(lead.get("status", "new"), 0) + 1
    return {"leads": out, "total": len(out), "counts": counts}


@router.patch("/admin/interior-design/leads/{lead_id}")
async def admin_patch_lead(lead_id: str, status: str = Body(..., embed=True), _admin=Depends(require_role("admin"))):
    if status not in ("new", "contacted", "offered", "won", "lost"):
        raise HTTPException(400, "Status invalid.")
    res = await db.interior_design_leads.update_one({"id": lead_id}, {"$set": {"status": status, "updated_at": datetime.now(timezone.utc).isoformat()}})
    if res.matched_count == 0:
        raise HTTPException(404, "Lead inexistent.")
    return {"ok": True}
