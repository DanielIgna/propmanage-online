// Digital Twin 3D viewer — orchestrator (Phase C + D + E + H).
// Wires the Canvas/scene/tools/pins. Sub-components live in ./viewer/*
import React, { Suspense, useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import axios from "axios";
import {
  Eye, EyeOff, Layers, RotateCcw, Box as BoxIcon,
} from "lucide-react";
import { API } from "../pages/DashShared";
import { FACE_STYLES, TOOLS, SECTION_AXES } from "./viewer/constants";
import { DemoHouse, ModelWithEvents, ResetCamera } from "./viewer/ViewerScene";
import { MeasureMarkers } from "./viewer/MeasureSection";
import { PinMarker, PinDraftModal, PinThreadModal } from "./viewer/PinSystem";

const ViewerOverlay = ({ faceStyle, layersHidden, layersTotal, tool, pinCount }) => (
  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-stone-900/85 backdrop-blur border border-white/10 text-[11px] text-stone-300 flex items-center gap-4 max-w-[90vw] overflow-x-auto">
    <span>Tool: <strong className="text-emerald-300">{tool}</strong></span>
    <span>Mod: <strong className="text-emerald-300">{faceStyle}</strong></span>
    {layersTotal > 0 && (
      <span>Layers: <strong className="text-stone-200">{layersTotal - layersHidden}/{layersTotal}</strong></span>
    )}
    {pinCount > 0 && <span>📌 <strong className="text-stone-200">{pinCount}</strong></span>}
    <span className="text-stone-500 whitespace-nowrap">Drag · Scroll · Shift+drag</span>
  </div>
);

export const DigitalTwinViewer = ({ projectId, modelUrl, projectName, onClose, onOpenPlans, embedded = false, compactSidebar = false, highlightPinId = null, onPinSelect = null }) => {
  const [faceStyle, setFaceStyle] = useState("shaded");
  const [hiddenLayers, setHiddenLayers] = useState(new Set());
  const [layers, setLayers] = useState([]);
  const [resetTick, setResetTick] = useState(0);
  const [error] = useState(null);

  // Phase D — Tool mode + section + measure
  const [tool, setTool] = useState("orbit");
  const [sectionAxis, setSectionAxis] = useState(null);
  const [sectionPos, setSectionPos] = useState(0);
  const [measurePts, setMeasurePts] = useState([]);

  // Phase E — Pins
  const [pins, setPins] = useState([]);
  const [pinDraft, setPinDraft] = useState(null);
  const [pinOpen, setPinOpen] = useState(null);

  // Hide the dev-only React Error Overlay iframe while viewer is open.
  useEffect(() => {
    const STYLE_ID = "dt-suppress-error-overlay";
    let styleEl = document.getElementById(STYLE_ID);
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = STYLE_ID;
      styleEl.textContent = `
        body > iframe[style*="z-index: 2147483647"],
        iframe#webpack-dev-server-client-overlay { display: none !important; }
      `;
      document.head.appendChild(styleEl);
    }
    return () => { styleEl?.remove(); };
  }, []);

  // Load existing pins for this project
  useEffect(() => {
    if (!projectId) return;
    axios.get(`${API}/digital-twin/projects/${projectId}/pins`)
      .then(r => setPins(r.data.items || []))
      .catch(() => setPins([]));
  }, [projectId]);

  const url = modelUrl
    ? (modelUrl.startsWith("http") ? modelUrl : `${process.env.REACT_APP_BACKEND_URL || ""}${modelUrl}`)
    : null;
  const isDefaultModel = !modelUrl;

  const toggleLayer = (key) => {
    setHiddenLayers((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Clipping plane is rebuilt whenever axis or position changes.
  const clippingPlanes = useMemo(() => {
    if (!sectionAxis) return [];
    const axisDef = SECTION_AXES.find((a) => a.id === sectionAxis);
    if (!axisDef) return [];
    return [new THREE.Plane(axisDef.normal.clone(), sectionPos)];
  }, [sectionAxis, sectionPos]);

  const onMeshClick = (e) => {
    const pt = e.point;
    if (tool === "measure") {
      setMeasurePts((prev) => prev.length >= 2 ? [pt.clone()] : [...prev, pt.clone()]);
    } else if (tool === "pin") {
      setPinDraft({
        position: { x: +pt.x.toFixed(3), y: +pt.y.toFixed(3), z: +pt.z.toFixed(3) },
        title: "",
        description: "",
        category: "defect",
        priority: "normal",
      });
    }
  };

  const submitPin = async () => {
    if (!pinDraft || !pinDraft.title.trim() || !projectId) return;
    try {
      const { data } = await axios.post(`${API}/digital-twin/projects/${projectId}/pins`, {
        position: pinDraft.position,
        title: pinDraft.title.trim(),
        description: pinDraft.description.trim(),
        category: pinDraft.category,
        priority: pinDraft.priority,
      });
      setPins((arr) => [data, ...arr]);
      setPinDraft(null);
    } catch (e) {
      alert("Eroare la salvare pin: " + (e?.response?.data?.detail || e.message));
    }
  };

  const deletePin = async (id) => {
    if (!window.confirm("Ștergi acest pin și toate comentariile?")) return;
    try {
      await axios.delete(`${API}/digital-twin/pins/${id}`);
      setPins((arr) => arr.filter(x => x.id !== id));
      setPinOpen(null);
    } catch (e) {
      alert(e?.response?.data?.detail || e.message);
    }
  };

  const updatePinStatus = async (id, status) => {
    try {
      const { data } = await axios.patch(`${API}/digital-twin/pins/${id}`, { status });
      setPins((arr) => arr.map(x => x.id === id ? data : x));
      setPinOpen(data);
    } catch (e) {
      alert(e?.response?.data?.detail || e.message);
    }
  };

  return (
    <div className={(embedded ? "relative w-full h-full" : "fixed inset-0 z-40") + " bg-stone-950 flex"} data-testid="dt-viewer">
      {/* Sidebar */}
      <aside className={(compactSidebar ? "w-56" : "w-72") + " shrink-0 bg-stone-900 border-r border-white/10 flex flex-col"}>
        <div className="px-4 py-4 border-b border-white/10">
          <div className="text-[10px] uppercase tracking-[0.16em] text-emerald-400/80 font-semibold mb-1">Digital Twin</div>
          <h2 className="font-serif text-lg text-white truncate">{projectName || "Demo Hyper-Model"}</h2>
          {isDefaultModel && (
            <div className="mt-1 text-[10px] text-amber-400/80">Model demo public · încarcă modelul tău în setări</div>
          )}
        </div>

        <div className="px-4 py-4 border-b border-white/10">
          <div className="text-[10px] uppercase tracking-[0.16em] text-stone-500 font-semibold mb-2">Unelte</div>
          <div className="grid grid-cols-2 gap-1.5" data-testid="dt-tools">
            {TOOLS.map((t) => {
              const Icon = t.icon;
              const isActive = tool === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => { setTool(t.id); if (t.id !== "measure") setMeasurePts([]); }}
                  className={`px-2 py-2 rounded-lg flex flex-col items-center gap-0.5 transition-colors ${
                    isActive
                      ? "bg-emerald-500/15 ring-1 ring-emerald-400/30 text-emerald-200"
                      : "bg-white/[0.02] hover:bg-white/5 text-stone-300"
                  }`}
                  title={t.desc}
                  data-testid={`dt-tool-${t.id}`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-[10px] font-medium">{t.label}</span>
                </button>
              );
            })}
          </div>

          {tool === "measure" && (
            <div className="mt-3 px-2.5 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-200 leading-relaxed" data-testid="dt-measure-hint">
              {measurePts.length === 0 && "Click pe primul punct"}
              {measurePts.length === 1 && "Click pe al doilea punct"}
              {measurePts.length === 2 && (
                <>
                  <strong className="text-amber-100">{measurePts[0].distanceTo(measurePts[1]).toFixed(2)} m</strong>
                  <button onClick={() => setMeasurePts([])} className="ml-2 underline">Reset</button>
                </>
              )}
            </div>
          )}

          {tool === "section" && (
            <div className="mt-3 space-y-2" data-testid="dt-section-controls">
              <div className="flex gap-1">
                {SECTION_AXES.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setSectionAxis(sectionAxis === a.id ? null : a.id)}
                    className={`flex-1 px-2 py-1.5 rounded-lg text-[10px] font-medium ${
                      sectionAxis === a.id
                        ? "bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-400/30"
                        : "bg-white/[0.03] text-stone-400 hover:bg-white/5"
                    }`}
                    data-testid={`dt-section-axis-${a.id}`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
              {sectionAxis && (
                <>
                  <input
                    type="range"
                    min={-10}
                    max={10}
                    step={0.1}
                    value={sectionPos}
                    onChange={(e) => setSectionPos(parseFloat(e.target.value))}
                    className="w-full accent-emerald-400"
                    data-testid="dt-section-slider"
                  />
                  <div className="text-[10px] text-stone-500 text-center">Poziție: <strong className="text-emerald-300">{sectionPos.toFixed(2)} m</strong></div>
                </>
              )}
            </div>
          )}

          {tool === "pin" && (
            <div className="mt-3 px-2.5 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-200">
              Click pe model → spawn pin colaborativ
            </div>
          )}
        </div>

        <div className="px-4 py-4 border-b border-white/10">
          <div className="text-[10px] uppercase tracking-[0.16em] text-stone-500 font-semibold mb-2">Face Styles</div>
          <div className="space-y-1" data-testid="dt-face-styles">
            {FACE_STYLES.map((fs) => (
              <button
                key={fs.id}
                onClick={() => setFaceStyle(fs.id)}
                className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-start gap-2 ${
                  faceStyle === fs.id
                    ? "bg-emerald-500/15 ring-1 ring-emerald-400/30 text-emerald-200"
                    : "hover:bg-white/5 text-stone-300"
                }`}
                data-testid={`dt-face-${fs.id}`}
              >
                <BoxIcon className="w-3.5 h-3.5 mt-0.5 shrink-0 opacity-60" />
                <div className="min-w-0">
                  <div className="text-xs font-medium">{fs.label}</div>
                  <div className="text-[10px] text-stone-500 truncate">{fs.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="px-4 py-4 border-b border-white/10 flex-1 overflow-y-auto">
          <div className="flex items-center gap-2 mb-2">
            <Layers className="w-3.5 h-3.5 text-stone-500" />
            <div className="text-[10px] uppercase tracking-[0.16em] text-stone-500 font-semibold">
              Tags / Layers ({layers.length})
            </div>
          </div>
          {layers.length === 0 ? (
            <div className="text-xs text-stone-500 italic px-3 py-2">Nu am detectat layers în model.</div>
          ) : (
            <div className="space-y-1" data-testid="dt-layers">
              {layers.map((layer) => {
                const hidden = hiddenLayers.has(layer);
                return (
                  <button
                    key={layer}
                    onClick={() => toggleLayer(layer)}
                    className={`w-full text-left px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2 text-xs ${
                      hidden ? "text-stone-600" : "text-stone-200 hover:bg-white/5"
                    }`}
                    data-testid={`dt-layer-${layer}`}
                  >
                    {hidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5 text-emerald-400" />}
                    <span className="truncate font-mono">{layer}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-white/10 flex gap-2 flex-wrap">
          <button
            onClick={() => setResetTick((t) => t + 1)}
            className="flex-1 px-3 py-2 text-xs rounded-lg bg-white/5 hover:bg-white/10 text-stone-300 flex items-center justify-center gap-1.5"
            data-testid="dt-reset-camera"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset cameră
          </button>
          {onOpenPlans && (
            <button
              onClick={onOpenPlans}
              className="px-3 py-2 text-xs rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-200 flex items-center justify-center gap-1.5"
              data-testid="dt-open-plans"
              title="Planuri 2D (PDF)"
            >
              <Layers className="w-3.5 h-3.5" /> Plane 2D
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="px-3 py-2 text-xs rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-300"
              data-testid="dt-close-viewer"
            >
              Închide
            </button>
          )}
        </div>
      </aside>

      {/* Canvas */}
      <div className="flex-1 relative">
        {error && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/40 text-red-200 text-sm">
            Eroare la încărcarea modelului: {error}
          </div>
        )}
        <Canvas
          camera={{ position: [12, 9, 14], fov: 50, near: 0.1, far: 2000 }}
          gl={{ antialias: true, localClippingEnabled: true }}
          onCreated={({ gl }) => { gl.localClippingEnabled = true; }}
        >
          <color attach="background" args={["#0a0a0a"]} />
          <ambientLight intensity={0.5} />
          <directionalLight position={[10, 15, 8]} intensity={0.9} />
          <hemisphereLight args={[0xddeeff, 0x202020, 0.3]} />
          <Suspense fallback={null}>
            {url ? (
              <ModelWithEvents
                url={url}
                faceStyle={faceStyle}
                hiddenLayers={hiddenLayers}
                onLayersDetected={setLayers}
                clippingPlanes={clippingPlanes}
                onMeshClick={onMeshClick}
              />
            ) : (
              <DemoHouse
                faceStyle={faceStyle}
                hiddenLayers={hiddenLayers}
                onLayersDetected={setLayers}
                clippingPlanes={clippingPlanes}
                onMeshClick={onMeshClick}
              />
            )}
            <MeasureMarkers points={measurePts} />
            {pins.map((p) => (
              <PinMarker
                key={p.id}
                pin={p}
                onOpen={(pin) => { setPinOpen(pin); onPinSelect?.(pin.id); }}
                isHighlighted={highlightPinId === p.id}
              />
            ))}
          </Suspense>
          <gridHelper args={[40, 40, 0x333333, 0x1a1a1a]} position={[0, -0.1, 0]} />
          <OrbitControls
            makeDefault
            enableDamping
            dampingFactor={0.08}
            target={[0, 2, 0]}
            enabled={tool === "orbit" || tool === "section"}
          />
          <ResetCamera resetTrigger={resetTick} />
        </Canvas>
        <ViewerOverlay
          faceStyle={faceStyle}
          layersHidden={hiddenLayers.size}
          layersTotal={layers.length}
          tool={tool}
          pinCount={pins.length}
        />
      </div>

      {pinDraft && (
        <PinDraftModal
          draft={pinDraft}
          setDraft={setPinDraft}
          onCancel={() => setPinDraft(null)}
          onSubmit={submitPin}
        />
      )}

      {pinOpen && (
        <PinThreadModal
          pin={pinOpen}
          onClose={() => setPinOpen(null)}
          onDelete={() => deletePin(pinOpen.id)}
          onStatusChange={(s) => updatePinStatus(pinOpen.id, s)}
        />
      )}
    </div>
  );
};

export default DigitalTwinViewer;
