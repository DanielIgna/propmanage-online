// ServiceDetailModal — prezentarea completă Audit / Digital Twin / cele 17 etape.
// O singură sursă de adevăr: audit_full / twin_full / process_phases din /interior-design/content.
import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { X, Check, ClipboardCheck, Scan, Layers, ArrowRight } from "lucide-react";
import { EcosystemFlow } from "./EcosystemFlow";
import { useEcosystemContent } from "./useEcosystemContent";

const ICONS = { audit: ClipboardCheck, twin: Scan, process: Layers };

export const ServiceDetailModal = ({ kind, dark = false, onClose, primaryCta = null }) => {
  const content = useEcosystemContent();
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [onClose]);

  if (!kind) return null;
  const Icon = ICONS[kind] || Layers;
  const panel = dark ? "bg-[#0e0e10] border-white/10 text-white" : "bg-white border-stone-200 text-stone-900";
  const sub = dark ? "text-stone-400" : "text-stone-500";
  const card = dark ? "bg-white/5 border-white/10" : "bg-stone-50 border-stone-100";
  const check = dark ? "text-[#d4ff3a]" : "text-emerald-700";
  const accent = dark ? "text-[#d4ff3a]" : "text-emerald-800";

  const data = kind === "audit" ? content?.audit_full : kind === "twin" ? content?.twin_full : null;
  const phases = kind === "process" ? content?.process_phases : null;
  const title = kind === "process" ? "Un singur proces. 17 etape. Zero improvizație." : data?.title;

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur flex items-center justify-center p-4" onClick={onClose} data-testid={`service-detail-modal-${kind}`}>
      <div onClick={(e) => e.stopPropagation()} className={`${panel} border rounded-3xl max-w-3xl w-full p-6 sm:p-8 max-h-[88vh] overflow-y-auto`}>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${dark ? "bg-[#d4ff3a]/15" : "bg-emerald-50"}`}>
              <Icon className={`w-5 h-5 ${accent}`} />
            </div>
            <h3 className="text-xl sm:text-2xl font-black leading-tight">{!content ? "Se încarcă…" : title}</h3>
          </div>
          <button onClick={onClose} className={`${sub} hover:opacity-70 shrink-0`} data-testid="service-detail-close" aria-label="Închide">
            <X className="w-5 h-5" />
          </button>
        </div>

        {data && (
          <>
            <p className={`text-sm leading-relaxed mb-6 ${sub}`}>{data.intro}</p>
            <div className="grid sm:grid-cols-2 gap-4">
              {data.groups.map((g, gi) => (
                <div key={gi} className={`p-4 rounded-2xl border ${card}`} data-testid={`detail-group-${gi}`}>
                  <div className={`text-xs font-black uppercase tracking-wider mb-2.5 ${accent}`}>{g.name}</div>
                  <ul className="space-y-1.5">
                    {g.items.map((it, ii) => (
                      <li key={ii} className="flex items-start gap-2 text-sm">
                        <Check className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${check}`} />
                        <span>{it}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <p className={`text-sm font-semibold mt-6 ${accent}`}>{data.outro}</p>
          </>
        )}

        {phases && (
          <div className="space-y-6">
            {phases.map((ph, pi) => (
              <div key={pi} data-testid={`detail-phase-${pi}`}>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className={`text-[10px] font-black uppercase tracking-widest ${accent}`}>Faza {pi + 1}</span>
                  <span className="font-black text-sm">{ph.phase}</span>
                </div>
                <div className="grid sm:grid-cols-2 gap-2">
                  {ph.steps.map((s) => (
                    <div key={s.n} className={`p-3 rounded-2xl border ${card}`}>
                      <div className="text-sm font-bold">{String(s.n).padStart(2, "0")} · {s.title}</div>
                      <p className={`text-xs mt-0.5 ${sub}`}>{s.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className={`mt-7 pt-5 border-t ${dark ? "border-white/10" : "border-stone-100"}`}>
          <EcosystemFlow dark={dark} compact activeKey={kind === "audit" ? "audit" : kind === "twin" ? "twin" : null} />
          <div className="flex flex-wrap gap-3 mt-5">
            {primaryCta && (
              <button onClick={() => { primaryCta.onClick(); onClose(); }}
                className={`px-5 py-2.5 rounded-full text-sm font-bold ${dark ? "bg-[#d4ff3a] text-black hover:opacity-90" : "bg-emerald-700 text-white hover:bg-emerald-800"}`}
                data-testid="service-detail-primary-cta">
                {primaryCta.label}
              </button>
            )}
            <Link to="/design-interior#proces" onClick={onClose}
              className={`px-5 py-2.5 rounded-full text-sm font-bold border inline-flex items-center gap-1.5 ${dark ? "border-white/20 text-stone-200 hover:border-white/50" : "border-stone-200 text-stone-700 hover:border-emerald-500"}`}
              data-testid="service-detail-process-link">
              Vezi procesul complet <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
