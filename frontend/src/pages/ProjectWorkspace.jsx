// Project Workspace (ClickUp-style) — viewable by designer (PM), client, and assigned specialists
import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { motion } from "framer-motion";
import {
  ArrowLeft, Plus, Users, CheckCircle2, Clock, AlertTriangle, MessageSquare,
  Trash2, X, Building2, Palette, Send, ListChecks, Loader2, Flag,
} from "lucide-react";
import { useAuth } from "../auth";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STATUS_COLS = [
  { id: "todo", label: "De făcut", icon: ListChecks, color: "stone" },
  { id: "in_progress", label: "În lucru", icon: Loader2, color: "amber" },
  { id: "review", label: "Verificare", icon: AlertTriangle, color: "cyan" },
  { id: "done", label: "Finalizate", icon: CheckCircle2, color: "emerald" },
];
const PRIORITY = {
  low: { label: "Scăzut", color: "stone" },
  normal: { label: "Normal", color: "white" },
  high: { label: "Înalt", color: "amber" },
  urgent: { label: "Urgent", color: "red" },
};

export const ProjectWorkspace = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("tasks");
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [taskDetail, setTaskDetail] = useState(null);

  const load = async () => {
    try {
      const [p, t] = await Promise.all([
        axios.get(`${API}/projects/${id}`),
        axios.get(`${API}/projects/${id}/tasks`),
      ]);
      setProject(p.data);
      setTasks(t.data);
    } catch (e) {
      setError(e?.response?.data?.detail || "Nu ai acces sau proiectul nu există.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [id]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-stone-400">Se încarcă proiectul...</div>;
  if (error) return (
    <div className="min-h-screen flex items-center justify-center flex-col gap-3 px-6 text-center">
      <AlertTriangle className="w-10 h-10 text-amber-400" />
      <div className="text-stone-300">{error}</div>
      <button onClick={() => navigate(-1)} className="px-4 py-2 bg-white/5 rounded-full text-sm" data-testid="back-btn">Înapoi</button>
    </div>
  );

  const isDesigner = project.designer_id === user?.id;
  const isClient = project.client_id === user?.id;
  const myMember = (project.members || []).find(m => m.user_id === user?.id);
  const role = isDesigner ? "designer" : (isClient ? "client" : (myMember?.role || "guest"));

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-stone-100">
      <header className="border-b border-white/5 sticky top-0 z-30 bg-[#0a0a0b]/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3 flex-wrap">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-stone-300 hover:text-white" data-testid="proj-back">
            <ArrowLeft className="w-4 h-4" />Înapoi
          </button>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30">PROIECT · {role.toUpperCase()}</span>
            <span className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-full border ${
              project.status === "active" ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" :
              project.status === "completed" ? "bg-blue-500/15 text-blue-300 border-blue-500/30" :
              "bg-stone-500/15 text-stone-300 border-stone-500/30"
            }`}>{project.status}</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Title block */}
        <div className="glass-strong rounded-3xl p-5 sm:p-6">
          <div className="text-[10px] uppercase tracking-wider text-stone-400 mb-1">Proiect coordonat de {project.designer_name}</div>
          <h1 className="font-serif text-2xl sm:text-3xl mb-2" data-testid="proj-title">{project.name}</h1>
          {project.description && <p className="text-sm text-stone-400 leading-relaxed mb-3">{project.description}</p>}
          <div className="flex flex-wrap gap-2 text-[11px]">
            <span className="px-2 py-1 rounded-full bg-white/5 text-stone-300 flex items-center gap-1">
              <Building2 className="w-3 h-3 text-[#d4ff3a]" />Client: {project.client_name}
            </span>
            {project.style && (
              <span className="px-2 py-1 rounded-full bg-purple-500/10 text-purple-300 flex items-center gap-1 capitalize">
                <Palette className="w-3 h-3" />{project.style}
              </span>
            )}
            <span className="px-2 py-1 rounded-full bg-white/5 text-stone-300 flex items-center gap-1">
              <Users className="w-3 h-3" />{(project.members?.length || 0) + 1} membri
            </span>
            <span className="px-2 py-1 rounded-full bg-white/5 text-stone-300 flex items-center gap-1">
              <ListChecks className="w-3 h-3" />{tasks.length} task-uri · {tasks.filter(t => t.status === "done").length} done
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 text-sm">
          {["tasks", "members", "activity"].map(k => (
            <button key={k} onClick={() => setTab(k)}
              className={`px-4 py-2 rounded-full transition ${tab === k ? "bg-[#d4ff3a] text-black font-medium" : "bg-white/5 text-stone-400 hover:bg-white/10"}`}
              data-testid={`proj-tab-${k}`}>
              {{ tasks: "Task-uri", members: "Echipa", activity: "Activitate" }[k]}
            </button>
          ))}
        </div>

        {tab === "tasks" && (
          <TasksBoard tasks={tasks} isDesigner={isDesigner} project={project}
            onNewTask={() => setNewTaskOpen(true)}
            onOpenTask={(t) => setTaskDetail(t)}
            onUpdate={load} />
        )}

        {tab === "members" && (
          <MembersList project={project} isDesigner={isDesigner}
            onAddMember={() => setAddMemberOpen(true)}
            onRemoved={load} />
        )}

        {tab === "activity" && (
          <ActivityFeed tasks={tasks} />
        )}
      </main>

      {newTaskOpen && (
        <NewTaskModal project={project} onClose={() => setNewTaskOpen(false)} onCreated={load} />
      )}
      {addMemberOpen && (
        <AddMemberModal project={project} onClose={() => setAddMemberOpen(false)} onAdded={load} />
      )}
      {taskDetail && (
        <TaskDetailModal task={taskDetail} project={project} onClose={() => setTaskDetail(null)} onUpdate={load} currentUser={user} />
      )}
    </div>
  );
};

// ============= TASKS BOARD =============
const TasksBoard = ({ tasks, isDesigner, project, onNewTask, onOpenTask, onUpdate }) => {
  const grouped = STATUS_COLS.reduce((acc, c) => ({ ...acc, [c.id]: tasks.filter(t => t.status === c.id) }), {});
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        {isDesigner && (
          <button onClick={onNewTask} className="btn-accent px-4 py-2 rounded-full text-sm flex items-center gap-1.5" data-testid="new-task-btn">
            <Plus className="w-4 h-4" />Task nou
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {STATUS_COLS.map(col => {
          const Icon = col.icon;
          return (
            <div key={col.id} className="bg-white/[0.03] border border-white/5 rounded-2xl p-3" data-testid={`col-${col.id}`}>
              <div className={`flex items-center gap-2 mb-3 text-${col.color}-300`}>
                <Icon className="w-4 h-4" />
                <div className="text-[10px] uppercase tracking-wider font-medium">{col.label}</div>
                <span className="ml-auto text-xs text-stone-500">{grouped[col.id].length}</span>
              </div>
              <div className="space-y-2 min-h-[60px]">
                {grouped[col.id].length === 0 ? (
                  <div className="text-[11px] text-stone-600 italic py-2 text-center">— gol —</div>
                ) : grouped[col.id].map(t => (
                  <button key={t.id} onClick={() => onOpenTask(t)}
                    className="w-full text-left bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl p-3 transition group"
                    data-testid={`task-card-${t.id}`}>
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="text-sm font-medium leading-tight">{t.title}</div>
                      {t.priority && t.priority !== "normal" && (
                        <Flag className={`w-3 h-3 shrink-0 text-${PRIORITY[t.priority].color}-400`} />
                      )}
                    </div>
                    {t.assignee_name && (
                      <div className="text-[10px] uppercase tracking-wider text-stone-500 mt-1">→ {t.assignee_name}</div>
                    )}
                    {t.comments_count > 0 && (
                      <div className="text-[10px] text-stone-500 mt-1 flex items-center gap-1">
                        <MessageSquare className="w-2.5 h-2.5" />{t.comments_count}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============= MEMBERS LIST =============
const MembersList = ({ project, isDesigner, onAddMember, onRemoved }) => {
  const allMembers = [
    { user_id: project.designer_id, name: project.designer_name, role: "designer", is_designer: true },
    ...(project.members || []),
  ];
  const remove = async (uid) => {
    if (!window.confirm("Sigur elimini acest membru?")) return;
    try {
      await axios.delete(`${API}/projects/${project.id}/members/${uid}`);
      onRemoved();
    } catch (e) { alert(e?.response?.data?.detail || "Eroare"); }
  };
  return (
    <div className="glass-strong rounded-3xl p-5">
      <div className="flex justify-between items-center mb-4">
        <div className="text-[10px] uppercase tracking-wider text-stone-400">Echipa proiectului · {allMembers.length}</div>
        {isDesigner && (
          <button onClick={onAddMember} className="text-xs px-3 py-1.5 rounded-full bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/40 flex items-center gap-1" data-testid="add-member-btn">
            <Plus className="w-3 h-3" />Adaugă specialist
          </button>
        )}
      </div>
      <div className="space-y-2">
        {allMembers.map(m => (
          <div key={m.user_id} className="bg-white/5 border border-white/5 rounded-2xl p-3 flex items-center gap-3" data-testid={`member-row-${m.user_id}`}>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500/30 to-pink-500/30 flex items-center justify-center font-medium text-purple-200">
              {(m.name || "?").charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{m.name}</div>
              <div className="text-[10px] uppercase tracking-wider text-stone-500 capitalize">
                {m.is_designer ? "Coordonator (designer)" : m.role}
                {m.specialty && ` · ${m.specialty}`}
              </div>
            </div>
            {isDesigner && !m.is_designer && m.role !== "client" && (
              <button onClick={() => remove(m.user_id)} className="text-stone-500 hover:text-red-400 p-2" data-testid={`remove-${m.user_id}`}>
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ============= ACTIVITY FEED (recent tasks/updates) =============
const ActivityFeed = ({ tasks }) => {
  const sorted = [...tasks].sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || "")).slice(0, 20);
  return (
    <div className="glass-strong rounded-3xl p-5">
      <div className="text-[10px] uppercase tracking-wider text-stone-400 mb-4">Activitate recentă</div>
      {sorted.length === 0 ? (
        <div className="text-sm text-stone-500 text-center py-6">Niciun task încă.</div>
      ) : (
        <div className="space-y-2">
          {sorted.map(t => (
            <div key={t.id} className="bg-white/5 border border-white/5 rounded-2xl p-3 text-sm flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{t.title}</div>
                <div className="text-[10px] uppercase tracking-wider text-stone-500 mt-1">
                  {t.status} · {t.assignee_name || "neasignat"} · {new Date(t.updated_at).toLocaleDateString("ro-RO")}
                </div>
              </div>
              <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${
                t.status === "done" ? "bg-emerald-500/15 text-emerald-300" :
                t.status === "in_progress" ? "bg-amber-500/15 text-amber-300" :
                "bg-stone-500/15 text-stone-300"
              }`}>{t.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ============= MODALS =============
const NewTaskModal = ({ project, onClose, onCreated }) => {
  const members = [
    { user_id: project.designer_id, name: project.designer_name },
    ...(project.members || []),
  ];
  const [form, setForm] = useState({ title: "", description: "", assignee_id: "", priority: "normal", due_date: "" });
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await axios.post(`${API}/projects/${project.id}/tasks`, { ...form, assignee_id: form.assignee_id || null });
      onCreated(); onClose();
    } catch (e) { alert(e?.response?.data?.detail || "Eroare"); }
    finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-3" onClick={onClose}>
      <motion.form initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} onSubmit={submit} onClick={e => e.stopPropagation()}
        className="bg-stone-950 border border-white/10 rounded-3xl p-5 w-full max-w-md space-y-3" data-testid="new-task-modal">
        <h3 className="font-serif text-xl mb-2">Task nou</h3>
        <input required placeholder="Titlu task..." value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm" data-testid="new-task-title" />
        <textarea rows={3} placeholder="Descriere (opțional)" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm" />
        <select value={form.assignee_id} onChange={e => setForm({ ...form, assignee_id: e.target.value })}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm" data-testid="new-task-assignee">
          <option value="">— Neasignat —</option>
          {members.map(m => <option key={m.user_id} value={m.user_id}>{m.name} {m.specialty ? `(${m.specialty})` : ""}</option>)}
        </select>
        <div className="grid grid-cols-2 gap-2">
          <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm">
            <option value="low">Scăzut</option><option value="normal">Normal</option>
            <option value="high">Înalt</option><option value="urgent">Urgent</option>
          </select>
          <input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm" />
        </div>
        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="flex-1 py-2 bg-white/5 rounded-full text-sm">Anulează</button>
          <button type="submit" disabled={busy} className="flex-1 py-2 btn-accent rounded-full text-sm" data-testid="new-task-submit">
            {busy ? "..." : "Creează"}
          </button>
        </div>
      </motion.form>
    </div>
  );
};

const AddMemberModal = ({ project, onClose, onAdded }) => {
  const [specialists, setSpecialists] = useState([]);
  const [pick, setPick] = useState(null);
  const [specialty, setSpecialty] = useState("parchet");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    axios.get(`${API}/marketplace/specialists?verified_only=true&sort=rating`).then(r => setSpecialists(r.data || []));
  }, []);
  const existing = new Set([
    project.designer_id, project.client_id,
    ...(project.members || []).map(m => m.user_id),
  ]);
  const available = specialists.filter(s => !existing.has(s.id));
  const submit = async () => {
    if (!pick) return;
    setBusy(true);
    try {
      await axios.post(`${API}/projects/${project.id}/members`, { user_id: pick, role: "specialist", specialty });
      onAdded(); onClose();
    } catch (e) { alert(e?.response?.data?.detail || "Eroare"); }
    finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-3" onClick={onClose}>
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} onClick={e => e.stopPropagation()}
        className="bg-stone-950 border border-white/10 rounded-3xl p-5 w-full max-w-md space-y-3 max-h-[80vh] overflow-y-auto" data-testid="add-member-modal">
        <h3 className="font-serif text-xl mb-2">Adaugă specialist</h3>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-stone-400 mb-1.5">Specialitate</div>
          <select value={specialty} onChange={e => setSpecialty(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm">
            <option value="parchet">Parchet</option>
            <option value="zugravit">Zugrăvit</option>
            <option value="faianta">Faianță / Gresie</option>
            <option value="handyman">Handyman</option>
            <option value="gips_carton">Gips-carton</option>
            <option value="electric">Electric</option>
            <option value="plumbing">Sanitar</option>
            <option value="hvac">HVAC</option>
            <option value="carpentry">Dulgherie</option>
          </select>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-stone-400 mb-1.5">Specialist disponibil</div>
          <div className="space-y-1.5 max-h-60 overflow-y-auto">
            {available.length === 0 ? (
              <div className="text-xs text-stone-500 text-center py-4">Niciun specialist disponibil.</div>
            ) : available.map(s => (
              <button key={s.id} onClick={() => setPick(s.id)} type="button"
                className={`w-full text-left p-3 rounded-xl border transition ${pick === s.id ? "bg-purple-500/20 border-purple-500/50" : "bg-white/5 border-white/10 hover:bg-white/10"}`}
                data-testid={`pick-member-${s.id}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">{s.name}</div>
                    <div className="text-[10px] uppercase tracking-wider text-stone-500">{(s.service_categories || []).slice(0, 3).join(" · ")}</div>
                  </div>
                  <div className="text-xs text-amber-300">★ {s.rating?.toFixed(1) || "—"}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 py-2 bg-white/5 rounded-full text-sm">Anulează</button>
          <button onClick={submit} disabled={!pick || busy} className="flex-1 py-2 btn-accent rounded-full text-sm disabled:opacity-50" data-testid="add-member-submit">
            {busy ? "..." : "Adaugă"}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const TaskDetailModal = ({ task, project, onClose, onUpdate, currentUser }) => {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [busy, setBusy] = useState(false);
  const isDesigner = project.designer_id === currentUser?.id;
  const isAssignee = task.assignee_id === currentUser?.id;
  const canEditStatus = isDesigner || isAssignee;

  useEffect(() => {
    axios.get(`${API}/tasks/${task.id}/comments`).then(r => setComments(r.data || []));
  }, [task.id]);

  const setStatus = async (status) => {
    try {
      await axios.patch(`${API}/tasks/${task.id}`, { status });
      onUpdate();
      onClose();
    } catch (e) { alert(e?.response?.data?.detail || "Eroare"); }
  };

  const submitComment = async () => {
    if (!newComment.trim()) return;
    setBusy(true);
    try {
      const { data } = await axios.post(`${API}/tasks/${task.id}/comments`, { body: newComment });
      setComments([...comments, data]);
      setNewComment("");
    } catch (e) { alert(e?.response?.data?.detail || "Eroare"); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-3" onClick={onClose}>
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} onClick={e => e.stopPropagation()}
        className="bg-stone-950 border border-white/10 rounded-3xl p-5 w-full max-w-lg max-h-[90vh] overflow-y-auto" data-testid="task-detail-modal">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-stone-400 mb-1">Task · {task.assignee_name || "neasignat"}</div>
            <h3 className="font-serif text-xl">{task.title}</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center" data-testid="task-close"><X className="w-4 h-4" /></button>
        </div>
        {task.description && <p className="text-sm text-stone-400 mb-3 leading-relaxed">{task.description}</p>}
        <div className="flex gap-2 flex-wrap mb-4">
          <span className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-full bg-${PRIORITY[task.priority]?.color || "stone"}-500/15 text-${PRIORITY[task.priority]?.color || "stone"}-300 border border-${PRIORITY[task.priority]?.color || "stone"}-500/30`}>
            {PRIORITY[task.priority]?.label || task.priority}
          </span>
          {task.due_date && <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-full bg-white/5 text-stone-300">Termen: {task.due_date}</span>}
        </div>
        {canEditStatus && (
          <div className="flex gap-2 mb-4 flex-wrap">
            {STATUS_COLS.map(c => (
              <button key={c.id} onClick={() => setStatus(c.id)} disabled={task.status === c.id}
                className={`text-xs px-3 py-1.5 rounded-full border transition ${task.status === c.id ? "bg-[#d4ff3a] text-black border-[#d4ff3a]" : "bg-white/5 text-stone-300 border-white/10 hover:bg-white/10"}`}
                data-testid={`set-status-${c.id}`}>
                {c.label}
              </button>
            ))}
          </div>
        )}
        <div className="border-t border-white/5 pt-3 space-y-2">
          <div className="text-[10px] uppercase tracking-wider text-stone-400">Comentarii ({comments.length})</div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {comments.map(c => (
              <div key={c.id} className="bg-white/5 rounded-xl p-2.5">
                <div className="text-[10px] uppercase tracking-wider text-stone-500 mb-0.5">{c.author_name} · {c.author_role}</div>
                <div className="text-sm">{c.body}</div>
              </div>
            ))}
            {comments.length === 0 && <div className="text-xs text-stone-500 italic">Niciun comentariu încă.</div>}
          </div>
          <div className="flex gap-2 mt-2">
            <input value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Scrie un comentariu..."
              onKeyDown={e => e.key === "Enter" && submitComment()}
              className="flex-1 bg-white/5 border border-white/10 rounded-full px-3 py-2 text-sm" data-testid="task-comment-input" />
            <button onClick={submitComment} disabled={busy || !newComment.trim()}
              className="px-3 py-2 btn-accent rounded-full disabled:opacity-40" data-testid="task-comment-send">
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// ============= PROJECT LIST CARD (reusable for client + specialist dashboards) =============
export const ProjectListSection = ({ title = "Proiecte de coordonare" }) => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    axios.get(`${API}/projects`)
      .then(r => setProjects(r.data || []))
      .catch(() => setProjects([]))
      .finally(() => setLoading(false));
  }, []);
  if (loading) return null;
  if (projects.length === 0) return null;
  return (
    <div className="glass-strong rounded-3xl p-5 sm:p-6" data-testid="projects-list">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-cyan-500/30 to-purple-500/30 border border-purple-500/40 flex items-center justify-center">
          <ListChecks className="w-4 h-4 text-purple-200" />
        </div>
        <div>
          <h3 className="font-serif text-lg leading-tight">{title}</h3>
          <div className="text-[10px] uppercase tracking-wider text-stone-400">{projects.length} {projects.length === 1 ? "proiect activ" : "proiecte active"}</div>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {projects.map(p => {
          const totalT = p.tasks_count?.total || 0;
          const doneT = p.tasks_count?.done || 0;
          const pct = totalT > 0 ? Math.round((doneT / totalT) * 100) : 0;
          return (
            <button key={p.id} onClick={() => navigate(`/projects/${p.id}`)}
              className="text-left bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-500/40 rounded-2xl p-4 transition"
              data-testid={`project-card-${p.id}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="font-medium text-sm truncate">{p.name}</div>
                <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${
                  p.status === "active" ? "bg-emerald-500/15 text-emerald-300" : "bg-stone-500/15 text-stone-300"
                }`}>{p.status}</span>
              </div>
              <div className="text-[10px] uppercase tracking-wider text-stone-500">
                Coord: {p.designer_name} · Client: {p.client_name}
              </div>
              <div className="mt-2 text-[11px] text-stone-400">
                {totalT > 0 ? `${doneT}/${totalT} task-uri · ${pct}%` : "Niciun task încă"}
              </div>
              {totalT > 0 && (
                <div className="h-1 bg-white/5 rounded mt-1.5 overflow-hidden">
                  <div className="h-full bg-emerald-400" style={{ width: `${pct}%` }} />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
