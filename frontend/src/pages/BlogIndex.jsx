// /blog — editorial hub PropManage. Reuses the existing GHIDURI registry and the
// Design style system, organised into commercial content clusters with original
// cluster intros, internal linking to services and real CTAs. Distinct from
// /community (which stays the community feature). No content duplication.
import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Building2, Clock, ArrowRight, Newspaper } from "lucide-react";
import { useSEO } from "../hooks/useSEO";
import { GHIDURI } from "../data/ghiduri";
import { DI_STYLES } from "../data/designInterior";

const SITE_URL = "https://propmanage.ro";
const bySlug = Object.fromEntries(GHIDURI.map((g) => [g.slug, g]));

// Commercial content clusters — each maps to a real service + CTA (no thin pages).
const CLUSTERS = [
  {
    id: "design",
    title: "Design interior",
    intro: "De la ce include un proiect, la cum alegi un designer și cât costă o amenajare — tot ce trebuie să știi înainte să începi.",
    cta: { label: "Începe proiectul de design", to: "/design-interior" },
    slugs: ["ce-este-designul-interior", "design-interior-sau-arhitect", "ce-include-un-proiect-de-design-interior", "de-ce-conteaza-masuratorile-inainte-de-design", "cum-alegi-designer-interior", "cat-costa-design-interior-cluj", "design-interior-vs-amenajare", "compartimentare-cost-amenajare"],
  },
  {
    id: "renovare",
    title: "Renovare & costuri",
    intro: "Bugete reale 2026, cum pregătești apartamentul de șantier și ce verifici înainte să demolezi ceva.",
    cta: { label: "Cere ofertă pentru renovare", to: "/design-interior/renovare" },
    slugs: ["cost-renovare-apartament-2-camere", "cost-instalatie-electrica-apartament", "cum-pregatesti-apartament-renovare", "ce-verifici-inainte-de-renovare-apartament"],
  },
  {
    id: "audit",
    title: "Audit & evaluare locuință",
    intro: "Ce măsoară Scorul Casei, cum funcționează un audit tehnic și de ce contează un plan de mentenanță și un Digital Twin.",
    cta: { label: "Evaluează-ți casa gratuit", to: "/scorul-casei" },
    slugs: ["audit-tehnic-apartament-pret", "scorul-casei-ce-masoara", "plan-mentenanta-locuinta", "ce-este-digital-twin-locuinta"],
  },
  {
    id: "imobile",
    title: "Imobile verificate",
    intro: "Cum verifici un apartament înainte de cumpărare, ce documente ceri și ce riscuri ascund blocurile vechi.",
    cta: { label: "Vezi imobile verificate", to: "/imobile-verificate" },
    slugs: ["verificare-apartament-inainte-de-cumparare", "imobile-verificate-cum-functioneaza", "ce-documente-verifici-cumparare-apartament", "probleme-tehnice-apartament-inainte-cumparare", "verificare-imobil-digital-twin", "riscuri-cumparare-apartament-bloc-vechi", "cartea-casei-istoric-locuinta"],
  },
  {
    id: "specialisti",
    title: "Specialiști & lucrări",
    intro: "Cum verifici un instalator sau un zugrav, cum funcționează plata prin escrow și cum eviți surprizele pe șantier.",
    cta: { label: "Caută un specialist", to: "/marketplace" },
    slugs: ["cum-verifici-instalator", "cum-functioneaza-escrow-lucrari", "cum-alegi-zugrav-bun"],
  },
];

// Featured styles from the design style library (links to style pages, not guides).
const STYLE_LINKS = ["contemporary", "mid-century", "minimalist", "japandi", "scandinavian", "wabi-sabi", "quiet-luxury", "biophilic", "maximalist"]
  .filter((s) => DI_STYLES[s])
  .map((s) => ({ slug: s, label: DI_STYLES[s].h1.replace(/^Design interior stil /i, "").replace(/^Design interior /i, "") }));

export const BlogIndex = () => {
  const allPosts = CLUSTERS.flatMap((c) => c.slugs).map((s) => bySlug[s]).filter(Boolean);
  useSEO({
    title: "Blog PropManage · Design interior, renovare, audit și imobile verificate 2026",
    description: "Articole editoriale PropManage: design interior și stiluri, renovare și costuri, audit și evaluare locuință, imobile verificate și lucrări cu specialiști verificați. Actualizat 2026.",
    canonical: `${SITE_URL}/blog`,
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Blog",
          "name": "Blog PropManage",
          "url": `${SITE_URL}/blog`,
          "inLanguage": "ro-RO",
          "publisher": { "@type": "Organization", "name": "PropManage", "url": SITE_URL },
          "blogPost": allPosts.map((g) => ({
            "@type": "BlogPosting",
            "headline": g.title,
            "url": `${SITE_URL}/ghiduri/${g.slug}`,
            "datePublished": g.publishedAt,
            "dateModified": g.updatedAt,
            "description": g.description,
          })),
        },
        {
          "@type": "BreadcrumbList",
          "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "Acasă", "item": `${SITE_URL}/` },
            { "@type": "ListItem", "position": 2, "name": "Blog", "item": `${SITE_URL}/blog` },
          ],
        },
      ],
    },
  });

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-stone-100" data-testid="blog-index">
      <header className="border-b border-white/5 sticky top-0 z-30 bg-[#0a0a0b]/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#d4ff3a] to-[#a8e028] flex items-center justify-center">
              <Building2 className="w-3.5 h-3.5 text-black" strokeWidth={2.5} />
            </div>
            <span className="font-serif text-lg font-semibold">PropManage</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/ghiduri" className="text-xs text-stone-400 hover:text-white" data-testid="blog-to-ghiduri">Ghiduri</Link>
            <Link to="/design-interior" className="text-xs text-stone-400 hover:text-white">Design interior</Link>
            <Link to="/imobile-verificate" className="text-xs text-stone-400 hover:text-white">Imobile Verificate</Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <nav className="text-xs text-stone-500 mb-6 flex flex-wrap items-center gap-1.5" aria-label="Breadcrumb">
          <Link to="/" className="hover:text-stone-200">Acasă</Link>
          <span>/</span>
          <span className="text-stone-300">Blog</span>
        </nav>

        <div className="mb-14 max-w-3xl">
          <div className="inline-flex items-center gap-1.5 text-xs text-[#d4ff3a] bg-[#d4ff3a]/10 border border-[#d4ff3a]/20 rounded-full px-3 py-1 mb-4">
            <Newspaper className="w-3 h-3" />
            Blog editorial · actualizat 2026
          </div>
          <h1 className="font-serif text-4xl sm:text-6xl tracking-tight mb-4" data-testid="blog-h1">
            Idei, costuri și verificări pentru locuința ta
          </h1>
          <p className="text-stone-400 text-lg leading-relaxed">
            Design interior și stiluri, renovare și bugete reale, audit și evaluare, imobile verificate și lucrări cu specialiști verificați — organizate pe teme, cu pași concreți către acțiune.
          </p>
        </div>

        {/* Content clusters */}
        <div className="space-y-16">
          {CLUSTERS.map((cluster) => {
            const posts = cluster.slugs.map((s) => bySlug[s]).filter(Boolean);
            if (!posts.length) return null;
            return (
              <section key={cluster.id} data-testid={`blog-cluster-${cluster.id}`}>
                <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
                  <div className="max-w-2xl">
                    <h2 className="font-serif text-2xl sm:text-3xl mb-2">{cluster.title}</h2>
                    <p className="text-sm text-stone-400 leading-relaxed">{cluster.intro}</p>
                  </div>
                  <Link to={cluster.cta.to} data-testid={`blog-cta-${cluster.id}`}
                    className="shrink-0 inline-flex items-center gap-1.5 bg-[#d4ff3a] text-black px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-[#bfe632] transition">
                    {cluster.cta.label} <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {posts.map((g, i) => (
                    <motion.div key={g.slug} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }} transition={{ delay: (i % 3) * 0.05 }}>
                      <Link to={`/ghiduri/${g.slug}`} data-testid={`blog-card-${g.slug}`}
                        className="block glass-strong rounded-2xl p-6 hover:bg-white/[0.06] transition group h-full">
                        <div className="text-[10px] uppercase tracking-wider font-semibold text-[#d4ff3a] mb-3">{g.tag}</div>
                        <h3 className="font-serif text-lg leading-tight mb-3 group-hover:text-[#d4ff3a] transition">{g.h1}</h3>
                        <p className="text-sm text-stone-400 leading-relaxed mb-4 line-clamp-3">{g.description}</p>
                        <div className="flex items-center justify-between text-xs text-stone-500 pt-3 border-t border-white/5">
                          <span className="flex items-center gap-1.5"><Clock className="w-3 h-3" />{g.readMins} min</span>
                          <span className="flex items-center gap-1 text-stone-400 group-hover:text-[#d4ff3a] transition">Citește <ArrowRight className="w-3 h-3" /></span>
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </section>
            );
          })}

          {/* Styles cluster — links to the design style library */}
          {STYLE_LINKS.length > 0 && (
            <section data-testid="blog-cluster-stiluri">
              <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
                <div className="max-w-2xl">
                  <h2 className="font-serif text-2xl sm:text-3xl mb-2">Stiluri de design</h2>
                  <p className="text-sm text-stone-400 leading-relaxed">Explorează stilurile PropManage — caracteristici, materiale, culori și spații potrivite — și vezi care ți se potrivește.</p>
                </div>
                <Link to="/design-interior" data-testid="blog-cta-stiluri"
                  className="shrink-0 inline-flex items-center gap-1.5 bg-[#d4ff3a] text-black px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-[#bfe632] transition">
                  Vezi toate stilurile <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
              <div className="flex flex-wrap gap-2.5">
                {STYLE_LINKS.map((s) => (
                  <Link key={s.slug} to={`/design-interior/stil/${s.slug}`} data-testid={`blog-style-${s.slug}`}
                    className="glass-strong rounded-full px-4 py-2 text-sm text-stone-300 hover:text-[#d4ff3a] hover:bg-white/[0.06] transition capitalize">
                    {s.label}
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Bottom CTA */}
        <div className="mt-20 glass-strong rounded-3xl p-8 sm:p-10 text-center">
          <h2 className="font-serif text-3xl mb-3">Pregătit să treci la acțiune?</h2>
          <p className="text-stone-400 mb-6 max-w-xl mx-auto">
            Creează un cont gratuit, evaluează-ți casa sau cere oferte de la specialiști verificați — în mai puțin de 5 minute.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/scorul-casei" className="inline-block bg-[#d4ff3a] text-black px-7 py-3 rounded-full text-sm font-semibold hover:bg-[#bfe632] transition" data-testid="blog-cta-evaluare">Evaluează-ți casa gratuit</Link>
            <Link to="/register" className="inline-block border border-white/15 text-stone-200 px-7 py-3 rounded-full text-sm font-semibold hover:bg-white/[0.06] transition" data-testid="blog-cta-cont">Creează cont gratuit</Link>
          </div>
        </div>
      </main>

      <footer className="border-t border-white/5 mt-16 py-8 px-6 text-center text-xs text-stone-500">
        © {new Date().getFullYear()} PropManage · operat de Vintage Furniture S.R.L. (CUI 35250247) · <Link to="/terms" className="hover:text-stone-300">Termeni</Link> · <Link to="/privacy" className="hover:text-stone-300">Confidențialitate</Link>
      </footer>
    </div>
  );
};

export default BlogIndex;
