// Digital Twin page — Phase C MVP project list + viewer launcher.
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { Box, Plus, Lock, Eye, Trash2, ArrowLeft, Sparkles, ExternalLink } from "lucide-react";
import { API } from "./DashShared";
import DigitalTwinViewer from "../components/DigitalTwinViewer";

const ProjectCard = ({ p, onOpen, onDelete }) => (
  <div className="group relative rounded-2xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] p-5 transition-colors" data-testid={`dt-project-${p.id}`}>
    <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-t-2xl opacity-50 group-hover:opacity-100 transition-opacity" />
    <div className="flex items-start gap-3 mb-3">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center shrink-0">
        <Box className="w-5 h-5 text-emerald-300" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-base text-white truncate">{p.name}</div>
        <div className="text-[11px] text-stone-500">{p.owner_name} · {new Date(p.created_at).toLocaleDateString("ro-RO")}</div>
      </div>
    </div>
    {p.description && <p className="text-xs text-stone-400 line-clamp-2 mb-3">{p.description}</p>}
    <div className="flex gap-3 text-[11px] text-stone-500 mb-4">
      <span>📌 {p.pin_count || 0} pin-uri</span>
      <span>📁 {p.model_count || 0} modele</span>
      {p.model_url ? <span className="text-emerald-400">● Model încărcat</span> : <span className="text-amber-400">● Demo public</span>}
    </div>
    <div className="flex gap-2">
      <button
        onClick={() => onOpen(p)}
        className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 text-xs rounded-full bg-[#d4ff3a] text-black font-medium hover:bg-[#c5f02e] transition-colors"
        data-testid={`dt-open-${p.id}`}
      >
        <Eye className="w-3.5 h-3.5" /> Deschide viewer
      </button>
      <button
        onClick={() => onDelete(p)}
        className="px-3 py-2 text-xs rounded-full border border-white/10 text-stone-400 hover:bg-red-500/10 hover:text-red-300 hover:border-red-500/30"
        data-testid={`dt-delete-${p.id}`}
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  </div>
);

const CreateModal = ({ onClose, onCreated }) => {
  const [form, setForm] = useState({ name: "", description: "", model_url: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const { data } = await axios.post(`${API}/digital-twin/projects`, {
        name: form.name.trim(),
        description: form.description.trim(),
        model_url: form.model_url.trim() || null,
      });
      onCreated(data);
    } catch (e) {
      setErr(e?.response?.data?.detail || e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="bg-stone-900 border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-4"
        data-testid="dt-create-modal"
      >
        <div>
          <h3 className="font-serif text-xl text-white mb-1">Proiect Digital Twin nou</h3>
          <p className="text-xs text-stone-400">Adaugă un model 3D (glTF/GLB direct URL) sau lasă gol pentru a folosi modelul demo.</p>
        </div>
        <div>
          <label className="text-xs text-stone-400 block mb-1">Nume proiect</label>
          <input
            required
            minLength={2}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Ex: Hillside House Sannicolau"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
            data-testid="dt-create-name"
          />
        </div>
        <div>
          <label className="text-xs text-stone-400 block mb-1">Descriere (opțional)</label>
          <textarea
            rows={2}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
            data-testid="dt-create-desc"
          />
        </div>
        <div>
          <label className="text-xs text-stone-400 block mb-1">
            URL model glTF/GLB (opțional) <span className="text-stone-600">— Phase B upload vine mai târziu</span>
          </label>
          <input
            type="url"
            value={form.model_url}
            onChange={(e) => setForm({ ...form, model_url: e.target.value })}
            placeholder="https://.../model.glb"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
            data-testid="dt-create-url"
          />
          <p className="text-[10px] text-stone-500 mt-1">
            Lasă gol → folosește modelul demo public Khronos Sponza (interior arhitectural).
          </p>
        </div>
        {err && <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-2">{err}</div>}
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="flex-1 px-3 py-2 text-sm rounded-lg bg-white/5 text-stone-300 hover:bg-white/10">
            Anulează
          </button>
          <button
            type="submit"
            disabled={busy}
            className="flex-1 px-3 py-2 text-sm rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-medium"
            data-testid="dt-create-submit"
          >
            {busy ? "Se creează..." : "Creează proiect"}
          </button>
        </div>
      </form>
    </div>
  );
};

const LockedScreen = ({ onRequest }) => (
  <div className="min-h-screen bg-stone-950 text-white flex items-center justify-center px-4">
    <div className="max-w-md text-center">
      <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mx-auto mb-4">
        <Lock className="w-7 h-7 text-amber-400" />
      </div>
      <h1 className="font-serif text-3xl mb-2">Digital Twin Pro</h1>
      <p className="text-stone-400 mb-6 leading-relaxed">
        Modulul Digital Twin Pro îți oferă vizualizare 3D profesională (X-Ray, layer toggle, secțiuni dinamice), colaborare cu pin-uri ancorate pe model și workflow inter-specialități. Disponibil pe abonament premium.
      </p>
      <div className="space-y-2 mb-6 text-sm text-stone-400 text-left max-w-sm mx-auto">
        <Feat>🎨 Pereți cu textură, albi, la roșu, transparenți (X-Ray)</Feat>
        <Feat>🏗️ Layer toggle: AR_PERETI, AR_USI, AR_STALPI etc.</Feat>
        <Feat>📌 Pin-uri 3D cu thread comentarii și roluri</Feat>
        <Feat>🤝 Colaborare client / specialist / arhitect</Feat>
        <Feat>📐 Tape Measure, Section Plane, Camera tours</Feat>
      </div>
      <button
        onClick={onRequest}
        className="px-6 py-3 rounded-full bg-[#d4ff3a] text-black font-semibold hover:bg-[#c5f02e]"
        data-testid="dt-request-access"
      >
        <Sparkles className="w-4 h-4 inline mr-2" /> Cere acces Pro
      </button>
      <p className="text-xs text-stone-600 mt-4">
        În etapa beta, accesul se acordă manual de admin. Stripe wiring vine în versiunea Pro publică.
      </p>
    </div>
  </div>
);

const Feat = ({ children }) => (
  <div className="flex items-start gap-2 px-3 py-1.5 rounded-lg bg-white/[0.02] border border-white/5">
    <span className="text-stone-300">{children}</span>
  </div>
);

export default function DigitalTwinPage() {
  const [sub, setSub] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openCreate, setOpenCreate] = useState(false);
  const [viewing, setViewing] = useState(null);

  const loadAll = async () => {
    setLoading(true);
    try {
      const subRes = await axios.get(`${API}/digital-twin/subscription`);
      setSub(subRes.data);
      if (subRes.data.active) {
        const pr = await axios.get(`${API}/digital-twin/projects`);
        setProjects(pr.data.items || []);
      }
    } catch {/* unauth handled by interceptor */} finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const handleDelete = async (p) => {
    if (!window.confirm(`Șterge proiectul "${p.name}" și toate pin-urile?`)) return;
    try {
      await axios.delete(`${API}/digital-twin/projects/${p.id}`);
      setProjects((arr) => arr.filter((x) => x.id !== p.id));
    } catch (e) {
      alert(e?.response?.data?.detail || e.message);
    }
  };

  const requestAccess = async () => {
    alert("Cererea ta a fost notată. Un admin îți va acorda acces în scurt timp.\n\nPentru testare imediată, roagă admin-ul să ruleze:\nPOST /api/admin/digital-twin/subscription/grant cu user_id-ul tău.");
  };

  if (loading) {
    return <div className="min-h-screen bg-stone-950 text-stone-400 flex items-center justify-center text-sm">Se încarcă...</div>;
  }
  if (!sub?.active) return <LockedScreen onRequest={requestAccess} />;

  if (viewing) {
    return (
      <DigitalTwinViewer
        modelUrl={viewing.model_url}
        projectName={viewing.name}
        onClose={() => setViewing(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-stone-950 text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-stone-400 hover:text-white mb-6">
          <ArrowLeft className="w-4 h-4" /> Înapoi
        </Link>
        <header className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-emerald-400/80 font-semibold mb-1">Premium · Digital Twin Pro</div>
            <h1 className="font-serif text-4xl">Proiectele tale 3D</h1>
            <p className="text-sm text-stone-400 mt-1">Vizualizare BIM colaborativă · X-Ray · pin-uri · workflow inter-specialități</p>
          </div>
          <button
            onClick={() => setOpenCreate(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#d4ff3a] text-black font-medium hover:bg-[#c5f02e]"
            data-testid="dt-new-project-btn"
          >
            <Plus className="w-4 h-4" /> Proiect nou
          </button>
        </header>

        {projects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-12 text-center" data-testid="dt-empty-state">
            <Box className="w-12 h-12 text-stone-600 mx-auto mb-3" />
            <h2 className="text-lg text-white mb-1">Niciun proiect încă</h2>
            <p className="text-sm text-stone-400 mb-4">Creează primul tău Digital Twin. Poți folosi un URL .glb propriu sau modelul demo.</p>
            <button
              onClick={() => setOpenCreate(true)}
              className="px-4 py-2 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium"
              data-testid="dt-empty-create-btn"
            >
              Creează primul proiect
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="dt-projects-grid">
            {projects.map((p) => (
              <ProjectCard key={p.id} p={p} onOpen={setViewing} onDelete={handleDelete} />
            ))}
          </div>
        )}

        <div className="mt-10 rounded-2xl border border-white/5 bg-white/[0.02] p-5 text-xs text-stone-500">
          <div className="flex items-center gap-2 mb-2">
            <ExternalLink className="w-3.5 h-3.5" />
            <strong className="text-stone-300">Phase C MVP — what works now</strong>
          </div>
          <ul className="space-y-1 list-disc list-inside pl-1">
            <li>Viewer 3D web cu Three.js + react-three-fiber</li>
            <li>5 face styles: Shaded · White · X-Ray · Wireframe · Monochrome</li>
            <li>Auto-detectare layers/tags din numele mesh-urilor (AR_PERETI, AR_USI etc.)</li>
            <li>Layer toggle individual per categorie</li>
            <li>OrbitControls (rotate · zoom · pan) cu damping</li>
          </ul>
          <div className="mt-3 text-stone-600">
            Next: upload .skp/.ifc + conversie server-side (Phase B), Tape Measure + Section Plane (Phase D), Pin UI cu thread (Phase E).
          </div>
        </div>
      </div>

      {openCreate && (
        <CreateModal
          onClose={() => setOpenCreate(false)}
          onCreated={(p) => {
            setProjects((arr) => [p, ...arr]);
            setOpenCreate(false);
            setViewing(p);
          }}
        />
      )}
    </div>
  );
}
