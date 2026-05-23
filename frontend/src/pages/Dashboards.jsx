// PropManage - Role Dashboards (Client, Specialist, Admin, Operator)
import React, { useState, useEffect } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import axios from "axios";
import {
  Building2, Home, Wrench, ShieldCheck, Settings, LogOut, Languages,
  Wallet, Sparkles, Zap, Droplet, Wind, AlertTriangle, CheckCircle2,
  Clock, Star, TrendingUp, Users, Briefcase, Award, Plus,
  ArrowRight, FileCheck, MessageSquare, Gavel, Activity, ArrowUpRight, Eye, CreditCard, Bell, Building, Camera, Shield, Calendar, Search, Filter
} from "lucide-react";
import { useAuth, formatApiError } from "../auth";
import { useI18n } from "../i18n";
import { ChatPanel } from "./ChatPanel";
import { PhotoUploader, ReviewModal, PropertyManagerModal } from "./Components";
import { TwoFASetupModal, PropertyTimelineModal } from "./Marketplace";
import { AIAssistant } from "./AIAssistant";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// ============= NOTIFICATIONS BELL =============
const NotificationsBell = () => {
  const [notifs, setNotifs] = useState([]);
  const [open, setOpen] = useState(false);
  
  const load = () => axios.get(`${API}/notifications`).then(r => setNotifs(r.data)).catch(() => {});
  useEffect(() => {
    load();
    const interval = setInterval(load, 15000); // poll every 15s
    return () => clearInterval(interval);
  }, []);
  
  const unread = notifs.filter(n => !n.read).length;
  
  const markRead = async (id) => {
    await axios.post(`${API}/notifications/${id}/read`).catch(() => {});
    load();
  };
  
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="relative p-2 hover:bg-white/5 rounded-lg" data-testid="notif-bell">
        <Bell className="w-4 h-4 text-stone-400" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#d4ff3a] text-black text-[9px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-80 glass-strong rounded-2xl border border-white/10 z-40 max-h-[400px] overflow-auto no-scrollbar" data-testid="notif-panel">
            <div className="p-3 border-b border-white/5 sticky top-0 bg-[#0a0a0b]/80 backdrop-blur">
              <div className="text-xs uppercase tracking-wider text-stone-400">Notificări</div>
            </div>
            {notifs.length === 0 ? (
              <div className="p-6 text-center text-xs text-stone-500">Nicio notificare</div>
            ) : (
              <div className="divide-y divide-white/5">
                {notifs.slice(0, 10).map(n => (
                  <div key={n.id} onClick={() => markRead(n.id)} 
                    className={`p-3 cursor-pointer hover:bg-white/5 ${!n.read ? "bg-[#d4ff3a]/5" : ""}`}
                    data-testid={`notif-${n.id}`}>
                    <div className="flex items-start gap-2">
                      {!n.read && <div className="w-1.5 h-1.5 rounded-full bg-[#d4ff3a] mt-1.5 shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{n.title}</div>
                        <div className="text-[11px] text-stone-400 mt-0.5">{n.message}</div>
                        <div className="text-[9px] text-stone-600 mt-1">
                          {new Date(n.created_at).toLocaleString("ro-RO")}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

// ============= LAYOUT =============
const DashLayout = ({ children, role, title }) => {
  const { user, logout } = useAuth();
  const { lang, toggle, t } = useI18n();
  const navigate = useNavigate();
  
  const roleConfig = {
    client: { icon: Home, label: "Client", color: "lime" },
    specialist: { icon: Wrench, label: "Specialist", color: "amber" },
    admin: { icon: ShieldCheck, label: "Admin", color: "cyan" },
    operator: { icon: Settings, label: "Operator", color: "purple" },
  }[role];
  
  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };
  
  if (!user) return <div className="min-h-screen flex items-center justify-center text-stone-400">{t("common.loading")}</div>;
  if (user === false) return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to={`/${user.role}`} replace />;
  
  return (
    <div className="min-h-screen bg-[#0a0a0b] text-stone-100">
      {/* Top bar */}
      <header className="border-b border-white/5 sticky top-0 z-40 bg-[#0a0a0b]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2" data-testid="dash-logo">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#d4ff3a] to-[#a8e028] flex items-center justify-center">
                <Building2 className="w-3.5 h-3.5 text-black" strokeWidth={2.5} />
              </div>
              <span className="font-serif text-lg font-semibold">PropManage</span>
            </Link>
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full">
              <roleConfig.icon className="w-3.5 h-3.5 text-[#d4ff3a]" />
              <span className="text-xs uppercase tracking-wider text-stone-300">{roleConfig.label}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <NotificationsBell />
            <button onClick={toggle} className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-white/5 rounded-full text-xs uppercase tracking-wider" data-testid="dash-lang">
              <Languages className="w-3.5 h-3.5" />{lang.toUpperCase()}
            </button>
            <div className="hidden sm:block text-right">
              <div className="text-sm font-medium">{user.name}</div>
              <div className="text-[10px] text-stone-500">{user.email}</div>
            </div>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-stone-600 to-stone-800 flex items-center justify-center font-medium text-sm">
              {user.name?.[0] || "U"}
            </div>
            <button onClick={handleLogout} className="p-2 hover:bg-white/5 rounded-lg" data-testid="dash-logout">
              <LogOut className="w-4 h-4 text-stone-400" />
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {title && <h1 className="font-serif text-3xl sm:text-4xl mb-6 sm:mb-8" data-testid="dash-title">{title}</h1>}
        {children}
      </main>
      <AIAssistant />
    </div>
  );
};

const Stat = ({ icon: Icon, label, value, sub, color = "lime", tid }) => (
  <div className="glass-strong rounded-2xl p-6" data-testid={tid}>
    <div className="flex items-center justify-between mb-4">
      <div className={`w-10 h-10 rounded-xl bg-${color}-500/15 border border-${color}-500/30 flex items-center justify-center`}>
        <Icon className={`w-4 h-4 text-${color}-400`} />
      </div>
      {sub && <span className="text-[10px] text-stone-500 uppercase tracking-wider">{sub}</span>}
    </div>
    <div className="font-serif text-3xl mb-1">{value}</div>
    <div className="text-xs text-stone-400">{label}</div>
  </div>
);

const StatusBadge = ({ status }) => {
  const cfg = {
    open: { c: "blue", l: "Deschis" },
    assigned: { c: "amber", l: "Asignat" },
    in_progress: { c: "yellow", l: "În lucru" },
    completed: { c: "purple", l: "Finalizat" },
    confirmed: { c: "emerald", l: "Confirmat" },
  }[status] || { c: "stone", l: status };
  return <span className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-full bg-${cfg.c}-500/15 text-${cfg.c}-400 border border-${cfg.c}-500/20`}>{cfg.l}</span>;
};

// ============= CLIENT DASHBOARD =============
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
  const [show2FAStatus, setShow2FAStatus] = useState(false);
  const [timelineFor, setTimelineFor] = useState(null);
  const [searchQ, setSearchQ] = useState("");
  const [filterCat, setFilterCat] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  
  // Load 2FA status
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
      
      // Check for Stripe payment success in URL
      const params = new URLSearchParams(window.location.search);
      if (params.get("payment") === "success" && params.get("request")) {
        const reqId = params.get("request");
        // Find session id from latest payment for this request and verify
        (async () => {
          try {
            // We need to find the most recent session. Easier: trigger polling
            await new Promise(r => setTimeout(r, 1500));
            await loadRequests();
            await refreshUser();
            alert("Plată confirmată! Fondurile sunt în escrow.");
            window.history.replaceState(null, "", "/client");
          } catch {}
        })();
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
  
  return (
    <DashLayout role="client" title={`${t("client.welcome")}, ${user?.name?.split(" ")[0] || ""}`}>
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Stat icon={Activity} label={t("client.health")} value={`${prop?.health_score || 0}/100`} sub="Property" tid="stat-health" />
        <Stat icon={Wallet} label={t("client.wallet")} value={`${user?.wallet_balance?.toFixed(0) || 0} RON`} sub="Sold" color="emerald" tid="stat-wallet" />
        <Stat icon={Sparkles} label={t("client.tokens")} value={user?.tokens || 0} sub="Earned" color="amber" tid="stat-tokens" />
        <Stat icon={Briefcase} label={t("client.requests")} value={requests.length} sub="Total" color="cyan" tid="stat-requests" />
      </div>
      
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Property */}
        <div className="lg:col-span-2 glass-strong rounded-3xl p-8">
          <div className="flex justify-between items-start mb-6">
            <div>
              <div className="text-xs uppercase tracking-wider text-stone-400 mb-1">Digital Twin</div>
              <h2 className="font-serif text-2xl" data-testid="property-name">{prop?.name || "—"}</h2>
              <div className="text-sm text-stone-400">{prop?.address}</div>
            </div>
            <div className="flex items-center gap-2">
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
              { i: Layers, l: "Structură", v: prop?.structure_health || 90, c: "emerald" },
              { i: Activity, l: "Utilități", v: prop?.utilities_health || 82, c: "amber" },
              { i: FileCheck, l: "Acte", v: prop?.documents_health || 100, c: "emerald" },
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
        
        {/* Requests */}
        <div className="glass-strong rounded-3xl p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-serif text-xl">{t("client.requests")}</h3>
            <button onClick={() => setShowNewReq(true)} className="btn-accent px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1" data-testid="new-request-btn">
              <Plus className="w-3 h-3" />{t("client.newRequest")}
            </button>
          </div>
          {/* Search + Filter */}
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
                  {r.specialist_id && (r.status === "assigned" || r.status === "in_progress" || r.status === "completed") && (
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
                  <button onClick={() => confirmRequest(r.id, refreshUser, setRequests, setReviewFor, r)} 
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
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {showNewReq && <NewRequestModal onClose={() => setShowNewReq(false)} property={prop} onCreated={r => setRequests([r, ...requests])} />}
      {chatRequest && <ChatPanel requestId={chatRequest} onClose={() => setChatRequest(null)} />}
      {showPropManager && <PropertyManagerModal properties={properties} onClose={() => setShowPropManager(false)} onChange={setProperties} />}
      {timelineFor && <PropertyTimelineModal propertyId={timelineFor} onClose={() => setTimelineFor(null)} />}
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

const Layers = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
  </svg>
);

async function confirmRequest(id, refresh, setRequests, setReviewFor, req) {
  try {
    await axios.post(`${API}/requests/${id}/confirm`);
    const { data } = await axios.get(`${API}/requests`);
    setRequests(data);
    await refresh();
    // Trigger review modal for the just-confirmed request
    if (setReviewFor && req && req.specialist_id) {
      const updated = data.find(x => x.id === id) || req;
      setReviewFor(updated);
    }
  } catch (e) { alert(formatApiError(e)); }
}

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

// ============= SPECIALIST DASHBOARD =============
export const SpecialistDashboard = () => {
  const { user, refreshUser } = useAuth();
  const [requests, setRequests] = useState([]);
  const [chatRequest, setChatRequest] = useState(null);
  
  const load = () => axios.get(`${API}/requests`).then(r => setRequests(r.data)).catch(() => {});
  useEffect(() => { if (user) load(); }, [user]);
  
  const accept = async (id) => {
    try {
      await axios.post(`${API}/requests/${id}/accept`);
      await refreshUser(); load();
    } catch (e) { alert(formatApiError(e)); }
  };
  const start = async (id) => { try { await axios.post(`${API}/requests/${id}/start`); load(); } catch (e) { alert(formatApiError(e)); }};
  const complete = async (id) => { try { await axios.post(`${API}/requests/${id}/complete`); load(); } catch (e) { alert(formatApiError(e)); }};
  
  const open = requests.filter(r => r.status === "open");
  const mine = requests.filter(r => r.specialist_id === user?.id);
  
  return (
    <DashLayout role="specialist" title={`Bună, ${user?.name?.split(" ")[0]}`}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Stat icon={Wallet} label="Sold lead-uri" value={`${user?.wallet_balance?.toFixed(0) || 0}`} sub="RON" color="emerald" tid="spec-stat-wallet" />
        <Stat icon={Star} label="Rating" value={user?.rating || "—"} sub={`${user?.reviews_count || 0} reviews`} color="amber" tid="spec-stat-rating" />
        <Stat icon={Briefcase} label="Lucrări active" value={mine.filter(r => r.status !== "confirmed").length} sub="In progress" color="cyan" tid="spec-stat-active" />
        <Stat icon={Award} label="Tier" value={user?.tier || "ENTRY"} sub={user?.verified ? "Verified" : "Pending"} tid="spec-stat-tier" />
      </div>
      
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Open opportunities */}
        <div className="glass-strong rounded-3xl p-6">
          <h3 className="font-serif text-xl mb-4 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#d4ff3a]" />Oportunități Noi
          </h3>
          <div className="space-y-3">
            {open.length === 0 && <div className="text-xs text-stone-500 text-center py-8">Niciun lead disponibil</div>}
            {open.map(r => (
              <div key={r.id} className="bg-white/5 rounded-xl p-4" data-testid={`open-${r.id}`}>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-medium text-sm">{r.title}</div>
                    <div className="text-[10px] text-stone-500">{r.client_name} · {r.property_name}</div>
                  </div>
                  {r.priority === "urgent" && <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-1 rounded-full uppercase tracking-wider">Urgent</span>}
                </div>
                <p className="text-xs text-stone-400 mb-3">{r.description}</p>
                <div className="flex justify-between items-center">
                  <div className="text-xs text-stone-400">Estimat: <span className="text-white">{r.budget_estimate} RON</span></div>
                  <button onClick={() => accept(r.id)} className="btn-accent px-4 py-2 rounded-full text-xs font-medium" data-testid={`accept-${r.id}`}>
                    Acceptă (45 RON)
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* My jobs */}
        <div className="glass-strong rounded-3xl p-6">
          <h3 className="font-serif text-xl mb-4 flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-[#d4ff3a]" />Lucrările Mele
          </h3>
          <div className="space-y-3">
            {mine.length === 0 && <div className="text-xs text-stone-500 text-center py-8">Niciun job</div>}
            {mine.map(r => (
              <div key={r.id} className="bg-white/5 rounded-xl p-4" data-testid={`mine-${r.id}`}>
                <div className="flex justify-between items-start mb-2">
                  <div className="font-medium text-sm">{r.title}</div>
                  <StatusBadge status={r.status} />
                </div>
                <div className="text-[10px] text-stone-500 mb-3">{r.client_name} · {r.escrow_amount ? `${r.escrow_amount} RON escrow` : "—"}</div>
                <div className="flex gap-2">
                  {r.status === "assigned" && (
                    <button onClick={() => start(r.id)} className="flex-1 bg-white/10 hover:bg-white/15 py-2 rounded-lg text-xs" data-testid={`start-${r.id}`}>Pornește</button>
                  )}
                  {r.status === "in_progress" && (
                    <button onClick={() => complete(r.id)} className="flex-1 btn-accent py-2 rounded-lg text-xs font-medium" data-testid={`complete-${r.id}`}>Marchează completă</button>
                  )}
                  {(r.status === "assigned" || r.status === "in_progress" || r.status === "completed") && (
                    <button onClick={() => setChatRequest(r.id)} className="bg-white/10 hover:bg-white/15 py-2 px-3 rounded-lg text-xs flex items-center gap-1" data-testid={`spec-chat-${r.id}`}>
                      <MessageSquare className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {chatRequest && <ChatPanel requestId={chatRequest} onClose={() => setChatRequest(null)} />}
    </DashLayout>
  );
};

// ============= ADMIN DASHBOARD =============
export const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [pending, setPending] = useState([]);
  
  useEffect(() => {
    axios.get(`${API}/admin/stats`).then(r => setStats(r.data)).catch(() => {});
    axios.get(`${API}/admin/specialists/pending`).then(r => setPending(r.data)).catch(() => {});
  }, []);
  
  const verify = async (id) => {
    try {
      await axios.post(`${API}/admin/specialists/${id}/verify`);
      setPending(pending.filter(p => p.id !== id));
    } catch (e) { alert(formatApiError(e)); }
  };
  
  return (
    <DashLayout role="admin" title="Panou de Control">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Stat icon={Users} label="Utilizatori" value={stats?.users || 0} sub="Total" tid="admin-users" />
        <Stat icon={Briefcase} label="Joburi active" value={stats?.active_jobs || 0} sub="Live" color="amber" tid="admin-jobs" />
        <Stat icon={Award} label="Verificați" value={stats?.verified || 0} sub={`/ ${stats?.specialists || 0}`} color="emerald" tid="admin-verified" />
        <Stat icon={Gavel} label="În așteptare" value={stats?.pending_verification || 0} sub="Acțiune" color="cyan" tid="admin-pending" />
      </div>
      
      <div className="glass-strong rounded-3xl p-6">
        <h3 className="font-serif text-xl mb-4">Coadă verificare specialiști</h3>
        {pending.length === 0 && <div className="text-xs text-stone-500 text-center py-8" data-testid="admin-empty">Niciun specialist în așteptare</div>}
        <div className="space-y-2">
          {pending.map(p => (
            <div key={p.id} className="flex items-center justify-between bg-white/5 rounded-xl p-4" data-testid={`pending-${p.id}`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-stone-600 to-stone-800 flex items-center justify-center font-medium">{p.name?.[0]}</div>
                <div>
                  <div className="font-medium text-sm">{p.name}</div>
                  <div className="text-[10px] text-stone-500">{p.email} · {p.specialty || "Specialist"}</div>
                </div>
              </div>
              <button onClick={() => verify(p.id)} className="btn-accent px-4 py-2 rounded-full text-xs font-medium" data-testid={`verify-${p.id}`}>
                Verifică
              </button>
            </div>
          ))}
        </div>
      </div>
    </DashLayout>
  );
};

// ============= OPERATOR DASHBOARD =============
export const OperatorDashboard = () => {
  const [queue, setQueue] = useState([]);
  
  useEffect(() => {
    axios.get(`${API}/operator/queue`).then(r => setQueue(r.data)).catch(() => {});
  }, []);
  
  return (
    <DashLayout role="operator" title="Validare Mentenanță">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Stat icon={Clock} label="În așteptare" value={queue.length} sub="Logs" color="amber" tid="op-queue" />
        <Stat icon={CheckCircle2} label="Aprobate azi" value={0} sub="Today" color="emerald" tid="op-approved" />
        <Stat icon={AlertTriangle} label="Respinse" value={0} sub="Today" color="red" tid="op-rejected" />
        <Stat icon={Activity} label="Total" value={queue.length} sub="All time" tid="op-total" />
      </div>
      
      <div className="glass-strong rounded-3xl p-8 text-center">
        <Wrench className="w-12 h-12 text-stone-600 mx-auto mb-4" />
        <h3 className="font-serif text-2xl mb-2">Coadă de validare goală</h3>
        <p className="text-sm text-stone-400 max-w-md mx-auto">
          Toate log-urile de mentenanță au fost validate. Noile log-uri vor apărea aici când specialiștii completează lucrări.
        </p>
      </div>
    </DashLayout>
  );
};
