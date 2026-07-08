import React, { useState } from "react";
import {
  Home, Plus, Wrench, Building2, Settings, Bell, ChevronRight, Sparkles,
  MessageCircle, ChevronDown, Box, HeartPulse, Clock, FileText, Wallet, Shield, User, Trophy,
  CircleCheck, ShieldCheck, PaintRoller, ArrowRight,
} from "lucide-react";

// ============================================================================
// FAZA 3 — UI DESIGN Client V2 (rută test /dashboard/client-v2)
// Direcția B aprobată: light clean (stil HomeRun) — alb, verde #34C759.
// Structura = wireframe-ul aprobat în Faza 2. Date mock. NU atinge /client.
// ============================================================================

const GREEN = "#34C759";
const GREEN_SOFT = "#E9F9EE";

const CTA = ({ children, testid, subtle }) => (
  <button data-testid={testid}
    className={`w-full py-3.5 rounded-full text-sm font-bold transition-transform active:scale-[0.98] ${
      subtle ? "bg-white text-slate-900 border border-slate-200" : "text-white shadow-lg shadow-[#34C759]/25"}`}
    style={subtle ? {} : { background: GREEN }}>
    {children}
  </button>
);

const Steps = ({ current }) => (
  <div className="flex items-center gap-1.5">
    {["Cerere", "Oferte", "În lucru", "Finalizat"].map((s, i) => (
      <React.Fragment key={s}>
        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${i <= current ? "text-white" : "bg-slate-100 text-slate-400"}`}
          style={i <= current ? { background: GREEN } : {}}>{s}</span>
        {i < 3 && <span className={`flex-1 h-0.5 rounded ${i < current ? "bg-[#34C759]" : "bg-slate-100"}`} />}
      </React.Fragment>
    ))}
  </div>
);

// ── HEADER SLIM ──────────────────────────────────────────────────────────────
const Header = () => (
  <div className="flex items-center gap-2.5 px-5 pt-5 pb-3" data-testid="v2-header">
    <span className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-black" style={{ background: GREEN }}>D</span>
    <div>
      <div className="text-sm font-black text-slate-900 leading-none">Bună, Daniel</div>
      <button className="mt-1 flex items-center gap-0.5 text-[11px] font-semibold text-slate-400">Ap. Aviației <ChevronDown className="w-3 h-3" /></button>
    </div>
    <button className="ml-auto relative w-10 h-10 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center" data-testid="v2-bell">
      <Bell className="w-4.5 h-4.5 text-slate-600" style={{ width: 18, height: 18 }} />
      <span className="absolute top-1.5 right-2 w-2 h-2 rounded-full" style={{ background: GREEN }} />
    </button>
  </div>
);

// ── HERO — 3 variante adaptive ───────────────────────────────────────────────
const HeroA = () => (
  <div className="mx-5 rounded-3xl p-5 text-white shadow-xl shadow-emerald-900/10" style={{ background: "linear-gradient(135deg, #10B981 0%, #34C759 100%)" }} data-testid="v2-hero">
    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-white/80"><Sparkles className="w-3.5 h-3.5" /> Pasul 1 din 3 · 2 minute</div>
    <h1 className="mt-2 text-[22px] font-black leading-snug">Hai să pornim: adaugă prima ta proprietate</h1>
    <div className="mt-3 h-1.5 rounded-full bg-white/25"><div className="h-full w-1/3 rounded-full bg-white" /></div>
    <button className="mt-4 w-full py-3.5 rounded-full bg-white text-emerald-600 text-sm font-black active:scale-[0.98] transition-transform" data-testid="v2-hero-cta">Adaugă proprietatea</button>
  </div>
);

const HeroB = () => (
  <div className="mx-5 rounded-3xl p-5 border border-slate-100 bg-white shadow-sm" data-testid="v2-hero">
    <div className="flex items-center gap-3">
      <span className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ background: GREEN_SOFT }}>
        <ShieldCheck className="w-6 h-6" style={{ color: GREEN }} />
      </span>
      <div>
        <h1 className="text-lg font-black text-slate-900 leading-snug">Totul e în regulă la Ap. Aviației</h1>
        <div className="mt-0.5 text-xs text-slate-400">Scor locuință <span className="font-bold" style={{ color: GREEN }}>86/100</span> · niciun eveniment nou</div>
      </div>
    </div>
    <div className="mt-4"><CTA testid="v2-hero-cta">Solicită un serviciu</CTA></div>
  </div>
);

const HeroC = () => (
  <div className="mx-5 rounded-3xl p-5 border border-slate-100 bg-white shadow-sm" data-testid="v2-hero">
    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: GREEN }}>
      <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: GREEN }} /> Lucrare activă
    </div>
    <h1 className="mt-1.5 text-[22px] font-black text-slate-900 leading-snug">Zugrăvit living — 2 oferte primite</h1>
    <p className="mt-1 text-xs text-slate-400">Specialiștii așteaptă răspunsul tău</p>
    <div className="mt-3"><Steps current={1} /></div>
    <div className="mt-4"><CTA testid="v2-hero-cta">Vezi ofertele</CTA></div>
  </div>
);

// ── 4 ACȚIUNI PRINCIPALE ─────────────────────────────────────────────────────
const ACTIONS = [
  [Plus, "Solicită", "serviciu nou", "request"],
  [Building2, "Proprietatea", "twin · health · acte", "property"],
  [Wrench, "Lucrări", "1 activă", "jobs"],
  [MessageCircle, "Întreabă AI", "asistent 24/7", "home"],
];

const Actions = ({ onGo }) => (
  <div className="mx-5 mt-5 grid grid-cols-2 gap-3" data-testid="v2-actions">
    {ACTIONS.map(([Icon, label, sub, dest], i) => (
      <button key={label} onClick={() => onGo(dest)} data-testid={`v2-action-${i}`}
        className="rounded-2xl border border-slate-100 bg-white p-4 text-left shadow-sm active:scale-[0.97] transition-transform min-h-[100px]">
        <span className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: GREEN_SOFT }}>
          <Icon className="w-5 h-5" style={{ color: GREEN }} />
        </span>
        <div className="mt-2.5 text-sm font-black text-slate-900">{label}</div>
        <div className="text-[10px] text-slate-400 font-medium">{sub}</div>
      </button>
    ))}
  </div>
);

// ── CONTEXTUAL ───────────────────────────────────────────────────────────────
const CONTEXT = {
  nou: [],
  linistit: [["💡", "Revizia centralei e recomandată toamna", "Vezi detalii"]],
  activ: [
    ["🟢", "2 oferte la «Zugrăvit living» — de la 1.800 RON", "Compară"],
    ["💬", "Andrei (specialist): «Pot începe de luni»", "Răspunde"],
  ],
};

const Contextual = ({ state }) => {
  const items = CONTEXT[state];
  if (items.length === 0) return null;
  return (
    <div className="mx-5 mt-6" data-testid="v2-contextual">
      <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-400 px-1">Noutăți pentru tine</h3>
      <div className="mt-2 space-y-2">
        {items.map(([emoji, text, cta]) => (
          <button key={text} className="w-full flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm text-left active:scale-[0.98] transition-transform">
            <span className="text-lg">{emoji}</span>
            <span className="text-xs font-semibold text-slate-700 flex-1 leading-snug">{text}</span>
            <span className="text-[11px] font-black flex items-center shrink-0" style={{ color: GREEN }}>{cta}<ChevronRight className="w-3.5 h-3.5" /></span>
          </button>
        ))}
      </div>
    </div>
  );
};

const Discover = () => (
  <div className="mt-7 pb-6" data-testid="v2-discover">
    <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-400 px-6">Descoperă</h3>
    <div className="mt-2 flex gap-3 overflow-x-auto px-5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {[["Digital Twin", "locuința ta în 3D", Box], ["House Health", "scorul casei tale", HeartPulse], ["Ghiduri", "sfaturi de întreținere", FileText]].map(([l, s, Icon]) => (
        <button key={l} className="shrink-0 w-36 rounded-2xl bg-white border border-slate-100 p-3.5 text-left shadow-sm">
          <Icon className="w-4.5 h-4.5" style={{ color: GREEN, width: 18, height: 18 }} />
          <div className="mt-2 text-xs font-black text-slate-900">{l}</div>
          <div className="text-[10px] text-slate-400">{s}</div>
        </button>
      ))}
    </div>
  </div>
);

// ── HUB „PROPRIETATEA MEA" ───────────────────────────────────────────────────
const PropertyView = () => (
  <div className="pb-8" data-testid="v2-property-view">
    <div className="mx-5 mt-2 rounded-3xl overflow-hidden border border-slate-100 bg-white shadow-sm">
      <div className="h-28 flex items-center justify-center" style={{ background: "linear-gradient(135deg, #E9F9EE 0%, #D2F2DC 100%)" }}>
        <Building2 className="w-10 h-10" style={{ color: GREEN }} />
      </div>
      <div className="p-4">
        <div className="text-lg font-black text-slate-900">Ap. Aviației</div>
        <div className="mt-1.5 flex gap-2">
          {[["Health 86", GREEN_SOFT, GREEN], ["Twin activ", "#EFF6FF", "#3B82F6"], ["4 acte", "#FAF5FF", "#A855F7"]].map(([t, bg, c]) => (
            <span key={t} className="text-[10px] font-bold px-2 py-1 rounded-full" style={{ background: bg, color: c }}>{t}</span>
          ))}
        </div>
      </div>
    </div>
    <div className="mx-5 mt-5 space-y-2">
      {[[Box, "Digital Twin", "locuința ta în 3D"], [HeartPulse, "House Health", "scor + recomandări"], [Clock, "Timeline", "istoricul proprietății"], [FileText, "Documente", "acte & garanții"], [Wallet, "Plăți & Portofel", "sold, tokeni, facturi"]].map(([Icon, l, s]) => (
        <button key={l} className="w-full flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm text-left active:scale-[0.98] transition-transform">
          <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: GREEN_SOFT }}><Icon className="w-5 h-5" style={{ color: GREEN }} /></span>
          <div className="flex-1"><div className="text-sm font-black text-slate-900">{l}</div><div className="text-[10px] text-slate-400">{s}</div></div>
          <ChevronRight className="w-4 h-4 text-slate-300" />
        </button>
      ))}
    </div>
    <div className="mx-5 mt-4">
      <button className="w-full py-3.5 rounded-full border-2 border-dashed border-slate-200 text-xs font-bold text-slate-400">+ Adaugă altă proprietate</button>
    </div>
  </div>
);

// ── LUCRĂRILE MELE ───────────────────────────────────────────────────────────
const JobsView = () => (
  <div className="pb-8" data-testid="v2-jobs-view">
    <div className="mx-5 mt-2 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: GREEN_SOFT }}><PaintRoller className="w-4.5 h-4.5" style={{ color: GREEN, width: 18, height: 18 }} /></span>
        <div>
          <div className="text-sm font-black text-slate-900">Zugrăvit living</div>
          <div className="text-[10px] text-slate-400">cerere #48291057 · acum 2 zile</div>
        </div>
      </div>
      <div className="mt-4"><Steps current={1} /></div>
      <div className="mt-4"><CTA>Compară cele 2 oferte</CTA></div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
        {["Chat", "Detalii", "Ajutor"].map(a => (
          <button key={a} className="py-2 rounded-full bg-slate-50 text-[11px] font-bold text-slate-600">{a}</button>
        ))}
      </div>
    </div>
    <h3 className="mx-6 mt-6 text-[11px] font-black uppercase tracking-wider text-slate-400">Istoric</h3>
    <div className="mx-5 mt-2 space-y-2">
      {["Montaj parchet", "Reparație robinet"].map(t => (
        <button key={t} className="w-full flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm text-left">
          <CircleCheck className="w-5 h-5 shrink-0" style={{ color: GREEN }} />
          <div className="flex-1"><div className="text-xs font-bold text-slate-900">{t}</div><div className="text-[10px] text-slate-400">finalizat · evaluat ★★★★★</div></div>
          <ChevronRight className="w-4 h-4 text-slate-300" />
        </button>
      ))}
    </div>
  </div>
);

// ── SETĂRI ───────────────────────────────────────────────────────────────────
const SettingsView = () => (
  <div className="pb-8 mx-5 mt-2 space-y-2" data-testid="v2-settings-view">
    {[[User, "Profil", ""], [Shield, "Securitate", "2FA dezactivat"], [Bell, "Notificări", ""], [Trophy, "Nivelul contului", "JUNIOR · 2/6 questuri"], [Wallet, "Portofel", "240 RON"]].map(([Icon, l, s]) => (
      <button key={l} className="w-full flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm text-left active:scale-[0.98] transition-transform">
        <span className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center shrink-0"><Icon className="w-5 h-5 text-slate-500" /></span>
        <span className="text-sm font-black text-slate-900 flex-1">{l}</span>
        {s && <span className="text-[10px] font-semibold text-slate-400">{s}</span>}
        <ChevronRight className="w-4 h-4 text-slate-300" />
      </button>
    ))}
  </div>
);

// ── SOLICITĂ ─────────────────────────────────────────────────────────────────
const RequestView = () => (
  <div className="mx-5 mt-2 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm text-center" data-testid="v2-request-view">
    <span className="mx-auto w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: GREEN_SOFT }}><Plus className="w-7 h-7" style={{ color: GREEN }} /></span>
    <h2 className="mt-3 text-lg font-black text-slate-900">Solicită un serviciu</h2>
    <p className="mt-1 text-xs text-slate-400">Fluxul complet (o întrebare pe ecran) e deja construit în prototipul Client Junior.</p>
    <a href="/dashboard/client-junior" className="mt-4 block"><CTA testid="v2-open-junior">Deschide fluxul de solicitare <ArrowRight className="w-4 h-4 inline ml-1" /></CTA></a>
  </div>
);

// ── BOTTOM NAV — 5, „Solicită" FAB central verde ─────────────────────────────
const NAV = [[Home, "Acasă", "home"], [Wrench, "Lucrări", "jobs"], [Plus, "Solicită", "request"], [Building2, "Propr.", "property"], [Settings, "Setări", "settings"]];

const Nav = ({ active, onChange }) => (
  <div className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-slate-100" data-testid="v2-bottom-nav">
    <div className="grid grid-cols-5">
      {NAV.map(([Icon, label, id]) => (
        <button key={id} onClick={() => onChange(id)} data-testid={`v2-nav-${id}`} className="flex flex-col items-center gap-0.5 py-2.5">
          {id === "request" ? (
            <span className="w-12 h-12 -mt-6 rounded-full flex items-center justify-center border-4 border-white shadow-lg shadow-[#34C759]/30" style={{ background: GREEN }}>
              <Icon className="w-5 h-5 text-white" strokeWidth={2.5} />
            </span>
          ) : (
            <Icon className="w-5 h-5" style={{ color: active === id ? GREEN : "#CBD5E1" }} strokeWidth={active === id ? 2.5 : 2} />
          )}
          <span className="text-[9px] font-bold" style={{ color: active === id ? GREEN : "#94A3B8" }}>{label}</span>
        </button>
      ))}
    </div>
  </div>
);

// ── PAGINA ───────────────────────────────────────────────────────────────────
const STATES = [["nou", "A · User nou"], ["linistit", "B · Cu proprietate"], ["activ", "C · Lucrare activă"]];
const TITLES = { home: null, jobs: "Lucrările mele", property: "Proprietatea mea", settings: "Setări", request: null };

export default function ClientV2Design() {
  const [state, setState] = useState("activ");
  const [tab, setTab] = useState("home");
  return (
    <div className="min-h-screen bg-slate-100 sm:py-6 cv2-scope" data-testid="client-v2-wireframe">
      <div className="max-w-md mx-auto px-4 pt-4 sm:pt-0">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-500"><Sparkles className="w-4 h-4" style={{ color: GREEN }} /> FAZA 3 · UI Design Client V2 — direcția B (light)</div>
        <div className="mt-2 flex gap-1.5" data-testid="v2-state-switcher">
          {STATES.map(([id, label]) => (
            <button key={id} onClick={() => { setState(id); setTab("home"); }} data-testid={`v2-state-${id}`}
              className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-colors ${state === id ? "text-white" : "bg-white text-slate-500 border border-slate-200"}`}
              style={state === id ? { background: GREEN } : {}}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="max-w-md mx-auto mt-3 bg-[#FAFBFA] sm:rounded-[2.2rem] sm:border-8 sm:border-slate-800 overflow-hidden relative shadow-2xl" style={{ minHeight: 780 }}>
        <Header />
        {TITLES[tab] && <h1 className="px-5 pb-1 text-xl font-black text-slate-900">{TITLES[tab]}</h1>}
        <div className="pb-24 overflow-y-auto" style={{ maxHeight: 660 }}>
          {tab === "home" && (
            <>
              {state === "nou" ? <HeroA /> : state === "linistit" ? <HeroB /> : <HeroC />}
              <Actions onGo={setTab} />
              <Contextual state={state} />
              <Discover />
            </>
          )}
          {tab === "property" && <PropertyView />}
          {tab === "jobs" && <JobsView />}
          {tab === "settings" && <SettingsView />}
          {tab === "request" && <RequestView />}
        </div>
        <Nav active={tab} onChange={setTab} />
      </div>
      <p className="max-w-md mx-auto mt-3 px-4 pb-6 text-[11px] text-slate-400 text-center">UI propus (mock) — comută A/B/C pentru Hero adaptiv. Faza 4 = implementare reală + migrare controlată /client.</p>
    </div>
  );
}
