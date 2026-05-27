// Trust score weights + platform settings + finance + projects + activity feed
import React, { useEffect, useState } from "react";
import axios from "axios";
import { Save, AlertCircle, Download, RotateCcw } from "lucide-react";
import { AdminCard, AdminBtn } from "./AdminLayoutMetronic";
import { API } from "../DashShared";

// ============= TRUST WEIGHTS =============
export const AdminTrustWeights = () => {
  const [w, setW] = useState({ on_time: 0.3, reviews: 0.3, photos: 0.15, complaints_penalty: 0.15, verification_bonus: 0.1 });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    axios.get(`${API}/admin/trust-weights`).then(r => {
      const { is_default, updated_at, ...weights } = r.data;
      setW(weights);
    });
  }, []);

  const total = Object.values(w).reduce((s, v) => s + v, 0);
  const validSum = Math.abs(total - 1.0) < 0.001;

  const save = async () => {
    setSaving(true); setMsg("");
    try {
      await axios.put(`${API}/admin/trust-weights`, w);
      setMsg("✓ Salvat");
      setTimeout(() => setMsg(""), 3000);
    } catch (e) {
      setMsg(e?.response?.data?.detail || "Eroare");
    } finally { setSaving(false); }
  };

  const labels = {
    on_time: "Punctualitate (joburi la timp)",
    reviews: "Recenzii (rating mediu)",
    photos: "Documentație foto",
    complaints_penalty: "Penalizare reclamații",
    verification_bonus: "Bonus verificare documente",
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <AdminCard title="Algoritm Trust Score — Pondere Factori" testid="trust-weights-card">
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
          Trust Score-ul fiecărui specialist este calculat ca sumă ponderată din acești factori. Suma ponderilor trebuie să fie <b>1.0 (100%)</b>.
        </p>
        <div className="space-y-4">
          {Object.entries(labels).map(([k, label]) => (
            <div key={k}>
              <div className="flex justify-between text-sm mb-1">
                <span>{label}</span>
                <span className="font-mono font-semibold">{(w[k] * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0" max="1" step="0.05"
                value={w[k]}
                onChange={e => setW({ ...w, [k]: parseFloat(e.target.value) })}
                className="w-full accent-blue-600"
                data-testid={`trust-slider-${k}`}
              />
            </div>
          ))}
        </div>
        <div className={`mt-5 p-3 rounded-lg flex items-center justify-between ${validSum ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" : "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400"}`}>
          <div className="flex items-center gap-2 text-sm">
            <AlertCircle className="w-4 h-4" />
            Sumă: <b>{(total * 100).toFixed(0)}%</b> {validSum ? "✓" : "(trebuie 100%)"}
          </div>
          <AdminBtn onClick={save} disabled={!validSum || saving} data-testid="trust-save">
            {saving ? "..." : <><Save className="w-3.5 h-3.5 inline mr-1" /> Salvează</>}
          </AdminBtn>
        </div>
        {msg && <div className="mt-2 text-sm text-emerald-600">{msg}</div>}
      </AdminCard>
    </div>
  );
};

// ============= PLATFORM SETTINGS =============
export const AdminPlatformSettings = () => {
  const [s, setS] = useState(null);
  const [dirty, setDirty] = useState({});
  const [saving, setSaving] = useState(false);

  const load = () => axios.get(`${API}/admin/settings`).then(r => { setS(r.data); setDirty({}); });
  useEffect(() => { load(); }, []);

  const set = (k, v) => setDirty(d => ({ ...d, [k]: v }));
  const val = (k) => dirty[k] !== undefined ? dirty[k] : s?.[k];

  const save = async () => {
    if (!Object.keys(dirty).length) return;
    setSaving(true);
    try {
      await axios.put(`${API}/admin/settings`, dirty);
      await load();
    } finally { setSaving(false); }
  };

  if (!s) return <div className="text-slate-500">Se încarcă...</div>;

  return (
    <div className="space-y-4 max-w-3xl">
      <AdminCard title="Integrări & Feature Flags" testid="settings-flags-card">
        <div className="space-y-3">
          <label className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-800">
            <div>
              <div className="font-medium">Stripe LIVE</div>
              <div className="text-xs text-slate-500">Activează plățile reale cu Stripe (înlocuiește wallet demo)</div>
            </div>
            <input type="checkbox" checked={!!val("stripe_live")} onChange={e => set("stripe_live", e.target.checked)} className="w-5 h-5 accent-blue-600" data-testid="settings-stripe-live" />
          </label>
          <label className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-800">
            <div>
              <div className="font-medium">Resend / SendGrid LIVE</div>
              <div className="text-xs text-slate-500">Trimite emailuri reale (când e off → log în consolă)</div>
            </div>
            <input type="checkbox" checked={!!val("resend_live")} onChange={e => set("resend_live", e.target.checked)} className="w-5 h-5 accent-blue-600" data-testid="settings-resend-live" />
          </label>
          <label className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-800">
            <div>
              <div className="font-medium text-amber-600 dark:text-amber-400">Mod Mentenanță</div>
              <div className="text-xs text-slate-500">Blochează accesul userilor non-admin</div>
            </div>
            <input type="checkbox" checked={!!val("maintenance_mode")} onChange={e => set("maintenance_mode", e.target.checked)} className="w-5 h-5 accent-amber-600" data-testid="settings-maintenance" />
          </label>
        </div>
      </AdminCard>

      <AdminCard title="Economie Platformă" testid="settings-economy-card">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Comision platformă (%)</label>
            <input type="number" step="0.1" min="0" max="50" value={val("platform_commission_pct")} onChange={e => set("platform_commission_pct", parseFloat(e.target.value))} className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800" data-testid="settings-commission" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Tarif Lead (RON)</label>
            <input type="number" step="1" min="0" value={val("lead_fee_ron")} onChange={e => set("lead_fee_ron", parseFloat(e.target.value))} className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800" data-testid="settings-lead-fee" />
          </div>
        </div>
      </AdminCard>

      <AdminCard title="🎬 Vizibilitate secțiuni Landing" testid="settings-landing-vis-card">
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
          Activează / dezactivează secțiunile vizibile pe pagina publică. Secțiunile dezactivate sunt complet ascunse pentru clienți.
        </p>
        <div className="space-y-2">
          {[
            { key: "landing_show_admin_trust", label: "Admin · Control Center · Metrici Live", hint: "Statistici interne — recomandat OFF pentru clienți" },
            { key: "landing_show_business_model", label: "Model de Business · Patru fluxuri de venit", hint: "Lead Fees / SaaS / Premium — pitch pentru investitori" },
            { key: "landing_show_unit_economics", label: "Indicatori economici · ARPU / Take-rate / LTV", hint: "KPI financiari — dezactivat by default" },
            { key: "landing_show_value_proposition", label: "Propunere de valoare · Client / Specialist / Platformă", hint: "Beneficii ecosistem" },
            { key: "landing_show_golden_path", label: "Drumul ideal · Flux complet 7 pași", hint: "Demo vizual al jurnalei" },
          ].map(it => (
            <label key={it.key} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-800">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{it.label}</div>
                <div className="text-xs text-slate-500">{it.hint}</div>
              </div>
              <input
                type="checkbox"
                checked={!!val(it.key)}
                onChange={e => set(it.key, e.target.checked)}
                className="w-5 h-5 accent-blue-600 shrink-0 ml-3"
                data-testid={`settings-${it.key.replace(/_/g, "-")}`}
              />
            </label>
          ))}
        </div>
      </AdminCard>

      <AdminCard title="Branding & Contact" testid="settings-branding-card">        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Nume logo</label>
            <input value={val("logo_text") || ""} onChange={e => set("logo_text", e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800" data-testid="settings-logo" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Culoare primară</label>
            <div className="flex gap-2 mt-1">
              <input type="color" value={val("primary_color") || "#d4ff3a"} onChange={e => set("primary_color", e.target.value)} className="w-12 h-10 rounded-lg cursor-pointer" data-testid="settings-color-picker" />
              <input value={val("primary_color") || ""} onChange={e => set("primary_color", e.target.value)} className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-sm" />
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Email suport</label>
            <input value={val("support_email") || ""} onChange={e => set("support_email", e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800" data-testid="settings-support-email" />
          </div>
        </div>
      </AdminCard>

      <div className="flex justify-between gap-2 flex-wrap">
        <AdminBtn
          variant="secondary"
          onClick={() => {
            // Build preview URL — include all current values (saved + dirty) for landing flags
            const flagKeys = [
              "landing_show_admin_trust", "landing_show_business_model",
              "landing_show_unit_economics", "landing_show_value_proposition",
              "landing_show_golden_path",
            ];
            const params = new URLSearchParams({ preview: "1" });
            flagKeys.forEach(k => { params.set(k, String(!!val(k))); });
            window.open(`/?${params.toString()}`, "_blank");
          }}
          data-testid="settings-preview-landing"
        >
          👁 Preview Landing {Object.keys(dirty).length > 0 && <span className="ml-1 text-[10px] bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded-full">cu modificări nesalvate</span>}
        </AdminBtn>
        <div className="flex gap-2">
          <AdminBtn variant="secondary" onClick={() => setDirty({})} disabled={!Object.keys(dirty).length}>Anulează</AdminBtn>
          <AdminBtn onClick={save} disabled={saving || !Object.keys(dirty).length} data-testid="settings-save">
            {saving ? "Se salvează..." : <><Save className="w-3.5 h-3.5 inline mr-1" /> Salvează ({Object.keys(dirty).length})</>}
          </AdminBtn>
        </div>
      </div>
    </div>
  );
};

// ============= FINANCE =============
export const AdminFinance = () => {
  const [data, setData] = useState(null);

  useEffect(() => { axios.get(`${API}/admin/finance/overview`).then(r => setData(r.data)); }, []);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <AdminCard testid="finance-total-wallet">
          <div className="text-xs text-slate-500 uppercase tracking-wider">Total în Wallets</div>
          <div className="text-3xl font-bold mt-2">{(data?.total_wallet || 0).toLocaleString("ro")} RON</div>
        </AdminCard>
        <AdminCard testid="finance-escrow">
          <div className="text-xs text-slate-500 uppercase tracking-wider">Escrow Securizat</div>
          <div className="text-3xl font-bold mt-2">{(data?.escrow_held || 0).toLocaleString("ro")} RON</div>
        </AdminCard>
        <AdminCard testid="finance-export-card">
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Export</div>
          <div className="flex flex-col gap-2">
            <AdminBtn variant="secondary" onClick={() => window.open(`${API}/admin/export/transactions.csv`, "_blank")} data-testid="export-transactions">
              <Download className="w-3.5 h-3.5 inline mr-1.5" /> Tranzacții CSV
            </AdminBtn>
            <AdminBtn variant="secondary" onClick={() => window.open(`${API}/admin/export/users.csv`, "_blank")}>
              <Download className="w-3.5 h-3.5 inline mr-1.5" /> Useri CSV
            </AdminBtn>
          </div>
        </AdminCard>
      </div>

      <AdminCard title="Top 10 Wallets" testid="top-wallets-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800">
              <th className="text-left py-2 text-xs font-bold uppercase text-slate-500">Nume</th>
              <th className="text-left py-2 text-xs font-bold uppercase text-slate-500">Rol</th>
              <th className="text-right py-2 text-xs font-bold uppercase text-slate-500">Sold</th>
            </tr>
          </thead>
          <tbody>
            {(data?.top_wallets || []).map(w => (
              <tr key={w.id} className="border-b border-slate-100 dark:border-slate-800/50">
                <td className="py-2.5">{w.name}<div className="text-[11px] text-slate-500">{w.email}</div></td>
                <td className="py-2.5"><span className="text-[10px] uppercase px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800">{w.role}</span></td>
                <td className="py-2.5 text-right tabular-nums font-medium">{Number(w.balance).toLocaleString("ro")} RON</td>
              </tr>
            ))}
          </tbody>
        </table>
      </AdminCard>

      <AdminCard title="Tranzacții 30 zile (per tip)" testid="tx-by-type-card">
        <div className="space-y-2">
          {(data?.tx_by_type || []).map(t => (
            <div key={t.type} className="flex justify-between items-center p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
              <span className="capitalize font-medium">{t.type}</span>
              <span className="text-sm">
                <span className="text-slate-500 mr-3">{t.count}× tx</span>
                <span className="font-semibold">{Number(t.total).toLocaleString("ro")} RON</span>
              </span>
            </div>
          ))}
          {!data?.tx_by_type?.length && <div className="text-sm text-slate-500">Nicio tranzacție în ultimele 30 zile</div>}
        </div>
      </AdminCard>
    </div>
  );
};

// ============= PROJECTS =============
export const AdminProjects = () => {
  const [data, setData] = useState({ items: [], total: 0 });
  const [status, setStatus] = useState("");

  useEffect(() => {
    const params = {};
    if (status) params.status = status;
    axios.get(`${API}/admin/projects`, { params }).then(r => setData(r.data));
  }, [status]);

  return (
    <div className="space-y-4">
      <AdminCard>
        <div className="flex gap-3 items-center">
          <select value={status} onChange={e => setStatus(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" data-testid="projects-status-filter">
            <option value="">Toate statusurile</option>
            <option value="active">Active</option>
            <option value="completed">Finalizate</option>
            <option value="cancelled">Anulate</option>
          </select>
          <span className="text-xs text-slate-500">Total: {data.total}</span>
        </div>
      </AdminCard>

      <AdminCard testid="projects-list-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800">
              <th className="text-left py-2 px-2 text-xs font-bold uppercase text-slate-500">Nume</th>
              <th className="text-left py-2 px-2 text-xs font-bold uppercase text-slate-500">Client</th>
              <th className="text-left py-2 px-2 text-xs font-bold uppercase text-slate-500">Designer</th>
              <th className="text-left py-2 px-2 text-xs font-bold uppercase text-slate-500">Status</th>
              <th className="text-right py-2 px-2 text-xs font-bold uppercase text-slate-500">Buget</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map(p => (
              <tr key={p.id} className="border-b border-slate-100 dark:border-slate-800/50" data-testid={`project-row-${p.id}`}>
                <td className="py-2.5 px-2 font-medium">{p.name || "—"}</td>
                <td className="py-2.5 px-2 text-slate-600 dark:text-slate-400">{p.client_name || "—"}</td>
                <td className="py-2.5 px-2 text-slate-600 dark:text-slate-400">{p.designer_name || "—"}</td>
                <td className="py-2.5 px-2"><span className="text-[10px] uppercase px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800">{p.status}</span></td>
                <td className="py-2.5 px-2 text-right tabular-nums">{Number(p.budget || 0).toLocaleString("ro")} RON</td>
              </tr>
            ))}
            {data.items.length === 0 && <tr><td colSpan="5" className="text-center py-8 text-slate-500">Niciun proiect</td></tr>}
          </tbody>
        </table>
      </AdminCard>
    </div>
  );
};

// ============= ACTIVITY (full page) =============
export const AdminActivityFull = () => {
  const [events, setEvents] = useState([]);
  useEffect(() => {
    const load = () => axios.get(`${API}/admin/activity-feed-live?limit=50`).then(r => setEvents(r.data));
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);
  return (
    <AdminCard title="Feed Activitate (refresh la 10s)" testid="activity-full-card">
      <div className="space-y-2">
        {events.map(e => (
          <div key={e.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50">
            <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm">{e.message || e.type}</div>
              <div className="text-xs text-slate-500 mt-0.5">
                {e.actor_name || "Sistem"} {e.actor_role && <span>({e.actor_role})</span>} · {e.created_at && new Date(e.created_at).toLocaleString("ro-RO")}
              </div>
            </div>
          </div>
        ))}
        {!events.length && <div className="text-center py-8 text-slate-500 text-sm">Niciun eveniment</div>}
      </div>
    </AdminCard>
  );
};
