"""Conținut v2 — Interior Intelligence by PropManage (hub CMS-driven, service_pages).

Poziționare: punct de intrare în ecosistemul de transformare a locuinței.
Audit → Digital Twin → Proiectare → Implementare → Management → Întreținere → House Health.
"""
from typing import Any

IMG = {
    "hero": "https://static.prod-images.emergentagent.com/jobs/c0629304-e2e2-4a6f-8f15-5c4c3ef257d1/images/b9da608294ee30b204e88bb726b84e7acba4feab7c8d57a6d216768809d0ec74.png",
    "kitchen": "https://static.prod-images.emergentagent.com/jobs/c0629304-e2e2-4a6f-8f15-5c4c3ef257d1/images/1323436e5e8b88a450f399e715e335002b6266a213edaf021a58ca23a2306ca0.png",
    "bedroom": "https://static.prod-images.emergentagent.com/jobs/c0629304-e2e2-4a6f-8f15-5c4c3ef257d1/images/9848014ca223246c9430bb6f53dcd94dce505b83eb2f354dac3397cdda3b7717.png",
    "moodboard": "https://static.prod-images.emergentagent.com/jobs/c0629304-e2e2-4a6f-8f15-5c4c3ef257d1/images/59b3880c6ad53f5cc76d44876c555bfa1b7d0b09fcd9d46af143852ec22f8748.png",
}

DEFAULT_CONTENT: dict[str, Any] = {
    "content_version": 3,
    "active": True,
    "show_on_homepage": True,
    "menu_order": 1,
    "seo": {
        "title": "Design Interior & Arhitectură de Interior — Interior Intelligence by PropManage | România",
        "description": "Interior Intelligence by PropManage: design interior, arhitectură de interior, audit locuință, scanare 3D și Digital Twin, planșe tehnice, randări 3D și management de implementare cu specialiști verificați. Proiecte în Cluj-Napoca, Transilvania și în toată România.",
        "canonical": "/design-interior",
        "keywords": ["design interior", "designer interior", "arhitectură de interior", "amenajări interioare",
                     "proiect design interior", "planșe tehnice", "scanare 3D locuință", "Digital Twin",
                     "audit locuință", "management proiect renovare", "designer interior Cluj",
                     "designer interior România", "amenajări apartament", "amenajări casă",
                     "randări 3D", "consultanță design interior"],
    },
    "brand": {
        "name": "Interior Intelligence",
        "suffix": "by PropManage",
        "tagline": "Transformarea completă a locuinței",
    },
    "hero": {
        "h1": "Design, Arhitectură de Interior & Implementare",
        "subtitle": "Nu îți vindem doar un proiect de design. Construim întregul proces — audit tehnic, Digital Twin, proiectare, implementare cu specialiști verificați și întreținere pe termen lung. Un singur partener, de la prima măsurătoare la ultima garanție.",
        "image": IMG["hero"],
        "image_alt": "Living premium cu lemn natur și tonuri calde — Interior Intelligence by PropManage, design interior România",
        "cta_primary": "Programează consultanța",
        "cta_secondary": "Cere ofertă",
        "cta_tertiary": "Discută cu un designer",
    },
    "journey": ["Audit", "Digital Twin", "Proiectare", "Implementare", "Management", "Întreținere", "House Health"],
    # ── SURSA UNICĂ DE ADEVĂR pentru întreg ecosistemul (Unified Service Journey) ──
    "canonical_flow": {
        "title": "Un singur proces. Nu servicii izolate.",
        "tagline": "Auditul descoperă. Digital Twin memorează. Designul construiește. Implementarea execută. House Health întreține.",
        "steps": [
            {"key": "audit", "label": "Audit", "desc": "Diagnoza tehnică completă — starea reală a locuinței.", "href": "/design-interior#audit"},
            {"key": "twin", "label": "Digital Twin", "desc": "Copia digitală vie — tot ce s-a descoperit devine memorie.", "href": "/design-interior#digital-twin"},
            {"key": "plans", "label": "Planșe tehnice", "desc": "Documentația exactă pe care lucrează echipele.", "href": "/design-interior#proces"},
            {"key": "design", "label": "Design", "desc": "Proiectare pe date reale, nu pe presupuneri.", "href": "/design-interior#proces"},
            {"key": "implementation", "label": "Implementare", "desc": "Execuție coordonată, cu plăți protejate prin escrow.", "href": "/design-interior#implementare"},
            {"key": "specialists", "label": "Specialiști verificați", "desc": "Identitate, portofoliu și recenzii verificate.", "href": "/marketplace"},
            {"key": "reception", "label": "Recepție", "desc": "Lucrarea se închide doar când e conformă cu proiectul.", "href": "/design-interior#implementare"},
            {"key": "twin_update", "label": "Twin actualizat", "desc": "Tot ce s-a executat intră în copia digitală.", "href": "/design-interior#digital-twin"},
            {"key": "house_health", "label": "House Health", "desc": "Monitorizare și întreținere planificată pe termen lung.", "href": "/house-health/upgrade"},
        ],
    },
    "audit_full": {
        "title": "Tot ce include Auditul tehnic",
        "intro": "Auditul este pasul zero al oricărui proiect: diagnoza completă a locuinței, cu măsurători reale, nu estimări. Rezultatele intră direct în Digital Twin și în proiectare.",
        "outro": "Primești un raport tehnic complet cu priorități de reparație, estimări de cost și documentație foto — fundația fiecărei decizii care urmează.",
        "groups": [
            {"name": "Microclimat & aer interior", "items": [
                "Analiză umiditate (pereți, pardoseli, tavane)", "Punct de rouă și zone de risc condens",
                "Punți termice identificate cu camera termică", "Termografie completă (imagini în infraroșu)",
                "Măsurare CO₂ și compuși organici volatili (VOC)", "Evaluarea ventilației și a schimbului de aer",
                "Calitatea aerului interior", "Cartografierea umidității (moisture mapping)"]},
            {"name": "Instalații & siguranță", "items": [
                "Siguranță electrică (tablou, împământare, circuite)", "Măsurători electrice (tensiune, izolație, continuitate)",
                "Instalație de apă (trasee, presiune, pierderi)", "Instalație de gaz (etanșeitate, conformitate)",
                "Canalizare și scurgeri", "Verificarea sistemului de încălzire"]},
            {"name": "Structură & anvelopă", "items": [
                "Evaluarea structurii (fisuri, tasări, elemente portante)", "Starea anvelopei (izolație, tâmplărie, acoperiș)",
                "Eficiență energetică și pierderi de căldură", "Posibilități de recompartimentare"]},
            {"name": "Rezultate & livrabile", "items": [
                "Analiza riscurilor tehnice", "Priorități de reparație (urgent / recomandat / opțional)",
                "Priorități de investiție (unde merită banii întâi)", "Estimare costuri de intervenție",
                "Raport tehnic complet (PDF)", "Recomandări personalizate", "Documentație foto completă",
                "Metodologia măsurătorilor (transparență totală)"]},
        ],
    },
    "twin_full": {
        "title": "Tot ce conține Digital Twin",
        "intro": "Digital Twin nu este un model 3D frumos. Este memoria vie a proprietății: fiecare traseu ascuns, fiecare material, fiecare document — accesibile oricând, pentru orice proiect viitor.",
        "outro": "Când peste 3 ani schimbi bucătăria, designerul deschide Twin-ul și știe exact ce e în spatele fiecărui perete. Fără măsurători repetate. Fără informații pierdute.",
        "groups": [
            {"name": "Trasee ascunse & instalații", "items": [
                "Trasee electrice ascunse (circuite, doze, tablou)", "Țevi de apă rece", "Țevi de apă caldă",
                "Sistem de încălzire (calorifere, centrală)", "Încălzire în pardoseală (trasee complete)",
                "Canalizare și scurgeri", "Cartografiere electrică completă"]},
            {"name": "Geometrie & planuri", "items": [
                "Măsurători exacte (releveu complet)", "Planuri de arhitectură", "Planșe tehnice de execuție",
                "Model 3D interactiv al locuinței", "Scanări 3D"]},
            {"name": "Materiale & istoric", "items": [
                "Istoricul construcției", "Materiale folosite (pe fiecare zonă)", "Finisaje și echipamente",
                "Istoricul intervențiilor și mentenanței", "Fotografii pe etape"]},
            {"name": "Documente & viitor", "items": [
                "Documente și contracte", "Garanții (cu termene)", "Intervenții viitoare planificate",
                "Planificarea renovărilor", "Property Memory — memoria completă a proprietății"]},
        ],
    },
    "positioning": {
        "title": "Proiecte oriunde în România",
        "text": "Realizăm proiecte complete la nivel național — remote pe bază de scanări, planuri și apeluri video, sau cu prezență la fața locului. Căutăm activ proiecte în zona Cluj-Napoca și Transilvania, unde echipele noastre pot gestiona lucrări complexe de la audit la recepție.",
        "badges": ["Acoperire națională", "Focus: Cluj-Napoca & Transilvania", "Specialiști verificați", "Plăți protejate prin escrow"],
    },
    "process_phases": [
        {"phase": "Descoperire", "intro": "Înțelegem locuința înainte să desenăm prima linie.", "steps": [
            {"n": 1, "title": "Consultanță inițială", "text": "Discutăm obiectivele, stilul de viață, bugetul și termenele. Prima discuție este gratuită."},
            {"n": 2, "title": "Audit tehnic al locuinței", "text": "Evaluăm starea reală: instalații, structură, riscuri, eficiență energetică și posibilități de recompartimentare."},
            {"n": 3, "title": "Ridicare măsurători", "text": "Releveu precis al spațiului — baza oricărui proiect corect."},
        ]},
        {"phase": "Digitalizare", "intro": "Locuința ta primește o copie digitală completă.", "steps": [
            {"n": 4, "title": "Scanare Digital Twin", "text": "Scanăm locuința și construim copia ei digitală — mult mai mult decât un model 3D."},
            {"n": 5, "title": "Model 3D al proprietății", "text": "Modelul tridimensional exact al spațiului, pe care se construiește tot ce urmează."},
            {"n": 6, "title": "Planșe tehnice", "text": "Planuri de arhitectură, instalații și detalii de execuție — documentația pe care lucrează echipele."},
        ]},
        {"phase": "Proiectare", "intro": "Aici se naște proiectul — pe date reale, nu pe presupuneri.", "steps": [
            {"n": 7, "title": "Arhitectură de interior", "text": "Recompartimentare, circulații, funcțiuni — structura invizibilă a unui spațiu care funcționează."},
            {"n": 8, "title": "Design interior", "text": "Concept, moodboard, randări 3D fotorealiste — vezi exact cum va arăta, înainte să cumperi ceva."},
            {"n": 9, "title": "Alegerea materialelor", "text": "Finisaje, texturi și materiale selectate pentru durabilitate, buget și coerență stilistică."},
            {"n": 10, "title": "Soluții tehnice", "text": "Iluminat, HVAC, smart home, acustică — integrate în proiect de la început, nu improvizate pe șantier."},
            {"n": 11, "title": "Bugetare", "text": "Buget detaliat pe capitole, cu alternative pe 3 niveluri — control total înainte de prima comandă."},
        ]},
        {"phase": "Implementare", "intro": "Nu te lăsăm singur cu un PDF. Coordonăm execuția.", "steps": [
            {"n": 12, "title": "Management implementare", "text": "Un singur punct de contact care orchestrează furnizori, comenzi și echipe."},
            {"n": 13, "title": "Coordonare echipe", "text": "Specialiști verificați din rețea, selectați prin cereri de ofertă comparate transparent."},
            {"n": 14, "title": "Verificarea execuției", "text": "Controale de calitate pe fiecare etapă, documentate în platformă."},
            {"n": 15, "title": "Recepția lucrării", "text": "Recepție formală cu punctaj de verificare — lucrarea se închide doar când e conformă cu proiectul."},
        ]},
        {"phase": "Viață lungă", "intro": "Relația nu se termină la recepție.", "steps": [
            {"n": 16, "title": "Actualizarea Digital Twin", "text": "Tot ce s-a executat intră în copia digitală: materiale, instalații, garanții, fotografii."},
            {"n": 17, "title": "House Health", "text": "Monitorizare și întreținere planificată — locuința rămâne sănătoasă, iar tu ai istoricul complet."},
        ]},
    ],
    "digital_twin": {
        "title": "Digital Twin — copia digitală completă a locuinței",
        "intro": "Digital Twin nu este doar un model 3D frumos. Este dosarul digital viu al proprietății tale — fiecare proiect viitor pornește de aici, fără măsurători repetate și fără informații pierdute.",
        "contains": ["Măsurători exacte", "Planuri și planșe tehnice", "Instalații (trasee electrice, sanitare, HVAC)",
                     "Materiale folosite", "Finisaje", "Mobilier", "Istoricul intervențiilor",
                     "Documente și contracte", "Garanții", "Fotografii", "Scanări 3D"],
        "outro": "Când peste 3 ani vrei să schimbi bucătăria, designerul deschide Digital Twin-ul și știe exact ce e în spatele fiecărui perete. Aceasta este diferența dintre un serviciu și un ecosistem.",
        "href": "/#twin",
    },
    "audit": {
        "title": "De ce începem cu un audit tehnic",
        "intro": "Înainte de orice proiect de design recomandăm un audit al locuinței. Proiectarea pe o fundație necunoscută este cea mai scumpă greșeală din renovări.",
        "points": ["Starea actuală a locuinței", "Probleme tehnice existente", "Riscuri (umiditate, structură, electrice)",
                   "Posibilități de recompartimentare", "Starea instalațiilor", "Evaluarea structurii",
                   "Eficiență energetică", "Prioritizarea intervențiilor"],
        "outro": "Rezultatele auditului intră direct în proiectare: designerul știe ce se poate demola, ce trebuie reparat întâi și unde merită investit.",
    },
    "implementation": {
        "title": "Nu doar proiectul. Și implementarea.",
        "intro": "PropManage poate coordona execuția de la prima cerere de ofertă la recepția finală — cu specialiști verificați și plăți protejate prin escrow.",
        "points": ["Selecția specialiștilor verificați", "Cereri de ofertă", "Compararea transparentă a ofertelor",
                   "Verificarea specialiștilor (identitate, portofoliu, recenzii)", "Managementul proiectului",
                   "Urmărirea etapelor în platformă", "Verificarea calității", "Comunicare centralizată",
                   "Documente și contracte într-un singur loc", "Recepția lucrării"],
    },
    "styles_showcase": {
        "title": "Putem lucra în orice stil",
        "intro": "Nu suntem prizonierii unei estetici. Direcția stilistică se alege împreună, pe baza spațiului, luminii și felului în care trăiești.",
        "items": [
            {"name": "Warm Minimalism", "desc": "Minimalism cald: puține piese, texturi naturale, lumină blândă."},
            {"name": "Japandi", "desc": "Fuziunea japonez-scandinavă: linii joase, materiale brute, calm."},
            {"name": "Organic Modern", "desc": "Forme organice, paletă naturală, contemporan fără răceală."},
            {"name": "Quiet Luxury", "desc": "Lux discret: materiale impecabile, fără logo-uri, fără zgomot vizual."},
            {"name": "Modern Mediterranean", "desc": "Var, teracotă, arcade — lumină sudică în cheie actuală."},
            {"name": "Scandinavian Contemporary", "desc": "Scandinavul clasic, actualizat: funcțional, luminos, cald."},
            {"name": "Contemporary Industrial", "desc": "Metal, beton și lemn — pentru spații înalte și lofturi."},
            {"name": "Modern Classic", "desc": "Profile și simetrie clasică, reinterpretate contemporan."},
            {"name": "Biophilic Design", "desc": "Natura în interior: plante, lumină naturală, materiale vii."},
            {"name": "Wabi Sabi Contemporary", "desc": "Frumusețea imperfecțiunii: patină, artizanat, autenticitate."},
            {"name": "Themed Design", "desc": "Concepte tematice personalizate — pentru spații cu poveste."},
            {"name": "Eclectic", "desc": "Mix curajos de epoci și stiluri, ținut împreună de un fir coerent."},
        ],
    },
    "ecosystem": {
        "title": "Parte dintr-un ecosistem complet",
        "intro": "Interior Intelligence nu e un serviciu izolat. Fiecare etapă e conectată la platforma PropManage — aceleași date, aceiași specialiști, aceeași protecție.",
        "links": [
            {"title": "Marketplace", "text": "Cereri de ofertă și servicii pentru orice lucrare.", "href": "/marketplace"},
            {"title": "Specialiști verificați", "text": "Identitate, portofoliu și recenzii verificate.", "href": "/marketplace"},
            {"title": "Audit locuință", "text": "Diagnoza tehnică — primul pas al oricărui proiect.", "href": "/house-health"},
            {"title": "Digital Twin", "text": "Copia digitală completă a proprietății tale.", "href": "/#twin"},
            {"title": "House Health", "text": "Monitorizare și întreținere planificată.", "href": "/house-health"},
            {"title": "Escrow", "text": "Plăți protejate — banii se eliberează doar la aprobare.", "href": "/preturi"},
            {"title": "Wallet", "text": "Plăți și bugete gestionate central în platformă.", "href": "/dashboard"},
            {"title": "Imobile Verificate", "text": "Proprietăți cu istoric tehnic transparent.", "href": "/imobile-verificate"},
            {"title": "Ghiduri", "text": "Resurse practice despre amenajare și renovare.", "href": "/community"},
            {"title": "Cereri Proiect", "text": "Pornește un proiect în 2 minute, fără obligații.", "href": "/register"},
            {"title": "Comunitate", "text": "Întrebări, răspunsuri și experiențe reale.", "href": "/community"},
        ],
    },
    "benefits": [
        {"title": "Un singur partener, tot procesul", "text": "Audit, proiectare, implementare și întreținere — fără să jonglezi cu 7 furnizori."},
        {"title": "Proiectăm pe date reale", "text": "Digital Twin și audit tehnic înaintea proiectării — zero surprize pe șantier."},
        {"title": "Specialiști verificați", "text": "Fiecare specialist trece prin verificare de identitate, portofoliu și recenzii reale."},
        {"title": "Plăți protejate prin escrow", "text": "Banii se eliberează doar după ce aprobi fiecare etapă."},
        {"title": "Randări 3D fotorealiste", "text": "Vezi exact cum va arăta spațiul înainte să cumperi primul obiect."},
        {"title": "Istoric complet, pe viață", "text": "Tot ce s-a făcut rămâne documentat în Digital Twin — util la orice proiect viitor sau la vânzare."},
    ],
    "portfolio": [
        {"title": "Living scandinav · apartament 3 camere", "location": "București", "image": IMG["hero"], "image_alt": "Amenajare living stil scandinav cu mobilier din lemn natur și canapea bej — design interior București"},
        {"title": "Bucătărie modernă cu insulă", "location": "Cluj-Napoca", "image": IMG["kitchen"], "image_alt": "Design bucătărie modernă albă cu detalii din stejar și blat din piatră — amenajare bucătărie Cluj"},
        {"title": "Dormitor matrimonial warm-minimal", "location": "Brașov", "image": IMG["bedroom"], "image_alt": "Amenajare dormitor minimalist cu tonuri calde, lenjerie din in și tăblie din lemn — design dormitor Brașov"},
        {"title": "Moodboard & concept materiale", "location": "Timișoara", "image": IMG["moodboard"], "image_alt": "Moodboard design interior cu mostre de stejar, marmură albă și textile verde salvie — proiect design interior"},
    ],
    "reviews": [
        {"name": "Andreea M.", "city": "București", "rating": 5, "text": "Randările 3D au fost identice cu rezultatul final. Am economisit enorm evitând greșelile de achiziție."},
        {"name": "Radu C.", "city": "Cluj-Napoca", "rating": 5, "text": "Auditul a descoperit o problemă la instalația electrică înainte de proiect. Escrow-ul m-a făcut să am încredere de la început."},
        {"name": "Ioana & Vlad", "city": "Brașov", "rating": 5, "text": "Am amenajat toată casa în 3 luni, cu implementare coordonată complet prin platformă."},
    ],
    "faq": [
        {"q": "Ce este Interior Intelligence și prin ce diferă de un studio de design?", "a": "Un studio clasic îți vinde un proiect de design. Interior Intelligence by PropManage construiește întregul proces: audit tehnic, Digital Twin al locuinței, arhitectură de interior, design, bugetare, implementare cu specialiști verificați, recepție și întreținere prin House Health. Un singur partener, responsabil de la prima măsurătoare la ultima garanție."},
        {"q": "Lucrați doar în Cluj sau în toată România?", "a": "Realizăm proiecte oriunde în România — remote pe bază de scanări, planuri și apeluri video, sau cu prezență la fața locului. Căutăm activ proiecte în zona Cluj-Napoca și Transilvania, unde putem gestiona lucrări complexe cap-coadă."},
        {"q": "Ce este Digital Twin și de ce am nevoie de el?", "a": "Digital Twin este copia digitală completă a locuinței: măsurători, planuri, instalații, materiale, finisaje, mobilier, istoricul intervențiilor, documente, garanții, fotografii și scanări. Orice proiect viitor pornește de la el — fără măsurători repetate, fără informații pierdute, fără surprize în spatele pereților."},
        {"q": "De ce e nevoie de audit înainte de design?", "a": "Auditul stabilește starea actuală, problemele tehnice, riscurile, posibilitățile de recompartimentare, starea instalațiilor și a structurii, eficiența energetică și prioritățile. Proiectarea fără audit înseamnă decizii pe presupuneri — cea mai scumpă greșeală din renovări."},
        {"q": "Cât costă un proiect de design interior?", "a": "Proiectele de concept pornesc de la 25-35 lei/mp, cele standard cu randări 3D între 45-80 lei/mp, iar proiectele complete cu planșe tehnice și asistență la implementare ajung la 80-150 lei/mp. Auditul și scanarea Digital Twin se ofertează separat, în funcție de suprafață. Primești oferte exacte, gratuit, după completarea formularului."},
        {"q": "Pot lua doar designul, fără implementare?", "a": "Da. Procesul este modular: poți alege doar consultanța, doar auditul, doar proiectul de design sau pachetul complet cu management de implementare. Recomandarea noastră rămâne procesul integrat — acolo se vede diferența reală."},
        {"q": "Cum sunt protejate plățile?", "a": "Prin escrow: banii sunt blocați în platformă și se eliberează către specialist doar după ce aprobi livrabilele fiecărei etape. Fiecare specialist din rețea este verificat — identitate, portofoliu, recenzii reale."},
        {"q": "Cât durează un proiect complet?", "a": "Conceptul și randările durează 2-4 săptămâni pentru un apartament. Un proces complet — audit, Digital Twin, proiectare, implementare — durează realist între 2 și 4 luni în funcție de complexitate. Fiecare etapă are livrabile și termene clare, urmărite în platformă."},
    ],
    "styles": ["Warm Minimalism", "Japandi", "Organic Modern", "Quiet Luxury", "Modern Mediterranean",
               "Scandinavian Contemporary", "Contemporary Industrial", "Modern Classic", "Biophilic Design",
               "Wabi Sabi Contemporary", "Themed Design", "Eclectic"],
    "budgets": ["sub 5.000 lei", "5.000 – 15.000 lei", "15.000 – 40.000 lei", "40.000 – 100.000 lei", "peste 100.000 lei"],
    "local_cities": ["Cluj-Napoca", "București", "Brașov", "Sibiu", "Timișoara", "Iași", "Oradea", "Târgu Mureș"],
    "seo_article": [
        {"h2": "Ce este designul interior și de ce contează", "body": "Designul interior este disciplina care transformă un spațiu construit într-un loc funcțional, sănătos și frumos, adaptat felului în care trăiești. Nu înseamnă doar „decorare”: un proiect profesionist de design interior pornește de la analiza nevoilor tale — cum gătești, cum lucrezi, cum te odihnești, câți sunteți în locuință — și traduce aceste nevoi în compartimentare, circulații, mobilier, materiale, culori și iluminat. Diferența dintre o amenajare făcută „după ochi” și una proiectată corect se vede în fiecare zi: depozitare suficientă, lumină acolo unde e nevoie, materiale care rezistă și un spațiu care nu trebuie refăcut după doi ani."},
        {"h2": "Digital Twin — fundamentul digital al oricărui proiect", "body": "Scanarea 3D a locuinței și construirea unui Digital Twin schimbă complet modul în care se face proiectarea. În loc de măsurători aproximative și planuri vechi, designerul și arhitectul de interior lucrează pe copia digitală exactă a spațiului: geometrie reală, trasee de instalații, materiale existente, istoric de intervenții. Erorile de proiectare scad dramatic, iar orice proiect viitor — o bucătărie nouă peste 3 ani, o recompartimentare, o vânzare — pornește de la date complete, nu de la zero. Digital Twin-ul devine cartea tehnică vie a proprietății."},
        {"h2": "Auditul locuinței — pasul pe care studiourile clasice îl sar", "body": "Majoritatea proiectelor de amenajare eșuează nu la estetică, ci la fundație: instalații vechi descoperite după demolare, pereți care nu pot fi mutați, bugete explodate de „surprize”. Auditul tehnic făcut înainte de proiectare stabilește starea actuală, problemele, riscurile, posibilitățile reale de recompartimentare și prioritățile de investiție. Costă puțin raportat la proiect și elimină categoric cele mai scumpe greșeli. Pe PropManage, rezultatele auditului intră direct în brief-ul de proiectare."},
        {"h2": "Avantajele colaborării cu un designer de interior", "body": "Primul avantaj este financiar: designerul te ferește de cele mai scumpe greșeli — canapeaua care nu încape, gresia care se pătează, bucătăria cu circulații blocate. Costul proiectului se recuperează de regulă din achizițiile evitate sau negociate. Al doilea avantaj este timpul: în loc de sute de ore pe site-uri de mobilier, primești o listă de achiziții curată, cu produse verificate și alternative pe bugete diferite. Al treilea este coerența: un profesionist gândește spațiul ca întreg. Iar al patrulea este accesul: furnizori, ateliere de mobilier la comandă și meșteri verificați, la prețuri pe care un client individual rar le obține."},
        {"h2": "Etapele unui proiect complet — de la audit la House Health", "body": "Procesul integrat are 17 etape grupate în 5 faze. Descoperire: consultanță inițială, audit tehnic, ridicare măsurători. Digitalizare: scanare Digital Twin, model 3D, planșe tehnice. Proiectare: arhitectură de interior, design interior, alegerea materialelor, soluții tehnice, bugetare. Implementare: management, coordonare echipe, verificarea execuției, recepția lucrării. Viață lungă: actualizarea Digital Twin și House Health — monitorizarea sănătății locuinței. Fiecare etapă are livrabile clare și plată protejată prin escrow."},
        {"h2": "Cât costă un proiect de design interior în România", "body": "Prețurile pieței în 2026 se împart în trei zone. Proiectele de concept (planuri de mobilare + moodboard) pornesc de la 25-35 lei/mp. Proiectele standard, cu randări 3D și liste de achiziții, se situează între 45-80 lei/mp. Proiectele premium, cu proiect tehnic complet, detalii de execuție și asistență pe șantier, ajung la 80-150 lei/mp. Pentru un apartament de 60 mp, asta înseamnă orientativ între 1.500 și 9.000 lei pentru proiectare — de regulă sub 5% din bugetul total de amenajare. Pe PropManage primești oferte personalizate gratuit și compari transparent prețurile."},
        {"h2": "Management de implementare — diferența dintre proiect și rezultat", "body": "Un PDF frumos nu montează gresie. Partea cea mai grea a oricărei amenajări este execuția: găsirea echipelor bune, compararea ofertelor, coordonarea ordinelor de lucru, verificarea calității. PropManage acoperă exact această zonă: cereri de ofertă către specialiști verificați, comparare transparentă, management de proiect, urmărirea etapelor în platformă, verificări de calitate documentate și recepție formală. Comunicarea rămâne centralizată, iar documentele și garanțiile se arhivează automat în Digital Twin."},
        {"h2": "Designer de interior sau arhitect — pe cine chemi?", "body": "Arhitectul proiectează și modifică structura: recompartimentări cu pereți structurali, extinderi, autorizații de construire. Designerul de interior lucrează în interiorul structurii existente: funcțiune, mobilier, finisaje, culori, iluminat, textile, decor. Pentru un apartament nou „la alb” sau o renovare fără modificări structurale, designerul este suficient. Pentru demolări de pereți sau mansardări ai nevoie de arhitect. Pe PropManage găsești ambele specializări și le poți combina în același proiect — cu auditul tehnic care stabilește din start ce e posibil."},
        {"h2": "Stiluri de amenajare — de la Warm Minimalism la Wabi Sabi", "body": "Nu credem în stiluri impuse. Warm Minimalism și Japandi domină apartamentele urbane: puține piese, texturi naturale, calm. Quiet Luxury crește în segmentul premium — materiale impecabile, zero ostentație. Organic Modern și Biophilic Design aduc natura în interior. Modern Mediterranean funcționează superb în case; Contemporary Industrial în lofturi. Modern Classic reinterpretează eleganța pentru case boierești, iar Wabi Sabi Contemporary celebrează autenticitatea și patina. Direcția se alege împreună, pe baza spațiului, luminii și felului în care trăiești — iar randările 3D o validează înainte de orice achiziție."},
        {"h2": "Servicii de design interior în Cluj-Napoca și Transilvania", "body": "Echipa noastră caută activ proiecte în Cluj-Napoca, Transilvania și împrejurimi — apartamente, case, spații rezidențiale complexe. Aici putem oferi procesul complet cu prezență la fața locului: audit tehnic, scanare Digital Twin, ridicare de măsurători, coordonare de echipe locale verificate și verificarea execuției pe șantier. Pentru restul țării — București, Brașov, Sibiu, Timișoara, Iași, Oradea, Târgu Mureș și orice altă localitate — lucrăm remote sau cu deplasare, cu aceleași standarde și aceeași protecție prin escrow."},
    ],
}
