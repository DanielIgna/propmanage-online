// InteriorDesignLanding — /design-interior · serviciu independent, acces liber.
// Identitate vizuală proprie: minimalist premium, alb + gri deschis + lemn natur + accente verzi.
import React, { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import {
  Sofa, Sparkles, ArrowRight, Check, Star, ChevronDown, MessageCircle,
  Send, Ruler, Palette, Wallet, Home, X,
} from "lucide-react";
import { API } from "./DashShared";
import { useDynamicSEO } from "../lib/useDynamicSEO";

const ax = axios.create({ baseURL: API });

const Section = ({ id, children, className = "" }) => (
  <section id={id} className={`max-w-6xl mx-auto px-5 sm:px-8 ${className}`}>{children}</section>
);

const FAQItem = ({ q, a, idx }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-stone-200" itemScope itemProp="mainEntity" itemType="https://schema.org/Question">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between gap-4 py-4 text-left" data-testid={`id-faq-${idx}`}>
        <span className="font-semibold text-stone-800" itemProp="name">{q}</span>
        <ChevronDown className={`w-4 h-4 text-emerald-700 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="pb-4 text-sm text-stone-600 leading-relaxed" itemScope itemProp="acceptedAnswer" itemType="https://schema.org/Answer">
          <span itemProp="text">{a}</span>
        </div>
      )}
    </div>
  );
};

const AssistantWidget = () => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([{ role: "assistant", text: "Bună! Sunt asistentul de design interior. Întreabă-mă despre stiluri, bugete, culori, iluminat sau amenajarea oricărei camere. 🛋" }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async () => {
    const q = input.trim();
    if (!q || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: q }]);
    setBusy(true);
    try {
      const r = await ax.post("/interior-design/assistant", { question: q, session_id: sessionId });
      setSessionId(r.data.session_id);
      setMessages((m) => [...m, { role: "assistant", text: r.data.answer }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", text: "A apărut o eroare — te rog reîncearcă." }]);
    }
    setBusy(false);
  };

  return (
    <>
      <button onClick={() => setOpen(!open)} className="fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full bg-emerald-700 text-white shadow-xl flex items-center justify-center hover:bg-emerald-800 transition-colors" data-testid="id-assistant-fab" aria-label="Asistent AI design interior">
        {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>
      {open && (
        <div className="fixed bottom-24 right-5 z-50 w-[92vw] max-w-sm rounded-2xl bg-white shadow-2xl border border-stone-200 flex flex-col overflow-hidden" data-testid="id-assistant-panel">
          <div className="px-4 py-3 bg-emerald-700 text-white text-sm font-bold flex items-center gap-2"><Sparkles className="w-4 h-4" /> Asistent Design Interior</div>
          <div className="flex-1 max-h-80 overflow-y-auto p-3 space-y-2 bg-stone-50">
            {messages.map((m, i) => (
              <div key={i} className={`text-sm p-2.5 rounded-xl max-w-[85%] ${m.role === "user" ? "ml-auto bg-emerald-700 text-white" : "bg-white border border-stone-200 text-stone-700"}`} data-testid={`id-assistant-msg-${i}`}>{m.text}</div>
            ))}
            {busy && <div className="text-xs text-stone-400 p-2">Asistentul scrie…</div>}
            <div ref={endRef} />
          </div>
          <div className="p-2 border-t border-stone-200 flex gap-2">
            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="ex: ce buget pentru un living de 25mp?" className="flex-1 px-3 py-2 rounded-xl border border-stone-200 text-sm" data-testid="id-assistant-input" />
            <button onClick={send} disabled={busy} className="w-10 h-10 rounded-xl bg-emerald-700 text-white flex items-center justify-center disabled:opacity-40" data-testid="id-assistant-send"><Send className="w-4 h-4" /></button>
          </div>
        </div>
      )}
    </>
  );
};

const LeadForm = ({ content }) => {
  const [form, setForm] = useState({ name: "", email: "", phone: "", style: "", budget: "", surface_mp: "", rooms: "", city: "", message: "", consult_date: "", lead_type: "proiect" });
  const [sent, setSent] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await ax.post("/interior-design/leads", { ...form, surface_mp: form.surface_mp ? Number(form.surface_mp) : null });
      setSent(r.data.message);
    } catch (err) {
      setSent("A apărut o eroare — verifică emailul și reîncearcă.");
    }
    setBusy(false);
  };

  if (sent) {
    return (
      <div className="p-8 rounded-3xl bg-emerald-50 border border-emerald-200 text-center" data-testid="id-form-success">
        <Check className="w-10 h-10 text-emerald-700 mx-auto mb-2" />
        <p className="font-bold text-emerald-900">{sent}</p>
      </div>
    );
  }
  const inputCls = "w-full px-4 py-3 rounded-xl border border-stone-200 bg-white text-sm text-stone-800 focus:border-emerald-600 focus:outline-none";
  return (
    <form onSubmit={submit} className="grid sm:grid-cols-2 gap-3" data-testid="id-lead-form">
      <div className="sm:col-span-2 flex gap-2 flex-wrap">
        {[["proiect", "Solicită proiect"], ["oferta", "Cere ofertă"], ["consultanta", "Consultanță designer"]].map(([v, l]) => (
          <button type="button" key={v} onClick={() => setForm((f) => ({ ...f, lead_type: v }))}
            className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${form.lead_type === v ? "bg-emerald-700 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"}`} data-testid={`id-type-${v}`}>{l}</button>
        ))}
      </div>
      <input required placeholder="Nume complet *" value={form.name} onChange={set("name")} className={inputCls} data-testid="id-form-name" />
      <input required type="email" placeholder="Email *" value={form.email} onChange={set("email")} className={inputCls} data-testid="id-form-email" />
      <input placeholder="Telefon" value={form.phone} onChange={set("phone")} className={inputCls} data-testid="id-form-phone" />
      <select value={form.city} onChange={set("city")} className={inputCls} data-testid="id-form-city">
        <option value="">Oraș…</option>
        {(content.local_cities || []).map((c) => <option key={c} value={c}>{c}</option>)}
        <option value="alt">Alt oraș / remote</option>
      </select>
      <select value={form.style} onChange={set("style")} className={inputCls} data-testid="id-form-style">
        <option value="">Stil dorit…</option>
        {(content.styles || []).map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <select value={form.budget} onChange={set("budget")} className={inputCls} data-testid="id-form-budget">
        <option value="">Buget estimat…</option>
        {(content.budgets || []).map((b) => <option key={b} value={b}>{b}</option>)}
      </select>
      <input type="number" min="10" placeholder="Suprafață (mp)" value={form.surface_mp} onChange={set("surface_mp")} className={inputCls} data-testid="id-form-surface" />
      <input placeholder="Camere de amenajat (ex: living + bucătărie)" value={form.rooms} onChange={set("rooms")} className={inputCls} data-testid="id-form-rooms" />
      {form.lead_type === "consultanta" && (
        <input type="date" value={form.consult_date} onChange={set("consult_date")} className={inputCls} data-testid="id-form-date" title="Data dorită pentru consultanță" />
      )}
      <textarea placeholder="Descrie proiectul (opțional) — poți menționa și linkuri către poze/plan" value={form.message} onChange={set("message")} rows={3} className={`${inputCls} sm:col-span-2`} data-testid="id-form-message" />
      <button type="submit" disabled={busy} className="sm:col-span-2 py-3.5 rounded-xl bg-emerald-700 text-white font-bold hover:bg-emerald-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2" data-testid="id-form-submit">
        {busy ? "Se trimite…" : <>Trimite cererea — e gratuit <ArrowRight className="w-4 h-4" /></>}
      </button>
      <p className="sm:col-span-2 text-[11px] text-stone-400 text-center">Fără abonament, fără obligații. Primești oferte în 24-48h.</p>
    </form>
  );
};

export default function InteriorDesignLanding() {
  const [content, setContent] = useState(null);
  useDynamicSEO("interior_design", {
    title: content?.seo?.title || "Design Interior România | PropManage",
    description: content?.seo?.description,
  });

  useEffect(() => {
    ax.get("/interior-design/content").then((r) => setContent(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!content) return;
    const ld = document.createElement("script");
    ld.type = "application/ld+json";
    ld.id = "id-jsonld";
    ld.text = JSON.stringify({
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "Service", "name": "Design Interior", "provider": { "@type": "Organization", "name": "PropManage" },
          "areaServed": content.local_cities, "description": content.seo?.description },
        { "@type": "BreadcrumbList", "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Acasă", "item": window.location.origin + "/" },
          { "@type": "ListItem", "position": 2, "name": "Design Interior", "item": window.location.origin + "/design-interior" }]},
        { "@type": "FAQPage", "mainEntity": (content.faq || []).map((f) => ({ "@type": "Question", "name": f.q, "acceptedAnswer": { "@type": "Answer", "text": f.a } })) },
      ],
    });
    document.head.appendChild(ld);
    let canon = document.querySelector('link[rel="canonical"]');
    if (!canon) { canon = document.createElement("link"); canon.rel = "canonical"; document.head.appendChild(canon); }
    canon.href = window.location.origin + "/design-interior";
    return () => { document.getElementById("id-jsonld")?.remove(); };
  }, [content]);

  if (!content) return <div className="min-h-screen bg-white flex items-center justify-center text-stone-400">Se încarcă…</div>;

  const scrollToForm = () => document.getElementById("formular")?.scrollIntoView({ behavior: "smooth" });

  return (
    <div className="min-h-screen bg-white text-stone-800" data-testid="interior-design-root" style={{ fontFamily: "inherit" }}>
      {/* Header propriu, temă luminoasă */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-stone-100">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-black text-stone-900" data-testid="id-nav-home"><Home className="w-5 h-5 text-emerald-700" /> PropManage</Link>
          <nav aria-label="breadcrumb" className="hidden sm:block text-xs text-stone-400">
            <Link to="/" className="hover:text-emerald-700">Acasă</Link> <span className="mx-1">/</span> <span className="text-stone-700 font-semibold">Design Interior</span>
          </nav>
          <button onClick={scrollToForm} className="px-5 py-2.5 rounded-full bg-emerald-700 text-white text-sm font-bold hover:bg-emerald-800 transition-colors" data-testid="id-nav-cta">Cere ofertă</button>
        </div>
      </header>

      {/* HERO */}
      <Section className="pt-12 sm:pt-16 pb-10">
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold mb-5"><Sofa className="w-3.5 h-3.5" /> Serviciu independent · acces liber, fără condiții</div>
            <h1 className="text-4xl sm:text-5xl font-black text-stone-900 leading-[1.1] tracking-tight">{content.hero.h1}</h1>
            <p className="mt-5 text-stone-600 text-base leading-relaxed max-w-lg">{content.hero.subtitle}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <button onClick={scrollToForm} className="px-6 py-3.5 rounded-full bg-emerald-700 text-white font-bold hover:bg-emerald-800 transition-colors" data-testid="id-cta-primary">{content.hero.cta_primary}</button>
              <button onClick={scrollToForm} className="px-6 py-3.5 rounded-full border-2 border-stone-200 text-stone-700 font-bold hover:border-emerald-600 hover:text-emerald-800 transition-colors" data-testid="id-cta-secondary">{content.hero.cta_secondary}</button>
              <button onClick={scrollToForm} className="px-6 py-3.5 rounded-full text-emerald-800 font-bold hover:bg-emerald-50 transition-colors" data-testid="id-cta-tertiary">{content.hero.cta_tertiary} →</button>
            </div>
          </div>
          <img src={content.hero.image} alt={content.hero.image_alt} className="rounded-3xl shadow-2xl w-full object-cover aspect-[3/2]" loading="eager" data-testid="id-hero-image" />
        </div>
      </Section>

      {/* BENEFICII */}
      <Section className="py-14">
        <h2 className="text-2xl sm:text-3xl font-black text-stone-900 mb-8">De ce prin PropManage</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {content.benefits.map((b, i) => (
            <div key={i} className="p-6 rounded-3xl bg-stone-50 border border-stone-100 hover:border-emerald-200 transition-colors" data-testid={`id-benefit-${i}`}>
              <div className="w-10 h-10 rounded-2xl bg-emerald-700 text-white flex items-center justify-center mb-3">{[<Check />, <Palette />, <Wallet />, <Star />, <Ruler />, <MessageCircle />][i % 6]}</div>
              <h3 className="font-bold text-stone-900 mb-1">{b.title}</h3>
              <p className="text-sm text-stone-600">{b.text}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ETAPE */}
      <Section className="py-14">
        <h2 className="text-2xl sm:text-3xl font-black text-stone-900 mb-8">Cum decurge colaborarea</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {content.steps.map((s, i) => (
            <div key={i} className="p-5 rounded-3xl border border-stone-100 bg-white shadow-sm" data-testid={`id-step-${i}`}>
              <div className="text-3xl font-black text-emerald-700/20 mb-2">0{i + 1}</div>
              <h3 className="font-bold text-stone-900 text-sm mb-1">{s.title}</h3>
              <p className="text-xs text-stone-500">{s.text}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* PORTOFOLIU */}
      <Section className="py-14">
        <h2 className="text-2xl sm:text-3xl font-black text-stone-900 mb-8">Proiecte & portofoliu</h2>
        <div className="grid sm:grid-cols-2 gap-5">
          {content.portfolio.map((p, i) => (
            <figure key={i} className="group rounded-3xl overflow-hidden relative" data-testid={`id-portfolio-${i}`}>
              <img src={p.image} alt={p.image_alt} loading="lazy" className="w-full aspect-[3/2] object-cover group-hover:scale-105 transition-transform duration-500" />
              <figcaption className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/70 to-transparent text-white">
                <div className="font-bold text-sm">{p.title}</div>
                <div className="text-xs opacity-80">{p.location}</div>
              </figcaption>
            </figure>
          ))}
        </div>
      </Section>

      {/* RECENZII */}
      <Section className="py-14">
        <h2 className="text-2xl sm:text-3xl font-black text-stone-900 mb-8">Ce spun clienții</h2>
        <div className="grid sm:grid-cols-3 gap-5">
          {content.reviews.map((r, i) => (
            <blockquote key={i} className="p-6 rounded-3xl bg-stone-50 border border-stone-100" data-testid={`id-review-${i}`}>
              <div className="flex gap-0.5 mb-2">{Array.from({ length: r.rating }).map((_, j) => <Star key={j} className="w-4 h-4 fill-amber-400 text-amber-400" />)}</div>
              <p className="text-sm text-stone-700 italic">"{r.text}"</p>
              <footer className="mt-3 text-xs font-bold text-stone-500">{r.name} · {r.city}</footer>
            </blockquote>
          ))}
        </div>
      </Section>

      {/* FORMULAR */}
      <Section id="formular" className="py-14">
        <div className="rounded-[2rem] bg-stone-50 border border-stone-100 p-6 sm:p-10">
          <h2 className="text-2xl sm:text-3xl font-black text-stone-900 mb-2">Cere ofertă gratuită</h2>
          <p className="text-sm text-stone-500 mb-7">Completezi în 2 minute · primești oferte de la designeri verificați în 24-48h.</p>
          <LeadForm content={content} />
        </div>
      </Section>

      {/* FAQ */}
      <Section className="py-14" >
        <h2 className="text-2xl sm:text-3xl font-black text-stone-900 mb-6">Întrebări frecvente</h2>
        <div itemScope itemType="https://schema.org/FAQPage">
          {content.faq.map((f, i) => <FAQItem key={i} q={f.q} a={f.a} idx={i} />)}
        </div>
      </Section>

      {/* ARTICOL SEO */}
      <Section className="py-14">
        <article className="prose-sm max-w-3xl">
          {content.seo_article.map((s, i) => (
            <div key={i} className="mb-8" data-testid={`id-article-${i}`}>
              <h2 className="text-xl font-black text-stone-900 mb-3">{s.h2}</h2>
              <p className="text-sm text-stone-600 leading-relaxed">{s.body}</p>
            </div>
          ))}
          <h3 className="text-base font-black text-stone-900 mb-2">Design interior în orașul tău</h3>
          <p className="text-sm text-stone-600">
            {content.local_cities.map((c, i) => (
              <span key={c}>design interior {c}{i < content.local_cities.length - 1 ? " · " : ""}</span>
            ))}
          </p>
        </article>
      </Section>

      {/* SERVICII CONEXE */}
      <Section className="py-14 pb-24">
        <h2 className="text-2xl sm:text-3xl font-black text-stone-900 mb-8">Servicii conexe</h2>
        <div className="grid sm:grid-cols-3 gap-5">
          {content.related_services.map((s, i) => (
            <Link key={i} to={s.href} className="p-6 rounded-3xl border border-stone-100 hover:border-emerald-300 hover:shadow-lg transition-all group" data-testid={`id-related-${i}`}>
              <h3 className="font-bold text-stone-900 group-hover:text-emerald-800">{s.title} →</h3>
              <p className="text-sm text-stone-500 mt-1">{s.text}</p>
            </Link>
          ))}
        </div>
      </Section>

      <footer className="border-t border-stone-100 py-8 text-center text-xs text-stone-400">
        © {new Date().getFullYear()} PropManage · VINTAGE FURNITURE S.R.L. · <Link to="/" className="hover:text-emerald-700">propmanage.io</Link>
      </footer>

      <AssistantWidget />
    </div>
  );
}
