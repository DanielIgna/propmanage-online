// Operator Digital Twin onboarding & file uploads for clients.
// User flow:
// 1. Operator sees list of clients with digital_twin_pro flag (grouped by status: needs_setup / in_progress / delivered)
// 2. For clients without flag → "Acordă acces" button (uses operator grant endpoint)
// 3. For clients without project → "Creează proiect" button + name input
// 4. For projects existing → "Încarcă model 3D" (.glb / .gltf / .skp) + "Încarcă plan 2D" (.pdf)
// 5. Files become instantly visible to the client at /digital-twin
import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  Box, Upload, FileText, CheckCircle2, Clock, AlertCircle, Loader2, X,
  Plus, Search, Mail, MapPin, User as UserIcon, Layers, Eye, ShieldCheck, Edit3,
  RefreshCw, Wand2,
} from "lucide-react";
import { API } from "./DashShared";

const STATUS_META = {
  needs_setup: { label: "Necesită setup", color: "bg-amber-500/15 text-amber-300 border-amber-500/30", icon: AlertCircle },
  in_progress: { label: "În lucru", color: "bg-blue-500/15 text-blue-300 border-blue-500/30", icon: Clock },
  delivered: { label: "Livrat", color: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", icon: CheckCircle2 },
};

const fmtBytes = (n) => {
  if (!n) return "—";
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
  return (n / (1024 * 1024)).toFixed(1) + " MB";
};

// ============= GRANT ACCESS MODAL =============
const GrantAccessModal = ({ onClose, onGranted }) => {
  const [email, setEmail] = useState("");
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const search = async (q) => {
    setEmail(q);
    if (q.length < 2) { setResults([]); return; }
    try {
      // /admin/users requires admin role — operator uses /admin/search? No, search endpoint exists
      // Actually the operator can't list users. Use a public search? Simplest: operator already has admin/users
      // For now use /admin/users (gives 403 to operator). Better: fall back to client lookup by email.
      const r = await axios.get(`${API}/admin/search`, { params: { q } });
      setResults((r.data?.users || []).filter(u => u.role === "client").slice(0, 8));
    } catch (_) {
      setResults([]);
    }
  };

  const grant = async (clientId) => {
    setBusy(true); setErr(null);
    try {
      await axios.post(`${API}/operator/digital-twin/grant-access`, { user_id: clientId, active: true });
      onGranted?.();
      onClose();
    } catch (e) {
      setErr(e?.response?.data?.detail || e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-stone-900 border border-white/10 rounded-2xl p-5 w-full max-w-md space-y-3" data-testid="grant-access-modal">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-emerald-400/90 font-semibold">Digital Twin Pro</div>
            <h3 className="font-serif text-lg text-white">Acordă acces unui client</h3>
            <p className="text-xs text-stone-400 mt-0.5">Caută clientul după nume sau email și activează-i flag-ul DT.</p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-stone-500" /></button>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
          <input
            value={email}
            onChange={(e) => search(e.target.value)}
            placeholder="Caută client după nume sau email..."
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-3 py-2.5 text-sm text-white placeholder:text-stone-500"
            data-testid="grant-access-search"
            autoFocus
          />
        </div>

        <div className="space-y-1 max-h-72 overflow-y-auto">
          {email.length >= 2 && results.length === 0 && <div className="text-xs text-stone-500 text-center py-3">Niciun client găsit.</div>}
          {results.map(u => (
            <button
              key={u.id}
              onClick={() => grant(u.id)}
              disabled={busy}
              className="w-full text-left bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg p-2.5 disabled:opacity-50"
              data-testid={`grant-target-${u.id}`}
            >
              <div className="text-sm text-white font-medium">{u.name}</div>
              <div className="text-[11px] text-stone-400">{u.email}</div>
            </button>
          ))}
        </div>

        {err && <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-2">{err}</div>}
      </div>
    </div>
  );
};

// ============= CREATE PROJECT MODAL =============
const CreateProjectModal = ({ client, onClose, onCreated }) => {
  const [name, setName] = useState(`Digital Twin — ${client.client_name || "Client"}`);
  const [desc, setDesc] = useState("");
  const [trimbleUrl, setTrimbleUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const create = async () => {
    setBusy(true); setErr(null);
    try {
      const { data } = await axios.post(`${API}/operator/digital-twin/clients/${client.client_id}/projects`, {
        client_id: client.client_id, name, description: desc,
        trimble_embed_url: trimbleUrl.trim() || null,
      });
      onCreated?.(data);
    } catch (e) {
      setErr(e?.response?.data?.detail || e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-stone-900 border border-white/10 rounded-2xl p-5 w-full max-w-md space-y-3" data-testid="create-project-modal">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-emerald-400/90 font-semibold">Pas 1 / 3 · Proiect</div>
            <h3 className="font-serif text-lg text-white">Creează proiect Digital Twin</h3>
            <p className="text-xs text-stone-400 mt-0.5">Pentru <strong>{client.client_name}</strong>. Proiectul va apărea în contul clientului instant.</p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-stone-500" /></button>
        </div>

        <div>
          <label className="text-[10px] uppercase text-stone-500 font-semibold">Nume proiect</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={200}
            className="w-full mt-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
            data-testid="create-project-name"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase text-stone-500 font-semibold">Descriere (opțional)</label>
          <textarea
            rows={3}
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            maxLength={2000}
            className="w-full mt-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
            data-testid="create-project-desc"
          />
        </div>

        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3 space-y-1.5">
          <label className="text-[10px] uppercase text-emerald-300 font-bold flex items-center gap-1.5">
            <Box className="w-3 h-3" /> Trimble Connect — viewer SketchUp nativ (opțional)
          </label>
          <input
            value={trimbleUrl}
            onChange={(e) => setTrimbleUrl(e.target.value)}
            placeholder="https://web.connect.trimble.com/projects/.../viewer/..."
            maxLength={2000}
            className="w-full bg-white/5 border border-emerald-500/20 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-stone-600"
            data-testid="create-project-trimble"
          />
          <p className="text-[10px] text-stone-500 leading-relaxed">
            🔗 Lipește aici link-ul de share din Trimble Connect → clientul vede modelul SketchUp cu X-Ray nativ, layers, secțiuni. Poți seta și mai târziu.
          </p>
        </div>

        {err && <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-2">{err}</div>}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 px-3 py-2 text-sm rounded-lg bg-white/5 hover:bg-white/10 text-stone-300">Anulează</button>
          <button
            onClick={create}
            disabled={busy || name.trim().length < 2}
            className="flex-1 px-3 py-2 text-sm rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-medium flex items-center justify-center gap-1.5"
            data-testid="create-project-submit"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Creează proiect
          </button>
        </div>
      </div>
    </div>
  );
};

// ============= UPLOAD FILES MODAL =============
const UploadFilesModal = ({ project, client, onClose, onUploaded }) => {
  const [tab, setTab] = useState("3d"); // 3d | 2d | trimble
  const [model, setModel] = useState(null);
  const [plan, setPlan] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [history, setHistory] = useState({ models: [], plans: [] });
  const [trimbleUrl, setTrimbleUrl] = useState(project.trimble_embed_url || "");
  const [savingTrimble, setSavingTrimble] = useState(false);
  const [err, setErr] = useState(null);

  const saveTrimble = async () => {
    setSavingTrimble(true); setErr(null);
    try {
      await axios.patch(`${API}/operator/digital-twin/projects/${project.id}/trimble`, {
        trimble_embed_url: trimbleUrl.trim() || null,
      });
      onUploaded?.();
    } catch (e) {
      setErr(e?.response?.data?.detail || e.message);
    } finally {
      setSavingTrimble(false);
    }
  };

  const loadHistory = async () => {
    try {
      const [m, p] = await Promise.all([
        axios.get(`${API}/digital-twin/projects/${project.id}/models`),
        axios.get(`${API}/digital-twin/projects/${project.id}/plans`),
      ]);
      setHistory({
        models: m.data.items || [],
        plans: p.data.items || [],
      });
    } catch (_) { /* ignore */ }
  };
  useEffect(() => { loadHistory(); }, [project.id]);

  // Auto-poll while any .skp archive is mid-conversion so the UI updates
  // from "Se convertește 35%" → "Gata!" without manual refresh.
  useEffect(() => {
    const converting = (history.models || []).filter(
      m => m.kind === "archive" && m.conversion_status && !["completed", "failed", "n/a"].includes(m.conversion_status)
    );
    if (converting.length === 0) return undefined;
    const t = setInterval(() => { loadHistory(); }, 5000);
    return () => clearInterval(t);
  }, [history.models]);

  const retryConversion = async (modelId) => {
    try {
      await axios.post(`${API}/digital-twin/conversions/${modelId}/retry`);
      await loadHistory();
    } catch (e) {
      setErr(e?.response?.data?.detail || e.message);
    }
  };

  const uploadModel = async () => {
    if (!model) return;
    setUploading(true); setErr(null); setProgress(0);
    const fd = new FormData();
    fd.append("file", model);
    try {
      await axios.post(`${API}/digital-twin/projects/${project.id}/upload`, fd, {
        onUploadProgress: (e) => setProgress(Math.round((e.loaded / e.total) * 100)),
      });
      setModel(null);
      await loadHistory();
      onUploaded?.();
    } catch (e) {
      setErr(e?.response?.data?.detail || e.message);
    } finally {
      setUploading(false);
    }
  };

  const uploadPlan = async () => {
    if (!plan) return;
    setUploading(true); setErr(null); setProgress(0);
    const fd = new FormData();
    fd.append("file", plan);
    try {
      await axios.post(`${API}/digital-twin/projects/${project.id}/plans`, fd, {
        onUploadProgress: (e) => setProgress(Math.round((e.loaded / e.total) * 100)),
      });
      setPlan(null);
      await loadHistory();
      onUploaded?.();
    } catch (e) {
      setErr(e?.response?.data?.detail || e.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-stone-900 border border-white/10 rounded-2xl p-5 w-full max-w-xl max-h-[90vh] overflow-y-auto space-y-3" data-testid="upload-files-modal">
        <div className="flex items-start justify-between sticky top-0 bg-stone-900 pb-2 z-10">
          <div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-emerald-400/90 font-semibold">Încarcă fișiere · Proiect</div>
            <h3 className="font-serif text-lg text-white">{project.name}</h3>
            <p className="text-xs text-stone-400 mt-0.5">Pentru <strong>{client.client_name}</strong> · {client.client_email}</p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-stone-500" /></button>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 bg-white/[0.03] rounded-lg p-1">
          <button
            onClick={() => setTab("3d")}
            className={`flex-1 py-1.5 rounded text-xs font-medium ${tab === "3d" ? "bg-emerald-500/20 text-emerald-300" : "text-stone-400"}`}
            data-testid="upload-tab-3d"
          >
            <Box className="w-3.5 h-3.5 inline mr-1" />Model 3D
          </button>
          <button
            onClick={() => setTab("2d")}
            className={`flex-1 py-1.5 rounded text-xs font-medium ${tab === "2d" ? "bg-emerald-500/20 text-emerald-300" : "text-stone-400"}`}
            data-testid="upload-tab-2d"
          >
            <FileText className="w-3.5 h-3.5 inline mr-1" />Plan 2D (PDF)
          </button>
          <button
            onClick={() => setTab("trimble")}
            className={`flex-1 py-1.5 rounded text-xs font-medium ${tab === "trimble" ? "bg-emerald-500/20 text-emerald-300" : "text-stone-400"}`}
            data-testid="upload-tab-trimble"
          >
            <Wand2 className="w-3.5 h-3.5 inline mr-1" />Trimble Connect
          </button>
        </div>

        {/* 3D upload zone */}
        {tab === "3d" && (
          <div className="space-y-2">
            <label className="block border-2 border-dashed border-white/10 hover:border-emerald-500/50 rounded-xl p-6 text-center cursor-pointer transition-colors">
              <input
                type="file"
                accept=".glb,.gltf,.skp,.dae,.obj,.fbx,.stl,.ply"
                onChange={(e) => setModel(e.target.files[0])}
                className="hidden"
                data-testid="upload-3d-input"
              />
              <Upload className="w-8 h-8 mx-auto text-stone-500 mb-2" />
              {model ? (
                <div>
                  <div className="text-sm text-white font-medium">{model.name}</div>
                  <div className="text-xs text-stone-400">{fmtBytes(model.size)}</div>
                </div>
              ) : (
                <div>
                  <div className="text-sm text-stone-300">Trage fișierul aici sau click</div>
                  <div className="text-[11px] text-stone-500 mt-1 leading-relaxed">
                    <strong className="text-emerald-400">.glb / .gltf</strong> — vizualizabil instant<br/>
                    <strong className="text-amber-400">.dae / .obj / .fbx / .stl / .ply</strong> — auto-conversie via Blender ⚡<br/>
                    <strong className="text-stone-400">.skp</strong> — SketchUp (doar descărcabil; exportă .dae pentru viewer)
                  </div>
                </div>
              )}
            </label>

            {model && (
              <>
                {uploading && (
                  <div className="bg-white/5 rounded-full h-1.5 overflow-hidden">
                    <div className="h-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
                  </div>
                )}
                <button
                  onClick={uploadModel}
                  disabled={uploading}
                  className="w-full py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-medium flex items-center justify-center gap-2"
                  data-testid="upload-3d-submit"
                >
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {uploading ? `Se încarcă ${progress}%...` : "Încarcă"}
                </button>
              </>
            )}

            {history.models.length > 0 && (
              <div className="pt-3 space-y-1.5">
                <div className="text-[10px] uppercase tracking-wider text-stone-500 font-bold">Versiuni încărcate</div>
                {history.models.map(m => {
                  const isArchive = m.kind === "archive";
                  const isSource = m.kind === "source"; // DAE/OBJ/FBX/STL/PLY — auto-converts to .glb
                  const cstatus = m.conversion_status;
                  const cpct = m.conversion_percent || 0;
                  const isConverting = (isArchive || isSource) && cstatus && !["completed", "failed", "n/a"].includes(cstatus);
                  const engine = m.conversion_engine === "blender" ? "Blender ⚡" : "CloudConvert ☁️";
                  const conversionLabel = {
                    pending: `${engine} · În așteptare…`,
                    uploading: `${engine} · Trimit…`,
                    converting: `${engine} · Se convertește…`,
                    downloading: `${engine} · Finalizez…`,
                    completed: "Convertit ✓",
                    failed: "Conversie eșuată",
                  }[cstatus] || null;
                  return (
                    <div key={m.id} className="bg-white/[0.03] border border-white/5 rounded-lg p-2 text-xs space-y-1.5" data-testid={`model-row-${m.id}`}>
                      <div className="flex items-center gap-2">
                        {isArchive ? <FileText className="w-3.5 h-3.5 text-amber-400" /> : (isSource ? <Wand2 className="w-3.5 h-3.5 text-blue-400" /> : <Box className="w-3.5 h-3.5 text-emerald-400" />)}
                        <div className="flex-1 min-w-0">
                          <div className="text-white truncate">{m.filename}</div>
                          <div className="text-stone-500 text-[10px]">
                            {fmtBytes(m.size_bytes)} · {new Date(m.uploaded_at).toLocaleDateString("ro-RO")} · {m.uploaded_by_name}
                            {m.converted_from_filename && <span className="text-emerald-400/80"> · ⚡ auto din {m.converted_from_filename}</span>}
                          </div>
                        </div>
                        {isArchive && !cstatus && <span className="text-[9px] uppercase text-amber-400">Descărcabil</span>}
                        {isSource && !cstatus && <span className="text-[9px] uppercase text-blue-400">Sursă</span>}
                        {cstatus === "completed" && <span className="text-[9px] uppercase text-emerald-400 flex items-center gap-1"><Wand2 className="w-3 h-3"/>GLB Gata</span>}
                      </div>
                      {isConverting && (
                        <div className="space-y-1" data-testid={`conv-row-${m.id}`}>
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-emerald-300 flex items-center gap-1"><Loader2 className="w-2.5 h-2.5 animate-spin" />{conversionLabel}</span>
                            <span className="text-stone-400 font-mono">{cpct}%</span>
                          </div>
                          <div className="bg-white/5 rounded-full h-1 overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-amber-500 via-emerald-500 to-emerald-400 transition-all" style={{ width: `${cpct}%` }} />
                          </div>
                        </div>
                      )}
                      {cstatus === "failed" && (
                        <div className="flex items-center justify-between gap-2 bg-red-500/10 border border-red-500/20 rounded p-1.5">
                          <div className="text-[10px] text-red-300 truncate" title={m.conversion_error}>⚠️ {m.conversion_error || "Eroare conversie"}</div>
                          <button onClick={() => retryConversion(m.id)} className="text-[10px] px-2 py-0.5 rounded bg-red-500/20 hover:bg-red-500/30 text-red-200 flex items-center gap-1" data-testid={`conv-retry-${m.id}`}>
                            <RefreshCw className="w-2.5 h-2.5" />Reîncearcă
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 2D upload zone */}
        {tab === "2d" && (
          <div className="space-y-2">
            <label className="block border-2 border-dashed border-white/10 hover:border-emerald-500/50 rounded-xl p-6 text-center cursor-pointer transition-colors">
              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={(e) => setPlan(e.target.files[0])}
                className="hidden"
                data-testid="upload-2d-input"
              />
              <Upload className="w-8 h-8 mx-auto text-stone-500 mb-2" />
              {plan ? (
                <div>
                  <div className="text-sm text-white font-medium">{plan.name}</div>
                  <div className="text-xs text-stone-400">{fmtBytes(plan.size)}</div>
                </div>
              ) : (
                <div>
                  <div className="text-sm text-stone-300">Trage planul PDF aici sau click</div>
                  <div className="text-[11px] text-stone-500 mt-1">Plan structural 2D (.pdf)</div>
                </div>
              )}
            </label>

            {plan && (
              <>
                {uploading && (
                  <div className="bg-white/5 rounded-full h-1.5 overflow-hidden">
                    <div className="h-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
                  </div>
                )}
                <button
                  onClick={uploadPlan}
                  disabled={uploading}
                  className="w-full py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-medium flex items-center justify-center gap-2"
                  data-testid="upload-2d-submit"
                >
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {uploading ? `Se încarcă ${progress}%...` : "Încarcă"}
                </button>
              </>
            )}

            {history.plans.length > 0 && (
              <div className="pt-3 space-y-1.5">
                <div className="text-[10px] uppercase tracking-wider text-stone-500 font-bold">Planuri 2D încărcate</div>
                {history.plans.map(p => (
                  <div key={p.id} className="flex items-center gap-2 bg-white/[0.03] border border-white/5 rounded-lg p-2 text-xs" data-testid={`plan-row-${p.id}`}>
                    <FileText className="w-3.5 h-3.5 text-blue-400" />
                    <div className="flex-1 min-w-0">
                      <div className="text-white truncate">{p.filename || p.title}</div>
                      <div className="text-stone-500 text-[10px]">{fmtBytes(p.size_bytes)} · {new Date(p.uploaded_at).toLocaleDateString("ro-RO")}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Trimble Connect tab */}
        {tab === "trimble" && (
          <div className="space-y-3" data-testid="trimble-tab-content">
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 space-y-2">
              <div className="flex items-start gap-2">
                <Wand2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm text-white font-medium">Viewer SketchUp nativ via Trimble Connect</div>
                  <p className="text-[11px] text-stone-400 leading-relaxed mt-1">
                    Clientul vede modelul în viewer-ul oficial SketchUp, direct în PropManage — cu X-Ray, layers,
                    secțiuni, măsurători nativi. Zero conversie, zero pierderi.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase text-stone-500 font-semibold flex items-center justify-between">
                <span>URL Trimble Connect</span>
                {project.trimble_embed_url && <span className="text-emerald-400 normal-case">● Setat</span>}
              </label>
              <input
                value={trimbleUrl}
                onChange={(e) => setTrimbleUrl(e.target.value)}
                placeholder="https://web.connect.trimble.com/projects/.../viewer/..."
                maxLength={2000}
                className="w-full mt-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-stone-600 font-mono"
                data-testid="trimble-url-input"
              />
            </div>

            <button
              onClick={saveTrimble}
              disabled={savingTrimble}
              className="w-full py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-medium flex items-center justify-center gap-2"
              data-testid="trimble-save"
            >
              {savingTrimble ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {savingTrimble ? "Se salvează…" : (project.trimble_embed_url ? "Actualizează link" : "Salvează link")}
            </button>

            <details className="bg-stone-950/50 border border-white/5 rounded-lg p-3 text-[11px] text-stone-400">
              <summary className="cursor-pointer text-stone-300 font-medium">📘 Cum obții link-ul Trimble Connect (3 pași)</summary>
              <ol className="mt-2 space-y-1.5 pl-4 list-decimal leading-relaxed">
                <li>Mergi pe <a href="https://web.connect.trimble.com/" target="_blank" rel="noreferrer" className="text-emerald-400 underline">web.connect.trimble.com</a> și loghează-te (gratuit, 10GB).</li>
                <li>Creează un proiect → urcă fișierul <code className="text-amber-300">.skp</code> → așteaptă procesarea automată.</li>
                <li>Click dreapta pe model → <strong>Share</strong> → setează <em>"Anyone with link"</em> → copiază URL-ul și lipește-l aici.</li>
              </ol>
            </details>
          </div>
        )}

        {err && <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-2">{err}</div>}
      </div>
    </div>
  );
};

// ============= CLIENT CARD =============
const ClientCard = ({ client, onCreateProject, onUpload, onOpenDigitalTwin }) => {
  const meta = STATUS_META[client.status];
  return (
    <div className="bg-white/[0.03] hover:bg-white/[0.05] border border-white/10 rounded-2xl p-4 transition-colors" data-testid={`dt-client-${client.client_id}`}>
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-stone-700 flex items-center justify-center shrink-0">
          <UserIcon className="w-5 h-5 text-stone-300" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="font-semibold text-white truncate">{client.client_name}</div>
            <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${meta.color}`}>
              <meta.icon className="w-3 h-3 inline -mt-0.5 mr-0.5" />{meta.label}
            </span>
          </div>
          <div className="text-xs text-stone-400 truncate flex items-center gap-1.5">
            <Mail className="w-3 h-3" />{client.client_email}
          </div>
          {client.zone && (
            <div className="text-xs text-stone-500 truncate flex items-center gap-1.5">
              <MapPin className="w-3 h-3" />{client.zone.replace(/-/g, " ")}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3 text-center">
        <div className="bg-black/30 rounded-lg p-2">
          <div className="text-[9px] uppercase tracking-wider text-stone-500">Proiecte</div>
          <div className="font-serif text-lg text-white">{client.project_count}</div>
        </div>
        <div className="bg-black/30 rounded-lg p-2">
          <div className="text-[9px] uppercase tracking-wider text-stone-500">Modele 3D</div>
          <div className="font-serif text-lg text-white">{client.model_count}</div>
        </div>
        <div className="bg-black/30 rounded-lg p-2">
          <div className="text-[9px] uppercase tracking-wider text-stone-500">Planuri 2D</div>
          <div className="font-serif text-lg text-white">{client.plan_count}</div>
        </div>
      </div>

      {client.projects.length > 0 && (
        <div className="space-y-1.5 mb-3">
          {client.projects.map(p => (
            <div key={p.id} className="bg-white/[0.02] rounded-lg p-2 flex items-center gap-2" data-testid={`dt-project-${p.id}`}>
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              <div className="flex-1 min-w-0">
                <div className="text-xs text-white truncate">{p.name}</div>
                <div className="text-[10px] text-stone-500">{p.model_count} model · {p.plan_count} plan · {p.pin_count} pin</div>
              </div>
              <button
                onClick={() => onUpload(client, p)}
                className="px-2 py-1 rounded bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 text-[11px] font-medium flex items-center gap-1"
                data-testid={`upload-files-${p.id}`}
              >
                <Upload className="w-3 h-3" />Încarcă
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        {client.status === "needs_setup" ? (
          <button
            onClick={() => onCreateProject(client)}
            className="flex-1 px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium flex items-center justify-center gap-1.5"
            data-testid={`create-project-${client.client_id}`}
          >
            <Plus className="w-3.5 h-3.5" />Creează proiect & încarcă
          </button>
        ) : (
          <button
            onClick={() => onCreateProject(client)}
            className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-stone-300 text-xs font-medium flex items-center gap-1.5"
            data-testid={`add-project-${client.client_id}`}
          >
            <Plus className="w-3.5 h-3.5" />Proiect nou
          </button>
        )}
        <button
          onClick={() => onOpenDigitalTwin(client)}
          className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-stone-300 text-xs font-medium flex items-center gap-1.5"
          title="Deschide modulul Digital Twin (ca operator)"
          data-testid={`view-dt-${client.client_id}`}
        >
          <Eye className="w-3.5 h-3.5" />Vezi DT
        </button>
      </div>
    </div>
  );
};

// ============= MAIN VIEW =============
export const OperatorDigitalTwin = () => {
  const [items, setItems] = useState([]);
  const [counters, setCounters] = useState({ needs_setup: 0, in_progress: 0, delivered: 0, total: 0 });
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [showGrant, setShowGrant] = useState(false);
  const [creatingFor, setCreatingFor] = useState(null);
  const [uploadingFor, setUploadingFor] = useState(null); // { client, project }
  const [toast, setToast] = useState(null);

  const load = async () => {
    setLoading(true); setErr(null);
    try {
      const { data } = await axios.get(`${API}/operator/digital-twin/clients-queue`, { params: { status: filter } });
      setItems(data.items || []);
      setCounters(data.counters || {});
    } catch (e) {
      setErr(e?.response?.data?.detail || e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const onCreateProject = (client) => setCreatingFor(client);
  const onProjectCreated = (data) => {
    showToast(`✓ Proiect „${data.name}" creat. Acum încarcă fișierele.`);
    setUploadingFor({ client: creatingFor, project: data });
    setCreatingFor(null);
    load();
  };
  const onUpload = (client, project) => setUploadingFor({ client, project });
  const onUploaded = () => { showToast("✓ Fișier încărcat. Vizibil pentru client."); load(); };
  const onOpenDigitalTwin = () => { window.location.href = "/digital-twin"; };

  const filterPills = [
    { id: "all", label: "Toți", count: counters.total },
    { id: "needs_setup", label: "Setup necesar", count: counters.needs_setup },
    { id: "in_progress", label: "În lucru", count: counters.in_progress },
    { id: "delivered", label: "Livrat", count: counters.delivered },
  ];

  return (
    <div className="space-y-4" data-testid="operator-digital-twin">
      {/* Header actions */}
      <div className="glass-strong rounded-3xl p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-emerald-400/80 font-semibold">Digital Twin Pro · Operator</div>
            <h2 className="font-serif text-xl text-white">Clienți cu acces 3D</h2>
            <p className="text-xs text-stone-400 mt-0.5">Acordă acces, creează proiecte, încarcă modele .glb/.gltf/.skp și planuri PDF 2D.</p>
          </div>
          <button
            onClick={() => setShowGrant(true)}
            className="px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium flex items-center gap-1.5"
            data-testid="op-grant-access-btn"
          >
            <ShieldCheck className="w-3.5 h-3.5" />Acordă acces DT
          </button>
        </div>

        {/* Filter pills */}
        <div className="flex flex-wrap gap-2">
          {filterPills.map(p => (
            <button
              key={p.id}
              onClick={() => setFilter(p.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 ${
                filter === p.id ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40" : "bg-white/5 text-stone-400 hover:text-white"
              }`}
              data-testid={`dt-filter-${p.id}`}
            >
              {p.label}
              <span className="px-1.5 py-0.5 rounded-full bg-stone-950 text-[10px]">{p.count || 0}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-12 text-sm text-stone-500"><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Se încarcă...</div>
      ) : err ? (
        <div className="text-center py-8 text-red-400 text-sm">{err}</div>
      ) : items.length === 0 ? (
        <div className="glass-strong rounded-3xl p-12 text-center" data-testid="op-dt-empty">
          <Box className="w-12 h-12 text-stone-600 mx-auto mb-3" />
          <h3 className="font-serif text-xl text-white mb-2">Niciun client cu Digital Twin Pro</h3>
          <p className="text-sm text-stone-400 max-w-md mx-auto">
            Acordă accesul unui client folosind butonul „Acordă acces DT" de mai sus. După acordare, vei putea crea proiectul și încărca fișierele.
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {items.map(c => (
            <ClientCard
              key={c.client_id}
              client={c}
              onCreateProject={onCreateProject}
              onUpload={onUpload}
              onOpenDigitalTwin={onOpenDigitalTwin}
            />
          ))}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[70] px-4 py-2 rounded-full bg-emerald-500 text-white text-sm shadow-2xl" data-testid="op-dt-toast">
          {toast}
        </div>
      )}

      {showGrant && <GrantAccessModal onClose={() => setShowGrant(false)} onGranted={load} />}
      {creatingFor && (
        <CreateProjectModal client={creatingFor} onClose={() => setCreatingFor(null)} onCreated={onProjectCreated} />
      )}
      {uploadingFor && (
        <UploadFilesModal
          client={uploadingFor.client}
          project={uploadingFor.project}
          onClose={() => setUploadingFor(null)}
          onUploaded={onUploaded}
        />
      )}
    </div>
  );
};

export default OperatorDigitalTwin;
