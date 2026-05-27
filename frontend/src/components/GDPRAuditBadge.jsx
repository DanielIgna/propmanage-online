// GDPR Audit Trust Badge — Phase 49 Part F.
// Compact verified-credential pill linking to public privacy notices page.
// Two variants: "hero" (light glass on dark) and "footer" (subdued inline).
import React from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, CheckCircle2 } from "lucide-react";

export const GDPRAuditBadge = ({ variant = "hero", className = "" }) => {
  if (variant === "footer") {
    return (
      <Link
        to="/privacy/notices"
        className={`inline-flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-300 transition-colors ${className}`}
        data-testid="gdpr-badge-footer"
      >
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
        <span>GDPR Audit · Feb 2026</span>
      </Link>
    );
  }

  // hero variant: prominent glass pill with verified mark
  return (
    <Link
      to="/privacy/notices"
      className={`group inline-flex items-center gap-2.5 pl-2 pr-3.5 py-1.5 rounded-full bg-white/[0.04] backdrop-blur border border-emerald-500/20 hover:border-emerald-400/40 hover:bg-emerald-500/[0.06] transition-all ${className}`}
      data-testid="gdpr-badge-hero"
    >
      <span className="relative inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/15 ring-1 ring-emerald-400/30">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" strokeWidth={2.5} />
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-[10px] uppercase tracking-[0.16em] text-emerald-300/80 font-semibold">GDPR Audit Passed</span>
        <span className="text-[11px] text-stone-300 -mt-0.5">Februarie 2026 · DPO verified</span>
      </span>
      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 opacity-60 group-hover:opacity-100 transition-opacity" />
    </Link>
  );
};

export default GDPRAuditBadge;
