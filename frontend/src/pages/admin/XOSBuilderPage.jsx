import React, { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Reorder, useDragControls } from "framer-motion";
import { GripVertical, Eye, EyeOff, Save, RotateCcw, LayoutDashboard, Smartphone } from "lucide-react";
import { AdminLayoutMetronic } from "./AdminLayoutMetronic";
import XOSRegistryPanel from "./XOSRegistryPanel";
import ExperienceProfilesPanel from "./ExperienceProfilesPanel";

const API = process.env.REACT_APP_BACKEND_URL;

const WidgetRow = ({ item, widget, onToggle }) => {
  const controls = useDragControls();
  return (
    <Reorder.Item value={item} dragListener={false} dragControls={controls}
      className={`flex items-center gap-3 rounded-2xl border p-4 bg-white dark:bg-slate-900 ${item.enabled ? "border-slate-200 dark:border-slate-700" : "border-dashed border-slate-300 dark:border-slate-600 opacity-60"}`}
      data-testid={`xos-widget-${item.id}`}>
      <button onPointerDown={(e) => controls.start(e)} className="cursor-grab active:cursor-grabbing p-1 text-slate-400 touch-none" data-testid={`xos-drag-${item.id}`}>
        <GripVertical className="w-5 h-5" />
      </button>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-black text-slate-900 dark:text-white">{widget?.label || item.id}</div>
        <div className="text-xs text-slate-500 truncate">{widget?.desc}</div>
      </div>
      <button onClick={onToggle}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${item.enabled ? "text-lime-700 bg-lime-50 border-lime-300 dark:text-lime-300 dark:bg-lime-900/20 dark:border-lime-700" : "text-slate-500 bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-600"}`}
        data-testid={`xos-toggle-${item.id}`}>
        {item.enabled ? <><Eye className="w-3.5 h-3.5" /> Vizibil</> : <><EyeOff className="w-3.5 h-3.5" /> Ascuns</>}
      </button>
    </Reorder.Item>
  );
};

export default function XOSBuilderPage() {
  const [surfaces, setSurfaces] = useState(null);
  const [surface, setSurface] = useState("client_home");
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    axios.get(`${API}/api/admin/xos/surfaces`, { withCredentials: true })
      .then((r) => {
        setSurfaces(r.data.surfaces);
        const s = r.data.surfaces.find((x) => x.surface === surface);
        if (s) setItems(s.items);
      })
      .catch(() => toast.error("Nu am putut încărca layout-urile."));
  }, []);

  const switchSurface = (key) => {
    setSurface(key);
    const s = surfaces?.find((x) => x.surface === key);
    if (s) setItems(s.items);
  };

  const meta = surfaces?.find((x) => x.surface === surface);
  const widgetMap = Object.fromEntries((meta?.widgets || []).map((w) => [w.id, w]));

  const save = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/api/admin/xos/layout/${surface}`, { items }, { withCredentials: true });
      toast.success("Layout salvat — clienții văd instant noua ordine.");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Eroare la salvare.");
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    const r = await axios.post(`${API}/api/admin/xos/layout/${surface}/reset`, {}, { withCredentials: true });
    setItems(r.data.items);
    toast.success("Layout resetat la implicit.");
  };

  return (
    <AdminLayoutMetronic title="XOS · Layout Builder" subtitle="Drag & drop — controlezi ce widget-uri vede clientul, în ce ordine, fără cod">
      <div className="max-w-3xl mx-auto space-y-6 p-4 sm:p-6" data-testid="xos-builder-page">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
            <Smartphone className="w-4 h-4 text-lime-600" />
            <select value={surface} onChange={(e) => switchSurface(e.target.value)}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-sm font-bold"
              data-testid="xos-surface-select">
              {(surfaces || []).map((s) => <option key={s.surface} value={s.surface}>{s.label}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={reset} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800" data-testid="xos-reset">
              <RotateCcw className="w-4 h-4" /> Reset
            </button>
            <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-bold bg-lime-500 text-black hover:bg-lime-400 disabled:opacity-50" data-testid="xos-save">
              <Save className="w-4 h-4" /> {saving ? "Se salvează..." : "Salvează layout"}
            </button>
          </div>
        </div>

        {!surfaces ? (
          <div className="text-slate-400 p-8">Se încarcă...</div>
        ) : (
          <Reorder.Group axis="y" values={items} onReorder={setItems} className="space-y-3">
            {items.map((item) => (
              <WidgetRow key={item.id} item={item} widget={widgetMap[item.id]}
                onToggle={() => setItems(items.map((x) => (x.id === item.id ? { ...x, enabled: !x.enabled } : x)))} />
            ))}
          </Reorder.Group>
        )}

        <div className="text-xs text-slate-400 flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <LayoutDashboard className="w-4 h-4" />
          Trage de mâner pentru reordonare · comută Vizibil/Ascuns · widget-urile ascunse prin UI Rules au prioritate peste layout.
        </div>

        <XOSRegistryPanel onChanged={() => window.location.reload()} />
      </div>
    </AdminLayoutMetronic>
  );
}
