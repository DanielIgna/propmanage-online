// TierToolsPanel — progressive feature panel for client/specialist dashboards.
//
// Demonstrates Progressive Disclosure: shows different tools per tier with
// friendly upgrade hints for locked features. ZERO impact on existing flows —
// this is an ADDITIONAL section, not a replacement.
//
// Usage:
//   <TierToolsPanel role="client" />     // in ClientDashboard
//   <TierToolsPanel role="specialist" /> // in SpecialistDashboard
//
// To toggle visibility globally, comment out the import in the dashboard.
import React, { useState } from "react";
import {
  Sparkles, Lock, CheckCircle2, BarChart3, Bookmark, Filter,
  FileDown, Layers3, Bell as BellIcon, Zap, Crown, Code2,
  ChevronDown, ChevronUp,
} from "lucide-react";
import { useTier, TIER_LABEL } from "./experienceTier";

// Tool catalog — each tool advertises its required tier + a "Demo" action.
// All "Demo" actions are 100% safe (just show an alert with the tier info).
const CLIENT_TOOLS = [
  { key: "advanced_filters",   tier: "regular",  icon: Filter,    label: "Filtre avansate",          desc: "Filtrează cererile după zonă, preț, status, perioadă." },
  { key: "saved_searches",     tier: "regular",  icon: Bookmark,  label: "Căutări salvate",          desc: "Salvează căutări frecvente și primește notificări la rezultate noi." },
  { key: "request_templates",  tier: "regular",  icon: Layers3,   label: "Șabloane cereri",          desc: "Creează cereri rapid din template-uri reutilizabile." },
  { key: "comparison_view",    tier: "regular",  icon: BarChart3, label: "Comparare oferte",         desc: "Compară până la 3 oferte simultan side-by-side." },
  { key: "bulk_operations",    tier: "verified", icon: FileDown,  label: "Operațiuni în masă",       desc: "Aprobă/refuză mai multe oferte deodată." },
  { key: "export_data",        tier: "verified", icon: FileDown,  label: "Export Excel/CSV",         desc: "Exportă istoricul cererilor în format Excel sau CSV." },
  { key: "advanced_analytics", tier: "verified", icon: BarChart3, label: "Analize avansate",         desc: "Vezi statistici detaliate: rate de finalizare, cost mediu, durată." },
  { key: "custom_notifications", tier: "verified", icon: BellIcon, label: "Notificări personalizate", desc: "Configurează când și cum primești notificări." },
  { key: "priority_support",   tier: "pro",      icon: Crown,     label: "Support prioritar",        desc: "Tichetele tale sunt rezolvate cu prioritate maximă." },
  { key: "api_access",         tier: "pro",      icon: Code2,     label: "Acces API",                desc: "Integrează PropManage în propriile tale sisteme." },
];

const SPECIALIST_TOOLS = [
  { key: "advanced_filters",     tier: "regular",  icon: Filter,    label: "Filtre avansate oportunități", desc: "Filtrează oportunitățile după buget, zonă, dată, categorie." },
  { key: "saved_searches",       tier: "regular",  icon: Bookmark,  label: "Căutări salvate",              desc: "Salvează căutări de oportunități și primește alerte." },
  { key: "request_templates",    tier: "regular",  icon: Layers3,   label: "Șabloane oferte",              desc: "Creează oferte rapid din șabloane reutilizabile." },
  { key: "priority_matching",    tier: "verified", icon: Zap,       label: "Matching prioritar",           desc: "Algoritmul îți arată oportunitățile compatibile primele." },
  { key: "bulk_operations",      tier: "verified", icon: FileDown,  label: "Aplicare în masă",             desc: "Trimite oferte la mai multe oportunități deodată." },
  { key: "advanced_analytics",   tier: "verified", icon: BarChart3, label: "Analytics business",           desc: "Vezi conversion rate, rating mediu, evoluția veniturilor." },
  { key: "export_data",          tier: "verified", icon: FileDown,  label: "Export raport venituri",       desc: "Exportă raport financiar lunar în Excel." },
  { key: "priority_support",     tier: "pro",      icon: Crown,     label: "Support prioritar",            desc: "Suport dedicat 24/7 pentru cazuri urgente." },
  { key: "white_label_reports",  tier: "pro",      icon: Layers3,   label: "Rapoarte white-label",         desc: "Generează rapoarte personalizate cu brand-ul tău." },
];

const TIER_HEADER_STYLE = {
  regular:  "bg-blue-500/5 border-blue-500/20",
  verified: "bg-emerald-500/5 border-emerald-500/20",
  pro:      "bg-violet-500/5 border-violet-500/20",
};
const TIER_DOT = {
  regular:  "bg-blue-400",
  verified: "bg-emerald-400",
  pro:      "bg-violet-400",
};

export const TierToolsPanel = ({ role = "client" }) => {
  const { tier, tierLabel, meetsTier } = useTier();
  const [expanded, setExpanded] = useState(true);
  const tools = role === "specialist" ? SPECIALIST_TOOLS : CLIENT_TOOLS;

  const unlocked = tools.filter(t => meetsTier(t.tier));
  const locked = tools.filter(t => !meetsTier(t.tier));

  // Group locked by required tier (for sectioned upgrade hints)
  const lockedByTier = locked.reduce((acc, t) => {
    (acc[t.tier] = acc[t.tier] || []).push(t);
    return acc;
  }, {});

  const handleDemo = (tool) => {
    alert(
      `🎯 "${tool.label}"\n\n${tool.desc}\n\nÎn produsul final, această acțiune va deschide funcția. ` +
      `Momentan e DEMO ca să poți testa progresia tier-urilor în siguranță.`
    );
  };

  return (
    <div className="bg-[#0e0e10] border border-white/10 rounded-2xl p-5 mb-6" data-testid={`tier-tools-${role}`}>
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between mb-3 group"
        data-testid="tier-tools-toggle"
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-amber-300" />
          </div>
          <div className="text-left">
            <div className="text-sm font-semibold text-white">Unelte avansate</div>
            <div className="text-[10px] text-stone-500">
              Nivel actual: <strong className="text-amber-300">{tierLabel}</strong>
              {" · "}
              <span className="text-emerald-400">{unlocked.length} deblocate</span>
              {locked.length > 0 && <span className="text-stone-500"> · {locked.length} blocate</span>}
            </div>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-stone-500" /> : <ChevronDown className="w-4 h-4 text-stone-500" />}
      </button>

      {expanded && (
        <>
          {/* UNLOCKED tools */}
          {unlocked.length > 0 && (
            <div className="mb-4">
              <div className="text-[10px] uppercase tracking-wider text-emerald-400 mb-2 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Deblocate pentru tine
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {unlocked.map(t => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.key}
                      onClick={() => handleDemo(t)}
                      className="bg-white/[0.02] hover:bg-white/[0.04] border border-white/10 rounded-xl p-3 text-left transition-colors"
                      data-testid={`tier-tool-unlocked-${t.key}`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className="w-3.5 h-3.5 text-emerald-300" />
                        <span className="text-sm font-medium text-white">{t.label}</span>
                      </div>
                      <div className="text-[11px] text-stone-400">{t.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* LOCKED tools grouped by required tier */}
          {Object.entries(lockedByTier).map(([reqTier, toolsList]) => (
            <div key={reqTier} className={`mb-3 rounded-xl border p-3 ${TIER_HEADER_STYLE[reqTier] || "border-white/10"}`} data-testid={`tier-tools-locked-${reqTier}`}>
              <div className="flex items-center gap-1.5 mb-2">
                <span className={`w-1.5 h-1.5 rounded-full ${TIER_DOT[reqTier]}`}></span>
                <span className="text-[10px] uppercase tracking-wider text-stone-300">
                  Deblochezi la nivel <strong className="text-white">{TIER_LABEL[reqTier]}</strong>
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {toolsList.map(t => {
                  const Icon = t.icon;
                  return (
                    <div
                      key={t.key}
                      className="bg-black/30 border border-white/5 rounded-lg p-3 relative opacity-70"
                      data-testid={`tier-tool-locked-${t.key}`}
                    >
                      <Lock className="w-3 h-3 absolute top-2 right-2 text-stone-500" />
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className="w-3.5 h-3.5 text-stone-500" />
                        <span className="text-sm font-medium text-stone-300">{t.label}</span>
                      </div>
                      <div className="text-[11px] text-stone-500">{t.desc}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Encouragement if everything is unlocked */}
          {locked.length === 0 && (
            <div className="bg-violet-500/10 border border-violet-500/30 rounded-xl p-3 text-xs text-violet-100 mt-2" data-testid="tier-tools-all-unlocked">
              🎉 Felicitări — ai deblocat toate uneltele disponibile la nivelul <strong>{tierLabel}</strong>.
            </div>
          )}
        </>
      )}

      {/* Tier definition tip — small footer */}
      <div className="mt-3 pt-3 border-t border-white/5 text-[10px] text-stone-500 italic">
        Promovarea la următorul nivel se face automat când îndeplinești criteriile de activitate. Vezi progresul în profilul tău.
      </div>
    </div>
  );
};

export default TierToolsPanel;
