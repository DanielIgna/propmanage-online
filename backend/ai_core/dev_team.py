"""AI Dev Team — READ-ONLY code analyzer.

Reads a project file, sends it to Claude with a senior-engineer prompt,
and returns structured suggestions: issues, improvements, security concerns.

EXPLICITLY READ-ONLY:
- Never writes files
- Never invokes git
- Never auto-commits
- Output is suggestions only (text + optional diff blob in markdown)

The admin must manually copy suggestions back to Emergent chat if they
want them applied. This keeps human-in-the-loop, no auto-cascade failures.
"""
import os
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional

from ai_core.provider import call_llm, ecosystem_enabled
from ai_core.code_index import list_paths

logger = logging.getLogger("propmanage.ai_dev_team")


_AGENTS = {
    "frontend": {
        "label": "Agent Frontend (React/Tailwind)",
        "system": """You are a senior React/Tailwind engineer reviewing a frontend file.
Focus on: component structure, hooks correctness, accessibility (a11y), Tailwind class hygiene,
prop drilling vs context, performance (useMemo/useCallback when needed), data-testid coverage on
interactive elements. NEVER suggest installing new packages unless absolutely necessary.

Output STRICT JSON only:
{
  "summary": "1-2 sentence overview (Romanian)",
  "issues": [
    {"severity": "P1|P2|P3", "title": "short title (Romanian)", "description": "detail (Romanian)", "line_hint": "approx line range like 'lines 45-52' or null"}
  ],
  "improvements": ["concrete suggestion 1 (Romanian)", "..."],
  "security_concerns": ["..."],
  "next_actions": ["copy-paste-ready prompt for Emergent (Romanian)", "..."]
}""",
    },
    "backend": {
        "label": "Agent Backend (FastAPI/Python)",
        "system": """You are a senior FastAPI/Python engineer reviewing a backend file.
Focus on: async correctness, MongoDB query efficiency, route auth/role checks, input validation,
error handling, race conditions, secrets in code, logging hygiene.

Output STRICT JSON only:
{
  "summary": "1-2 sentence overview (Romanian)",
  "issues": [
    {"severity": "P0|P1|P2|P3", "title": "(Romanian)", "description": "(Romanian)", "line_hint": "'lines X-Y' or null"}
  ],
  "improvements": ["..."],
  "security_concerns": ["..."],
  "next_actions": ["..."]
}""",
    },
    "qa": {
        "label": "Agent QA",
        "system": """You are a senior QA engineer reviewing a file for testability and coverage gaps.
Identify: missing data-testids on interactive elements, untested code paths, fragile selectors,
missing edge-case handling. Suggest specific test cases.

Output STRICT JSON only:
{
  "summary": "1-2 sentence overview (Romanian)",
  "issues": [{"severity":"P2|P3","title":"","description":"","line_hint":null}],
  "improvements": ["..."],
  "security_concerns": [],
  "next_actions": ["case de test concret pentru testing_agent_v3_fork (Romanian)"]
}""",
    },
    "security": {
        "label": "Agent Security",
        "system": """You are a senior application security engineer reviewing a file for vulnerabilities.
Check for: SQL/NoSQL injection, XSS, CSRF, broken auth, insecure deserialization, secrets in code,
missing rate limits, weak crypto, IDOR, path traversal, GDPR violations.

Output STRICT JSON only:
{
  "summary": "1-2 sentence overview (Romanian)",
  "issues": [{"severity":"P0|P1|P2|P3","title":"","description":"","line_hint":null}],
  "improvements": [],
  "security_concerns": ["concrete security risks (Romanian, with CWE if applicable)"],
  "next_actions": ["fix prompt for Emergent (Romanian)"]
}""",
    },
}


def _read_file_safe(rel_path: str, max_chars: int = 12000) -> Optional[str]:
    """Read /app/{rel_path} if it exists and is in the valid index. Never reads .env or .git."""
    if not rel_path or ".." in rel_path or rel_path.startswith("/"):
        return None
    full = os.path.join("/app", rel_path)
    if not os.path.isfile(full):
        return None
    if any(seg in full for seg in (".env", ".git/", "__pycache__", "node_modules", "/secrets")):
        return None
    try:
        with open(full, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read(max_chars)
        return content
    except Exception as e:  # noqa: BLE001
        logger.warning(f"[dev_team.read] {rel_path}: {e}")
        return None


def _parse_json(text: str) -> Optional[dict]:
    if not text:
        return None
    text = text.strip()
    if text.startswith("```"):
        text = text.split("```", 2)[1] if text.count("```") >= 2 else text[3:]
        if text.startswith("json"):
            text = text[4:]
        text = text.rsplit("```", 1)[0].strip()
    import json
    try:
        return json.loads(text)
    except Exception:
        start = text.find("{")
        end = text.rfind("}")
        if start >= 0 and end > start:
            try:
                return json.loads(text[start:end + 1])
            except Exception:
                return None
    return None


async def analyze_file(rel_path: str, agent: str = "auto") -> dict:
    """Read a file, analyze with the chosen agent, return structured suggestions.

    `agent` in {auto, frontend, backend, qa, security}. `auto` picks based on extension.
    Returns dict with summary/issues/improvements/security_concerns/next_actions + meta.
    Never raises.
    """
    if not await ecosystem_enabled():
        return {"error": "AI Ecosystem dezactivat din Admin Settings", "agent": agent}

    paths = set(list_paths())
    rel_norm = rel_path.lstrip("/").replace("app/", "")
    if rel_norm not in paths:
        return {"error": f"Fișierul '{rel_path}' nu există în index. Folosește /api/admin/ai-dev-team/files pentru lista validă."}

    content = _read_file_safe(rel_norm)
    if not content:
        return {"error": "Nu am putut citi fișierul (poate fi binar sau prea mare)"}

    # Auto-select agent
    if agent == "auto":
        if rel_norm.endswith((".jsx", ".tsx")) or "frontend" in rel_norm:
            agent = "frontend"
        elif rel_norm.endswith(".py"):
            agent = "backend"
        else:
            agent = "frontend"
    if agent not in _AGENTS:
        return {"error": f"Agent invalid: {agent}. Valid: {list(_AGENTS.keys())}"}

    sys_msg = _AGENTS[agent]["system"]
    user_msg = (
        f"## File: {rel_norm}\n\n```\n{content}\n```\n\n"
        f"Analyze this file as the agent described and return JSON only."
    )

    result = await call_llm(sys_msg, user_msg, session_id=f"dev-team-{agent}-{uuid.uuid4().hex[:6]}")
    if result.get("error"):
        return {"error": result["error"], "agent": agent}

    parsed = _parse_json(result.get("text", ""))
    if not parsed:
        return {"error": "Nu am putut parsa răspunsul AI", "raw": (result.get("text") or "")[:500], "agent": agent}

    return {
        "agent": agent,
        "agent_label": _AGENTS[agent]["label"],
        "file": rel_norm,
        "summary": parsed.get("summary", ""),
        "issues": parsed.get("issues") or [],
        "improvements": parsed.get("improvements") or [],
        "security_concerns": parsed.get("security_concerns") or [],
        "next_actions": parsed.get("next_actions") or [],
        "provider": result.get("provider"),
        "model": result.get("model"),
        "analyzed_at": datetime.now(timezone.utc).isoformat(),
    }


def list_available_files(filter_kind: Optional[str] = None) -> list[str]:
    """Return files eligible for analysis.

    filter_kind: 'frontend' | 'backend' | None.
    """
    paths = list_paths()
    if filter_kind == "frontend":
        return [p for p in paths if p.startswith("frontend/src/")]
    if filter_kind == "backend":
        return [p for p in paths if p.startswith("backend/")]
    return paths


def agents_meta() -> dict:
    return {k: {"label": v["label"]} for k, v in _AGENTS.items()}
