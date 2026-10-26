// Strategic Partners — extended tabs: Funnel, Agreements (registry + conflicts),
// Commissions report, Request routing. Consumes /api/admin/strategic-partners/*.
import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  Loader2, AlertTriangle, TrendingUp, Users, CheckCircle2, UserCheck,
  FileText, Plus, Save, X, ShieldAlert, Percent, Target, Route, Trash2,
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;
const ax = axios.create({ baseURL: API, withCredentials: true });
const H = { headers: { "X-PM-Client": "propmanage-app" } };

const Spinner = () => <div className="text-center py-10"><Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" /></div>;
const Mini = ({ label, value, color }) => (
  <div className="rounded-xl p-4 border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
    <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">{label}</div>
    <div className={`text-2xl font-bold ${color || "text-slate-900 dark:text-white"}`}>{value}</div>
  </div>
);

// ── FUNNEL ────────────────────────────────────────────────────────────────
export const FunnelTab = () => {
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    ax.get("/api/admin/strategic-partners/funnel").then(r => setD(r.data)).catch(e => setErr(e.response?.data?.detail || e.message));
  }, []);
  if (err) return <div className="text-rose-500 text-sm p-4"><AlertTriangle className="w-4 h-4 inline mr-1" />{String(err)}</div>;
  if (!d) return <Spinner />;
  return (
    <div data-testid="funnel-tab">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
        <Mini label="Invitați (lead-uri)" value={d.totals.invited} color="text-blue-500" />
        <Mini label="Conturi activate" value={d.totals.activated_accounts} color="text-cyan-500" />
        <Mini label="Rată activare" value={`${d.totals.activation_rate}%`} color="text-amber-500" />
        <Mini label="Conversii" value={d.totals.converted} color="text-emerald-500" />
        <Mini label="Rată conversie" value={`${d.totals.conversion_rate}%`} color="text-violet-500" />
      </div>
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800">
        <h3 className="font-bold flex items-center gap-2 text-slate-900 dark:text-white mb-3"><TrendingUp className="w-4 h-4 text-emerald-500" /> Funnel pe partener (date reale)</h3>
        {d.rows.length === 0 ? <div className="text-sm text-slate-500 py-4 text-center">Niciun partener cu lead-uri încă.</div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr><th className="text-left py-2">Partener</th><th className="text-left py-2">Program</th><th className="text-center py-2">Invitați</th><th className="text-center py-2">Conturi activate</th><th className="text-center py-2">Conversii</th><th className="text-center py-2">Conv. %</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {d.rows.map((r, i) => (
                  <tr key={i} data-testid={`funnel-row-${i}`}>
                    <td className="py-2 font-medium text-slate-900 dark:text-white">{r.company}<div className="text-[10px] text-slate-400">{r.city}</div></td>
                    <td className="py-2"><span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${r.source === "city_partner" ? "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300" : "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"}`}>{r.source === "city_partner" ? "City" : "Marketplace"}</span></td>
                    <td className="text-center py-2 font-bold text-blue-600">{r.invited}</td>
                    <td className="text-center py-2 font-bold text-cyan-600">{r.activated_accounts}</td>
                    <td className="text-center py-2 font-bold text-emerald-600">{r.converted}</td>
                    <td className="text-center py-2 font-bold text-violet-600">{r.conversion_rate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// ── COMMISSIONS ─────────────────────────────────────────────────────────────
export const CommissionsTab = () => {
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    ax.get("/api/admin/strategic-partners/commissions-report").then(r => setD(r.data)).catch(e => setErr(e.response?.data?.detail || e.message));
  }, []);
  if (err) return <div className="text-rose-500 text-sm p-4"><AlertTriangle className="w-4 h-4 inline mr-1" />{String(err)}</div>;
  if (!d) return <Spinner />;
  return (
    <div data-testid="commissions-tab">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Mini label="Conversii" value={d.totals.converted} color="text-emerald-500" />
        <Mini label="Venit raportat" value={`${d.totals.revenue} RON`} color="text-blue-500" />
        <Mini label="Comision eligibil (one-time)" value={`${d.totals.eligible_one_time} RON`} color="text-violet-500" />
        <Mini label="Comision recurent/lună" value={`${d.totals.eligible_recurring_monthly} RON`} color="text-amber-500" />
      </div>
      <div className="mb-4 text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg px-3 py-2 flex items-center gap-2">
        <ShieldAlert className="w-4 h-4 shrink-0" /> {d.disclaimer}
      </div>
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800">
        <h3 className="font-bold flex items-center gap-2 text-slate-900 dark:text-white mb-3"><Percent className="w-4 h-4 text-violet-500" /> Comisioane eligibile (reguli marketplace)</h3>
        {d.rows.length === 0 ? <div className="text-sm text-slate-500 py-4 text-center">Niciun partener marketplace.</div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr><th className="text-left py-2">Partener</th><th className="text-left py-2">Reguli</th><th className="text-center py-2">Conversii</th><th className="text-center py-2">Venit</th><th className="text-right py-2">Eligibil</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {d.rows.map((r, i) => (
                  <tr key={i} data-testid={`commission-row-${i}`}>
                    <td className="py-2 font-medium text-slate-900 dark:text-white">{r.company}<div className="text-[10px] text-slate-400 uppercase">{r.tier}</div></td>
                    <td className="py-2 text-xs text-slate-500">{r.has_rules ? (r.commission_type || "—") : <span className="text-slate-400 italic">neconfigurat</span>}{r.basis && <div className="text-[10px] text-slate-400">{r.basis}</div>}</td>
                    <td className="text-center py-2 font-bold text-emerald-600">{r.converted}</td>
                    <td className="text-center py-2 text-slate-700 dark:text-slate-200">{r.revenue} RON</td>
                    <td className="text-right py-2 font-bold text-violet-600">{r.eligible_one_time > 0 ? `${r.eligible_one_time} RON` : (r.eligible_recurring_monthly > 0 ? `${r.eligible_recurring_monthly}/lună` : "—")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// ── AGREEMENTS ───────────────────────────────────────────────────────────────
const emptyAgreement = { kind: "city", partner_id: "", categories: [], territory_cities: "", territory_counties: "", coverage: "", segment: "", period_from: "", period_to: "", exclusivity: false, commission_terms: "", status: "draft", notes: "" };

const AgreementForm = ({ onClose, onSaved, partners, taxonomy }) => {
  const [f, setF] = useState(emptyAgreement);
  const [saving, setSaving] = useState(false);
  const [conflicts, setConflicts] = useState(null);
  const [err, setErr] = useState("");
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const toggleCat = (c) => setF(x => ({ ...x, categories: x.categories.includes(c) ? x.categories.filter(y => y !== c) : [...x.categories, c] }));

  const buildPayload = (ack) => ({
    kind: f.kind, partner_id: f.partner_id, categories: f.categories,
    territory_cities: f.territory_cities.split(",").map(s => s.trim()).filter(Boolean),
    territory_counties: f.territory_counties.split(",").map(s => s.trim()).filter(Boolean),
    coverage: f.coverage || null, segment: f.segment || null,
    period_from: f.period_from || null, period_to: f.period_to || null,
    exclusivity: f.exclusivity, commission_terms: f.commission_terms || null,
    status: f.status, notes: f.notes || null, acknowledge_conflicts: !!ack,
  });

  const save = async (ack) => {
    setErr(""); setSaving(true);
    try {
      if (!f.partner_id) { setErr("Selectează un partener."); setSaving(false); return; }
      const { data } = await ax.post("/api/admin/strategic-partners/agreements", buildPayload(ack), H);
      onSaved(data); onClose();
    } catch (e) {
      const detail = e.response?.data?.detail;
      if (e.response?.status === 409 && detail?.conflicts) {
        setConflicts(detail.conflicts);
      } else {
        setErr(typeof detail === "string" ? detail : (detail?.message || e.message));
      }
    } finally { setSaving(false); }
  };

  const options = partners.filter(p => p.kind === f.kind && p.status !== "terminated");
  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" data-testid="agreement-form-modal">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 max-h-[88vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-900">
          <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2"><FileText className="w-4 h-4 text-violet-500" /> Acord comercial nou</h3>
          <button onClick={onClose} className="text-slate-400"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Program</label>
              <select value={f.kind} onChange={e => { set("kind", e.target.value); set("partner_id", ""); }} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" data-testid="agr-field-kind">
                <option value="city">City Partner</option>
                <option value="marketplace">Marketplace Partner</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Partener</label>
              <select value={f.partner_id} onChange={e => set("partner_id", e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" data-testid="agr-field-partner">
                <option value="">— selectează —</option>
                {options.map(p => <option key={p.id} value={p.id}>{p.company}{p.city ? ` (${p.city})` : ""} · {p.status}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Categorii</label>
            {taxonomy?.category_groups?.nZEB && (
              <div className="mb-2">
                <span className="text-[10px] font-bold uppercase text-emerald-600 mr-2">nZEB:</span>
                {taxonomy.category_groups.nZEB.map(c => (
                  <button type="button" key={c} onClick={() => toggleCat(c)} className={`inline-block text-[11px] px-2 py-0.5 rounded-full mr-1 mb-1 border ${f.categories.includes(c) ? "bg-emerald-600 text-white border-emerald-600" : "border-emerald-300 text-emerald-700 dark:text-emerald-300"}`} data-testid={`agr-nzeb-${c}`}>{c}</button>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-lg p-2">
              {(taxonomy?.categories || []).map(c => (
                <button type="button" key={c} onClick={() => toggleCat(c)} className={`text-[11px] px-2 py-0.5 rounded-full border ${f.categories.includes(c) ? "bg-violet-600 text-white border-violet-600" : "border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300"}`} data-testid={`agr-cat-${c}`}>{c}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Orașe (teritoriu, virgulă)</label>
              <input value={f.territory_cities} onChange={e => set("territory_cities", e.target.value)} placeholder="București, Cluj" className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" data-testid="agr-field-cities" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Acoperire</label>
              <select value={f.coverage} onChange={e => set("coverage", e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" data-testid="agr-field-coverage">
                <option value="">—</option>
                {(taxonomy?.coverage_levels || []).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Perioadă de la</label>
              <input type="date" value={f.period_from} onChange={e => set("period_from", e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" data-testid="agr-field-from" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Perioadă până la</label>
              <input type="date" value={f.period_to} onChange={e => set("period_to", e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" data-testid="agr-field-to" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Segment</label>
              <select value={f.segment} onChange={e => set("segment", e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" data-testid="agr-field-segment">
                <option value="">—</option>
                {(taxonomy?.segments || []).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Status</label>
              <select value={f.status} onChange={e => set("status", e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" data-testid="agr-field-status">
                {(taxonomy?.agreement_statuses || ["draft", "active", "paused", "terminated"]).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input type="checkbox" checked={f.exclusivity} onChange={e => set("exclusivity", e.target.checked)} data-testid="agr-field-exclusivity" /> Exclusivitate pe categorie + teritoriu
          </label>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Termeni comision (text)</label>
            <input value={f.commission_terms} onChange={e => set("commission_terms", e.target.value)} placeholder="ex: 10% din valoarea contractului" className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" data-testid="agr-field-commission" />
          </div>
          {err && <div className="text-rose-500 text-sm"><AlertTriangle className="w-4 h-4 inline mr-1" />{err}</div>}
          {conflicts && (
            <div className="rounded-xl border border-rose-300 dark:border-rose-500/40 bg-rose-50 dark:bg-rose-500/10 p-4" data-testid="agr-conflict-box">
              <div className="font-bold text-rose-700 dark:text-rose-300 flex items-center gap-2 mb-2"><ShieldAlert className="w-4 h-4" /> Conflict de exclusivitate ({conflicts.length})</div>
              {conflicts.map((c, i) => (
                <div key={i} className="text-xs text-slate-700 dark:text-slate-200 mb-1">• <strong>{c.partner_name}</strong> — {c.categories.join(", ")} ({c.period_from || "…"}→{c.period_to || "…"}): {c.reasons.join(", ")}</div>
              ))}
              <div className="mt-3 flex gap-2">
                <button onClick={() => save(true)} disabled={saving} className="px-3 py-1.5 text-sm font-medium rounded-lg bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5" data-testid="agr-approve-anyway">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Aprobă explicit și salvează
                </button>
                <button onClick={() => setConflicts(null)} className="px-3 py-1.5 text-sm rounded-lg text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800">Revizuiește</button>
              </div>
            </div>
          )}
        </div>
        {!conflicts && (
          <div className="flex items-center justify-end gap-2 px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 sticky bottom-0">
            <button onClick={onClose} className="px-3 py-1.5 text-sm rounded-lg text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800">Anulează</button>
            <button onClick={() => save(false)} disabled={saving} className="px-4 py-1.5 text-sm font-medium rounded-lg bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-60 flex items-center gap-1.5" data-testid="agr-save">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvează acord
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const STATUS_BADGE = {
  draft: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  paused: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  terminated: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
};

export const AgreementsTab = () => {
  const [items, setItems] = useState([]);
  const [partners, setPartners] = useState([]);
  const [taxonomy, setTaxonomy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [err, setErr] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [a, tax, cp, mp] = await Promise.all([
        ax.get("/api/admin/strategic-partners/agreements"),
        ax.get("/api/admin/strategic-partners/taxonomy"),
        ax.get("/api/admin/city-partners"),
        ax.get("/api/admin/marketplace-partners"),
      ]);
      setItems(a.data.items || []);
      setTaxonomy(tax.data);
      const cpP = (cp.data.items || []).map(p => ({ ...p, kind: "city" }));
      const mpP = (mp.data.items || []).map(p => ({ ...p, kind: "marketplace" }));
      setPartners([...cpP, ...mpP]);
    } catch (e) { setErr(e.response?.data?.detail || e.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const archive = async (id) => {
    if (!window.confirm("Închei (terminated) acest acord?")) return;
    await ax.delete(`/api/admin/strategic-partners/agreements/${id}`, H);
    setItems(arr => arr.map(x => x.id === id ? { ...x, status: "terminated" } : x));
  };

  if (loading) return <Spinner />;
  return (
    <div data-testid="agreements-tab">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2"><FileText className="w-4 h-4 text-violet-500" /> Registru acorduri comerciale</h3>
        <button onClick={() => setShowForm(true)} className="px-3 py-1.5 text-sm font-medium rounded-lg bg-violet-600 hover:bg-violet-700 text-white flex items-center gap-1.5" data-testid="agreement-add-btn"><Plus className="w-4 h-4" /> Acord nou</button>
      </div>
      {err && <div className="text-rose-500 text-sm mb-3">{String(err)}</div>}
      {items.length === 0 ? (
        <div className="text-center py-10 text-sm text-slate-500 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">Niciun acord definit. Apasă „Acord nou".</div>
      ) : (
        <div className="space-y-2">
          {items.map(a => (
            <div key={a.id} className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 flex items-start justify-between gap-3" data-testid={`agreement-${a.id}`}>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-semibold text-slate-900 dark:text-white">{a.partner_name}</span>
                  <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${a.kind === "city" ? "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300" : "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"}`}>{a.kind}</span>
                  <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${STATUS_BADGE[a.status]}`}>{a.status}</span>
                  {a.exclusivity && <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">exclusiv</span>}
                </div>
                <div className="text-xs text-slate-500">{(a.categories || []).join(", ") || "toate categoriile"} · {[...(a.territory_cities||[]), ...(a.territory_counties||[])].join(", ") || a.coverage || "teritoriu nespecificat"}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">{a.period_from || "…"} → {a.period_to || "…"} {a.approved_by && <span className="text-amber-600">· aprobat de {a.approved_by}</span>}</div>
              </div>
              {a.status !== "terminated" && (
                <button onClick={() => archive(a.id)} className="text-slate-400 hover:text-rose-500 shrink-0" title="Închide acord" data-testid={`agreement-archive-${a.id}`}><Trash2 className="w-4 h-4" /></button>
              )}
            </div>
          ))}
        </div>
      )}
      {showForm && <AgreementForm partners={partners} taxonomy={taxonomy} onClose={() => setShowForm(false)} onSaved={(a) => setItems(arr => [a, ...arr])} />}
    </div>
  );
};

// ── ROUTING ──────────────────────────────────────────────────────────────────
export const RoutingTab = () => {
  const [taxonomy, setTaxonomy] = useState(null);
  const [f, setF] = useState({ category: "", city: "", county: "", region: "" });
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));

  const loadHistory = async () => {
    const r = await ax.get("/api/admin/strategic-partners/route-history?limit=10");
    setHistory(r.data.items || []);
  };
  useEffect(() => {
    ax.get("/api/admin/strategic-partners/taxonomy").then(r => setTaxonomy(r.data));
    loadHistory();
  }, []);

  const run = async () => {
    setErr(""); setBusy(true); setResult(null);
    try {
      if (!f.category) { setErr("Alege o categorie."); setBusy(false); return; }
      const { data } = await ax.post("/api/admin/strategic-partners/route-request", {
        category: f.category, city: f.city || null, county: f.county || null, region: f.region || null,
      }, H);
      setResult(data); loadHistory();
    } catch (e) { setErr(e.response?.data?.detail || e.message); } finally { setBusy(false); }
  };

  const allCats = taxonomy ? [...taxonomy.categories, ...(taxonomy.category_groups?.nZEB || [])] : [];
  return (
    <div data-testid="routing-tab">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 mb-5">
        <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-3"><Target className="w-4 h-4 text-violet-500" /> Rutare cerere → parteneri eligibili</h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <select value={f.category} onChange={e => set("category", e.target.value)} className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm sm:col-span-2" data-testid="route-category">
            <option value="">— categorie —</option>
            {allCats.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input value={f.city} onChange={e => set("city", e.target.value)} placeholder="Oraș" className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" data-testid="route-city" />
          <input value={f.county} onChange={e => set("county", e.target.value)} placeholder="Județ" className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" data-testid="route-county" />
        </div>
        <button onClick={run} disabled={busy} className="mt-3 px-4 py-2 text-sm font-medium rounded-lg bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-60 flex items-center gap-1.5" data-testid="route-run">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Route className="w-4 h-4" />} Găsește parteneri
        </button>
        {err && <div className="text-rose-500 text-sm mt-2">{String(err)}</div>}
        {result && (
          <div className="mt-4" data-testid="route-result">
            {result.ranked.length === 0 ? <div className="text-sm text-slate-500">Niciun partener eligibil (fără acord activ sau profil pe categorie/teritoriu).</div> : (
              <div className="space-y-2">
                {result.ranked.map((r, i) => (
                  <div key={i} className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center gap-3" data-testid={`route-rank-${i}`}>
                    <div className="w-7 h-7 rounded-full bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300 font-bold flex items-center justify-center text-xs shrink-0">{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-900 dark:text-white truncate">{r.company} <span className="text-[10px] text-slate-400 uppercase">{r.kind}</span></div>
                      <div className="text-[11px] text-slate-500">{r.reasons.join(" · ")}</div>
                    </div>
                    {r.has_active_agreement && <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 shrink-0">acord</span>}
                    <span className="font-bold text-violet-600 shrink-0">{r.score}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800">
        <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-3"><Users className="w-4 h-4 text-cyan-500" /> Istoric recomandări</h3>
        {history.length === 0 ? <div className="text-sm text-slate-500 py-3 text-center">Nicio rutare înregistrată.</div> : (
          <div className="space-y-2">
            {history.map(h => (
              <div key={h.id} className="p-3 rounded-lg border border-slate-100 dark:border-slate-800 text-xs flex items-center justify-between gap-2" data-testid={`route-history-${h.id}`}>
                <div className="min-w-0">
                  <span className="font-semibold text-slate-900 dark:text-white">{h.category}</span>
                  <span className="text-slate-400"> · {h.territory?.city || "—"}</span>
                  <div className="text-[11px] text-slate-500">{h.ranked?.length || 0} parteneri · recomandat: {h.ranked?.[0]?.company || "niciunul"}</div>
                </div>
                <span className="text-[10px] text-slate-400 shrink-0">{h.created_at ? new Date(h.created_at).toLocaleDateString("ro-RO") : ""}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
