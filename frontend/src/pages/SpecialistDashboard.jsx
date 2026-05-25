// PropManage - Specialist Dashboard
import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Wallet, Star, Briefcase, Award, Sparkles, FileCheck, MessageSquare, AlertTriangle, Palette, Plus,
} from "lucide-react";
import { useAuth, formatApiError } from "../auth";
import { ChatPanel } from "./ChatPanel";
import { OpenDisputeModal, SpecialistDocumentsModal } from "./AdminModals";
import { ProposePhaseModal } from "./InteriorDesign";
import { API, DashLayout, Stat, StatusBadge } from "./DashShared";

export const SpecialistDashboard = () => {
  const { user, refreshUser } = useAuth();
  const [requests, setRequests] = useState([]);
  const [chatRequest, setChatRequest] = useState(null);
  const [showDocs, setShowDocs] = useState(false);
  const [disputeFor, setDisputeFor] = useState(null);
  const [proposePhaseFor, setProposePhaseFor] = useState(null);

  const load = () => axios.get(`${API}/requests`).then(r => setRequests(r.data)).catch(() => {});
  useEffect(() => { if (user) load(); }, [user]);

  const accept = async (id) => {
    try { await axios.post(`${API}/requests/${id}/accept`); await refreshUser(); load(); }
    catch (e) { alert(formatApiError(e)); }
  };
  const start = async (id) => { try { await axios.post(`${API}/requests/${id}/start`); load(); } catch (e) { alert(formatApiError(e)); } };
  const complete = async (id) => { try { await axios.post(`${API}/requests/${id}/complete`); load(); } catch (e) { alert(formatApiError(e)); } };

  const open = requests.filter(r => r.status === "open");
  const mine = requests.filter(r => r.specialist_id === user?.id);

  return (
    <DashLayout role="specialist" title={`Bună, ${user?.name?.split(" ")[0]}`}>
      {!user?.verified && (
        <div className="mb-6 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center justify-between flex-wrap gap-3" data-testid="verify-banner">
          <div className="flex items-center gap-3">
            <FileCheck className="w-5 h-5 text-amber-400" />
            <div>
              <div className="text-sm font-medium">Cont neverificat</div>
              <div className="text-xs text-stone-400">Încarcă documentele pentru a primi badge "VERIFIED" și acces complet la marketplace.</div>
            </div>
          </div>
          <button onClick={() => setShowDocs(true)} className="btn-accent px-4 py-2 rounded-full text-xs font-medium" data-testid="upload-docs-cta">
            Încarcă documente
          </button>
        </div>
      )}
      {user?.verified && (
        <div className="mb-6 flex justify-end">
          <button onClick={() => setShowDocs(true)} className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-full text-xs flex items-center gap-2" data-testid="manage-docs-btn">
            <FileCheck className="w-3.5 h-3.5" />Documentele mele
          </button>
        </div>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Stat icon={Wallet} label="Sold lead-uri" value={`${user?.wallet_balance?.toFixed(0) || 0}`} sub="RON" color="emerald" tid="spec-stat-wallet" />
        <Stat icon={Star} label="Rating" value={user?.rating || "—"} sub={`${user?.reviews_count || 0} reviews`} color="amber" tid="spec-stat-rating" />
        <Stat icon={Briefcase} label="Lucrări active" value={mine.filter(r => r.status !== "confirmed").length} sub="In progress" color="cyan" tid="spec-stat-active" />
        <Stat icon={Award} label="Tier" value={user?.tier || "ENTRY"} sub={user?.verified ? "Verified" : "Pending"} tid="spec-stat-tier" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
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
        </div>
      </div>
      {chatRequest && <ChatPanel requestId={chatRequest} onClose={() => setChatRequest(null)} />}
      {showDocs && <SpecialistDocumentsModal onClose={() => setShowDocs(false)} />}
      {disputeFor && <OpenDisputeModal requestId={disputeFor.id} requestTitle={disputeFor.title} onClose={() => setDisputeFor(null)} onOpened={() => load()} />}
      {proposePhaseFor && <ProposePhaseModal requestId={proposePhaseFor} onClose={() => setProposePhaseFor(null)} onProposed={() => load()} />}
    </DashLayout>
  );
};
