// Public landing CTA — preview poster + button to /demo (interactive viewer).
// Three.js is intentionally NOT mounted on the landing page itself because
// React Three Fiber + Babel's JSX __source dev props cause an applyProps
// crash when the Canvas is part of the marketing bundle. The full interactive
// 3D viewer lives on the dedicated /demo route.
import React from "react";
import { Box, Eye, Sparkles, Play, Maximize2 } from "lucide-react";

export const LandingDemo3D = ({ onBookDemo }) => {
  return (
    <section
      id="demo-3d"
      className="py-24 px-6 relative bg-gradient-to-b from-stone-950 via-stone-900 to-stone-950"
      data-testid="landing-demo-showcase"
    >
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#d4ff3a]/10 border border-[#d4ff3a]/30 mb-4">
            <Sparkles className="w-3.5 h-3.5 text-[#d4ff3a]" />
            <span className="text-[10px] uppercase tracking-[0.18em] text-[#d4ff3a] font-bold">Demo interactiv · fără cont</span>
          </div>
          <h2 className="font-serif text-4xl md:text-6xl tracking-tight mb-4 max-w-3xl mx-auto" data-testid="demo-3d-title">
            Vezi-ți casa în <span className="italic text-[#d4ff3a]">3D</span> înainte să o cumperi.
          </h2>
          <p className="text-stone-400 text-base md:text-lg max-w-2xl mx-auto">
            Învârte casa demo cu mouse-ul. Activează X-Ray ca să vezi instalațiile prin pereți.
            Așa arată Digital Twin-ul tău în PropManage — interactiv, în browser.
          </p>
        </div>

        <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-stretch">
          {/* Preview poster card — opens /demo on click */}
          <a
            href="/demo"
            className="relative rounded-3xl overflow-hidden border border-white/10 group cursor-pointer aspect-[4/3] lg:aspect-auto lg:min-h-[520px] bg-gradient-to-br from-slate-900 via-cyan-950 to-slate-900"
            data-testid="demo-3d-poster"
          >
            {/* SVG architectural illustration as poster */}
            <svg viewBox="0 0 800 600" className="absolute inset-0 w-full h-full p-12 opacity-80" preserveAspectRatio="xMidYMid meet">
              <defs>
                <linearGradient id="wallGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#d4ff3a" stopOpacity="0.05" />
                  <stop offset="100%" stopColor="#d4ff3a" stopOpacity="0.15" />
                </linearGradient>
              </defs>
              {/* Floor plate */}
              <path d="M150 480 L150 320 L400 200 L650 320 L650 480 Z" fill="url(#wallGrad)" stroke="rgba(212,255,58,0.5)" strokeWidth="1.5" />
              {/* Roof */}
              <path d="M120 320 L400 180 L680 320" fill="none" stroke="rgba(212,255,58,0.7)" strokeWidth="2" />
              {/* Middle ridge */}
              <line x1="400" y1="180" x2="400" y2="480" stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="4 4" />
              {/* Wall divisions */}
              <line x1="280" y1="370" x2="280" y2="480" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
              <line x1="520" y1="370" x2="520" y2="480" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
              <line x1="150" y1="380" x2="650" y2="380" stroke="rgba(255,255,255,0.1)" strokeDasharray="3 5" />
              {/* System dots */}
              <circle cx="220" cy="430" r="8" fill="#fbbf24" opacity="0.9"><animate attributeName="r" values="8;12;8" dur="2s" repeatCount="indefinite"/></circle>
              <circle cx="220" cy="430" r="20" fill="#fbbf24" opacity="0.15"/>
              <text x="220" y="455" fontSize="10" fill="#fbbf24" textAnchor="middle">ELECTRIC</text>

              <circle cx="400" cy="350" r="8" fill="#3b82f6" opacity="0.9"><animate attributeName="r" values="8;12;8" dur="2.4s" repeatCount="indefinite"/></circle>
              <circle cx="400" cy="350" r="20" fill="#3b82f6" opacity="0.15"/>
              <text x="400" y="335" fontSize="10" fill="#3b82f6" textAnchor="middle">APĂ</text>

              <circle cx="580" cy="430" r="8" fill="#10b981" opacity="0.9"><animate attributeName="r" values="8;12;8" dur="2.8s" repeatCount="indefinite"/></circle>
              <circle cx="580" cy="430" r="20" fill="#10b981" opacity="0.15"/>
              <text x="580" y="455" fontSize="10" fill="#10b981" textAnchor="middle">HVAC</text>

              <circle cx="400" cy="450" r="8" fill="#c8b89a" opacity="0.9"/>
              <circle cx="400" cy="450" r="20" fill="#c8b89a" opacity="0.15"/>
              <text x="400" y="475" fontSize="10" fill="#c8b89a" textAnchor="middle">STRUCTURĂ</text>
            </svg>

            {/* Play overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-black/60 via-transparent to-transparent group-hover:from-black/40 transition-all">
              <div className="flex flex-col items-center gap-3 transform group-hover:scale-105 transition-transform">
                <div className="w-20 h-20 rounded-full bg-[#d4ff3a] flex items-center justify-center shadow-2xl shadow-[#d4ff3a]/40">
                  <Play className="w-8 h-8 text-black ml-1" fill="black" />
                </div>
                <span className="text-white font-medium text-sm uppercase tracking-widest">Lansează viewer 3D</span>
              </div>
            </div>

            {/* Top-left badge: Interactive */}
            <div className="absolute top-4 left-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-950/85 backdrop-blur border border-white/10 text-[11px] text-stone-200">
              <span className="w-2 h-2 rounded-full bg-[#d4ff3a] animate-pulse" />
              Interactiv · Three.js · X-Ray
            </div>

            {/* Bottom-right hint */}
            <div className="absolute bottom-4 right-4 inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-stone-950/85 backdrop-blur border border-white/10 text-[11px] text-stone-300">
              <Maximize2 className="w-3 h-3" />
              Full-screen pe /demo
            </div>
          </a>

          {/* Side info panel */}
          <aside className="flex flex-col gap-3">
            <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-5">
              <div className="text-[10px] uppercase tracking-[0.16em] text-[#d4ff3a] font-bold mb-2">Ce vei putea face</div>
              <h3 className="font-serif text-lg text-white mb-3">Demo · 4 sisteme mapate</h3>
              <ul className="space-y-2 text-xs">
                {[
                  { color: "#c8b89a", name: "Structură", note: "Pereți, planșee, fundație", icon: Box },
                  { color: "#fbbf24", name: "Electric", note: "Tablouri, cabluri, prize", icon: Eye },
                  { color: "#3b82f6", name: "Apă / Canal", note: "Țevi, sifoane, baterii", icon: Eye },
                  { color: "#10b981", name: "HVAC", note: "Conducte AC, ventilație", icon: Eye },
                ].map(s => (
                  <li key={s.name} className="flex items-start gap-2 p-2 rounded-lg hover:bg-white/5 transition-colors">
                    <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: s.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-sm">{s.name}</div>
                      <div className="text-stone-500 text-[10px]">{s.note}</div>
                    </div>
                  </li>
                ))}
              </ul>
              <a
                href="/demo"
                className="mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full border border-white/10 text-white text-xs hover:bg-white/5 transition-colors"
                data-testid="demo-3d-open-link"
              >
                <Play className="w-3 h-3" fill="currentColor" />
                Deschide demo interactiv →
              </a>
            </div>

            <div className="rounded-2xl bg-gradient-to-br from-[#d4ff3a]/15 via-[#d4ff3a]/5 to-transparent border border-[#d4ff3a]/30 p-5">
              <div className="text-[10px] uppercase tracking-[0.16em] text-[#d4ff3a] font-bold mb-1.5">Vrei un model real al casei tale?</div>
              <p className="text-xs text-stone-300 leading-relaxed mb-4">
                Echipa noastră vine, scanează (LiDAR), modelează arhitectural în 48h. Tu vezi totul în PropManage cu sisteme pe layers, secțiuni, măsurători.
              </p>
              <button
                onClick={onBookDemo}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-[#d4ff3a] hover:bg-[#c5f000] text-black font-bold text-sm transition-colors"
                data-testid="demo-3d-cta-book"
              >
                <Sparkles className="w-4 h-4" />
                Programează vizita LiDAR
              </button>
              <p className="text-[10px] text-stone-500 mt-2 text-center">Răspuns în 24h · București + Ilfov</p>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
};

export default LandingDemo3D;
