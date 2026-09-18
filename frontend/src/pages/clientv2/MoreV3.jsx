// MAI MULT — tot ce nu e zilnic: Beneficii · Plăți & portofel · Cont & setări · Copilot detalii · Explorează.
// Pe mobil: pagină cu rânduri mari (o mână). Pe desktop: aceleași blocuri în două coloane.
import React, { useState } from "react";
import axios from "axios";
import { Gift, Wallet, Shield, LogOut, ChevronRight, BadgeCheck, Palette, Settings, Sparkles, CreditCard, ArrowLeft } from "lucide-react";
import { Card, Overline, H2, Primary, Secondary, Chip, Row, Bar, Fold } from "./ui3";
import { Sheet, AmountInput } from "./ui";
import { ExploreMore } from "./HomeV3";
import { API } from "../DashShared";
import { formatApiError } from "../../auth";
import { useTheme } from "../../contexts/ThemeContext";
import { ReferralHub } from "../../components/ReferralHub";
import { BetaFeedbackEntry } from "../../components/BetaFeedbackWidget";
import { SettingsPanel } from "../SettingsPanel";
import { PropBenefitsHub } from "../../components/PropBenefitsHub";
import { HouseCopilot } from "../../components/copilot/HouseCopilot";

const topupCheckout = (amt, setBusy) => {
  if (!amt || amt <= 0 || amt > 50000) return alert("Sumă invalidă (1-50.000 RON)");
  setBusy(true);
  axios.post(`${API}/wallet/topup-checkout-session`, { amount: amt, origin: window.location.origin })
    .then(({ data }) => { window.location.href = data.checkout_url; })
    .catch((e) => { alert(formatApiError(e)); setBusy(false); });
};

export const WalletSheet = ({ user, onClose }) => {
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Sheet title="Plăți & Portofel" onClose={onClose} testid="v2-wallet-sheet">
      <div className="rounded-3xl p-5 text-black" style={{ background: "linear-gradient(135deg, #a3e635 0%, #d4ff3a 100%)" }}>
        <div className="text-[10px] font-bold uppercase tracking-wider text-black/60">Sold disponibil</div>
        <div className="mt-1 text-3xl font-black" data-testid="v2-wallet-balance">{(user?.wallet_balance ?? 0).toFixed(2)} RON</div>
        {user?.tokens != null && <div className="mt-1 text-[11px] text-black/60">{user.tokens} tokeni</div>}
      </div>
      <h3 className="mt-5 text-[11px] font-black uppercase tracking-wider text-slate-400">Alimentează (Stripe)</h3>
      <div className="mt-2 grid grid-cols-4 gap-2">
        {[100, 250, 500, 1000].map(p => (
          <button type="button" key={p} onClick={() => topupCheckout(p, setBusy)} disabled={busy} data-testid={`v2-topup-${p}`}
            className="py-2.5 rounded-full border-2 border-slate-200 text-xs font-bold text-slate-700 disabled:opacity-50">+{p}</button>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <AmountInput value={amount} onChange={setAmount} placeholder="Altă sumă (RON)"
          className="flex-1 px-4 py-3 rounded-full border-2 border-slate-200 text-sm outline-none focus:border-[#34C759]" data-testid="v2-topup-custom" />
        <button type="button" onClick={() => topupCheckout(parseFloat(amount), setBusy)} disabled={busy || !amount} data-testid="v2-topup-custom-btn"
          className="px-5 rounded-full text-sm font-bold text-black disabled:opacity-50" style={{ background: "#d4ff3a" }}>
          {busy ? "…" : "Plătește"}
        </button>
      </div>
      <p className="mt-3 text-[11px] text-slate-400 flex items-start gap-1.5"><CreditCard className="w-3.5 h-3.5 shrink-0 mt-0.5" />Plățile către specialiști sunt protejate prin escrow: banii se eliberează doar după ce confirmi lucrarea.</p>
    </Sheet>
  );
};

const Benefits = ({ d, go, act }) => {
  const b = d.copilot?.benefits; const mem = d.copilot?.progress?.membership; const w = d.wallet; const sub = d.copilot?.subscription;
  const active = d.plan?.subscription_active || sub?.active;
  return (
    <Card tid="v3-more-benefits">
      <div className="flex items-center gap-3"><span className="w-11 h-11 rounded-2xl bg-slate-900 flex items-center justify-center shrink-0"><Gift className="w-5 h-5 text-[#ccff00]" /></span><div className="flex-1"><H2>Beneficiile mele</H2><p className="text-xs text-slate-500 mt-0.5">{b?.available ?? 0} active · {b?.used ?? w?.counts?.used ?? 0} folosite{b?.available_value ? ` · ≈ ${b.available_value} RON disponibili` : ""}</p></div></div>
      <div className="mt-4 rounded-2xl bg-slate-50 p-3.5">
        <div className="flex items-center gap-2 flex-wrap"><Chip tone="dark"><BadgeCheck className="w-3 h-3" /> {mem?.level?.name || "Explorer"}</Chip><span className="text-xs text-slate-500">{mem?.points ?? 0} puncte</span><span className="ml-auto text-xs text-slate-500" data-testid="pb-plan-status">{active ? "House Health activ" : "Plan gratuit"}</span></div>
        {mem?.next_level ? <><div className="mt-2"><Bar pct={Math.min(100, (mem.points / mem.next_level.min_points) * 100)} /></div><div className="text-[11px] text-slate-500 mt-1">Încă {mem.next_level.points_needed} puncte până la <b>{mem.next_level.name}</b></div></> : <div className="text-[11px] text-slate-500 mt-2">Nivel maxim atins{mem?.level?.perks?.length ? ` — ${mem.level.perks.join(" · ")}` : ""}</div>}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2"><Primary className="text-xs" onClick={() => go("more", "beneficii")} tid="v2-set-benefits">Vezi beneficiile</Primary><Secondary className="text-xs" onClick={() => act("hhUpgrade")} tid="pb-plan-cta">{active ? "Abonamentul meu" : "Vezi planurile"}</Secondary></div>
    </Card>
  );
};

const WalletCard = ({ user, act }) => {
  const [busy, setBusy] = useState(false);
  return (
    <Card tid="v3-more-wallet">
      <div className="flex items-center gap-3"><span className="w-11 h-11 rounded-2xl bg-slate-50 flex items-center justify-center shrink-0"><Wallet className="w-5 h-5 text-[#166534]" /></span><div className="flex-1"><H2>Plăți & portofel</H2><p className="text-xs text-slate-500 mt-0.5">Plățile către specialiști sunt protejate (escrow): banii se eliberează doar după ce confirmi lucrarea.</p></div></div>
      <div className="mt-4 flex items-end gap-2"><span className="xos-num text-4xl leading-none text-slate-900" data-testid="v3-wallet-balance">{(user?.wallet_balance ?? 0).toLocaleString("ro-RO")}</span><span className="text-sm font-bold text-slate-400 mb-1">RON disponibili</span>{user?.tokens != null && <Chip tone="slate" className="ml-auto mb-1">{user.tokens} tokeni</Chip>}</div>
      <div className="mt-3 grid grid-cols-4 gap-2">{[100, 250, 500, 1000].map(p => <Secondary key={p} className="!min-h-[40px] text-xs" disabled={busy} onClick={() => topupCheckout(p, setBusy)} tid={`v2-topup-${p}`}>+{p}</Secondary>)}</div>
      <Secondary className="mt-2" full onClick={() => act("wallet")} tid="v2-hub-wallet">Altă sumă / detalii portofel <ChevronRight className="w-4 h-4" /></Secondary>
    </Card>
  );
};

export const MoreV3 = ({ d, user, go, act, section, prop }) => {
  const { isDark, toggleTheme } = useTheme();
  const [adv, setAdv] = useState(false);
  const [copilot, setCopilot] = useState(false);
  if (section === "beneficii") {
    return (
      <div data-testid="v2-benefits-view">
        <div className="px-5 lg:px-0 mb-2"><button type="button" onClick={() => go("more")} className="inline-flex items-center gap-1 min-h-[40px] text-xs font-bold text-slate-500" data-testid="v3-benefits-back"><ArrowLeft className="w-4 h-4" /> Mai mult</button></div>
        <PropBenefitsHub />
      </div>
    );
  }
  const openKeys = section && section !== "beneficii" ? { [section]: true } : undefined;
  return (
    <div className="px-5 lg:px-0 space-y-4 lg:grid lg:grid-cols-2 lg:gap-5 lg:space-y-0 lg:items-start" data-testid="v2-settings-view">
      <div className="space-y-4">
        <Benefits d={d} go={go} act={act} />
        <WalletCard user={user} act={act} />
        <Card tid="v3-more-settings">
          <Overline>Cont & setări</Overline>
          <div className="mt-2 space-y-1.5">
            <ReferralHub variant="light" />
            <BetaFeedbackEntry light />
            <Row icon={Shield} title="Securitate (2FA)" sub="protejează contul cu un cod suplimentar" onClick={() => act("2fa")} tid="v2-set-2fa" />
            <Row icon={Palette} title="Aspect" sub={isDark ? "temă întunecată · apasă pentru cea deschisă" : "temă deschisă · apasă pentru cea întunecată"} onClick={toggleTheme} tid="v3-more-theme" />
            <Row icon={Settings} title="Setări avansate" sub="notificări, date, consimțăminte" onClick={() => setAdv(v => !v)} tid="v3-more-advanced" chevron={false} right={<span className="text-[11px] font-bold text-slate-400">{adv ? "Ascunde" : "Deschide"}</span>} />
            {adv && <div className="rounded-3xl bg-stone-900 p-4" data-testid="v2-settings-legacy-panel"><SettingsPanel /></div>}
          </div>
          <button type="button" onClick={() => act("logout")} data-testid="v2-logout" className="mt-3 w-full min-h-[44px] rounded-full border border-rose-100 text-sm font-bold text-rose-500 bg-white flex items-center justify-center gap-2"><LogOut className="w-4 h-4" /> Deconectare</button>
          <p className="text-center text-[10px] text-slate-300 pt-3">PropManage · Client Beta</p>
        </Card>
      </div>
      <div className="space-y-4">
        <ExploreMore d={d} go={go} act={act} forceOpen openKeys={openKeys} />
        {prop && (
          <Fold icon={Sparkles} title="Copilotul casei · detalii complete" summary="checklist, progres, comunitate, stocare, abonament, istoric" open={copilot} onToggle={() => setCopilot(v => !v)} tid="v3-fold-copilot">
            <div className="-mx-5 -mt-5 lg:mx-0 lg:mt-0"><HouseCopilot go={go} completeness={d.completeness} propName={prop.name} /></div>
          </Fold>
        )}
      </div>
    </div>
  );
};
