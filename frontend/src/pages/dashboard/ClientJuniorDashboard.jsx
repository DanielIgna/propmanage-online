import React, { useState } from "react";
import {
  ArrowLeft, X, Search, PaintRoller, Sparkles, Wrench, Zap, Wind, Hammer,
  PartyPopper, ChevronRight, Bell, Settings, CircleCheck, Circle,
} from "lucide-react";
import { QuestionCard, OptionRadio, StickyCTA, BottomNav, CategoryCard, CJ_GREEN } from "./clientjunior/components";

// ============================================================================
// Client Junior UI — rută de test /dashboard/client-junior (Hick's Law)
// Un singur pas pe ecran, max 4 opțiuni, CTA sticky, navigare cu 4 destinații.
// MOCK: cererile nu se trimit la backend — validare UI înainte de integrare.
// ============================================================================

const CATEGORIES = [
  { id: "zugraveli", label: "Zugrăveli Interioare", icon: PaintRoller, price: "RON 2.000 – 14.500" },
  { id: "curatenie", label: "Curățenie la Domiciliu", icon: Sparkles, price: "RON 150 – 800" },
  { id: "instalatii", label: "Instalații Sanitare", icon: Wrench, price: "RON 200 – 3.500" },
  { id: "electric", label: "Electricitate", icon: Zap, price: "RON 150 – 2.000" },
  { id: "clima", label: "Aer Condiționat", icon: Wind, price: "RON 250 – 1.200" },
  { id: "montaj", label: "Montaj Mobilă", icon: Hammer, price: "RON 100 – 900" },
];

const QUESTIONS = [
  { key: "where", q: "Unde ai nevoie de serviciu?", options: ["Apartament", "Casă"] },
  { key: "size", q: "Cât de mare e lucrarea?", hint: "O estimare e suficientă.", options: ["Mică (1-2 camere)", "Medie (3-4 camere)", "Mare (5+ camere)"] },
  { key: "when", q: "Când ai avea nevoie?", options: ["Cât mai repede", "În următoarele 2 săptămâni", "Doar explorez prețuri"] },
];

const Header = ({ title, onBack, onClose }) => (
  <div className="flex items-center gap-3 px-4 py-3.5 bg-white border-b border-slate-100">
    <button onClick={onBack} className="p-1 -ml-1" data-testid="cj-flow-back"><ArrowLeft className="w-5 h-5 text-slate-700" /></button>
    <span className="flex-1 text-center text-sm font-bold text-slate-900 truncate">{title}</span>
    <button onClick={onClose} className="p-1 -mr-1" data-testid="cj-flow-close"><X className="w-5 h-5 text-slate-700" /></button>
  </div>
);

const HomeView = ({ onPickCategory }) => {
  const [query, setQuery] = useState("");
  const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const filtered = query ? CATEGORIES.filter(c => norm(c.label).includes(norm(query))) : CATEGORIES;
  return (
    <div className="pb-24" data-testid="cj-home-view">
      <div className="px-5 pt-6 flex items-center gap-2">
        <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: CJ_GREEN }}>
          <Sparkles className="w-4 h-4 text-white" />
        </span>
        <span className="text-lg font-black text-slate-900">propmanage</span>
      </div>
      <div className="px-5 mt-5 flex gap-2">
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Ce serviciu cauți?" data-testid="cj-search-input"
          className="flex-1 px-4 py-3.5 rounded-full border border-slate-200 bg-white text-sm outline-none focus:border-[#34C759]" />
        <button className="w-12 h-12 rounded-full flex items-center justify-center shrink-0" style={{ background: CJ_GREEN }} data-testid="cj-search-btn">
          <Search className="w-5 h-5 text-white" />
        </button>
      </div>
      <div className="mt-7">
        <h3 className="px-5 text-base font-black text-slate-900">Cele mai căutate servicii</h3>
        <div className="mt-3 flex gap-3 overflow-x-auto px-5 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {filtered.slice(0, 4).map(c => (
            <CategoryCard key={c.id} icon={c.icon} label={c.label} sub={c.price} onClick={() => onPickCategory(c)} testid={`cj-cat-${c.id}`} />
          ))}
        </div>
      </div>
      <div className="mt-6 px-5">
        <h3 className="text-base font-black text-slate-900">Toate categoriile</h3>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {filtered.map(c => (
            <CategoryCard key={c.id} icon={c.icon} label={c.label} sub={c.price} onClick={() => onPickCategory(c)} testid={`cj-grid-${c.id}`} wide />
          ))}
        </div>
        {filtered.length === 0 && <p className="text-center text-sm text-slate-400 py-8">Nu am găsit servicii pentru „{query}"</p>}
      </div>
    </div>
  );
};

const FlowView = ({ category, onDone, onExit }) => {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const q = QUESTIONS[step];
  const selected = answers[q.key];
  const progress = ((step + 1) / (QUESTIONS.length + 1)) * 100;
  const next = () => (step < QUESTIONS.length - 1 ? setStep(step + 1) : onDone(answers));
  return (
    <div className="pb-32" data-testid="cj-flow-view">
      <Header title={category.label} onBack={() => (step === 0 ? onExit() : setStep(step - 1))} onClose={onExit} />
      <div className="h-1.5 bg-slate-100">
        <div className="h-full transition-all duration-300 rounded-r-full" style={{ width: `${progress}%`, background: CJ_GREEN }} data-testid="cj-progress-bar" />
      </div>
      <div className="px-5 pt-4 text-xs text-slate-500">
        Intervalul mediu de preț: <span className="font-bold text-slate-900">{category.price}</span>
      </div>
      <QuestionCard question={q.q} hint={q.hint}>
        {q.options.map((opt, i) => (
          <OptionRadio key={opt} label={opt} selected={selected === opt} testid={`cj-option-${q.key}-${i}`}
            onSelect={() => setAnswers(a => ({ ...a, [q.key]: opt }))} />
        ))}
      </QuestionCard>
      <StickyCTA label="Continuă" disabled={!selected} onClick={next} testid="cj-continue-btn" />
    </div>
  );
};

const ConfirmView = ({ category, onGoJobs, onCancel }) => (
  <div className="min-h-screen pb-10 flex flex-col" style={{ background: "#E9F9EE" }} data-testid="cj-confirm-view">
    <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
      <span className="w-20 h-20 rounded-full flex items-center justify-center mb-6" style={{ background: CJ_GREEN }}>
        <PartyPopper className="w-9 h-9 text-white" />
      </span>
      <h1 className="text-2xl font-black text-slate-900 leading-snug">Am primit cererea pentru {category.label}!</h1>
      <p className="mt-3 text-sm text-slate-600 max-w-xs">Te vom notifica prin email și SMS atunci când cererea ta primește oferte de la profesioniști.</p>
    </div>
    <div className="px-5 space-y-2 max-w-md mx-auto w-full">
      <button onClick={onGoJobs} data-testid="cj-go-jobs-btn"
        className="w-full py-4 rounded-full text-base font-bold text-white shadow-lg shadow-[#34C759]/30 active:scale-[0.98] transition-transform" style={{ background: CJ_GREEN }}>
        Mergi la lucrările mele
      </button>
      <button onClick={onCancel} className="w-full py-2.5 text-sm font-semibold text-rose-500" data-testid="cj-cancel-request-btn">Anulează cererea</button>
    </div>
  </div>
);

const QUESTION_LABELS = { where: "Unde ai nevoie de serviciu?", size: "Cât de mare e lucrarea?", when: "Când ai avea nevoie?" };

const JobsView = ({ request }) => (
  <div className="pb-24" data-testid="cj-jobs-view">
    <div className="px-5 pt-6"><h1 className="text-xl font-black text-slate-900">Lucrările mele</h1></div>
    {!request ? (
      <div className="px-6 py-16 text-center text-sm text-slate-400" data-testid="cj-jobs-empty">Nicio lucrare încă. Solicită primul serviciu din tab-ul „Solicită".</div>
    ) : (
      <div className="mx-5 mt-4 rounded-2xl border border-slate-100 bg-white shadow-sm p-5" data-testid="cj-job-card">
        <div className="font-black text-slate-900">{request.category.label}</div>
        <div className="mt-4 space-y-0">
          <div className="flex items-start gap-3">
            <div className="flex flex-col items-center"><CircleCheck className="w-5 h-5" style={{ color: CJ_GREEN }} /><span className="w-px h-8 bg-slate-200" /></div>
            <div className="text-sm font-bold text-slate-900">Alege-ți profesionistul</div>
          </div>
          <div className="flex items-start gap-3">
            <Circle className="w-5 h-5 text-slate-300" />
            <div className="text-sm font-medium text-slate-400">Lucrare finalizată! Lasă o evaluare</div>
          </div>
        </div>
        <div className="mt-5 pt-4 border-t border-slate-100 space-y-3">
          {Object.entries(request.answers).map(([k, v]) => (
            <div key={k}>
              <div className="text-xs font-bold text-slate-900">{QUESTION_LABELS[k]}</div>
              <div className="text-sm text-slate-500">{v}</div>
            </div>
          ))}
          <div>
            <div className="text-xs font-bold text-slate-900">Numărul cererii</div>
            <div className="text-sm text-slate-500 font-mono">{request.number}</div>
          </div>
        </div>
      </div>
    )}
  </div>
);

const PlaceholderView = ({ icon: Icon, title, text, testid }) => (
  <div className="px-6 py-20 text-center" data-testid={testid}>
    <Icon className="w-10 h-10 mx-auto text-slate-300" />
    <h2 className="mt-3 text-lg font-black text-slate-900">{title}</h2>
    <p className="mt-1 text-sm text-slate-400">{text}</p>
  </div>
);

export default function ClientJuniorDashboard() {
  const [tab, setTab] = useState("home");
  const [view, setView] = useState("home"); // home | flow | confirm
  const [category, setCategory] = useState(null);
  const [request, setRequest] = useState(null);

  const startFlow = (c) => { setCategory(c); setView("flow"); };
  const finishFlow = (answers) => {
    setRequest({ category, answers, number: String(Math.floor(10000000 + Math.random() * 90000000)) });
    setView("confirm");
  };
  const goHome = () => { setView("home"); setTab("home"); };

  return (
    <div className="min-h-screen bg-[#FAFBFA] cv2-scope" data-testid="client-junior-page">
      <div className="max-w-md mx-auto min-h-screen bg-white sm:border-x sm:border-slate-100">
        {view === "flow" ? (
          <FlowView category={category} onDone={finishFlow} onExit={goHome} />
        ) : view === "confirm" ? (
          <ConfirmView category={category} onGoJobs={() => { setView("home"); setTab("jobs"); }} onCancel={() => { setRequest(null); goHome(); }} />
        ) : (
          <>
            {tab === "home" && <HomeView onPickCategory={startFlow} />}
            {tab === "jobs" && <JobsView request={request} />}
            {tab === "notifications" && <PlaceholderView icon={Bell} title="Notificări" text="Vei vedea aici ofertele și noutățile tale." testid="cj-notifications-view" />}
            {tab === "settings" && <PlaceholderView icon={Settings} title="Setări" text="Profil, notificări și preferințe — în curând." testid="cj-settings-view" />}
            <BottomNav active={tab} onChange={setTab} />
          </>
        )}
      </div>
    </div>
  );
}
