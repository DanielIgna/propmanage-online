// Reusable doc-content renderer — used by both the public /help/{token} viewer
// and the admin preview modal. Renders the JSON structure from docs_content.py.
//
// Supports block types: string paragraph, list, callout (info/warn/success),
// steps (numbered), code, image_placeholder (CSS pulse demo), screencast (mp4),
// lottie (animation JSON).
import React, { useState } from "react";
import { CheckCircle2, AlertTriangle, Info, Play, ChevronDown } from "lucide-react";

// ---- inline markdown (bold + italic) ----
const renderInline = (text) => {
  if (!text) return null;
  const parts = String(text).split(/(\*\*[^*]+\*\*|_[^_]+_)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) return <strong key={i} className="font-semibold text-white">{p.slice(2, -2)}</strong>;
    if (p.startsWith("_") && p.endsWith("_"))   return <em key={i} className="italic">{p.slice(1, -1)}</em>;
    return <span key={i}>{p}</span>;
  });
};

// ---- callout variants ----
const CALLOUT_VARIANTS = {
  info:    { Icon: Info,            cls: "border-blue-500/30 bg-blue-500/5 text-blue-200",       title: "text-blue-300" },
  warn:    { Icon: AlertTriangle,   cls: "border-amber-500/30 bg-amber-500/5 text-amber-100",    title: "text-amber-300" },
  success: { Icon: CheckCircle2,    cls: "border-[#d4ff3a]/30 bg-[#d4ff3a]/5 text-[#d4ff3a]",    title: "text-[#d4ff3a]" },
};

// ---- pulsing demo (CSS animation placeholder for complex flows) ----
const PulseDemo = ({ caption, src }) => (
  <div className="my-5 rounded-2xl border border-white/10 bg-gradient-to-br from-[#1a1a1f] to-[#0f0f12] p-6 text-center">
    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#d4ff3a]/10 border border-[#d4ff3a]/20 mb-3 relative">
      <Play className="w-6 h-6 text-[#d4ff3a]" />
      <span className="absolute inset-0 rounded-full border-2 border-[#d4ff3a]/40 animate-ping" />
    </div>
    <div className="text-xs text-stone-400 mb-1 uppercase tracking-wider">Animație interactivă</div>
    <div className="text-sm text-stone-200">{caption}</div>
    <div className="text-[10px] text-stone-600 mt-2 font-mono">{src}</div>
  </div>
);

// ---- video/screencast (MP4 or GIF) ----
const Screencast = ({ src, caption }) => {
  const isVideo = src && (src.endsWith(".mp4") || src.endsWith(".webm"));
  // We use a relative URL — admin can drop files under /app/frontend/public/animations/
  const fullSrc = src.startsWith("http") || src.startsWith("/") ? src : `/animations/${src}`;
  return (
    <figure className="my-5 rounded-2xl overflow-hidden border border-white/10 bg-black">
      {isVideo ? (
        <video className="w-full" controls preload="metadata" muted>
          <source src={fullSrc} type="video/mp4" />
          Browser-ul tău nu suportă video.
        </video>
      ) : (
        <img src={fullSrc} alt={caption} className="w-full" />
      )}
      <figcaption className="text-xs text-stone-400 px-4 py-2 bg-white/[0.02]">{caption}</figcaption>
    </figure>
  );
};

// ---- lottie animation loader (lazy, no extra library required) ----
const LottieAnim = ({ src, caption }) => {
  // We use lottie-web's player tag (CDN). Lightweight; loads only when this block renders.
  React.useEffect(() => {
    if (!window.customElements || window.customElements.get("lottie-player")) return;
    const s = document.createElement("script");
    s.src = "https://unpkg.com/@lottiefiles/lottie-player@latest/dist/lottie-player.js";
    s.async = true;
    document.head.appendChild(s);
  }, []);
  const fullSrc = src.startsWith("http") || src.startsWith("/") ? src : `/animations/${src}`;
  return (
    <figure className="my-5 rounded-2xl border border-white/10 bg-[#0f0f12] p-4 text-center">
      {/* eslint-disable-next-line react/no-unknown-property */}
      <lottie-player src={fullSrc} background="transparent" speed="1" style={{ width: "100%", maxWidth: 360, height: 240, margin: "0 auto" }} loop autoplay />
      <figcaption className="text-xs text-stone-400 mt-2">{caption}</figcaption>
    </figure>
  );
};

// ---- numbered steps ----
const Steps = ({ items }) => (
  <ol className="my-5 space-y-3" data-testid="doc-steps">
    {items.map((s, i) => (
      <li key={i} className="flex gap-3 items-start">
        <div className="w-7 h-7 rounded-full bg-[#d4ff3a] text-black flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">{i + 1}</div>
        <div className="flex-1 pt-0.5">
          <div className="font-medium text-stone-100">{s.title}</div>
          <div className="text-sm text-stone-400 mt-0.5">{renderInline(s.body)}</div>
        </div>
      </li>
    ))}
  </ol>
);

// ---- single block renderer ----
const renderBlock = (block, idx) => {
  if (typeof block === "string") {
    return <p key={idx} className="text-stone-300 leading-relaxed mb-4">{renderInline(block)}</p>;
  }
  switch (block.type) {
    case "h3":
      return <h4 key={idx} className="text-white font-semibold mt-5 mb-2 text-base">{block.text}</h4>;
    case "list":
      return (
        <ul key={idx} className="mb-4 space-y-2">
          {block.items.map((it, j) => (
            <li key={j} className="text-stone-300 leading-relaxed pl-5 relative">
              <span className="absolute left-0 top-2 w-1.5 h-1.5 rounded-full bg-[#d4ff3a]" />
              {renderInline(it)}
            </li>
          ))}
        </ul>
      );
    case "callout": {
      const v = CALLOUT_VARIANTS[block.variant || "info"];
      const { Icon } = v;
      return (
        <div key={idx} className={`my-5 rounded-2xl border ${v.cls} p-5`}>
          <div className={`flex items-center gap-2 ${v.title} font-semibold text-xs uppercase tracking-wider mb-2`}>
            <Icon className="w-4 h-4" /> {block.title}
          </div>
          <div className="text-sm text-stone-200 leading-relaxed">{renderInline(block.body)}</div>
        </div>
      );
    }
    case "code":
      return <pre key={idx} className="my-4 p-3 rounded-lg bg-black/40 border border-white/5 text-xs text-stone-300 overflow-x-auto font-mono">{block.text}</pre>;
    case "image_placeholder":
      return <PulseDemo key={idx} caption={block.caption} src={block.src} />;
    case "screencast":
      return <Screencast key={idx} src={block.src} caption={block.caption} />;
    case "lottie":
      return <LottieAnim key={idx} src={block.src} caption={block.caption} />;
    case "steps":
      return <Steps key={idx} items={block.items} />;
    default:
      return null;
  }
};

// ---- FAQ accordion ----
const FaqAccordion = ({ items }) => {
  const [openIdx, setOpenIdx] = useState(0);
  return (
    <div className="border border-white/5 rounded-2xl divide-y divide-white/5 overflow-hidden">
      {items.map((f, i) => (
        <div key={i}>
          <button
            onClick={() => setOpenIdx(openIdx === i ? -1 : i)}
            className="w-full text-left px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-white/[0.03]"
            data-testid={`doc-faq-q-${i}`}
          >
            <span className="font-medium text-stone-100 text-sm">{f.q}</span>
            <ChevronDown className={`w-4 h-4 text-stone-400 shrink-0 transition-transform ${openIdx === i ? "rotate-180" : ""}`} />
          </button>
          {openIdx === i && (
            <div className="px-5 pb-5 text-stone-300 text-sm leading-relaxed" data-testid={`doc-faq-a-${i}`}>
              {renderInline(f.a)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

// ---- Main viewer component ----
export const DocViewer = ({ doc, downloadPdfUrl }) => {
  if (!doc) return null;
  return (
    <article className="max-w-3xl mx-auto" data-testid="doc-viewer">
      <header className="mb-8">
        <div className="inline-flex items-center gap-1.5 text-[10px] text-[#d4ff3a] bg-[#d4ff3a]/10 border border-[#d4ff3a]/20 rounded-full px-2.5 py-1 mb-3 font-semibold uppercase tracking-wider">
          Ghid · v{doc.version} · {doc.role}
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl tracking-tight mb-3" data-testid="doc-title">{doc.title}</h1>
        <p className="text-stone-400 leading-relaxed">{doc.subtitle}</p>
        {downloadPdfUrl && (
          <a href={downloadPdfUrl} target="_blank" rel="noopener noreferrer"
            className="inline-block mt-4 text-xs bg-white/5 hover:bg-white/10 border border-white/10 rounded-full px-4 py-2 transition"
            data-testid="doc-download-pdf"
          >
            📥 Descarcă PDF
          </a>
        )}
      </header>

      {doc.sections.map((s, i) => (
        <section key={i} className="mb-10">
          <h2 className="font-serif text-2xl text-white mb-4">{s.heading}</h2>
          <div>{s.body.map(renderBlock)}</div>
        </section>
      ))}

      {doc.faq && doc.faq.length > 0 && (
        <section className="mt-12 pt-8 border-t border-white/5">
          <h2 className="font-serif text-2xl text-white mb-5">Întrebări frecvente</h2>
          <FaqAccordion items={doc.faq} />
        </section>
      )}
    </article>
  );
};

export default DocViewer;
