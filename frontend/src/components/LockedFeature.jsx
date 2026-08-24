/**
 * LockedFeature — card reutilizabil pentru feature-uri gated.
 *
 * Uz:
 *   <LockedFeature featureId="house_health_basic" title="..." description="...">
 *     ...conținut care se afișează dacă user-ul are entitlement
 *   </LockedFeature>
 *
 * Sau ca overlay simplu:
 *   <LockedFeature featureId="..." mode="compact" />
 */
import React from "react";
import { Lock, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEntitlements } from "../hooks/useEntitlements";

const DEFAULT_TITLE = "Disponibil în PropManage Basic";
const DEFAULT_DESC = "Activează abonamentul pentru a accesa această funcție.";
const DEFAULT_CTA = "Activează PropManage Basic";

export const LockedFeature = ({
  featureId,
  title = DEFAULT_TITLE,
  description = DEFAULT_DESC,
  ctaLabel = DEFAULT_CTA,
  ctaHref = "/pricing",
  mode = "full", // full | compact
  children,
  testid,
}) => {
  const { entitlements, loading, hasFeature } = useEntitlements();
  const navigate = useNavigate();

  // în timpul încărcării, arătăm children (evită FOUC pe user-i cu acces)
  if (loading) return <>{children}</>;
  if (hasFeature(featureId)) return <>{children}</>;

  const tierLabel = entitlements?.tier_label || "Gratuit";

  const goPricing = () => {
    try { navigate(ctaHref); }
    catch { window.location.href = ctaHref; }
  };

  if (mode === "compact") {
    return (
      <div data-testid={testid || `locked-${featureId}`}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-[11px] font-bold text-amber-800">
        <Lock className="w-3.5 h-3.5" />
        <span>{title}</span>
        <button onClick={goPricing} className="ml-1 text-amber-900 underline"
          data-testid={`locked-${featureId}-cta-compact`}>
          {ctaLabel}
        </button>
      </div>
    );
  }

  return (
    <div data-testid={testid || `locked-${featureId}`}
      className="rounded-3xl border-2 border-dashed border-amber-200 bg-gradient-to-br from-amber-50 to-white p-6">
      <div className="flex items-start gap-3">
        <span className="w-11 h-11 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0">
          <Lock className="w-5 h-5 text-amber-700" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">
            {tierLabel} · Funcție blocată
          </div>
          <div className="mt-0.5 text-base font-black text-slate-900 leading-tight">{title}</div>
          <div className="mt-1 text-[12px] text-slate-600">{description}</div>
          <button onClick={goPricing}
            data-testid={`locked-${featureId}-cta`}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-black text-black hover:opacity-90"
            style={{ background: "#d4ff3a" }}>
            <Sparkles className="w-3.5 h-3.5" /> {ctaLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LockedFeature;
