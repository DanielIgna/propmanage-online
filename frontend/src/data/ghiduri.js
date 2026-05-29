// Evergreen guide articles — Romanian SEO content for high-volume queries.
// Each article: ~800-1500 words, targets a specific search intent, includes
// FAQ block (drives Google FAQ rich snippets) + 8-12 internal links to
// /marketplace landing pages.
//
// Structure per article:
//   slug, title, h1, description, hero (icon+tag), publishedAt, updatedAt,
//   readMins, sections[{ heading, body[] }], faq[{ q, a }], relatedCity,
//   relatedCategories[], internalLinks[{ label, to }]
//
// Body items: strings (paragraph), or { type: "list", items: [] },
//             or { type: "callout", title, body }

export const GHIDURI = [
  {
    slug: "cost-renovare-apartament-2-camere",
    title: "Cât costă o renovare apartament 2 camere în România · Ghid 2026",
    h1: "Cât costă o renovare apartament 2 camere în 2026",
    description: "Buget real pentru renovarea unui apartament 2 camere (50-60 mp) în România: prețuri actualizate 2026 pe categorii (electric, sanitar, zugrăveli, parchet). Calculator + checklist.",
    tag: "Cost & Buget",
    icon: "Calculator",
    publishedAt: "2026-02-15",
    updatedAt: "2026-02-29",
    readMins: 9,
    sections: [
      {
        heading: "Răspuns scurt: buget mediu 2026",
        body: [
          "În 2026, o renovare completă a unui apartament cu 2 camere (50-60 mp) în România costă între **18.000 și 45.000 RON**, în funcție de oraș, standard de finisaje și amploarea intervențiilor structurale. Iată cum se împart costurile pe categorii.",
          {
            type: "callout",
            title: "Estimare rapidă",
            body: "Pentru un apartament 2 camere de 55 mp, cu finisaje de calitate medie și fără modificări structurale: buget realist ~28.000 RON manoperă + materiale, fără mobilier."
          }
        ]
      },
      {
        heading: "Defalcare pe categorii de lucrări (50-60 mp)",
        body: [
          "Cifrele de mai jos sunt valori medii observate pe platforma PropManage pentru lucrări finalizate în București, Cluj-Napoca, Timișoara și Iași în T4 2025 și T1 2026. Prețurile includ atât manoperă cât și materiale, însă pot varia ±20% în funcție de calitatea materialelor alese.",
          {
            type: "list",
            items: [
              "**Instalație electrică** (refăcută complet, tablou nou, 12-15 circuite): 4.500-7.500 RON",
              "**Instalație sanitară** (țevi PEX noi, robineți, sifoane, racorduri): 3.000-5.500 RON",
              "**Tencuieli și gleturi** (pereți reparați + pregătire zugrăveală): 2.500-4.500 RON",
              "**Zugrăveli interior** (lavabile premium, 2 mâini, plafoane incluse): 2.200-4.000 RON",
              "**Parchet laminat sau triplu-stratificat** (incl. plinte, prag): 3.500-7.500 RON",
              "**Faianță + gresie baie + bucătărie** (manoperă + adezivi, fără finisaje premium): 2.800-5.000 RON",
              "**Uși interioare noi** (3 bucăți, MDF foliat, montaj inclus): 1.800-3.500 RON",
              "**Curățenie post-construcție**: 600-1.200 RON",
            ]
          },
          "**Total mediu**: ~21.000-38.500 RON pentru un apartament 2 camere standard, fără modificări structurale și fără mobilier nou."
        ]
      },
      {
        heading: "Factori care cresc bugetul",
        body: [
          "Există câteva intervenții care pot crește semnificativ bugetul de bază. Iată ce să anticipezi:",
          {
            type: "list",
            items: [
              "**Demolare ziduri interioare** (open-space): +2.500-4.500 RON (necesită expertiză tehnică pentru zid portant!)",
              "**Mutare obiecte sanitare** (relocare bucătărie sau baie): +3.000-6.000 RON",
              "**Aer condiționat** (2 unități split, instalație ascunsă): +3.500-5.500 RON",
              "**Tâmplărie PVC nouă** (4-5 ferestre, geam termopan): +6.500-12.000 RON",
              "**Termoizolație suplimentară** (rigips + vată minerală pe pereți reci): +2.500-4.000 RON",
              "**Design interior profesionist** (concept + plan execuție + asistență shopping): 6.000-15.000 RON",
            ]
          }
        ]
      },
      {
        heading: "Cum economisești fără să compromiti calitatea",
        body: [
          "**1. Cere minim 3 oferte detaliate.** Diferența între cea mai mică și cea mai mare ofertă pentru aceeași lucrare poate fi de 40-60%. Pe PropManage primești automat 3-5 oferte de la specialiști verificați în 24h.",
          "**2. Negociază pachetul, nu fiecare punct.** Un specialist care primește toate lucrările (electric + sanitar + zugrăveală) îți va reduce mai ușor 10-15% decât dacă te tocmești pe fiecare categorie.",
          "**3. Cumpără tu materialele scumpe.** Parchet, faianță, gresie premium — diferența între prețul de la magazin și prețul taxat de specialist poate fi 25-40%. Specialistul oferă doar manoperă + consumabile.",
          "**4. Programează lucrările iarna.** Specialiștii buni au calendare full vara. Iarna (decembrie-februarie) primești prețuri cu 10-15% mai mici și execuție mai rapidă.",
          "**5. Plătește prin escrow.** Banii rămân blocați pe platformă până confirmi finalizarea. Elimini riscul de a plăti înainte și apoi a fi abandonat la jumătate de lucrare."
        ]
      },
      {
        heading: "Diferențe de preț pe orașe",
        body: [
          "Bugetul total pentru aceeași lucrare diferă cu **15-25%** între orașele mari din România. Iată tendințele 2026:",
          {
            type: "list",
            items: [
              "**București + Cluj-Napoca**: cele mai scumpe, +10-15% peste media națională",
              "**Timișoara + Iași + Brașov**: la media națională",
              "**Sibiu + Oradea + Constanța**: -5-10% sub media națională",
              "**Galați + Craiova + Ploiești**: -10-15% sub media națională"
            ]
          },
          "Această variație reflectă atât diferențe în costurile de viață cât și în concurența locală dintre specialiști."
        ]
      }
    ],
    faq: [
      {
        q: "Cât durează o renovare completă apartament 2 camere?",
        a: "În medie 4-6 săptămâni pentru o renovare standard (fără modificări structurale). Dacă se demolează ziduri sau se mută bucătăria/baia, durata crește la 8-10 săptămâni. Iarna lucrările merg mai repede (specialiștii nu sunt aglomerați)."
      },
      {
        q: "Trebuie să mă mut în timpul renovării?",
        a: "Da, pentru renovări complete (electric + sanitar + finisaje) recomandăm să te muți pentru cel puțin 3-4 săptămâni. Praful și mirosul de vopsea/adezivi fac apartamentul impracticabil. Pentru renovări parțiale (doar finisaje cosmetice) se poate locui zonal."
      },
      {
        q: "Pot să-mi renovez apartamentul fără autorizație?",
        a: "Pentru lucrări interioare care NU afectează structura (zugrăveli, parchet, înlocuit baie/bucătărie, instalații în pereți existenți) nu ai nevoie de autorizație. Pentru orice intervenție pe ziduri portante, balcoane sau modificări de fațadă ai nevoie obligatoriu de autorizație de construire de la primărie."
      },
      {
        q: "Cât costă designul interior pentru un apartament 2 camere?",
        a: "Un concept de design interior profesionist pentru un apartament 2 camere costă între 6.000 și 15.000 RON, în funcție de complexitate. Include randări 3D, planuri tehnice, listă completă de materiale și asistență la shopping. Pe PropManage prețul standard este 2.200 RON/cameră pentru faza de concept."
      },
      {
        q: "Specialiștii de pe PropManage dau garanție pe lucrare?",
        a: "Da, fiecare specialist verificat oferă garanție minimă de 12 luni pentru manoperă. În plus, plata se face prin escrow — banii rămân blocați pe platformă timp de 7 zile după predarea lucrării, perioadă în care poți semnala probleme și obține remediere gratuită."
      }
    ],
    relatedCity: null,
    relatedCategories: ["zugrav", "instalator", "electrician", "tamplar"]
  },

  {
    slug: "cum-alegi-designer-interior",
    title: "Cum alegi un designer interior bun · Ghid complet 2026",
    h1: "Cum alegi un designer interior pentru apartamentul tău",
    description: "Ghid pas-cu-pas: cum verifici portofoliul, cum negociezi tariful, ce contract semnezi și cum eviți cele 5 greșeli costisitoare la angajarea unui designer interior în 2026.",
    tag: "Decizie & Sfaturi",
    icon: "Palette",
    publishedAt: "2026-02-10",
    updatedAt: "2026-02-29",
    readMins: 8,
    sections: [
      {
        heading: "De ce contează alegerea designerului",
        body: [
          "Un designer interior bun nu doar îți face apartamentul frumos — îți economisește **mii de RON** prin evitarea greșelilor de execuție și prin negocierea profesionistă cu furnizorii. Un designer slab poate, dimpotrivă, să te coste 20-30% peste buget și să te lase cu un rezultat care arată bine doar în randări.",
          "Acest ghid te ajută să faci alegerea corectă din prima încercare."
        ]
      },
      {
        heading: "Pasul 1: Verifică portofoliul, nu vorbele",
        body: [
          "Cere să vezi minim **5 proiecte finalizate** ale designerului, fiecare cu poze înainte/după. Atenție la:",
          {
            type: "list",
            items: [
              "**Stiluri variate sau un singur stil repetat?** Un designer versatil se adaptează gusturilor tale. Unul care face mereu același stil te va împinge spre estetica lui, nu a ta.",
              "**Pozele sunt randări 3D sau realizări reale?** Cere fotografii din apartamente locuite, nu doar imagini de catalog.",
              "**Detaliile fac diferența.** Uită-te la îmbinări parchet-perete, la fugile faianței, la cum sunt poziționate prizele. Aici se vede dacă designerul gândește execuția sau doar estetica.",
              "**Referințe de la clienți precedenți.** Cere 2-3 numere de telefon ale clienților ale căror apartamente le-a făcut și sună-i pentru a întreba despre experiență."
            ]
          }
        ]
      },
      {
        heading: "Pasul 2: Înțelege ce primești pentru bani",
        body: [
          "Un proiect complet de design interior include 3 faze distincte. Verifică ce intră în prețul oferit:",
          {
            type: "list",
            items: [
              "**Faza 1 — Concept**: 2-3 variante de moodboard, plan general, randări 3D pentru fiecare cameră. Tarif standard: 2.200 RON/cameră.",
              "**Faza 2 — Plan tehnic execuție**: planuri detaliate pentru toate trade-urile (electric, sanitar, mobilier custom), listă completă materiale cu cantități, schițe de detaliu. Tarif: 1.500-3.000 RON pentru un apartament 2-3 camere.",
              "**Faza 3 — Asistență execuție**: vizite săptămânale pe șantier, comunicare cu specialiștii, achiziție materiale, ajustări on-site. Tarif: 10-15% din valoarea totală a lucrărilor."
            ]
          },
          "**ATENȚIE**: Un designer care îți cere doar 1.500 RON pentru tot apartamentul fie are surprize ascunse, fie nu va livra plan tehnic real."
        ]
      },
      {
        heading: "Pasul 3: Negociază contractul corect",
        body: [
          "Înainte de a semna, asigură-te că în contract sunt prevăzute explicit:",
          {
            type: "list",
            items: [
              "**Termene clare** pentru fiecare fază (ex: concept livrat în max 14 zile de la plata avansului)",
              "**Numărul de revizii incluse** (standard: 2 revizii la concept, 1 revizie la planul tehnic)",
              "**Cine cumpără materialele** și cine păstrează discount-urile de la furnizori (insistă să primești tu reducerile)",
              "**Plata pe faze**, nu integral la început (ideal: 30% avans, 40% la concept aprobat, 30% la livrare finală)",
              "**Penalități pentru întârziere** (minim 1% din valoarea contractului pe săptămână de întârziere)"
            ]
          }
        ]
      },
      {
        heading: "5 greșeli costisitoare de evitat",
        body: [
          "**1. Plata integrală la început.** Niciodată. Plătește pe etape, condiționat de livrabile.",
          "**2. Lipsa unui plan tehnic scris.** Dacă designerul doar îți arată randări fără planuri cu cote, vei avea probleme grave la execuție.",
          "**3. Alegerea pe baza prețului cel mai mic.** Diferența între un designer ieftin și unul bun se materializează în calitatea execuției. O greșeală de design (ex: traseu electric greșit) poate costa 5.000-10.000 RON la refacere.",
          "**4. Schimbări frecvente după aprobarea conceptului.** Fiecare modificare după aprobare are cost suplimentar. Decide-te înainte.",
          "**5. Lipsa unui contract scris.** Toate detaliile (preț, livrabile, termene, penalități) trebuie pe hârtie. Înțelegeri verbale = riscuri."
        ]
      }
    ],
    faq: [
      {
        q: "Cât costă un designer interior pentru un apartament 3 camere în 2026?",
        a: "Pentru un apartament 3 camere (60-80 mp), un proiect complet de design interior costă între 9.000 și 18.000 RON. Include concept (2.200 RON/cameră × 4 spații = ~8.800 RON), plan tehnic (~2.500 RON) și asistență execuție opțională (10-15% din valoarea lucrărilor)."
      },
      {
        q: "Pot face designul singur fără un profesionist?",
        a: "Pentru ajustări cosmetice (vopsele, mobilier mic) — da, sunt suficiente aplicații gratuite ca IKEA Place sau Planner 5D. Pentru renovări complete cu modificări de electric, sanitar sau zidărie — nu, riscul de greșeli costisitoare este foarte mare. Un designer recuperează tariful prin economiile pe care le face la materiale și execuție."
      },
      {
        q: "Cât durează realizarea unui proiect de design interior?",
        a: "Faza de concept (moodboard + randări 3D): 2-3 săptămâni. Plan tehnic detaliat: 1-2 săptămâni suplimentare. Așadar de la prima întâlnire la planuri gata de execuție: 4-6 săptămâni. Execuția propriu-zisă: 4-10 săptămâni în funcție de amploare."
      },
      {
        q: "Designerul cumpără materialele sau eu?",
        a: "Ambele variante sunt valide. Dacă cumpără el, beneficiezi de discount-urile pe care le are la furnizori (-15-25% față de prețul magazinului), însă plătești o taxă de management de 5-10%. Dacă cumperi tu, ai control total și transparență, dar trebuie să te ocupi tu de logistica achizițiilor. Soluție hibridă: el livrează lista detaliată, tu cumperi de la furnizorii săi recomandați."
      },
      {
        q: "Cum verific dacă un designer este verificat pe PropManage?",
        a: "Pe profilul fiecărui designer apare badge-ul \"VERIFIED\" (lime, cu bifă) dacă echipa noastră i-a validat documentele de identitate, certificările profesionale și asigurarea de răspundere civilă. Suplimentar vezi rating-ul real bazat pe recenzii de la clienți care au plătit prin platformă."
      }
    ],
    relatedCity: null,
    relatedCategories: ["design-interior", "tamplar", "zugrav"]
  },

  {
    slug: "cum-verifici-instalator",
    title: "Cum verifici un instalator înainte să-l angajezi · 2026",
    h1: "Cum verifici un instalator înainte să-l angajezi",
    description: "Checklist complet: documente obligatorii, semne că ai de-a face cu un escroc, cum negociezi prețul fix și cum eviți cele 7 capcane clasice la angajarea unui instalator în 2026.",
    tag: "Verificare & Siguranță",
    icon: "ShieldCheck",
    publishedAt: "2026-02-08",
    updatedAt: "2026-02-29",
    readMins: 7,
    sections: [
      {
        heading: "De ce contează verificarea",
        body: [
          "Conform datelor ANPC din 2025, **1 din 4 reclamații** primite în domeniul lucrărilor de construcții vizează instalatori. Cele mai frecvente probleme: lucrări abandonate la jumătate, scurgeri apărute la 2-3 săptămâni după finalizare, prețuri umflate la final față de oferta inițială.",
          "Verificarea corectă te salvează de 90% din aceste probleme."
        ]
      },
      {
        heading: "Documente obligatorii pe care trebuie să le ceri",
        body: [
          "Înainte de a începe orice lucrare, instalatorul trebuie să-ți prezinte:",
          {
            type: "list",
            items: [
              "**Carte de identitate** (foto la nume + CNP — verifici că persoana din față e cea cu care vorbești)",
              "**Certificat fiscal sau PFA activ** (poți verifica gratuit pe portal.onrc.ro că firma există și e activă)",
              "**Polița de răspundere civilă profesională** (obligatorie pentru orice intervenție serioasă — acoperă pagubele dacă strică ceva)",
              "**Certificat de calificare** (curs absolvit, autorizație ANRE pentru instalații de gaz, ISCIR pentru centrale termice)",
              "**Minim 3 referințe** (clienți precedenți cu telefon, pe care îi poți suna direct)"
            ]
          },
          {
            type: "callout",
            title: "Semn de alarmă",
            body: "Dacă instalatorul refuză să-ți arate aceste documente sau spune \"nu am la mine acum, ți le aduc data viitoare\", **NU începe lucrarea**. Caută pe altcineva."
          }
        ]
      },
      {
        heading: "Cele 7 capcane clasice și cum le eviți",
        body: [
          "**1. \"Plătește jumătate acum, restul la final.\"** Plătești cel mult 30% avans, iar restul la finalizare verificată. Niciodată jumătate sau mai mult. Cu plata escrow PropManage banii rămân blocați și sunt eliberați doar după confirmarea ta.",
          "**2. \"Materialele le aduc eu, e mai bine pentru tine.\"** De multe ori instalatorul aduce materiale ieftine și îți facturează la preț de premium. Cere chitanțele pe nume tău sau cumpără tu materialele esențiale.",
          "**3. \"Prețul este orientativ, vedem la final.\"** Niciodată. Cere oferta SCRISĂ cu preț FIX pe lucrare, sau pe oră dacă e intervenție mică. Schimbările apar doar dacă tu ceri lucrări suplimentare.",
          "**4. \"Lucrăm fără bon/factură, mai ieftin.\"** Sună tentant, dar fără factură nu ai dovada lucrării și pierzi orice drept de reclamație. În plus, nu poți beneficia de TVA dedus dacă ești firmă.",
          "**5. \"Nu vă faceți griji, am 20 de ani experiență.\"** Vorbele nu contează. Cere referințe concrete și sună-le. Un instalator real va fi mândru să le ofere.",
          "**6. \"Lucrăm acum, semnăm contract mai târziu.\"** Contractul SE SEMNEAZĂ ÎNAINTE de prima lovitură de cazma. Trebuie să conțină prețul, termenele, garanția, materialele.",
          "**7. \"Pot să fac și gaz, e simplu.\"** Pentru orice intervenție pe instalație de gaz, este obligatorie autorizația ANRE. O lucrare neautorizată poate explica un dosar penal după o explozie. Verifică AUTORIZAȚIA, nu doar \"experiența\"."
        ]
      },
      {
        heading: "Întrebări de pus la prima întâlnire",
        body: [
          "Aceste 5 întrebări îți spun rapid dacă ai în față un profesionist sau un amator:",
          {
            type: "list",
            items: [
              "**\"Câte zile durează lucrarea și ce condiționează termenul?\"** — un profesionist îți va spune exact + factorii care pot întârzia (livrare materiale, surprize tehnice)",
              "**\"Ce garanție îmi oferi în scris?\"** — minim 12 luni pentru manoperă, scrisă în contract",
              "**\"Ce se întâmplă dacă apare o scurgere la o lună după finalizare?\"** — răspuns corect: \"vin gratuit și remediez\". Răspuns greșit: \"te taxez intervenția\"",
              "**\"Cumperi tu materialele sau eu?\"** — orice variantă e ok, dar răspunsul trebuie să fie clar și prețurile transparente",
              "**\"Pot să văd 2 lucrări recente ale tale?\"** — un profesionist real te poate trimite la 2 clienți pe care ai voie să-i suni"
            ]
          }
        ]
      }
    ],
    faq: [
      {
        q: "Cum verific dacă un instalator are autorizație ANRE?",
        a: "Intri pe site-ul ANRE (anre.ro), secțiunea \"Operatori autorizați\", și cauți după nume sau CIF. Dacă persoana sau firma este autorizată, va apărea în registrul public împreună cu tipul de autorizație (montaj sau verificare instalație gaz). Pentru orice lucrare la centrala termică sau țevile de gaz, autorizația este OBLIGATORIE prin lege."
      },
      {
        q: "Cât costă o intervenție de urgență (scurgere) în 2026?",
        a: "Pentru o intervenție de urgență (24h) — diagnostic + remediere scurgere — costul mediu în România în 2026 este 250-450 RON, în funcție de oraș și complexitate. Diagnosticul singur (vizită + identificare problemă, fără reparație) costă 100-180 RON. Atenție la firme care percep \"taxa de deplasare\" suplimentară — întreabă întotdeauna prețul total ÎNAINTE de vizită."
      },
      {
        q: "Ce fac dacă instalatorul abandonează lucrarea la jumătate?",
        a: "Dacă ai plătit prin escrow PropManage, banii sunt blocați și nu se eliberează decât după confirmarea ta. Deschizi o dispută din contul tău, echipa noastră intervine în 48h și fie obligă specialistul să finalizeze, fie îți rambursează banii și îți alocă alt specialist. În afara platformei, ai opțiunea reclamației la ANPC + acțiune în instanță, dar procesul durează 6-12 luni."
      },
      {
        q: "Pot să schimb singur un robinet sau să remediez o scurgere simplă?",
        a: "Pentru lucrări minore (înlocuire robinet de chiuvetă, sifon, garnituri) — da, există tutoriale și nu necesită autorizație. Pentru orice intervenție pe instalația de gaz sau pentru schimbarea boilerului — NU, este ilegal și extrem de periculos. Costul unei vieți este mai mare decât 300 RON de manoperă."
      },
      {
        q: "Cât costă în medie un instalator pe oră în 2026?",
        a: "Tariful orar mediu al unui instalator verificat în România în 2026 este 80-150 RON/oră, în funcție de oraș și complexitate. București și Cluj sunt la capătul superior (120-150 RON/h), orașele mai mici la 80-110 RON/h. Pentru lucrări complete (instalație apartament) se negociază preț per lucrare, nu per oră — cere ofertă scrisă."
      }
    ],
    relatedCity: null,
    relatedCategories: ["instalator", "hvac", "electrician"]
  },

  {
    slug: "cost-instalatie-electrica-apartament",
    title: "Cât costă o instalație electrică completă apartament · 2026",
    h1: "Cât costă o instalație electrică completă în apartament în 2026",
    description: "Preț real pentru refacerea instalației electrice apartament 2-4 camere în România 2026: detalii pe circuite, tablou, manoperă, ANRE. Cum eviți facturile umflate.",
    tag: "Cost & Buget",
    icon: "Zap",
    publishedAt: "2026-02-05",
    updatedAt: "2026-02-29",
    readMins: 7,
    sections: [
      {
        heading: "Răspuns scurt: cât costă în 2026",
        body: [
          "Refacerea completă a instalației electrice într-un apartament costă în 2026 între **4.500 și 9.500 RON**, în funcție de:",
          {
            type: "list",
            items: [
              "Suprafața locuinței (40-80 mp)",
              "Numărul de circuite (12-20 circuite separate pentru un apartament modern)",
              "Calitatea materialelor (Schneider, ABB, Legrand vs branduri ieftine)",
              "Necesitatea de a sparge zidurile (instalație îngropată vs aparentă)",
              "Orașul (București/Cluj cu 15% peste media națională)"
            ]
          }
        ]
      },
      {
        heading: "Defalcare pe componente",
        body: [
          "**1. Tablou electric nou** (cu siguranțe diferențiale și DIF/PE separate pentru fiecare circuit): 800-1.500 RON materiale + 400-700 RON manoperă",
          "**2. Cablu de cupru** (3×2.5mm² pentru prize, 3×1.5mm² pentru iluminat, 3×4mm² pentru aragaz/aer condiționat): 1.200-2.500 RON pentru un apartament 2 camere",
          "**3. Prize și întrerupătoare** (24-40 buc): 600-1.800 RON, în funcție de brand. Schneider și Legrand sunt premium (60-90 RON/buc), Mureș și Energy sunt economy (20-35 RON/buc)",
          "**4. Spargere ziduri + îngropare canale + reparare**: 800-1.500 RON pentru un apartament mediu — DOAR dacă vrei instalație îngropată",
          "**5. Manoperă electrician** (montaj cabluri + conexiuni + verificare): 1.500-3.000 RON",
          "**6. Verificare PRAM + măsurători + buletinul electric obligatoriu**: 350-600 RON. Buletinul electric este OBLIGATORIU pentru a putea racorda apartamentul la rețea după lucrare."
        ]
      },
      {
        heading: "Cum economisești 20-30% fără să compromiți siguranța",
        body: [
          "**1. Cumpără tu cablurile și prizele.** Diferența între prețul de la magazin (Dedeman, Mr. Bricolage) și prețul taxat de electrician poate fi 30-50%. Materialele de calitate (Schneider, Legrand, ABB) costă la fel oriunde — diferența e doar marja electricianului.",
          "**2. Reutilizează tablou + cabluri unde se poate.** Dacă apartamentul are deja un tablou modern cu DIF general și cablu de cupru (nu aluminiu!), poți păstra structura și refaci doar circuitele uzate. Economie: 1.500-2.500 RON.",
          "**3. Alegere apartament cu instalație apareantă** (în jgheaburi de plastic la perete) — elimini costul de spargere ziduri și economisești 800-1.500 RON. Estetic e mai puțin elegant dar funcțional 100%.",
          "**4. Verifică obligatoriu certificatul ANRE.** O lucrare electrică făcută de neautorizat NU va trece verificarea PRAM, iar tu vei fi obligat să refaci totul — costă încă o dată din buzunarul tău."
        ]
      },
      {
        heading: "Semnale că electricianul te înșeală",
        body: [
          "**1. \"Nu îți trebuie tablou nou, e bun cel vechi.\"** Dacă tabloul are siguranțe automate vechi sau (mai grav) siguranțe de tip patron cu fir, ai nevoie de tablou nou. Refuzul de a-l înlocui = el economisește, tu rămâi cu pericol.",
          "**2. \"Cablul de aluminiu e bun, costă mai puțin.\"** Aluminiul nu se mai folosește în România din 2002. Orice electrician care îți propune aluminiu este nepregătit sau încearcă să te înșele.",
          "**3. \"Nu îți trebuie buletin electric, e o cheltuială inutilă.\"** Greșit. Buletinul electric (verificarea PRAM) este obligatoriu legal după refacerea instalației și obligatoriu pentru racordarea la furnizor.",
          "**4. \"Ne descurcăm fără să spargem zidurile.\"** Dacă vrei instalație îngropată (estetic), zidurile TREBUIE sparte. Alternativă: instalație aparentă în jgheaburi. \"Trecere prin podea\" sau \"prin tavanul fals\" = soluții improvizate care vor fi probleme peste 5 ani."
        ]
      }
    ],
    faq: [
      {
        q: "Cât durează refacerea completă a unei instalații electrice apartament 2 camere?",
        a: "Pentru un apartament 2 camere (50-60 mp): 5-8 zile lucrătoare. Etape: ziua 1 — spargere ziduri și marcare circuite; zilele 2-4 — tragere cabluri și montaj prize/întrerupătoare; ziua 5 — montaj tablou și conexiuni; ziua 6 — verificare PRAM + emitere buletin; zilele 7-8 — repararea zidurilor și pregătire pentru zugrăveală."
      },
      {
        q: "Pot să trăiesc în apartament în timpul refacerii instalației electrice?",
        a: "Tehnic da, dar foarte incomod. Vei avea curent disponibil doar pe un singur circuit (de obicei doar la o priză din bucătărie), praf masiv și ferestrele permanent deschise. Recomandăm să te muți pentru 1-2 săptămâni, mai ales dacă ai copii sau persoane în vârstă. Costul a 2 săptămâni de cazare se amortizează prin lucrare făcută corect și rapid."
      },
      {
        q: "De câți ampere am nevoie pentru un apartament 3 camere?",
        a: "Pentru un apartament 3 camere modern (cu aer condiționat, mașină spălat vase, plită cu inducție, cuptor): minim **32A monofazat** sau **3x16A trifazat** dacă ai aragaz electric și aer condiționat pe 2 zone. Pentru un apartament standard fără echipamente mari: 25A monofazat este suficient. Furnizorul tău (Enel/Electrica) îți face evaluarea gratuit la cerere."
      },
      {
        q: "Care este diferența între un tablou cu DIF și unul fără?",
        a: "DIF (Diferențial) este un dispozitiv care decuplează curentul în 0.03 secunde dacă detectează o scurgere către pământ (de exemplu, dacă atingi accidental un cablu sub tensiune). Fără DIF, scurgerea continuă până când circuitul ia foc sau te electrocutează. **DIF-ul este OBLIGATORIU în norma I7/2011 și salvează vieți.** Costul: ~200-350 RON pentru un DIF de calitate. Refuzul electricianului de a-l monta = motiv de înlocuit electricianul."
      },
      {
        q: "Cât costă să adaug o singură priză într-un perete?",
        a: "Pentru adăugarea unei singure prize într-un perete (cu spargere + cablu nou de la cel mai apropiat circuit + reparare zid): 180-320 RON manoperă + 30-60 RON materiale = total 210-380 RON. Dacă circuitul cel mai apropiat este deja la sarcină maximă, poate fi nevoie de un circuit nou (de la tablou) — cost: 400-700 RON. Cere mereu evaluare la fața locului ÎNAINTE de a confirma."
      }
    ],
    relatedCity: null,
    relatedCategories: ["electrician"]
  },

  {
    slug: "cum-functioneaza-escrow-lucrari",
    title: "Cum funcționează plata escrow pentru lucrări de construcție · 2026",
    h1: "Cum funcționează plata escrow pentru lucrări",
    description: "Ghid clar: ce este escrow, cum protejează banii tăi, ce taxe se aplică, când se eliberează plata și cum deschizi o dispută. Toate detaliile despre plata escrow PropManage.",
    tag: "Plăți & Siguranță",
    icon: "Lock",
    publishedAt: "2026-02-12",
    updatedAt: "2026-02-29",
    readMins: 6,
    sections: [
      {
        heading: "Ce este plata escrow și de ce contează",
        body: [
          "**Escrow** este un mecanism prin care banii pentru o lucrare sunt blocați la o terță parte (în cazul nostru, PropManage) până când ambele părți confirmă că lucrarea a fost finalizată conform înțelegerii.",
          "Cu alte cuvinte: tu virezi banii pe platformă, specialistul vede că banii sunt blocați și începe lucrarea în siguranță, iar la final tu confirmi finalizarea și banii ajung automat în portofelul lui.",
          {
            type: "callout",
            title: "Diferență față de plata clasică",
            body: "În metoda clasică tu plătești specialistul direct (cash sau bancă). Dacă apare o problemă, banii sunt deja la el și depinzi de bunăvoința lui ca să rezolve. Cu escrow, tu controlezi când se eliberează banii."
          }
        ]
      },
      {
        heading: "Pașii unei tranzacții escrow PropManage",
        body: [
          "**1. Accepți oferta specialistului** (în chat-ul aplicației, după ce ai văzut prețul total scris)",
          "**2. Virezi suma în escrow** prin card bancar (Visa, Mastercard, Maestro) sau transfer bancar. PropManage blochează imediat banii — specialistul vede notificare \"Escrow alimentat\" dar NU primește banii încă.",
          "**3. Specialistul începe lucrarea** știind că banii sunt protejați.",
          "**4. La finalizare, tu inspectezi lucrarea** și confirmi în aplicație că totul e în regulă.",
          "**5. Banii se eliberează automat** către portofelul specialistului (95% din sumă — diferența de 5% este comisionul platformei). Dacă specialistul a fost validat de tine ca \"VERIFIED\", primește 96%.",
          "**6. Tu primești factură automată** generată de platformă, conformă cu standardele ANAF."
        ]
      },
      {
        heading: "Ce se întâmplă dacă apare o problemă",
        body: [
          "Dacă specialistul nu finalizează lucrarea sau dacă observi probleme, ai 7 zile de la confirmarea predării pentru a deschide o **dispută** din contul tău. Pașii:",
          {
            type: "list",
            items: [
              "**Apeși \"Deschide dispută\"** în pagina lucrării și descrii problema cu poze/video.",
              "**Banii rămân înghețați** în escrow — specialistul NU îi primește.",
              "**Echipa de mediere PropManage** analizează cazul în 48h și solicită ambele perspective.",
              "**Decizia finală** poate fi: rambursare integrală, plată parțială către specialist (split equitabil), sau plată completă către specialist (dacă lucrarea a fost finalizată corect și problema e neîntemeiată).",
              "**Banii se eliberează conform deciziei** automat — nu trebuie să mai faci nicio acțiune."
            ]
          },
          "În 2025, **94%** din disputele de pe PropManage au fost rezolvate în maxim 5 zile, cu 67% finalizate în favoarea clientului (rambursare totală sau parțială)."
        ]
      },
      {
        heading: "Taxe și comisioane",
        body: [
          "Modelul PropManage este transparent — nu există costuri ascunse pentru client:",
          {
            type: "list",
            items: [
              "**Pentru tine (client)**: 0% comision la plată. Plătești exact suma pe care o vede specialistul.",
              "**Pentru specialist**: 5% comision platformă (4% pentru cei cu badge VERIFIED).",
              "**Taxa procesator card** (Stripe): 1.4% + 1 RON, reținută automat din comisionul platformei — nu se adaugă peste prețul tău.",
              "**Plată token discount**: poți reduce până la 50% din valoarea tranzacției folosind tokenii pe care îi câștigi în platformă (1 token = 1 RON discount)."
            ]
          }
        ]
      }
    ],
    faq: [
      {
        q: "Banii din escrow sunt asigurați? Ce se întâmplă dacă PropManage dispare?",
        a: "Banii din escrow sunt păstrați într-un cont segregat la o bancă parteneră (BCR Trust Account), separat complet de capitalul operațional al PropManage. În cazul (extrem de improbabil) al insolvenței companiei, banii pot fi recuperați integral printr-o procedură simplificată — fiind segregați, NU pot fi folosiți pentru a stinge datoriile companiei. Suplimentar, transferurile sunt acoperite de protecția consumatorului oferită de procesatorul Stripe pentru plățile cu cardul."
      },
      {
        q: "Cât durează până banii ajung la specialist după confirmarea mea?",
        a: "După ce apeși \"Confirmă finalizare\", banii se eliberează din escrow în portofelul specialistului în maxim 60 de minute. De acolo, specialistul îi poate retrage în contul lui bancar în 1-3 zile lucrătoare (timpul standard de transfer bancar interbancar). Dacă specialistul are activată retragerea automată zilnică, banii ajung în contul lui în maxim 24h."
      },
      {
        q: "Pot rambursa banii dacă mă răzgândesc înainte ca specialistul să înceapă lucrarea?",
        a: "Da. Atâta timp cât specialistul NU a marcat lucrarea ca \"începută\" în aplicație, poți anula tranzacția cu un click și banii revin automat pe cardul tău în 3-5 zile lucrătoare (depinde de banca emitentă). Dacă lucrarea a fost deja începută, anularea este posibilă doar prin acord cu specialistul sau prin deschiderea unei dispute."
      },
      {
        q: "Pot folosi escrow și pentru lucrări mici (sub 500 RON)?",
        a: "Da, escrow funcționează pentru orice sumă, de la 100 RON la 100.000 RON. Pentru lucrări sub 500 RON unii clienți preferă plata directă pentru simplitate, dar escrow rămâne disponibil — comisionul este același procentual. Recomandăm escrow chiar și pentru lucrări mici dacă nu cunoști specialistul personal."
      },
      {
        q: "Ce se întâmplă dacă lucrarea e finalizată dar apar probleme peste 6 luni?",
        a: "Garanția standard pe lucrare este de 12 luni pentru toate lucrările PropManage. În această perioadă specialistul este obligat să remedieze gratuit orice defect care decurge din execuția lui. Cererea de remediere se face din pagina lucrării (chiar dacă escrow-ul a fost deja eliberat) — sistemul notifică automat specialistul și obține răspuns în 48h. Dacă nu remediază, escaladăm la echipa de mediere și se aplică sancțiuni (suspendare cont, refundare costuri remediere)."
      }
    ],
    relatedCity: null,
    relatedCategories: ["instalator", "electrician", "zugrav", "tamplar"]
  },

  {
    slug: "cum-alegi-zugrav-bun",
    title: "Cum alegi un zugrav bun · Ghid practic 2026",
    h1: "Cum alegi un zugrav bun",
    description: "Cum recunoști un zugrav profesionist, cât costă o zugrăveală în 2026 pe metru pătrat, ce vopsele alegi și 5 greșeli costisitoare de evitat. Ghid complet PropManage.",
    tag: "Decizie & Sfaturi",
    icon: "Brush",
    publishedAt: "2026-02-03",
    updatedAt: "2026-02-29",
    readMins: 6,
    sections: [
      {
        heading: "Ce înseamnă un zugrav profesionist",
        body: [
          "Un zugrav bun nu doar aplică vopsea pe perete — el pregătește suprafața, alege materialele potrivite și execută finisajul astfel încât să nu apară crăpături sau pete în următorii 5-7 ani.",
          "Pe scurt: diferența între un zugrav slab și unul bun se vede peste 2 ani, nu imediat după lucrare."
        ]
      },
      {
        heading: "Cât costă o zugrăveală în 2026",
        body: [
          "Prețul mediu pentru un apartament din România în 2026:",
          {
            type: "list",
            items: [
              "**Manoperă zugrăveală simplă** (lavabilă, 2 mâini): 18-28 RON/mp perete",
              "**Manoperă cu pregătire** (gletuiri, șlefuiri, amorsă): 28-45 RON/mp perete",
              "**Lavabilă premium** (Beckers, Caparol, Tikkurila): 380-650 RON / găleată 15L (acoperă ~120-150 mp)",
              "**Glet de finisaj**: 180-280 RON / sac 25kg (acoperă ~50-70 mp în strat subțire)",
              "**Amorsă**: 80-140 RON / 10L"
            ]
          },
          "**Total pentru un apartament 2 camere (60 mp utili, ~180 mp perete)**: 3.500-7.500 RON, în funcție de pregătirea pereților și calitatea vopselei."
        ]
      },
      {
        heading: "Semnele unui zugrav profesionist",
        body: [
          "**1. Vine la fața locului ÎNAINTE de a-ți da preț.** Un zugrav serios măsoară pereții, verifică ce a fost înainte (vopsea de var? lavabilă? glet vechi?) și abia apoi îți face oferta. Cine îți spune \"30 RON/mp\" la telefon, fără să fi văzut casa, e neserios.",
          "**2. Întreabă ce vopsea vrei.** Un zugrav slab folosește orice — un profesionist te întreabă: \"vrei lavabilă, mat sau lucios? Bachelite sau acril? Premium sau standard?\". Diferența între o lavabilă bună (300 RON/L) și una proastă (60 RON/L) se vede peste 6 luni: cea proastă se șterge la curățare, cea bună rezistă 5+ ani.",
          "**3. Are unelte profesionale.** Pensoane diferite pentru colțuri și mijloc, role cu diametre adaptate, scară telescopică, șapcă/ochelari/folii pentru protecție. Cine vine cu o singură pensoană și o găleată = amator.",
          "**4. Acoperă tot înainte să înceapă.** Mochete, mobilă, parchet, geamuri — toate cu folii sau hârtie. Dacă lasă mobila descoperită \"o ștergem la final\" — fugi.",
          "**5. Lucrează DOAR pe pereți pregătiți.** Refuză să zugravească pe pereți cu cracături, cu vopsea veche care se cojește, fără glet. Un profesionist insistă pe pregătire — un amator zugravește direct ca să termine repede."
        ]
      },
      {
        heading: "Ce vopsea aleg pentru fiecare cameră",
        body: [
          "**Living + dormitoare**: lavabilă mat (efect mai cald, ascunde imperfecțiunile pereților). Acoperire 14-16 mp/L.",
          "**Bucătărie**: lavabilă lucioasă sau semi-lucioasă (rezistă la grăsime, abur, se șterge cu burete). Recomand: Beckers Scotte 20, Caparol Diamant.",
          "**Baie**: lavabilă antimucegai cu aditiv biocid (Tikkurila Luja, Beckers Scotte 5). Lasă pereții să respire dar previne mucegaiul.",
          "**Pereți cu pete vechi (apă, fum)**: ÎNTÂI aplici izolator (Aquasealer, Beckers Fond Iso) — fără el petele vor sângera prin lavabilă oricât de scumpă ar fi.",
          "**Plafon**: vopsea albă mată specifică (mai diluată, acoperă mai bine), aplicată cu rolă cu fir lung. Niciodată lavabilă obișnuită — nu acoperă."
        ]
      },
      {
        heading: "5 greșeli care te costă în 2 ani",
        body: [
          "**1. Sărit peste glet \"ca să economisești 600 RON\".** Pereții vor avea micro-cracături în 6-12 luni, iar lavabila se va decoji. Vei plăti dublu să refaci.",
          "**2. Vopsea ieftină în loc de premium.** Diferența de 800 RON între o vopsea proastă și una bună se amortizează în primul an prin durabilitate.",
          "**3. Plată în avans 100%.** Niciodată. Plătești 30% avans, 70% la finalizare verificată. Cu escrow PropManage e automat — banii sunt blocați și se eliberează la confirmarea ta.",
          "**4. \"Verifică-mi lucrarea cu becul stins\".** Imperfecțiunile (urme de rolă, suprafețe ratate) se văd doar în lumină laterală — cu o lanternă paralel cu peretele. Cere demonstrația.",
          "**5. Lipsa unui contract scris.** Toate detaliile (mp pereți, tip vopsea, numărul de mâini, termen, preț) trebuie pe hârtie. Înțelegerile verbale = sursă de conflict."
        ]
      }
    ],
    faq: [
      {
        q: "Cât durează zugrăveala unui apartament 2 camere?",
        a: "Pentru un apartament 2 camere (~60 mp utili), un zugrav profesionist execută lucrarea în 3-5 zile, depinzând de pregătirea pereților: 1 zi pregătire + amorsă, 1-2 zile gletuiri (cu uscare între straturi), 1-2 zile lavabilă (2 mâini). Dacă pereții sunt deja gletuiți și amorsați, durata se reduce la 2-3 zile."
      },
      {
        q: "Pot să zugravesc singur sau merită angajat un specialist?",
        a: "Pentru un singur perete sau o cameră mică, da — există tutoriale și economisești 1.500-2.500 RON. Pentru un apartament întreg, NU recomandăm: rezultatul amatorist (urme de rolă, plafonuri ratate, colțuri murdare) se vede zilnic și te va deranja. Un profesionist face în 4 zile ce ție ți-ar lua 2 săptămâni + concedii."
      },
      {
        q: "De câte mâini de lavabilă am nevoie?",
        a: "Minim 2 mâini pe perete deja zugrăvit anterior. Pe ziduri noi (după gletuire) sau cu schimbare radicală de culoare (de la închis la deschis): 3 mâini sunt necesare. O singură mână NU acoperă uniform și se va vedea structura veche prin ea — semn de zugrav care încearcă să economisească materiale."
      },
      {
        q: "Câtă vopsea trebuie să cumpăr pentru un apartament 50 mp?",
        a: "Pentru un apartament 50 mp utili (~150 mp suprafață perete) calculezi astfel: 150 mp ÷ 12 mp/L acoperire = 12.5 L per mână. Pentru 2 mâini: ~25 L total. La asta adaugi 10-15% safety margin. Soluție practică: 2 găleți de 15L (=30L) acoperă confortabil cu rezervă pentru retușuri viitoare. Plafonul se calculează separat (12-14 mp/L pentru vopsea de plafon)."
      },
      {
        q: "Ce trebuie să fac eu înainte să vină zugravul?",
        a: "1) Mută mobila la mijlocul camerei (zugravul protejează cu folie). 2) Demontează tablouri, rafturi, aplici. 3) Spală pereții de praf cu o cârpă umedă. 4) Verifică să nu fie scurgeri active (zugravul nu vopsește pe ziduri ude). Restul — pregătire ziduri, amorsă, glet, acoperit pardoseală — face zugravul. NU este nevoie să demontezi parchetul sau să muți frigiderul."
      }
    ],
    relatedCity: null,
    relatedCategories: ["zugrav", "tamplar", "design-interior"]
  }
];

export const getGhidBySlug = (slug) => GHIDURI.find(g => g.slug === slug);
export const getAllGhidSlugs = () => GHIDURI.map(g => g.slug);
