#!/usr/bin/env node
/*
 * Patches @emergentbase/visual-edits' babel plugin so it skips React Three Fiber
 * primitives (mesh, group, boxGeometry, etc.) when injecting x-line-number /
 * x-source-location debug attributes.
 *
 * Without this patch, those attributes leak through to R3F's applyProps and
 * crash the reconciler with:
 *   "Cannot set 'x-line-number'. Ensure it is an object before setting 'line-number'."
 *
 * Idempotent — runs after yarn install (see "postinstall" in package.json).
 */
const fs = require("fs");
const path = require("path");

const PLUGIN_PATH = path.join(
  __dirname, "..", "node_modules", "@emergentbase", "visual-edits", "dist", "babel-plugin", "index.js"
);

if (!fs.existsSync(PLUGIN_PATH)) {
  // Plugin not installed (production build, or missing dep) — nothing to patch.
  return;
}

let src = fs.readFileSync(PLUGIN_PATH, "utf8");
if (src.includes("R3F_PRIMITIVES")) {
  console.log("[patch-visual-edits] already patched ✓");
  return;
}

const MARKER = 'if (/^[A-Z]/.test(elementName)) {\n      return;\n    }';
if (!src.includes(MARKER)) {
  console.warn("[patch-visual-edits] marker not found — plugin internals changed; skipping patch.");
  return;
}

const PATCH = MARKER + `
    // [PropManage patch] Skip React Three Fiber primitives (lowercase but not HTML).
    const R3F_PRIMITIVES = new Set([
      "mesh","group","scene","primitive","instancedMesh","points","sprite","line","lineSegments","lineLoop",
      "boxGeometry","planeGeometry","sphereGeometry","cylinderGeometry","coneGeometry","torusGeometry",
      "bufferGeometry","ringGeometry","circleGeometry","tubeGeometry","icosahedronGeometry","octahedronGeometry",
      "tetrahedronGeometry","dodecahedronGeometry","extrudeGeometry","latheGeometry","shapeGeometry",
      "meshBasicMaterial","meshStandardMaterial","meshPhongMaterial","meshLambertMaterial","meshPhysicalMaterial",
      "meshToonMaterial","meshDepthMaterial","meshNormalMaterial","meshMatcapMaterial","meshDistanceMaterial",
      "lineBasicMaterial","lineDashedMaterial","pointsMaterial","shaderMaterial","rawShaderMaterial","spriteMaterial",
      "shadowMaterial",
      "ambientLight","directionalLight","pointLight","spotLight","hemisphereLight","rectAreaLight","lightProbe",
      "perspectiveCamera","orthographicCamera","cubeCamera",
      "fog","fogExp2","color","gridHelper","axesHelper","boxHelper","polarGridHelper","planeHelper",
      "skinnedMesh","bone","skeleton",
    ]);
    if (R3F_PRIMITIVES.has(elementName)) { return; }`;

fs.writeFileSync(PLUGIN_PATH, src.replace(MARKER, PATCH));
console.log("[patch-visual-edits] patched ✓");
