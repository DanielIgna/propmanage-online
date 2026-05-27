// AI Admin Investigator — chat console + findings dashboard
import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { Bot, RefreshCw, Send, AlertTriangle, CheckCircle2, X, Trash2, Plus, FileSearch } from "lucide-react";
import { AdminCard, AdminBtn } from "./AdminLayoutMetronic";
import { API } from "../DashShared";

const SEVERITY_COLORS = {
  high: "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/40",
  warning: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/40",
  low: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
};
const SEVERITY_ICONS = { high: "🔴", warning: "🟠", low: "🟡" };

export const AdminAIConsole = () => {
  const [findings, setFindings] = useState({ items: [], total: 0, counts: {}, by_severity: {} });
  const [statusFilter, setStatusFilter] = useState("open");
  const [scanning, setScanning] = useState(false);
  const [lastScan, setLastScan] = useState(null);

  // Chat state
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  const loadFindings = async () => {
    try {
      const r = await axios.get(`${API}/admin/ai/findings?status=${statusFilter}`);
      setFindings(r.data);
    } catch { /* ignore */ }
  };

  const loadSessions = async () => {
    try {
      const r = await axios.get(`${API}/admin/ai/chat/sessions`);
      setSessions(r.data.items || []);
    } catch { /* ignore */ }
  };

  const loadMessages = async (sid) => {
    if (!sid) { setMessages([]); return; }
    try {
      const r = await axios.get(`${API}/admin/ai/chat/sessions/${sid}/messages`);
      setMessages(r.data.messages || []);
    } catch {
      setMessages([]);
    }
  };

  useEffect(() => { loadFindings(); }, [statusFilter]);
  useEffect(() => { loadSessions(); }, []);
  useEffect(() => { loadMessages(activeSessionId); }, [activeSessionId]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const runScan = async () => {
    setScanning(true);
    try {
      const r = await axios.post(`${API}/admin/ai/scan/run`);
      setLastScan(r.data);
      await loadFindings();
    } catch (e) {
      window.alert(`Scan eșuat: ${e?.response?.data?.detail || e.message}`);
    } finally {
      setScanning(false);
    }
  };

  const dismissFinding = async (f) => {
    const note = window.prompt(`Marchezi finding-ul "${f.label}" ca ignorat. Notă opțională:`, "");
    if (note === null) return;
    await axios.post(`${API}/admin/ai/findings/${f.id}/dismiss`, { note });
    loadFindings();
  };

  const resolveFinding = async (f) => {
    const note = window.prompt(`Marchezi finding-ul "${f.label}" ca rezolvat. Notă (recomandat — explică ce ai făcut):`, "");
    if (note === null) return;
    await axios.post(`${API}/admin/ai/findings/${f.id}/resolve`, { note });
    loadFindings();
  };

  const sendMessage = async () => {
    if (!input.trim() || sending) return;
    const msg = input.trim();
    setInput("");
    setSending(true);
    // Optimistic local append
    setMessages(m => [...m, { role: "user", content: msg, created_at: new Date().toISOString() }]);
    try {
      const r = await axios.post(`${API}/admin/ai/chat/send`, { session_id: activeSessionId, message: msg });
      if (!activeSessionId) setActiveSessionId(r.data.session_id);
      setMessages(m => [...m, { role: "assistant", content: r.data.message, created_at: new Date().toISOString() }]);
      loadSessions();
    } catch (e) {
      setMessages(m => [...m, { role: "assistant", content: `❌ Eroare: ${e?.response?.data?.detail || e.message}` }]);
    } finally {
      setSending(false);
    }
  };

  const newSession = () => {
    setActiveSessionId(null);
    setMessages([]);
  };

  const deleteSession = async (sid, ev) => {
    ev.stopPropagation();
    if (!window.confirm("Ștergi conversația?")) return;
    await axios.delete(`${API}/admin/ai/chat/sessions/${sid}`);
    if (activeSessionId === sid) newSession();
    loadSessions();
  };

  return (
    <div className="space-y-4" data-testid="admin-ai-console">
      {/* Findings dashboard */}
      <AdminCard
        title={
          <div className="flex items-center gap-2">
            <FileSearch className="w-4 h-4 text-blue-500" />
            <span>AI Investigator · Findings</span>
            {findings.counts?.open > 0 && (
              <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300">{findings.counts.open} deschise</span>
            )}
          </div>
        }
        action={
          <div className="flex items-center gap-2">
            <AdminBtn variant="primary" onClick={runScan} disabled={scanning} data-testid="ai-scan-trigger">
              <RefreshCw className={`w-3.5 h-3.5 ${scanning ? "animate-spin" : ""}`} /> {scanning ? "Scanez..." : "Rulează scan"}
            </AdminBtn>
          </div>
        }
      >
        <div className="flex items-center gap-2 mb-3 flex-wrap text-xs">
          {["open", "dismissed", "resolved", "all"].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-full font-medium border transition-colors ${
                statusFilter === s
                  ? "bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-500/20 dark:border-blue-500/50 dark:text-blue-300"
                  : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
              }`}
              data-testid={`ai-filter-${s}`}
            >{s}{s === "open" && findings.counts.open ? ` (${findings.counts.open})` : ""}</button>
          ))}
          <span className="text-slate-500 ml-2">
            high: <b className="text-red-600">{findings.by_severity?.high || 0}</b> ·
            warn: <b className="text-amber-600">{findings.by_severity?.warning || 0}</b> ·
            low: <b className="text-slate-500">{findings.by_severity?.low || 0}</b>
          </span>
          {lastScan && (
            <span className="text-slate-400 ml-auto">
              Ultimul scan: {new Date(lastScan.finished_at).toLocaleString("ro-RO")} · {lastScan.new_findings} noi · {lastScan.updated_findings} actualizate
            </span>
          )}
        </div>

        {findings.items.length === 0 ? (
          <div className="text-center py-8 text-slate-400 italic">
            {statusFilter === "open" ? "🎉 Nicio anomalie deschisă — platforma e curată!" : `Niciun finding cu status "${statusFilter}"`}
          </div>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto" data-testid="ai-findings-list">
            {findings.items.map(f => (
              <div key={f.id} className={`flex items-start gap-3 p-3 rounded-lg border ${SEVERITY_COLORS[f.severity] || SEVERITY_COLORS.low}`} data-testid={`finding-${f.id}`}>
                <span className="text-lg shrink-0">{SEVERITY_ICONS[f.severity]}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">{f.label}</div>
                  <div className="text-xs opacity-80 break-all">{f.entity_label}</div>
                  <div className="text-[11px] opacity-60 mt-1">
                    {f.pattern} · prima dată: {f.first_seen_at?.slice(0, 16).replace("T", " ")} · ocurențe: <b>{f.occurrences}</b>
                  </div>
                  {f.resolution_note && (
                    <div className="text-[11px] italic mt-1 opacity-75">📝 "{f.resolution_note}"</div>
                  )}
                </div>
                {f.status === "open" && (
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => resolveFinding(f)} className="p-1.5 rounded hover:bg-white/30 dark:hover:bg-black/30" title="Marchează ca rezolvat" data-testid={`finding-resolve-${f.id}`}>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    </button>
                    <button onClick={() => dismissFinding(f)} className="p-1.5 rounded hover:bg-white/30 dark:hover:bg-black/30" title="Ignoră" data-testid={`finding-dismiss-${f.id}`}>
                      <X className="w-4 h-4 text-slate-500" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </AdminCard>

      {/* Chat console */}
      <AdminCard
        title={
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-blue-500" />
            <span>Chat cu Investigator</span>
            <span className="text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">Claude Sonnet 4.5</span>
          </div>
        }
        action={<AdminBtn variant="secondary" onClick={newSession}><Plus className="w-3.5 h-3.5" /> Conversație nouă</AdminBtn>}
      >
        <div className="grid md:grid-cols-[200px_1fr] gap-3">
          {/* Sessions sidebar */}
          <div className="space-y-1 max-h-[400px] overflow-y-auto" data-testid="ai-sessions-list">
            {sessions.length === 0 && <div className="text-xs text-slate-400 italic p-2">Nicio conversație încă</div>}
            {sessions.map(s => (
              <div
                key={s.session_id}
                onClick={() => setActiveSessionId(s.session_id)}
                className={`group p-2 rounded-lg cursor-pointer text-xs flex items-start gap-1 ${
                  activeSessionId === s.session_id
                    ? "bg-blue-50 dark:bg-blue-500/15 border border-blue-200 dark:border-blue-500/40"
                    : "hover:bg-slate-50 dark:hover:bg-slate-800/50 border border-transparent"
                }`}
                data-testid={`ai-session-${s.session_id}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate text-slate-700 dark:text-slate-300">{s.title || "—"}</div>
                  <div className="text-[10px] text-slate-400">{s.message_count} mesaje · {new Date(s.last_message_at).toLocaleDateString("ro-RO")}</div>
                </div>
                <button onClick={(ev) => deleteSession(s.session_id, ev)} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500" title="Șterge"><Trash2 className="w-3 h-3" /></button>
              </div>
            ))}
          </div>

          {/* Chat area */}
          <div className="flex flex-col min-h-[400px] border border-slate-200 dark:border-slate-700 rounded-lg">
            <div className="flex-1 p-3 overflow-y-auto space-y-3 max-h-[400px]" data-testid="ai-chat-messages">
              {messages.length === 0 && (
                <div className="text-center py-8 text-slate-400 text-sm">
                  <Bot className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  Pornește o conversație. Întrebări utile:
                  <div className="mt-3 space-y-1 text-xs">
                    <div className="italic">"Care sunt cele mai grave probleme acum?"</div>
                    <div className="italic">"Spune-mi ce s-a întâmplat ieri pe platformă"</div>
                    <div className="italic">"Cum stă incident response cadence?"</div>
                  </div>
                </div>
              )}
              {messages.map((m, idx) => (
                <div key={idx} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-blue-500 text-white rounded-br-sm"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-sm"
                  }`}>
                    {m.content}
                  </div>
                </div>
              ))}
              {sending && (
                <div className="flex justify-start">
                  <div className="bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-2xl text-sm text-slate-500 italic">Investigator gândește...</div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 p-2 flex gap-2">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder="Întreabă Investigatorul... (Enter = trimite, Shift+Enter = linie nouă)"
                rows={2}
                className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm resize-none"
                disabled={sending}
                data-testid="ai-chat-input"
              />
              <AdminBtn variant="primary" onClick={sendMessage} disabled={sending || !input.trim()} data-testid="ai-chat-send">
                <Send className="w-3.5 h-3.5" />
              </AdminBtn>
            </div>
          </div>
        </div>

        <div className="mt-3 text-[11px] text-slate-500 italic flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          Investigator are <b>doar acces read-only</b>. Nu execută nicio acțiune — sugerează doar. Tu păstrezi controlul 100%.
        </div>
      </AdminCard>
    </div>
  );
};

export default AdminAIConsole;
