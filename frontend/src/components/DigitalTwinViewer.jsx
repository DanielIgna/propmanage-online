// Digital Twin 3D viewer — Phase C + D + E.
// Three.js + @react-three/fiber. Face styles · layer toggle · tape measure · section plane · 3D pins with threads.
import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls, useGLTF, Html } from "@react-three/drei";
import * as THREE from "three";
import axios from "axios";
import {
  Eye, EyeOff, Layers, RotateCcw, Box as BoxIcon,
  MousePointer2, Ruler, Scissors, MapPin, MessageCircle, Send, AlertTriangle, X, Trash2,
} from "lucide-react";
import { API } from "../pages/DashShared";

// When a project has no model_url, render a synthetic "demo house" with primitives
// named with Romanian BIM convention (AR_PERETI, AR_USI, etc.) so layer toggle works visibly.
const DEFAULT_MODEL_URL = null;

// Procedural demo house — primitive walls/slabs/doors/columns with semantic names.
const DemoHouse = ({ faceStyle, hiddenLayers, onLayersDetected, clippingPlanes, onMeshClick }) => {
  useEffect(() => {
    onLayersDetected?.(["AR_PERETI", "AR_PLANSEE", "AR_STALPI", "AR_USI", "AR_FERESTRE", "AR_ACOPERIS"]);
  }, [onLayersDetected]);

  const elements = useMemo(() => [
    { layer: "AR_PLANSEE", name: "AR_PLANSEE_parter", position: [0, 0, 0], scale: [8, 0.2, 6], color: 0x9a8a72 },
    { layer: "AR_PLANSEE", name: "AR_PLANSEE_etaj", position: [0, 3, 0], scale: [8, 0.2, 6], color: 0x9a8a72 },
    { layer: "AR_ACOPERIS", name: "AR_ACOPERIS_principal", position: [0, 6.4, 0], scale: [9, 0.15, 7], color: 0x3a2a20 },
    { layer: "AR_PERETI", name: "AR_PERETI_nord_parter", position: [0, 1.5, -3], scale: [8, 3, 0.25], color: 0xc8b89a },
    { layer: "AR_PERETI", name: "AR_PERETI_sud_parter", position: [0, 1.5, 3], scale: [8, 3, 0.25], color: 0xc8b89a },
    { layer: "AR_PERETI", name: "AR_PERETI_est_parter", position: [4, 1.5, 0], scale: [0.25, 3, 6], color: 0xc8b89a },
    { layer: "AR_PERETI", name: "AR_PERETI_vest_parter", position: [-4, 1.5, 0], scale: [0.25, 3, 6], color: 0xc8b89a },
    { layer: "AR_PERETI", name: "AR_PERETI_nord_etaj", position: [0, 4.7, -3], scale: [8, 3, 0.25], color: 0xc8b89a },
    { layer: "AR_PERETI", name: "AR_PERETI_sud_etaj", position: [0, 4.7, 3], scale: [8, 3, 0.25], color: 0xc8b89a },
    { layer: "AR_PERETI", name: "AR_PERETI_est_etaj", position: [4, 4.7, 0], scale: [0.25, 3, 6], color: 0xc8b89a },
    { layer: "AR_PERETI", name: "AR_PERETI_vest_etaj", position: [-4, 4.7, 0], scale: [0.25, 3, 6], color: 0xc8b89a },
    { layer: "AR_PERETI", name: "AR_PERETI_despartitor", position: [-1, 1.5, 0], scale: [0.15, 3, 6], color: 0xd8c8a6 },
    { layer: "AR_STALPI", name: "AR_STALPI_NV", position: [-3.7, 1.5, -2.7], scale: [0.3, 3, 0.3], color: 0x666666 },
    { layer: "AR_STALPI", name: "AR_STALPI_NE", position: [3.7, 1.5, -2.7], scale: [0.3, 3, 0.3], color: 0x666666 },
    { layer: "AR_STALPI", name: "AR_STALPI_SV", position: [-3.7, 1.5, 2.7], scale: [0.3, 3, 0.3], color: 0x666666 },
    { layer: "AR_STALPI", name: "AR_STALPI_SE", position: [3.7, 1.5, 2.7], scale: [0.3, 3, 0.3], color: 0x666666 },
    { layer: "AR_USI", name: "AR_USI_intrare", position: [2, 1.1, 3], scale: [1, 2.1, 0.1], color: 0x5a3a20 },
    { layer: "AR_USI", name: "AR_USI_interior_parter", position: [-1, 1.05, 1], scale: [0.1, 2.1, 0.85], color: 0x5a3a20 },
    { layer: "AR_FERESTRE", name: "AR_FERESTRE_S1", position: [-2, 1.7, 3], scale: [1.2, 1.2, 0.1], color: 0x6ab0d4 },
    { layer: "AR_FERESTRE", name: "AR_FERESTRE_S2", position: [-2, 4.8, 3], scale: [1.2, 1.2, 0.1], color: 0x6ab0d4 },
    { layer: "AR_FERESTRE", name: "AR_FERESTRE_E1", position: [4, 4.8, -1], scale: [0.1, 1.2, 1.2], color: 0x6ab0d4 },
    { layer: "AR_FERESTRE", name: "AR_FERESTRE_W1", position: [-4, 1.7, -1], scale: [0.1, 1.2, 1.2], color: 0x6ab0d4 },
  ], []);

  const renderMaterial = (color) => {
    const cp = clippingPlanes && clippingPlanes.length ? clippingPlanes : null;
    const common = { clippingPlanes: cp, side: THREE.DoubleSide };
    if (faceStyle === "wireframe") {
      return <meshBasicMaterial color={0x222222} wireframe {...common} />;
    }
    if (faceStyle === "white") {
      return <meshStandardMaterial color={0xf5f5f5} roughness={0.7} metalness={0.02} {...common} />;
    }
    if (faceStyle === "xray") {
      return (
        <meshStandardMaterial
          color={color}
          transparent
          opacity={0.18}
          depthWrite={false}
          {...common}
        />
      );
    }
    if (faceStyle === "monochrome") {
      return <meshStandardMaterial color={0x9a9a9a} roughness={0.85} {...common} />;
    }
    return <meshStandardMaterial color={color} roughness={0.55} metalness={0.05} {...common} />;
  };

  return (
    <group>
      {elements.map((el) => {
        if (hiddenLayers.has(el.layer)) return null;
        return (
          <mesh
            key={el.name}
            name={el.name}
            position={el.position}
            scale={el.scale}
            onClick={(e) => {
              e.stopPropagation();
              onMeshClick?.(e);
            }}
          >
            <boxGeometry args={[1, 1, 1]} />
            {renderMaterial(el.color)}
          </mesh>
        );
      })}
    </group>
  );
};

const FACE_STYLES = [
  { id: "shaded", label: "Shaded Textures", desc: "Implicit · materiale originale" },
  { id: "white", label: "White Model", desc: "Toate suprafețele albe" },
  { id: "xray", label: "X-Ray", desc: "Transparent · vezi prin pereți" },
  { id: "wireframe", label: "Wireframe", desc: "Doar muchii" },
  { id: "monochrome", label: "Monochrome", desc: "Nuanțe de gri" },
];

const TOOLS = [
  { id: "orbit", label: "Navigare", icon: MousePointer2, desc: "Rotate · zoom · pan" },
  { id: "measure", label: "Măsurare", icon: Ruler, desc: "Click 2 puncte → distanță" },
  { id: "section", label: "Secțiune", icon: Scissors, desc: "Planul de tăiere mobil" },
  { id: "pin", label: "Pin notițe", icon: MapPin, desc: "Click pe model → spawn pin" },
];

const SECTION_AXES = [
  { id: "x", label: "X (E-V)", normal: new THREE.Vector3(1, 0, 0) },
  { id: "y", label: "Y (sus-jos)", normal: new THREE.Vector3(0, 1, 0) },
  { id: "z", label: "Z (N-S)", normal: new THREE.Vector3(0, 0, 1) },
];

const CATEGORY_COLORS = {
  general: "#60a5fa",
  structural: "#f87171",
  plumbing: "#22d3ee",
  electrical: "#facc15",
  hvac: "#a78bfa",
  finish: "#fb923c",
  defect: "#ef4444",
};

const STATUS_LABEL = {
  open: "Deschis",
  in_review: "În analiză",
  resolved: "Rezolvat",
  rejected: "Respins",
};

// Loaded scene wrapper — applies face style + collects layer info + clipping.
const Model = ({ url, faceStyle, hiddenLayers, onLayersDetected, clippingPlanes }) => {
  const { scene } = useGLTF(url);
  const originalMaterials = useRef(new Map());

  // Collect distinct top-level group names (used as "layers" / "tags").
  useEffect(() => {
    const layers = new Set();
    scene.traverse((obj) => {
      if (obj.isMesh && obj.name) {
        const parts = obj.name.split(/[_./]/);
        if (parts.length >= 2 && /^[A-Z]/.test(parts[0])) {
          layers.add(`${parts[0]}_${parts[1]}`);
        } else if (obj.parent && obj.parent.name) {
          layers.add(obj.parent.name);
        }
      }
    });
    onLayersDetected?.(Array.from(layers).sort());
  }, [scene, onLayersDetected]);

  // Apply face style + clipping planes.
  useEffect(() => {
    scene.traverse((obj) => {
      if (!obj.isMesh || !obj.material) return;
      if (!originalMaterials.current.has(obj.uuid)) {
        originalMaterials.current.set(obj.uuid, obj.material);
      }
      const orig = originalMaterials.current.get(obj.uuid);

      let mat;
      switch (faceStyle) {
        case "white":
          mat = new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.7, metalness: 0.05 });
          break;
        case "xray":
          mat = new THREE.MeshStandardMaterial({
            color: 0x88aaff, transparent: true, opacity: 0.15, depthWrite: false, side: THREE.DoubleSide,
          });
          break;
        case "wireframe":
          mat = new THREE.MeshBasicMaterial({ color: 0x222222, wireframe: true });
          break;
        case "monochrome":
          mat = new THREE.MeshStandardMaterial({ color: 0x999999, roughness: 0.9 });
          break;
        case "shaded":
        default:
          mat = orig;
          break;
      }
      obj.material = mat;
      if (mat) {
        mat.clippingPlanes = clippingPlanes && clippingPlanes.length ? clippingPlanes : null;
        mat.clipShadows = true;
        mat.side = THREE.DoubleSide;
        mat.needsUpdate = true;
      }
    });
  }, [scene, faceStyle, clippingPlanes]);

  // Apply layer visibility.
  useEffect(() => {
    scene.traverse((obj) => {
      if (!obj.isMesh || !obj.name) return;
      const parts = obj.name.split(/[_./]/);
      const layerKey = parts.length >= 2 && /^[A-Z]/.test(parts[0]) ? `${parts[0]}_${parts[1]}` : obj.parent?.name;
      obj.visible = !hiddenLayers.has(layerKey);
    });
  }, [scene, hiddenLayers]);

  return <primitive object={scene} />;
};

// Wraps a real glb model with a transparent click-catcher that exposes a hit point per face.
const ModelWithEvents = ({ url, faceStyle, hiddenLayers, onLayersDetected, clippingPlanes, onMeshClick }) => (
  <group
    onClick={(e) => {
      e.stopPropagation();
      onMeshClick?.(e);
    }}
  >
    <Model
      url={url}
      faceStyle={faceStyle}
      hiddenLayers={hiddenLayers}
      onLayersDetected={onLayersDetected}
      clippingPlanes={clippingPlanes}
    />
  </group>
);

// --------- Tape Measure (Phase D) ---------
const MeasureMarkers = ({ points }) => {
  if (!points.length) return null;
  return (
    <>
      {points.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.08, 16, 16]} />
          <meshBasicMaterial color={i === 0 ? 0x22d3ee : 0xfacc15} />
        </mesh>
      ))}
      {points.length === 2 && (
        <line>
          <bufferGeometry attach="geometry">
            <bufferAttribute
              attach="attributes-position"
              array={new Float32Array([...points[0].toArray(), ...points[1].toArray()])}
              count={2}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial attach="material" color={0xfacc15} linewidth={3} />
        </line>
      )}
      {points.length === 2 && (
        <Html
          position={points[0].clone().lerp(points[1], 0.5).toArray()}
          center
          distanceFactor={10}
          style={{ pointerEvents: "none" }}
        >
          <div className="px-2.5 py-1 rounded-full bg-amber-400 text-stone-900 text-xs font-semibold whitespace-nowrap shadow-lg">
            {points[0].distanceTo(points[1]).toFixed(2)} m
          </div>
        </Html>
      )}
    </>
  );
};

// --------- 3D Pin markers (Phase E) ---------
const PinMarker = ({ pin, onOpen }) => {
  const color = CATEGORY_COLORS[pin.category] || "#60a5fa";
  return (
    <group position={[pin.position.x, pin.position.y, pin.position.z]}>
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          onOpen(pin);
        }}
      >
        <sphereGeometry args={[0.12, 20, 20]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <Html distanceFactor={10} position={[0, 0.25, 0]} center style={{ pointerEvents: "none" }}>
        <div
          className="px-2 py-0.5 rounded-full text-[10px] text-white whitespace-nowrap shadow-lg font-medium"
          style={{ background: color }}
        >
          #{pin.title.slice(0, 16)}{pin.title.length > 16 ? "…" : ""}
        </div>
      </Html>
    </group>
  );
};

const ResetCamera = ({ resetTrigger }) => {
  const { camera, controls } = useThree();
  useEffect(() => {
    if (resetTrigger === 0) return;
    camera.position.set(8, 6, 10);
    camera.lookAt(0, 1, 0);
    controls?.reset?.();
  }, [resetTrigger, camera, controls]);
  return null;
};

export const DigitalTwinViewer = ({ projectId, modelUrl, projectName, onClose, onOpenPlans, embedded = false, compactSidebar = false }) => {
  const [faceStyle, setFaceStyle] = useState("shaded");
  const [hiddenLayers, setHiddenLayers] = useState(new Set());
  const [layers, setLayers] = useState([]);
  const [resetTick, setResetTick] = useState(0);
  const [error, setError] = useState(null);

  // Phase D — Tool mode + section + measure
  const [tool, setTool] = useState("orbit");
  const [sectionAxis, setSectionAxis] = useState(null); // null = off
  const [sectionPos, setSectionPos] = useState(0); // distance along axis (m)
  const [measurePts, setMeasurePts] = useState([]);

  // Phase E — Pins
  const [pins, setPins] = useState([]);
  const [pinDraft, setPinDraft] = useState(null); // {position, title, description, category, priority}
  const [pinOpen, setPinOpen] = useState(null); // pin object opened for thread view

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
    const pt = e.point; // THREE.Vector3
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
              <PinMarker key={p.id} pin={p} onOpen={setPinOpen} />
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

// Floating fit button wrapper removed in MVP — Reset button in sidebar handles framing.
const FitButtonWrapper = () => null;

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

// --------- Pin Draft Modal (when user clicks model in pin mode) ---------
const PinDraftModal = ({ draft, setDraft, onCancel, onSubmit }) => (
  <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onCancel}>
    <div
      onClick={(e) => e.stopPropagation()}
      className="bg-stone-900 border border-white/10 rounded-2xl p-5 w-full max-w-md"
      data-testid="dt-pin-draft-modal"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.16em] text-emerald-400/80 font-semibold">Pin nou</div>
          <h3 className="font-serif text-lg text-white">Notă pe model 3D</h3>
          <div className="text-[10px] text-stone-500 font-mono mt-1">
            Pos: x={draft.position.x} y={draft.position.y} z={draft.position.z}
          </div>
        </div>
        <button onClick={onCancel} className="text-stone-500 hover:text-white"><X className="w-5 h-5" /></button>
      </div>

      <div className="space-y-3 text-sm">
        <input
          autoFocus
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          placeholder="Titlu scurt (ex: Crăpătură perete bucătărie)"
          maxLength={200}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
          data-testid="dt-pin-title"
        />
        <textarea
          rows={3}
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          placeholder="Detalii (opțional, max 2000 caractere)"
          maxLength={2000}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
          data-testid="dt-pin-description"
        />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] uppercase text-stone-500 font-semibold">Categorie</label>
            <select
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value })}
              className="w-full mt-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white"
              data-testid="dt-pin-category"
            >
              {Object.keys(CATEGORY_COLORS).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase text-stone-500 font-semibold">Prioritate</label>
            <select
              value={draft.priority}
              onChange={(e) => setDraft({ ...draft, priority: e.target.value })}
              className="w-full mt-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white"
              data-testid="dt-pin-priority"
            >
              <option value="low">Scăzută</option>
              <option value="normal">Normală</option>
              <option value="high">Ridicată</option>
              <option value="urgent">Urgentă</option>
            </select>
          </div>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <button onClick={onCancel} className="flex-1 px-3 py-2 text-sm rounded-lg bg-white/5 hover:bg-white/10 text-stone-300">
          Anulează
        </button>
        <button
          onClick={onSubmit}
          disabled={!draft.title.trim()}
          className="flex-1 px-3 py-2 text-sm rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-medium"
          data-testid="dt-pin-submit"
        >
          Salvează pin
        </button>
      </div>
    </div>
  </div>
);

// --------- Pin Thread Modal (open existing pin to see/post comments) ---------
const PinThreadModal = ({ pin, onClose, onDelete, onStatusChange }) => {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    setLoading(true);
    axios.get(`${API}/digital-twin/pins/${pin.id}/comments`)
      .then(r => setComments(r.data.items || []))
      .catch(() => setComments([]))
      .finally(() => setLoading(false));
  }, [pin.id]);

  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      const { data } = await axios.post(`${API}/digital-twin/pins/${pin.id}/comments`, { message: text.trim() });
      setComments((arr) => [...arr, data]);
      setText("");
    } catch (e) {
      alert(e?.response?.data?.detail || e.message);
    } finally {
      setSending(false);
    }
  };

  const color = CATEGORY_COLORS[pin.category] || "#60a5fa";

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-stone-900 border border-white/10 rounded-2xl w-full max-w-lg flex flex-col max-h-[85vh]"
        data-testid="dt-pin-thread-modal"
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b border-white/10">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <div className="w-9 h-9 rounded-full shrink-0 mt-0.5" style={{ background: color }} />
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-white text-base truncate">{pin.title}</h3>
                <div className="flex flex-wrap gap-2 mt-1 text-[10px]">
                  <span className="px-2 py-0.5 rounded-full uppercase font-bold tracking-wider" style={{ background: `${color}25`, color }}>
                    {pin.category}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-white/5 text-stone-400 uppercase font-bold tracking-wider">
                    {pin.priority}
                  </span>
                  <span className="text-stone-500">
                    {pin.author_name} · {new Date(pin.created_at).toLocaleDateString("ro-RO")}
                  </span>
                </div>
              </div>
            </div>
            <button onClick={onClose} className="text-stone-500 hover:text-white shrink-0"><X className="w-5 h-5" /></button>
          </div>

          {pin.description && (
            <p className="mt-3 text-sm text-stone-300 leading-relaxed">{pin.description}</p>
          )}

          <div className="mt-3 flex flex-wrap gap-1.5">
            {["open", "in_review", "resolved", "rejected"].map((s) => (
              <button
                key={s}
                onClick={() => onStatusChange(s)}
                className={`px-2.5 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider ${
                  pin.status === s
                    ? "bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-400/30"
                    : "bg-white/5 text-stone-400 hover:bg-white/10"
                }`}
                data-testid={`dt-pin-status-${s}`}
              >
                {STATUS_LABEL[s]}
              </button>
            ))}
            <button
              onClick={onDelete}
              className="ml-auto px-2.5 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider bg-red-500/10 hover:bg-red-500/20 text-red-300 flex items-center gap-1"
              data-testid="dt-pin-delete"
            >
              <Trash2 className="w-3 h-3" /> Șterge
            </button>
          </div>
        </div>

        {/* Comments thread */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 min-h-[120px]">
          {loading && <div className="text-xs text-stone-500">Se încarcă...</div>}
          {!loading && comments.length === 0 && (
            <div className="text-center text-xs text-stone-500 py-8">
              <MessageCircle className="w-6 h-6 mx-auto mb-2 opacity-50" />
              Niciun comentariu încă. Începe conversația.
            </div>
          )}
          {comments.map((c) => (
            <div key={c.id} className="flex gap-3" data-testid={`dt-comment-${c.id}`}>
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                {(c.author_name || "?").slice(0, 1).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span className="text-xs font-medium text-stone-200 truncate">{c.author_name}</span>
                  <span className="text-[10px] text-stone-500 uppercase">{c.author_role}</span>
                  <span className="text-[10px] text-stone-500 ml-auto">
                    {new Date(c.created_at).toLocaleString("ro-RO", { dateStyle: "short", timeStyle: "short" })}
                  </span>
                </div>
                <div className="text-sm text-stone-300 whitespace-pre-wrap leading-relaxed">{c.message}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Compose */}
        <div className="border-t border-white/10 px-5 py-3 flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Scrie un comentariu..."
            className="flex-1 bg-white/5 border border-white/10 rounded-full px-4 py-2 text-sm text-white"
            data-testid="dt-comment-input"
          />
          <button
            onClick={send}
            disabled={!text.trim() || sending}
            className="px-4 py-2 rounded-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-medium flex items-center gap-1"
            data-testid="dt-comment-send"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

// Pre-cache the default model so first paint is fast.
// (no-op since default is procedural)

export default DigitalTwinViewer;
