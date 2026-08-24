// Design Tokens Editor (Task 8 · P2). Non-invasive Configuration Layer extension.
// Purpose: safe, allowlisted control of global visual tokens (--pm-*) with
// preview, reject-on-invalid, reset-to-defaults and audit trail. No CSS editor,
// no theme engine — strictly the tokens the frontend already consumes.
import React, { useEffect, useState } from "react";
import axios from "axios";
import { Palette, RotateCcw, Save, Type as TypeIcon, Layers } from "lucide-react";
import { AdminLayoutMetronic } from "./AdminLayoutMetronic";

const API = process.env.REACT_APP_BACKEND_URL;

const COLOR_KEYS = [
  "primary", "secondary", "accent", "background", "surface",
  "text", "muted_text", "border", "success", "warning", "danger",
];
const RADIUS_KEYS = ["sm", "md", "lg", "xl", "button", "card"];
const TYPO_KEYS = [
  { key: "font_family", label: "Font family" },
  { key: "heading_weight", label: "Heading weight" },
  { key: "body_weight", label: "Body weight" },
  { key: "base_font_size", label: "Base font size" },
  { key: "h1_scale", label: "H1 scale" },
];

const Field = ({ label, value, onChange, hint, testid }) => (
  <label className="block space-y-1">
    <div className="text-[11px] uppercase tracking-wider font-bold text-stone-500">{label}</div>
    <input
      type="text"
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/10 text-stone-200 focus:outline-none focus:border-lime-400/50 font-mono"
      data-testid={testid}
    />
    {hint && <div className="text-[11px] text-stone-500">{hint}</div>}
  </label>
);

const ColorField = ({ k, value, onChange }) => (
  <div className="flex items-center gap-3">
    <div className="w-10 h-10 rounded-lg border border-white/10 shrink-0" style={{ background: value }} />
    <div className="flex-1">
      <Field label={k} value={value} onChange={onChange} testid={`dt-color-${k}`} />
    </div>
  </div>
);

export default function DesignTokensPage() {
  const [tokens, setTokens] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setError("");
    try {
      const { data } = await axios.get(`${API}/api/admin/design-tokens`);
      setTokens(data);
      setDirty(false);
    } catch (e) {
      setError(e?.response?.data?.detail || e.message);
    }
  };
  useEffect(() => { load(); }, []);

  const patch = (section, key, val) => {
    setTokens((t) => ({ ...t, [section]: { ...(t[section] || {}), [key]: val } }));
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const body = {
        colors: tokens.colors,
        radius: tokens.radius,
        typography: tokens.typography,
      };
      const { data } = await axios.put(`${API}/api/admin/design-tokens`, body);
      setTokens(data);
      setDirty(false);
    } catch (e) {
      setError(e?.response?.data?.detail || e.message);
    } finally { setSaving(false); }
  };

  const reset = async () => {
    if (!window.confirm("Revert la tokenii impliciți? Se creează audit trail.")) return;
    setSaving(true);
    try {
      const { data } = await axios.post(`${API}/api/admin/design-tokens/reset`);
      setTokens(data);
      setDirty(false);
    } catch (e) {
      setError(e?.response?.data?.detail || e.message);
    } finally { setSaving(false); }
  };

  if (!tokens) {
    return (
      <AdminLayoutMetronic title="Design Tokens" subtitle="Configuration Layer · P2">
        <div className="p-8 text-stone-400">Se încarcă tokenii...</div>
      </AdminLayoutMetronic>
    );
  }

  return (
    <AdminLayoutMetronic title="Design Tokens" subtitle="Configurează tokenii vizuali globali (--pm-*) în siguranță">
      <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-6" data-testid="design-tokens-page">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2 text-white">
              <Palette className="w-6 h-6 text-[#d4ff3a]" /> Design Tokens
            </h1>
            <p className="text-sm text-stone-400 mt-1 max-w-2xl">
              Fiecare token este validat cu allowlist. <b>NU</b> accepți CSS arbitrar,
              JavaScript, HTML, sau url(). Reset-ul revine la valorile canonice și
              este auditat.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={reset}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm bg-white/5 hover:bg-white/10 border border-white/10 text-red-300 disabled:opacity-50"
              data-testid="dt-reset"
            >
              <RotateCcw className="w-4 h-4" /> Reset defaults
            </button>
            <button
              onClick={save}
              disabled={saving || !dirty}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-bold bg-lime-400 text-black hover:bg-lime-300 disabled:opacity-50"
              data-testid="dt-save"
            >
              <Save className="w-4 h-4" /> {saving ? "Se salvează..." : dirty ? "Salvează" : "Salvat"}
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-sm px-4 py-3" data-testid="dt-error">
            {error}
          </div>
        )}

        {/* Colors */}
        <section className="space-y-3">
          <div className="text-[11px] uppercase tracking-wider font-bold text-lime-400 flex items-center gap-1.5">
            <Palette className="w-3.5 h-3.5" /> Culori
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {COLOR_KEYS.map((k) => (
              <ColorField
                key={k}
                k={k}
                value={tokens.colors?.[k]}
                onChange={(v) => patch("colors", k, v)}
              />
            ))}
          </div>
        </section>

        {/* Radius */}
        <section className="space-y-3">
          <div className="text-[11px] uppercase tracking-wider font-bold text-lime-400 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" /> Radius (px / rem)
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {RADIUS_KEYS.map((k) => (
              <Field
                key={k}
                label={k}
                value={tokens.radius?.[k]}
                onChange={(v) => patch("radius", k, v)}
                testid={`dt-radius-${k}`}
              />
            ))}
          </div>
        </section>

        {/* Typography */}
        <section className="space-y-3">
          <div className="text-[11px] uppercase tracking-wider font-bold text-lime-400 flex items-center gap-1.5">
            <TypeIcon className="w-3.5 h-3.5" /> Tipografie
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {TYPO_KEYS.map((t) => (
              <Field
                key={t.key}
                label={t.label}
                value={tokens.typography?.[t.key]}
                onChange={(v) => patch("typography", t.key, v)}
                testid={`dt-typo-${t.key}`}
              />
            ))}
          </div>
        </section>

        <div className="text-xs text-stone-500 space-y-1 pt-2 border-t border-white/10">
          <p>• Valorile invalide (CSS injection, HTML, url(), expression()) sunt respinse automat.</p>
          <p>• Cheile necunoscute sunt respinse (whitelist strict).</p>
          <p>• Fiecare modificare intră în <code>admin_audit_log</code>.</p>
          <p>• Tokenii se aplică prin CSS variables <code>--pm-*</code> pe frontend.</p>
        </div>
      </div>
    </AdminLayoutMetronic>
  );
}
