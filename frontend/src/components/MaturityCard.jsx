// Maturity Card — visual indicator of specialist's progression tier + next unlock.
import React, { useEffect, useState } from "react";
import axios from "axios";
import { Zap, Lock, TrendingUp, Award } from "lucide-react";
import { API } from "../pages/DashShared";

const TIER_META = {
  beginner:     { label: "Începător",   color: "stone",   icon: Zap,        next: "Intermediat" },
  intermediate: { label: "Intermediar", color: "cyan",    icon: TrendingUp, next: "Avansat" },
  advanced:     { label: "Avansat",     color: "emerald", icon: Award,      next: null },
};

export const MaturityCard = () => {
  const [data, setData] = useState(null);
  useEffect(() => {
    axios.get(`${API}/ux/me/maturity`).then((r) => setData(r.data)).catch(() => {});
  }, []);

  if (!data || data.role !== "specialist") return null;
  const meta = TIER_META[data.maturity_level] || TIER_META.beginner;
  const Icon = meta.icon;
  const colorMap = {
    stone:   { bg: "bg-stone-800",      text: "text-stone-300",   ring: "ring-stone-700" },
    cyan:    { bg: "bg-cyan-500/15",    text: "text-cyan-300",    ring: "ring-cyan-500/40" },
    emerald: { bg: "bg-emerald-500/15", text: "text-emerald-300", ring: "ring-emerald-500/40" },
  }[meta.color];

  return (
    <div className="bg-stone-900/40 border border-stone-800 rounded-2xl p-4 mb-4" data-testid="maturity-card">
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-10 h-10 rounded-xl ${colorMap.bg} ${colorMap.text} flex items-center justify-center ring-1 ${colorMap.ring}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <div className="text-[10px] uppercase tracking-wider text-stone-500 font-bold">Nivel cont</div>
          <div className={`text-base font-bold ${colorMap.text}`}>{meta.label}</div>
        </div>
        {data.override_active && (
          <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-300">
            override admin
          </span>
        )}
      </div>

      {data.next_unlock && (
        <div className="mt-2 pt-2 border-t border-stone-800">
          <div className="text-[10px] uppercase tracking-wider text-stone-500 font-bold mb-1 inline-flex items-center gap-1">
            <Lock className="w-3 h-3" /> Următorul nivel: {data.next_unlock.target === "intermediate" ? "Intermediar" : "Avansat"}
          </div>
          <div className="text-xs text-stone-300">{data.next_unlock.criteria}</div>
          {data.next_unlock.progress && (
            <div className="mt-1.5 flex flex-wrap gap-3 text-[11px]">
              {Object.entries(data.next_unlock.progress).map(([k, v]) => (
                <div key={k} className="text-stone-400">
                  <span className="text-stone-500">{k.replaceAll("_", " ")}:</span>{" "}
                  <span className="text-stone-200 font-bold tabular-nums">{String(v)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
        <div className="bg-stone-800/40 rounded px-2 py-1.5">
          <div className="text-stone-500">Lead-uri acceptate</div>
          <div className="text-stone-100 font-bold tabular-nums">{data.counters.leads_accepted}</div>
        </div>
        <div className="bg-stone-800/40 rounded px-2 py-1.5">
          <div className="text-stone-500">Lucrări finalizate</div>
          <div className="text-stone-100 font-bold tabular-nums">{data.counters.leads_completed}</div>
        </div>
      </div>
    </div>
  );
};

export default MaturityCard;
