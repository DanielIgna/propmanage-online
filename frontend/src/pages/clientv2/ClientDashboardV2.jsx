// Client Beta — shell: 4 destinații (Acasă · Lucrări · Casa mea · Mai mult) + UN CTA primar.
// Toată logica de business (plăți escrow, confirmări, wizard, modale, deep-link-uri, Stripe return) e păstrată.
import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { Home, Plus, Wrench, Building2, Menu, Bell } from "lucide-react";
import { useAuth, formatApiError } from "../../auth";
import { API } from "../DashShared";
import { LIME } from "./ui";
import { Sheet, ExplainSheet } from "./ui3";
import { ThemeSwitcher } from "../../components/ThemeSwitcher";
import { useHouseData } from "./data3";
import { HomeV3, HomeSkeleton, HomeIntroTour } from "./HomeV3";
import { JobsV3 } from "./JobsV3";
import { HouseV3 } from "./HouseV3";
import { MoreV3, WalletSheet } from "./MoreV3";
import { RequestWizard } from "./RequestWizard";
import { ChatPanel } from "../ChatPanel";
import { ReviewModal, PropertyManagerModal } from "../Components";
import { TwoFASetupModal, PropertyTimelineModal } from "../Marketplace";
import { OpenDisputeModal } from "../AdminModals";
import { ClientTwinViewerModal } from "../ClientTwinViewer";
import DigitalTwinViewer from "../../components/DigitalTwinViewer";
import { RequestTimelineModal } from "../ActivityTimeline";
import HouseHealthCard from "../HouseHealthCard";
import { HelpButton } from "../../components/HelpButton";
import { SubscriptionNotice } from "../../components/SubscriptionNotice";
import { claimPendingInvite } from "../../components/ReferralHub";
import { TrustedSpecialists } from "../../components/TrustedSpecialists";
import { useMobileDock } from "../../components/floating";
import { PostJobGrowthLoop } from "../../components/PostJobGrowthLoop";

const NAV = [[Home, "Acasă", "home"], [Wrench, "Lucrări", "jobs"], [Building2, "Casa mea", "house"], [Menu, "Mai mult", "more"]];
const TITLES = { home: null, jobs: null, house: null, more: "Mai mult" };
// Aliasuri pentru deep-link-urile existente (/client?tab=property|settings|benefits, Copilot, onboarding)
const TAB_ALIAS = { property: "house", settings: "more", benefits: "more" };
const greeting = () => { const h = new Date().getHours(); return h < 12 ? "Bună dimineața" : h < 18 ? "Bună ziua" : "Bună seara"; };
const track = (signal) => import("../../lib/analytics").then(({ trackIntent }) => trackIntent(signal)).catch(() => {});

export default function ClientDashboardV2() {
  useMobileDock(64);
  const navigate = useNavigate();
  const { user, refreshUser, logout } = useAuth();
  const flowOpenedRef = useRef(false);
  const [loaded, setLoaded] = useState(false);
  const [properties, setProperties] = useState([]);
  const [requests, setRequests] = useState([]);
  const [notifs, setNotifs] = useState([]);
  const [selectedPropId, setSelectedPropId] = useState(null);
  const [offersCount, setOffersCount] = useState(0);
  const [tab, setTab] = useState("home");
  const [houseSection, setHouseSection] = useState("rezumat");
  const [jobsFilter, setJobsFilter] = useState("all");
  const [jobsNonce, setJobsNonce] = useState(0);
  const [moreSection, setMoreSection] = useState(null);
  const [explainInd, setExplainInd] = useState(null);
  // modale / sheets
  const [showWizard, setShowWizard] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showWallet, setShowWallet] = useState(false);
  const [showHealth, setShowHealth] = useState(false);
  const [showPropManager, setShowPropManager] = useState(false);
  const [show2FA, setShow2FA] = useState(false);
  const [showTwin, setShowTwin] = useState(false);
  const [twinOverride, setTwinOverride] = useState(null);
  const [chatRequest, setChatRequest] = useState(null);
  const [reviewFor, setReviewFor] = useState(null);
  const [growthLoopFor, setGrowthLoopFor] = useState(null);
  const [disputeFor, setDisputeFor] = useState(null);
  const [timelineRequestId, setTimelineRequestId] = useState(null);
  const [propTimelineFor, setPropTimelineFor] = useState(null);

  const loadRequests = () => axios.get(`${API}/requests`).then(r => setRequests(r.data)).catch(() => {});
  const loadNotifs = () => axios.get(`${API}/notifications`).then(r => setNotifs(r.data)).catch(() => {});
  const loadProps = () => axios.get(`${API}/properties`).then(r => setProperties(r.data)).catch(() => {});

  const prop = properties.find(p => p.id === selectedPropId) || properties[0] || null;
  const d = useHouseData(prop);

  const openWizard = () => {
    if (prop) { track("client_property_selected"); setShowWizard(true); }
    else setShowPropManager(true);
  };

  const go = (t, section) => {
    const tabId = TAB_ALIAS[t] || t;
    if (t === "request") { openWizard(); return; }
    if (!["home", "jobs", "house", "more"].includes(tabId)) return;
    setTab(tabId);
    if (tabId === "house") setHouseSection(section || "rezumat");
    if (tabId === "jobs") { setJobsFilter(section || "all"); setJobsNonce(n => n + 1); }
    if (tabId === "more") setMoreSection(t === "benefits" ? "beneficii" : section || null);
    window.scrollTo({ top: 0 });
  };

  // CTA-uri „Adaugă primul document" (Copilot „Fă pasul acum", bannere) → direct în Cartea casei
  useEffect(() => {
    const openBook = () => go("house", "carte");
    window.addEventListener("propmanage:open-house-book", openBook);
    return () => window.removeEventListener("propmanage:open-house-book", openBook);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user || user === false) return;
    claimPendingInvite();
    // Funnel comercial (etapa 1): client a intrat pe /client — o dată/mount
    if (!flowOpenedRef.current) { flowOpenedRef.current = true; track("client_flow_opened"); }
    Promise.all([loadProps(), loadRequests(), loadNotifs()]).finally(() => setLoaded(true));
    const interval = setInterval(loadNotifs, 30000);
    // Deep-link taburi: /client?tab=home|jobs|property|house|settings|more|benefits|request(&sec=)
    const params = new URLSearchParams(window.location.search);
    const wantedTab = params.get("tab");
    const wantedSec = params.get("sec");
    const bInvite = params.get("binvite");
    if (bInvite) {
      localStorage.setItem("pm_building_invite", bInvite);
      params.delete("binvite");
      setTab("house"); setHouseSection("bloc");
      const rest0 = params.toString();
      window.history.replaceState(null, "", `/client${rest0 ? `?${rest0}` : ""}`);
    }
    if (wantedTab) {
      if (wantedTab === "request") setShowWizard(true);
      else go(wantedTab, wantedSec || undefined);
      params.delete("tab"); params.delete("sec");
      const rest = params.toString();
      window.history.replaceState(null, "", `/client${rest ? `?${rest}` : ""}`);
    }
    // Stripe return polling (identic cu dashboardul clasic)
    const payParams = new URLSearchParams(window.location.search);
    if (payParams.get("payment") === "success" && payParams.get("session_id")) {
      const sessionId = payParams.get("session_id");
      let attempts = 0;
      const poll = async () => {
        if (attempts >= 6) { alert("Verificarea plății a expirat. Verifică în câteva minute."); window.history.replaceState(null, "", "/client"); return; }
        attempts++;
        try {
          const { data } = await axios.get(`${API}/payments/status/${sessionId}`);
          if (data.payment_status === "paid") {
            await loadRequests(); await refreshUser();
            alert(data.demo_mode ? "Plată confirmată (demo). Fondurile sunt în escrow." : "Plată confirmată! Fondurile sunt în escrow.");
            window.history.replaceState(null, "", "/client"); return;
          }
          if (data.status === "expired") { alert("Sesiunea de plată a expirat."); window.history.replaceState(null, "", "/client"); return; }
          setTimeout(poll, 2000);
        } catch { setTimeout(poll, 2500); }
      };
      poll();
    } else if (params.get("payment") === "cancelled") {
      alert("Plata a fost anulată."); window.history.replaceState(null, "", "/client");
    }
    return () => clearInterval(interval);
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const firstOpen = requests.find(r => r.status === "open");
  useEffect(() => {
    if (firstOpen) {
      axios.get(`${API}/requests/${firstOpen.id}/offers`).then(r => setOffersCount((r.data?.offers || r.data || []).length)).catch(() => setOffersCount(0));
    } else setOffersCount(0);
  }, [firstOpen?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const payEscrow = async (reqId) => {
    try {
      const { data } = await axios.post(`${API}/payments/checkout-session?request_id=${reqId}`);
      window.location.href = data.checkout_url;
    } catch (e) { alert(formatApiError(e)); }
  };

  const confirmRequest = async (id, r) => {
    try {
      await axios.post(`${API}/requests/${id}/confirm`);
      track("flow_completed");
      const { data } = await axios.get(`${API}/requests`);
      setRequests(data);
      await refreshUser();
      d.reload();
      if (r?.specialist_id) setReviewFor(data.find(x => x.id === id) || r);
    } catch (e) { alert(formatApiError(e)); }
  };

  const markRead = async (id) => { await axios.post(`${API}/notifications/${id}/read`).catch(() => {}); loadNotifs(); };

  const actions = {
    payEscrow, confirmRequest, setChatRequest, setReviewFor, setDisputeFor, setTimelineRequestId,
    reloadRequests: loadRequests,
    openWizard,
    openPropManager: () => setShowPropManager(true),
    openNotifs: () => setShowNotifs(true),
    openWallet: () => setShowWallet(true),
    openHealth: () => { track("audit_viewed"); setShowHealth(true); },
    openTwin: () => { track("twin_viewed"); (prop ? setShowTwin(true) : setShowPropManager(true)); },
    openPropTimeline: () => prop && setPropTimelineFor(prop.id),
    openAI: () => window.dispatchEvent(new CustomEvent("pm-open-ai")),
  };

  // O singură hartă acțiune → logică reală (folosită de toate ecranele)
  const act = (kind, p) => {
    const map = {
      request: actions.openWizard,
      addProperty: actions.openPropManager,
      manage: actions.openPropManager,
      pay: () => payEscrow(p.id),
      confirm: () => confirmRequest(p.id, p),
      offers: () => navigate(`/client/requests/${p.id}/offers`),
      open: () => setTimelineRequestId(p.id),
      timeline: () => setTimelineRequestId(p.id),
      chat: () => setChatRequest(p.id),
      review: () => setReviewFor(p),
      dispute: () => setDisputeFor(p),
      maint: () => go("house", "calendar"),
      goJobs: () => go("jobs"),
      reloadRequests: loadRequests,
      notifs: actions.openNotifs,
      wallet: actions.openWallet,
      health: actions.openHealth,
      hhUpgrade: () => navigate("/house-health/upgrade"),
      twin: actions.openTwin,
      gis: () => prop && navigate(`/property/${prop.id}/gis`),
      propTimeline: actions.openPropTimeline,
      ai: actions.openAI,
      "2fa": () => setShow2FA(true),
      logout: async () => { await logout(); window.location.href = "/login"; },
      // Copilot: pasul recomandat → destinația reală (Cartea casei, tab, rută)
      copilot: () => {
        const path = p?.cta_path || p?.cta || "";
        if (p?.id === "docs_for_benefit") return go("house", "carte");
        if (path.startsWith("/client?tab=")) { const u = new URLSearchParams(path.split("?")[1]); return go(u.get("tab"), u.get("sec") || undefined); }
        if (["property", "benefits", "jobs", "request", "settings", "home", "house", "more"].includes(path)) return go(path);
        if (path) navigate(path);
      },
      mentor: () => window.dispatchEvent(new CustomEvent("pm-open-mentor", { detail: { focus_path: p?.cta_path || p?.cta || "", focus_title: p?.title || "", focus_id: p?.id || "" } })),
    };
    (map[kind] || (() => {}))();
  };

  const data = { ...d, prop, properties, requests, notifs, offersCount };
  const unread = notifs.filter(n => !n.read).length;
  const pendingCount = requests.filter(r => (r.status === "assigned" && !r.escrow_amount) || r.status === "completed").length;
  const ready = loaded && d.loaded;

  return (
    <div className="min-h-screen bg-[#FAFBFA] cv2-scope" data-testid="client-dashboard-v2">
      <div className="max-w-md lg:max-w-6xl mx-auto min-h-screen relative pb-28 lg:pb-16 lg:px-6">
        {/* Header compact */}
        <div className="flex items-center gap-3 px-5 lg:px-0 pt-4 pb-3" data-testid="v2-header">
          <span className="w-10 h-10 rounded-full flex items-center justify-center text-black text-sm font-black shrink-0" style={{ background: LIME }}>{(user?.name || "C")[0].toUpperCase()}</span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-black text-slate-900 leading-none truncate">{greeting()}, {user?.name?.split(" ")[0] || ""}</div>
            {prop && <button type="button" onClick={() => go("house", "rezumat")} className="mt-1 text-[11px] font-semibold text-slate-500 truncate max-w-full min-h-[20px] block text-left" data-testid="v2-header-prop">{prop.name}{prop.address ? ` · ${prop.address}` : ""}</button>}
          </div>
          <button type="button" onClick={() => setShowNotifs(true)} aria-label="Notificări" className="relative w-11 h-11 rounded-full bg-white border border-slate-100 flex items-center justify-center shrink-0" data-testid="v2-bell">
            <Bell className="w-[18px] h-[18px] text-slate-600" />
            {unread > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-black text-[9px] font-black flex items-center justify-center" style={{ background: LIME }} data-testid="v2-bell-badge">{unread > 99 ? "99+" : unread}</span>}
          </button>
          <HelpButton light />
          <ThemeSwitcher />
        </div>

        {/* Desktop: 4 destinații + UN CTA primar */}
        <div className="hidden lg:flex items-center gap-2 pb-5" data-testid="v2-desktop-nav">
          {NAV.map(([Icon, label, id]) => (
            <button type="button" key={id} onClick={() => go(id)} data-testid={`v2-desktop-nav-${id}`}
              className={`relative inline-flex items-center gap-2 min-h-[44px] px-4 rounded-full text-sm font-bold transition-colors ${tab === id ? "bg-slate-900 text-white" : "bg-white text-slate-600 border border-slate-100 hover:bg-slate-50"}`}>
              <Icon className="w-[18px] h-[18px]" /> {label}
              {id === "jobs" && pendingCount > 0 && <span className={`ml-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-black flex items-center justify-center ${tab === id ? "bg-[#ccff00] text-black" : "bg-slate-900 text-white"}`}>{pendingCount > 99 ? "99+" : pendingCount}</span>}
            </button>
          ))}
          <button type="button" onClick={actions.openWizard} data-testid="v2-desktop-cta"
            className="ml-auto inline-flex items-center gap-2 min-h-[46px] px-6 rounded-full text-sm font-black text-black shadow-[0_12px_36px_-12px_rgba(204,255,0,0.55)] hover:scale-[1.02] transition-transform" style={{ background: LIME }}>
            <Plus className="w-[18px] h-[18px]" strokeWidth={2.6} /> {prop ? "Solicită ofertă" : "Adaugă proprietatea"}
          </button>
        </div>

        {TITLES[tab] && !(tab === "more" && moreSection === "beneficii") && <h1 className="px-5 lg:px-0 pb-3 xos-display text-2xl lg:text-[34px] font-medium tracking-tight text-slate-900">{TITLES[tab]}</h1>}

        {/* Subscription lifecycle notice (expired / cancelled_grace) */}
        <div className="px-5 lg:px-0 pb-3 lg:max-w-3xl"><SubscriptionNotice /></div>

        {!ready ? <HomeSkeleton /> : (
          <>
            {tab === "home" && <><HomeV3 d={data} go={go} act={act} explain={setExplainInd} /><HomeIntroTour /></>}
            {tab === "jobs" && <div className="lg:max-w-3xl"><JobsV3 key={jobsNonce} requests={requests} act={act} initialFilter={jobsFilter} offersCount={offersCount} firstOpenId={firstOpen?.id} /><TrustedSpecialists properties={properties} onRebooked={loadRequests} /></div>}
            {tab === "house" && <HouseV3 d={data} prop={prop} properties={properties} section={houseSection} setSection={setHouseSection} explain={setExplainInd} act={act} go={go} setSelectedPropId={setSelectedPropId} reloadRequests={loadRequests} />}
            {tab === "more" && <MoreV3 d={data} user={user} go={go} act={act} section={moreSection} prop={prop} />}
          </>
        )}

        {/* Mobile: spațiu rezervat cât timp cookie banner-ul e deschis (nu acoperă CTA-uri) */}
        <div aria-hidden style={{ height: "var(--pm-cookie-h, 0px)" }} className="lg:hidden" data-testid="v2-cookie-spacer" />

        {/* Mobil: 4 destinații + FAB central (o mână) */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 xos-dock" data-testid="v2-bottom-nav">
          <div className="max-w-md mx-auto grid grid-cols-5">
            {[NAV[0], NAV[1], null, NAV[2], NAV[3]].map((item) => item ? (
              <button type="button" key={item[2]} onClick={() => go(item[2])} data-testid={`v2-nav-${item[2]}`} className="relative flex flex-col items-center gap-1 pt-2.5 pb-3 min-h-[60px]">
                {React.createElement(item[0], { className: `w-6 h-6 ${tab === item[2] ? "text-[#166534]" : "text-slate-400"}`, strokeWidth: tab === item[2] ? 2.4 : 2 })}
                <span className={`text-[10px] font-bold ${tab === item[2] ? "text-[#166534]" : "text-slate-400"}`}>{item[1]}</span>
                {item[2] === "jobs" && pendingCount > 0 && <span className="absolute top-1.5 right-[22%] min-w-[16px] h-4 px-1 rounded-full bg-slate-900 text-[#ccff00] text-[9px] font-black flex items-center justify-center">{pendingCount > 99 ? "99+" : pendingCount}</span>}
              </button>
            ) : (
              <button type="button" key="fab" onClick={actions.openWizard} data-testid="v2-nav-request" className="flex flex-col items-center gap-1 pt-2.5 pb-3" aria-label="Solicită">
                <span className="w-[52px] h-[52px] -mt-7 rounded-full flex items-center justify-center shadow-[0_10px_32px_-10px_rgba(204,255,0,0.6)]" style={{ background: LIME }}><Plus className="w-6 h-6 text-black" strokeWidth={2.5} /></span>
                <span className="text-[10px] font-bold text-slate-500">Solicită</span>
              </button>
            ))}
          </div>
        </div>

        {/* Sheets & modale */}
        {explainInd && <ExplainSheet ind={explainInd} onClose={() => setExplainInd(null)} onGo={(g) => { setExplainInd(null); go(...g); }} />}
        {showNotifs && (
          <Sheet title="Notificări" sub={`${unread} necitite`} onClose={() => setShowNotifs(false)} tid="v2-notifs-sheet">
            {notifs.length === 0 && <p className="text-center text-sm text-slate-400 py-8">Nicio notificare încă.</p>}
            <div className="space-y-2">
              {notifs.map(n => (
                <button type="button" key={n.id} onClick={() => markRead(n.id)} data-testid={`v2-notif-${n.id}`}
                  className={`w-full text-left rounded-2xl p-3.5 border ${n.read ? "border-slate-100 bg-white" : "border-[#166534]/25 bg-[#F6FEE7]"}`}>
                  <div className="text-xs font-black text-slate-900">{n.title}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{n.message}</div>
                  <div className="text-[10px] text-slate-400 mt-1">{new Date(n.created_at).toLocaleString("ro-RO")}</div>
                </button>
              ))}
            </div>
          </Sheet>
        )}
        {showWallet && <WalletSheet user={user} onClose={() => setShowWallet(false)} />}
        {showHealth && (
          <Sheet title="House Health" onClose={() => setShowHealth(false)} tid="v2-health-sheet">
            <HouseHealthCard />
          </Sheet>
        )}
        {showWizard && <RequestWizard property={prop} onCreated={(r) => setRequests(prev => [r, ...prev])} onClose={(dest) => { setShowWizard(false); if (dest === "jobs") go("jobs"); }} />}
        {showPropManager && <PropertyManagerModal properties={properties} onClose={() => setShowPropManager(false)} onChange={setProperties}
          onOpenTwin={(twinInfo) => { setTwinOverride(twinInfo); setShowPropManager(false); setShowTwin(true); }} />}
        {showTwin && (twinOverride || prop) && (() => {
          const t = twinOverride || { property_id: prop.id, property_name: prop.name };
          if (t.dt_project_id && t.model_url) {
            return <DigitalTwinViewer projectId={t.dt_project_id} modelUrl={t.model_url} projectName={t.property_name || t.dt_project_name}
              onClose={() => { setShowTwin(false); setTwinOverride(null); }} />;
          }
          return <ClientTwinViewerModal propertyId={t.property_id} propertyName={t.property_name} onClose={() => { setShowTwin(false); setTwinOverride(null); }} />;
        })()}
        {chatRequest && <ChatPanel requestId={chatRequest} onClose={() => setChatRequest(null)} />}
        {reviewFor && <ReviewModal requestId={reviewFor.id} specialistName={reviewFor.specialist_name} onClose={() => setReviewFor(null)}
          onSubmitted={async () => { await refreshUser(); loadRequests(); if (reviewFor?.specialist_id) setGrowthLoopFor(reviewFor); }} />}
        {growthLoopFor && <PostJobGrowthLoop job={growthLoopFor} onClose={() => setGrowthLoopFor(null)} />}
        {disputeFor && <OpenDisputeModal requestId={disputeFor.id} requestTitle={disputeFor.title} onClose={() => setDisputeFor(null)} onOpened={() => loadRequests()} />}
        {timelineRequestId && <RequestTimelineModal requestId={timelineRequestId} onClose={() => setTimelineRequestId(null)} />}
        {propTimelineFor && <PropertyTimelineModal propertyId={propTimelineFor} onClose={() => setPropTimelineFor(null)} />}
        {show2FA && <TwoFASetupModal onClose={() => setShow2FA(false)} currentlyEnabled={false} />}
      </div>
    </div>
  );
}
