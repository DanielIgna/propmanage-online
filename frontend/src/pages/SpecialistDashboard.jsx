// PropManage - Specialist Dashboard with 4-zone bottom navigation
// Tabs: Oportunități | Lucrările mele | Notificări | Setări
import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Wallet, Star, Briefcase, Award, Sparkles, FileCheck, MessageSquare, AlertTriangle,
  Palette, Plus, Image as ImageIcon, Target, ClipboardCheck, Bell,
  Settings as SettingsIcon, Search, RefreshCw, Clock,
} from "lucide-react";
import { useAuth, formatApiError } from "../auth";
import { ChatPanel } from "./ChatPanel";
import { OpenDisputeModal, SpecialistDocumentsModal } from "./AdminModals";
import { ProposePhaseModal } from "./InteriorDesign";
import { PortfolioManagerModal } from "./Portfolio";
import { ProjectListSection } from "./ProjectWorkspace";
import { API, DashLayout, Stat, StatusBadge, NavigateButtons } from "./DashShared";
import { BottomNav } from "./BottomNav";
import { SettingsPanel } from "./SettingsPanel";
import { RequestTimelineModal, ScheduleProposalModal, LastActionBanner } from "./ActivityTimeline";

export const SpecialistDashboard = () => {
  const { user, refreshUser } = useAuth();
  const [requests, setRequests] = useState([]);
  const [notifs, setNotifs] = useState([]);
  const [chatRequest, setChatRequest] = useState(null);
  const [showDocs, setShowDocs] = useState(false);
  const [disputeFor, setDisputeFor] = useState(null);
  const [proposePhaseFor, setProposePhaseFor] = useState(null);
  const [showPortfolio, setShowPortfolio] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);
  const [tab, setTab] = useState("opportunities");
  const [searchQ, setSearchQ] = useState("");
  const [acceptingReq, setAcceptingReq] = useState(null);  // {id, title} for ScheduleProposalModal
  const [timelineRequestId, setTimelineRequestId] = useState(null);

  const load = () => axios.get(`${API}/requests`).then(r => setRequests(r.data)).catch(() => {});
  const loadNotifs = () => axios.get(`${API}/notifications`).then(r => setNotifs(r.data)).catch(() => {});
  useEffect(() => {
    if (user) {
      load();
      loadNotifs();
      const interval = setInterval(loadNotifs, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const openAccept = (r) => setAcceptingReq({ id: r.id, title: r.title });
  const start = async (id) => { try { await axios.post(`${API}/requests/${id}/start`); load(); } catch (e) { alert(formatApiError(e)); } };
  const complete = async (id) => { try { await axios.post(`${API}/requests/${id}/complete`); load(); } catch (e) { alert(formatApiError(e)); } };

  const open = requests.filter(r => r.status === "open");
  const mine = requests.filter(r => r.specialist_id === user?.id);
  const filtered = (list) => searchQ ? list.filter(r => (r.title + r.description + (r.category || "")).toLowerCase().includes(searchQ.toLowerCase())) : list;
  const unreadNotifs = notifs.filter(n => !n.read).length;

  const tabs = [
    { id: "opportunities", label: "Oportunități", icon: Target, badge: open.length },
    { id: "jobs", label: "Lucrările mele", icon: ClipboardCheck, badge: mine.filter(r => r.status !== "confirmed").length },
    { id: "notifications", label: "Notificări", icon: Bell, badge: unreadNotifs },
    { id: "settings", label: "Setări", icon: SettingsIcon, badge: 0 },
  ];

  const title = {
    opportunities: "Oportunități",
    jobs: "Lucrările mele",
    notifications: "Notificări",
    settings: "Setări",
  }[tab];

  return (
    <DashLayout role="specialist" title={title} bottomNav={<BottomNav tabs={tabs} active={tab} onChange={setTab} dataPrefix="spec-tab" />}>
      {!user?.verified && (
        <div className="mb-6 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center justify-between flex-wrap gap-3" data-testid="verify-banner">
          <div className="flex items-center gap-3">
            <FileCheck className="w-5 h-5 text-amber-400" />
            <div>
              <div className="text-sm font-medium">Cont neverificat</div>
              <div className="text-xs text-stone-400">Încarcă documentele pentru a primi badge "VERIFIED" și acces complet.</div>
            </div>
          </div>
          <button onClick={() => setShowDocs(true)} className="btn-accent px-4 py-2 rounded-full text-xs font-medium" data-testid="upload-docs-cta">
            Încarcă documente
          </button>
        </div>
      )}

      {tab === "opportunities" && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Stat icon={Wallet} label="Sold lead-uri" value={`${user?.wallet_balance?.toFixed(0) || 0}`} sub="RON" color="emerald" tid="spec-stat-wallet" data-tour="specialist-wallet" />
            <Stat icon={Star} label="Rating" value={user?.rating || "—"} sub={`${user?.reviews_count || 0} reviews`} color="amber" tid="spec-stat-rating" data-tour="specialist-trust-score" />
            <Stat icon={Briefcase} label="Active" value={mine.filter(r => r.status !== "confirmed").length} sub="In progress" color="cyan" tid="spec-stat-active" />
            <Stat icon={Award} label="Tier" value={user?.tier || "ENTRY"} sub={user?.verified ? "Verified" : "Pending"} tid="spec-stat-tier" />
          </div>
          <FilterBar searchQ={searchQ} setSearchQ={setSearchQ} />
          <div className="space-y-3 mt-4 max-w-3xl mx-auto" data-tour="specialist-leads">
            <div className="text-xs uppercase tracking-wider text-stone-500 px-1">{filtered(open).length} oportunități</div>
            {filtered(open).length === 0 && (
              <div className="text-center py-16">
                <Target className="w-12 h-12 text-stone-700 mx-auto mb-3" />
                <div className="text-sm text-stone-400">Niciun lead disponibil</div>
                <div className="text-xs text-stone-600 mt-1">Verifică din nou în câteva minute.</div>
              </div>
            )}
            {filtered(open).map(r => (
              <div key={r.id} className="bg-white/5 rounded-2xl p-4" data-testid={`open-${r.id}`}>
                <div className="flex justify-between items-start mb-2 gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-sm">{r.title}</div>
                    <div className="text-[10px] text-stone-500">{r.client_name} · {r.property_name}</div>
                  </div>
                  {r.priority === "urgent" && <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-1 rounded-full uppercase tracking-wider shrink-0">Urgent</span>}
                </div>
                <p className="text-xs text-stone-400 mb-3 line-clamp-2">{r.description}</p>
                <div className="flex justify-between items-center gap-2">
                  <div className="text-xs text-stone-400">Estimat: <span className="text-white">{r.budget_estimate} RON</span></div>
                  <button onClick={() => openAccept(r)} className="btn-accent px-4 py-2 rounded-full text-xs font-medium shrink-0" data-testid={`accept-${r.id}`}>
                    Acceptă (45 RON)
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === "jobs" && (
        <>
          {user?.verified && (
            <div className="mb-4 flex justify-end gap-2 flex-wrap">
              {(user?.service_categories || []).includes("interior_design") && (
                <button onClick={() => setShowNewProject(true)} className="px-4 py-2 bg-gradient-to-r from-purple-500/20 to-pink-500/20 hover:from-purple-500/30 hover:to-pink-500/30 text-purple-200 border border-purple-500/40 rounded-full text-xs flex items-center gap-2 font-medium" data-testid="new-project-btn">
                  <Plus className="w-3.5 h-3.5" />Proiect nou coordonare
                </button>
              )}
              <button onClick={() => setShowPortfolio(true)} className="px-4 py-2 bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 rounded-full text-xs flex items-center gap-2" data-testid="manage-portfolio-btn">
                <ImageIcon className="w-3.5 h-3.5" />Portofoliu
              </button>
              <button onClick={() => setShowDocs(true)} className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-full text-xs flex items-center gap-2" data-testid="manage-docs-btn" data-tour="specialist-kyc">
                <FileCheck className="w-3.5 h-3.5" />Documentele mele
              </button>
            </div>
          )}
          {(user?.service_categories || []).includes("interior_design") && (
            <div className="mb-4">
              <ProjectListSection title="Proiectele tale de coordonare" />
            </div>
          )}
          <FilterBar searchQ={searchQ} setSearchQ={setSearchQ} />
          <div className="space-y-3 mt-4 max-w-3xl mx-auto">
            <div className="text-xs uppercase tracking-wider text-stone-500 px-1">{filtered(mine).length} lucrări</div>
            {filtered(mine).length === 0 && (
              <div className="text-center py-16">
                <ClipboardCheck className="w-12 h-12 text-stone-700 mx-auto mb-3" />
                <div className="text-sm text-stone-400">Niciun job acceptat</div>
                <div className="text-xs text-stone-600 mt-1">Acceptă o oportunitate pentru a începe.</div>
              </div>
            )}
            {filtered(mine).map(r => (
              <div key={r.id} className="bg-white/5 rounded-2xl p-4" data-testid={`mine-${r.id}`}>
                <div className="flex justify-between items-start mb-2 gap-3">
                  <div className="font-medium text-sm flex-1 min-w-0">{r.title}</div>
                  <StatusBadge status={r.status} />
                </div>
                <div className="text-[10px] text-stone-500 mb-3">{r.client_name} · {r.escrow_amount ? `${r.escrow_amount} RON escrow` : "—"}</div>
                {r.property_address && (
                  <div className="mb-3"><NavigateButtons address={r.property_address} compact /></div>
                )}
                <LastActionBanner event={r.last_event} onClick={() => setTimelineRequestId(r.id)} />
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => setTimelineRequestId(r.id)} className="bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 py-2 px-3 rounded-lg text-xs flex items-center gap-1" data-testid={`spec-timeline-${r.id}`} title="Vezi timeline complet">
                    <Clock className="w-3 h-3" />
                  </button>
                  {r.status === "assigned" && (
                    <button onClick={() => start(r.id)} className="flex-1 bg-white/10 hover:bg-white/15 py-2 rounded-lg text-xs min-w-[100px]" data-testid={`start-${r.id}`}>Pornește</button>
                  )}
                  {r.status === "in_progress" && (
                    <button onClick={() => complete(r.id)} className="flex-1 btn-accent py-2 rounded-lg text-xs font-medium min-w-[100px]" data-testid={`complete-${r.id}`}>Marchează completă</button>
                  )}
                  {["assigned","in_progress","completed"].includes(r.status) && (
                    <button onClick={() => setChatRequest(r.id)} className="bg-white/10 hover:bg-white/15 py-2 px-3 rounded-lg text-xs flex items-center gap-1" data-testid={`spec-chat-${r.id}`}>
                      <MessageSquare className="w-3 h-3" />
                    </button>
                  )}
                  {["assigned","in_progress","completed"].includes(r.status) && !r.disputed && (
                    <button onClick={() => setDisputeFor(r)} className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 py-2 px-3 rounded-lg text-xs flex items-center gap-1" data-testid={`spec-dispute-${r.id}`} title="Deschide dispută">
                      <AlertTriangle className="w-3 h-3" />
                    </button>
                  )}
                </div>
                {r.disputed && <div className="mt-2 w-full bg-amber-500/15 border border-amber-500/40 text-amber-300 py-1.5 rounded-lg text-[11px] text-center">⚠ Dispută în analiză</div>}
                {r.category === "interior_design" && ["in_progress","completed","confirmed"].includes(r.status) && (
                  <button onClick={() => setProposePhaseFor(r.id)}
                    className="mt-2 w-full bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 py-1.5 rounded-lg text-[11px] flex items-center justify-center gap-1"
                    data-testid={`propose-phase-${r.id}`}>
                    <Plus className="w-3 h-3" />Propune fază nouă
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {tab === "notifications" && (
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
              onClick={async () => { await axios.post(`${API}/notifications/${n.id}/read`).catch(() => {}); loadNotifs(); }}
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
      )}

      {tab === "settings" && <SettingsPanel />}

      {chatRequest && <ChatPanel requestId={chatRequest} onClose={() => setChatRequest(null)} />}
      {showDocs && <SpecialistDocumentsModal onClose={() => setShowDocs(false)} />}
      {disputeFor && <OpenDisputeModal requestId={disputeFor.id} requestTitle={disputeFor.title} onClose={() => setDisputeFor(null)} onOpened={() => load()} />}
      {proposePhaseFor && <ProposePhaseModal requestId={proposePhaseFor} onClose={() => setProposePhaseFor(null)} onProposed={() => load()} />}
      {showPortfolio && <PortfolioManagerModal onClose={() => setShowPortfolio(false)} />}
      {acceptingReq && <ScheduleProposalModal requestId={acceptingReq.id} requestTitle={acceptingReq.title} onClose={() => setAcceptingReq(null)} onAccepted={async () => { await refreshUser(); load(); }} />}
      {timelineRequestId && <RequestTimelineModal requestId={timelineRequestId} onClose={() => setTimelineRequestId(null)} />}
      {showNewProject && <NewProjectModal onClose={() => setShowNewProject(false)} />}
    </DashLayout>
  );
};

// ============= NEW PROJECT MODAL (Designer creates coordination project) =============
const NewProjectModal = ({ onClose }) => {
  const [clients, setClients] = useState([]);
  const [form, setForm] = useState({ name: "", description: "", client_id: "", style: "modern", budget_estimate: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Load past clients (clients who interacted with this specialist)
    axios.get(`${API}/requests`).then(r => {
      const seen = new Map();
      (r.data || []).forEach(req => {
        if (req.client_id && !seen.has(req.client_id)) {
          seen.set(req.client_id, { id: req.client_id, name: req.client_name });
        }
      });
      setClients([...seen.values()]);
    }).catch(() => setClients([]));
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.client_id) { alert("Selectează clientul."); return; }
    setBusy(true);
    try {
      const payload = { ...form, budget_estimate: form.budget_estimate ? parseFloat(form.budget_estimate) : null };
      const { data } = await axios.post(`${API}/projects`, payload);
      onClose();
      // Navigate to the newly created project workspace
      window.location.href = `/projects/${data.id}`;
    } catch (e) {
      alert(e?.response?.data?.detail || "Eroare creare proiect");
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-3" onClick={onClose}>
      <form onSubmit={submit} onClick={e => e.stopPropagation()}
        className="bg-stone-950 border border-white/10 rounded-3xl p-5 w-full max-w-md space-y-3" data-testid="new-project-modal">
        <h3 className="font-serif text-xl">Proiect nou de coordonare</h3>
        <p className="text-xs text-stone-400">Creezi un workspace ClickUp-style unde adaugi clientul + specialiști (parchet, zugrăvit, faianță etc.) și aloci task-uri.</p>
        <input required placeholder="Nume proiect (ex: Renovare apartament Pipera)" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm" data-testid="new-proj-name" />
        <textarea rows={3} placeholder="Descriere (opțional)" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm" />
        <select required value={form.client_id} onChange={e => setForm({ ...form, client_id: e.target.value })}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm" data-testid="new-proj-client">
          <option value="">— Selectează client —</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {clients.length === 0 && (
          <div className="text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-xl p-2">
            Nu ai clienți încă. Acceptă mai întâi o lucrare ca să apară clienții aici.
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <select value={form.style} onChange={e => setForm({ ...form, style: e.target.value })}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm">
            <option value="modern">Modern</option>
            <option value="scandinavian">Scandinavian</option>
            <option value="minimalist">Minimalist</option>
            <option value="industrial">Industrial</option>
            <option value="boho">Boho</option>
            <option value="classic">Clasic</option>
          </select>
          <input type="number" placeholder="Buget (RON)" value={form.budget_estimate} onChange={e => setForm({ ...form, budget_estimate: e.target.value })}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm" />
        </div>
        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="flex-1 py-2 bg-white/5 rounded-full text-sm">Anulează</button>
          <button type="submit" disabled={busy || !form.client_id} className="flex-1 py-2 btn-accent rounded-full text-sm disabled:opacity-40" data-testid="new-proj-submit">
            {busy ? "..." : "Creează proiect"}
          </button>
        </div>
      </form>
    </div>
  );
};

const FilterBar = ({ searchQ, setSearchQ }) => (
  <div className="max-w-3xl mx-auto sticky top-[72px] z-10">
    <div className="glass rounded-2xl p-3 bg-[#0a0a0b]/80 backdrop-blur">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
        <input
          type="text" placeholder="Caută..." value={searchQ} onChange={e => setSearchQ(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:border-[#d4ff3a]/50"
          data-testid="spec-search"
        />
      </div>
    </div>
  </div>
);
