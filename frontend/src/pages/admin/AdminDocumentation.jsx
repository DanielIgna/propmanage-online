import React, { useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import {
  BookOpen, ChevronRight, Building2, ShieldCheck, Box, CreditCard, Mail,
  Settings, Search, Sparkles, Facebook, BarChart3, MapPin, FileText, Award,
  Lightbulb, Rocket, Users, Calendar, Layers, Server, MailPlus, History, Brain,
  Send, Loader2, Copy, CheckCircle2
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;
const ax = axios.create({ baseURL: API, withCredentials: true });

const TOPICS = [
  {
    id: "button-guide",
    icon: Layers,
    title: "Ghid Buton-cu-Buton (Manual de utilizare)",
    summary: "Fiecare buton important din platformă explicat simplu — pentru orice admin, fără cunoștințe IT",
    status: { created: ["20 butoane principale documentate", "Limbaj simplu, fără jargon tehnic", "Sugestie când se folosește + când se actualizează"], todo: ["Adăugare screenshot animat pentru fiecare buton (GIF/Lottie)", "Versiune video 60-90 secunde per zonă", "Tooltip cu link către manualul respectiv direct în UI"] },
    content: [
      { h: "Dashboard → 'Snapshot acum' (Control Administrare)", p: "Salvează manual configurarea curentă (prețuri, link-uri sociale, SEO) ca punct de recuperare. Folosește înainte de o schimbare majoră. ACTUALIZEAZĂ când: vrei să testezi un set nou de prețuri sau înainte de ședință de planificare." },
      { h: "Dashboard → 'Reset la valori implicite'", p: "Resetează TOATE setările la valorile din cod (350 RON audit, 950 RON twin, 2.5% comision). Folosește DOAR dacă cineva a stricat configurarea și nu mai funcționează nimic. NU folosi la întâmplare — vei pierde link-urile sociale și setările SEO." },
      { h: "AI Control Center → 'Activează/Dezactivează ecosistem'", p: "Kill-switch global pentru toate cele 7 module AI noi. Dezactivează dacă AI-ul costă prea mulți tokeni sau dacă e o eroare la provider. Modulele legacy (Concierge, Investigator) continuă să funcționeze." },
      { h: "AI Control Center → 'Reset memorii'", p: "Șterge amintirile AI pentru un user (sau '*' pentru toți). Folosește la cerere GDPR sau dacă cineva și-a schimbat preferințele și AI-ul răspunde cu date vechi." },
      { h: "QA Copilot → 'Sesiune nouă'", p: "Începi o sesiune de testare manuală. ALEGE rolul testat (client/specialist/admin) ca AI-ul să știe contextul. Folosește când vrei să verifici un flow nou sau un bug raportat de utilizator." },
      { h: "QA Copilot → 'Generează prompt pentru Emergent'", p: "După ce ai adăugat 3-5 constatări, click → AI compilează totul într-un prompt structurat. COPIAZĂ și LIPEȘTE în chat cu mine — eu execut fix-urile." },
      { h: "AI Dev Team → 'Analizează (Agent ...)'", p: "Selectează un fișier și un agent (Frontend/Backend/QA/Security). AI returnează probleme și prompturi gata. Folosește SĂPTĂMÂNAL pe paginile mai vechi ca să identifici degradări de calitate." },
      { h: "AI Security Center → 'Rulează analiza AI'", p: "Claude analizează evenimentele de securitate din ultimele 24h (sau perioada aleasă) și recomandă acțiuni defensive. Rulează SĂPTĂMÂNAL minim, sau imediat după Threat Level a urcat la RIDICAT/CRITIC." },
      { h: "Document Intelligence → 'Încarcă document'", p: "Upload PDF/DOCX/TXT. AI indexează și răspunde la întrebări citând sursa. Folosește pentru: contracte, regulamente asociație, facturi recurente, devize." },
      { h: "Client Dashboard → 'Cerere nouă' (buton Urgent)", p: "Toggle Normal vs 🔥 Urgent. Joburile urgente apar PRIMELE în lista specialiștilor și au email cu prefix [URGENT]. Folosește urgent DOAR pentru probleme reale (scurgere apă, foc, lift blocat). Abuzul scade încrederea specialiștilor." },
      { h: "Specialist Dashboard → 'Filtrare urgent'", p: "Toggle '🔥 Urgent' afișează doar joburile urgente. Folosește dimineața la stabilirea programului zilei." },
      { h: "Verified Estate Kanban → 'Aprobă listing'", p: "Mută un anunț din 'Pending review' în 'Active'. Verifică ÎNTOTDEAUNA: audit complet, twin 3D funcțional, fotografii reale. Refuză dacă lipsește vreun pilon." },
      { h: "Imobile Verificate → 'Editează preț audit/twin/comision'", p: "Modificare DINAMICĂ a prețurilor și comisionului — fără redeploy. Schimbarea e LIVE pentru toate procesările Stripe noi (cele în curs nu sunt afectate)." },
      { h: "Operator Dashboard → 'Mediază dispută'", p: "Adaugi rezoluție pe un contract aflat în dispută. Analizezi dovezile (mesaje, fotografii, devize) și emiți decizia. Ai 5 zile lucrătoare pentru rezoluție." },
      { h: "Admin → 'Trimite newsletter acum'", p: "Forțează trimiterea newsletter-ului către toți userii înregistrați. Folosește la lansări noi sau evenimente speciale. NU folosi mai des de 1x/săptămână (risc spam)." },
      { h: "Admin → 'AI Investigator: Aplică sugestie'", p: "Aprobi o sugestie automat-generată de AI Investigator (legacy guardian). Verifică DESCRIEREA înainte. NU aproba sugestii pe care nu le înțelegi — întreabă-mă în chat." },
      { h: "Trust Score Weights → modificare ponderi", p: "Schimbă cum se calculează scorul specialiștilor (rating, completări, dispute, viteză răspuns). Modifici DOAR cu confirmarea echipei produs — afectează ranking-ul pentru toți specialiștii." },
      { h: "Setări Platformă → 'Modul demo'", p: "Activează datele demo (specialiști fictivi, proprietăți seed). Folosește la prezentări demo, NU în producție cu utilizatori reali (date vor părea inutile)." },
      { h: "GDPR Pack → 'Exportă date user'", p: "Generează arhivă ZIP cu toate datele unui user (la cererea lui sau a autorității). Termen legal: 30 de zile maxim de la cerere." },
      { h: "GDPR Pack → 'Ștergere completă user'", p: "Anonimizează un user (păstrează tranzacțiile pentru contabilitate, șterge PII). Aplică DOAR după confirmarea scrisă a userului." },
    ],
  },
  {
    id: "snapshots-rollback",
    icon: History,
    title: "Snapshots & Rollback Settings",
    summary: "Sistem de siguranță în caz că un admin schimbă ceva ce nu trebuia",
    status: { created: ["Snapshot zilnic automat la 04:00 (București)", "Buton 'Snapshot acum' manual", "Restore 1-click la orice snapshot din ultimele 50", "Pre-restore snapshot automat (rollback la rollback)"], todo: ["Diff vizual între snapshots (ce s-a schimbat exact)", "Notificare email când se face restore", "Snapshots pentru și altă date (users, listings, etc.) — necesar pentru recuperare avansată"] },
    content: [
      { h: "Ce sunt snapshot-urile", p: "Înregistrări complete ale configurării platformei la un moment dat (prețuri, link-uri sociale, SEO, template contract, etc.). NU includ tranzacții, utilizatori sau cereri — doar SETĂRI." },
      { h: "Snapshot automat zilnic", p: "În fiecare zi la 04:00 ora României, sistemul face un snapshot automat. Vechile (peste 50) se șterg automat — buffer rolling." },
      { h: "Snapshot manual", p: "Click 'Snapshot acum' în Control Administrare ÎNAINTE de modificări majore (test prețuri noi, schimbare template contract, etc.). Adaugi opțional un label descriptiv." },
      { h: "Restore (recuperare)", p: "Click 'Restore' pe orice snapshot din listă. Înainte de restore, sistemul face automat un alt snapshot 'pre_restore' — deci poți face restore la rollback dacă ai greșit." },
      { h: "Recomandare workflow", p: "1) Snapshot manual înainte de schimbare. 2) Aplici schimbarea. 3) Testezi 1-2 zile. 4) Dacă merge → o lași. Dacă NU → Restore la snapshot-ul tău." },
    ],
  },
  {
    id: "service-contract",
    icon: FileText,
    title: "Contract Servicii (Client ↔ Specialist)",
    summary: "Contract electronic editabil cu mediere prin operator + semnătură",
    status: { created: ["Template generic în română (nu act notarial)", "9 clauze de bază (obligații, preț, mediere, dispută)", "Semnătură electronică ambele părți", "Mediere prin Operator PropManage (5 zile lucrătoare)"], todo: ["Versionare template (audit trail al modificărilor)", "Generare PDF descărcabil (acum doar HTML print)", "Integrare cu Stripe escrow (declanșare automată plată la semnătura completă)", "Validare juridică de către avocat înainte de scalare comercială"] },
    content: [
      { h: "Cum generezi un contract", p: "Pe pagina unei solicitări (după acceptare specialist), click 'Generează contract'. Sistemul completează automat date din solicitare (titlu, descriere, preț, deadline) și date despre părți (nume, email, oraș)." },
      { h: "Semnătura", p: "Fiecare parte (Client + Specialist) trebuie să introducă numele complet ca semnătură electronică. După ambele semnături, contractul devine 'Active'." },
      { h: "Mediere prin Operator", p: "Dacă apar neînțelegeri, Operatorul PropManage analizează (mesaje, foto, devize) și emite rezoluție în 5 zile lucrătoare. Este OBLIGATORIE această mediere înainte de instanță." },
      { h: "Modificare template", p: "Adminul poate edita template-ul din Control Administrare → Contract Template (HTML cu placeholdere {{nume}}, {{client_email}}, etc.). NU șterge placeholderele dacă nu știi unde sunt folosite." },
      { h: "Limitări", p: "Acest contract are valoarea unei SCRISORI DE INTENȚIE COMERCIALĂ — nu este act autentic notarial. Pentru lucrări mari (>5000 RON) recomandă-le părților să notarizeze separat." },
    ],
  },
  {
    id: "rackhost-migration",
    icon: Server,
    title: "Server Rackhost & Plan Migrare",
    summary: "Status DNS curent + plan de migrare către alternative mai fiabile",
    status: { created: ["Istoric problemă Rackhost: cPanel cu DNS Zone Editor stricat (Feb 2026)", "Workaround activ: backendUrlFallback.js rewrite la window.location.origin", "Documentație plan migrare către Cloudflare/Hetzner"], todo: ["Contact concret cu suport Rackhost pentru reparare zone DNS sau export domeniu", "Cont Cloudflare creat (gratuit) cu A record către IP-ul Emergent", "DNS records exportate ca backup înainte de transfer", "Test pe subdomeniu test.propmanage.ro înainte de schimbare definitivă"] },
    content: [
      { h: "Problema actuală", p: "Rackhost (DNS provider pentru propmanage.ro) are cPanel-ul stricat — Zone Editor nu se încarcă, nu poți modifica A records. Asta blochează direcționarea propmanage.ro către serverul Emergent." },
      { h: "Workaround temporar", p: "Site-ul rulează pe https://phased-document.emergent.host (URL Emergent direct). Frontend-ul are un interceptor (`backendUrlFallback.js`) care rewrite-uiește orice apel API către origin-ul curent dacă propmanage.ro pică. Funcționează, dar nu e ideal pentru SEO și brand." },
      { h: "Plan migrare către Cloudflare (RECOMANDAT)", p: "Pas 1: Creează cont gratuit pe cloudflare.com. Pas 2: Adaugă propmanage.ro ca site. Pas 3: Cloudflare îți dă 2 nameservere (ex: amy.ns.cloudflare.com). Pas 4: Mergi în cont Rackhost (la registrar, nu cPanel) și schimbă NAMESERVERS la cele Cloudflare. Pas 5: După propagare (24h), în Cloudflare adaugi A record: @ → IP-ul Emergent (cere-l prin support_agent). Pas 6: SSL automat de la Cloudflare." },
      { h: "Plan migrare către Hetzner (avansat)", p: "Dacă vrei control complet pe server (mail, fișiere, VPS): cont Hetzner.com (~5 EUR/lună), instalezi Docker + Caddy reverse-proxy, deploy aplicația prin GitHub Actions. ATENȚIE: pierzi auto-scaling Emergent. NU recomandat pentru tine acum." },
      { h: "Ce să faci ÎNAINTE de migrare", p: "1) Export complet DNS records actuale (printscreen din ce mai poți accesa). 2) Snapshot bază de date prin /admin/backups. 3) Notifică utilizatorii prin newsletter cu 48h înainte (downtime posibil 1-2 ore). 4) Migrare făcută în weekend, NU lunea." },
      { h: "La ce să fii atent", p: "Dacă faci greșit nameservers la registrar, propmanage.ro dispare 24-48h până revin la cele vechi. NU șterge zona DNS actuală de la Rackhost decât DUPĂ ce confirmi că totul merge pe Cloudflare." },
    ],
  },
  {
    id: "email-ro-setup",
    icon: MailPlus,
    title: "Adrese email .ro (dan@, contact@, suport@)",
    summary: "3 opțiuni pentru a crea email-uri profesionale cu propmanage.ro",
    status: { created: ["Documentație pas-cu-pas pentru 3 furnizori", "Recomandare optimă pentru cazul tău (Zoho)", "Avertisment despre erori comune DNS"], todo: ["Cont email comun creat pe Zoho (după ce ai DNS funcțional)", "MX records adăugate în Cloudflare/Rackhost", "SPF + DKIM + DMARC configurate (anti-spam)", "Test trimitere & primire cu mail-tester.com (target: 10/10)"] },
    content: [
      { h: "DE CE NU pot face eu acum din platformă", p: "Pod-ul Emergent K8s nu poate găzdui un mail server. Trebuie să folosești un serviciu extern. Bună veste: există variante GRATUITE pentru tine." },
      { h: "Opțiunea 1 (RECOMANDATĂ): Zoho Mail Free", p: "GRATUIT pentru 5 utilizatori · 5GB/utilizator · domeniu propriu. Mergi pe zoho.com/mail → Sign up Free → adaugi propmanage.ro → primești 4 records DNS (MX, TXT pentru verificare, SPF, DKIM) → le adaugi în Cloudflare (sau Rackhost când merge). Creezi adrese: dan@, contact@, suport@. Aplicație web + mobile (iOS/Android) — funcționează ca Gmail." },
      { h: "Opțiunea 2: Google Workspace", p: "6 EUR/utilizator/lună (3 adrese = 18 EUR/lună). Avantaj: interfață Gmail nativă, Google Meet integrat, 30GB. Mai bun dacă scalezi la echipă 5+ persoane." },
      { h: "Opțiunea 3: Migadu (privacy)", p: "9 EUR/lună flat (nelimitate adrese, 30GB total). Servere în UE, GDPR-friendly. Bună dacă vrei separat de Google." },
      { h: "Pași DNS (Zoho, pe Cloudflare)", p: "După migrare la Cloudflare (vezi topic anterior), în Cloudflare → DNS → adaugi: TXT @ zoho-verification=zb12345 · MX @ priority 10 mx.zoho.com · MX @ priority 20 mx2.zoho.com · TXT @ 'v=spf1 include:zoho.com ~all' · TXT zmail._domainkey selector dat de Zoho · TXT _dmarc 'v=DMARC1; p=quarantine; rua=mailto:dan@propmanage.ro'." },
      { h: "Erori comune (de EVITAT)", p: "❌ Adăugare MX records înainte de verificare TXT (Zoho refuză). ❌ SPF cu 2 valori (înlocuiește, nu adăugi). ❌ Uitare DKIM (mail-urile ajung în spam). ❌ Trimitere prima oară fără DMARC (Gmail le marchează ca suspect)." },
      { h: "Test final", p: "Trimite un mail de test la mail-tester.com → primești un scor. Țintă: 10/10. Sub 8/10 = vor ajunge în spam." },
    ],
  },
  {
    id: "qa-copilot",
    icon: Sparkles,
    title: "QA Copilot · Testare AI-asistată",
    summary: "Cum folosești modulul nou de testare manuală",
    content: [
      {
        h: "Conceptul",
        p: "QA Copilot (`/admin/qa-copilot`) e un asistent AI (Claude Sonnet 4.5) care te ajută la testarea manuală a platformei. Tu descrii ce vezi în limbaj natural, AI clasifică (bug/UX/data/feature), atribuie severitate (P0-P3), identifică fișiere suspecte și sugerează următoarele teste. La final compilează un prompt structurat pe care îl copiezi în chat-ul cu Emergent ca să mă pui la treabă cu fix-ul exact."
      },
      {
        h: "Cum începi o sesiune",
        p: "1. Mergi la /admin/qa-copilot. 2. Click 'Sesiune nouă'. 3. Dă titlu (ex: 'Test rol specialist Mihai Ionescu'), alege rolul testat (client/specialist/operator/admin), specifică modulul (ex: 'Match specialist + Chat'), descrie obiectivul. 4. Click 'Creează'."
      },
      {
        h: "Cum adaugi constatări",
        p: "În sesiunea activă scrii în limbaj natural ce ai văzut. Ex: 'Specialistul Mihai Ionescu este din București, dar apare ca match pentru o cerere din Cluj. Nu se respectă filtrul geografic.' Opțional atașezi screenshot. Click 'Trimite & analizează' → AI răspunde în 5-10 secunde cu: categoria, severitatea, fișierele suspecte, 4 sugestii de teste de follow-up, conexiuni cu constatări anterioare din alte sesiuni."
      },
      {
        h: "Memorie persistentă",
        p: "Toate sesiunile rămân salvate în sidebar-ul stâng. Când adaugi o constatare nouă, AI vede ultimele 30 constatări din sesiunea curentă + ultimele 10 din toate sesiunile vechi. Astfel poate identifica regresiuni ('Am mai văzut asta în sesiunea X acum 3 zile')."
      },
      {
        h: "Generează prompt pentru Emergent",
        p: "După ce ai 1-10 constatări, apasă 'Generează prompt'. AI compilează totul într-un Markdown structurat: titlu, lista numerotată cu pași de reproducere + expected vs actual + fișiere suspecte + severitate, prioritizare recomandată, frază de încheiere pentru workflow corect. Click 'Copiază' → lipesti în chat cu mine. Eu îl interpretez direct, propun planul și execut fix-urile."
      },
      {
        h: "Workflow recomandat",
        p: "1. Testează manual o secțiune (ex: marketplace match). 2. Notează 3-5 lucruri neașteptate. 3. Generează prompt. 4. Trimite-l în chat cu mine. 5. După fix, rulează testarea din nou și creează sesiune nouă 'Regresie post-fix' pentru verificare. Avantaj: ai un audit trail complet, nu mai depinzi de memoria ta."
      },
    ],
  },
  {
    id: "launch-playbook",
    icon: Rocket,
    title: "Playbook Lansare · Primii 7 pași",
    summary: "Ghid concret pentru primele zile post-deploy",
    content: [
      {
        h: "Ziua 1 · Verificări tehnice",
        p: "1. Verifică https://phased-document.emergent.host răspunde 200. 2. Login admin → /admin/settings-control: confirmă prețurile (350/950/2.5%). 3. Setează 1-2 link-uri sociale reale dacă ai. 4. Verifică /api/app-settings/public răspunde corect (Network tab). 5. Postează în Facebook Sharing Debugger (developers.facebook.com/tools/debug) URL-ul prod ca să Facebook actualizeze cache-ul OG."
      },
      {
        h: "Ziua 2 · LinkedIn Launch Post",
        p: "Postare: 'După 6 luni de construcție, lansez PropManage — primul model imobiliar din România unde fiecare imobil are AUDIT + DIGITAL TWIN obligatorii. Nu un alt site de anunțuri. O platformă unde vezi exact ce cumperi, înainte de prima vizionare. Comision 2.5%. https://propmanage.ro/de-ce-noi #imobiliare #proptech #romania' Image: screenshot din /imobile-verificate cu Map View."
      },
      {
        h: "Ziua 3 · Facebook · Post de educație",
        p: "Carousel 5 slides: Slide 1: 'Cum verificăm un apartament în 3 zile' Slide 2: Audit tehnic (foto auditor) Slide 3: Digital Twin 3D (screenshot din Trimble) Slide 4: Raport detaliat (foto raport) Slide 5: 'Vezi tu' CTA spre /imobile-verificate. Buget recomandat: 50-100€ pentru boost local București/Cluj."
      },
      {
        h: "Ziua 4 · Instagram Reel",
        p: "Reel 30 sec: 'Cum am cumpărat apartament fără să fac 5 vizionări' — auditor în acțiune + zoom în Digital Twin 3D + statistici pe ecran. Hashtag: #imobilverificat #auditimobiliar #propmanage #imobiliarebucuresti. Postează miercuri 18:00 sau sâmbătă 11:00."
      },
      {
        h: "Ziua 5 · YouTube · Studiu de caz",
        p: "Video 5-8 min: 'Andrei a cumpărat un apartament în Pipera fără să-l vadă fizic. Iată cum.' Include: interviu Andrei (2 min) + tur Digital Twin pe ecran (2 min) + raport audit (1 min) + CTA spre platformă (30s). Titlu YouTube optimizat SEO: 'Cum cumperi apartament fără riscuri în 2026 - Audit + Digital Twin'."
      },
      {
        h: "Ziua 6 · Newsletter pilot",
        p: "Trimite prin Admin → 'Trimite newsletter acum' (POST /api/verified-estate/admin/run-newsletter-now) către primii 50-100 utilizatori înregistrați. Conține top 5 imobile noi + linkul către /de-ce-noi. Monitorizează open rate în Resend dashboard."
      },
      {
        h: "Ziua 7 · Retrospectivă & Iterație",
        p: "Verifică în GA4 (după ce activezi Measurement ID): pagini top 5, surse trafic, bounce rate /imobile-verificate. Compară cu obiectivele tale (ex: 100 vizite unice → realist pentru ziua 7). Notează ce a mers, ce nu, ajustează planificarea săptămânii 2. Folosește QA Copilot pentru bug-uri descoperite de useri reali."
      },
    ],
  },
  {
    id: "verified-estate",
    icon: Building2,
    title: "Imobile Verificate · End-to-end",
    summary: "Cum funcționează fluxul de la listing la vânzare",
    content: [
      {
        h: "Conceptul",
        p: "Imobile Verificate este modulul premium unde fiecare imobil trebuie să aibă AUDIT TEHNIC + DIGITAL TWIN obligatorii înainte să fie vizibil cumpărătorilor. Acest principiu este enforced prin 4 quality gates în cod — nu poți publish un listing dacă nu trece toate verificările."
      },
      {
        h: "Cele 4 Gate-uri (în cod, netrecabile)",
        p: "1. Audit Report ID prezent. 2. Digital Twin ID prezent. 3. ≥90% recomandări acceptate de proprietar. 4. Aprobare manuală admin (status='published'). Doar listings care trec TOATE cele 4 sunt vizibile public."
      },
      {
        h: "Flux Vânzător",
        p: "1. Proprietar intră la /imobile-verificate/sell → alege pachet (Audit / Twin / Bundle). 2. Plătește prin Stripe (sau DEMO mode dacă nu ai keys LIVE). 3. Backend creează automat un DRAFT LISTING în Admin Kanban. 4. Echipa programează auditul → adaugă raport. 5. Specialist creează Digital Twin → link la draft. 6. După ce trece >90% recomandări → admin apasă PUBLISH în Kanban → live."
      },
      {
        h: "Flux Cumpărător",
        p: "Browse: /imobile-verificate cu filtre (oraș, camere, preț, vânzare/închiriere) + toggle Grid/Hartă. Click pe imobil → detail page cu galerie, Digital Twin embed, raport audit PDF + form 'Vizionare' sau 'Vreau să cumpăr'. Inquiry trimite notificare email instant la admin."
      },
      {
        h: "Audit Extern (Traseu C)",
        p: "Cumpărători care au găsit imobil pe altă platformă pot solicita audit prin butonul mare din hero-ul /imobile-verificate. Form simplu cu URL extern + adresă + contact. Echipa contactează vânzătorul/agentul → programează audit independent."
      },
    ],
  },
  {
    id: "admin-kanban",
    icon: Award,
    title: "Admin Kanban · Moderare imobile",
    summary: "Cum aprobi/respinge listings",
    content: [
      {
        h: "Acces",
        p: "Mergi la /admin/imobile-verificate (din sidebar Admin). Vezi 4 coloane: Draft, Pending Review, Published, Archived + 4 tabs (Kanban, Cereri, Audit Extern, Plăți)."
      },
      {
        h: "Stat Cards (sus)",
        p: "Total listings, Publicate, Draft, Cereri noi, Audit extern, Plăți confirmate. Click pe refresh pentru update live."
      },
      {
        h: "Acțiuni per Listing",
        p: "Vezi (deschide detaliu public), Publish (doar dacă toate Gate-urile sunt verzi), Archive (retrage din public). Gate chips arată instant ce lipsește (Audit / Twin / Reco %)."
      },
      {
        h: "Cereri & Plăți",
        p: "Tab 'Cereri': inquiries de la cumpărători (intent: viewing/buy/info). Tab 'Audit Extern': cereri pentru imobile din afara platformei. Tab 'Plăți': comenzi Stripe (badge DEMO dacă e fără tranzacție reală)."
      },
    ],
  },
  {
    id: "control-admin",
    icon: Settings,
    title: "Control Administrare · Setări fără cod",
    summary: "Edit prețuri, social, SEO, contact",
    content: [
      {
        h: "Acces",
        p: "/admin/settings-control (din sidebar Admin). Aici editezi tot ce afectează UI-ul public fără să fie nevoie de re-deploy."
      },
      {
        h: "Prețuri & Comision",
        p: "Audit (RON) · Twin (RON) · Comision %. Salvarea aplică INSTANT pe: pagina Sell, calculatorul din /de-ce-noi, pricing endpoint public. Folosește pentru campanii flash (ex: comision 1.5% temporar)."
      },
      {
        h: "Rețele Sociale",
        p: "6 câmpuri: Facebook x2, Instagram x2, YouTube, LinkedIn. Câmp gol = placeholder '(în curând)' în footer. Câmp completat = activ, deschide tab nou."
      },
      {
        h: "Contact",
        p: "Email contact (folosit pentru notificări admin), telefon, adresă sediu. Apar în footer și pagina de contact."
      },
      {
        h: "Identitate Companie",
        p: "Nume + tagline. Apare în footer și pe meta tags."
      },
      {
        h: "SEO Meta Tags",
        p: "Per pagină: Title (≤60 chars) + Description (140-160 chars). Aplică automat. Include OG Image pentru preview-uri pe Facebook/LinkedIn."
      },
      {
        h: "Reset",
        p: "Butonul roșu 'Reset la valori implicite' restabilește totul la default. Cere confirmare. Ireversibil."
      },
    ],
  },
  {
    id: "seo",
    icon: Search,
    title: "SEO · Cum apare în Google",
    summary: "Optimizare conținut + structured data",
    content: [
      {
        h: "Meta Title",
        p: "Apare ca titlu albastru în rezultate Google. ≤60 caractere. Include cuvântul cheie principal devreme (ex: 'Imobile Verificate · Audit + Digital Twin · PropManage')."
      },
      {
        h: "Meta Description",
        p: "Apare ca text sub titlu în rezultate. 140-160 caractere ideal. Conține un beneficiu + un call-to-action discret (ex: 'Vezi exact ce cumperi înainte de prima vizionare.')."
      },
      {
        h: "Open Graph Image",
        p: "Imaginea care apare când link-ul e share-uit pe Facebook / LinkedIn / WhatsApp / Twitter. Recomandare: 1200×630px, sub 1MB. URL public (poți folosi unsplash.com pentru poze stoc temporar)."
      },
      {
        h: "Schema.org JSON-LD",
        p: "Pagina /de-ce-noi are automat schema.org tip 'Service' care permite Google să afișeze rich results (stele, preț, recenzii când vor exista). Acesta e injectat în &lt;head&gt; la fiecare load."
      },
      {
        h: "Verificare",
        p: "După deploy, verifică în: 1) Google PageSpeed Insights (pagespeed.web.dev). 2) Facebook Sharing Debugger (developers.facebook.com/tools/debug). 3) LinkedIn Post Inspector. 4) Twitter Card Validator."
      },
    ],
  },
  {
    id: "social-campaigns",
    icon: Facebook,
    title: "Campanii Sociale · Tactici inițiale",
    summary: "Lansare brand + primele postări",
    content: [
      {
        h: "Lansare LinkedIn",
        p: "Postare 1: Share /de-ce-noi cu textul 'Am construit un model fundamental nou pentru piața imobiliară RO. Nu un alt site de anunțuri. Audit + Digital Twin obligatorii pentru fiecare imobil.' Image: screenshot din /imobile-verificate."
      },
      {
        h: "Facebook · 5 idei de conținut",
        p: "1. Behind-the-scenes audit (foto echipa). 2. Tur 3D scurt al unui imobil (video 15s). 3. Comparație 'normal vs verificat' (carousel). 4. Testimonial proprietar (text + foto). 5. Calculator economisiri ca image quote."
      },
      {
        h: "Instagram · Reels",
        p: "Reel 30s: 'Cum verificăm un imobil în 3 pași' cu auditor în acțiune + cifre pe ecran. Hashtag: #imobilverificat #auditimobiliar #propmanage. Postează miercuri 18:00 și sâmbătă 11:00."
      },
      {
        h: "YouTube · Long-form",
        p: "Video 5-8 min: 'Cum am cumpărat un apartament fără să mă deplasez 5 ori la vizionare' (povestea unui client). Include footage din Digital Twin + audit. Optimizat SEO (titlu cu cuvinte cheie)."
      },
    ],
  },
  {
    id: "analytics",
    icon: BarChart3,
    title: "Analytics · Cum citești datele",
    summary: "GA4 + monitorizare conversii",
    content: [
      {
        h: "Activare GA4",
        p: "1. Creează cont la analytics.google.com. 2. Property pentru propmanage.ro. 3. Copiază Measurement ID (G-XXXXXXXXXX). 4. Adaugă în Emergent ENV: REACT_APP_GA4_MEASUREMENT_ID=G-XXXXXXXXXX. 5. Re-deploy → tracking live."
      },
      {
        h: "Ce să urmărești săptămânal",
        p: "Pagini vizitate top 5, surse de trafic (Google / Facebook / direct), rata de bounce pe /imobile-verificate, click-uri pe CTA-uri (folosește Events). Compară săptămână-la-săptămână."
      },
      {
        h: "Conversii cheie",
        p: "1. POST /api/verified-estate/inquiries → 'Buyer Lead'. 2. POST /api/verified-estate/external-audit-request → 'External Audit Lead'. 3. POST /api/verified-estate/checkout cu success → 'Seller Conversion'. Configurează ca custom events în GA4."
      },
    ],
  },
  {
    id: "emails",
    icon: Mail,
    title: "Email Sequences · Automatizări",
    summary: "Welcome + drip + newsletter",
    content: [
      {
        h: "Welcome email",
        p: "Trimis automat la signup nou (deja integrat în /api/auth/register). Nu necesită config."
      },
      {
        h: "Drip reminder (la 6h)",
        p: "Scanează verified_estate_orders pentru comenzi paid mai vechi de 48h fără follow-up. Trimite reminder către admin cu detalii client. Idempotent (drip_reminded_at flag — o singură dată per comandă)."
      },
      {
        h: "Weekly newsletter (Lunea 9:00)",
        p: "Trimis automat către toți userii cu digest_disabled != true. Conține top 5 imobile noi published. Format HTML responsive cu CTA spre /imobile-verificate."
      },
      {
        h: "Trigger manual (testing)",
        p: "Admin: POST /api/verified-estate/admin/run-newsletter-now (forțează newsletter acum). POST /api/verified-estate/admin/run-drip-now (forțează drip scan)."
      },
    ],
  },
];

const TopicCard = ({ topic, open, onToggle }) => {
  const [askLoading, setAskLoading] = React.useState(false);
  const [promptOutput, setPromptOutput] = React.useState("");
  const [copied, setCopied] = React.useState(false);

  const generatePrompt = async (e) => {
    e.stopPropagation();
    if (!topic.status?.todo?.length) return;
    setAskLoading(true);
    try {
      const todos = topic.status.todo.join("\n- ");
      const ctx = `Topic: ${topic.title}\n\nTODO pentru îmbunătățire:\n- ${todos}\n\nGenerează un prompt clar și concret pentru Emergent care să implementeze TOATE aceste îmbunătățiri într-un sprint. Include pași concreți, fișiere suspecte și criterii de validare. Limba română.`;
      // Reuse QA Copilot Claude pipeline — POST to docs ai ask (closest available)
      const { data } = await ax.post("/api/ai-docs/ask", {
        question: ctx,
        top_k: 1,
      });
      setPromptOutput(data.answer || "Nu am putut genera prompt acum. Încearcă din nou.");
    } catch (err) {
      // Fallback: build a deterministic prompt locally
      setPromptOutput(
        `# Sprint: Îmbunătățiri pentru "${topic.title}"\n\n## TODO de implementat\n${topic.status.todo.map((t, i) => `${i + 1}. ${t}`).join("\n")}\n\n## Cerere\nTe rog să implementezi aceste îmbunătățiri într-un sprint focused, cu testing_agent_v3_fork după fiecare modul major. Folosește pattern-uri existente din proiect și menține feature flag-ul AI ecosystem activ.`
      );
    } finally { setAskLoading(false); }
  };

  const copyPrompt = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(promptOutput);
    } catch (_) {
      const ta = document.createElement("textarea");
      ta.value = promptOutput;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch (__) { /* swallow */ }
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="bg-[#0e0e10] border border-white/10 rounded-2xl overflow-hidden" data-testid={`docs-topic-${topic.id}`}>
      <button onClick={onToggle} className="w-full text-left p-5 flex items-start gap-4 hover:bg-white/[0.02]" data-testid={`docs-toggle-${topic.id}`}>
        <div className="w-11 h-11 rounded-2xl bg-[#d4ff3a]/10 border border-[#d4ff3a]/30 flex items-center justify-center shrink-0">
          <topic.icon className="w-5 h-5 text-[#d4ff3a]" />
        </div>
        <div className="flex-1">
          <h3 className="font-serif text-xl mb-1">{topic.title}</h3>
          <p className="text-xs text-stone-400">{topic.summary}</p>
        </div>
        <ChevronRight className={`w-4 h-4 text-stone-400 mt-3 transition-transform ${open ? "rotate-90 text-[#d4ff3a]" : ""}`} />
      </button>
      {open && (
        <div className="px-5 pb-6 space-y-4 border-t border-white/5 pt-5">
          {topic.status && (
            <div className="grid md:grid-cols-2 gap-3" data-testid={`docs-status-${topic.id}`}>
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3">
                <div className="text-[10px] uppercase tracking-wider text-emerald-300 mb-1 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Creat</div>
                <ul className="text-xs text-stone-300 space-y-1">
                  {topic.status.created.map((s, i) => <li key={i}>✓ {s}</li>)}
                </ul>
              </div>
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
                <div className="text-[10px] uppercase tracking-wider text-amber-300 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1"><Lightbulb className="w-3 h-3" /> TODO Îmbunătățiri</span>
                  <button onClick={generatePrompt} disabled={askLoading} className="text-[10px] bg-[#d4ff3a] text-black px-2 py-0.5 rounded-full font-medium hover:bg-[#c4ef2a] disabled:opacity-50" data-testid={`docs-gen-prompt-${topic.id}`}>
                    {askLoading ? <Loader2 className="w-3 h-3 animate-spin inline" /> : <><Sparkles className="w-2.5 h-2.5 inline mr-0.5" /> Generează prompt</>}
                  </button>
                </div>
                <ul className="text-xs text-stone-300 space-y-1">
                  {topic.status.todo.map((s, i) => <li key={i}>○ {s}</li>)}
                </ul>
              </div>
            </div>
          )}
          {promptOutput && (
            <div className="bg-[#0a0a0b] border border-[#d4ff3a]/30 rounded-xl p-3 relative" data-testid={`docs-prompt-output-${topic.id}`}>
              <button onClick={copyPrompt} className="absolute top-2 right-2 text-stone-500 hover:text-[#d4ff3a]" data-testid={`docs-copy-prompt-${topic.id}`}>
                {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-[#d4ff3a]" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <div className="text-[10px] uppercase tracking-wider text-[#d4ff3a] mb-1.5">Prompt gata pentru Emergent</div>
              <pre className="text-xs text-stone-200 whitespace-pre-wrap leading-relaxed pr-8 max-h-[300px] overflow-y-auto">{promptOutput}</pre>
            </div>
          )}
          {topic.content.map((section, i) => (
            <div key={i} data-testid={`docs-section-${topic.id}-${i}`}>
              <div className="text-xs uppercase tracking-wider text-[#d4ff3a] font-medium mb-2">{section.h}</div>
              <p className="text-sm text-stone-300 leading-relaxed">{section.p}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const AdminDocumentation = () => {
  const [openId, setOpenId] = useState("button-guide");
  const [search, setSearch] = useState("");
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantQ, setAssistantQ] = useState("");
  const [assistantA, setAssistantA] = useState(null);
  const [assistantLoading, setAssistantLoading] = useState(false);

  const filtered = search.trim()
    ? TOPICS.filter(t => {
        const q = search.toLowerCase();
        return t.title.toLowerCase().includes(q) || t.summary.toLowerCase().includes(q) ||
          t.content.some(c => c.h.toLowerCase().includes(q) || c.p.toLowerCase().includes(q));
      })
    : TOPICS;

  const askAssistant = async () => {
    if (!assistantQ.trim()) return;
    setAssistantLoading(true);
    try {
      // Build a context from all topics' content and ask Claude via /api/ai-docs/ask
      // (re-use docs RAG which is fastest; for now we send the question with manual context)
      const manualContext = TOPICS.map(t =>
        `## ${t.title}\n${t.content.map(c => `### ${c.h}\n${c.p}`).join("\n")}`
      ).join("\n\n").slice(0, 12000);

      // Inline RAG: ask the LLM directly via a small POST to the existing ai-docs/ask
      // but with the manual injected as a virtual doc.
      const { data } = await ax.post("/api/ai-docs/ask", {
        question: `Întrebare admin: ${assistantQ.trim()}\n\nFolosește acest manual ca sursă (sau lit. ”Nu am găsit în manual.”):\n${manualContext}`,
        top_k: 1,
      });
      setAssistantA(data.answer || "Nu am putut răspunde. Încearcă altă formulare.");
    } catch (e) {
      setAssistantA("Eroare la AI. Verifică EMERGENT_LLM_KEY sau încearcă mai târziu.");
    } finally { setAssistantLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      <div className="max-w-5xl mx-auto px-6 pt-28 pb-16">
        <Link to="/admin" className="text-xs text-stone-400 hover:text-white inline-flex items-center gap-1 mb-3">← Înapoi la Admin Dashboard</Link>
        <div className="mb-8 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-serif text-4xl md:text-5xl tracking-tight" data-testid="docs-title">
              Documentație & <span className="italic gradient-text">Training</span>
            </h1>
            <p className="text-sm text-stone-400 mt-2">Manual de operare cu AI assistant integrat. Click pe orice secțiune pentru detalii.</p>
          </div>
          <button onClick={() => setAssistantOpen(true)} className="pm-btn pm-btn-primary" data-testid="docs-open-ai-assistant">
            <Brain className="w-4 h-4" /> Întreabă AI Assistant
          </button>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Caută în manual... (ex: buton urgent, snapshot, email)"
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-3 py-3 text-sm focus:outline-none focus:border-[#d4ff3a]/50"
            data-testid="docs-search"
          />
        </div>

        <div className="grid md:grid-cols-3 gap-3 mb-8">
          <div className="pm-stat-card flex items-center gap-3">
            <Rocket className="w-5 h-5 text-[#d4ff3a]" />
            <div>
              <div className="font-serif text-xl">{TOPICS.length}</div>
              <div className="text-xs text-stone-400">Module documentate</div>
            </div>
          </div>
          <div className="pm-stat-card flex items-center gap-3">
            <Users className="w-5 h-5 text-cyan-400" />
            <div>
              <div className="font-serif text-xl">{TOPICS.reduce((a, t) => a + t.content.length, 0)}</div>
              <div className="text-xs text-stone-400">Secțiuni Training</div>
            </div>
          </div>
          <div className="pm-stat-card flex items-center gap-3">
            <Lightbulb className="w-5 h-5 text-amber-400" />
            <div>
              <div className="font-serif text-xl">{TOPICS.filter(t => t.status?.todo?.length).length}</div>
              <div className="text-xs text-stone-400">Module cu TODO</div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {filtered.map(t => (
            <TopicCard key={t.id} topic={t} open={openId === t.id} onToggle={() => setOpenId(openId === t.id ? null : t.id)} />
          ))}
          {filtered.length === 0 && <div className="text-center py-12 text-stone-500 text-sm">Nimic găsit pentru "{search}". Încearcă alt termen.</div>}
        </div>

        <div className="mt-12 bg-[#d4ff3a]/8 border border-[#d4ff3a]/30 rounded-3xl p-6 flex items-start gap-4" data-testid="docs-footer-tip">
          <Lightbulb className="w-6 h-6 text-[#d4ff3a] shrink-0 mt-1" />
          <div>
            <h3 className="font-serif text-xl mb-2">Ai nevoie de mai multe detalii?</h3>
            <p className="text-sm text-stone-300 leading-relaxed">
              Această documentație acoperă fluxurile principale. Pentru întrebări tehnice avansate folosește
              <strong className="text-[#d4ff3a]"> AI Assistant</strong> de mai sus, sau scrie la
              <a href="mailto:contact@propmanage.ro" className="text-[#d4ff3a] hover:underline"> contact@propmanage.ro</a>.
            </p>
          </div>
        </div>
      </div>

      {/* AI Assistant Modal */}
      {assistantOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setAssistantOpen(false)}>
          <div className="bg-[#0e0e10] border border-white/10 rounded-3xl p-6 w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3">
              <Brain className="w-5 h-5 text-[#d4ff3a]" />
              <h3 className="font-serif text-2xl">AI Manual Assistant</h3>
              <button onClick={() => setAssistantOpen(false)} className="ml-auto text-stone-400 hover:text-white">✕</button>
            </div>
            <p className="text-xs text-stone-400 mb-3">Întreabă-mă orice despre cum se folosește platforma. Caut în manual și răspund în limbaj simplu.</p>
            <textarea
              value={assistantQ}
              onChange={e => setAssistantQ(e.target.value)}
              placeholder="Ex: Cum fac snapshot înainte să schimb prețurile? Sau: Unde văd disputele active?"
              rows="3"
              className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm focus:outline-none focus:border-[#d4ff3a]/50 resize-none"
              data-testid="docs-assistant-input"
            />
            <div className="flex justify-end mt-3">
              <button onClick={askAssistant} disabled={assistantLoading || !assistantQ.trim()} className="pm-btn pm-btn-primary" data-testid="docs-assistant-ask">
                {assistantLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Caut...</> : <><Send className="w-4 h-4" /> Întreabă</>}
              </button>
            </div>
            {assistantA && (
              <div className="mt-4 bg-[#0a0a0b] border border-white/10 rounded-2xl p-4 flex-1 overflow-y-auto" data-testid="docs-assistant-answer">
                <div className="text-[10px] uppercase tracking-wider text-[#d4ff3a] mb-2">Răspuns</div>
                <div className="text-sm text-stone-100 whitespace-pre-wrap leading-relaxed">{assistantA}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDocumentation;
