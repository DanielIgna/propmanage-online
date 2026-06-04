// FutureIdeasVault — strategic proposals catalog.
//
// READ-ONLY catalog of dev/business proposals that REQUIRE explicit validation
// before any code is written. Each idea is fully documented (architecture,
// backend spec, frontend spec, DB schema, risks, phases, ROI) so the founder
// can decide whether the cost/benefit warrants implementation.
//
// CRITICAL: this is NOT a ToDo board. Status changes here DO NOT trigger any
// implementation. Approval here just means "we can consider scheduling it".
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import {
  Lightbulb, ShieldAlert, Lock, Sparkles, ChevronRight, ChevronLeft,
  Loader2, Save, Coins, TrendingUp, AlertTriangle, CheckCircle2,
  Code2, Database, Layout, GitBranch, Brain, Clock, FileText,
} from "lucide-react";
import { FUTURE_IDEAS } from "../../data/futureIdeas";

const API = process.env.REACT_APP_BACKEND_URL;
const ax = axios.create({ baseURL: API, withCredentials: true });

const STATUS_META = {
  pending_validation: { label: "În evaluare", color: "amber",   icon: Clock },
  in_discussion:      { label: "În discuție", color: "blue",    icon: FileText },
  approved:           { label: "Aprobat",     color: "emerald", icon: CheckCircle2 },
  rejected:           { label: "Respins",     color: "red",     icon: AlertTriangle },
  on_hold:            { label: "Pe pauză",    color: "stone",   icon: Lock },
};

const colorClasses = (c) => ({
  amber:   "bg-amber-500/10 border-amber-500/40 text-amber-300",
  blue:    "bg-blue-500/10 border-blue-500/40 text-blue-300",
  emerald: "bg-emerald-500/10 border-emerald-500/40 text-emerald-300",
  red:     "bg-red-500/10 border-red-500/40 text-red-300",
  stone:   "bg-stone-500/10 border-stone-500/40 text-stone-300",
}[c]);

const FutureIdeasVault = () => {
  const [statuses, setStatuses] = useState({}); // idea_id -> status doc
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null); // idea object

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await ax.get("/api/admin/future-ideas");
      const map = {};
      (data.items || []).forEach(s => { map[s.idea_id] = s; });
      setStatuses(map);
    } catch (_) { /* allow empty */ }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const getStatus = (id) => statuses[id]?.status || "pending_validation";

  if (selected) {
    return (
      <IdeaDetail
        idea={selected}
        status={statuses[selected.id]}
        onBack={() => setSelected(null)}
        onSaved={(s) => setStatuses(prev => ({ ...prev, [selected.id]: s }))}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      <div className="max-w-6xl mx-auto px-6 pt-28 pb-16">
        <Link to="/admin" className="text-xs text-stone-400 hover:text-white inline-flex items-center gap-1 mb-3" data-testid="fi-back">
          <ChevronLeft className="w-3.5 h-3.5" /> Înapoi la Admin Dashboard
        </Link>

        <div className="flex items-start gap-3 mb-2">
          <div className="w-12 h-12 rounded-2xl bg-[#d4ff3a]/10 border border-[#d4ff3a]/30 flex items-center justify-center shrink-0">
            <Lightbulb className="w-5 h-5 text-[#d4ff3a]" />
          </div>
          <div>
            <h1 className="font-serif text-4xl md:text-5xl tracking-tight" data-testid="fi-title">
              Idei de <span className="italic gradient-text">Dezvoltare</span> Viitoare
            </h1>
            <p className="text-sm text-stone-400 mt-2 max-w-3xl">
              Catalog de propuneri arhitecturale ce <strong className="text-stone-200">NU au fost încă implementate</strong>.
              Fiecare propunere include documentație completă pentru echipa IT (backend, frontend, DB, riscuri, faze, ROI estimat).
            </p>
          </div>
        </div>

        {/* WARNING BANNER — most prominent */}
        <div className="mt-6 rounded-2xl border border-red-500/40 bg-gradient-to-r from-red-500/10 via-red-500/5 to-amber-500/5 p-5 flex items-start gap-3" data-testid="fi-warning">
          <ShieldAlert className="w-6 h-6 text-red-400 shrink-0 mt-0.5" />
          <div className="text-sm leading-relaxed">
            <div className="text-base font-semibold text-red-300 mb-1">ATENȚIE — Zonă strategică, NU operativă</div>
            <ul className="list-disc list-inside text-stone-300 space-y-0.5">
              <li>Aceste idei sunt <strong className="text-white">propuneri în evaluare</strong> — nu apar în ToDo Board și nu sunt în coada de dezvoltare.</li>
              <li><strong className="text-white">NU începeți implementarea</strong> niciunei idei fără aprobarea explicită a founder-ului.</li>
              <li>Schimbarea statusului aici <strong className="text-white">NU declanșează</strong> nicio acțiune automată — este doar pentru tracking decizional.</li>
              <li>Implementarea, când va începe, va fi <strong className="text-white">strict pe etape</strong>, izolată prin feature flags, fără modificări la modulele existente.</li>
            </ul>
          </div>
        </div>

        {loading ? (
          <div className="mt-10 text-center text-stone-400 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Se încarcă propunerile...
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            {FUTURE_IDEAS.map((idea) => {
              const st = getStatus(idea.id);
              const meta = STATUS_META[st];
              const Icon = meta.icon;
              return (
                <button
                  key={idea.id}
                  onClick={() => setSelected(idea)}
                  className="w-full text-left bg-[#0e0e10] border border-white/10 hover:border-white/20 rounded-2xl p-5 transition-all group"
                  data-testid={`fi-card-${idea.id}`}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                      <idea.icon className="w-5 h-5 text-stone-300" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-stone-500">{idea.code}</span>
                        <span className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${colorClasses(meta.color)}`}>
                          <Icon className="w-3 h-3" /> {meta.label}
                        </span>
                        <span className="text-[10px] text-stone-500">Risk {idea.risk}/10 · {idea.timelineDays}z dev</span>
                      </div>
                      <div className="text-lg font-semibold text-white">{idea.title}</div>
                      <div className="text-sm text-stone-400 mt-1 line-clamp-2">{idea.summary}</div>
                      <div className="flex items-center gap-3 mt-3 text-[11px] text-stone-500">
                        <span className="inline-flex items-center gap-1"><Coins className="w-3 h-3" /> Cost ~{idea.estCostEur}€</span>
                        <span className="inline-flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Venit potențial {idea.estRevenueRange}</span>
                        <span className="inline-flex items-center gap-1"><GitBranch className="w-3 h-3" /> {idea.phases.length} faze</span>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-stone-500 group-hover:text-white shrink-0 mt-2" />
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* SAFETY FOOTER */}
        <div className="mt-10 bg-amber-500/5 border border-amber-500/30 rounded-2xl p-4 text-xs text-amber-100 flex items-start gap-3">
          <Lock className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
          <div>
            <strong>Convenție de siguranță:</strong> Acest catalog nu se sincronizează cu ToDo Board.
            Trecerea unei idei pe <em>Aprobat</em> indică doar decizia de business — NU adaugă automat task-uri în coadă.
            Când o idee este aprobată oficial, founder-ul va crea explicit fazele necesare în ToDo Board.
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// IDEA DETAIL VIEW
// ============================================================================
const TABS = [
  { id: "overview", label: "Overview",        icon: Lightbulb },
  { id: "phases",   label: "Faze (Etape)",    icon: GitBranch },
  { id: "backend",  label: "Backend Spec",    icon: Code2 },
  { id: "frontend", label: "Frontend Spec",   icon: Layout },
  { id: "db",       label: "Database Schema", icon: Database },
  { id: "risks",    label: "Riscuri",         icon: AlertTriangle },
  { id: "ai",       label: "AI Touchpoints",  icon: Brain },
  { id: "roi",      label: "Cost vs Venit",   icon: TrendingUp },
];

const IdeaDetail = ({ idea, status, onBack, onSaved }) => {
  const [tab, setTab] = useState("overview");
  const [draft, setDraft] = useState({
    status: status?.status || "pending_validation",
    notes: status?.notes || "",
    estimated_cost_eur: status?.estimated_cost_eur ?? "",
    estimated_revenue_eur_monthly: status?.estimated_revenue_eur_monthly ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);

  const save = async () => {
    setSaving(true);
    setSaveOk(false);
    try {
      const payload = {
        status: draft.status,
        notes: draft.notes,
        estimated_cost_eur: draft.estimated_cost_eur === "" ? null : Number(draft.estimated_cost_eur),
        estimated_revenue_eur_monthly: draft.estimated_revenue_eur_monthly === "" ? null : Number(draft.estimated_revenue_eur_monthly),
      };
      const { data } = await ax.put(`/api/admin/future-ideas/${idea.id}`, payload);
      onSaved(data);
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 2200);
    } finally { setSaving(false); }
  };

  const stMeta = STATUS_META[draft.status];

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      <div className="max-w-6xl mx-auto px-6 pt-28 pb-16">
        <button onClick={onBack} className="text-xs text-stone-400 hover:text-white inline-flex items-center gap-1 mb-3" data-testid="fi-detail-back">
          <ChevronLeft className="w-3.5 h-3.5" /> Înapoi la catalog
        </button>

        <div className="flex items-start gap-4 mb-4">
          <div className="w-14 h-14 rounded-2xl bg-[#d4ff3a]/10 border border-[#d4ff3a]/30 flex items-center justify-center shrink-0">
            <idea.icon className="w-6 h-6 text-[#d4ff3a]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-mono text-[10px] uppercase tracking-wider text-stone-500">{idea.code} · Risk {idea.risk}/10 · {idea.timelineDays} zile dev</div>
            <h1 className="font-serif text-3xl md:text-4xl tracking-tight mt-1" data-testid="fi-detail-title">{idea.title}</h1>
            <p className="text-sm text-stone-400 mt-2 max-w-3xl">{idea.summary}</p>
          </div>
        </div>

        {/* STATUS PANEL */}
        <div className="bg-[#0e0e10] border border-white/10 rounded-2xl p-5 mb-6">
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-stone-400">Status decizie business</label>
              <div className="flex flex-wrap gap-2 mt-2">
                {Object.entries(STATUS_META).map(([key, m]) => (
                  <button
                    key={key}
                    onClick={() => setDraft(d => ({ ...d, status: key }))}
                    className={`text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full border transition-colors ${
                      draft.status === key ? colorClasses(m.color) : "bg-white/5 border-white/10 text-stone-400 hover:border-white/20"
                    }`}
                    data-testid={`fi-status-${key}`}
                  >{m.label}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-stone-400">Cost estimat (€ one-time)</label>
              <input
                type="number"
                value={draft.estimated_cost_eur}
                onChange={(e) => setDraft(d => ({ ...d, estimated_cost_eur: e.target.value }))}
                className="mt-2 w-full bg-[#0a0a0b] border border-white/10 rounded-lg px-3 py-2 text-sm font-mono"
                placeholder={`ex: ${idea.estCostEur}`}
                data-testid="fi-cost-input"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-stone-400">Venit estimat (€ / lună)</label>
              <input
                type="number"
                value={draft.estimated_revenue_eur_monthly}
                onChange={(e) => setDraft(d => ({ ...d, estimated_revenue_eur_monthly: e.target.value }))}
                className="mt-2 w-full bg-[#0a0a0b] border border-white/10 rounded-lg px-3 py-2 text-sm font-mono"
                placeholder={`ex: ${idea.estRevenueMonthly}`}
                data-testid="fi-revenue-input"
              />
            </div>
          </div>

          <label className="text-[10px] uppercase tracking-wider text-stone-400 block mt-4">Note decizionale (interne)</label>
          <textarea
            value={draft.notes}
            onChange={(e) => setDraft(d => ({ ...d, notes: e.target.value }))}
            rows={3}
            className="mt-2 w-full bg-[#0a0a0b] border border-white/10 rounded-lg px-3 py-2 text-sm"
            placeholder="ex: așteptăm validare cu 3 clienți pilot înainte de a aproba Phase ES-2..."
            data-testid="fi-notes-input"
          />

          <div className="flex items-center justify-between mt-4">
            <div className="text-xs text-stone-500">
              Status curent: <span className={`px-2 py-0.5 rounded-full border ${colorClasses(stMeta.color)}`}>{stMeta.label}</span>
              {status?.updated_at && (
                <span className="ml-2">· Modificat: {new Date(status.updated_at).toLocaleString("ro-RO")} de {status.updated_by}</span>
              )}
            </div>
            <button
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#d4ff3a] text-black text-sm font-semibold hover:bg-[#c0eb2a] disabled:opacity-60"
              data-testid="fi-save"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saveOk ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {saveOk ? "Salvat" : "Salvează decizia"}
            </button>
          </div>
        </div>

        {/* TABS */}
        <div className="flex flex-wrap gap-2 mb-4">
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm border transition-colors ${
                  tab === t.id ? "bg-white/10 border-white/30 text-white" : "bg-[#0e0e10] border-white/10 text-stone-400 hover:text-white"
                }`}
                data-testid={`fi-tab-${t.id}`}
              >
                <Icon className="w-4 h-4" /> {t.label}
              </button>
            );
          })}
        </div>

        {/* TAB CONTENT */}
        <div className="bg-[#0e0e10] border border-white/10 rounded-2xl p-6">
          {tab === "overview" && <SectionOverview idea={idea} />}
          {tab === "phases"   && <SectionPhases idea={idea} />}
          {tab === "backend"  && <SectionBackend idea={idea} />}
          {tab === "frontend" && <SectionFrontend idea={idea} />}
          {tab === "db"       && <SectionDB idea={idea} />}
          {tab === "risks"    && <SectionRisks idea={idea} />}
          {tab === "ai"       && <SectionAI idea={idea} />}
          {tab === "roi"      && <SectionROI idea={idea} />}
        </div>
      </div>
    </div>
  );
};

const H = ({ children }) => <h3 className="text-sm uppercase tracking-wider text-stone-400 mb-3">{children}</h3>;
const Pre = ({ children }) => (
  <pre className="bg-black/60 border border-white/10 rounded-lg p-3 text-[11px] leading-relaxed font-mono text-stone-300 overflow-x-auto whitespace-pre-wrap">{children}</pre>
);

const SectionOverview = ({ idea }) => (
  <div className="space-y-5">
    <div>
      <H>Problemă & Oportunitate</H>
      <p className="text-sm text-stone-300 leading-relaxed">{idea.problemAndOpportunity}</p>
    </div>
    <div>
      <H>Principii arhitecturale (negociabile)</H>
      <ul className="space-y-1.5 text-sm text-stone-300">
        {idea.principles.map((p, i) => (
          <li key={i} className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>{p}</span>
          </li>
        ))}
      </ul>
    </div>
    <div>
      <H>Anti-patterns (DE EVITAT)</H>
      <ul className="space-y-1.5 text-sm text-stone-300">
        {idea.antiPatterns.map((a, i) => (
          <li key={i} className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{a}</span>
          </li>
        ))}
      </ul>
    </div>
  </div>
);

const SectionPhases = ({ idea }) => (
  <div className="space-y-3">
    <H>Roadmap pe etape (implementare strict secvențială)</H>
    {idea.phases.map((p, i) => (
      <div key={i} className="border border-white/10 rounded-xl p-4 bg-white/[0.02]">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#d4ff3a]/10 border border-[#d4ff3a]/30 text-[#d4ff3a]">{p.code}</span>
          <div className="font-semibold text-white">{p.title}</div>
          <span className="text-[10px] text-stone-500 ml-auto">{p.days}z dev</span>
        </div>
        <div className="text-sm text-stone-400 mt-2">{p.description}</div>
        <ul className="mt-2 list-disc list-inside text-xs text-stone-500 space-y-0.5">
          {p.deliverables.map((d, j) => <li key={j}>{d}</li>)}
        </ul>
      </div>
    ))}
  </div>
);

const SectionBackend = ({ idea }) => (
  <div className="space-y-5">
    <div>
      <H>Structură director backend</H>
      <Pre>{idea.backend.structure}</Pre>
    </div>
    <div>
      <H>Endpoint-uri API ({idea.backend.endpoints.length})</H>
      <div className="space-y-1">
        {idea.backend.endpoints.map((e, i) => (
          <div key={i} className="flex items-start gap-3 text-[12px] font-mono py-1 border-b border-white/5">
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
              e.method === "GET"    ? "bg-blue-500/10 text-blue-300" :
              e.method === "POST"   ? "bg-emerald-500/10 text-emerald-300" :
              e.method === "PUT"    ? "bg-amber-500/10 text-amber-300" :
              e.method === "DELETE" ? "bg-red-500/10 text-red-300" :
                                      "bg-stone-500/10 text-stone-300"
            }`}>{e.method}</span>
            <span className="text-stone-200">{e.path}</span>
            <span className="text-stone-500 text-[11px] ml-2">{e.note}</span>
          </div>
        ))}
      </div>
    </div>
    <div>
      <H>Middleware & Security</H>
      <ul className="space-y-1.5 text-sm text-stone-300">
        {idea.backend.security.map((s, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="text-stone-500">•</span><span>{s}</span>
          </li>
        ))}
      </ul>
    </div>
    <div>
      <H>Dependențe noi (Python)</H>
      <Pre>{idea.backend.dependencies.join("\n")}</Pre>
    </div>
  </div>
);

const SectionFrontend = ({ idea }) => (
  <div className="space-y-5">
    <div>
      <H>Structură director frontend</H>
      <Pre>{idea.frontend.structure}</Pre>
    </div>
    <div>
      <H>Rute publice & autenticate ({idea.frontend.routes.length})</H>
      <div className="space-y-1">
        {idea.frontend.routes.map((r, i) => (
          <div key={i} className="flex items-start gap-3 text-[12px] font-mono py-1 border-b border-white/5">
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
              r.scope === "public" ? "bg-emerald-500/10 text-emerald-300" :
              r.scope === "auth"   ? "bg-blue-500/10 text-blue-300" :
                                     "bg-amber-500/10 text-amber-300"
            }`}>{r.scope}</span>
            <span className="text-stone-200">{r.path}</span>
            <span className="text-stone-500 text-[11px] ml-2">{r.note}</span>
          </div>
        ))}
      </div>
    </div>
    <div>
      <H>Design system reuse</H>
      <ul className="space-y-1.5 text-sm text-stone-300">
        {idea.frontend.designReuse.map((d, i) => (
          <li key={i} className="flex items-start gap-2"><span className="text-stone-500">•</span><span>{d}</span></li>
        ))}
      </ul>
    </div>
    <div>
      <H>Dependențe noi (npm/yarn)</H>
      <Pre>{idea.frontend.dependencies.join("\n")}</Pre>
    </div>
  </div>
);

const SectionDB = ({ idea }) => (
  <div className="space-y-5">
    <div>
      <H>Convenție de izolare</H>
      <p className="text-sm text-stone-300">{idea.db.isolationRule}</p>
    </div>
    <div>
      <H>Colecții MongoDB noi ({idea.db.collections.length})</H>
      <div className="space-y-3">
        {idea.db.collections.map((c, i) => (
          <div key={i} className="border border-white/10 rounded-xl p-4 bg-white/[0.02]">
            <div className="flex items-center justify-between mb-2">
              <code className="text-sm text-[#d4ff3a]">{c.name}</code>
              <span className="text-[10px] text-stone-500">{c.purpose}</span>
            </div>
            <Pre>{c.schema}</Pre>
            {c.indexes && (
              <div className="mt-2 text-[11px] text-stone-500">
                <strong className="text-stone-400">Indecși:</strong> {c.indexes.join(" · ")}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  </div>
);

const SectionRisks = ({ idea }) => (
  <div className="space-y-3">
    <H>Riscuri identificate (cu mitigare)</H>
    {idea.risks.map((r, i) => (
      <div key={i} className="border border-white/10 rounded-xl p-4 bg-white/[0.02]">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-[10px] text-stone-500">{r.id}</span>
          <span className={`text-[10px] uppercase px-2 py-0.5 rounded-full border ${
            r.severity === "CRITICAL" ? "bg-red-500/10 border-red-500/40 text-red-300" :
            r.severity === "HIGH"     ? "bg-amber-500/10 border-amber-500/40 text-amber-300" :
            r.severity === "MEDIUM"   ? "bg-blue-500/10 border-blue-500/40 text-blue-300" :
                                        "bg-stone-500/10 border-stone-500/40 text-stone-300"
          }`}>{r.severity}</span>
          <div className="font-semibold text-white text-sm">{r.title}</div>
        </div>
        <div className="text-xs text-stone-400 mt-2"><strong className="text-stone-300">Mitigare:</strong> {r.mitigation}</div>
      </div>
    ))}
  </div>
);

const SectionAI = ({ idea }) => (
  <div className="space-y-3">
    <H>Integrare AI (reutilizare infrastructură existentă)</H>
    <p className="text-sm text-stone-300 mb-3">{idea.ai.philosophy}</p>
    {idea.ai.touchpoints.map((t, i) => (
      <div key={i} className="border border-white/10 rounded-xl p-4 bg-white/[0.02]">
        <div className="font-semibold text-white text-sm">{t.title}</div>
        <div className="text-xs text-stone-400 mt-1">{t.description}</div>
        <div className="text-[11px] text-stone-500 mt-2">
          <strong>Reuse:</strong> {t.reuse} · <strong>Fază:</strong> {t.phase}
        </div>
      </div>
    ))}
  </div>
);

const SectionROI = ({ idea }) => (
  <div className="space-y-5">
    <div>
      <H>Estimare cost dezvoltare</H>
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="border border-white/10 rounded-xl p-4 bg-white/[0.02]">
          <div className="text-[10px] uppercase text-stone-400">Cost total (dev one-time)</div>
          <div className="text-2xl font-mono mt-1 text-white">~{idea.estCostEur}€</div>
          <div className="text-[10px] text-stone-500 mt-1">{idea.timelineDays} zile la rata internă</div>
        </div>
        <div className="border border-white/10 rounded-xl p-4 bg-white/[0.02]">
          <div className="text-[10px] uppercase text-stone-400">Cost operare lunar</div>
          <div className="text-2xl font-mono mt-1 text-white">~{idea.estOpexMonthly}€</div>
          <div className="text-[10px] text-stone-500 mt-1">AI calls + storage + transactional emails</div>
        </div>
        <div className="border border-white/10 rounded-xl p-4 bg-white/[0.02]">
          <div className="text-[10px] uppercase text-stone-400">Venit potențial lunar</div>
          <div className="text-2xl font-mono mt-1 text-emerald-300">{idea.estRevenueRange}</div>
          <div className="text-[10px] text-stone-500 mt-1">Scenarii pesimist → optimist</div>
        </div>
      </div>
    </div>
    <div>
      <H>Scenarii de monetizare</H>
      <div className="space-y-2">
        {idea.revenueScenarios.map((s, i) => (
          <div key={i} className="border border-white/10 rounded-xl p-3 bg-white/[0.02]">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="font-semibold text-white text-sm">{s.name}</div>
              <div className="text-emerald-300 font-mono text-sm">{s.estimatedRevenue}</div>
            </div>
            <div className="text-xs text-stone-400 mt-1">{s.description}</div>
          </div>
        ))}
      </div>
    </div>
    <div>
      <H>Break-even & Payback</H>
      <div className="text-sm text-stone-300 leading-relaxed">{idea.breakEven}</div>
    </div>
    <div>
      <H>Recomandare strategică</H>
      <div className="text-sm text-stone-300 leading-relaxed border-l-2 border-[#d4ff3a] pl-3">{idea.recommendation}</div>
    </div>
  </div>
);

export default FutureIdeasVault;
