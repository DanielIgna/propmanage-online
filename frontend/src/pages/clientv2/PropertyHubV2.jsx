import React, { useState } from "react";
import axios from "axios";
import { Building2, Box, HeartPulse, Clock, Wallet, Settings2, CreditCard } from "lucide-react";
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
