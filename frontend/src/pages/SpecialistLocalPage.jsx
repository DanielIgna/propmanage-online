import React from "react";
import { Link, useParams, Navigate } from "react-router-dom";
import { ArrowRight, Check, HelpCircle, MapPin, ShieldCheck, Wallet, FileCheck2, Users } from "lucide-react";
import { useSEO } from "../hooks/useSEO";
import { getSpecialistLocal } from "../data/specialistLocalSeo";

const SITE_URL = "https://propmanage.ro";
const ACCENT = "#d4ff3a";

const track = (event) => {
  try { if (window.gtag) window.gtag("event", event); } catch (e) { /* noop */ }
};

const HOW_IT_WORKS = [
  { icon: FileCheck2, t: "Postezi profilul, primești cereri", d: "Proprietarii descriu lucrarea, iar tu primești cereri relevante pentru meseria ta — fără prospectare la rece." },
  { icon: Users, t: "Trimiți oferte și câștigi proiecte", d: "Compari cererile, trimiți oferta ta, iar dacă e acceptată începi lucrarea cu termeni clari." },
  { icon: ShieldCheck, t: "Profil verificat = mai multă încredere", d: "Verificarea identității și a firmei te diferențiază de contactele anonime și îți crește rata de acceptare." },
  { icon: Wallet, t: "Plată protejată prin escrow", d: "Banii sunt protejați și eliberați pe etape, pe măsură ce finalizezi lucrarea convenită." },
];

const BENEFITS = [
  "Cereri reale de la proprietari din zona ta, fără costuri de start",
  "Profil verificat cu portofoliu și recenzii reale",
  "Plată protejată prin escrow, pe etape",
  "Documentația lucrării ținută ordonat în platformă",
  "Vizibilitate în rețeaua PropManage din zona Cluj",
];

export default function SpecialistLocalPage() {
  const { trade, localitate } = useParams();
  const page = getSpecialistLocal(trade, localitate);

  const canonical = page ? `${SITE_URL}${page.path}` : `${SITE_URL}/devino-specialist`;

  useSEO({
    title: page ? page.title : "PropManage",
    description: page ? page.description : "",
    canonical,
    noindex: !page,
    jsonLd: page ? {
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "WebPage", "name": page.title, "description": page.description, "url": canonical },
        { "@type": "BreadcrumbList", "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Acasă", "item": `${SITE_URL}/` },
          { "@type": "ListItem", "position": 2, "name": "Devino specialist", "item": `${SITE_URL}/devino-specialist` },
          { "@type": "ListItem", "position": 3, "name": page.trade.h1Subject, "item": `${SITE_URL}${page.trade.nationalPath}` },
          { "@type": "ListItem", "position": 4, "name": page.loc.city, "item": canonical },
        ] },
        { "@type": "FAQPage", "mainEntity": page.faq.map((f) => ({
          "@type": "Question", "name": f.q, "acceptedAnswer": { "@type": "Answer", "text": f.a },
        })) },
      ],
    } : null,
  });

  if (!page) return <Navigate to="/devino-specialist" replace />;

  const ctaLabel = `Înregistrează-te gratuit ca ${page.trade.word}`;

  return (
    <div className="min-h-screen bg-[#0b0d0a] text-stone-100" data-testid={`spec-local-${page.trade.slug}-${page.loc.slug}`}>
      <div className="max-w-3xl mx-auto px-5 sm:px-6 py-14 sm:py-20">
        {/* Breadcrumb */}
        <nav className="text-xs text-stone-500 mb-6 flex items-center gap-2 flex-wrap" data-testid="spec-local-breadcrumb">
          <Link to="/" className="hover:text-stone-300">Acasă</Link>
          <span>/</span>
          <Link to="/devino-specialist" className="hover:text-stone-300">Devino specialist</Link>
          <span>/</span>
          <span className="text-stone-300">{page.trade.h1Subject} · {page.loc.city}</span>
        </nav>

        {/* Hero */}
        <div className="inline-flex items-center gap-1.5 text-xs rounded-full px-3 py-1 mb-5 border" style={{ color: ACCENT, borderColor: `${ACCENT}33`, backgroundColor: `${ACCENT}14` }}>
          <MapPin className="w-3.5 h-3.5" /> {page.trade.h1Subject} · {page.loc.city}
        </div>
        <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl tracking-tight mb-5" data-testid="spec-local-h1">{page.h1}</h1>
        <p className="text-stone-300 text-lg leading-relaxed mb-8">{page.intro}</p>
        <Link
          to="/devino-specialist"
          onClick={() => track("spec_local_cta")}
          data-testid="spec-local-cta-hero"
          className="inline-flex items-center gap-2 rounded-full px-7 py-3.5 font-semibold text-stone-900 transition-transform hover:scale-[1.03]"
          style={{ backgroundColor: ACCENT }}
        >
          {ctaLabel} <ArrowRight className="w-4 h-4" />
        </Link>

        {/* Work types */}
        <section className="mt-14" data-testid="spec-local-work">
          <h2 className="font-serif text-2xl sm:text-3xl mb-4">Ce lucrări primești ca {page.trade.word} în {page.loc.city}</h2>
          <ul className="space-y-2.5">
            {page.trade.workTypes.map((b, i) => (
              <li key={i} className="flex items-start gap-3 text-stone-200">
                <Check className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: ACCENT }} />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Why this locality */}
        <section className="mt-14" data-testid="spec-local-demand">
          <h2 className="font-serif text-2xl sm:text-3xl mb-4">De ce e cerere în {page.loc.city}</h2>
          <p className="text-stone-400 text-sm mb-4">Zona acoperită: {page.loc.zone}.</p>
          {page.loc.demand.map((p, i) => (
            <p key={i} className="text-stone-300 leading-relaxed mb-4">{p}</p>
          ))}
        </section>

        {/* How PropManage works */}
        <section className="mt-14" data-testid="spec-local-how">
          <h2 className="font-serif text-2xl sm:text-3xl mb-6">Cum funcționează PropManage</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {HOW_IT_WORKS.map((s, i) => (
              <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5" data-testid={`spec-local-step-${i}`}>
                <s.icon className="w-6 h-6 mb-3" style={{ color: ACCENT }} />
                <h3 className="text-stone-100 font-semibold mb-1.5">{s.t}</h3>
                <p className="text-stone-400 text-sm leading-relaxed">{s.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Profile & verification */}
        <section className="mt-14" data-testid="spec-local-profile">
          <h2 className="font-serif text-2xl sm:text-3xl mb-4">Profil verificat și documentație</h2>
          <p className="text-stone-300 leading-relaxed mb-3">
            Îți construiești un profil verificat cu portofoliu, meserii și zona în care lucrezi. Verificarea identității și a firmei îți crește credibilitatea, iar documentația fiecărei lucrări (ofertă, etape, finalizare) rămâne ordonată în platformă.
          </p>
          <p className="text-stone-300 leading-relaxed">
            Recenziile reale de la proprietari se adună în timp și devin cel mai bun argument pentru următoarele proiecte din {page.loc.city}.
          </p>
        </section>

        {/* Benefits */}
        <section className="mt-14" data-testid="spec-local-benefits">
          <h2 className="font-serif text-2xl sm:text-3xl mb-4">Beneficii</h2>
          <ul className="space-y-2.5">
            {BENEFITS.map((b, i) => (
              <li key={i} className="flex items-start gap-3 text-stone-200">
                <Check className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: ACCENT }} />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* CTA band */}
        <div className="mt-14 rounded-2xl border border-white/10 bg-white/[0.03] p-7 text-center" data-testid="spec-local-midcta">
          <p className="text-stone-200 text-lg mb-2">Vrei clienți ca {page.trade.word} în {page.loc.city}?</p>
          <p className="text-stone-400 text-sm mb-5">Înregistrarea este gratuită, fără costuri de start.</p>
          <Link
            to="/devino-specialist"
            onClick={() => track("spec_local_cta")}
            data-testid="spec-local-cta-mid"
            className="inline-flex items-center gap-2 rounded-full px-7 py-3.5 font-semibold text-stone-900 transition-transform hover:scale-[1.03]"
            style={{ backgroundColor: ACCENT }}
          >
            {ctaLabel} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* FAQ */}
        <section className="mt-14" data-testid="spec-local-faq">
          <h2 className="font-serif text-2xl sm:text-3xl mb-6">Întrebări frecvente</h2>
          <div className="space-y-5">
            {page.faq.map((f, i) => (
              <div key={i} className="border-b border-white/5 pb-5">
                <h3 className="flex items-start gap-2 text-stone-100 font-medium mb-2">
                  <HelpCircle className="w-4 h-4 mt-1 flex-shrink-0" style={{ color: ACCENT }} />
                  {f.q}
                </h3>
                <p className="text-stone-400 leading-relaxed pl-6">{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Related */}
        <section className="mt-14" data-testid="spec-local-related">
          <h2 className="font-serif text-xl mb-5">Continuă cu</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {page.related.map((r, i) => (
              <Link key={i} to={r.to} className="rounded-xl border border-white/10 px-4 py-3 flex items-center justify-between hover:bg-white/[0.05] transition group" data-testid={`spec-local-related-${i}`}>
                <span className="text-sm text-stone-200">{r.label}</span>
                <ArrowRight className="w-4 h-4 text-stone-500 group-hover:text-[color:var(--acc)] transition" style={{ "--acc": ACCENT }} />
              </Link>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <div className="mt-16 text-center">
          <Link
            to="/devino-specialist"
            onClick={() => track("spec_local_cta")}
            data-testid="spec-local-cta-final"
            className="inline-flex items-center gap-2 rounded-full px-7 py-3.5 font-semibold text-stone-900 transition-transform hover:scale-[1.03]"
            style={{ backgroundColor: ACCENT }}
          >
            {ctaLabel} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
