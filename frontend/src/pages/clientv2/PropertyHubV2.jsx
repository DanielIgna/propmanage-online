import React, { useState, useEffect } from "react";
import axios from "axios";
import { Building2, Box, HeartPulse, Clock, Wallet, Settings2, CreditCard, Dna, Fingerprint, Wrench, FileText, Share2, CalendarClock, Radio, Sparkles } from "lucide-react";
import { API } from "../DashShared";
import { formatApiError } from "../../auth";
import { GREEN, GREEN_SOFT, ListItem, Sheet, CTA, AmountInput } from "./ui";

export const WalletSheet = ({ user, onClose }) => {
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const topup = (val) => {
    const amt = parseFloat(val || amount);
    if (!amt || amt <= 0 || amt > 50000) return alert("Sumă invalidă (1-50.000 RON)");
    setBusy(true);
    axios.post(`${API}/wallet/topup-checkout-session`, { amount: amt, origin: window.location.origin })
      .then(({ data }) => { window.location.href = data.checkout_url; })
      .catch((e) => { alert(formatApiError(e)); setBusy(false); });
  };
  return (
    <Sheet title="Plăți & Portofel" onClose={onClose} testid="v2-wallet-sheet">
      <div className="rounded-3xl p-5 text-black" style={{ background: "linear-gradient(135deg, #a3e635 0%, #d4ff3a 100%)" }}>
        <div className="text-[10px] font-bold uppercase tracking-wider text-white/80">Sold disponibil</div>
        <div className="mt-1 text-3xl font-black" data-testid="v2-wallet-balance">{(user?.wallet_balance ?? 0).toFixed(2)} RON</div>
        {user?.tokens != null && <div className="mt-1 text-[11px] text-white/80">{user.tokens} tokeni</div>}
      </div>
      <h3 className="mt-5 text-[11px] font-black uppercase tracking-wider text-slate-400">Alimentează (Stripe)</h3>
      <div className="mt-2 grid grid-cols-4 gap-2">
        {[100, 250, 500, 1000].map(p => (
          <button key={p} onClick={() => topup(p)} disabled={busy} data-testid={`v2-topup-${p}`}
            className="py-2.5 rounded-full border-2 border-slate-200 text-xs font-bold text-slate-700 disabled:opacity-50">+{p}</button>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <AmountInput value={amount} onChange={setAmount} placeholder="Altă sumă (RON)"
          className="flex-1 px-4 py-3 rounded-full border-2 border-slate-200 text-sm outline-none focus:border-[#34C759]" data-testid="v2-topup-custom" />
        <button onClick={() => topup()} disabled={busy || !amount} data-testid="v2-topup-custom-btn"
          className="px-5 rounded-full text-sm font-bold text-black disabled:opacity-50" style={{ background: "#d4ff3a" }}>
          {busy ? "…" : "Plătește"}
        </button>
      </div>
      <p className="mt-3 text-[11px] text-slate-400 flex items-start gap-1.5"><CreditCard className="w-3.5 h-3.5 shrink-0 mt-0.5" />Plățile către specialiști sunt protejate prin escrow: banii se eliberează doar după ce confirmi lucrarea.</p>
    </Sheet>
  );
};

const CAPS = {
  identity: ["Identitate", Fingerprint],
  health: ["Sănătate", HeartPulse],
  twin: ["Digital Twin", Box],
  works: ["Lucrări", Wrench],
  financial: ["Financiar", Wallet],
  documents: ["Documente", FileText],
  relations: ["Relații", Share2],
  maintenance: ["Mentenanță", CalendarClock],
  sensors: ["Senzori", Radio],
  recommendations: ["Recomandări AI", Sparkles],
};

const timeAgo = (iso) => {
  if (!iso) return "";
  const d = new Date(iso); const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days <= 0) return "azi"; if (days === 1) return "ieri"; if (days < 30) return `acum ${days} zile`;
  return d.toLocaleDateString("ro-RO", { day: "numeric", month: "short", year: "numeric" });
};

// Cartea Casei — proiecția Property DNA + PVI (Board Decision 002 / Value Loop)
const PropertyDnaCard = ({ propId }) => {
  const [dna, setDna] = useState(null);
  useEffect(() => {
    setDna(null);
    axios.get(`${API}/properties/${propId}/dna`).then(r => setDna(r.data)).catch(() => {});
  }, [propId]);
  if (!dna) return null;
  const pvi = dna.pvi || {};
  return (
    <div className="mt-4 rounded-3xl border border-slate-100 bg-white shadow-sm p-4" data-testid="dna-card">
      <div className="flex items-center gap-2.5">
        <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-[#ccff00]">
          <Dna className="w-4.5 h-4.5 text-black" style={{ width: 18, height: 18 }} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-black text-slate-900 leading-none xos-display tracking-tight">Cartea Casei</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Property Value Index · valoarea documentată a locuinței</div>
        </div>
        <div className="text-right">
          <div className="xos-num text-4xl leading-none text-slate-900" data-testid="pvi-score">
            {pvi.score ?? 0}<span className="text-sm text-slate-400 font-semibold">/100</span>
          </div>
          {pvi.delta_6m > 0 && (
            <div className="text-[10px] font-black text-[#166534]" data-testid="pvi-delta">+{pvi.delta_6m} puncte · 6 luni</div>
          )}
        </div>
      </div>
      <div className="mt-3 h-1.5 rounded-full bg-slate-100" role="progressbar" aria-valuenow={pvi.score ?? 0} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-[#ccff00] transition-all duration-500" style={{ width: `${pvi.score ?? 0}%` }} />
      </div>
      {pvi.reasons?.length > 0 && (
        <div className="mt-3 space-y-1.5" data-testid="pvi-reasons">
          {pvi.reasons.map((r) => (
            <div key={r.key} className="flex items-center gap-2" data-testid={`pvi-reason-${r.key}`}>
              <span className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${r.done ? "bg-[#ccff00]" : "bg-slate-100"}`}>
                <Check className={`w-2.5 h-2.5 ${r.done ? "text-black" : "text-slate-300"}`} strokeWidth={3.5} />
              </span>
              <span className={`text-xs ${r.done ? "font-semibold text-slate-700" : "text-slate-400"}`}>{r.label}</span>
              <span className="ml-auto text-[10px] font-mono text-slate-400">{r.points}/{r.max}</span>
            </div>
          ))}
        </div>
      )}
      <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap gap-1.5" data-testid="dna-capabilities">
        {Object.entries(CAPS).map(([key, [label, Icon]]) => {
          const on = dna.capabilities?.[key]?.populated;
          return (
            <span key={key} data-testid={`dna-cap-${key}`}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold ${
                on ? "bg-[#166534]/5 text-[#166534]" : "bg-slate-50 text-slate-300"}`}>
              <Icon className="w-3 h-3" aria-hidden="true" />{label}
            </span>
          );
        })}
      </div>
      <div className="mt-1.5 text-[10px] text-slate-400" data-testid="dna-completeness">Profil digital {dna.dna_completeness}% complet</div>
      {dna.timeline?.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-100" data-testid="dna-timeline">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Ultimele evenimente</div>
          <div className="mt-2 space-y-2">
            {dna.timeline.slice(0, 5).map((ev, i) => (
              <div key={i} className="flex items-start gap-2.5" data-testid={`dna-timeline-item-${i}`}>
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 bg-[#166534]" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-slate-700 leading-snug truncate">{ev.title}</div>
                  <div className="text-[10px] text-slate-400">{timeAgo(ev.timestamp)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <p className="mt-3 text-[10px] text-slate-400">Fiecare lucrare finalizată prin PropManage adaugă automat garanții, documentație și puncte de valoare Cărții Casei.</p>
    </div>
  );
};

export const PropertyHubV2 = ({ user, prop, properties, setSelectedPropId, actions }) => {
  if (!prop) {
    return (
      <div className="px-6 py-16 text-center" data-testid="v2-property-empty">
        <Building2 className="w-10 h-10 mx-auto text-slate-300" />
        <h2 className="mt-3 text-lg font-black text-slate-900">Nicio proprietate încă</h2>
        <p className="mt-1 text-sm text-slate-400">Adaugă prima proprietate ca să deblochezi instrumentele.</p>
        <div className="mt-5 max-w-[240px] mx-auto"><CTA testid="v2-prop-empty-cta" onClick={actions.openPropManager}>Adaugă proprietatea</CTA></div>
      </div>
    );
  }
  return (
    <div className="px-5 pb-8 cv2-fade" data-testid="v2-property-view">
      <div className="rounded-3xl overflow-hidden border border-slate-100 bg-white shadow-sm">
        <div className="h-24 flex items-center justify-center" style={{ background: "linear-gradient(135deg, #E9F9EE 0%, #D2F2DC 100%)" }}>
          <Building2 className="w-9 h-9" style={{ color: GREEN }} />
        </div>
        <div className="p-4">
          <div className="flex items-center gap-2">
            <div className="text-lg font-black text-slate-900 flex-1">{prop.name}</div>
            {properties.length > 1 && (
              <select value={prop.id} onChange={e => setSelectedPropId(e.target.value)} data-testid="v2-prop-selector"
                className="text-[11px] font-bold border-2 border-slate-200 rounded-full px-2 py-1 bg-white text-slate-600">
                {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
          </div>
          {prop.address && <div className="mt-0.5 text-[11px] text-slate-400">{prop.address}</div>}
        </div>
      </div>
      <PropertyDnaCard propId={prop.id} />
      <div className="mt-4 space-y-2">
        <ListItem icon={Box} label="Digital Twin" sub="locuința ta în 3D" onClick={actions.openTwin} testid="v2-hub-twin" />
        <ListItem icon={HeartPulse} label="House Health" sub="scor + recomandări" onClick={actions.openHealth} testid="v2-hub-health" />
        <ListItem icon={Clock} label="Timeline" sub="istoricul proprietății" onClick={actions.openPropTimeline} testid="v2-hub-timeline" />
        <ListItem icon={Wallet} label="Plăți & Portofel" sub={`sold ${(user?.wallet_balance ?? 0).toFixed(0)} RON`} onClick={actions.openWallet} testid="v2-hub-wallet" />
        <ListItem icon={Settings2} label="Administrează proprietățile" sub="adaugă, editează, fotografii" onClick={actions.openPropManager} testid="v2-hub-manage" muted />
      </div>
    </div>
  );
};
