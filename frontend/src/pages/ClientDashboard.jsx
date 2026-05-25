// PropManage - Client Dashboard
import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import axios from "axios";
import {
  Wallet, Sparkles, Activity, Briefcase, Plus, FileCheck, MessageSquare,
  AlertTriangle, Star, CreditCard, Building, Camera, Shield, Calendar, Search,
} from "lucide-react";
import { useAuth, formatApiError } from "../auth";
import { useI18n } from "../i18n";
import { ChatPanel } from "./ChatPanel";
import { PhotoUploader, ReviewModal, PropertyManagerModal } from "./Components";
import { TwoFASetupModal, PropertyTimelineModal } from "./Marketplace";
import { OpenDisputeModal } from "./AdminModals";
import { API, DashLayout, Stat, StatusBadge } from "./DashShared";

export const ClientDashboard = () => {
  const { user, refreshUser } = useAuth();
  const { t } = useI18n();
  const [properties, setProperties] = useState([]);
  const [requests, setRequests] = useState([]);
  const [showNewReq, setShowNewReq] = useState(false);
  const [chatRequest, setChatRequest] = useState(null);
  const [showPropManager, setShowPropManager] = useState(false);
  const [reviewFor, setReviewFor] = useState(null);
  const [selectedPropId, setSelectedPropId] = useState(null);
  const [show2FA, setShow2FA] = useState(false);
  const [timelineFor, setTimelineFor] = useState(null);
  const [disputeFor, setDisputeFor] = useState(null);
  const [searchQ, setSearchQ] = useState("");
  const [filterCat, setFilterCat] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);

  useEffect(() => {
    if (user && user !== false) {
      axios.get(`${API}/auth/2fa/status`).then(r => setTwoFAEnabled(r.data.enabled)).catch(() => {});
    }
  }, [user]);

  const loadRequests = () => {
    const params = new URLSearchParams();
    if (searchQ) params.set("q", searchQ);
    if (filterCat) params.set("category", filterCat);
    if (filterStatus) params.set("status", filterStatus);
    return axios.get(`${API}/requests?${params}`).then(r => setRequests(r.data)).catch(() => {});
  };

  useEffect(() => {
    if (user && user !== false) {
      axios.get(`${API}/properties`).then(r => setProperties(r.data)).catch(() => {});
      loadRequests();
      // Stripe payment polling per playbook
      const params = new URLSearchParams(window.location.search);
      if (params.get("payment") === "success" && params.get("session_id")) {
        const sessionId = params.get("session_id");
        let attempts = 0;
        const poll = async () => {
          if (attempts >= 6) {
            alert("Verificarea plății a expirat. Verifică în câteva minute.");
            window.history.replaceState(null, "", "/client");
            return;
          }
          attempts++;
          try {
            const { data } = await axios.get(`${API}/payments/status/${sessionId}`);
            if (data.payment_status === "paid") {
              await loadRequests();
              await refreshUser();
              alert(data.demo_mode ? "Plată confirmată (demo). Fondurile sunt în escrow." : "Plată confirmată! Fondurile sunt în escrow.");
              window.history.replaceState(null, "", "/client");
              return;
            }
            if (data.status === "expired") {
              alert("Sesiunea de plată a expirat.");
              window.history.replaceState(null, "", "/client");
              return;
            }
            setTimeout(poll, 2000);
          } catch (e) { setTimeout(poll, 2500); }
        };
        poll();
      } else if (params.get("payment") === "cancelled") {
        alert("Plata a fost anulată.");
        window.history.replaceState(null, "", "/client");
      }
    }
  }, [user]);

  const prop = properties.find(p => p.id === selectedPropId) || properties[0];

  const payEscrow = async (reqId) => {
    try {
      const { data } = await axios.post(`${API}/payments/checkout-session?request_id=${reqId}`);
      window.location.href = data.checkout_url;
    } catch (e) { alert(formatApiError(e)); }
  };

  const confirmRequest = async (id, r) => {
    try {
      await axios.post(`${API}/requests/${id}/confirm`);
      const { data } = await axios.get(`${API}/requests`);
      setRequests(data);
      await refreshUser();
      if (r && r.specialist_id) {
        const updated = data.find(x => x.id === id) || r;
        setReviewFor(updated);
      }
    } catch (e) { alert(formatApiError(e)); }
  };

  return (
    <DashLayout role="client" title={`${t("client.welcome")}, ${user?.name?.split(" ")[0] || ""}`}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Stat icon={Activity} label={t("client.health")} value={`${prop?.health_score || 0}/100`} sub="Property" tid="stat-health" />
        <Stat icon={Wallet} label={t("client.wallet")} value={`${user?.wallet_balance?.toFixed(0) || 0} RON`} sub="Sold" color="emerald" tid="stat-wallet" />
        <Stat icon={Sparkles} label={t("client.tokens")} value={user?.tokens || 0} sub="Earned" color="amber" tid="stat-tokens" />
        <Stat icon={Briefcase} label={t("client.requests")} value={requests.length} sub="Total" color="cyan" tid="stat-requests" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-strong rounded-3xl p-8">
          <div className="flex justify-between items-start mb-6 flex-wrap gap-3">
            <div>
              <div className="text-xs uppercase tracking-wider text-stone-400 mb-1">Digital Twin</div>
              <h2 className="font-serif text-2xl" data-testid="property-name">{prop?.name || "—"}</h2>
              <div className="text-sm text-stone-400">{prop?.address}</div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {properties.length > 1 && (
                <select value={prop?.id || ""} onChange={e => setSelectedPropId(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-full px-3 py-1.5 text-xs" data-testid="prop-selector">
                  {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              )}
              <button onClick={() => setShowPropManager(true)} className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-full bg-white/5 hover:bg-white/10 flex items-center gap-1" data-testid="manage-props">
                <Building className="w-3 h-3" />Gestionează ({properties.length})
              </button>
              {prop && (
                <button onClick={() => setTimelineFor(prop.id)} className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-full bg-white/5 hover:bg-white/10 flex items-center gap-1" data-testid="timeline-btn">
                  <Calendar className="w-3 h-3" />Timeline
                </button>
              )}
              <button onClick={() => setShow2FA(true)} className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-full flex items-center gap-1 ${twoFAEnabled ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" : "bg-white/5 hover:bg-white/10"}`} data-testid="2fa-btn">
                <Shield className="w-3 h-3" />{twoFAEnabled ? "2FA ✓" : "2FA"}
              </button>
              <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">LIVE 3D</span>
            </div>
          </div>
          <div className="aspect-[16/8] rounded-2xl bg-gradient-to-br from-slate-900 via-cyan-950 to-slate-900 border border-white/10 flex items-center justify-center mb-6 relative overflow-hidden">
            <svg viewBox="0 0 400 200" className="w-full h-full p-6">
              <g fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1">
                <path d="M80 170 L80 60 L200 30 L320 60 L320 170 Z" />
                <path d="M80 60 L200 100 L320 60" />
                <path d="M200 30 L200 100 L200 170" />
              </g>
              {[[140,80,"#d4ff3a"],[260,110,"#d4ff3a"],[260,140,"#f87171"],[140,140,"#d4ff3a"]].map(([x,y,c], i) => (
                <g key={i}>
                  <circle cx={x} cy={y} r="5" fill={c} />
                  <circle cx={x} cy={y} r="12" fill={c} opacity="0.2">
                    <animate attributeName="r" values="12;20;12" dur="2s" repeatCount="indefinite" />
                  </circle>
                </g>
              ))}
            </svg>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { l: "Structură", v: prop?.structure_health || 90, c: "emerald" },
              { l: "Utilități", v: prop?.utilities_health || 82, c: "amber" },
              { l: "Acte", v: prop?.documents_health || 100, c: "emerald" },
            ].map((s, i) => (
              <div key={i} className="bg-white/5 rounded-xl p-3">
                <div className="text-[10px] text-stone-400 mb-1">{s.l}</div>
                <div className="flex items-baseline gap-1">
                  <span className="font-serif text-2xl">{s.v}</span>
                  <span className="text-[10px] text-stone-500">%</span>
                </div>
                <div className="h-1 bg-white/5 rounded mt-2 overflow-hidden">
                  <div className={`h-full bg-${s.c}-400 rounded`} style={{ width: `${s.v}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-strong rounded-3xl p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-serif text-xl">{t("client.requests")}</h3>
            <button onClick={() => setShowNewReq(true)} className="btn-accent px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1" data-testid="new-request-btn">
              <Plus className="w-3 h-3" />{t("client.newRequest")}
            </button>
          </div>
          <div className="space-y-2 mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-500" />
              <input type="text" placeholder="Caută..." value={searchQ} onChange={e => setSearchQ(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-[#d4ff3a]/50" data-testid="req-search" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className="bg-white/5 border border-white/10 rounded-xl px-2 py-1.5 text-xs" data-testid="req-filter-cat">
                <option value="">Toate categoriile</option>
                <option value="hvac">HVAC</option><option value="electric">Electric</option>
                <option value="plumbing">Sanitar</option><option value="other">Altele</option>
              </select>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="bg-white/5 border border-white/10 rounded-xl px-2 py-1.5 text-xs" data-testid="req-filter-status">
                <option value="">Toate statusurile</option>
                <option value="open">Deschis</option><option value="assigned">Asignat</option>
                <option value="in_progress">În lucru</option><option value="completed">Finalizat</option>
                <option value="confirmed">Confirmat</option>
              </select>
            </div>
          </div>
          <div className="space-y-2 max-h-[400px] overflow-auto no-scrollbar">
            {requests.length === 0 && <div className="text-xs text-stone-500 text-center py-8">Nicio solicitare</div>}
            {requests.map(r => (
              <div key={r.id} className="bg-white/5 rounded-xl p-4" data-testid={`req-${r.id}`}>
                <div className="flex justify-between items-start mb-2">
                  <div className="font-medium text-sm">{r.title}</div>
                  <StatusBadge status={r.status} />
                </div>
                <div className="text-xs text-stone-400 mb-2 line-clamp-2">{r.description}</div>
                <div className="flex items-center justify-between text-[10px] text-stone-500">
                  <span>{r.category} · {r.priority}</span>
                  {r.specialist_name && <span className="text-[#d4ff3a]">{r.specialist_name}</span>}
                </div>
                <div className="flex gap-2 mt-3">
                  {r.specialist_id && ["assigned","in_progress","completed"].includes(r.status) && (
                    <button onClick={() => setChatRequest(r.id)} className="flex-1 bg-white/10 hover:bg-white/15 py-2 rounded-lg text-xs flex items-center justify-center gap-1" data-testid={`chat-${r.id}`}>
                      <MessageSquare className="w-3 h-3" />Chat
                    </button>
                  )}
                  {r.status === "assigned" && !r.escrow_amount && (
                    <button onClick={() => payEscrow(r.id)} className="flex-1 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 py-2 rounded-lg text-xs flex items-center justify-center gap-1" data-testid={`pay-${r.id}`}>
                      <CreditCard className="w-3 h-3" />Plătește
                    </button>
                  )}
                </div>
                {r.status === "completed" && (
                  <button onClick={() => confirmRequest(r.id, r)}
                    className="mt-2 w-full bg-[#d4ff3a] text-black py-2 rounded-lg text-xs font-medium"
                    data-testid={`confirm-${r.id}`}>
                    Confirmă & Eliberează plata
                  </button>
                )}
                {r.status === "confirmed" && r.specialist_id && (
                  <button onClick={() => setReviewFor(r)}
                    className="mt-2 w-full bg-white/10 hover:bg-white/15 py-2 rounded-lg text-xs flex items-center justify-center gap-1"
                    data-testid={`review-${r.id}`}>
                    <Star className="w-3 h-3" />Evaluează specialist
                  </button>
                )}
                {r.specialist_id && ["assigned","in_progress","completed"].includes(r.status) && !r.disputed && (
                  <button onClick={() => setDisputeFor(r)}
                    className="mt-2 w-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 py-2 rounded-lg text-xs flex items-center justify-center gap-1"
                    data-testid={`dispute-${r.id}`}>
                    <AlertTriangle className="w-3 h-3" />Deschide dispută
                  </button>
                )}
                {r.disputed && (
                  <div className="mt-2 w-full bg-amber-500/15 border border-amber-500/40 text-amber-300 py-2 rounded-lg text-xs text-center" data-testid={`disputed-badge-${r.id}`}>
                    ⚠ Dispută în analiză
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {showNewReq && <NewRequestModal onClose={() => setShowNewReq(false)} property={prop} onCreated={r => setRequests([r, ...requests])} />}
      {chatRequest && <ChatPanel requestId={chatRequest} onClose={() => setChatRequest(null)} />}
      {showPropManager && <PropertyManagerModal properties={properties} onClose={() => setShowPropManager(false)} onChange={setProperties} />}
      {timelineFor && <PropertyTimelineModal propertyId={timelineFor} onClose={() => setTimelineFor(null)} />}
      {disputeFor && <OpenDisputeModal requestId={disputeFor.id} requestTitle={disputeFor.title} onClose={() => setDisputeFor(null)} onOpened={() => loadRequests()} />}
      {show2FA && <TwoFASetupModal onClose={(updated) => { setShow2FA(false); if (updated) axios.get(`${API}/auth/2fa/status`).then(r => setTwoFAEnabled(r.data.enabled)); }} currentlyEnabled={twoFAEnabled} />}
      {reviewFor && (
        <ReviewModal
          requestId={reviewFor.id}
          specialistName={reviewFor.specialist_name}
          onClose={() => setReviewFor(null)}
          onSubmitted={async () => { await refreshUser(); loadRequests(); }}
        />
      )}
    </DashLayout>
  );
};

const NewRequestModal = ({ onClose, property, onCreated }) => {
  const [form, setForm] = useState({ title: "", description: "", category: "hvac", priority: "normal", budget_estimate: 200 });
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await axios.post(`${API}/requests`, { ...form, property_id: property.id, photos });
      onCreated(data); onClose();
    } catch (e) { alert(formatApiError(e)); }
    finally { setLoading(false); }
  };
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-6" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="glass-strong rounded-3xl p-8 max-w-md w-full max-h-[90vh] overflow-auto no-scrollbar" onClick={e => e.stopPropagation()}>
        <h2 className="font-serif text-2xl mb-6">Solicitare nouă</h2>
        <form onSubmit={submit} className="space-y-3">
          <input required placeholder="Titlu (ex: Reparație centrală)" value={form.title} onChange={e => setForm({...form, title: e.target.value})}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm" data-testid="newreq-title" />
          <textarea required rows={3} placeholder="Descriere" value={form.description} onChange={e => setForm({...form, description: e.target.value})}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm" data-testid="newreq-desc" />
          <select value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm" data-testid="newreq-cat">
            <option value="hvac">HVAC</option><option value="electric">Electric</option><option value="plumbing">Sanitar</option><option value="other">Altele</option>
          </select>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setForm({...form, priority: "normal"})} className={`py-3 rounded-xl text-sm ${form.priority === "normal" ? "bg-white text-black" : "bg-white/5 text-stone-400"}`}>Normal</button>
            <button type="button" onClick={() => setForm({...form, priority: "urgent"})} className={`py-3 rounded-xl text-sm ${form.priority === "urgent" ? "bg-red-500 text-white" : "bg-white/5 text-stone-400"}`}>Urgent</button>
          </div>
          <input type="number" placeholder="Buget estimat (RON)" value={form.budget_estimate} onChange={e => setForm({...form, budget_estimate: parseFloat(e.target.value)})}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm" data-testid="newreq-budget" />
          <div>
            <label className="text-xs uppercase tracking-wider text-stone-400 mb-2 flex items-center gap-1">
              <Camera className="w-3 h-3" />Dovezi foto (opțional)
            </label>
            <PhotoUploader photos={photos} onChange={setPhotos} max={5} />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 bg-white/5 rounded-xl text-sm">Anulează</button>
            <button type="submit" disabled={loading} className="flex-1 btn-accent py-3 rounded-xl text-sm font-medium" data-testid="newreq-submit">
              {loading ? "..." : "Creează"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
