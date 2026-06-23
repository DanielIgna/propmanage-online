// House Health main page — 9 sections (F2 + F3 implementation).
// Route: /house-health/:twinId
import React, { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";
import {
  Heart, Wind, Thermometer, Droplets, Zap as Bolt, Radio,
  FileText, Clock, Lightbulb, Gauge, Upload, Link as LinkIcon,
  CheckCircle2, AlertTriangle, Trash2, Plus, Loader2, ChevronLeft
} from "lucide-react";
import { API } from "./DashShared";

const SECTIONS = [
  { key: "score",       label: "Scor proprietate",    icon: Gauge },
  { key: "air",         label: "Calitatea aerului",   icon: Wind },
  { key: "thermal",     label: "Analiză termică",     icon: Thermometer },
  { key: "humidity",    label: "Umiditate & infiltrații", icon: Droplets },
  { key: "electric",    label: "Siguranță electrică", icon: Bolt },
  { key: "radon",       label: "Radon",               icon: Radio },
  { key: "docs",        label: "Documentație tehnică", icon: FileText },
  { key: "history",     label: "Istoric verificări",  icon: Clock },
  { key: "recommendations", label: "Recomandări",     icon: Lightbulb },
];

const DOC_CATEGORIES = [
  { key: "certificat_energetic", label: "Certificat energetic" },
  { key: "carte_tehnica", label: "Carte tehnică" },
  { key: "cadastru", label: "Cadastru" },
  { key: "extras_cf", label: "Extras CF" },
  { key: "facturi_renovari", label: "Facturi renovări" },
  { key: "garantii", label: "Garanții" },
  { key: "manuale", label: "Manuale" },
  { key: "procese_verbale", label: "Procese verbale" },
  { key: "hh_report", label: "Raport House Health" },
  { key: "other", label: "Altele" },
];

const EXT_TYPES = [
  { key: "google_drive", label: "Google Drive" },
  { key: "dropbox", label: "Dropbox" },
  { key: "onedrive", label: "OneDrive" },
  { key: "custom", label: "Link personalizat" },
];

const fmtDate = (iso) => {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("ro-RO", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return "—"; }
};

const HouseHealthPage = () => {
  const { twinId } = useParams();
  const [section, setSection] = useState("score");
  const [dashData, setDashData] = useState(null);

  useEffect(() => {
    axios.get(`${API}/house-health/dashboard`).then((r) => setDashData(r.data)).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        <div className="flex items-center gap-3 mb-5">
          <Link to="/client" className="text-stone-400 hover:text-stone-200 inline-flex items-center gap-1 text-sm">
            <ChevronLeft className="w-4 h-4" /> Înapoi
          </Link>
        </div>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
            <Heart className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Sănătatea Casei</h1>
            <p className="text-xs text-stone-400">
              {dashData?.twin?.name || "Proprietatea ta"} ·
              <span className={`ml-1 ${dashData?.subscription?.status === "active" ? "text-emerald-400" : "text-amber-400"}`}>
                {(dashData?.subscription?.status || "no-sub").toUpperCase()}
              </span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-5">
          {/* Sidebar */}
          <aside className="bg-stone-900/40 border border-stone-800 rounded-2xl p-3 h-fit" data-testid="hh-sidebar">
            {SECTIONS.map((s) => {
              const Icon = s.icon;
              const isActive = section === s.key;
              return (
                <button
                  key={s.key}
                  onClick={() => setSection(s.key)}
                  className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-2 text-sm mb-0.5 transition-colors ${
                    isActive ? "bg-emerald-500/15 text-emerald-300 font-semibold" : "text-stone-300 hover:bg-stone-800"
                  }`}
                  data-testid={`hh-tab-${s.key}`}
                >
                  <Icon className="w-4 h-4" />
                  {s.label}
                </button>
              );
            })}
          </aside>

          {/* Main */}
          <div data-testid={`hh-section-${section}`}>
            {section === "score" && <ScoreSection data={dashData} />}
            {section === "docs" && <DocumentsSection twinId={twinId} />}
            {section === "history" && <HistorySection twinId={twinId} />}
            {section === "recommendations" && <RecommendationsSection />}
            {["air", "thermal", "humidity", "electric", "radon"].includes(section) && (
              <EvaluationSection twinId={twinId} kind={section} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================== SCORE SECTION ==============================
const ScoreSection = ({ data }) => {
  if (!data) return <div className="text-stone-400 text-sm">Se încarcă...</div>;
  const score = data.score_overall;
  const cls = data.classification;
  return (
    <div className="bg-stone-900/40 border border-stone-800 rounded-2xl p-6">
      <h2 className="text-lg font-bold mb-4">Scor general proprietate</h2>
      <div className="flex items-end gap-4 mb-6">
        <div className="text-6xl font-extrabold text-emerald-300 tabular-nums">{score ?? "—"}</div>
        <div className="text-stone-500 mb-2">/100</div>
        <div className={`mb-2 ml-3 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
          cls === "Excellent" ? "bg-emerald-500/15 text-emerald-300" :
          cls === "Good" ? "bg-sky-500/15 text-sky-300" :
          cls === "Fair" ? "bg-amber-500/15 text-amber-300" :
          "bg-rose-500/15 text-rose-300"
        }`}>{cls || "Pending"}</div>
      </div>
      <div className="text-xs text-stone-400 space-y-1">
        <div>📊 Calculat din: Calitatea aerului · Performanță termică · Umiditate · Electric · Documentație · Mentenanță · Radon</div>
        <div>📅 Ultima evaluare: <strong className="text-stone-200">{fmtDate(data.last_evaluation_date)}</strong></div>
        <div>🔔 Următoarea recomandată: <strong className="text-stone-200">{fmtDate(data.next_evaluation_date)}</strong></div>
        <div className="mt-3 p-3 bg-stone-800/40 rounded-lg text-[11px]">
          ⚙ Clasificare: <strong>90-100 Excellent · 75-89 Good · 50-74 Fair · 0-49 Needs Attention</strong>.
          Formula scor e configurabilă din Admin panel.
        </div>
      </div>
    </div>
  );
};

// ============================== DOCUMENTS SECTION ==============================
const DocumentsSection = ({ twinId }) => {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState("file"); // file | link
  const [category, setCategory] = useState("carte_tehnica");
  const [description, setDescription] = useState("");
  const [docDate, setDocDate] = useState("");
  const [externalLink, setExternalLink] = useState("");
  const [externalType, setExternalType] = useState("google_drive");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/house-health/documents`, { params: { twin_project_id: twinId } });
      setDocs(r.data?.items || []);
    } finally { setLoading(false); }
  };
  useEffect(() => { if (twinId) load(); }, [twinId]);

  const submit = async () => {
    setError("");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("twin_project_id", twinId);
      fd.append("category", category);
      fd.append("description", description);
      fd.append("doc_date", docDate);
      if (mode === "file") {
        const f = fileRef.current?.files?.[0];
        if (!f) { setError("Selectează un fișier."); setUploading(false); return; }
        fd.append("file", f);
      } else {
        if (!externalLink) { setError("Introdu link-ul."); setUploading(false); return; }
        fd.append("external_link", externalLink);
        fd.append("external_type", externalType);
      }
      await axios.post(`${API}/house-health/documents`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      setDescription(""); setExternalLink(""); setDocDate("");
      if (fileRef.current) fileRef.current.value = "";
      await load();
    } catch (e) {
      setError(e?.response?.data?.detail || "Eroare la încărcare");
    } finally { setUploading(false); }
  };

  const remove = async (id) => {
    if (!window.confirm("Ștergi documentul?")) return;
    await axios.delete(`${API}/house-health/documents/${id}`);
    await load();
  };

  return (
    <div className="bg-stone-900/40 border border-stone-800 rounded-2xl p-5" data-testid="hh-docs-section">
      <h2 className="text-lg font-bold mb-3">Documentație tehnică</h2>

      {/* Upload form */}
      <div className="border border-stone-800 rounded-xl p-4 mb-4">
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setMode("file")}
            className={`text-xs px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5 ${mode === "file" ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/40" : "bg-stone-800 text-stone-300 border border-stone-700"}`}
            data-testid="hh-doc-mode-file"
          ><Upload className="w-3 h-3" /> Fișier local</button>
          <button
            onClick={() => setMode("link")}
            className={`text-xs px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5 ${mode === "link" ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/40" : "bg-stone-800 text-stone-300 border border-stone-700"}`}
            data-testid="hh-doc-mode-link"
          ><LinkIcon className="w-3 h-3" /> Link extern</button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="bg-stone-800 border border-stone-700 rounded px-2 py-1.5 text-sm" data-testid="hh-doc-category">
            {DOC_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
          <input type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)} className="bg-stone-800 border border-stone-700 rounded px-2 py-1.5 text-sm" placeholder="Data document" data-testid="hh-doc-date" />
        </div>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Descriere..."
          className="w-full bg-stone-800 border border-stone-700 rounded px-2 py-1.5 text-sm mb-2"
          data-testid="hh-doc-description"
        />

        {mode === "file" ? (
          <input type="file" ref={fileRef} className="text-xs text-stone-300" data-testid="hh-doc-file" />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <select value={externalType} onChange={(e) => setExternalType(e.target.value)} className="bg-stone-800 border border-stone-700 rounded px-2 py-1.5 text-sm" data-testid="hh-doc-extype">
              {EXT_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
            <input value={externalLink} onChange={(e) => setExternalLink(e.target.value)} placeholder="https://..." className="bg-stone-800 border border-stone-700 rounded px-2 py-1.5 text-sm" data-testid="hh-doc-extlink" />
          </div>
        )}

        {error && <div className="text-xs text-rose-400 mt-2">{error}</div>}
        <button
          onClick={submit}
          disabled={uploading}
          className="mt-3 px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"
          data-testid="hh-doc-upload"
        >
          {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
          {uploading ? "Se încarcă..." : "Adaugă document"}
        </button>
      </div>

      {/* List */}
      {loading && <div className="text-xs text-stone-500">Se încarcă...</div>}
      {!loading && docs.length === 0 && <div className="text-xs text-stone-500 italic">Niciun document încă.</div>}
      <ul className="space-y-1.5" data-testid="hh-docs-list">
        {docs.map((d, i) => (
          <li key={d.id} className="flex items-center gap-3 text-sm px-3 py-2 rounded-lg bg-stone-800/40 border border-stone-700/40" data-testid={`hh-doc-${i}`}>
            <FileText className="w-4 h-4 text-stone-400 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-stone-100 truncate font-medium">
                {d.description || d.filename || "Document"}
              </div>
              <div className="text-[10px] text-stone-500 flex items-center gap-2 flex-wrap">
                <span className="uppercase tracking-wider">{d.category.replace(/_/g, " ")}</span>
                {d.doc_date && <span>· {fmtDate(d.doc_date)}</span>}
                <span>· {d.storage === "external" ? `link ${d.external_type}` : `local ${(d.size_bytes / 1024).toFixed(0)}kb`}</span>
              </div>
            </div>
            {d.storage === "external" ? (
              <a href={d.external_link} target="_blank" rel="noreferrer" className="text-xs text-cyan-400 hover:underline">Deschide</a>
            ) : (
              <a href={`${API}${d.file_url}`} target="_blank" rel="noreferrer" className="text-xs text-emerald-400 hover:underline">Descarcă</a>
            )}
            <button onClick={() => remove(d.id)} className="text-rose-400 hover:text-rose-300" data-testid={`hh-doc-delete-${i}`}>
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

// ============================== HISTORY SECTION ==============================
const HistorySection = ({ twinId }) => {
  const [events, setEvents] = useState([]);
  useEffect(() => {
    if (!twinId) return;
    axios.get(`${API}/house-health/history/${twinId}`).then((r) => setEvents(r.data?.items || [])).catch(() => {});
  }, [twinId]);

  if (events.length === 0) return (
    <div className="bg-stone-900/40 border border-stone-800 rounded-2xl p-5" data-testid="hh-history-empty">
      <h2 className="text-lg font-bold mb-2">Istoric verificări</h2>
      <p className="text-sm text-stone-400">Niciun eveniment înregistrat încă. Evaluările aprobate vor apărea aici cronologic.</p>
    </div>
  );

  return (
    <div className="bg-stone-900/40 border border-stone-800 rounded-2xl p-5" data-testid="hh-history-section">
      <h2 className="text-lg font-bold mb-4">Istoric verificări</h2>
      <ol className="relative border-l-2 border-stone-700 ml-3 space-y-4">
        {events.map((e, i) => (
          <li key={i} className="ml-5 relative" data-testid={`hh-history-${i}`}>
            <span className="absolute -left-[34px] top-1 w-4 h-4 rounded-full bg-emerald-500 ring-4 ring-stone-950"></span>
            <div className="text-[11px] text-stone-500">{fmtDate(e.date)}</div>
            <div className="text-sm font-semibold text-stone-100">{e.title}</div>
            <div className="text-xs text-stone-400">{e.kind === "evaluation" ? `Tip: ${e.evaluation_kind}` : "Raport"}</div>
          </li>
        ))}
      </ol>
    </div>
  );
};

// ============================== EVALUATION SECTION ==============================
const EVAL_META = {
  air:      { title: "Calitatea aerului", icon: Wind, fields: ["temperatura", "umiditate", "viteza_aerului", "CO2"] },
  thermal:  { title: "Analiză termică", icon: Thermometer, fields: ["zone_investigate"] },
  humidity: { title: "Umiditate & infiltrații", icon: Droplets, fields: ["zone_afectate", "severitate"] },
  electric: { title: "Siguranță electrică", icon: Bolt, fields: ["tensiuni", "continuitate", "probleme"] },
  radon:    { title: "Radon", icon: Radio, fields: ["valoare_medie", "perioada", "status"] },
};

const EvaluationSection = ({ twinId, kind }) => {
  const meta = EVAL_META[kind];
  const [items, setItems] = useState([]);
  const [equipment, setEquipment] = useState([]);

  useEffect(() => {
    if (!twinId) return;
    axios.get(`${API}/house-health/evaluations`, { params: { twin_project_id: twinId } })
      .then((r) => setItems((r.data?.items || []).filter((e) => e.kind === kind)))
      .catch(() => {});
    axios.get(`${API}/house-health/equipment-catalog`)
      .then((r) => setEquipment(r.data?.equipment?.[kind] || []))
      .catch(() => {});
  }, [twinId, kind]);

  const Icon = meta.icon;
  const STATUS_COLORS = {
    draft: "bg-stone-500/20 text-stone-300",
    pending_approval: "bg-amber-500/20 text-amber-300",
    approved: "bg-emerald-500/20 text-emerald-300",
    rejected: "bg-rose-500/20 text-rose-300",
  };

  return (
    <div className="bg-stone-900/40 border border-stone-800 rounded-2xl p-5" data-testid={`hh-eval-${kind}`}>
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-5 h-5 text-emerald-400" />
        <h2 className="text-lg font-bold">{meta.title}</h2>
      </div>

      <div className="p-3 bg-stone-800/40 rounded-lg text-xs mb-4">
        <div className="text-stone-400">📦 Echipamente acceptate:</div>
        <div className="text-stone-200 font-medium mt-1">{equipment.length > 0 ? equipment.join(" · ") : "—"}</div>
        <div className="text-stone-500 mt-2 text-[11px]">
          Specialistul folosește aparatura proprie și încarcă rapoartele aici (PDF, imagini, măsurători).
          Toate evaluările trec prin aprobare admin.
        </div>
      </div>

      <div className="text-xs uppercase tracking-wider text-stone-500 font-bold mb-2">Evaluări existente</div>
      {items.length === 0 ? (
        <div className="text-xs text-stone-500 italic" data-testid={`hh-eval-empty-${kind}`}>
          Nicio evaluare {meta.title.toLowerCase()} încă. Cere specialistului să creeze una.
        </div>
      ) : (
        <ul className="space-y-1.5">
          {items.map((e, i) => (
            <li key={e.id} className="flex items-center gap-3 text-sm px-3 py-2 rounded-lg bg-stone-800/40 border border-stone-700/40" data-testid={`hh-eval-item-${i}`}>
              <div className="flex-1">
                <div className="text-stone-100 font-medium">{fmtDate(e.date)} · {e.specialist_email || "specialist"}</div>
                <div className="text-[10px] text-stone-500 truncate">{e.observations || "fără observații"}</div>
              </div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase ${STATUS_COLORS[e.status] || ""}`}>
                {e.status?.replace(/_/g, " ")}
              </span>
              <span className="text-[10px] text-stone-500">{(e.attachments || []).length} fișiere</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// ============================== RECOMMENDATIONS SECTION ==============================
const RecommendationsSection = () => (
  <div className="bg-stone-900/40 border border-stone-800 rounded-2xl p-5" data-testid="hh-recommendations-section">
    <h2 className="text-lg font-bold mb-2">Recomandări</h2>
    <p className="text-sm text-stone-400 mb-3">
      După fiecare evaluare aprobată, specialistul introduce recomandări cu prioritate.
    </p>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
      <div className="px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300">
        <div className="font-bold uppercase tracking-wider mb-1">🚨 Urgent</div>
        <div className="text-stone-400">Lucrări critice — necesar imediat.</div>
      </div>
      <div className="px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300">
        <div className="font-bold uppercase tracking-wider mb-1">⚠ Recomandat</div>
        <div className="text-stone-400">Intervenții preventive recomandate.</div>
      </div>
      <div className="px-3 py-2 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-300">
        <div className="font-bold uppercase tracking-wider mb-1">👁 Monitorizare</div>
        <div className="text-stone-400">Atenție în viitor, nu acum.</div>
      </div>
    </div>
    <div className="mt-3 text-[11px] text-stone-500 italic">
      ℹ Generarea automată a lead-urilor în marketplace e pregătită infrastructural (F4).
    </div>
  </div>
);

export default HouseHealthPage;
