// PropManage - Client Dashboard with 4-zone bottom navigation
// Tabs: Solicită serviciu | Lucrările mele | Notificări | Setări
import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import axios from "axios";
import {
  Wallet, Sparkles, Activity, Briefcase, Plus, MessageSquare,
  AlertTriangle, Star, CreditCard, Building, Camera, Shield, Calendar, Search, Palette, X,
  Bell, Settings as SettingsIcon, ClipboardList, Search as SearchIcon,
  Home as HomeIcon, CheckCircle2, Lock,
} from "lucide-react";
import { useAuth, formatApiError } from "../auth";
import { useI18n } from "../i18n";
import { ChatPanel } from "./ChatPanel";
import { PhotoUploader, ReviewModal, PropertyManagerModal } from "./Components";
import { TwoFASetupModal, PropertyTimelineModal } from "./Marketplace";
import { OpenDisputeModal } from "./AdminModals";
import { InteriorDesignCard, InteriorDesignModal, DesignPhasesPanel } from "./InteriorDesign";
import { API, DashLayout, Stat, StatusBadge } from "./DashShared";
import { BottomNav } from "./BottomNav";
import { SettingsPanel } from "./SettingsPanel";

export const ClientDashboard = () => {
  const { user, refreshUser } = useAuth();
  const { t } = useI18n();
  const [properties, setProperties] = useState([]);
  const [requests, setRequests] = useState([]);
  const [notifs, setNotifs] = useState([]);
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
  const [showDesign, setShowDesign] = useState(false);
  const [designPhasesFor, setDesignPhasesFor] = useState(null);
  const [tab, setTab] = useState("request");

  const loadRequests = () => {
    const params = new URLSearchParams();
    if (searchQ) params.set("q", searchQ);
    if (filterCat) params.set("category", filterCat);
    if (filterStatus) params.set("status", filterStatus);
    return axios.get(`${API}/requests?${params}`).then(r => setRequests(r.data)).catch(() => {});
  };

  const loadNotifs = () => axios.get(`${API}/notifications`).then(r => setNotifs(r.data)).catch(() => {});

  useEffect(() => {
    if (user && user !== false) {
      axios.get(`${API}/properties`).then(r => setProperties(r.data)).catch(() => {});
      loadRequests();
      loadNotifs();
      const interval = setInterval(loadNotifs, 30000);
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
      return () => clearInterval(interval);
    }
  }, [user]);

  const prop = properties.find(p => p.id === selectedPropId) || properties[0];
  const activeJobs = requests.filter(r => !["confirmed"].includes(r.status));
  const unreadNotifs = notifs.filter(n => !n.read).length;

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

  const tabs = [
    { id: "request", label: "Solicită", icon: SearchIcon, badge: 0 },
    { id: "jobs", label: "Lucrările mele", icon: ClipboardList, badge: activeJobs.length },
    { id: "notifications", label: "Notificări", icon: Bell, badge: unreadNotifs },
    { id: "settings", label: "Setări", icon: SettingsIcon, badge: 0 },
  ];

  const title = {
    request: `${t("client.welcome")}, ${user?.name?.split(" ")[0] || ""}`,
    jobs: "Lucrările mele",
    notifications: "Notificări",
    settings: "Setări",
  }[tab];

  return (
    <DashLayout role="client" title={title} bottomNav={<BottomNav tabs={tabs} active={tab} onChange={setTab} dataPrefix="client-tab" />}>
      {tab === "request" && (
        <RequestZone
          user={user} prop={prop} properties={properties} requests={requests}
          setSelectedPropId={setSelectedPropId} setProperties={setProperties}
          setShowNewReq={setShowNewReq} setShowPropManager={setShowPropManager}
          setTimelineFor={setTimelineFor} setShow2FA={setShow2FA}
          setShowDesign={setShowDesign} setTab={setTab}
        />
      )}
      {tab === "jobs" && (
        <JobsZone
          requests={requests} searchQ={searchQ} setSearchQ={setSearchQ}
          filterCat={filterCat} setFilterCat={setFilterCat}
          filterStatus={filterStatus} setFilterStatus={setFilterStatus}
          loadRequests={loadRequests}
          payEscrow={payEscrow} confirmRequest={confirmRequest}
          setChatRequest={setChatRequest} setReviewFor={setReviewFor}
          setDisputeFor={setDisputeFor} setDesignPhasesFor={setDesignPhasesFor}
        />
      )}
      {tab === "notifications" && <NotifsZone notifs={notifs} reload={loadNotifs} />}
      {tab === "settings" && <SettingsPanel />}

      {showNewReq && <NewRequestModal onClose={() => setShowNewReq(false)} property={prop} onCreated={r => setRequests([r, ...requests])} />}
      {chatRequest && <ChatPanel requestId={chatRequest} onClose={() => setChatRequest(null)} />}
      {showPropManager && <PropertyManagerModal properties={properties} onClose={() => setShowPropManager(false)} onChange={setProperties} />}
      {timelineFor && <PropertyTimelineModal propertyId={timelineFor} onClose={() => setTimelineFor(null)} />}
      {disputeFor && <OpenDisputeModal requestId={disputeFor.id} requestTitle={disputeFor.title} onClose={() => setDisputeFor(null)} onOpened={() => loadRequests()} />}
      {showDesign && <InteriorDesignModal onClose={() => setShowDesign(false)} onCreated={() => loadRequests()} />}
      {designPhasesFor && <DesignPhasesViewer request={designPhasesFor} onClose={() => setDesignPhasesFor(null)} onUpdate={() => { loadRequests(); refreshUser(); }} />}
      {show2FA && <TwoFASetupModal onClose={() => setShow2FA(false)} currentlyEnabled={false} />}
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

// ============= TAB 1: Request Zone (Onboarding cycle: Property → Twin → Design) =============
const RequestZone = ({ user, prop, properties, requests, setSelectedPropId, setProperties, setShowNewReq, setShowPropManager, setTimelineFor, setShow2FA, setShowDesign, setTab }) => {
  const { t } = useI18n();
  const { refreshUser } = useAuth();
  const noProps = properties.length === 0;
  const twinStatus = prop?.twin_status; // null/'pending_validation'/'approved'/'needs_revision'
  const twinUnlocked = !!prop?.twin_unlocked;

  const requestTwin = async () => {
    try {
      await axios.post(`${API}/properties/${prop.id}/twin/request`);
      alert("Cerere trimisă către operator. Vei fi notificat când Digital Twin-ul tău este aprobat.");
      // Reload properties so twin_status updates
      const { data } = await axios.get(`${API}/properties`);
      setProperties(data);
    } catch (e) { alert(formatApiError(e)); }
  };

  // ===== Empty state — no properties yet =====
  if (noProps) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat icon={Activity} label="Sănătate" value="—" sub="Niciun imobil" tid="stat-health" />
          <Stat icon={Wallet} label={t("client.wallet")} value={`${user?.wallet_balance?.toFixed(0) || 0} RON`} sub="Sold" color="emerald" tid="stat-wallet" />
          <Stat icon={Sparkles} label={t("client.tokens")} value={user?.tokens || 0} sub="Earned" color="amber" tid="stat-tokens" />
          <Stat icon={Briefcase} label={t("client.requests")} value={requests.length} sub="Total" color="cyan" tid="stat-requests" />
        </div>

        <div className="glass-strong rounded-3xl p-8 sm:p-12 text-center relative overflow-hidden" data-testid="onboarding-empty">
          <div className="absolute -top-32 -right-32 w-80 h-80 rounded-full bg-[#d4ff3a] blur-[120px] opacity-20" />
          <div className="absolute -bottom-32 -left-32 w-80 h-80 rounded-full bg-emerald-500 blur-[120px] opacity-10" />
          <div className="relative">
            <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-[#d4ff3a] to-emerald-400 flex items-center justify-center mb-6">
              <HomeIcon className="w-10 h-10 text-black" strokeWidth={1.6} />
            </div>
            <h2 className="font-serif text-3xl sm:text-4xl mb-3">Începe cu prima ta proprietate</h2>
            <p className="text-sm text-stone-400 max-w-md mx-auto mb-8 leading-relaxed">
              Adaugă-ți imobilul pentru a debloca: <span className="text-[#d4ff3a]">Digital Twin</span> (validat de operator), specialiști verificați, plăți escrow și serviciul premium de Design Interior.
            </p>
            <button
              onClick={() => setShowPropManager(true)}
              className="btn-accent px-8 py-4 rounded-full text-base font-medium inline-flex items-center gap-2"
              data-testid="onboarding-add-prop"
            >
              <Plus className="w-5 h-5" />Adaugă proprietate
            </button>
          </div>
        </div>

        {/* Cycle preview */}
        <CyclePreview activeStep={1} />
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Stat icon={Activity} label={t("client.health")} value={`${prop?.health_score || 0}/100`} sub="Property" tid="stat-health" />
        <Stat icon={Wallet} label={t("client.wallet")} value={`${user?.wallet_balance?.toFixed(0) || 0} RON`} sub="Sold" color="emerald" tid="stat-wallet" />
        <Stat icon={Sparkles} label={t("client.tokens")} value={user?.tokens || 0} sub="Earned" color="amber" tid="stat-tokens" />
        <Stat icon={Briefcase} label={t("client.requests")} value={requests.length} sub="Total" color="cyan" tid="stat-requests" />
      </div>

      {/* Step-by-step cycle visualization */}
      <CyclePreview activeStep={twinUnlocked ? 3 : (twinStatus === "pending_validation" ? 2.5 : 2)} />

      {/* Quick action CTA */}
      <div className="glass-strong rounded-3xl p-6 sm:p-8 mb-6 mt-6 relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-[#d4ff3a] blur-[100px] opacity-15" />
        <div className="relative flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="font-serif text-2xl sm:text-3xl mb-2">Ai nevoie de un specialist?</h2>
            <p className="text-sm text-stone-400 max-w-md">Postează cererea ta — primești oferte de la profesioniști verificați în câteva minute.</p>
          </div>
          <button
            onClick={() => setShowNewReq(true)}
            className="btn-accent px-6 py-3 rounded-full text-sm font-medium flex items-center gap-2"
            data-testid="new-request-cta"
          >
            <Plus className="w-4 h-4" />Solicită serviciu
          </button>
        </div>
      </div>

      {/* Digital Twin Card */}
      <div className="glass-strong rounded-3xl p-6 sm:p-8">
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
            <button onClick={() => setShowPropManager(true)} className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-full bg-[#d4ff3a]/15 hover:bg-[#d4ff3a]/25 text-[#d4ff3a] border border-[#d4ff3a]/30 flex items-center gap-1" data-testid="manage-props">
              <Plus className="w-3 h-3" />Adaugă/Gestionează ({properties.length})
            </button>
            {prop && (
              <button onClick={() => setTimelineFor(prop.id)} className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-full bg-white/5 hover:bg-white/10 flex items-center gap-1" data-testid="timeline-btn">
                <Calendar className="w-3 h-3" />Timeline
              </button>
            )}
            <button onClick={() => setShow2FA(true)} className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-full bg-white/5 hover:bg-white/10 flex items-center gap-1" data-testid="2fa-btn">
              <Shield className="w-3 h-3" />2FA
            </button>
            {twinUnlocked ? (
              <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">LIVE 3D · ACTIVAT</span>
            ) : twinStatus === "pending_validation" ? (
              <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20">⏳ ÎN VALIDARE</span>
            ) : twinStatus === "needs_revision" ? (
              <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-full bg-red-500/15 text-red-400 border border-red-500/20">⚠ NECESITĂ REVIZIE</span>
            ) : (
              <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-full bg-stone-500/15 text-stone-400 border border-stone-500/20">INACTIV</span>
            )}
          </div>
        </div>

        {/* Twin call-to-action */}
        {!twinUnlocked && (
          <div className="mb-6 bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/30 rounded-2xl p-5 flex items-start gap-4" data-testid="twin-cta">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-amber-400" />
            </div>
            <div className="flex-1">
              {twinStatus === "pending_validation" ? (
                <>
                  <div className="font-medium text-amber-300">Twin în validare la operator</div>
                  <p className="text-xs text-stone-400 mt-1 leading-relaxed">Operatorul nostru verifică datele proprietății și construiește modelul 3D. Primești notificare imediat ce e gata (de obicei {"<24h"}).</p>
                </>
              ) : twinStatus === "needs_revision" ? (
                <>
                  <div className="font-medium text-red-300">Twin necesită revizie</div>
                  <p className="text-xs text-stone-400 mt-1 mb-3 leading-relaxed">Operatorul are nevoie de informații suplimentare. Verifică notificările pentru detalii.</p>
                  <button onClick={requestTwin} className="px-4 py-2 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 rounded-full text-xs font-medium" data-testid="resubmit-twin">
                    Retrimite spre validare
                  </button>
                </>
              ) : (
                <>
                  <div className="font-medium text-amber-300">Activează Digital Twin gratuit</div>
                  <p className="text-xs text-stone-400 mt-1 mb-3 leading-relaxed">Cerere către operator pentru a construi modelul 3D al proprietății tale (camere, sisteme, asset-uri). Necesar pentru serviciul de Design Interior.</p>
                  <button onClick={requestTwin} className="btn-accent px-4 py-2 rounded-full text-xs font-medium flex items-center gap-1.5" data-testid="request-twin-btn">
                    <Sparkles className="w-3 h-3" />Solicită activare
                  </button>
                </>
              )}
            </div>
          </div>
        )}

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
          {!twinUnlocked && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center">
              <div className="text-center">
                <Lock className="w-8 h-8 text-stone-400 mx-auto mb-2" />
                <div className="text-sm text-stone-300">Twin neactivat</div>
              </div>
            </div>
          )}
        </div>
        <div className="grid grid-cols-3 gap-3 mb-6">
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

        <InteriorDesignCard user={user} onOpen={() => setShowDesign(true)} />
      </div>
    </>
  );
};

// ============= CYCLE PREVIEW (visible onboarding map) =============
const CyclePreview = ({ activeStep }) => {
  const steps = [
    { n: 1, t: "Proprietate", d: "Adaugă imobilul", icon: HomeIcon },
    { n: 2, t: "Digital Twin", d: "Validat de operator", icon: Building },
    { n: 3, t: "Servicii", d: "Specialiști + Design", icon: Palette },
    { n: 4, t: "Escrow & Tokens", d: "Plată sigură + recompense", icon: Sparkles },
  ];
  return (
    <div className="glass rounded-2xl p-4 mb-2" data-testid="cycle-preview">
      <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500 mb-3">Ciclul tău complet</div>
      <div className="grid grid-cols-4 gap-2 sm:gap-4">
        {steps.map((s) => {
          const done = activeStep > s.n;
          const current = Math.floor(activeStep) === s.n;
          const pending = activeStep > s.n - 1 && activeStep < s.n;
          return (
            <div key={s.n} className={`relative text-center ${done ? "" : current ? "" : "opacity-40"}`}>
              <div className={`w-10 h-10 mx-auto rounded-2xl flex items-center justify-center mb-2 ${
                done ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-300"
                : current ? "bg-[#d4ff3a]/20 border border-[#d4ff3a]/40 text-[#d4ff3a]"
                : pending ? "bg-amber-500/20 border border-amber-500/40 text-amber-300 animate-pulse"
                : "bg-white/5 border border-white/10 text-stone-500"
              }`}>
                {done ? <CheckCircle2 className="w-5 h-5" /> : <s.icon className="w-4 h-4" />}
              </div>
              <div className="text-[10px] sm:text-xs font-medium">{s.t}</div>
              <div className="text-[9px] text-stone-500 mt-0.5 hidden sm:block">{s.d}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============= TAB 2: Jobs Zone (all requests with filters) =============
const JobsZone = ({ requests, searchQ, setSearchQ, filterCat, setFilterCat, filterStatus, setFilterStatus, loadRequests, payEscrow, confirmRequest, setChatRequest, setReviewFor, setDisputeFor, setDesignPhasesFor }) => {
  useEffect(() => { loadRequests(); /* eslint-disable-next-line */ }, [searchQ, filterCat, filterStatus]);

  return (
    <div className="space-y-4 max-w-3xl mx-auto" data-testid="jobs-zone">
      <div className="glass rounded-2xl p-3 sm:p-4 sticky top-[72px] z-10 bg-[#0a0a0b]/80 backdrop-blur">
        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
          <input
            type="text" placeholder="Caută în lucrările tale..." value={searchQ} onChange={e => setSearchQ(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:border-[#d4ff3a]/50"
            data-testid="req-search"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs" data-testid="req-filter-cat">
            <option value="">Toate categoriile</option>
            <option value="hvac">HVAC</option><option value="electric">Electric</option>
            <option value="plumbing">Sanitar</option><option value="interior_design">Design Interior</option>
            <option value="other">Altele</option>
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs" data-testid="req-filter-status">
            <option value="">Toate statusurile</option>
            <option value="open">Deschis</option><option value="assigned">Asignat</option>
            <option value="in_progress">În lucru</option><option value="completed">Finalizat</option>
            <option value="confirmed">Confirmat</option>
          </select>
        </div>
      </div>
      <div className="space-y-2">
        {requests.length === 0 && (
          <div className="text-center py-16">
            <ClipboardList className="w-12 h-12 text-stone-700 mx-auto mb-3" />
            <div className="text-sm text-stone-400">Nicio solicitare încă</div>
            <div className="text-xs text-stone-600 mt-1">Plasează prima ta cerere din tab-ul "Solicită".</div>
          </div>
        )}
        {requests.map(r => (
          <div key={r.id} className="bg-white/5 rounded-2xl p-4" data-testid={`req-${r.id}`}>
            <div className="flex justify-between items-start mb-2 gap-3">
              <div className="font-medium text-sm flex-1 min-w-0">{r.title}</div>
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
            {r.category === "interior_design" && (
              <button onClick={() => setDesignPhasesFor(r)}
                className="mt-2 w-full bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 py-2 rounded-lg text-xs flex items-center justify-center gap-1"
                data-testid={`phases-${r.id}`}>
                <Palette className="w-3 h-3" />Faze design ({(r.phases || []).length})
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ============= TAB 3: Notifications Zone =============
const NotifsZone = ({ notifs, reload }) => {
  const markRead = async (id) => {
    await axios.post(`${API}/notifications/${id}/read`).catch(() => {});
    reload();
  };
  return (
    <div className="space-y-2 max-w-2xl mx-auto" data-testid="notifications-zone">
      {notifs.length === 0 && (
        <div className="text-center py-16">
          <Bell className="w-12 h-12 text-stone-700 mx-auto mb-3" />
          <div className="text-sm text-stone-400">Nicio notificare</div>
        </div>
      )}
      {notifs.map(n => (
        <button
          key={n.id}
          onClick={() => markRead(n.id)}
          className={`w-full text-left bg-white/5 rounded-2xl p-4 hover:bg-white/[0.08] transition-colors ${!n.read ? "border border-[#d4ff3a]/30" : ""}`}
          data-testid={`notif-${n.id}`}
        >
          <div className="flex items-start gap-3">
            {!n.read && <div className="w-1.5 h-1.5 rounded-full bg-[#d4ff3a] mt-2 shrink-0" />}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">{n.title}</div>
              <div className="text-xs text-stone-400 mt-1">{n.message}</div>
              <div className="text-[10px] text-stone-600 mt-2">{new Date(n.created_at).toLocaleString("ro-RO")}</div>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
};

// ============= MODALS (unchanged) =============
const NewRequestModal = ({ onClose, property, onCreated }) => {
  const [form, setForm] = useState({ title: "", description: "", category: "hvac", priority: "normal", budget_estimate: 200 });
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!property) {
      alert("Adaugă mai întâi o proprietate.");
      return;
    }
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

const DesignPhasesViewer = ({ request, onClose, onUpdate }) => {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="glass-strong rounded-3xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}
        data-testid="design-phases-viewer">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="font-serif text-2xl flex items-center gap-2"><Palette className="w-5 h-5 text-purple-400" />Faze proiect design</h2>
            <p className="text-xs text-stone-400 mt-1">{request.title}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg"><X className="w-4 h-4 text-stone-400" /></button>
        </div>
        {request.design_concept && (
          <div className="bg-white/5 rounded-2xl p-4 mb-4">
            <div className="text-xs uppercase tracking-wider text-stone-400 mb-2">Faza concept</div>
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div><span className="text-stone-500">Camere:</span> {request.design_concept.rooms_count}</div>
              <div><span className="text-stone-500">Preț:</span> {request.design_concept.full_price} RON</div>
              <div><span className="text-stone-500">Tokeni:</span> -{request.design_concept.tokens_used}</div>
            </div>
            <div className="mt-2 text-xs text-stone-300">
              Final: <span className="font-serif text-base text-purple-300">{request.design_concept.final_price} RON</span>
              {request.design_concept.style_preference && <span className="ml-3 text-stone-400">· Stil: {request.design_concept.style_preference}</span>}
            </div>
          </div>
        )}
        <DesignPhasesPanel request={request} onUpdate={onUpdate} />
      </motion.div>
    </div>
  );
};
