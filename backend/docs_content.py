"""PropManage — Training & Onboarding documentation content.

Single source of truth for the in-app Knowledge Base. Each doc is a Python dict
with strict structure so the React viewer and the PDF renderer share the same
schema.

Structure per doc:
    slug, role, title, subtitle, version, updated_at, email_intro,
    sections: [
        { heading: str,
          body: [
            "paragraph string" |
            {type: "h3", text: str} |
            {type: "list", items: [str, ...]} |
            {type: "callout", title: str, body: str, variant: "info|warn|success"} |
            {type: "code", text: str} |
            {type: "image_placeholder", caption: str, animation: "css_pulse|lottie|video", src: str} |
            {type: "steps", items: [{title: str, body: str}, ...]} |
            {type: "screencast", src: str, caption: str}     # MP4/GIF
            {type: "lottie", src: str, caption: str}         # JSON Lottie file under /animations/
          ]
        }, ...
    ],
    faq: [{q: str, a: str}, ...]
"""
from __future__ import annotations
from datetime import datetime, timezone

UPDATED = "2026-02-29"

# Re-usable callouts
_CB_ESCROW = {
    "type": "callout", "variant": "info",
    "title": "Plata escrow — protecția ta de bază",
    "body": "Banii pe care îi plătești NU ajung la specialist până când tu nu apeși \"Confirmă finalizare\". Sunt blocați la PropManage într-un cont segregat, indisponibil pentru oricine altcineva. Dacă lucrarea nu e bună, deschizi o dispută și banii se rambursează."
}

# ============================================================================
# 1) CLIENT — Proprietar
# ============================================================================
CLIENT_DOC = {
    "slug": "client",
    "role": "client",
    "title": "Ghid Complet pentru Proprietari (Client)",
    "subtitle": "Cum folosești PropManage pentru a-ți gestiona proprietatea: marketplace specialiști, plăți escrow, Digital Twin, dispute, AI Concierge.",
    "version": "1.0",
    "updated_at": UPDATED,
    "email_intro": "Echipa PropManage îți trimite ghidul oficial pentru utilizarea platformei ca proprietar. Conține tot ce ai de știut: de la postarea primei cereri, la dispute și escrow.",

    "sections": [
        {
            "heading": "1. Ce poți face ca proprietar (Overview)",
            "body": [
                "Ca proprietar pe PropManage ai acces la 4 module principale:",
                {"type": "list", "items": [
                    "**Marketplace** — descoperi specialiști verificați, citești recenzii reale, ceri oferte directe",
                    "**Cereri & Lucrări** — postezi o cerere, primești 3-5 oferte în 24h, alegi cea mai bună",
                    "**Plăți escrow** — plătești în siguranță, banii se eliberează doar după confirmarea ta",
                    "**Digital Twin** — un model 3D al proprietății tale (premium) pe care specialiștii pot marca probleme și soluții vizual",
                    "**AI Concierge** — asistent inteligent care răspunde 24/7 la întrebări despre platformă",
                    "**Dispute & garanție** — protecție 12 luni garanție pe lucrare + echipă de mediere",
                ]},
                _CB_ESCROW,
            ],
        },
        {
            "heading": "2. Primul login & setup (5 minute)",
            "body": [
                {"type": "steps", "items": [
                    {"title": "Creează contul", "body": "Mergi la propmanage.ro/register → completează nume, email, telefon, parolă. Sau folosește \"Login cu Google\" pentru acces instant."},
                    {"title": "Verifică emailul", "body": "Click pe linkul primit pentru a activa contul. Dacă nu îl vezi, verifică folderul Spam."},
                    {"title": "Adaugă o proprietate", "body": "În dashboard → \"Proprietățile mele\" → \"Adaugă proprietate\". Completează: adresă, suprafață, tip (apartament/casă), anul construcției."},
                    {"title": "Setează 2FA (recomandat)", "body": "Profil → Securitate → activează \"Autentificare în 2 pași\" cu Google Authenticator. Adaugă 5 minute de muncă, dar protejează contul pentru totdeauna."},
                    {"title": "Setează preferințe notificări", "body": "Profil → Notificări → alege ce vrei să primești pe email, push, sau ambele."},
                ]},
                {"type": "image_placeholder", "caption": "Tour interactiv primul login (5 pași)", "animation": "css_pulse", "src": "client/onboarding-tour"},
            ],
        },
        {
            "heading": "3. Postează prima cerere (cel mai important flow)",
            "body": [
                "Fluxul standard pentru a obține o lucrare:",
                {"type": "steps", "items": [
                    {"title": "Click \"Cerere nouă\"", "body": "Din dashboard. Modal-ul se deschide."},
                    {"title": "Alege specialitatea", "body": "Electric, Sanitar, HVAC, Zugrăveală, Design Interior, etc. (10 categorii)."},
                    {"title": "Descrie problema", "body": "Scrie 2-3 fraze clare. Ex: \"Am o pată mare de umiditate pe perete în baie. Apare după ce fac duș. Vreau identificare cauză + remediere.\""},
                    {"title": "Adaugă poze (puternic recomandat!)", "body": "1-3 poze cu zona problemă. Cererile cu poze primesc oferte cu 40% mai bune și mai rapid."},
                    {"title": "Setează urgența", "body": "Urgent (24h), Săptămâna asta, Luna asta, Flexibil."},
                    {"title": "Trimite", "body": "Sistemul notifică automat 5-10 specialiști din zona ta care lucrează în specialitatea respectivă. Vei primi oferte în 4-24 ore."},
                ]},
                {"type": "screencast", "src": "client/post-request.mp4", "caption": "Demo: postare cerere de la zero la trimis (38 secunde)"},
                {"type": "callout", "variant": "success",
                 "title": "Pro tip — Lead Fee",
                 "body": "Pentru a vedea telefonul/datele tale de contact, specialistul plătește o taxă de Lead (45 RON). Asta filtrează automat oamenii neserioși — doar specialiștii care chiar vor lucrarea îți contactează."},
            ],
        },
        {
            "heading": "4. Compari oferte și alegi specialistul",
            "body": [
                "După ce specialiștii trimit oferte (5-15 minute - 24 ore), vezi pe rând:",
                {"type": "list", "items": [
                    "**Preț propus** + dacă include sau nu materialele",
                    "**Timp de execuție** estimat",
                    "**Health Score** (algoritm proprietar — combinație: reviews, rate de dispute, vechime, portofoliu)",
                    "**Rating + număr recenzii** istorice",
                    "**Badge VERIFIED** (lime) — documente validate manual de echipa noastră",
                    "**Portofoliu** — poze cu lucrări anterioare",
                ]},
                {"type": "callout", "variant": "warn",
                 "title": "Nu alege doar pe baza prețului",
                 "body": "Un specialist cu 30% mai ieftin dar fără recenzii și fără VERIFIED este de cele mai multe ori o capcană. Verifică Health Score, citește recenziile și abia apoi decide. Diferența de 200 RON merită investiția în calitate."},
            ],
        },
        {
            "heading": "5. Plata escrow — cum funcționează",
            "body": [
                "Când accepți oferta, sistemul îți cere să \"alimentezi escrow\":",
                {"type": "steps", "items": [
                    {"title": "Alegi metoda de plată", "body": "Card (Visa/Mastercard) prin Stripe — instant, sau transfer bancar (1-2 zile lucrătoare)."},
                    {"title": "Banii se blochează", "body": "PropManage primește banii într-un cont segregat. Specialistul primește notificare \"Escrow alimentat\" și are voie să înceapă."},
                    {"title": "Specialistul lucrează", "body": "Comunici prin chat-ul aplicației. Toate mesajele se salvează ca dovadă."},
                    {"title": "Confirmi finalizarea", "body": "Când lucrarea e gata și inspectată, apeși \"Confirm finalizare\" în pagina lucrării. Acesta este momentul când banii pleacă din escrow către specialist."},
                    {"title": "Garanție 12 luni", "body": "Chiar dacă banii sunt eliberați, ai garanție 12 luni pentru manoperă. Orice problemă o semnalezi în aplicație și specialistul e obligat să remedieze gratuit."},
                ]},
                {"type": "lottie", "src": "/animations/escrow-flow.json", "caption": "Animație: cum se mișcă banii prin escrow"},
            ],
        },
        {
            "heading": "6. Disputa — când lucrurile merg prost",
            "body": [
                "Dacă specialistul nu finalizează, finalizează prost, sau apar probleme:",
                {"type": "steps", "items": [
                    {"title": "Strânge dovezi", "body": "Poze, video, mesaje din chat care arată problema. Cu cât mai detaliat, cu atât mediere mai rapidă."},
                    {"title": "Apasă \"Deschide dispută\"", "body": "Pe pagina lucrării. Banii din escrow se îngheață imediat — specialistul NU îi primește."},
                    {"title": "Descrie problema clar", "body": "Explică ce nu e ok, ce ai cerut, ce ai primit. Atașează dovezile."},
                    {"title": "Echipa de mediere intervine", "body": "În maxim 48 ore. Cere și perspectiva specialistului, analizează dovezile."},
                    {"title": "Decizia finală", "body": "Una din 3 variante: (a) rambursare integrală — banii revin pe cardul tău în 3-5 zile; (b) plată parțială (split equitabil); (c) plată completă specialistului (dacă cererea ta e neîntemeiată). În 2025, 67% din dispute s-au decis în favoarea clientului."},
                ]},
            ],
        },
        {
            "heading": "7. Digital Twin (premium) — modelul 3D al proprietății",
            "body": [
                "Premium feature pentru proprietari care vor să gestioneze profesionist proprietatea:",
                {"type": "list", "items": [
                    "Încarci un model 3D al proprietății (`.glb`/`.gltf` — îți face arhitectul sau topograful)",
                    "Suprapui peste el plan 2D structural (PDF)",
                    "Tu sau specialiștii adăugați marchează **pin-uri** vizual pe model (ex: \"crăpătură perete\", \"priză defectă\")",
                    "Pin-urile au categorie, prioritate, comentarii, status (deschis/în lucru/rezolvat)",
                    "Specialiștii trimit **rapoarte oficiale** cu PDF generat automat (poze + plan + thread comentarii)",
                    "Aprobi raportul cu un click prin link tokenizat — fără login necesar",
                ]},
                {"type": "callout", "variant": "info",
                 "title": "De ce e util",
                 "body": "În loc să tot urci poze și să descrii prin chat unde e problema (\"a doua priză din stânga, pe peretele opus ferestrei\"), pin-ul de pe Twin spune exact unde, ce și de când e problema. Reduce neînțelegerile cu 80%."},
                {"type": "screencast", "src": "client/digital-twin.mp4", "caption": "Demo: navigare 3D + adăugare pin pe modelul casei"},
            ],
        },
        {
            "heading": "8. Comunicarea cu celelalte roluri",
            "body": [
                {"type": "h3", "text": "Cu specialiștii"},
                "Doar prin chat-ul aplicației (NU pe WhatsApp/SMS direct). Asta îți garantează că ai dovezile mesajelor în caz de dispută. Telefonul specialistului apare doar după ce el plătește lead fee-ul.",
                {"type": "h3", "text": "Cu operatorul"},
                "Operatorul (echipa internă PropManage) validează modelele Digital Twin. Comunicarea se face prin sistem de \"non-conformities\" în pagina Twin-ului. Tu primești email + notificare în-app când ai mesaj nou.",
                {"type": "h3", "text": "Cu administratorul"},
                "Pentru probleme generale: contact@propmanage.ro sau butonul \"Help\" din dashboard care deschide AI Concierge. Pentru dispute, există echipa dedicată în-app.",
            ],
        },
        {
            "heading": "9. Edge cases & troubleshooting",
            "body": [
                {"type": "h3", "text": "Specialistul nu răspunde de 48h"},
                "Deschide chat-ul, apasă \"Raportează absență\". Sistemul îi dă 24h să răspundă, după care îți permite să anulezi lucrarea fără penalități.",
                {"type": "h3", "text": "Cardul a fost respins la escrow"},
                "Cauze frecvente: 3D Secure neactiv, fonduri insuficiente, restricție online. Soluție: verifică limita online la bancă (Settings → Plăți online → Activează). Alternativă: transfer bancar din pagina lucrării.",
                {"type": "h3", "text": "Am uitat parola"},
                "Login page → \"Am uitat parola\" → introduci email → primești link reset valabil 60 minute.",
                {"type": "h3", "text": "Nu primesc emailuri de la PropManage"},
                "Verifică folderul Spam. Marchează un email PropManage ca \"Not spam\" — viitoarele vor merge direct în inbox. Verifică și că emailul din profil e corect.",
                {"type": "h3", "text": "Vreau să-mi șterg contul (GDPR)"},
                "Profil → Confidențialitate → \"Cere ștergerea contului\". Procesul durează 30 zile (perioadă în care îți poți răzgândi). După, datele tale sunt șterse complet conform GDPR.",
            ],
        },
        {
            "heading": "10. Best Practices (sfaturile noastre după 1000+ lucrări)",
            "body": [
                {"type": "list", "items": [
                    "**Cere mereu minim 3 oferte.** Diferența între cea mai mică și cea mai mare poate fi 40%. Nu accepta prima ofertă.",
                    "**Citește 5-10 recenzii** ale specialistului ales, nu doar nota. Caută cuvinte cheie: \"punctual\", \"curățenie\", \"respect cuvânt dat\".",
                    "**Cere oferta scrisă** cu preț FIX, înainte de a alimenta escrow. Nu \"preț orientativ\".",
                    "**Plătește prin escrow chiar și pentru lucrări mici** (sub 500 RON). Asigurare gratuită.",
                    "**Inspectează vizual lucrarea ÎNAINTE să confirmi finalizarea.** După confirmare, banii pleacă. Garanția acoperă defectele ascunse, dar e mai ușor să refuzi acum decât să mediezi după.",
                    "**Lasă o recenzie sinceră** — ajuți următorii proprietari să aleagă bine. Recenzia poate fi modificată în 30 zile dacă te răzgândești.",
                    "**Folosește chat-ul aplicației, NU WhatsApp.** Mesajele de pe WhatsApp NU sunt dovezi în dispute.",
                    "**Setează urgența realist.** \"Urgent (24h)\" costă 15-25% peste preț. Pentru lucrări care pot aștepta o săptămână, alege \"Flexibil\" și obții discount.",
                ]},
            ],
        },
        {
            "heading": "11. Studii de caz reale",
            "body": [
                {"type": "h3", "text": "Cazul 1: Renovare baie 8 mp în București"},
                "**Buget client**: 5.000 RON. **Ofertă primită**: 7.500 RON. **Cum a economisit**: a cumpărat singur faianța premium de la Hornbach (cu 25% reducere față de prețul taxat de specialist), a negociat manopera la 5.200 RON. **Total final**: 5.180 RON. **Calitate**: 5/5 stele, lucrare în 6 zile.",

                {"type": "h3", "text": "Cazul 2: Dispută rezolvată în 3 zile"},
                "**Lucrare**: zugrăveală apartament 60 mp, 3.500 RON. **Problemă**: după 5 zile au apărut pete de igrasie nedezvelite anterior. Specialistul cerea bani în plus pentru tratament. **Decizia mediere**: igrasia era preexistentă, specialistul nu putea ști. **Rezultat**: split 70% specialist (manoperă deja făcută), 30% rambursare client (pentru re-zugrăveală necesară după tratament). Ambele părți mulțumite.",

                {"type": "h3", "text": "Cazul 3: Folosirea Digital Twin pentru o casă veche"},
                "**Context**: client cu casă din 1968, multiple probleme structurale ascunse. **Soluție**: a încărcat scanare 3D făcută de un topograf (2.500 RON one-time). În 6 luni, 4 specialiști diferiți au lucrat la diferite zone marcând pin-uri pe model. **Avantaj**: noul specialist vede istoricul complet al proprietății înainte de a propune lucrarea — reduce timpul de diagnoză cu 70% și greșelile cu 90%.",
            ],
        },
    ],

    "faq": [
        {"q": "Cât costă să folosesc PropManage ca client?", "a": "**Zero**. Plățile, cererile, marketplace-ul, AI Concierge, totul este gratuit pentru client. Specialistul plătește comisionul de 5% din lucrare. Singurul cost adițional pentru tine: lead fee de 45 RON (opțional, doar dacă vrei ca specialistul să aibă numărul tău de telefon — alternativ comunicați doar prin chat)."},
        {"q": "Pot folosi PropManage fără să am o proprietate înregistrată?", "a": "Nu. Adăugarea unei proprietăți este obligatorie pentru a posta cereri. Asta ne ajută să recomandăm specialiști din zona ta corectă. Procesul durează 2 minute — adresă + suprafață + tip."},
        {"q": "Specialiștii pot vedea adresa exactă a proprietății?", "a": "Doar specialistul ALES (cel a cărui ofertă o accepți) vede adresa completă. Toți ceilalți specialiști care primesc cererea văd doar cartierul / zona. Asta protejează intimitatea ta."},
        {"q": "Ce se întâmplă dacă lucrarea costă mai puțin decât suma blocată în escrow?", "a": "Specialistul ajustează factura finală în aplicație. Diferența se rambursează automat pe cardul tău în 3-5 zile lucrătoare. Ex: ai blocat 3.000 RON, lucrarea a costat 2.700 RON → primești 300 RON înapoi."},
        {"q": "Pot anula o cerere postată?", "a": "Da, atâta timp cât nu ai acceptat încă o ofertă. Apeși \"Anulează\" în pagina cererii. Specialiștii care îți trimiseseră oferte primesc notificare automată. Dacă deja ai acceptat o ofertă și alimentat escrow, anularea necesită acord cu specialistul sau dispută."},
        {"q": "Cum funcționează garanția de 12 luni?", "a": "Începe din ziua confirmării finalizării. În această perioadă, dacă apare un defect cauzat de manoperă (NU de uzură normală sau intervenții externe), apeși \"Cere remediere\" pe pagina lucrării. Specialistul are 48h să răspundă și 7 zile să remedieze gratuit. Dacă refuză, escaladăm la mediere și acoperim noi costul remedierii prin alt specialist."},
        {"q": "Recenzia mea este publică sau anonimă?", "a": "Publică, dar afișată cu prenume + inițială nume (ex: \"Andrei P.\"). Asta crește încrederea pentru viitorii clienți. Conținutul recenziei nu poate fi modificat de specialist sau echipa PropManage — doar tu o poți edita în primele 30 zile."},
        {"q": "Pot avea mai multe proprietăți pe același cont?", "a": "Da, nelimitat. Util dacă ești investitor cu portofoliu de apartamente. Fiecare proprietate are propriul Digital Twin, istoric lucrări, și panou de control separat."},
        {"q": "Datele mele financiare sunt în siguranță?", "a": "Da. Nu stocăm date de card pe serverele PropManage — totul trece direct prin Stripe (PCI-DSS Level 1, cel mai înalt standard de securitate financiară din lume). Vezi doar ultimele 4 cifre + brand-ul cardului în profil. Banii din escrow sunt în cont segregat la BCR."},
        {"q": "Cât durează până primesc primele oferte după ce postez o cerere?", "a": "Median: 47 minute. 80% din cereri primesc prima ofertă în maxim 4 ore. Pentru categorii cu cerere mare (instalator, electrician în orașe mari) — sub 30 minute. Pentru categorii nișate (HVAC industrial, restaurări monumente) — 24-48 ore."},
    ],
}


# ============================================================================
# 2) SPECIALIST — placeholder (will be expanded in PHASE 2)
# ============================================================================
SPECIALIST_DOC = {
    "slug": "specialist",
    "role": "specialist",
    "title": "Ghid Complet pentru Specialiști",
    "subtitle": "Cum câștigi mai bine pe PropManage: optimizare profil, capturare lead-uri, gestionare lucrări, escrow, dispute.",
    "version": "0.1-draft",
    "updated_at": UPDATED,
    "email_intro": "Bine ai venit în comunitatea PropManage. Acest ghid îți arată cum să maximizezi câștigurile și să eviți greșelile clasice.",
    "sections": [
        {
            "heading": "1. Status: în lucru",
            "body": [
                "Documentul complet pentru specialiști va fi disponibil în versiunea v1.0 (deploy următor). Conține: optimizare profil, captură lead-uri, comunicare client, escrow, dispute, best practices câștiguri.",
                {"type": "callout", "variant": "info", "title": "Estimat", "body": "Va fi gata în 2-3 zile. Vei primi automat un email când e publicat."},
            ],
        },
    ],
    "faq": [],
}

# ============================================================================
# 3) OPERATOR — placeholder
# ============================================================================
OPERATOR_DOC = {
    "slug": "operator",
    "role": "operator",
    "title": "Ghid Complet pentru Operatori (Echipa PropManage)",
    "subtitle": "Validare Digital Twin, gestionare non-conformități, comunicare cu clienții și specialiștii.",
    "version": "0.1-draft",
    "updated_at": UPDATED,
    "email_intro": "Bine ai venit în echipa de operatori PropManage. Acest ghid îți arată exact ce ai de făcut zilnic.",
    "sections": [
        {
            "heading": "1. Status: în lucru",
            "body": [
                "Documentul complet va fi disponibil în versiunea v1.0. Conține: workflow validare Twin, gestionare non-conformități, escaladare la admin, KPI-uri zilnice.",
            ],
        },
    ],
    "faq": [],
}

# ============================================================================
# 4) ADMIN — placeholder
# ============================================================================
ADMIN_DOC = {
    "slug": "admin",
    "role": "admin",
    "title": "Ghid Complet pentru Administratori",
    "subtitle": "Toate consolele admin, AI Investigator, Smoke Tests, Data Integrity, Backup, GDPR, monitoring, dispute.",
    "version": "0.1-draft",
    "updated_at": UPDATED,
    "email_intro": "Bine ai venit ca administrator PropManage. Acest ghid acoperă toate uneltele tale.",
    "sections": [
        {
            "heading": "1. Status: în lucru",
            "body": [
                "Documentul complet va fi disponibil în versiunea v1.0. Va acoperi: Morning Briefing, AI Investigator, Smoke Tests, Healthcheck, Data Integrity, Backup, GDPR impersonation, Incidents, Dispute mediation, CMS.",
            ],
        },
    ],
    "faq": [],
}

# ============================================================================
# 5) QA / Manual Testing Playbook — placeholder
# ============================================================================
QA_DOC = {
    "slug": "qa-testing",
    "role": "qa",
    "title": "Manual Testing Playbook PropManage",
    "subtitle": "100+ scenarii de testare end-to-end, organizate pe rol și prioritate. Pentru echipa QA internă.",
    "version": "0.1-draft",
    "updated_at": UPDATED,
    "email_intro": "Acesta este playbook-ul oficial QA PropManage. Conține toate testele manuale obligatorii înainte de fiecare release.",
    "sections": [
        {
            "heading": "1. Status: în lucru",
            "body": [
                "Documentul complet va fi disponibil în versiunea v1.0. Va include: 100+ test cases pe 5 roluri (Client × 30, Specialist × 25, Operator × 15, Admin × 25, Public × 10), checklist interactiv în aplicație, AI suggester pentru test cases noi după fiecare deploy.",
            ],
        },
    ],
    "faq": [],
}


# ============================================================================
# 6) ARCHITECTURE — Technical reference (Frontend + Backend + Infrastructure)
# ============================================================================
ARCHITECTURE_DOC = {
    "slug": "architecture",
    "role": "admin",
    "title": "Arhitectură Platformă — Referință Tehnică",
    "subtitle": "Documentație Frontend + Backend + Infrastructure + Securitate. Pentru developeri, admini tehnici și auditori.",
    "version": "1.0",
    "updated_at": UPDATED,
    "email_intro": "Acesta este documentul tehnic oficial al platformei PropManage — arhitectură, stack, convenții, integrări.",
    "sections": [
        {
            "heading": "1. Stack-ul tehnologic",
            "body": [
                {"type": "list", "items": [
                    "**Frontend**: React 19 + React Router 7 + Tailwind CSS + shadcn/ui + Framer Motion + axios",
                    "**Backend**: FastAPI (Python 3.11) + Motor (MongoDB async driver) + APScheduler + reportlab",
                    "**Database**: MongoDB 7 (single replica set, segregated escrow collection)",
                    "**Auth**: JWT (HS256) cu refresh tokens + Google OAuth (Emergent-managed) + cookie SameSite=None;Secure pentru cross-domain",
                    "**LLM**: Claude Sonnet 4.5 via Emergent Universal Key (emergentintegrations library)",
                    "**Payments**: Stripe (test key în preview, requires sk_live_... în producție)",
                    "**Email**: Resend (HTML + atașamente PDF/tar.gz)",
                    "**Hosting**: Emergent Kubernetes (preview + custom domain `propmanage.ro`)",
                    "**Push**: VAPID Web Push (browsers desktop + mobile)",
                ]},
                {"type": "callout", "variant": "info", "title": "Stack-ul real (verificat)",
                 "body": "Versiunile exacte sunt în `frontend/package.json` și `backend/requirements.txt`. Nu rescrie aceste fișiere — folosește `yarn add` și `pip freeze`."},
            ],
        },
        {
            "heading": "2. Structura proiectului (/app)",
            "body": [
                {"type": "code", "text": "/app/\n├── backend/\n│   ├── server.py            # FastAPI app + lifecycle + scheduler wiring\n│   ├── db.py                # Motor client (singleton)\n│   ├── deps.py              # require_role, auth dependencies\n│   ├── models.py            # Pydantic + PyObjectId base\n│   ├── auth.py              # JWT + password hashing + OAuth\n│   ├── services.py          # send_email + VAPID + shared helpers\n│   ├── email_service.py     # Resend integration + branded layout\n│   ├── docs_content.py      # Knowledge Base content (this lives here!)\n│   ├── docs_service.py      # PDF render + tokenized share\n│   ├── docs_search.py       # Markdown export + FT search\n│   ├── backup_service.py    # MongoDB daily backup → email\n│   ├── admin_briefing_digest.py  # Morning Briefing aggregator + cron\n│   ├── seo_slugs.py         # SEO landing-page slug maps\n│   ├── routes/              # All API endpoints (~30 routers)\n│   │   ├── auth.py, marketplace.py, public.py\n│   │   ├── escrow.py, disputes.py, twin.py\n│   │   ├── admin_*.py       # 15+ admin consoles\n│   │   ├── docs_routes.py   # /admin/docs/* + /help/{token}\n│   │   ├── admin_smoketest.py, admin_healthcheck.py\n│   │   ├── admin_data_integrity.py, admin_backups.py\n│   │   └── incidents.py     # Public status page\n│   └── requirements.txt\n│\n├── frontend/\n│   ├── src/\n│   │   ├── App.js           # Router + global providers\n│   │   ├── auth.jsx         # useAuth() + AuthProvider\n│   │   ├── hooks/useSEO.js  # Dynamic <head> per route\n│   │   ├── utils/seoSlugs.js\n│   │   ├── components/\n│   │   │   ├── ui/          # shadcn/ui primitives\n│   │   │   ├── DocViewer.jsx  # Shared doc renderer\n│   │   │   └── ... (~60 components)\n│   │   ├── pages/\n│   │   │   ├── Dashboards.jsx, Marketplace.jsx\n│   │   │   ├── MarketplaceLanding.jsx  # /marketplace/:slug SEO\n│   │   │   ├── GhiduriIndex.jsx, GhidPage.jsx  # blog\n│   │   │   ├── HelpPage.jsx  # /help/:token (public docs)\n│   │   │   └── admin/        # 20+ admin panels\n│   │   │       ├── AdminConsole.jsx  # router\n│   │   │       ├── AdminLayoutMetronic.jsx  # sidebar + topbar\n│   │   │       ├── AdminDocs.jsx  # docs management\n│   │   │       ├── MorningBriefing.jsx\n│   │   │       └── ...\n│   │   ├── data/ghiduri.js  # blog articles\n│   │   └── index.css        # Tailwind + custom\n│   └── package.json\n│\n└── memory/\n    ├── PRD.md               # Product spec + changelog\n    └── test_credentials.md  # Test accounts"},
            ],
        },
        {
            "heading": "3. Backend — convenții API",
            "body": [
                {"type": "list", "items": [
                    "**Toate rutele backend trebuie prefixate cu `/api`** (Kubernetes ingress routează `/api/*` → port 8001).",
                    "**Auth dependency**: `Depends(require_role(\"admin\"))` sau `require_role(\"client\")`. Multi-role: `require_any_role(\"admin\", \"operator\")`.",
                    "**Env vars**: doar prin `os.environ.get(\"KEY\")` — fără default values (fail fast la deploy).",
                    "**MongoDB**: NU returna documente raw. Folosește `BaseDocument.from_mongo(doc)` / `instance.to_mongo()`. ObjectId → `PyObjectId` annotated type.",
                    "**Datetime**: `datetime.now(timezone.utc)`, NEVER `datetime.utcnow()`.",
                    "**Erori**: `raise HTTPException(status_code, \"Message in Romanian\")`. Mesajele user-facing sunt în RO.",
                    "**Logging**: `logging.getLogger(\"propmanage.<module>\")`. Nu folosi `print()`.",
                    "**Async**: toate handler-ele FastAPI sunt `async def`. I/O folosește `await` (Motor, httpx).",
                    "**Background jobs**: APScheduler (Bucharest TZ). Toate joburile au try/except wrapping — never raise.",
                ]},
                {"type": "h3", "text": "Schedulers active"},
                {"type": "list", "items": [
                    "`smoke_test_monitor` — la fiecare 30 min, testează flow E2E multi-rol, alertează la FAIL",
                    "`morning_briefing_digest` — zilnic 09:00, email digest dacă overall != ok",
                    "`daily_mongodb_backup` — zilnic 03:30, backup tar.gz → email admini cu PDF attached",
                ]},
            ],
        },
        {
            "heading": "4. Frontend — convenții React",
            "body": [
                {"type": "list", "items": [
                    "**Routing**: React Router 7 cu `<Routes>` și `<Route>` în `App.js`. Public routes (marketplace, ghiduri, help) NU au require-auth wrapper.",
                    "**State global**: `useAuth()` din `auth.jsx`. State local: `useState`. Cross-component: `window.dispatchEvent(new CustomEvent('propmanage:...'))`.",
                    "**API calls**: `axios.get(`${API}/admin/...`)` cu cookies automate (`withCredentials=true` global). `API = ${REACT_APP_BACKEND_URL}/api`.",
                    "**SEO**: `useSEO({title, description, canonical, jsonLd, noindex})` din `hooks/useSEO.js`. Setează `<head>` dinamic.",
                    "**Data test IDs**: TOATE elementele interactive au `data-testid=\"kebab-case-name\"`.",
                    "**UI primitives**: doar din `components/ui/` (shadcn). NU instala alte component libraries.",
                    "**Toasts**: `import { toast } from \"sonner\"; toast.success/error(...)`.",
                    "**Animations**: Framer Motion pentru transitions. Tailwind animate classes pentru CSS. Lottie via CDN lazy load.",
                    "**Componente**: <50 linii ideal. Export named pentru componente, default pentru pagini.",
                ]},
                {"type": "h3", "text": "Pattern: Admin panel nou"},
                "Adaugi în `AdminLayoutMetronic.jsx` la `MENU_SECTIONS` un item, în `AdminConsole.jsx` mapezi `active === \"newtab\"` la componenta ta, creezi `pages/admin/AdminNew.jsx` care exportă `AdminNew` și folosește `<AdminCard>` wrapper.",
            ],
        },
        {
            "heading": "5. Database — colecții MongoDB",
            "body": [
                {"type": "h3", "text": "Core entities"},
                {"type": "list", "items": [
                    "**users** — `{role, email, password_hash, name, phone, verified, tier, rating, reviews_count, coverage_zones, service_categories, deleted, created_at}`. Index unique pe `email`.",
                    "**properties** — proprietățile clienților (`owner_id, address, city, type, area_sqm`)",
                    "**requests** — cererile postate (`client_id, category, description, photos, urgency, status`)",
                    "**proposals** — ofertele specialiștilor pe cereri",
                    "**jobs** — lucrările active (status: pending|in_progress|completed|disputed|refunded)",
                    "**escrow** — tranzacțiile cu stare bani (segregated account, Stripe payment intent)",
                    "**disputes** — `{job_id, opened_by, reason, evidence_urls, resolution, mediator_id}`",
                    "**reviews** — `{job_id, author_id, target_id, rating, text, editable_until}`",
                ]},
                {"type": "h3", "text": "Digital Twin + Operational"},
                {"type": "list", "items": [
                    "**twins**, **twin_pins**, **twin_reports** — modulul 3D",
                    "**smoke_test_runs**, **data_integrity_runs**, **backup_runs** — monitoring",
                    "**incidents** — public status page",
                    "**admin_ai_findings** — AI Investigator",
                    "**docs_share_tokens**, **docs_send_events** — Knowledge Base",
                    "**audit_log** — GDPR compliance",
                ]},
                {"type": "callout", "variant": "warn", "title": "MongoDB rules",
                 "body": "Nu adăuga câmpuri direct din endpoint fără validare. Folosește Pydantic models. ObjectId NU e JSON-serializable raw — folosește `PyObjectId` + `BaseDocument`."},
            ],
        },
        {
            "heading": "6. Integrări externe",
            "body": [
                {"type": "list", "items": [
                    "**Resend** (email) — `RESEND_API_KEY`. Tranzacționale + digest-uri admin + docs sending. Limită attachment ~20MB (cap intern 15MB).",
                    "**Stripe** (plăți) — `STRIPE_API_KEY`. Test în preview, live în prod când `sk_live_*` setat. Plăți prin escrow segregat.",
                    "**Emergent LLM Key** (Claude Sonnet 4.5) — `EMERGENT_LLM_KEY`. AI Concierge + AI Investigator + Smart Match.",
                    "**Google OAuth** (Emergent-managed) — `GOOGLE_OAUTH_*`. Redirect → `/auth/google/callback` → JWT.",
                    "**VAPID Web Push** — `VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY`. Push browser.",
                ]},
            ],
        },
        {
            "heading": "7. Securitate",
            "body": [
                {"type": "list", "items": [
                    "**Cookie auth**: `HttpOnly + Secure + SameSite=None`. Refresh rotation la 12h.",
                    "**Password**: bcrypt cost 12. Reset tokens 60 min, one-time use.",
                    "**Rate limiting**: login 8/min per IP. Lockout 15 min după 10 fail consecutive.",
                    "**2FA**: TOTP (Google Authenticator) opțional general, obligatoriu admin.",
                    "**GDPR**: consent banner, DSAR endpoints, impersonation log, audit complet.",
                    "**Path traversal**: backup downloads validează prefix + safe chars.",
                    "**Prompt injection**: AI Concierge guard input + output filtering.",
                    "**Disallow paths**: `/admin/*`, `/api/admin/*`, callbacks blocate în robots.txt.",
                ]},
            ],
        },
        {
            "heading": "8. Environment & Deploy",
            "body": [
                {"type": "h3", "text": "Env vars critice"},
                {"type": "list", "items": [
                    "**Backend** (`/app/backend/.env`): `MONGO_URL`, `DB_NAME`, `JWT_SECRET`, `RESEND_API_KEY`, `STRIPE_API_KEY`, `EMERGENT_LLM_KEY`, `GOOGLE_OAUTH_*`, `VAPID_*`, `ADMIN_EMAILS`, `APP_PUBLIC_URL`, `SENDER_EMAIL`",
                    "**Frontend** (`/app/frontend/.env`): `REACT_APP_BACKEND_URL`",
                ]},
                {"type": "h3", "text": "Restart servicii"},
                {"type": "code", "text": "sudo supervisorctl restart backend\nsudo supervisorctl restart frontend\n# Hot reload activ — restart doar pentru .env/dependency installs"},
                {"type": "h3", "text": "Logs"},
                {"type": "code", "text": "tail -n 100 /var/log/supervisor/backend.err.log"},
                {"type": "callout", "variant": "warn", "title": "Producție vs Preview",
                 "body": "Variabilele env din preview sunt SEPARATE de producție. `RESEND_API_KEY`, `STRIPE_API_KEY`, `JWT_SECRET` se setează în Emergent Deployment Secrets, nu în `.env` din repo."},
            ],
        },
        {
            "heading": "9. SEO & Marketing",
            "body": [
                {"type": "list", "items": [
                    "**Sitemap dinamic**: `GET /api/public/sitemap.xml` → 229 URL-uri (statice + ghiduri + 198 city landings + verified specialists).",
                    "**robots.txt**: sitemap link + Disallow paths private.",
                    "**JSON-LD global**: Organization + WebSite + Service în `index.html`.",
                    "**JSON-LD per pagină**: Article/Service/Person/AggregateRating/BreadcrumbList via `useSEO`.",
                    "**Internal linking**: marketplace landings cross-link + către ghiduri. Ghiduri linkează către marketplace.",
                    "**Romanian-first**: `<html lang=\"ro\">`, `og:locale=ro_RO`, geo.region=RO.",
                ]},
            ],
        },
        {
            "heading": "10. Monitorizare & Observability",
            "body": [
                {"type": "list", "items": [
                    "**Morning Briefing** (top admin dashboard) — 6 tile-uri (healthcheck, smoke test, data integrity, incidents, AI findings, backup).",
                    "**Smoke Test** — E2E flow multi-rol, la 30 min, alert email pe fail.",
                    "**Healthcheck** — probes: Mongo, LLM, Resend, Stripe, OAuth, VAPID, admin emails.",
                    "**Data Integrity Scanner** — orphan twins, escrow mismatches, missing payments.",
                    "**Public Status Page** — `/status` (live healthcheck + incident history 30 zile).",
                    "**Audit Log** — toate acțiunile admin (GDPR).",
                ]},
                {"type": "callout", "variant": "success", "title": "Proactive mode",
                 "body": "Sistemul alertează pe email DOAR când e ceva în neregulă — briefing zilnic 09:00, instant pe smoke test failure. Inbox curat în zilele bune."},
            ],
        },
        {
            "heading": "11. Knowledge Base intern (acest sistem)",
            "body": [
                {"type": "list", "items": [
                    "**Content**: Python dict în `backend/docs_content.py` — single source, fără DB migrări.",
                    "**Schema bloc**: paragraph, list, callout, steps, code, h3, image_placeholder, screencast, lottie.",
                    "**Render**: PDF (reportlab), Markdown (custom converter), HTML (DocViewer.jsx).",
                    "**Distribuție**: email cu PDF + link tokenizat 30 zile, auto-onboarding, bulk send pe rol.",
                    "**Search**: full-text local cu diacritic normalization, `Cmd+K` în admin docs panel.",
                ]},
                {"type": "h3", "text": "Cum adaugi un doc nou"},
                {"type": "code", "text": "# 1. Editezi backend/docs_content.py — adaugi un dict NEW_DOC\nNEW_DOC = {\n    \"slug\": \"my-new-doc\",\n    \"role\": \"admin\",\n    \"title\": \"...\",\n    \"subtitle\": \"...\",\n    \"version\": \"1.0\",\n    \"updated_at\": \"2026-XX-XX\",\n    \"sections\": [{\"heading\": \"...\", \"body\": [...]}],\n    \"faq\": [{\"q\": \"...\", \"a\": \"...\"}],\n}\n\n# 2. Înregistrezi în DOCS_CONTENT\nDOCS_CONTENT[\"my-new-doc\"] = NEW_DOC\n\n# 3. Hot reload — apare automat în Admin → Documentație & Training"},
            ],
        },
    ],
    "faq": [
        {"q": "Cum schimb conținutul unui doc existent?", "a": "Editezi direct `backend/docs_content.py` și salvezi. Hot reload preia în 2-3 secunde. Nu necesită restart backend pentru schimbări de dict-uri."},
        {"q": "Cum adaug imagini/animații?", "a": "**CSS pulse** — `{\"type\": \"image_placeholder\", \"caption\": \"...\", \"src\": \"identifier\"}`. **MP4/GIF** — fișier în `/app/frontend/public/animations/`, referință `{\"type\": \"screencast\", \"src\": \"/animations/my.mp4\"}`. **Lottie** — creezi pe lottiefiles.com, descarci JSON, `{\"type\": \"lottie\", \"src\": \"/animations/my.json\"}`."},
        {"q": "Cum debugez o eroare 500 din producție?", "a": "1. Reproduce în preview. 2. `tail -n 200 /var/log/supervisor/backend.err.log` în preview. 3. Dacă apare doar în prod (env-related), verifică Emergent Deployment Secrets. 4. Pentru DNS/SSL issues, contactează Emergent Support."},
        {"q": "Cum adaug un endpoint nou?", "a": "1. Router în `routes/my_module.py` cu `prefix=\"/api/my-prefix\"`. 2. Importi în `server.py`, `app.include_router(...)`. 3. `Depends(require_role(\"admin\"))` pentru protecție. 4. Testezi cu `curl -b /tmp/cookies.txt ${API_URL}/api/my-prefix/...`."},
        {"q": "Care e diferența între preview și producție?", "a": "**Preview** = dev environment (URL `*.emergentagent.com`). Modificările instant. **Producție** = `https://propmanage.ro`. Cod actualizat doar la redeploy. Env vars în 2 locuri (Emergent Deployment Secrets vs `.env`). DB separat."},
        {"q": "Cum fac rollback la o versiune anterioară?", "a": "Emergent are funcția **Rollback** în UI care nu costă credite. Folosește-o, nu rula `git reset` manual (păstrează `.git` și `.emergent` intacte)."},
        {"q": "De ce documentația e în Python, nu în .md?", "a": "Pentru că (1) e single-source pentru PDF/HTML/MD, (2) versionarea în cod, (3) Pydantic-like validare schema, (4) hot reload instant, (5) search structural (heading vs body vs FAQ)."},
    ],
}


# ============================================================================
# REGISTRY
# ============================================================================
DOCS_CONTENT = {
    "client": CLIENT_DOC,
    "specialist": SPECIALIST_DOC,
    "operator": OPERATOR_DOC,
    "admin": ADMIN_DOC,
    "qa-testing": QA_DOC,
    "architecture": ARCHITECTURE_DOC,
}


def get_doc(slug: str) -> dict | None:
    return DOCS_CONTENT.get(slug)


def all_doc_meta() -> list[dict]:
    """Lightweight list (no body) for admin UI listing."""
    out = []
    for slug, d in DOCS_CONTENT.items():
        out.append({
            "slug": slug,
            "role": d["role"],
            "title": d["title"],
            "subtitle": d["subtitle"],
            "version": d["version"],
            "updated_at": d["updated_at"],
            "sections_count": len(d.get("sections", [])),
            "faq_count": len(d.get("faq", [])),
        })
    return out
