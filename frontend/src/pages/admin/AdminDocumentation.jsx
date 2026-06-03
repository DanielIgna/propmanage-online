import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  BookOpen, ChevronRight, Building2, ShieldCheck, Box, CreditCard, Mail,
  Settings, Search, Sparkles, Facebook, BarChart3, MapPin, FileText, Award,
  Lightbulb, Rocket, Users, Calendar
} from "lucide-react";

const TOPICS = [
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

const TopicCard = ({ topic, open, onToggle }) => (
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

export const AdminDocumentation = () => {
  const [openId, setOpenId] = useState("qa-copilot");
  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      <div className="max-w-5xl mx-auto px-6 pt-28 pb-16">
        <Link to="/admin" className="text-xs text-stone-400 hover:text-white inline-flex items-center gap-1 mb-3">← Înapoi la Admin Dashboard</Link>
        <div className="mb-8">
          <h1 className="font-serif text-4xl md:text-5xl tracking-tight" data-testid="docs-title">
            Documentație & <span className="italic gradient-text">Training</span>
          </h1>
          <p className="text-sm text-stone-400 mt-2">Tot ce trebuie să știi pentru a opera platforma. Click pe orice secțiune pentru detalii.</p>
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
              <div className="font-serif text-xl">Live</div>
              <div className="text-xs text-stone-400">Update odată cu codul</div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {TOPICS.map(t => (
            <TopicCard key={t.id} topic={t} open={openId === t.id} onToggle={() => setOpenId(openId === t.id ? null : t.id)} />
          ))}
        </div>

        <div className="mt-12 bg-[#d4ff3a]/8 border border-[#d4ff3a]/30 rounded-3xl p-6 flex items-start gap-4" data-testid="docs-footer-tip">
          <Lightbulb className="w-6 h-6 text-[#d4ff3a] shrink-0 mt-1" />
          <div>
            <h3 className="font-serif text-xl mb-2">Ai nevoie de mai multe detalii?</h3>
            <p className="text-sm text-stone-300 leading-relaxed">
              Această documentație acoperă fluxurile principale. Pentru întrebări tehnice avansate (API endpoints, integrări custom, debug),
              folosește butonul de Support din colțul dreapta-jos sau scrie la <a href="mailto:contact@propmanage.ro" className="text-[#d4ff3a] hover:underline">contact@propmanage.ro</a>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDocumentation;
