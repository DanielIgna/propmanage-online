// PropManage - Client Dashboard with 4-zone bottom navigation
// Tabs: Solicită serviciu | Lucrările mele | Notificări | Setări
import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import axios from "axios";
import {
  Wallet, Sparkles, Activity, Briefcase, Plus, MessageSquare,
  AlertTriangle, Star, CreditCard, Building, Camera, Shield, Calendar, Search, Palette, X,
  Bell, Settings as SettingsIcon, ClipboardList, Search as SearchIcon,
  Home as HomeIcon, CheckCircle2, Lock, Clock,
} from "lucide-react";
import { useAuth, formatApiError } from "../auth";
import { useI18n } from "../i18n";
import { ChatPanel } from "./ChatPanel";
import { PhotoUploader, ReviewModal, PropertyManagerModal } from "./Components";
import { TwoFASetupModal, PropertyTimelineModal } from "./Marketplace";
import { OpenDisputeModal } from "./AdminModals";
import { InteriorDesignCard, InteriorDesignModal, DesignPhasesPanel } from "./InteriorDesign";
import { ClientTwinViewerModal, DesignersBrowse } from "./ClientTwinViewer";
import DigitalTwinViewer from "../components/DigitalTwinViewer";
import { ProjectListSection } from "./ProjectWorkspace";
import { API, DashLayout, Stat, StatusBadge, NavigateButtons } from "./DashShared";
import { BottomNav } from "./BottomNav";
import { SettingsPanel } from "./SettingsPanel";
import { RequestTimelineModal, LastActionBanner } from "./ActivityTimeline";

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
  const [showTwinViewer, setShowTwinViewer] = useState(false);
  // When opening a twin from anywhere other than the currently-selected property,
  // we override the property used by the viewer. null = use currently selected `prop`.
  const [twinPropOverride, setTwinPropOverride] = useState(null);
  const [newReqCategory, setNewReqCategory] = useState(null);
  const [designPhasesFor, setDesignPhasesFor] = useState(null);
  const [timelineRequestId, setTimelineRequestId] = useState(null);
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
          setShowDesign={setShowDesign} setTab={setTab} setShowTwinViewer={setShowTwinViewer}
          setNewReqCategory={setNewReqCategory}
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
          setTimelineRequestId={setTimelineRequestId}
        />
      )}
      {tab === "notifications" && <NotifsZone notifs={notifs} reload={loadNotifs} />}
      {tab === "settings" && <SettingsPanel />}

      {showNewReq && <NewRequestModal onClose={() => { setShowNewReq(false); setNewReqCategory(null); }} property={prop} initialCategory={newReqCategory} onCreated={r => setRequests([r, ...requests])} />}
      {chatRequest && <ChatPanel requestId={chatRequest} onClose={() => setChatRequest(null)} />}
      {showPropManager && <PropertyManagerModal
        properties={properties}
        onClose={() => setShowPropManager(false)}
        onChange={setProperties}
        onOpenTwin={(twinInfo) => {
          // twinInfo: { property_id, property_name, dt_project_id, model_url }
          setTwinPropOverride(twinInfo);
          setShowPropManager(false);
          setShowTwinViewer(true);
        }}
      />}
      {timelineFor && <PropertyTimelineModal propertyId={timelineFor} onClose={() => setTimelineFor(null)} />}
      {disputeFor && <OpenDisputeModal requestId={disputeFor.id} requestTitle={disputeFor.title} onClose={() => setDisputeFor(null)} onOpened={() => loadRequests()} />}
      {showDesign && <InteriorDesignModal onClose={() => setShowDesign(false)} onCreated={() => loadRequests()} />}
      {showTwinViewer && (twinPropOverride || prop) && (() => {
        const t = twinPropOverride || { property_id: prop.id, property_name: prop.name };
        // If we have a real 3D project with model uploaded, open the Three.js viewer
        // (rotation 360° · X-Ray · wireframe · sections · pins · screenshots)
        if (t.dt_project_id && t.model_url) {
          return (
            <DigitalTwinViewer
              projectId={t.dt_project_id}
              modelUrl={t.model_url}
              projectName={t.property_name || t.dt_project_name}
              onClose={() => { setShowTwinViewer(false); setTwinPropOverride(null); }}
            />
          );
        }
        // Fallback: 2D top-down room layout from the legacy twins collection
        return (
          <ClientTwinViewerModal
            propertyId={t.property_id}
            propertyName={t.property_name}
            onClose={() => { setShowTwinViewer(false); setTwinPropOverride(null); }}
          />
        );
      })()}
      {designPhasesFor && <DesignPhasesViewer request={designPhasesFor} onClose={() => setDesignPhasesFor(null)} onUpdate={() => { loadRequests(); refreshUser(); }} />}
      {timelineRequestId && <RequestTimelineModal requestId={timelineRequestId} onClose={() => setTimelineRequestId(null)} />}
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
// ============= QUICK SERVICES GRID (visible category shortcuts) =============
const QUICK_SERVICES = [
  { id: "interior_design", label: "Design Interior", icon: Palette, color: "purple", twin: true, premium: true },
  { id: "parchet", label: "Parchet", icon: Building, color: "amber", twin: false },
  { id: "zugravit", label: "Zugrăvit", icon: Palette, color: "cyan", twin: false },
  { id: "faianta", label: "Faianță / Gresie", icon: Building, color: "emerald", twin: false },
  { id: "handyman", label: "Handyman", icon: Briefcase, color: "stone", twin: false },
  { id: "gips_carton", label: "Gips-carton", icon: Building, color: "rose", twin: false },
];

const QuickServicesGrid = ({ twinUnlocked, twinStatus, onPick, onDesignPick, onRequestTwin }) => {
  const [lockMsgFor, setLockMsgFor] = useState(null);
  return (
    <div className="glass-strong rounded-3xl p-5 sm:p-6 mb-6 relative" data-testid="quick-services-grid" data-tour="client-marketplace">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500 mb-1">Servicii rapide</div>
          <h3 className="font-serif text-lg">Amenajări interioare · alege categoria</h3>
        </div>
        {!twinUnlocked && (
          <div className="text-[10px] uppercase tracking-wider text-amber-400 px-2 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center gap-1">
            <Lock className="w-3 h-3" />Design necesită Twin
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {QUICK_SERVICES.map(s => {
          const locked = s.twin && !twinUnlocked;
          const Icon = s.icon;
          return (
            <button key={s.id}
              onClick={() => {
                if (locked) { setLockMsgFor(s.id); return; }
                if (s.id === "interior_design") { onDesignPick(); }
                else { onPick(s.id); }
              }}
              className={`text-left rounded-2xl p-3 border transition-all group relative overflow-hidden ${
                locked
                  ? "bg-white/[0.02] border-white/5 opacity-70 hover:opacity-90"
                  : "bg-white/5 hover:bg-white/10 border-white/10 hover:border-[#d4ff3a]/40"
              }`}
              data-testid={`quick-service-${s.id}`}
            >
              {s.premium && (
                <span className="absolute top-1.5 right-1.5 text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">PRO</span>
              )}
              <div className={`w-9 h-9 rounded-xl mb-2 flex items-center justify-center bg-${s.color}-500/15 border border-${s.color}-500/30`}>
                {locked ? <Lock className={`w-4 h-4 text-${s.color}-300/60`} /> : <Icon className={`w-4 h-4 text-${s.color}-300`} />}
              </div>
              <div className="text-sm font-medium leading-tight">{s.label}</div>
              <div className="text-[10px] uppercase tracking-wider text-stone-500 mt-1">
                {locked ? "Necesită Twin" : "Solicită ofertă →"}
              </div>
            </button>
          );
        })}
      </div>

      {/* Lock explanation inline */}
      {lockMsgFor && (
        <div className="mt-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-start gap-3" data-testid="twin-required-msg">
          <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-medium text-sm text-amber-300">Activează Digital Twin mai întâi</div>
            <p className="text-xs text-stone-400 mt-1 mb-3 leading-relaxed">
              Serviciul de Design Interior se bazează pe modelul 3D al proprietății tale (camere + dimensiuni reale). Solicită acum activarea twin-ului — durează sub 24h.
            </p>
            <div className="flex gap-2 flex-wrap">
              {twinStatus !== "pending_validation" && (
                <button onClick={() => { onRequestTwin(); setLockMsgFor(null); }}
                  className="btn-accent px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5"
                  data-testid="twin-required-request-btn">
                  <Sparkles className="w-3 h-3" />Solicită activare Twin
                </button>
              )}
              {twinStatus === "pending_validation" && (
                <span className="px-3 py-1.5 rounded-full text-xs bg-amber-500/15 text-amber-300 border border-amber-500/40">
                  ⏳ Twin în validare la operator
                </span>
              )}
              <button onClick={() => setLockMsgFor(null)} className="text-xs text-stone-500 hover:text-stone-300 px-3 py-1.5" data-testid="twin-required-close">
                Înțeleg, închide
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const RequestZone = ({ user, prop, properties, requests, setSelectedPropId, setProperties, setShowNewReq, setShowPropManager, setTimelineFor, setShow2FA, setShowDesign, setTab, setShowTwinViewer, setNewReqCategory }) => {
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
          <Stat icon={Wallet} label={t("client.wallet")} value={`${user?.wallet_balance?.toFixed(0) || 0} RON`} sub="Portofel" color="emerald" tid="stat-wallet" />
          <Stat icon={Sparkles} label={t("client.tokens")} value={user?.tokens || 0} sub="Tokeni" color="amber" tid="stat-tokens" />
          <Stat icon={Briefcase} label={t("client.requests")} value={requests.length} sub="Solicitări" color="cyan" tid="stat-requests" />
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
              className="pm-btn pm-btn-primary pm-btn-lg"
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <Stat icon={Activity} label={t("client.health")} value={`${prop?.health_score || 0}/100`} sub="Proprietate" tid="stat-health" />
        <Stat icon={Wallet} label={t("client.wallet")} value={`${user?.wallet_balance?.toFixed(0) || 0} RON`} sub="Portofel" color="emerald" tid="stat-wallet" />
        <Stat icon={Sparkles} label={t("client.tokens")} value={user?.tokens || 0} sub="Tokeni" color="amber" tid="stat-tokens" />
        <Stat icon={Briefcase} label={t("client.requests")} value={requests.length} sub="Solicitări" color="cyan" tid="stat-requests" />
      </div>

      <WalletTopupBar onSuccess={refreshUser} />

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
            className="pm-btn pm-btn-primary"
            data-testid="new-request-cta"
            data-tour="client-new-request"
          >
            <Plus className="w-4 h-4" />Solicită serviciu
          </button>
        </div>
      </div>

      {/* Quick Services Grid — visible category shortcuts with twin gating */}
      <QuickServicesGrid
        twinUnlocked={twinUnlocked}
        twinStatus={twinStatus}
        onPick={(cat) => { setNewReqCategory(cat); setShowNewReq(true); }}
        onDesignPick={() => setShowDesign(true)}
        onRequestTwin={requestTwin}
      />

      {/* Digital Twin Card */}
      <div className="glass-strong rounded-3xl p-6 sm:p-8" data-tour="client-property-card">
        <div className="flex justify-between items-start mb-6 flex-wrap gap-3">
          <div>
            <div className="text-xs uppercase tracking-wider text-stone-400 mb-1">Digital Twin</div>
            <h2 className="font-serif text-2xl" data-testid="property-name">{prop?.name || "—"}</h2>
            <div className="text-sm text-stone-400">{prop?.address}</div>
            {prop?.address && <div className="mt-2"><NavigateButtons address={prop.address} compact /></div>}
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
              <button onClick={() => setShowTwinViewer(true)} className="text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5 transition" data-testid="open-twin-viewer">
                <Sparkles className="w-3 h-3" />Deschide Twin 3D
              </button>
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
                  <button onClick={requestTwin} className="pm-btn pm-btn-primary pm-btn-sm" data-testid="request-twin-btn">
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

        {/* ALWAYS VISIBLE Twin primary CTA */}
        {twinUnlocked && (
          <button
            onClick={() => setShowTwinViewer(true)}
            className="w-full mb-4 bg-gradient-to-r from-emerald-500/20 via-[#d4ff3a]/15 to-cyan-500/20 hover:from-emerald-500/30 hover:via-[#d4ff3a]/25 hover:to-cyan-500/30 border border-emerald-500/40 rounded-2xl px-5 py-4 flex items-center justify-between gap-3 transition-all group"
            data-testid="twin-cta-big"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/25 border border-emerald-500/50 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Sparkles className="w-5 h-5 text-emerald-300" />
              </div>
              <div className="text-left">
                <div className="font-medium text-sm text-emerald-200">Digital Twin activ · Vezi modelul 3D</div>
                <div className="text-xs text-stone-400">Camere, asset-uri tehnice și stare în timp real</div>
              </div>
            </div>
            <div className="text-[10px] uppercase tracking-wider text-emerald-300 px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 shrink-0">DESCHIDE →</div>
          </button>
        )}

        <InteriorDesignCard user={user} onOpen={() => setShowDesign(true)} />

        {/* Designers list — connected when twin is unlocked */}
        {twinUnlocked && <DesignersBrowse onSelect={() => setShowDesign(true)} />}
      </div>

      {/* Projects where this client is a member (read-only view) */}
      <ProjectListSection title="Proiectele tale de amenajare" />
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
    <div className="glass rounded-2xl p-4 mb-2" data-testid="cycle-preview" data-tour="client-escrow-info">
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
const JobsZone = ({ requests, searchQ, setSearchQ, filterCat, setFilterCat, filterStatus, setFilterStatus, loadRequests, payEscrow, confirmRequest, setChatRequest, setReviewFor, setDisputeFor, setDesignPhasesFor, setTimelineRequestId }) => {
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
            <LastActionBanner event={r.last_event} onClick={() => setTimelineRequestId(r.id)} />
            <div className="flex gap-2 mt-3">
              <button onClick={() => setTimelineRequestId(r.id)} className="bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 py-2 px-3 rounded-lg text-xs flex items-center gap-1" data-testid={`client-timeline-${r.id}`} title="Vezi timeline complet">
                <Clock className="w-3 h-3" />Timeline
              </button>
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
const NewRequestModal = ({ onClose, property, onCreated, initialCategory }) => {
  const [form, setForm] = useState({ title: "", description: "", category: initialCategory || "hvac", priority: "normal", budget_estimate: 200 });
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
            <option value="interior_design">Design Interior</option>
            <option value="parchet">Parchet</option>
            <option value="zugravit">Zugrăvit</option>
            <option value="faianta">Faianță / Gresie</option>
            <option value="handyman">Handyman</option>
            <option value="gips_carton">Gips-carton</option>
            <option value="hvac">HVAC / Climatizare</option>
            <option value="electric">Electric</option>
            <option value="plumbing">Sanitar</option>
            <option value="carpentry">Dulgherie</option>
            <option value="other">Altele</option>
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
            <button type="button" onClick={onClose} className="pm-btn pm-btn-secondary flex-1">Anulează</button>
            <button type="submit" disabled={loading} className="pm-btn pm-btn-primary flex-1" data-testid="newreq-submit">
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


// ============= WALLET TOPUP BAR (Stripe Checkout) =============
const WalletTopupBar = ({ onSuccess }) => {
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const presets = [100, 250, 500, 1000];

  const topup = async (val) => {
    const amt = parseFloat(val || amount);
    if (!amt || amt <= 0 || amt > 50000) {
      alert("Sumă invalidă (1-50,000 RON)");
      return;
    }
    setBusy(true);
    try {
      const { data } = await axios.post(`${API}/wallet/topup-checkout-session`, {
        amount: amt,
        origin: window.location.origin,
      });
      // Redirect to Stripe Checkout (or demo success page)
      window.location.href = data.checkout_url;
    } catch (e) {
      alert(formatApiError(e));
      setBusy(false);
    }
  };

  return (
    <div className="glass-strong rounded-2xl p-4 mb-8 flex flex-wrap items-center gap-3" data-testid="wallet-topup-bar">
      <div className="flex items-center gap-2 mr-auto">
        <CreditCard className="w-4 h-4 text-[#d4ff3a]" />
        <span className="text-sm font-medium">Alimentează wallet</span>
        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300">via Stripe</span>
      </div>
      {presets.map(p => (
        <button
          key={p}
          onClick={() => topup(p)}
          disabled={busy}
          className="px-3 py-1.5 rounded-full text-xs bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-50"
          data-testid={`topup-preset-${p}`}
        >
          +{p} RON
        </button>
      ))}
      <div className="flex gap-1.5">
        <input
          type="number"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder="Sumă"
          min="1" max="50000"
          className="w-24 px-2 py-1.5 rounded-full bg-white/5 text-xs text-center border border-white/10"
          data-testid="topup-custom-amount"
        />
        <button
          onClick={() => topup()}
          disabled={busy || !amount}
          className="btn-accent px-3 py-1.5 rounded-full text-xs font-medium disabled:opacity-50"
          data-testid="topup-custom-btn"
        >
          {busy ? "..." : "Plătește"}
        </button>
      </div>
    </div>
  );
};
