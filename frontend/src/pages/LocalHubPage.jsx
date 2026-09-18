import React from "react";
import { Link, useParams, Navigate } from "react-router-dom";
import { ArrowRight, Check, HelpCircle, MapPin, Wrench } from "lucide-react";
import { useSEO } from "../hooks/useSEO";
import {
  getLocalHubBySlug,
  getLocalHubRelated,
  LOCAL_SERVICES,
  LOCAL_CTA_PRIMARY,
} from "../data/localSeo";

const SITE_URL = "https://propmanage.ro";
const ACCENT = "#d4ff3a";

const track = (event) => {
  try { if (window.gtag) window.gtag("event", event); } catch (e) { /* noop */ }
};

const PrimaryCTA = ({ testid }) => (
  <Link
    to={LOCAL_CTA_PRIMARY.to}
    onClick={() => track("local_hub_cta_primary")}
    data-testid={testid}
    className="inline-flex items-center gap-2 rounded-full px-7 py-3.5 font-semibold text-stone-900 transition-transform hover:scale-[1.03]"
    style={{ backgroundColor: ACCENT }}
  >
    {LOCAL_CTA_PRIMARY.label} <ArrowRight className="w-4 h-4" />
  </Link>
);

export default function LocalHubPage() {
  const { localitate } = useParams();
  const page = getLocalHubBySlug(localitate);

  const canonical = page ? `${SITE_URL}${page.path}` : `${SITE_URL}/servicii-pentru-casa/${localitate || ""}`;
  const related = page ? getLocalHubRelated(page.slug) : [];

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
          { "@type": "ListItem", "position": 2, "name": "Servicii pentru casă", "item": `${SITE_URL}/servicii-pentru-casa/cluj-napoca` },
          { "@type": "ListItem", "position": 3, "name": page.city, "item": canonical },
        ] },
        { "@type": "FAQPage", "mainEntity": page.faq.map((f) => ({
          "@type": "Question", "name": f.q, "acceptedAnswer": { "@type": "Answer", "text": f.a },
        })) },
      ],
    } : null,
  });

  if (!page) return <Navigate to="/" replace />;

  const specialistCTA = { label: `Ești specialist? Găsește clienți în ${page.city}`, to: "/devino-specialist" };

  return (
    <div className="min-h-screen bg-[#0b0d0a] text-stone-100" data-testid={`local-hub-${page.slug}`}>
      <div className="max-w-3xl mx-auto px-5 sm:px-6 py-14 sm:py-20">
        {/* Breadcrumb */}
        <nav className="text-xs text-stone-500 mb-6 flex items-center gap-2 flex-wrap" data-testid="local-breadcrumb">
          <Link to="/" className="hover:text-stone-300">Acasă</Link>
          <span>/</span>
          <span className="text-stone-400">Servicii pentru casă</span>
          <span>/</span>
          <span className="text-stone-300">{page.city}</span>
        </nav>

        {/* Hero */}
        <div className="inline-flex items-center gap-1.5 text-xs rounded-full px-3 py-1 mb-5 border" style={{ color: ACCENT, borderColor: `${ACCENT}33`, backgroundColor: `${ACCENT}14` }}>
          <MapPin className="w-3.5 h-3.5" /> {page.badge} · {page.county}
        </div>
        <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl tracking-tight mb-5" data-testid="local-h1">{page.h1}</h1>
        <p className="text-stone-300 text-lg leading-relaxed mb-8">{page.intro}</p>
        <div className="flex flex-wrap items-center gap-3">
          <PrimaryCTA testid="local-cta-hero" />
          <Link
            to={specialistCTA.to}
            onClick={() => track("local_hub_cta_specialist")}
            data-testid="local-cta-specialist-hero"
            className="inline-flex items-center gap-2 rounded-full px-6 py-3.5 font-medium text-stone-200 border border-white/15 hover:bg-white/[0.05] transition"
          >
            <Wrench className="w-4 h-4" /> {specialistCTA.label}
          </Link>
        </div>

        {/* Local context */}
        <section className="mt-14" data-testid="local-context">
          <h2 className="font-serif text-2xl sm:text-3xl mb-4">Locuințele din {page.city}</h2>
          {page.localContext.map((p, i) => (
            <p key={i} className="text-stone-300 leading-relaxed mb-4">{p}</p>
          ))}
        </section>

        {/* Services grid */}
        <section className="mt-14" data-testid="local-services">
          <h2 className="font-serif text-2xl sm:text-3xl mb-6">Serviciile PropManage disponibile în {page.city}</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {LOCAL_SERVICES.map((s, i) => (
              <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 flex flex-col" data-testid={`local-service-${i}`}>
                <h3 className="text-stone-100 font-semibold mb-2">{s.title}</h3>
                <p className="text-stone-400 text-sm leading-relaxed mb-4 flex-1">{s.body}</p>
                <Link to={s.to} className="inline-flex items-center gap-1.5 text-sm font-medium group" style={{ color: ACCENT }} data-testid={`local-service-link-${i}`}>
                  {s.linkLabel} <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* Housing types + owner needs */}
        <section className="mt-14 grid sm:grid-cols-2 gap-8" data-testid="local-housing-needs">
          <div>
            <h2 className="font-serif text-xl sm:text-2xl mb-4">Tipuri de locuințe în {page.city}</h2>
            <ul className="space-y-2.5">
              {page.housingTypes.map((b, i) => (
                <li key={i} className="flex items-start gap-3 text-stone-200 text-sm">
                  <Check className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: ACCENT }} />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="font-serif text-xl sm:text-2xl mb-4">Nevoi uzuale ale proprietarilor</h2>
            <ul className="space-y-2.5">
              {page.ownerNeeds.map((b, i) => (
                <li key={i} className="flex items-start gap-3 text-stone-200 text-sm">
                  <Check className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: ACCENT }} />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Primary CTA band */}
        <div className="mt-14 rounded-2xl border border-white/10 bg-white/[0.03] p-7 text-center" data-testid="local-midcta">
          <p className="text-stone-200 text-lg mb-2">Vrei să vezi cum este documentată propria locuință?</p>
          <p className="text-stone-400 text-sm mb-5">Creează gratuit contul PropManage și începe evaluarea casei tale din {page.city}.</p>
          <PrimaryCTA testid="local-cta-mid" />
        </div>

        {/* Specialists section */}
        <section className="mt-14" data-testid="local-specialists">
          <h2 className="font-serif text-2xl sm:text-3xl mb-4">Specialiști verificați în {page.city}</h2>
          <p className="text-stone-300 leading-relaxed mb-6">{page.specialistsIntro}</p>
          <Link
            to={specialistCTA.to}
            onClick={() => track("local_hub_cta_specialist")}
            data-testid="local-cta-specialist"
            className="inline-flex items-center gap-2 rounded-full px-6 py-3 font-semibold text-stone-900 transition-transform hover:scale-[1.03]"
            style={{ backgroundColor: ACCENT }}
          >
            <Wrench className="w-4 h-4" /> {specialistCTA.label}
          </Link>
        </section>

        {/* FAQ */}
        <section className="mt-14" data-testid="local-faq">
          <h2 className="font-serif text-2xl sm:text-3xl mb-6">Întrebări frecvente — {page.city}</h2>
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

        {/* Related internal links */}
        <section className="mt-14" data-testid="local-related">
          <h2 className="font-serif text-xl mb-5">Continuă cu</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {related.map((r, i) => (
              <Link key={i} to={r.to} className="rounded-xl border border-white/10 px-4 py-3 flex items-center justify-between hover:bg-white/[0.05] transition group" data-testid={`local-related-${i}`}>
                <span className="text-sm text-stone-200">{r.label}</span>
                <ArrowRight className="w-4 h-4 text-stone-500 group-hover:text-[color:var(--acc)] transition" style={{ "--acc": ACCENT }} />
              </Link>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <div className="mt-16 text-center">
          <PrimaryCTA testid="local-cta-final" />
        </div>
      </div>
    </div>
  );
}
