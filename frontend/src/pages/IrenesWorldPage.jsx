// /design-interior/irenes-world — Irene's World Interior Design Studio.
// A studio/portfolio LAYER inside the PropManage Design Interior ecosystem (not a
// separate site). Factual content only — no invented projects, no "official
// dealer/distributor/exclusive" claims. INDEX (original, useful content).
import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Home, Sofa, Palette, Layers, ShieldCheck, ArrowRight, ExternalLink, Facebook } from "lucide-react";
import { useSEO } from "../hooks/useSEO";

const SITE_URL = "https://propmanage.ro";
const FB_URL = "https://www.facebook.com/profile.php?id=100047348265209";

const OFFERINGS = [
  { icon: Palette, title: "Design interior", text: "Concept, paletă, mobilare și amenajare pentru locuințe și spații comerciale, adaptate stilului și bugetului tău." },
  { icon: Sofa, title: "Selecție mobilier", text: "Curatoriere de mobilier și obiecte, cu atenție la proporții, materiale și integrarea în concept." },
  { icon: Layers, title: "Colaborare cu branduri și furnizori", text: "Lucrul cu branduri și furnizori pentru materiale și mobilier, în funcție de cerințele fiecărui proiect." },
  { icon: ShieldCheck, title: "Implementare prin PropManage", text: "Când proiectul trece la execuție, se conectează la specialiștii verificați și la plățile protejate prin escrow ale platformei." },
];

const ECO_LINKS = [
  { to: "/design-interior", title: "Interior Intelligence", text: "Procesul complet de design interior, în 17 etape." },
  { to: "/design-interior/stil/contemporary", title: "Stiluri de design", text: "Explorează stilurile și vezi care ți se potrivește." },
  { to: "/servicii/mobilier", title: "Mobilier la comandă", text: "De la proiect la montaj, cu parteneri verificați." },
  { to: "/imobile-verificate", title: "Imobile Verificate", text: "Proprietăți cu istoric tehnic transparent." },
];

export const IrenesWorldPage = () => {
  useSEO({
    title: "Irene's World — Interior Design Studio | PropManage",
    description: "Irene's World este un studio de design interior din ecosistemul PropManage: design interior, selecție de mobilier și colaborare cu branduri și furnizori pentru proiecte, cu implementare prin specialiști verificați.",
    canonical: `${SITE_URL}/design-interior/irenes-world`,
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "ProfilePage",
          "url": `${SITE_URL}/design-interior/irenes-world`,
          "inLanguage": "ro-RO",
          "mainEntity": {
            "@type": "Organization",
            "name": "Irene's World",
            "alternateName": "Irene's World — Interior Design Studio",
            "description": "Studio de design interior: design, selecție de mobilier și colaborare cu branduri și furnizori pentru proiecte.",
            "url": `${SITE_URL}/design-interior/irenes-world`,
            "sameAs": [FB_URL],
            "knowsAbout": ["Design interior", "Selecție mobilier", "Amenajări interioare"],
            "memberOf": { "@type": "Organization", "name": "PropManage", "url": SITE_URL },
          },
        },
        {
          "@type": "BreadcrumbList",
          "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "Acasă", "item": `${SITE_URL}/` },
            { "@type": "ListItem", "position": 2, "name": "Design interior", "item": `${SITE_URL}/design-interior` },
            { "@type": "ListItem", "position": 3, "name": "Irene's World", "item": `${SITE_URL}/design-interior/irenes-world` },
          ],
        },
      ],
    },
  });

  return (
    <div className="min-h-screen bg-white text-stone-800" data-testid="irenes-world-root">
      {/* Header (light, on-brand with /design-interior) */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-stone-100">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between gap-4">
          <Link to="/design-interior" className="flex items-center gap-2 shrink-0" data-testid="iw-nav-design">
            <Home className="w-5 h-5 text-emerald-700" />
            <span className="font-black text-stone-900 leading-none">Interior Intelligence<span className="block text-[10px] font-semibold text-stone-400 tracking-wide">by PropManage</span></span>
          </Link>
          <Link to="/design-interior#formular" className="px-4 py-2 rounded-full bg-emerald-700 text-white text-sm font-bold hover:bg-emerald-800 transition-colors" data-testid="iw-header-cta">Începe proiectul</Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 sm:px-8 py-12 sm:py-16">
        <nav className="text-xs text-stone-400 mb-6 flex flex-wrap items-center gap-1.5" aria-label="Breadcrumb">
          <Link to="/" className="hover:text-stone-600">Acasă</Link><span>/</span>
          <Link to="/design-interior" className="hover:text-stone-600">Design interior</Link><span>/</span>
          <span className="text-stone-600">Irene's World</span>
        </nav>

        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-14 max-w-3xl">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-full px-3 py-1 mb-4">
            Studio în ecosistemul PropManage
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-stone-900 mb-3" data-testid="iw-h1">Irene's World</h1>
          <p className="text-lg font-bold text-stone-600 mb-5">Interior Design Studio</p>
          <p className="text-stone-600 text-lg leading-relaxed">
            Irene's World este un studio de design interior care lucrează cu o selecție de mobilier și colaborează cu branduri și furnizori pentru proiecte. În cadrul PropManage, studioul devine un nod de design conectat la proces, specialiști verificați și plăți protejate — un strat de portofoliu, nu un site separat.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/design-interior#formular" className="inline-flex items-center gap-1.5 bg-emerald-700 text-white px-6 py-3 rounded-full text-sm font-bold hover:bg-emerald-800 transition-colors" data-testid="iw-cta-start">
              Începe un proiect de design <ArrowRight className="w-4 h-4" />
            </Link>
            <a href={FB_URL} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1.5 border border-stone-200 text-stone-700 px-6 py-3 rounded-full text-sm font-bold hover:bg-stone-50 transition-colors" data-testid="iw-facebook-link">
              <Facebook className="w-4 h-4" /> Facebook <ExternalLink className="w-3.5 h-3.5 text-stone-400" />
            </a>
          </div>
        </motion.div>

        {/* What the studio does */}
        <section className="mb-16">
          <h2 className="text-2xl sm:text-3xl font-black text-stone-900 mb-6">Ce oferă studioul</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {OFFERINGS.map((o, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}
                className="p-6 rounded-3xl border border-stone-100 hover:border-emerald-200 hover:shadow-lg transition-all" data-testid={`iw-offer-${i}`}>
                <o.icon className="w-6 h-6 text-emerald-700 mb-3" />
                <h3 className="font-bold text-stone-900 mb-1.5">{o.title}</h3>
                <p className="text-sm text-stone-500 leading-relaxed">{o.text}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Connection to the 17-step process */}
        <section className="mb-16">
          <h2 className="text-2xl sm:text-3xl font-black text-stone-900 mb-4">Cum se conectează la procesul PropManage</h2>
          <p className="text-stone-600 leading-relaxed mb-4 max-w-3xl">
            Designul realizat în studio se poate integra în procesul PropManage de design interior în 17 etape — de la audit și ridicare de măsurători, la modelul 3D / Digital Twin, alegerea materialelor și implementarea cu echipe verificate. Rolul de design (concept, mobilare, selecție mobilier) se așază natural în etapa de design, iar restul etapelor rămân acoperite de specialiștii și mecanismele platformei.
          </p>
          <Link to="/design-interior" className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-800 hover:text-emerald-900" data-testid="iw-process-link">
            Vezi procesul complet în 17 etape <ArrowRight className="w-4 h-4" />
          </Link>
        </section>

        {/* Projects — prepared, no invented data */}
        <section className="mb-16">
          <h2 className="text-2xl sm:text-3xl font-black text-stone-900 mb-3">Proiecte</h2>
          <div className="p-6 rounded-3xl bg-stone-50 border border-stone-100" data-testid="iw-projects-note">
            <p className="text-sm text-stone-500 leading-relaxed">
              Portofoliul de proiecte al studioului urmează să fie conectat în platformă, pe măsură ce fiecare proiect trece prin proces (concept → materiale → implementare). Afișăm aici doar proiecte reale, documentate — fără exemple fictive.
            </p>
          </div>
        </section>

        {/* Ecosystem internal links */}
        <section className="mb-16">
          <h2 className="text-2xl sm:text-3xl font-black text-stone-900 mb-6">Parte din ecosistem</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {ECO_LINKS.map((l, i) => (
              <Link key={i} to={l.to} className="p-5 rounded-3xl border border-stone-100 hover:border-emerald-300 hover:shadow-lg transition-all group" data-testid={`iw-eco-${i}`}>
                <h3 className="font-bold text-stone-900 text-sm group-hover:text-emerald-800">{l.title} →</h3>
                <p className="text-xs text-stone-500 mt-1">{l.text}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* Bottom CTA */}
        <div className="rounded-[2rem] bg-emerald-700 text-white p-8 sm:p-10 text-center">
          <h2 className="text-2xl sm:text-3xl font-black mb-3">Ai un proiect în minte?</h2>
          <p className="text-emerald-50 mb-6 max-w-xl mx-auto">Pornește un proiect de design interior prin PropManage — consultanță gratuită, specialiști verificați și plăți protejate prin escrow.</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/design-interior#formular" className="inline-block bg-white text-emerald-800 px-7 py-3 rounded-full text-sm font-bold hover:bg-emerald-50 transition-colors" data-testid="iw-bottom-cta-start">Programează consultanța gratuită</Link>
            <Link to="/register" className="inline-block border border-white/40 text-white px-7 py-3 rounded-full text-sm font-bold hover:bg-emerald-600 transition-colors" data-testid="iw-bottom-cta-account">Creează cont gratuit</Link>
          </div>
        </div>
      </main>

      <footer className="border-t border-stone-100 mt-8 py-8 px-6 text-center text-xs text-stone-400">
        © {new Date().getFullYear()} PropManage · Irene's World este un studio de design în ecosistemul PropManage · <Link to="/design-interior" className="hover:text-stone-600">Design interior</Link>
      </footer>
    </div>
  );
};

export default IrenesWorldPage;
