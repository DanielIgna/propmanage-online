"""Enterprise Knowledge Center — EXECUTION ORDER 002 · Module 1 (repository), 2 (search),
3/11 (dependency map din Relationship Registry). Acces exclusiv Founder (OWNER_EMAIL).

Read-only: expune guvernanța existentă, nu creează guvernanță nouă (regula Phase 2).
Relațiile provin DOAR din data/enterprise_registry.json — registru curat manual din cod
real, conform Truth Engine (D161): nicio legătură inferată automat.
"""
import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query

from deps import require_role

router = APIRouter(prefix="/api/founder/knowledge", tags=["knowledge-center"])

OWNER_EMAILS = {e.strip().lower() for e in os.environ.get("OWNER_EMAIL", "").split(",") if e.strip()}
MEMORY_ROOT = Path("/app/memory")
DOCS_ROOT = Path("/app/docs")
REGISTRY_PATH = Path(__file__).resolve().parent.parent / "data" / "enterprise_registry.json"
WIDGETS_PATH = Path(__file__).resolve().parent.parent / "data" / "widget_inspector.json"
ARCH_PATH = Path(__file__).resolve().parent.parent / "data" / "architecture_blocks.json"

CATEGORY_ORDER = [
    "System Zero", "Constitution", "Board Directives", "Board Resolutions", "Execution Orders",
    "Enterprise Standards", "Enterprise Principles", "Enterprise Playbooks", "Executive Prompts",
    "CEO Mode", "AI Charters", "Enterprise Metrics", "Enterprise Health", "Enterprise Score",
    "Governance", "Strategy", "Roadmaps", "Architecture", "Digital Twin", "Finance",
    "Case Library", "Memory",
]

PATH_RULES = [
    ("memory/prompts/SYSTEM_ZERO", "System Zero"),
    ("memory/prompts/ENTERPRISE_CEO_MODE", "CEO Mode"),
    ("memory/prompts/", "Executive Prompts"),
    ("memory/constitution/", "Constitution"),
    ("memory/board/directives/", "Board Directives"),
    ("memory/board/BOARD_RESOLUTIONS", "Board Resolutions"),
    ("memory/board/RESOLUTION_", "Board Resolutions"),
    ("memory/board/EXECUTION_ORDER", "Execution Orders"),
    ("memory/board/BOARD_LAWS", "Governance"),
    ("memory/board/BOARD_CHARTERS", "AI Charters"),
    ("memory/board/", "Board Directives"),
    ("memory/metrics/ENTERPRISE_SCORE", "Enterprise Score"),
    ("memory/metrics/ENTERPRISE_HEALTH", "Enterprise Health"),
    ("memory/metrics/", "Enterprise Metrics"),
    ("memory/governance/", "Governance"),
    ("memory/strategy/ROADMAP", "Roadmaps"),
    ("memory/strategy/", "Strategy"),
]
NAME_RULES = [
    ("ENTERPRISE_STANDARDS", "Enterprise Standards"),
    ("ENTERPRISE_PLAYBOOKS", "Enterprise Playbooks"),
    ("ENTERPRISE_PRINCIPLES", "Enterprise Principles"),
    ("CHARTER", "AI Charters"),
    ("ARCHITECTURE", "Architecture"),
    ("DESIGN_SYSTEM", "Architecture"),
    ("ROADMAP", "Roadmaps"),
    ("PROPERTY_DNA", "Digital Twin"),
    ("PROPERTY_INTELLIGENCE", "Digital Twin"),
    ("GOVERNANCE", "Governance"),
    ("CONSTITUTIA", "Constitution"),
    ("VALUE_OFFICE", "Finance"),
    ("WAR_MAP", "Roadmaps"),
    ("CASE_LIBRARY", "Case Library"),
    ("DECISION_REGISTER", "Governance"),
    ("TECHNICAL_DEBT", "Architecture"),
]


def _require_owner(user: dict) -> None:
    if (user.get("email") or "").lower() not in OWNER_EMAILS:
        raise HTTPException(403, "Enterprise Knowledge Center este disponibil exclusiv Fondatorului.")


def _categorize(rel: str) -> str:
    for prefix, cat in PATH_RULES:
        if rel.startswith(prefix):
            return cat
    name = rel.rsplit("/", 1)[-1].upper()
    for token, cat in NAME_RULES:
        if token in name:
            return cat
    return "Memory"


def _all_files():
    for root, label in ((MEMORY_ROOT, "memory"), (DOCS_ROOT, "docs")):
        if not root.exists():
            continue
        for p in sorted(root.rglob("*.md")):
            yield p, f"{label}/{p.relative_to(root)}"


def _doc_meta(p: Path, rel: str) -> dict:
    try:
        head = p.read_text(encoding="utf-8", errors="replace")[:1200]
    except Exception:  # noqa: BLE001
        head = ""
    title = rel.rsplit("/", 1)[-1]
    for m in re.finditer(r"^#\s*(.+)$", head, re.MULTILINE):
        cand = m.group(1).strip().lstrip("#").strip()
        if re.search(r"[A-Za-z0-9ĂÂÎȘȚăâîșț]", cand):
            title = cand
            break
    vm = re.search(r"(?:VERSION|VERSIUNE)[\s:]*v?([0-9]+(?:\.[0-9]+)?)", head, re.IGNORECASE)
    up = head.upper()
    pending = "ÎN AȘTEPTAREA TEXTULUI VERBATIM" in up or "PENDING VERBATIM" in up
    return {
        "path": rel,
        "title": title[:160],
        "category": _categorize(rel),
        "version": vm.group(1) if vm else "1.0",
        "status": "Draft — pending verbatim" if pending else "Active",
        "author": "Founder (verbatim)" if "VERBATIM" in up else "Executive Intelligence (derivat)",
        "updated": datetime.fromtimestamp(p.stat().st_mtime, tz=timezone.utc).isoformat(),
        "size_bytes": p.stat().st_size,
    }


def _load_registry() -> dict:
    try:
        return json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
    except Exception:  # noqa: BLE001
        return {"nodes": [], "edges": []}


def _doc_relationships(rel: str, reg: dict) -> dict:
    node = next((n for n in reg["nodes"] if n.get("ref") == rel), None)
    if not node:
        return {"node": None, "depends_on": [], "used_by": [], "note": "UNKNOWN — documentul nu are relații dovedite în registru (Truth Engine: nu inferăm)."}
    names = {n["id"]: n for n in reg["nodes"]}

    def enrich(edge, other_id):
        o = names.get(other_id, {})
        return {**edge, "other_id": other_id, "other_name": o.get("name", other_id),
                "other_type": o.get("type"), "other_ref": o.get("ref")}
    depends = [enrich(e, e["source"]) for e in reg["edges"] if e["target"] == node["id"]]
    used_by = [enrich(e, e["target"]) for e in reg["edges"] if e["source"] == node["id"]]
    return {"node": node, "depends_on": depends, "used_by": used_by, "note": None}


def _safe_resolve(rel: str) -> Path:
    if rel.startswith("memory/"):
        p = (MEMORY_ROOT / rel[len("memory/"):]).resolve()
        root = MEMORY_ROOT
    elif rel.startswith("docs/"):
        p = (DOCS_ROOT / rel[len("docs/"):]).resolve()
        root = DOCS_ROOT
    else:
        raise HTTPException(400, "Cale invalidă.")
    if root not in p.parents or p.suffix != ".md" or not p.exists():
        raise HTTPException(404, "Documentul nu există.")
    return p


@router.get("/access")
async def founder_access(user=Depends(require_role("admin"))):
    return {"is_founder": (user.get("email") or "").lower() in OWNER_EMAILS}


@router.get("/tree")
async def knowledge_tree(user=Depends(require_role("admin"))):
    _require_owner(user)
    cats: dict[str, list] = {}
    total = 0
    for p, rel in _all_files():
        meta = _doc_meta(p, rel)
        cats.setdefault(meta["category"], []).append(meta)
        total += 1
    ordered = [c for c in CATEGORY_ORDER if c in cats] + [c for c in sorted(cats) if c not in CATEGORY_ORDER]
    return {"total": total,
            "categories": [{"name": c, "count": len(cats[c]), "docs": cats[c]} for c in ordered]}


@router.get("/doc")
async def knowledge_doc(path: str = Query(...), user=Depends(require_role("admin"))):
    _require_owner(user)
    p = _safe_resolve(path)
    meta = _doc_meta(p, path)
    return {"meta": meta, "content": p.read_text(encoding="utf-8", errors="replace"),
            "relationships": _doc_relationships(path, _load_registry())}


@router.get("/search")
async def knowledge_search(q: str = Query(..., min_length=2), user=Depends(require_role("admin"))):
    _require_owner(user)
    needle = q.lower()
    doc_hits = []
    for p, rel in _all_files():
        try:
            text = p.read_text(encoding="utf-8", errors="replace")
        except Exception:  # noqa: BLE001
            continue
        low = text.lower()
        idx = low.find(needle)
        title_hit = needle in rel.lower()
        if idx < 0 and not title_hit:
            continue
        snippet = ""
        if idx >= 0:
            line_start = text.rfind("\n", 0, idx) + 1
            line_end = text.find("\n", idx)
            snippet = text[line_start:line_end if line_end > 0 else idx + 160].strip()[:200]
        meta = _doc_meta(p, rel)
        doc_hits.append({"path": rel, "title": meta["title"], "category": meta["category"],
                         "status": meta["status"], "snippet": snippet,
                         "occurrences": low.count(needle)})
        if len(doc_hits) >= 50:
            break
    reg = _load_registry()
    node_hits = [n for n in reg["nodes"]
                 if needle in n["name"].lower() or needle in n.get("ref", "").lower()
                 or needle in n.get("description", "").lower()][:20]
    doc_hits.sort(key=lambda d: -d["occurrences"])
    return {"query": q, "documents": doc_hits, "registry_nodes": node_hits,
            "total": len(doc_hits) + len(node_hits)}


@router.get("/registry")
async def knowledge_registry(user=Depends(require_role("admin"))):
    _require_owner(user)
    reg = _load_registry()
    by_status: dict[str, int] = {}
    for e in reg["edges"]:
        by_status[e["verification_status"]] = by_status.get(e["verification_status"], 0) + 1
    by_type: dict[str, int] = {}
    for n in reg["nodes"]:
        by_type[n["type"]] = by_type.get(n["type"], 0) + 1
    return {**reg, "stats": {"nodes": len(reg["nodes"]), "edges": len(reg["edges"]),
                             "edges_by_status": by_status, "nodes_by_type": by_type}}


@router.get("/inspector/{widget_id}")
async def inspector_widget(widget_id: str, user=Depends(require_role("admin"))):
    """Dashboard Inspector (Module 4): explică un widget cu evidență din Relationship Registry."""
    _require_owner(user)
    try:
        widgets = json.loads(WIDGETS_PATH.read_text(encoding="utf-8"))["widgets"]
    except Exception:  # noqa: BLE001
        raise HTTPException(500, "Inspector Registry indisponibil.")
    w = next((x for x in widgets if x["id"] == widget_id), None)
    if not w:
        raise HTTPException(404, "Widget necunoscut în Inspector Registry.")
    reg = _load_registry()
    names = {n["id"]: n for n in reg["nodes"]}

    def node(nid):
        return names.get(nid, {"id": nid, "name": nid, "type": None, "ref": None}) if nid else None
    out = dict(w)
    engine_id = w.get("engine")
    out["engine"] = node(engine_id)
    out["api"] = node(w.get("api"))
    out["prompt"] = node(w.get("prompt"))
    for key in ("database", "documents", "related_dashboards"):
        out[key] = [node(i) for i in w.get(key, [])]
    deps = []
    for e in reg["edges"]:
        if engine_id and (e["source"] == engine_id or e["target"] == engine_id):
            deps.append({**e, "source_name": names.get(e["source"], {}).get("name", e["source"]),
                         "target_name": names.get(e["target"], {}).get("name", e["target"])})
    out["dependencies"] = deps
    return out


@router.get("/architecture")
async def architecture_blocks(user=Depends(require_role("admin"))):
    """Architecture Navigator: blocurile platformei, cu fișiere reale din repo."""
    _require_owner(user)
    try:
        return json.loads(ARCH_PATH.read_text(encoding="utf-8"))
    except Exception:  # noqa: BLE001
        raise HTTPException(500, "Architecture Registry indisponibil.")
