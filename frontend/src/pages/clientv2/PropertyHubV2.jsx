import React, { useState, useEffect } from "react";
import axios from "axios";
import { Building2, Box, HeartPulse, Clock, Wallet, Settings2, CreditCard, Dna, Fingerprint, Wrench, FileText, Share2, CalendarClock, Radio, Sparkles, Check, Gauge, Layers, Plus, ShieldCheck } from "lucide-react";
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

// ── GI-5P Sprint 1 — Twin Maturity L0-L5 (Audit First, Directiva 014) ─────────
const CONF_LABELS = {
  verified: "Verificat", professional_audit: "Audit profesional", official_document: "Document oficial",
  owner_declared: "Declarat de proprietar", ai_estimated: "Estimat AI", unknown: "Necunoscut",
};
const EOL_META = {
  overdue: ["Depășit", "bg-rose-50 text-rose-700"],
  attention: ["Atenție", "bg-amber-50 text-amber-700"],
  monitor: ["Monitorizare", "bg-sky-50 text-sky-700"],
  ok: ["OK", "bg-emerald-50 text-emerald-700"],
  hypothesis: ["Ipoteză", "bg-slate-100 text-slate-500"],
};

const TwinMaturityCard = ({ propId, actions }) => {
  const [m, setM] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => {
    setM(null); setDone(false);
    axios.get(`${API}/properties/${propId}/maturity`).then(r => setM(r.data)).catch(() => {});
  }, [propId]);
  if (!m) return null;
  const runCta = async () => {
    const cta = m.next_step?.cta;
    if (cta === "audit") {
      if (m.audit_opportunity_id) {
        setBusy(true);
        try { await axios.post(`${API}/client/opportunities/${m.audit_opportunity_id}/accept`); setDone(true); }
        catch (e) { alert(formatApiError(e)); }
        setBusy(false);
      } else actions.openWizard?.();
    } else if (cta === "wizard") actions.openWizard?.();
    else if (cta === "edit_property") actions.openPropManager?.();
    else if (cta === "assets") document.querySelector('[data-testid="assets-card"]')?.scrollIntoView({ behavior: "smooth" });
  };
  return (
    <div className="mt-4 rounded-3xl border border-slate-100 bg-white shadow-sm p-4" data-testid="maturity-card">
      <div className="flex items-center gap-2.5">
        <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-slate-900">
          <Gauge className="text-[#ccff00]" style={{ width: 18, height: 18 }} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-black text-slate-900 leading-none xos-display tracking-tight">Twin Maturity</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Cât de viu este Digital Twin-ul casei tale</div>
        </div>
        <div className="text-right">
          <div className="xos-num text-3xl leading-none text-slate-900" data-testid="maturity-level">L{m.level}</div>
          <div className="text-[10px] font-black text-[#166534]" data-testid="maturity-level-label">{m.level_label}</div>
        </div>
      </div>
      <div className="mt-3 flex items-end gap-1" data-testid="maturity-ladder">
        {(m.levels || []).map((label, l) => (
          <div key={l} className="flex-1 min-w-0" data-testid={`maturity-step-${l}`}>
            <div className={`h-1.5 rounded-full ${l <= m.level ? "bg-[#ccff00]" : "bg-slate-100"}`} />
            <div className={`mt-1 text-[8px] font-bold text-center truncate ${l === m.level ? "text-slate-900" : "text-slate-300"}`}>L{l}</div>
          </div>
        ))}
      </div>
      {m.criteria?.length > 0 && (
        <div className="mt-3 space-y-1.5" data-testid="maturity-criteria">
          {m.criteria.map((c) => (
            <div key={c.level} className="flex items-center gap-2" data-testid={`maturity-criterion-${c.level}`}>
              <span className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${c.ok ? "bg-[#ccff00]" : "bg-slate-100"}`}>
                <Check className={`w-2.5 h-2.5 ${c.ok ? "text-black" : "text-slate-300"}`} strokeWidth={3.5} />
              </span>
              <span className={`text-xs ${c.ok ? "font-semibold text-slate-700" : "text-slate-400"}`}>L{c.level} · {c.label}</span>
              <span className="ml-auto text-[9px] text-slate-400 text-right">{c.hint}</span>
            </div>
          ))}
        </div>
      )}
      {m.next_step && !done && (
        <div className="mt-3 rounded-2xl p-3.5" style={{ background: "#F6FEE7" }} data-testid="maturity-next-step">
          <div className="text-xs font-black" style={{ color: "#0f172a" }}>{m.next_step.title}</div>
          <div className="mt-0.5 text-[11px] leading-snug" style={{ color: "#64748b" }}>{m.next_step.benefit}</div>
          {m.audit_first && (
            <div className="mt-1 text-[10px] font-bold text-[#166534]" data-testid="maturity-audit-first">
              Auditul Tehnic este punctul de intrare — deblochează restul serviciilor.
            </div>
          )}
          <button onClick={runCta} disabled={busy} data-testid="maturity-cta"
            className="mt-2.5 w-full py-2.5 rounded-full text-xs font-black text-black disabled:opacity-50"
            style={{ background: "#d4ff3a" }}>
            {busy ? "…" : m.next_step.cta_label}
          </button>
        </div>
      )}
      {done && (
        <div className="mt-3 rounded-2xl p-3.5 bg-emerald-50 text-xs font-bold text-emerald-700" data-testid="maturity-cta-success">
          ✓ Cererea de audit a fost creată — un specialist te va contacta în curând.
        </div>
      )}
    </div>
  );
};

// ── GI-5P Sprint 1 — Registru Active + Predictive actuarial (Trust Model 015) ─
const AssetSlot = ({ slot, propId, onSaved, onAudit }) => {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState("");
  const [source, setSource] = useState("owner_declared");
  const [busy, setBusy] = useState(false);
  const t = slot.asset_type;
  const eol = slot.eol;
  const save = async () => {
    setBusy(true);
    try {
      const { data } = await axios.post(`${API}/properties/${propId}/assets`,
        { asset_type: t, installed_year: year ? parseInt(year, 10) : null, source });
      onSaved(data.slots); setOpen(false); setYear("");
    } catch (e) { alert(formatApiError(e)); }
    setBusy(false);
  };
  return (
    <div className="rounded-2xl border border-slate-100 p-3" data-testid={`asset-slot-${t}`}>
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-xs font-black text-slate-900">{slot.label}</div>
          <div className="text-[9px] text-slate-400">{slot.lifespan_label}</div>
        </div>
        {slot.asset ? (
          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-600" data-testid={`asset-confidence-${t}`}>
            <ShieldCheck className="w-2.5 h-2.5 inline mr-0.5" style={{ marginTop: -2 }} />
            {slot.asset.confidence_label || CONF_LABELS[slot.asset.confidence]}
          </span>
        ) : (
          <button onClick={() => setOpen(!open)} data-testid={`asset-add-${t}`}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border-2 border-slate-200 text-[10px] font-bold text-slate-600">
            <Plus className="w-3 h-3" /> Adaugă
          </button>
        )}
      </div>
      {slot.asset && (
        <div className="mt-1.5 text-[10px] text-slate-500" data-testid={`asset-info-${t}`}>
          {slot.asset.installed_year ? `Instalat: ${slot.asset.installed_year}` : "An de instalare necunoscut"}
        </div>
      )}
      {eol && (
        <div className="mt-2 rounded-xl bg-slate-50 p-2.5" data-testid={`asset-eol-${t}`}>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${(EOL_META[eol.status] || EOL_META.hypothesis)[1]}`}>
              {(EOL_META[eol.status] || EOL_META.hypothesis)[0]}
            </span>
            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-slate-200 text-slate-500">Estimat</span>
            <span className="text-[11px] font-bold text-slate-700" data-testid={`asset-remaining-${t}`}>{eol.remaining_label}</span>
            {eol.cost_label && <span className="ml-auto text-[10px] font-mono text-slate-500">{eol.cost_label}</span>}
          </div>
          <div className="mt-1 text-[9px] text-slate-400">{eol.reason}</div>
          <div className="mt-1 text-[10px] font-semibold text-slate-600">{eol.recommended_action}</div>
          {eol.needs_audit && (
            <button onClick={onAudit} data-testid={`asset-audit-cta-${t}`}
              className="mt-1.5 text-[10px] font-black text-[#166534] underline">Programează Audit Tehnic →</button>
          )}
        </div>
      )}
      {open && !slot.asset && (
        <div className="mt-2 flex items-center gap-1.5" data-testid={`asset-form-${t}`}>
          <input type="number" value={year} onChange={e => setYear(e.target.value)} placeholder="Anul instalării"
            data-testid={`asset-year-${t}`}
            className="w-28 px-3 py-2 rounded-full border-2 border-slate-200 text-[11px] outline-none focus:border-[#34C759]" />
          <select value={source} onChange={e => setSource(e.target.value)} data-testid={`asset-source-${t}`}
            className="flex-1 px-2 py-2 rounded-full border-2 border-slate-200 text-[10px] font-bold text-slate-600 bg-white">
            <option value="owner_declared">Declarat de mine</option>
            <option value="official_document">Am document oficial</option>
          </select>
          <button onClick={save} disabled={busy} data-testid={`asset-save-${t}`}
            className="px-3.5 py-2 rounded-full text-[10px] font-black text-black disabled:opacity-50" style={{ background: "#d4ff3a" }}>
            {busy ? "…" : "Salvează"}
          </button>
        </div>
      )}
    </div>
  );
};

const PropertyAssetsCard = ({ propId, actions }) => {
  const [data, setData] = useState(null);
  useEffect(() => {
    setData(null);
    axios.get(`${API}/properties/${propId}/assets`).then(r => setData(r.data)).catch(() => {});
  }, [propId]);
  if (!data) return null;
  const audit = async () => {
    if (data.audit_opportunity_id) {
      try {
        await axios.post(`${API}/client/opportunities/${data.audit_opportunity_id}/accept`);
        alert("Cererea de audit a fost creată — un specialist te va contacta.");
      } catch (e) { alert(formatApiError(e)); }
    } else actions.openWizard?.();
  };
  return (
    <div className="mt-4 rounded-3xl border border-slate-100 bg-white shadow-sm p-4" data-testid="assets-card">
      <div className="flex items-center gap-2.5">
        <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: GREEN_SOFT }}>
          <Layers className="w-4.5 h-4.5" style={{ width: 18, height: 18, color: GREEN }} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-black text-slate-900 leading-none xos-display tracking-tight">Activele casei</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Echipamente majore · durată de viață estimată</div>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        {data.slots.map(slot => (
          <AssetSlot key={slot.asset_type} slot={slot} propId={propId} onAudit={audit}
            onSaved={(slots) => setData(d => ({ ...d, slots }))} />
        ))}
      </div>
      <p className="mt-3 text-[10px] text-slate-400">Estimările sunt orientative (bibliotecă actuarială de referință) — un audit tehnic confirmă starea reală.</p>
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
      <TwinMaturityCard propId={prop.id} actions={actions} />
      <PropertyAssetsCard propId={prop.id} actions={actions} />
      <div className="mt-4 space-y-2">
        <ListItem icon={Box} label="Digital Twin" sub="locuința ta în 3D" onClick={() => { import("../../lib/analytics").then(({ trackIntent }) => trackIntent("twin_viewed")).catch(() => {}); actions.openTwin(); }} testid="v2-hub-twin" />
        <ListItem icon={HeartPulse} label="House Health" sub="scor + recomandări" onClick={() => { import("../../lib/analytics").then(({ trackIntent }) => trackIntent("audit_viewed")).catch(() => {}); actions.openHealth(); }} testid="v2-hub-health" />
        <ListItem icon={Clock} label="Timeline" sub="istoricul proprietății" onClick={actions.openPropTimeline} testid="v2-hub-timeline" />
        <ListItem icon={Wallet} label="Plăți & Portofel" sub={`sold ${(user?.wallet_balance ?? 0).toFixed(0)} RON`} onClick={actions.openWallet} testid="v2-hub-wallet" />
        <ListItem icon={Settings2} label="Administrează proprietățile" sub="adaugă, editează, fotografii" onClick={actions.openPropManager} testid="v2-hub-manage" muted />
      </div>
    </div>
  );
};
