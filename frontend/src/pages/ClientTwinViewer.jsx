// Read-only Digital Twin viewer for clients + Designers browse panel
import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { X, Building, Star, CheckCircle2, Palette, Sparkles, MapPin, Users, SlidersHorizontal } from "lucide-react";
import { API } from "./DashShared";
import TwinAIQA from "../components/TwinAIQA";

const ROOM_COLORS = {
  living: "bg-emerald-500/20 border-emerald-500/40 text-emerald-300",
  bedroom: "bg-indigo-500/20 border-indigo-500/40 text-indigo-300",
  kitchen: "bg-amber-500/20 border-amber-500/40 text-amber-300",
  bathroom: "bg-cyan-500/20 border-cyan-500/40 text-cyan-300",
  hallway: "bg-stone-500/20 border-stone-500/40 text-stone-300",
  balcony: "bg-teal-500/20 border-teal-500/40 text-teal-300",
  office: "bg-purple-500/20 border-purple-500/40 text-purple-300",
  storage: "bg-slate-500/20 border-slate-500/40 text-slate-300",
  other: "bg-white/10 border-white/20 text-stone-300",
};

const ROOM_TYPE_LABELS = {
  living: "Living", bedroom: "Dormitor", kitchen: "Bucătărie",
  bathroom: "Baie", hallway: "Hol", balcony: "Balcon",
  office: "Birou", storage: "Depozit", other: "Altă",
};

const ASSET_LABELS = {
  hvac: "AC / Climatizare", boiler: "Centrală termică", electric_panel: "Panou electric",
  water_meter: "Apometru", gas_meter: "Gaz", appliance: "Electrocasnic",
  lighting: "Iluminat", plumbing: "Sanitar", other: "Altul",
};

const CONDITION_DOT = {
  good: "bg-emerald-400", fair: "bg-amber-400",
  needs_service: "bg-orange-400", critical: "bg-red-400",
};

// ============= TWIN 3D VIEWER MODAL (read-only) =============
export const ClientTwinViewerModal = ({ propertyId, propertyName, onClose }) => {
  const [twin, setTwin] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/properties/${propertyId}/twin`)
      .then(r => setTwin(r.data))
      .catch(() => setTwin({ rooms: [], assets: [], status: "not_requested" }))
      .finally(() => setLoading(false));
  }, [propertyId]);

  const rooms = twin?.rooms || [];
  const assets = twin?.assets || [];
  const bounds = rooms.length ? {
    maxX: Math.max(...rooms.map(r => r.x + r.w)) + 40,
    maxY: Math.max(...rooms.map(r => r.y + r.h)) + 40,
  } : { maxX: 500, maxY: 400 };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 overflow-y-auto"
      onClick={onClose}
      data-testid="twin-viewer-modal"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="bg-stone-950 border border-white/10 rounded-3xl w-full max-w-5xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-stone-950/95 backdrop-blur border-b border-white/10 p-5 flex items-center justify-between z-10">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-emerald-400 mb-1">Digital Twin · Live 3D</div>
            <h2 className="font-serif text-2xl flex items-center gap-2">
              <Building className="w-5 h-5 text-[#d4ff3a]" />{propertyName || "Proprietatea ta"}
            </h2>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center" data-testid="close-twin-viewer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {twin?.project_id && <TwinAIQA projectId={twin.project_id} />}
          {loading ? (
            <div className="text-center py-10 text-stone-500">Se încarcă modelul 3D...</div>
          ) : rooms.length === 0 ? (
            <div className="text-center py-10 text-stone-500">
              <Building className="w-12 h-12 mx-auto mb-3 opacity-30" />
              Twin-ul nu are camere definite încă. Operatorul lucrează la el.
            </div>
          ) : (
            <>
              {/* Stats summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3">
                  <div className="text-[10px] uppercase tracking-wider text-emerald-300/80">Camere</div>
                  <div className="font-serif text-2xl text-emerald-300">{rooms.length}</div>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
                  <div className="text-[10px] uppercase tracking-wider text-amber-300/80">Asset-uri</div>
                  <div className="font-serif text-2xl text-amber-300">{assets.length}</div>
                </div>
                <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-3">
                  <div className="text-[10px] uppercase tracking-wider text-purple-300/80">Suprafață totală</div>
                  <div className="font-serif text-2xl text-purple-300">{rooms.reduce((s, r) => s + (r.area || 0), 0)}m²</div>
                </div>
              </div>

              {/* SVG Layout */}
              <div className="bg-gradient-to-br from-slate-900 via-cyan-950 to-slate-900 border border-white/10 rounded-2xl p-4 overflow-x-auto">
                <svg viewBox={`0 0 ${bounds.maxX} ${bounds.maxY}`} className="w-full" style={{ minHeight: 280 }} data-testid="twin-svg">
                  <defs>
                    <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#grid)" />
                  {rooms.map(r => (
                    <g key={r.id} data-testid={`twin-room-${r.id}`}>
                      <rect x={r.x} y={r.y} width={r.w} height={r.h}
                        fill="rgba(212,255,58,0.05)" stroke="rgba(212,255,58,0.4)" strokeWidth="2" rx="6" />
                      <text x={r.x + r.w / 2} y={r.y + r.h / 2 - 6} textAnchor="middle" fill="#d4ff3a" fontSize="14" fontWeight="500">{r.name}</text>
                      <text x={r.x + r.w / 2} y={r.y + r.h / 2 + 14} textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="11">{r.area}m²</text>
                    </g>
                  ))}
                  {assets.map(a => (
                    <g key={a.id} data-testid={`twin-asset-${a.id}`}>
                      <circle cx={a.x} cy={a.y} r="8" fill={
                        a.condition === "good" ? "#34d399" :
                        a.condition === "fair" ? "#fbbf24" :
                        a.condition === "needs_service" ? "#fb923c" : "#f87171"
                      } />
                      <circle cx={a.x} cy={a.y} r="14" fill="currentColor" opacity="0.15">
                        <animate attributeName="r" values="14;20;14" dur="2.5s" repeatCount="indefinite" />
                      </circle>
                    </g>
                  ))}
                </svg>
              </div>

              {/* Rooms list */}
              <div>
                <div className="text-[10px] uppercase tracking-wider text-stone-400 mb-2">Camere ({rooms.length})</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {rooms.map(r => (
                    <div key={r.id} className={`rounded-xl p-3 border ${ROOM_COLORS[r.type] || ROOM_COLORS.other}`}>
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-sm">{r.name}</div>
                        <div className="text-[10px] uppercase tracking-wider opacity-70">{ROOM_TYPE_LABELS[r.type] || r.type}</div>
                      </div>
                      <div className="text-xs opacity-70 mt-1">{r.area}m²</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Assets list */}
              {assets.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-stone-400 mb-2">Asset-uri tehnice ({assets.length})</div>
                  <div className="space-y-2">
                    {assets.map(a => (
                      <div key={a.id} className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-3">
                        <div className={`w-2.5 h-2.5 rounded-full ${CONDITION_DOT[a.condition] || CONDITION_DOT.good}`} />
                        <div className="flex-1">
                          <div className="text-sm font-medium">{a.name}</div>
                          <div className="text-[10px] uppercase tracking-wider text-stone-500">{ASSET_LABELS[a.type] || a.type}</div>
                        </div>
                        <div className="text-[10px] uppercase tracking-wider text-stone-400">{a.condition}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

// ============= DESIGNERS BROWSE PANEL (inline) =============
export const DesignersBrowse = ({ onSelect }) => {
  const navigate = useNavigate();
  const [designers, setDesigners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [zone, setZone] = useState("");
  const [style, setStyle] = useState("");
  const [availableZones, setAvailableZones] = useState([]);
  const [availableStyles, setAvailableStyles] = useState([]);

  // Load filter dropdown options once
  useEffect(() => {
    axios.get(`${API}/marketplace/filters?category=interior_design`)
      .then(r => {
        setAvailableZones(r.data.zones || []);
        setAvailableStyles(r.data.styles || []);
      })
      .catch(() => {});
  }, []);

  // Reload designers when filters change
  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ category: "interior_design", verified_only: "true", sort: "rating" });
    if (zone) params.set("zone", zone);
    if (style) params.set("style", style);
    axios.get(`${API}/marketplace/specialists?${params}`)
      .then(r => setDesigners(r.data || []))
      .catch(() => setDesigners([]))
      .finally(() => setLoading(false));
  }, [zone, style]);

  const hasAnyFilters = availableZones.length > 0 || availableStyles.length > 0;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="glass-strong rounded-3xl p-5 sm:p-6 mt-4" data-testid="designers-browse">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-purple-500/30 to-pink-500/20 border border-purple-500/40 flex items-center justify-center">
            <Users className="w-4 h-4 text-purple-300" />
          </div>
          <div>
            <h3 className="font-serif text-lg leading-tight">Designerii noștri</h3>
            <div className="text-[10px] uppercase tracking-wider text-stone-400">
              {loading ? "Caut designeri..." : `${designers.length} ${designers.length === 1 ? "designer" : "designeri"} · verificați`}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasAnyFilters && (
            <button onClick={() => setFiltersOpen(o => !o)}
              className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-full border flex items-center gap-1 transition ${(zone || style) ? "bg-purple-500/25 text-purple-200 border-purple-500/50" : "bg-white/5 text-stone-400 border-white/10 hover:bg-white/10"}`}
              data-testid="designers-filters-toggle">
              <SlidersHorizontal className="w-3 h-3" />
              Filtre{(zone || style) ? ` · ${[zone, style].filter(Boolean).length}` : ""}
            </button>
          )}
          <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30">DESIGN INTERIOR</span>
        </div>
      </div>

      {/* Filter panel */}
      {filtersOpen && hasAnyFilters && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-3 mb-4 space-y-3" data-testid="designers-filters-panel">
          {availableZones.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-stone-400 mb-1.5 flex items-center gap-1">
                <MapPin className="w-3 h-3" />Zonă acoperire
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button onClick={() => setZone("")}
                  className={`text-xs px-3 py-1 rounded-full border transition ${zone === "" ? "bg-[#d4ff3a]/20 text-[#d4ff3a] border-[#d4ff3a]/40" : "bg-white/5 text-stone-400 border-white/10 hover:bg-white/10"}`}
                  data-testid="filter-zone-all">Toate</button>
                {availableZones.map(z => (
                  <button key={z} onClick={() => setZone(z)}
                    className={`text-xs px-3 py-1 rounded-full border transition ${zone === z ? "bg-[#d4ff3a]/20 text-[#d4ff3a] border-[#d4ff3a]/40" : "bg-white/5 text-stone-400 border-white/10 hover:bg-white/10"}`}
                    data-testid={`filter-zone-${z}`}>{z}</button>
                ))}
              </div>
            </div>
          )}
          {availableStyles.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-stone-400 mb-1.5 flex items-center gap-1">
                <Palette className="w-3 h-3" />Stil portfolio
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button onClick={() => setStyle("")}
                  className={`text-xs px-3 py-1 rounded-full border transition ${style === "" ? "bg-purple-500/20 text-purple-300 border-purple-500/40" : "bg-white/5 text-stone-400 border-white/10 hover:bg-white/10"}`}
                  data-testid="filter-style-all">Toate</button>
                {availableStyles.map(s => (
                  <button key={s} onClick={() => setStyle(s)}
                    className={`text-xs px-3 py-1 rounded-full border capitalize transition ${style === s ? "bg-purple-500/20 text-purple-300 border-purple-500/40" : "bg-white/5 text-stone-400 border-white/10 hover:bg-white/10"}`}
                    data-testid={`filter-style-${s}`}>{s}</button>
                ))}
              </div>
            </div>
          )}
          {(zone || style) && (
            <button onClick={() => { setZone(""); setStyle(""); }} className="text-xs text-stone-500 hover:text-stone-300 underline" data-testid="filter-clear">
              Resetează filtrele
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-stone-500 text-sm">Se caută designeri...</div>
      ) : designers.length === 0 ? (
        <div className="text-center py-8 text-stone-500 text-sm" data-testid="designers-empty">
          <Palette className="w-10 h-10 mx-auto mb-2 opacity-30" />
          Nu am găsit designeri pentru filtrele selectate. Încearcă alte criterii.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {designers.slice(0, 6).map(d => (
            <div key={d.id}
              className="bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-500/40 rounded-2xl p-4 transition-all group flex flex-col"
              data-testid={`designer-card-${d.id}`}>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-purple-500/30 to-pink-500/30 border border-white/10 flex items-center justify-center font-serif text-lg text-purple-200 shrink-0 overflow-hidden">
                  {d.avatar || d.picture ? <img src={d.avatar || d.picture} alt={d.name} className="w-full h-full object-cover" /> : (d.name || "?").charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm truncate flex items-center gap-1.5">
                    {d.name}
                    {d.verified && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-stone-400">
                    <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                    <span className="text-amber-300">{d.rating?.toFixed(1) || "—"}</span>
                    <span className="text-stone-500">· {d.reviews_count || 0} recenzii</span>
                  </div>
                </div>
                {d.tier && (
                  <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#d4ff3a]/15 text-[#d4ff3a] border border-[#d4ff3a]/30 shrink-0">{d.tier}</span>
                )}
              </div>
              {(d.service_categories && d.service_categories.length > 0) && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {d.service_categories.slice(0, 3).map(c => (
                    <span key={c} className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/5 text-stone-400 border border-white/5">{c.replace("_", " ")}</span>
                  ))}
                </div>
              )}
              <div className="text-[10px] uppercase tracking-wider text-stone-500 mt-2">
                {d.availability_status === "available" ? "✓ Disponibil" : (d.availability_status || "")}
                {d.coverage_zones && d.coverage_zones.length > 0 && ` · ${d.coverage_zones.length} zone`}
              </div>
              <div className="flex gap-2 mt-3 pt-3 border-t border-white/5">
                <button
                  onClick={() => navigate(`/specialists/${d.id}`)}
                  className="flex-1 text-xs px-3 py-2 rounded-full bg-white/5 hover:bg-white/10 text-stone-300 border border-white/10 transition flex items-center justify-center gap-1"
                  data-testid={`designer-view-profile-${d.id}`}
                >
                  Vezi profil
                </button>
                <button
                  onClick={() => onSelect && onSelect(d)}
                  className="flex-1 text-xs px-3 py-2 rounded-full bg-purple-500/15 hover:bg-purple-500/25 text-purple-200 border border-purple-500/40 transition flex items-center justify-center gap-1"
                  data-testid={`designer-request-${d.id}`}
                >
                  <Sparkles className="w-3 h-3" />Solicită
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
};
