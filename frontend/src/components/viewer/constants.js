// Digital Twin viewer — shared constants (face styles, tools, axes, categories).
import * as THREE from "three";
import { MousePointer2, Ruler, Scissors, MapPin } from "lucide-react";

export const FACE_STYLES = [
  { id: "shaded", label: "Shaded Textures", desc: "Implicit · materiale originale" },
  { id: "white", label: "White Model", desc: "Toate suprafețele albe" },
  { id: "xray", label: "X-Ray", desc: "Transparent · vezi prin pereți" },
  { id: "wireframe", label: "Wireframe", desc: "Doar muchii" },
  { id: "monochrome", label: "Monochrome", desc: "Nuanțe de gri" },
];

export const TOOLS = [
  { id: "orbit", label: "Navigare", icon: MousePointer2, desc: "Rotate · zoom · pan" },
  { id: "measure", label: "Măsurare", icon: Ruler, desc: "Click 2 puncte → distanță" },
  { id: "section", label: "Secțiune", icon: Scissors, desc: "Planul de tăiere mobil" },
  { id: "pin", label: "Pin notițe", icon: MapPin, desc: "Click pe model → spawn pin" },
];

export const SECTION_AXES = [
  { id: "x", label: "X (E-V)", normal: new THREE.Vector3(1, 0, 0) },
  { id: "y", label: "Y (sus-jos)", normal: new THREE.Vector3(0, 1, 0) },
  { id: "z", label: "Z (N-S)", normal: new THREE.Vector3(0, 0, 1) },
];

export const CATEGORY_COLORS = {
  general: "#60a5fa",
  structural: "#f87171",
  plumbing: "#22d3ee",
  electrical: "#facc15",
  hvac: "#a78bfa",
  finish: "#fb923c",
  defect: "#ef4444",
};

export const STATUS_LABEL = {
  open: "Deschis",
  in_review: "În analiză",
  resolved: "Rezolvat",
  rejected: "Respins",
};
