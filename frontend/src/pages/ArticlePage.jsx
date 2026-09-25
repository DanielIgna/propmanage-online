// /blog/:slug — Content Factory published article (DB-backed, distinct from static
// /ghiduri/:slug guides). Only PUBLISHED articles are served by the public API; any
// other slug 404s. Reuses useSEO + tracking + CTA infra.
import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Building2, Clock, ArrowRight, ArrowLeft } from "lucide-react";
import { useSEO } from "../hooks/useSEO";

const SITE_URL = "https://propmanage.ro";
const API = process.env.REACT_APP_BACKEND_URL;

const renderInline = (text) => {
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**")
      ? <strong key={i} className="text-white font-semibold">{p.slice(2, -2)}</strong>
      : <span key={i}>{p}</span>
  );
};

export const ArticlePage = () => {
  const { slug } = useParams();
  const [article, setArticle] = useState(null);
  const [state, setState] = useState("loading");

  useEffect(() => {
    let alive = true;
    fetch(`${API}/api/content/articles/${slug}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => { if (alive) { setArticle(d); setState("ok"); } })
      .catch(() => { if (alive) setState("notfound"); });
    return () => { alive = false; };
  }, [slug]);

  useSEO(article ? {
    title: `${article.title} | Blog PropManage`,
    description: article.meta_description || article.excerpt,
    canonical: `${SITE_URL}/blog/${article.slug}`,
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "BlogPosting",
          "headline": article.title,
          "description": article.meta_description || article.excerpt,
          "url": `${SITE_URL}/blog/${article.slug}`,
          "datePublished": article.published_at,
          "dateModified": article.updated_at || article.published_at,
          "inLanguage": "ro-RO",
          "publisher": { "@type": "Organization", "name": "PropManage", "url": SITE_URL },
          "mainEntityOfPage": `${SITE_URL}/blog/${article.slug}`,
        },
        {
          "@type": "BreadcrumbList",
          "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "Acasă", "item": `${SITE_URL}/` },
            { "@type": "ListItem", "position": 2, "name": "Blog", "item": `${SITE_URL}/blog` },
            { "@type": "ListItem", "position": 3, "name": article.title, "item": `${SITE_URL}/blog/${article.slug}` },
          ],
        },
        ...(article.faq?.length ? [{
          "@type": "FAQPage",
          "mainEntity": article.faq.map((f) => ({
            "@type": "Question", "name": f.q,
            "acceptedAnswer": { "@type": "Answer", "text": f.a },
          })),
        }] : []),
      ],
    },
  } : { title: "Articol | Blog PropManage", description: "Blog PropManage" });

  const trackCta = () => {
    import("../lib/analytics").then(({ trackFunnel }) => trackFunnel?.("article_cta", { slug })).catch(() => {});
  };

  if (state === "loading") {
    return <div className="min-h-screen bg-[#0a0a0b] text-stone-400 flex items-center justify-center" data-testid="article-loading">Se încarcă…</div>;
  }
  if (state === "notfound" || !article) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] text-stone-100 flex flex-col items-center justify-center gap-4" data-testid="article-notfound">
        <p className="text-stone-400">Articolul nu există sau nu este publicat.</p>
        <Link to="/blog" className="text-[#d4ff3a] hover:underline">← Înapoi la blog</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-stone-100" data-testid="article-page">
      <header className="border-b border-white/5 sticky top-0 z-30 bg-[#0a0a0b]/80 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#d4ff3a] to-[#a8e028] flex items-center justify-center">
              <Building2 className="w-3.5 h-3.5 text-black" strokeWidth={2.5} />
            </div>
            <span className="font-serif text-lg font-semibold">PropManage</span>
          </Link>
          <Link to="/blog" className="text-xs text-stone-400 hover:text-white flex items-center gap-1" data-testid="article-back"><ArrowLeft className="w-3 h-3" />Blog</Link>
        </div>
      </header>

      <article className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <nav className="text-xs text-stone-500 mb-5 flex flex-wrap items-center gap-1.5" aria-label="Breadcrumb">
          <Link to="/" className="hover:text-stone-200">Acasă</Link><span>/</span>
          <Link to="/blog" className="hover:text-stone-200">Blog</Link><span>/</span>
          <span className="text-stone-300 truncate max-w-[200px]">{article.title}</span>
        </nav>

        <div className="text-[10px] uppercase tracking-wider font-semibold text-[#d4ff3a] mb-3">
          {article.cluster_label}{article.city ? ` · ${article.city}` : ""}
        </div>
        <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="font-serif text-3xl sm:text-5xl leading-tight tracking-tight mb-4" data-testid="article-h1">
          {article.h1 || article.title}
        </motion.h1>
        {article.excerpt && <p className="text-lg text-stone-400 leading-relaxed mb-4">{article.excerpt}</p>}
        <div className="flex items-center gap-3 text-xs text-stone-500 pb-6 border-b border-white/5">
          <span className="flex items-center gap-1.5"><Clock className="w-3 h-3" />{article.read_mins} min</span>
        </div>

        <div className="mt-8 space-y-8" data-testid="article-body">
          {(article.sections || []).map((s, i) => (
            <section key={i}>
              {s.h2 && <h2 className="font-serif text-2xl mb-3 text-white">{s.h2}</h2>}
              {(s.paragraphs || []).map((p, j) => (
                <p key={j} className="text-stone-300 leading-relaxed mb-3">{renderInline(p)}</p>
              ))}
              {(s.bullets || []).length > 0 && (
                <ul className="list-disc pl-5 space-y-1.5 text-stone-300 mt-2">
                  {s.bullets.map((b, k) => <li key={k}>{renderInline(b)}</li>)}
                </ul>
              )}
            </section>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-12 glass-strong rounded-3xl p-8 text-center">
          <h2 className="font-serif text-2xl mb-4">{article.cta || "Începe cu PropManage"}</h2>
          <Link to={article.cta_to || "/register"} onClick={trackCta} data-testid="article-cta"
            className="inline-flex items-center gap-1.5 bg-[#d4ff3a] text-black px-7 py-3 rounded-full text-sm font-semibold hover:bg-[#bfe632] transition">
            {article.cta || "Continuă"} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* FAQ */}
        {article.faq?.length > 0 && (
          <div className="mt-12" data-testid="article-faq">
            <h2 className="font-serif text-2xl mb-5">Întrebări frecvente</h2>
            <div className="space-y-4">
              {article.faq.map((f, i) => (
                <div key={i} className="glass-strong rounded-2xl p-5">
                  <h3 className="font-semibold text-white mb-2">{f.q}</h3>
                  <p className="text-sm text-stone-400 leading-relaxed">{f.a}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Internal links */}
        {article.internal_links?.length > 0 && (
          <div className="mt-12 pt-8 border-t border-white/5" data-testid="article-links">
            <div className="text-xs uppercase tracking-wider text-stone-500 mb-3">Continuă să explorezi</div>
            <div className="flex flex-wrap gap-2.5">
              {article.internal_links.map((l, i) => (
                <Link key={i} to={l} className="glass-strong rounded-full px-4 py-2 text-sm text-stone-300 hover:text-[#d4ff3a] hover:bg-white/[0.06] transition">
                  {l} →
                </Link>
              ))}
            </div>
          </div>
        )}
      </article>
    </div>
  );
};

export default ArticlePage;
