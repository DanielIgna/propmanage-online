// CityPartnerDetailPage — Admin detail view: onboarding wizard + leads + create-login.
// Route: /admin/city-partners/:id
import React, { useEffect, useState } from "react";
import axios from "axios";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Building2, ChevronLeft, ChevronRight, Loader2, CheckCircle2, Circle,
  Users, Plus, Mail, Phone, MapPin, TrendingUp, KeyRound, Copy, X,
  AlertTriangle, Save, Edit3, Shield, Power, Eye, Tags,
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;
const ax = axios.create({ baseURL: API, withCredentials: true });

const STAGE_COLORS = {
  introduced: "bg-slate-100 text-slate-700 dark:bg-slate-700/40 dark:text-slate-300",
  contacted: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  onboarded: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  converted: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  lost: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
};

const STATUS_META = {
  prospect: { label: "Prospect / Necontactat", color: "bg-slate-100 text-slate-600 dark:bg-slate-700/40 dark:text-slate-300" },
  contacted: { label: "Contactat", color: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300" },
  discussion: { label: "Discuție inițiată", color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300" },
  negotiation: { label: "Negociere", color: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300" },
  agreed: { label: "Partener agreat", color: "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300" },
  active: { label: "Activ", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  paused: { label: "Pauzat", color: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
  rejected: { label: "Respins", color: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" },
  lead: { label: "Lead", color: "bg-slate-100 text-slate-700 dark:bg-slate-700/40 dark:text-slate-300" },
  onboarding: { label: "Onboarding", color: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
  terminated: { label: "Încetat", color: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" },
};
const CAN_CREATE_LOGIN = new Set(["agreed", "active", "onboarding"]);

const ONBOARDING_STEPS = [
  "Prezentare oficială",
  "Introducere în ecosistem",
  "Prezentare pe grupurile disponibile",
  "Invitație către administratori",
  "Creare conturi platformă",
  "Urmărire social media",
  "Activare campanii locale",
];

const LeadForm = ({ onClose, onSave, saving }) => {
  const [f, setF] = useState({ lead_name: "", lead_email: "", lead_phone: "", source: "", stage: "introduced", notes: "" });
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <form onSubmit={e => { e.preventDefault(); onSave(f); }} className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Adaugă lead nou</h3>
          <button type="button" onClick={onClose} className="text-slate-400"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-3">
          <input required placeholder="Nume lead *" value={f.lead_name} onChange={e => setF({ ...f, lead_name: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" data-testid="lead-name" />
          <input type="email" placeholder="Email" value={f.lead_email} onChange={e => setF({ ...f, lead_email: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" data-testid="lead-email" />
          <input placeholder="Telefon" value={f.lead_phone} onChange={e => setF({ ...f, lead_phone: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" data-testid="lead-phone" />
          <input placeholder="Sursă (ex: WhatsApp, evenim. local)" value={f.source} onChange={e => setF({ ...f, source: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" data-testid="lead-source" />
          <select value={f.stage} onChange={e => setF({ ...f, stage: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" data-testid="lead-stage">
            {Object.keys(STAGE_COLORS).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <textarea placeholder="Note" rows={2} value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" data-testid="lead-notes" />
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm text-slate-600 rounded-lg hover:bg-slate-100">Anulează</button>
          <button type="submit" disabled={saving} className="px-4 py-1.5 text-sm font-medium rounded-lg bg-blue-600 text-white disabled:opacity-60 flex items-center gap-1.5" data-testid="lead-save">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvează
          </button>
        </div>
      </form>
    </div>
  );
};

const CityPartnerDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [partner, setPartner] = useState(null);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [leadFormOpen, setLeadFormOpen] = useState(false);
  const [savingLead, setSavingLead] = useState(false);
  const [creds, setCreds] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [p, l] = await Promise.all([
        ax.get(`/api/admin/city-partners/${id}`),
        ax.get(`/api/admin/city-partners/${id}/leads`),
      ]);
      setPartner(p.data);
      setLeads(l.data?.items || []);
    } catch (e) {
      setError(e.response?.data?.detail || e.message);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [id]);

  const setStep = async (step) => {
    try {
      const { data } = await ax.post(`/api/admin/city-partners/${id}/onboarding-step`, { step });
      setPartner(data);
    } catch (e) { alert(e.response?.data?.detail || e.message); }
  };

  const addLead = async (payload) => {
    setSavingLead(true);
    try {
      const { data } = await ax.post(`/api/admin/city-partners/${id}/leads`, payload);
      setLeads(arr => [data, ...arr]);
      setLeadFormOpen(false);
    } catch (e) { alert(e.response?.data?.detail || e.message); }
    finally { setSavingLead(false); }
  };

  const updateLeadStage = async (leadId, stage) => {
    try {
      const body = { stage };
      if (stage === "lost") {
        const reason = window.prompt("Motiv pierdere lead (obligatoriu pentru raportare):", "");
        if (reason === null) return; // cancelled
        if (!reason.trim()) { alert("Motivul pierderii este obligatoriu."); return; }
        body.lost_reason = reason.trim();
      }
      const { data } = await ax.patch(`/api/admin/city-partners/leads/${leadId}`, body);
      setLeads(arr => arr.map(x => x.id === data.id ? data : x));
    } catch (e) { alert(e.response?.data?.detail || e.message); }
  };

  const createLogin = async () => {
    if (!window.confirm(`Creezi un cont CITY_PARTNER pentru ${partner.company}?`)) return;
    try {
      const { data } = await ax.post(`/api/admin/city-partners/${id}/create-login`);
      setCreds(data);
      load();
    } catch (e) { alert(e.response?.data?.detail || e.message); }
  };

  const [saving, setSaving] = useState(false);
  const [catsInput, setCatsInput] = useState("");
  const [zonesInput, setZonesInput] = useState("");
  useEffect(() => {
    if (partner) {
      setCatsInput((partner.categories || []).join(", "));
      setZonesInput((partner.zones || []).join(", "));
    }
  }, [partner]);

  const patchPartner = async (fields) => {
    setSaving(true);
    try {
      const { data } = await ax.patch(`/api/admin/city-partners/${id}`, fields);
      setPartner(data);
    } catch (e) { alert(e.response?.data?.detail || e.message); }
    finally { setSaving(false); }
  };
  const saveAuthorized = () => patchPartner({
    categories: catsInput.split(",").map(s => s.trim()).filter(Boolean),
    zones: zonesInput.split(",").map(s => s.trim()).filter(Boolean),
  });
  const setPortalAccess = async (enabled) => {
    if (!enabled && !window.confirm(`Suspendezi accesul la portal pentru ${partner.company}?`)) return;
    try {
      const { data } = await ax.post(`/api/admin/city-partners/${id}/portal-access`, { enabled });
      setPartner(data);
    } catch (e) { alert(e.response?.data?.detail || e.message); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  if (error) return <div className="p-8 text-rose-500"><AlertTriangle className="w-4 h-4 inline mr-1" /> {error}</div>;
  if (!partner) return null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 lg:p-8" data-testid="city-partner-detail">
      <div className="mb-6 flex items-center gap-3 flex-wrap">
        <Link to="/admin/city-partners" className="text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 text-sm"><ChevronLeft className="w-4 h-4" /> Parteneri</Link>
        <span className="text-slate-300">·</span>
        <Building2 className="w-5 h-5 text-cyan-500" />
        <h1 className="text-xl lg:text-2xl font-bold text-slate-900 dark:text-white">{partner.company}</h1>
        {(() => { const st = STATUS_META[partner.status] || STATUS_META.lead; return (
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${st.color}`} data-testid="detail-status-badge">{st.label}</span>
        ); })()}
        {!partner.public_visible && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 dark:bg-slate-700/40 dark:text-slate-400" title="Nu este afișat public ca partener activ" data-testid="detail-nepublic-badge">nepublic</span>}
        <span className="text-xs text-slate-500">{[partner.city, partner.county].filter(Boolean).join(", ")}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: contact + actions */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">Contact</div>
            <div className="space-y-2 text-sm">
              {partner.contact_name && <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200"><Users className="w-4 h-4 text-slate-400" />{partner.contact_name}{partner.contact_role ? <span className="text-xs text-slate-400">· {partner.contact_role}</span> : null}</div>}
              {partner.contact_email && <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200"><Mail className="w-4 h-4 text-slate-400" />{partner.contact_email}</div>}
              {partner.contact_phone && <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200"><Phone className="w-4 h-4 text-slate-400" />{partner.contact_phone}</div>}
              {partner.website && <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400"><Building2 className="w-4 h-4 text-slate-400" /><a href={partner.website.startsWith("http") ? partner.website : `https://${partner.website}`} target="_blank" rel="noreferrer" className="hover:underline" data-testid="partner-website">{partner.website}</a></div>}
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200"><MapPin className="w-4 h-4 text-slate-400" />{[partner.country, partner.city, partner.county].filter(Boolean).join(", ") || "Origine neconfirmată"}{[partner.country, partner.city, partner.county].some(Boolean) && !partner.origin_confirmed && <span className="text-[10px] text-amber-500">(neconfirmat)</span>}</div>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-2 text-xs">
              <div><div className="text-slate-400">Apartamente</div><div className="font-bold text-slate-900 dark:text-white">{partner.units_managed}</div></div>
              <div><div className="text-slate-400">Ritm creștere</div><div className="font-bold text-slate-900 dark:text-white">{partner.growth_rate || "—"}</div></div>
              <div className="col-span-2"><div className="text-slate-400">Tip portofoliu</div><div className="font-medium text-slate-700 dark:text-slate-200">{partner.portfolio_type || "—"}</div></div>
              {partner.capacity_note && <div className="col-span-2"><div className="text-slate-400">Capacitate</div><div className="font-medium text-slate-700 dark:text-slate-200">{partner.capacity_note}</div></div>}
              {partner.target_client_type && <div className="col-span-2"><div className="text-slate-400">Tip client vizat</div><div className="font-medium text-slate-700 dark:text-slate-200">{partner.target_client_type}</div></div>}
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2 text-xs" data-testid="partner-profile-block">
              <div className="flex gap-2 flex-wrap">
                <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300">{partner.partner_type || "city"}</span>
                <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">acoperire: {partner.coverage || "city"}</span>
                <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${partner.collaboration_agreed ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-slate-100 text-slate-500 dark:bg-slate-700/40 dark:text-slate-400"}`} data-testid="collab-agreed-badge">colaborare: {partner.collaboration_agreed ? "agreată" : "neagreată"}</span>
                {!partner.coverage_confirmed && <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">acoperire neconfirmată</span>}
              </div>
              {(partner.categories?.length > 0) && <div><span className="text-slate-400">Categorii: </span><span className="text-slate-700 dark:text-slate-200">{partner.categories.join(", ")}</span></div>}
              {(partner.zones?.length > 0) && <div><span className="text-slate-400">Teritoriu comercial: </span><span className="text-slate-700 dark:text-slate-200">{partner.zones.join(", ")}</span></div>}
              {(partner.services?.length > 0) && <div><span className="text-slate-400">Servicii: </span><span className="text-slate-700 dark:text-slate-200">{partner.services.join(", ")}</span></div>}
              {(partner.applications?.length > 0) && <div><span className="text-slate-400">Aplicații: </span><span className="text-slate-700 dark:text-slate-200">{partner.applications.join(", ")}</span></div>}
              {partner.next_action && <div><span className="text-slate-400">Următoarea acțiune: </span><span className="text-slate-700 dark:text-slate-200">{partner.next_action}</span></div>}
              {partner.info_source && <div><span className="text-slate-400">Sursa info: </span><span className="text-slate-700 dark:text-slate-200">{partner.info_source}</span></div>}
            </div>
            {partner.notes && <div className="mt-3 text-xs text-slate-500 italic">„{partner.notes}”</div>}
          </div>

          {/* Cont partener */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5" /> Cont City Partner
            </div>
            {partner.linked_user_id
              ? (partner.portal_access_enabled === false
                  ? <div className="text-sm text-amber-700 dark:text-amber-300 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> Cont existent — acces portal SUSPENDAT</div>
                  : <div className="text-sm text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> Cont activ — are acces la portal</div>)
              : CAN_CREATE_LOGIN.has(partner.status)
                ? <>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Generează credențiale dedicate ca partenerul să acceseze portalul propriu (vede doar lead-urile sale).</p>
                  <button onClick={createLogin} className="w-full px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-medium flex items-center justify-center gap-1.5" data-testid="create-login">
                    <KeyRound className="w-3.5 h-3.5" /> Creează cont CITY_PARTNER
                  </button>
                </>
                : <div className="text-xs text-slate-500 dark:text-slate-400 flex items-start gap-1.5" data-testid="create-login-blocked">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                    Contul se poate crea doar după ce colaborarea este agreată (status „Partener agreat” sau „Activ”). Prospectul nu a fost contactat/confirmat.
                  </div>
            }
            {creds?.temp_password && (
              <div className="mt-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30">
                <div className="text-[11px] font-bold uppercase text-amber-700 dark:text-amber-300 mb-1">Parolă temporară (afișată O SINGURĂ DATĂ)</div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-white dark:bg-slate-900 px-2 py-1 rounded font-mono text-slate-900 dark:text-slate-100">{creds.temp_password}</code>
                  <button onClick={() => navigator.clipboard.writeText(creds.temp_password)} className="p-1 rounded hover:bg-amber-100 dark:hover:bg-amber-500/20" title="Copiază"><Copy className="w-3.5 h-3.5" /></button>
                </div>
                <div className="text-[10px] text-amber-700 dark:text-amber-300 mt-1">Trimite-o partenerului prin canal sigur. Email: <strong>{creds.email}</strong></div>
              </div>
            )}
          </div>

          {/* Acces portal & activare */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800" data-testid="activation-card">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" /> Acces portal & activare
            </div>

            {/* Status comercial */}
            <label className="block text-[11px] text-slate-500 mb-1">Status comercial</label>
            <select value={partner.status} onChange={e => patchPartner({ status: e.target.value })} disabled={saving}
              className="w-full px-3 py-2 mb-4 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" data-testid="status-select">
              {Object.keys(STATUS_META).map(s => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
            </select>

            {/* Categorii & teritorii autorizate */}
            <label className="block text-[11px] text-slate-500 mb-1 flex items-center gap-1"><Tags className="w-3 h-3" /> Categorii autorizate (separate prin virgulă)</label>
            <input value={catsInput} onChange={e => setCatsInput(e.target.value)} placeholder="ex: Uși, Ferestre" className="w-full px-3 py-2 mb-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" data-testid="auth-categories" />
            <label className="block text-[11px] text-slate-500 mb-1 flex items-center gap-1"><MapPin className="w-3 h-3" /> Teritorii autorizate (separate prin virgulă)</label>
            <input value={zonesInput} onChange={e => setZonesInput(e.target.value)} placeholder="ex: Mureș, Cluj" className="w-full px-3 py-2 mb-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" data-testid="auth-territories" />
            <button onClick={saveAuthorized} disabled={saving} className="w-full px-3 py-1.5 mb-4 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium flex items-center justify-center gap-1.5 disabled:opacity-60" data-testid="save-authorized">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Salvează categorii & teritorii
            </button>

            {/* Acces portal (kill-switch) */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] text-slate-500">Acces portal</span>
                {partner.portal_access_enabled
                  ? <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" data-testid="portal-access-state">Activ</span>
                  : <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 dark:bg-slate-700/40 dark:text-slate-400" data-testid="portal-access-state">Inactiv</span>}
              </div>
              {!partner.linked_user_id
                ? <div className="text-[11px] text-slate-500 flex items-start gap-1.5"><AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" /> Creează întâi un cont de portal pentru a putea activa accesul.</div>
                : partner.portal_access_enabled
                  ? <button onClick={() => setPortalAccess(false)} className="w-full px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-medium flex items-center justify-center gap-1.5" data-testid="suspend-access"><Power className="w-3.5 h-3.5" /> Suspendă accesul</button>
                  : <button onClick={() => setPortalAccess(true)} className="w-full px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium flex items-center justify-center gap-1.5" data-testid="reactivate-access"><Power className="w-3.5 h-3.5" /> Reactivează accesul</button>}
            </div>

            {/* Preview DEMO */}
            <a href={`/partners/portal?demo=${id}`} target="_blank" rel="noreferrer" className="mt-4 w-full px-3 py-1.5 rounded-lg border border-cyan-300 dark:border-cyan-500/40 text-cyan-700 dark:text-cyan-300 text-xs font-medium flex items-center justify-center gap-1.5 hover:bg-cyan-50 dark:hover:bg-cyan-500/10" data-testid="preview-demo-portal">
              <Eye className="w-3.5 h-3.5" /> Previzualizează portal (DEMO)
            </a>
            <p className="mt-2 text-[10px] text-slate-400 italic">Preview demonstrativ cu date sintetice. Nu creează cont și nu acordă acces real.</p>
          </div>
        </div>

        {/* Right: onboarding + leads */}
        <div className="lg:col-span-2 space-y-4">
          {/* Onboarding wizard */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800" data-testid="onboarding-wizard">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <ChevronRight className="w-3.5 h-3.5" /> Flux onboarding (7 pași)
              </div>
              <span className="text-xs text-slate-500"><strong className="text-slate-900 dark:text-white">{partner.onboarding_step}/7</strong> {partner.onboarding_complete && "· COMPLET"}</span>
            </div>
            <div className="space-y-1.5">
              {ONBOARDING_STEPS.map((step, i) => {
                const stepNo = i + 1;
                const done = stepNo <= partner.onboarding_step;
                return (
                  <button key={i} onClick={() => setStep(done && stepNo === partner.onboarding_step ? stepNo - 1 : stepNo)}
                    className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors ${done ? "bg-emerald-50 dark:bg-emerald-500/10" : "hover:bg-slate-50 dark:hover:bg-slate-800"}`}
                    data-testid={`onboarding-step-${stepNo}`}>
                    {done ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> : <Circle className="w-4 h-4 text-slate-300 shrink-0" />}
                    <span className={`text-sm flex-1 ${done ? "text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-400"}`}><strong>{stepNo}.</strong> {step}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Leads */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" /> Lead-uri ({leads.length})
              </div>
              <button onClick={() => setLeadFormOpen(true)} className="px-2.5 py-1 rounded-lg bg-blue-600 text-white text-xs font-medium flex items-center gap-1" data-testid="add-lead">
                <Plus className="w-3 h-3" /> Adaugă lead
              </button>
            </div>
            {leads.length === 0
              ? <div className="p-8 text-center text-sm text-slate-500">Niciun lead înregistrat încă pentru acest partener.</div>
              : <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {leads.map(l => (
                  <div key={l.id} className="p-3 flex items-center gap-3" data-testid={`lead-row-${l.id}`}>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-900 dark:text-white truncate">{l.lead_name}</div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {l.lead_email || "—"} · {l.source || "fără sursă"} · {l.introduced_at ? new Date(l.introduced_at).toLocaleDateString("ro-RO") : ""}
                      </div>
                      {l.stage === "lost" && l.lost_reason && (
                        <div className="text-[11px] text-rose-500 mt-0.5" data-testid={`lead-lost-reason-${l.id}`}>Pierdut: {l.lost_reason}</div>
                      )}
                    </div>
                    <select value={l.stage} onChange={e => updateLeadStage(l.id, e.target.value)} className={`text-[10px] font-bold uppercase px-1.5 py-1 rounded ${STAGE_COLORS[l.stage] || STAGE_COLORS.introduced} border-0`} data-testid={`lead-stage-${l.id}`}>
                      {Object.keys(STAGE_COLORS).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    {l.revenue_generated > 0 && <span className="text-xs font-bold text-emerald-600">{l.revenue_generated} RON</span>}
                  </div>
                ))}
              </div>
            }
          </div>
        </div>
      </div>

      {leadFormOpen && <LeadForm onClose={() => setLeadFormOpen(false)} onSave={addLead} saving={savingLead} />}
    </div>
  );
};

export default CityPartnerDetailPage;
export { CityPartnerDetailPage };
