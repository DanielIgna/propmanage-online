// Secțiunile „Casa mea" — UX aprobat, logică de business EXISTENTĂ (upload, active, atribute, riscuri,
// calendar, bloc, pașaport). Componentele complexe existente sunt refolosite ca atare.
import React, { useState } from "react";
import axios from "axios";
import {
  Box, HeartPulse, MapPin, Layers, Plus, ShieldCheck, Clock, FileText, Upload, Search, Info, ChevronRight, Sparkles, Pencil,
} from "lucide-react";
import { Card, Overline, H2, Primary, Secondary, Chip, Bar, Row, Ghost, HelpDot, Ring } from "./ui3";
import { buildIndicators, fmtDate } from "./data3";
import { OppCard } from "./HomeV3";
import { API } from "../DashShared";
import { formatApiError } from "../../auth";
import { CARTEA_CASEI_DISCLAIMER } from "../../lib/houseHealthAxis";
import { UploadSheet, VaultSheet, DocSheet, MemoryCelebration } from "./DocumentVault";
import { PassportCard } from "./PassportCard";
import { PropertyTechnicalRecord } from "./PropertyTechnicalRecord";
import { MaintenanceCalendar } from "../../components/MaintenanceCalendar";
import { BuildingHub } from "../../components/BuildingHub";
import { StorageUsageCard } from "../../components/StorageUsageCard";

// ── Cartea casei ─────────────────────────────────────────────────────────────
export const SectionCarte = ({ d, prop, act, goSection }) => {
  const c = d.completeness; const docs = d.docs;
  const [q, setQ] = useState(""); const [cat, setCat] = useState("");
  const [upload, setUpload] = useState(null); // null | { cat }
  const [vault, setVault] = useState(false);
  const [docId, setDocId] = useState(null);
  const [celebrate, setCelebrate] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const list = (docs?.documents || []).filter(x => (!q || x.title.toLowerCase().includes(q.toLowerCase())) && (!cat || x.category === cat));

  const onUploaded = (data) => {
    setUpload(null);
    setRefreshKey(k => k + 1);
    if (data.first_upload) setCelebrate(data.completeness?.score);
    window.dispatchEvent(new CustomEvent("propmanage:doc-uploaded"));
  };
  // Un element lipsă din Cartea casei → acțiunea REALĂ care îl rezolvă (upload / twin / active / atribute / cerere / calendar)
  const resolve = (id) => {
    const action = (c?.items || []).find(i => i.id === id)?.action || "";
    if (action.startsWith("upload:")) return setUpload({ cat: action.split(":")[1] });
    if (action === "twin") return act("twin");
    if (action === "assets") return goSection("echipamente");
    if (action === "dna") return goSection("dosar");
    if (action === "request") return act("request");
    if (action === "maintenance") return goSection("calendar");
    setUpload({ cat: "" });
  };

  return (
    <div className="space-y-4" data-testid="v3-sec-carte">
      <Card tid="vault-card">
        <div className="flex items-center gap-4">
          <Ring value={c?.score ?? 0} label="%" size={72} />
          <div className="flex-1 min-w-0">
            <H2>Cartea casei</H2>
            <p className="text-xs text-slate-500 mt-0.5">Memoria permanentă a locuinței · {c?.docs_count ?? 0} documente{c?.photos_count ? ` · ${c.photos_count} fotografii` : ""}</p>
            {c?.next_step && <button type="button" onClick={() => resolve(c.next_step.id)} className="mt-2 inline-flex items-center gap-2 min-h-[36px] px-3 rounded-full bg-[#F6FEE7] border border-[#D2F2DC] text-xs font-bold text-slate-800" data-testid="vault-next-step"><Sparkles className="w-3.5 h-3.5 text-[#166534]" /> Următorul: {c.next_step.label} <Chip tone="dark">+{c.next_step.expected_gain}%</Chip></button>}
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Primary className="flex-1" onClick={() => setUpload({ cat: "" })} tid="vault-add-btn"><Upload className="w-4 h-4" /> Adaugă document</Primary>
          {c?.docs_count > 0 && <Secondary onClick={() => setVault(true)} tid="vault-open-all">Toate ({c.docs_count})</Secondary>}
        </div>
      </Card>
      {c?.missing?.length > 0 && (
        <Card tid="v3-carte-missing">
          <Overline>Ce lipsește (în ordinea impactului)</Overline>
          <div className="mt-2 space-y-1.5">
            {c.missing.slice(0, 4).map(m => (
              <button type="button" key={m.id} onClick={() => resolve(m.id)} className="w-full min-h-[48px] flex items-center gap-3 rounded-2xl border border-dashed border-slate-200 px-3.5 text-left hover:bg-slate-50" data-testid={`v3-missing-${m.id}`}>
                <span className="flex-1 text-sm font-semibold text-slate-700">{m.label}</span><Chip tone="lime">+{m.gain}%</Chip><ChevronRight className="w-4 h-4 text-slate-300" />
              </button>
            ))}
          </div>
        </Card>
      )}
      <Card tid="v3-carte-docs">
        <div className="flex items-center gap-2 px-3 min-h-[44px] rounded-full border border-slate-200"><Search className="w-4 h-4 text-slate-400" /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Caută în documente…" className="flex-1 text-sm bg-transparent outline-none" data-testid="v3-carte-search" /></div>
        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button type="button" onClick={() => setCat("")} className={`shrink-0 min-h-[36px] px-3 rounded-full text-xs font-bold border ${!cat ? "bg-slate-900 text-white border-slate-900" : "border-slate-200 text-slate-600"}`}>Toate ({docs?.total ?? 0})</button>
          {(docs?.facets || []).map(f => <button type="button" key={f.category} onClick={() => setCat(cat === f.category ? "" : f.category)} className={`shrink-0 min-h-[36px] px-3 rounded-full text-xs font-bold border ${cat === f.category ? "bg-slate-900 text-white border-slate-900" : "border-slate-200 text-slate-600"}`}>{f.label} ({f.count})</button>)}
        </div>
        <div className="mt-3 space-y-1.5">
          {list.slice(0, 12).map(x => <Row key={x.id} icon={FileText} title={x.title} sub={`${x.category_label} · ${fmtDate(x.doc_date || x.uploaded_at)}${x.room ? ` · ${x.room}` : ""}`} onClick={() => setDocId(x.id)} tid={`v3-doc-${x.id}`} />)}
          {list.length === 0 && <p className="py-6 text-center text-sm text-slate-400">{docs?.total ? "Niciun document pentru acest filtru." : "Niciun document încă — adaugă primul."}</p>}
          {list.length > 12 && <Secondary full onClick={() => setVault(true)}>Vezi toate documentele ({list.length})</Secondary>}
        </div>
      </Card>
      <StorageUsageCard />
      <p className="text-[11px] text-slate-400 leading-relaxed flex gap-1.5 px-1" data-testid="vault-legal-note"><Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />{CARTEA_CASEI_DISCLAIMER}</p>

      {upload && <UploadSheet prop={prop} presetCategory={upload.cat} onClose={() => setUpload(null)} onDone={onUploaded} />}
      {vault && <VaultSheet prop={prop} onClose={() => setVault(false)} onUpload={() => { setVault(false); setUpload({ cat: "" }); }} refreshKey={refreshKey} />}
      {docId && <DocSheet docId={docId} onClose={() => setDocId(null)} onChanged={() => { setDocId(null); window.dispatchEvent(new CustomEvent("propmanage:doc-uploaded")); }} />}
      {celebrate != null && <MemoryCelebration score={celebrate} onClose={() => setCelebrate(null)} />}
    </div>
  );
};

// ── Dosar tehnic ─────────────────────────────────────────────────────────────
const ATTR_LABELS = {
  beton: "Beton", caramida: "Cărămidă", bca: "BCA", lemn: "Lemn", metal: "Metal", mixt: "Mixt", polistiren: "Polistiren", vata_minerala: "Vată minerală",
  vata_bazaltica: "Vată bazaltică", neizolat: "Neizolat", alta: "Alta", tigla: "Țiglă", tabla: "Tablă", membrana: "Membrană", sindrila: "Șindrilă", terasa: "Terasă",
  centrala_gaz: "Centrală gaz", centrala_electrica: "Centrală electrică", termoficare: "Termoficare", pompa_caldura: "Pompă de căldură", lemne: "Lemne",
};

// DNA v2 — date declarate cu provenance (PATCH /dna-attributes)
const AttrRow = ({ a, propId, source, onSaved }) => {
  const [edit, setEdit] = useState(false);
  const [val, setVal] = useState(a.value ?? "");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (val === "" || val === null) return;
    setBusy(true);
    try { await axios.patch(`${API}/properties/${propId}/dna-attributes`, { attributes: { [a.key]: a.type === "enum" ? val : Number(val) }, source }); setEdit(false); onSaved(); }
    catch (e) { alert(formatApiError(e)); }
    setBusy(false);
  };
  return (
    <div className="min-h-[40px] text-sm" data-testid={`dna-attr-${a.key}`}>
      <div className="flex items-center gap-2">
        <span className="flex-1 text-slate-700">{a.label}</span>
        {!edit && a.value != null && <><span className="font-bold text-slate-900">{ATTR_LABELS[a.value] || String(a.value)}</span><Chip tone="slate">{a.confidence_label}</Chip><button type="button" onClick={() => setEdit(true)} aria-label="Modifică" className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-50" data-testid={`dna-attr-edit-${a.key}`}><Pencil className="w-3.5 h-3.5" /></button></>}
        {!edit && a.value == null && <Ghost onClick={() => setEdit(true)} tid={`dna-attr-add-${a.key}`}>+ Completează</Ghost>}
      </div>
      {edit && (
        <div className="mt-1.5 flex items-center gap-2" data-testid={`dna-attr-form-${a.key}`}>
          {a.type === "enum" ? (
            <select value={val} onChange={e => setVal(e.target.value)} data-testid={`dna-attr-input-${a.key}`} className="flex-1 min-h-[40px] px-3 rounded-full border border-slate-200 text-xs font-bold text-slate-700 bg-white">
              <option value="">—</option>
              {a.options.map(o => <option key={o} value={o}>{ATTR_LABELS[o] || o}</option>)}
            </select>
          ) : (
            <input type="number" value={val} onChange={e => setVal(e.target.value)} placeholder="—" data-testid={`dna-attr-input-${a.key}`} className="flex-1 min-h-[40px] px-3 rounded-full border border-slate-200 text-sm outline-none" />
          )}
          <Primary className="!min-h-[40px] !px-4 text-xs" disabled={busy || val === ""} onClick={save} tid={`dna-attr-save-${a.key}`}>{busy ? "…" : "Salvează"}</Primary>
          <Secondary className="!min-h-[40px] !px-3 text-xs" onClick={() => setEdit(false)}>Anulează</Secondary>
        </div>
      )}
    </div>
  );
};

export const SectionDosar = ({ d, prop }) => {
  const p = d.ptr; const core = p?.property_core;
  const [source, setSource] = useState("owner_declared");
  const filled = d.attrs.filter(a => a.value != null).length;
  return (
    <div className="space-y-4" data-testid="v3-sec-dosar">
      <Card>
        <H2>Dosar tehnic</H2>
        <p className="text-xs text-slate-500 mt-0.5">Datele obiective ale locuinței și clădirii — cu sursă și nivel de încredere.</p>
        {p && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            {[["Tip", { apartment: "Apartament", house: "Casă" }[core?.identity?.type] || core?.identity?.type || "—"], ["Camere", core?.identity?.rooms ?? "—"], ["Suprafață", core?.identity?.surface ? `${core.identity.surface} m²` : "—"], ["Documente verificate", `${p.header?.documents_verified ?? 0}/${p.header?.documents_count ?? 0}`]].map(([k, v]) => (
              <div key={k} className="rounded-2xl bg-slate-50 p-3"><div className="text-[10px] font-black uppercase tracking-wide text-slate-400">{k}</div><div className="mt-1 text-sm font-bold text-slate-900">{v}</div></div>
            ))}
          </div>
        )}
      </Card>
      <Card tid="dna-attributes-card">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div><Overline>Detaliile casei</Overline><span className="text-[11px] text-slate-400">{filled}/{d.attrs.length} completate · fiecare cu sursă și nivel de încredere</span></div>
          <select value={source} onChange={e => setSource(e.target.value)} data-testid="dna-attr-source" className="min-h-[36px] px-3 rounded-full border border-slate-200 text-[11px] font-bold text-slate-600 bg-white">
            <option value="owner_declared">Declarat de mine</option>
            <option value="official_document">Am document oficial</option>
          </select>
        </div>
        <div className="mt-2 space-y-1.5">
          {d.attrs.map(a => <AttrRow key={a.key} a={a} propId={prop.id} source={source} onSaved={d.reload} />)}
        </div>
      </Card>
      {/* Dosarul complet: clădire (HartaBlocuri), diagnostice, sisteme, istoric, pregătire tranzacție (PDF) */}
      <PropertyTechnicalRecord propId={prop.id} />
    </div>
  );
};

// ── Echipamente & Digital Twin ───────────────────────────────────────────────
const EOL_TONE = { overdue: "rose", attention: "amber", monitor: "sky", ok: "emerald", hypothesis: "slate" };
const EOL_LABEL = { overdue: "Depășit", attention: "Atenție", monitor: "Monitorizare", ok: "OK", hypothesis: "Ipoteză" };

const AssetSlot = ({ s, propId, onSaved, onAudit }) => {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState("");
  const [source, setSource] = useState("owner_declared");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const { data } = await axios.post(`${API}/properties/${propId}/assets`, { asset_type: s.asset_type, installed_year: year ? parseInt(year, 10) : null, source });
      onSaved(data.slots); setOpen(false); setYear("");
    } catch (e) { alert(formatApiError(e)); }
    setBusy(false);
  };
  return (
    <div className="rounded-2xl border border-slate-100 px-3.5 py-3" data-testid={`asset-slot-${s.asset_type}`}>
      <div className="min-h-[32px] flex items-center gap-3">
        <div className="flex-1 min-w-0"><div className="text-sm font-bold text-slate-900">{s.label}</div><div className="text-[11px] text-slate-400 truncate">{s.asset ? (s.asset.installed_year ? `instalat ${s.asset.installed_year}` : "an necunoscut") : s.lifespan_label}</div></div>
        {s.eol && <Chip tone={EOL_TONE[s.eol.status] || "slate"}>{EOL_LABEL[s.eol.status] || s.eol.status}</Chip>}
        {s.asset ? <Chip tone="slate"><ShieldCheck className="w-3 h-3" />{s.asset.confidence_label}</Chip>
          : <Secondary className="!min-h-[36px] !px-3 text-xs" onClick={() => setOpen(o => !o)} tid={`asset-add-${s.asset_type}`}><Plus className="w-3.5 h-3.5" /> Adaugă</Secondary>}
      </div>
      {s.eol && (
        <div className="mt-2 rounded-xl bg-slate-50 p-2.5 text-[11px]" data-testid={`asset-eol-${s.asset_type}`}>
          <div className="flex items-center gap-2 flex-wrap"><span className="font-bold text-slate-700">{s.eol.remaining_label}</span><Chip tone="slate">Estimat</Chip>{s.eol.cost_label && <span className="ml-auto font-mono text-slate-500">{s.eol.cost_label}</span>}</div>
          {s.eol.recommended_action && <div className="mt-1 text-slate-600 font-semibold">{s.eol.recommended_action}</div>}
          {s.eol.needs_audit && <Ghost className="!min-h-[32px] !px-0" onClick={onAudit} tid={`asset-audit-cta-${s.asset_type}`}>Programează Audit Tehnic →</Ghost>}
        </div>
      )}
      {open && !s.asset && (
        <div className="mt-2 flex items-center gap-2" data-testid={`asset-form-${s.asset_type}`}>
          <input type="number" value={year} onChange={e => setYear(e.target.value)} placeholder="Anul instalării" data-testid={`asset-year-${s.asset_type}`} className="w-32 min-h-[40px] px-3 rounded-full border border-slate-200 text-sm outline-none" />
          <select value={source} onChange={e => setSource(e.target.value)} data-testid={`asset-source-${s.asset_type}`} className="flex-1 min-h-[40px] px-2 rounded-full border border-slate-200 text-[11px] font-bold text-slate-600 bg-white">
            <option value="owner_declared">Declarat de mine</option>
            <option value="official_document">Am document oficial</option>
          </select>
          <Primary className="!min-h-[40px] !px-4 text-xs" disabled={busy} onClick={save} tid={`asset-save-${s.asset_type}`}>{busy ? "…" : "Salvează"}</Primary>
        </div>
      )}
    </div>
  );
};

export const SectionEchipamente = ({ d, prop, act, explain }) => {
  const m = d.maturity; const a = d.assets;
  const twinInd = buildIndicators(d).find(i => i.id === "twin");
  const withAsset = (a?.slots || []).filter(s => s.asset).length;
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  // Audit First (Directiva 014): acceptă oportunitatea reală de audit sau deschide asistentul de cerere
  const audit = async (oppId) => {
    if (oppId) {
      setBusy(true);
      try { await axios.post(`${API}/client/opportunities/${oppId}/accept`); setDone(true); act("reloadRequests"); }
      catch (e) { alert(formatApiError(e)); }
      setBusy(false);
    } else act("request");
  };
  const runCta = () => {
    const cta = m?.next_step?.cta;
    if (cta === "audit") audit(m.audit_opportunity_id);
    else if (cta === "wizard") act("request");
    else if (cta === "edit_property") act("manage");
    else if (cta === "assets") document.querySelector('[data-testid="assets-card"]')?.scrollIntoView({ behavior: "smooth" });
  };
  return (
    <div className="space-y-4" data-testid="v3-sec-echipamente">
      {m && (
        <Card tid="maturity-card">
          <div className="flex items-start gap-3">
            <span className="w-11 h-11 rounded-2xl bg-slate-900 flex items-center justify-center shrink-0"><Box className="w-5 h-5 text-[#ccff00]" /></span>
            <div className="flex-1 min-w-0"><H2>Digital Twin · nivel {m.level} din 5</H2><p className="text-xs text-slate-500 mt-0.5">Copia digitală a casei este <b className="text-slate-800">{(m.level_label || "").toLowerCase()}</b> — cu cât urcă nivelul, cu atât casa e mai bine cunoscută și protejată.</p></div>
            {twinInd && <HelpDot onClick={() => explain(twinInd)} tid="v3-twin-help" />}
          </div>
          <div className="mt-4 flex items-end gap-1" data-testid="maturity-ladder">
            {(m.levels || []).map((label, l) => (
              <div key={l} className="flex-1 min-w-0 text-center">
                <div className={`h-2 rounded-full ${l <= m.level ? "bg-[#ccff00]" : "bg-slate-100"}`} />
                <div className={`mt-1 text-[9px] font-bold truncate ${l === m.level ? "text-slate-900" : "text-slate-400"}`}>{label}</div>
              </div>
            ))}
          </div>
          {m.next_step && !done && (
            <div className="mt-4 rounded-2xl bg-[#F6FEE7] border border-[#D2F2DC] p-4" data-testid="maturity-next-step">
              <Overline className="!text-[#166534]">Ca să urci la nivelul {m.next_step.missing_level}</Overline>
              <div className="mt-1 text-sm font-black text-slate-900">{m.next_step.title}</div>
              <p className="mt-0.5 text-xs text-slate-600">{m.next_step.benefit}</p>
              {m.audit_first && <p className="mt-1 text-[11px] font-bold text-[#166534]" data-testid="maturity-audit-first">Auditul Tehnic este punctul de intrare — deblochează restul serviciilor.</p>}
              <Primary className="mt-3" full disabled={busy} onClick={runCta} tid="maturity-cta">{busy ? "…" : m.next_step.cta_label}</Primary>
            </div>
          )}
          {done && <div className="mt-3 rounded-2xl p-3.5 bg-emerald-50 text-xs font-bold text-emerald-700" data-testid="maturity-cta-success">✓ Cererea de audit a fost creată — un specialist te va contacta în curând.</div>}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Secondary className="text-xs" onClick={() => act("twin")} tid="v2-hub-twin"><Box className="w-4 h-4" /> Deschide 3D</Secondary>
            <Secondary className="text-xs" onClick={() => act("gis")} tid="v2-hub-gis"><MapPin className="w-4 h-4" /> Harta locuinței</Secondary>
          </div>
        </Card>
      )}
      {a && (
        <Card tid="assets-card">
          <div className="flex items-center gap-3"><span className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center"><Layers className="w-5 h-5 text-[#166534]" /></span><div className="flex-1"><div className="text-sm font-black text-slate-900">Echipamentele casei</div><div className="text-xs text-slate-500">{withAsset}/{a.slots.length} înregistrate · durata de viață estimată</div></div></div>
          <div className="mt-3 space-y-1.5">
            {a.slots.map(s => <AssetSlot key={s.asset_type} s={s} propId={prop.id} onSaved={(slots) => d.update({ assets: { ...a, slots } })} onAudit={() => audit(a.audit_opportunity_id)} />)}
          </div>
          <p className="mt-3 text-[11px] text-slate-400">Estimările sunt orientative (bibliotecă actuarială de referință) — un audit tehnic confirmă starea reală.</p>
        </Card>
      )}
    </div>
  );
};

// ── Sănătate & riscuri ───────────────────────────────────────────────────────
const RISK_TONE = { technical: "rose", maintenance: "amber", legal: "sky" };

export const SectionRiscuri = ({ d, act, explain, go }) => {
  const hh = d.hh; const risks = d.risks?.risks || [];
  const hhInd = buildIndicators(d).find(i => i.id === "hh");
  const confirmed = d.requests.filter(r => r.status === "confirmed");
  const active = d.requests.filter(r => r.status !== "confirmed");
  const [done, setDone] = useState(false);
  const mitigate = async (risk) => {
    const cta = risk.mitigation?.cta;
    if (cta === "audit") {
      if (d.risks?.audit_opportunity_id) {
        try { await axios.post(`${API}/client/opportunities/${d.risks.audit_opportunity_id}/accept`); setDone(true); act("reloadRequests"); }
        catch (e) { alert(formatApiError(e)); }
      } else act("request");
    } else if (cta === "wizard") act("request");
    else if (cta === "edit_property") act("manage");
  };
  return (
    <div className="space-y-4" data-testid="v3-sec-riscuri">
      {hh && hh.enabled !== false && (
        <Card tid="v3-hh">
          <div className="flex items-start gap-3">
            <span className="w-11 h-11 rounded-2xl bg-slate-50 flex items-center justify-center shrink-0"><HeartPulse className="w-5 h-5 text-[#166534]" /></span>
            <div className="flex-1 min-w-0">
              <H2>House Health{hh.locked ? "" : ` · ${hh.score_overall}/100`}</H2>
              <p className="text-xs text-slate-500 mt-0.5">{hh.locked ? (hh.lock_message || "Disponibil cu Digital Twin și abonament House Health.") : `Sănătatea casei este ${({ Excellent: "excelentă", Good: "bună", Fair: "acceptabilă", "Needs Attention": "de urmărit" })[hh.classification] || "evaluată"} · ultima evaluare ${fmtDate(hh.last_evaluation_date)} · următoarea ${fmtDate(hh.next_evaluation_date)}`}</p>
            </div>
            {hhInd && <HelpDot onClick={() => explain(hhInd)} tid="v3-hh-help" />}
          </div>
          {!hh.locked && <div className="mt-3"><Bar pct={hh.score_overall} h="h-2" tone="linear-gradient(90deg,#34C759,#ccff00)" /></div>}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Secondary full onClick={() => act("health")} tid="v2-hub-health">Raportul complet <ChevronRight className="w-4 h-4" /></Secondary>
            {hh.locked ? <Primary full onClick={() => act("hhUpgrade")} tid="v3-hh-upgrade">Activează House Health</Primary> : <Secondary full onClick={() => act("hhUpgrade")} tid="v3-hh-plan">Abonamentul meu</Secondary>}
          </div>
        </Card>
      )}
      <Card tid="risks-card">
        <div className="flex items-center gap-3"><div className="flex-1"><div className="text-sm font-black text-slate-900">Riscuri identificate</div><div className="text-xs text-slate-500">pe baza datelor din Twin și documente</div></div><span className="xos-num text-3xl text-slate-900" data-testid="risks-count">{risks.length}</span></div>
        {risks.length === 0 ? <div className="mt-3 rounded-2xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700" data-testid="risks-empty">✓ Niciun risc major identificat pe baza datelor din Twin.</div> : (
          <div className="mt-3 space-y-2">
            {risks.map(r => (
              <div key={r.id} className="rounded-2xl border border-slate-100 p-3.5" data-testid={`risk-${r.id}`}>
                <div className="flex items-center gap-1.5 flex-wrap"><Chip tone={RISK_TONE[r.category] || "slate"}>{r.category_label}</Chip>{r.estimated && <Chip tone="slate">Estimat</Chip>}<span className="ml-auto text-[11px] font-mono text-slate-400">risc {r.score}/100</span></div>
                <div className="mt-1.5 text-sm font-black text-slate-900">{r.title}</div>
                <div className="text-xs text-slate-500 mt-0.5">Probabilitate {r.probability} · impact {r.impact_label}</div>
                {r.evidence?.[0] && <div className="mt-1 text-[11px] text-slate-400">{r.evidence[0]}</div>}
                {r.mitigation?.label && !done && <Primary className="mt-2.5 !min-h-[40px] text-xs" onClick={() => mitigate(r)} tid={`risk-mitigate-${r.id}`}>{r.mitigation.label}</Primary>}
              </div>
            ))}
            {done && <div className="rounded-2xl bg-emerald-50 p-3 text-xs font-bold text-emerald-700" data-testid="risk-mitigate-success">✓ Cererea de audit a fost creată — un specialist te va contacta.</div>}
          </div>
        )}
        {d.risks?.disclaimer && <p className="mt-3 text-[11px] text-slate-400 leading-relaxed">{d.risks.disclaimer}</p>}
      </Card>
      <Card tid="v3-works-summary">
        <div className="flex items-center gap-3"><span className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center"><Clock className="w-5 h-5 text-[#166534]" /></span><div className="flex-1"><div className="text-sm font-black text-slate-900">Lucrări & istoric</div><div className="text-xs text-slate-500">{active.length} active · {confirmed.length} finalizate prin PropManage</div></div></div>
        <div className="mt-3 grid grid-cols-2 gap-2"><Secondary className="text-xs" onClick={() => go("jobs")} tid="v3-works-go">Vezi lucrările</Secondary><Secondary className="text-xs" onClick={() => act("propTimeline")} tid="v2-hub-timeline">Istoric proprietate</Secondary></div>
      </Card>
      {d.opps.length > 0 && (
        <Card tid="v3-recs">
          <Overline>Recomandări pentru casa ta</Overline>
          <div className="mt-2 space-y-2">{d.opps.slice(0, 3).map(o => <OppCard key={o.id} o={o} d={d} act={act} go={go} />)}</div>
        </Card>
      )}
    </div>
  );
};

// ── Calendar · Blocul meu · Pașaport — componentele existente, cu toată logica lor ─────
export const SectionCalendar = ({ properties, prop, onRequestCreated }) => (
  <div className="-mx-5 -mt-8" data-testid="v3-sec-calendar"><MaintenanceCalendar properties={properties} prop={prop} onRequestCreated={onRequestCreated} /></div>
);

export const SectionBloc = ({ properties, onRequestsChanged }) => (
  <div className="-mx-5 -mt-6" data-testid="v3-sec-bloc"><BuildingHub properties={properties} onRequestsChanged={onRequestsChanged} /></div>
);

export const SectionPasaport = ({ prop }) => (
  <div className="-mt-4" data-testid="v3-sec-pasaport"><PassportCard prop={prop} /></div>
);
