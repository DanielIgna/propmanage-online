import React, { useState } from "react";
import {
  Home, Plus, Wrench, Building2, Settings, Bell, ChevronRight, Sparkles,
  MessageCircle, ChevronDown, Box, HeartPulse, Clock, FileText, Wallet, Shield, User, Trophy,
} from "lucide-react";

// ============================================================================
// FAZA 2 — WIREFRAME VIZUAL Client V2 (rută de test /dashboard/client-v2)
// Low-fidelity, monocrom, pentru aprobare structură. NU e UI final (Faza 3).
// Nu atinge /client. Date mock.
// ============================================================================

const Wire = ({ children, label, className = "", testid }) => (
  <div data-testid={testid} className={`relative rounded-2xl border-2 border-dashed border-slate-300 bg-white p-4 ${className}`}>
    {label && <span className="absolute -top-2.5 left-3 px-1.5 bg-white text-[9px] uppercase tracking-wider font-bold text-slate-400">{label}</span>}
    {children}
  </div>
);

const CTA = ({ children, testid }) => (
  <button data-testid={testid} className="w-full py-3.5 rounded-full bg-slate-900 text-white text-sm font-bold">{children}</button>
);

// ── HEADER SLIM ──────────────────────────────────────────────────────────────
const WireHeader = () => (
  <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200" data-testid="v2-header">
    <span className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center"><User className="w-4 h-4 text-slate-500" /></span>
    <span className="text-sm font-bold text-slate-900">Bună, Daniel</span>
    <span className="ml-auto relative">
      <Bell className="w-5 h-5 text-slate-500" />
      <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-slate-900 text-white text-[8px] font-bold flex items-center justify-center">2</span>
    </span>
    <button className="flex items-center gap-1 text-xs font-semibold text-slate-500 border border-slate-200 rounded-full px-2.5 py-1">
      Ap. Aviației <ChevronDown className="w-3 h-3" />
    </button>
  </div>
);

// ── HERO — 3 variante adaptive ───────────────────────────────────────────────
const HERO = {
  nou: {
    title: "Hai să pornim: adaugă prima ta proprietate",
    sub: "Pasul 1 din 3 · durează 2 minute",
    cta: "Adaugă proprietatea",
    extra: <div className="mt-3 h-1.5 rounded-full bg-slate-100"><div className="h-full w-1/3 rounded-full bg-slate-400" /></div>,
  },
  linistit: {
    title: "Totul e în regulă la Ap. Aviației",
    sub: "Scor locuință 86/100 · niciun eveniment nou",
    cta: "Solicită un serviciu",
    extra: null,
  },
  activ: {
    title: "Zugrăvit living — 2 oferte primite",
    sub: "Specialiștii așteaptă răspunsul tău",
    cta: "Vezi ofertele",
    extra: (
      <div className="mt-3 flex items-center gap-1.5">
        {["Cerere", "Oferte", "În lucru", "Finalizat"].map((s, i) => (
          <React.Fragment key={s}>
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${i <= 1 ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-400"}`}>{s}</span>
            {i < 3 && <span className="flex-1 h-px bg-slate-200" />}
          </React.Fragment>
        ))}
      </div>
    ),
  },
};

const WireHero = ({ state }) => {
  const h = HERO[state];
  return (
    <Wire label={`Hero Card · varianta ${state === "nou" ? "A — user nou" : state === "linistit" ? "B — fără lucrare" : "C — lucrare activă"}`} className="mx-4 mt-4" testid="v2-hero">
      <h1 className="text-xl font-black text-slate-900 leading-snug">{h.title}</h1>
      <p className="mt-1 text-xs text-slate-500">{h.sub}</p>
      {h.extra}
      <div className="mt-4"><CTA testid="v2-hero-cta">{h.cta}</CTA></div>
    </Wire>
  );
};

// ── 4 ACȚIUNI PRINCIPALE ─────────────────────────────────────────────────────
const ACTIONS = [
  [Plus, "Solicită", "serviciu nou"],
  [Building2, "Proprietatea", "twin · health · acte"],
  [Wrench, "Lucrări", "1 activă"],
  [MessageCircle, "Întreabă AI", "asistent 24/7"],
];

const WireActions = ({ onGo }) => (
  <Wire label="4 acțiuni principale (grid 2×2, thumb-friendly)" className="mx-4 mt-5" testid="v2-actions">
    <div className="grid grid-cols-2 gap-3">
      {ACTIONS.map(([Icon, label, sub], i) => (
        <button key={label} onClick={() => onGo(i)} data-testid={`v2-action-${i}`}
          className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-left min-h-[96px]">
          <Icon className="w-5 h-5 text-slate-700" />
          <div className="mt-2 text-sm font-bold text-slate-900">{label}</div>
          <div className="text-[10px] text-slate-400">{sub}</div>
        </button>
      ))}
    </div>
  </Wire>
);

// ── CONTEXTUAL ───────────────────────────────────────────────────────────────
const CONTEXT = {
  nou: [],
  linistit: [["Sugestie", "Revizia centralei e recomandată toamna", "Vezi detalii"]],
  activ: [
    ["Oferte noi", "2 oferte la «Zugrăvit living» — de la 1.800 RON", "Compară ofertele"],
    ["Mesaj nou", "Andrei (specialist): «Pot începe de luni»", "Răspunde"],
  ],
};

const WireContextual = ({ state }) => {
  const items = CONTEXT[state];
  return (
    <Wire label={`Conținut contextual (${items.length} carduri — doar dacă există ceva nou)`} className="mx-4 mt-5" testid="v2-contextual">
      {items.length === 0 ? (
        <p className="text-center text-xs text-slate-300 py-4">— nimic nou · white space intenționat —</p>
      ) : (
        <div className="space-y-2">
          {items.map(([tag, text, cta]) => (
            <div key={text} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
              <span className="text-[9px] uppercase font-bold text-slate-400 shrink-0">{tag}</span>
              <span className="text-xs text-slate-700 flex-1">{text}</span>
              <span className="text-[10px] font-bold text-slate-900 flex items-center shrink-0">{cta}<ChevronRight className="w-3 h-3" /></span>
            </div>
          ))}
        </div>
      )}
    </Wire>
  );
};

const WireDiscover = () => (
  <Wire label="Descoperă (sub fold · P3 · dismissible)" className="mx-4 mt-5 mb-6" testid="v2-discover">
    <div className="flex gap-2 overflow-x-auto">
      {[["Digital Twin", Box], ["House Health", HeartPulse], ["Ghiduri", FileText]].map(([l, Icon]) => (
        <div key={l} className="shrink-0 w-32 rounded-xl bg-slate-50 border border-slate-200 p-3">
          <Icon className="w-4 h-4 text-slate-400" />
          <div className="mt-1.5 text-[11px] font-bold text-slate-600">{l}</div>
        </div>
      ))}
    </div>
  </Wire>
);

// ── HUB „PROPRIETATEA MEA" ───────────────────────────────────────────────────
const WireProperty = () => (
  <div className="pb-6" data-testid="v2-property-view">
    <Wire label="Card proprietate" className="mx-4 mt-4">
      <div className="h-24 rounded-xl bg-slate-100 flex items-center justify-center text-[10px] text-slate-400">foto proprietate</div>
      <div className="mt-3 text-base font-black text-slate-900">Ap. Aviației</div>
      <div className="flex gap-3 mt-1 text-[10px] text-slate-400"><span>Health 86/100</span><span>Twin activ</span><span>4 documente</span></div>
    </Wire>
    <Wire label="Instrumente (mutate de pe Home — 1 CTA fiecare)" className="mx-4 mt-5">
      <div className="space-y-2">
        {[[Box, "Digital Twin", "locuința ta în 3D"], [HeartPulse, "House Health", "scor + recomandări"], [Clock, "Timeline", "istoricul proprietății"], [FileText, "Documente", "acte & garanții"], [Wallet, "Plăți & Portofel", "sold, tokeni, facturi"]].map(([Icon, l, s]) => (
          <div key={l} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
            <Icon className="w-4 h-4 text-slate-500" />
            <div className="flex-1"><div className="text-xs font-bold text-slate-900">{l}</div><div className="text-[10px] text-slate-400">{s}</div></div>
            <ChevronRight className="w-4 h-4 text-slate-300" />
          </div>
        ))}
      </div>
    </Wire>
    <div className="mx-4 mt-4"><button className="w-full py-3 rounded-full border-2 border-dashed border-slate-300 text-xs font-bold text-slate-400">+ Adaugă altă proprietate</button></div>
  </div>
);

// ── LUCRĂRILE MELE ───────────────────────────────────────────────────────────
const WireJobs = () => (
  <div className="pb-6" data-testid="v2-jobs-view">
    <Wire label="Lucrare activă (status vizual pe pași)" className="mx-4 mt-4">
      <div className="text-sm font-black text-slate-900">Zugrăvit living</div>
      <div className="mt-2 flex items-center gap-1.5">
        {["Cerere", "Oferte (2)", "În lucru", "Finalizat"].map((s, i) => (
          <React.Fragment key={s}>
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${i <= 1 ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-400"}`}>{s}</span>
            {i < 3 && <span className="flex-1 h-px bg-slate-200" />}
          </React.Fragment>
        ))}
      </div>
      <div className="mt-3"><CTA>Compară cele 2 oferte</CTA></div>
      <p className="mt-2 text-[10px] text-slate-400 text-center">Detaliul lucrării conține: chat · oferte · plată/escrow (explicat aici) · timeline · dispută · recenzie</p>
    </Wire>
    <Wire label="Istoric" className="mx-4 mt-5">
      <div className="space-y-2">
        {["Montaj parchet — finalizat", "Reparație robinet — finalizat"].map(t => (
          <div key={t} className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 text-xs text-slate-500">{t}<ChevronRight className="w-3.5 h-3.5 ml-auto text-slate-300" /></div>
        ))}
      </div>
    </Wire>
  </div>
);

// ── SETĂRI ───────────────────────────────────────────────────────────────────
const WireSettings = () => (
  <div className="pb-6" data-testid="v2-settings-view">
    <Wire label="Setări (aici se mută: 2FA, tier, portofel)" className="mx-4 mt-4">
      <div className="space-y-2">
        {[[User, "Profil"], [Shield, "Securitate (2FA)"], [Bell, "Notificări"], [Trophy, "Nivelul contului (tier · questuri)"], [Wallet, "Portofel"]].map(([Icon, l]) => (
          <div key={l} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
            <Icon className="w-4 h-4 text-slate-500" />
            <span className="text-xs font-bold text-slate-900 flex-1">{l}</span>
            <ChevronRight className="w-4 h-4 text-slate-300" />
          </div>
        ))}
      </div>
    </Wire>
  </div>
);

// ── BOTTOM NAV — 5 destinații, „Solicită" accentuat central ─────────────────
const NAV = [[Home, "Acasă", "home"], [Wrench, "Lucrări", "jobs"], [Plus, "Solicită", "request"], [Building2, "Propr.", "property"], [Settings, "Setări", "settings"]];

const WireNav = ({ active, onChange }) => (
  <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-slate-200" data-testid="v2-bottom-nav">
    <div className="grid grid-cols-5">
      {NAV.map(([Icon, label, id]) => (
        <button key={id} onClick={() => onChange(id)} data-testid={`v2-nav-${id}`} className="flex flex-col items-center gap-0.5 py-2">
          {id === "request" ? (
            <span className="w-11 h-11 -mt-5 rounded-full bg-slate-900 flex items-center justify-center border-4 border-white"><Icon className="w-5 h-5 text-white" /></span>
          ) : (
            <Icon className={`w-5 h-5 ${active === id ? "text-slate-900" : "text-slate-300"}`} strokeWidth={active === id ? 2.5 : 2} />
          )}
          <span className={`text-[9px] ${active === id ? "font-bold text-slate-900" : "text-slate-400"}`}>{label}</span>
        </button>
      ))}
    </div>
  </div>
);

// ── PAGINA ───────────────────────────────────────────────────────────────────
const STATES = [["nou", "A · User nou"], ["linistit", "B · Cu proprietate"], ["activ", "C · Lucrare activă"]];

export default function ClientV2Wireframe() {
  const [state, setState] = useState("activ");
  const [tab, setTab] = useState("home");
  return (
    <div className="min-h-screen bg-slate-100 py-6" data-testid="client-v2-wireframe">
      <div className="max-w-md mx-auto px-4">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-500"><Sparkles className="w-4 h-4" /> FAZA 2 · Wireframe Client V2 (test — nu e UI final)</div>
        <div className="mt-2 flex gap-1.5" data-testid="v2-state-switcher">
          {STATES.map(([id, label]) => (
            <button key={id} onClick={() => { setState(id); setTab("home"); }} data-testid={`v2-state-${id}`}
              className={`px-3 py-1.5 rounded-full text-[11px] font-bold ${state === id ? "bg-slate-900 text-white" : "bg-white text-slate-500 border border-slate-200"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="max-w-md mx-auto mt-3 bg-[#FAFAFA] rounded-[2rem] border-8 border-slate-800 overflow-hidden relative" style={{ minHeight: 760 }}>
        <WireHeader />
        <div className="pb-24 overflow-y-auto" style={{ maxHeight: 640 }}>
          {tab === "home" && (
            <>
              <WireHero state={state} />
              <WireActions onGo={(i) => setTab(["request", "property", "jobs", "home"][i])} />
              <WireContextual state={state} />
              <WireDiscover />
            </>
          )}
          {tab === "property" && <WireProperty />}
          {tab === "jobs" && <WireJobs />}
          {tab === "settings" && <WireSettings />}
          {tab === "request" && (
            <Wire label="Solicită — preia fluxul validat Client Junior" className="mx-4 mt-4" testid="v2-request-view">
              <p className="text-xs text-slate-500">Search → categorii → o întrebare pe ecran → confirmare.<br />Prototip funcțional existent:</p>
              <a href="/dashboard/client-junior" className="mt-3 block"><CTA>Deschide prototipul Client Junior →</CTA></a>
            </Wire>
          )}
        </div>
        <WireNav active={tab} onChange={setTab} />
      </div>
      <p className="max-w-md mx-auto mt-3 px-4 text-[11px] text-slate-400 text-center">Desktop = derivat din acest mobil (sidebar + 2 coloane). Comută stările A/B/C sus pentru cele 3 variante de Hero.</p>
    </div>
  );
}
