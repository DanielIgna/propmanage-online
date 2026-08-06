# SSOT REGISTRY

**Artifact Type**: REGISTRY
**Owner**: Fondator (danieligna1@gmail.com)
**Last Review**: 2026-02-06
**Schema**: Topic · OwnerDocument · AuthorityTier · Status · LastReview · Notes
**Purpose**: Enumerates the Single-Source-of-Truth mapping for every governance topic on PropManage. For any listed topic, the row's `OwnerDocument` is the canonical statement — any other document that references the topic must defer to it.

> This registry does not contain narrative prose. It contains structured facts. To add a new topic: (1) verify no equivalent SSOT already exists in this registry; (2) confirm the OwnerDocument is Active and Approved; (3) append a row respecting the schema; (4) bump `Last Review`.

## Schema Fields

| Field | Description |
|---|---|
| Topic | The subject of the SSOT statement. Short, canonical noun-phrase. |
| OwnerDocument | Repository path to the document holding the authoritative statement. |
| AuthorityTier | `Constitutional` · `Board Directive` · `Enterprise Standard` · `Draft`. |
| Status | `Active` · `Draft` · `Deprecated`. Only `Active` rows are canonical. |
| LastReview | ISO date (`YYYY-MM-DD`) of last verification by the Owner. |
| Notes | Contextual annotation. Kept short. |

## Entries

| Topic | OwnerDocument | AuthorityTier | Status | LastReview | Notes |
|---|---|---|---|---|---|
| Governance Hierarchy | memory/audits/MASTER_KNOWLEDGE_GOVERNANCE.md | Constitutional | Active | 2026-07-31 | Constitutional archive governing every document in the Knowledge Center. |
| Master Platform State | memory/audits/MASTER_PLATFORM_STATE_LIVING_GOVERNANCE_2026-07-31.md | Constitutional | Active | 2026-07-31 | Living record of platform state, capabilities, and unresolved risks. |
| Artifact Types | memory/audits/MASTER_KNOWLEDGE_GOVERNANCE.md | Constitutional | Active | 2026-02-06 | Six artifact types: DOCUMENT · REGISTRY · GRAPH · LEDGER · INDEX · CATALOG. Only DOCUMENT and REGISTRY populated. |
| Board Directives | memory/board/directives/ | Constitutional | Active | 2026-02-06 | Every `BD-*` file is authoritative for its stated scope. Feature-freeze BD-RDPE currently in force. |
| Knowledge Center | memory/audits/MASTER_KNOWLEDGE_GOVERNANCE.md | Constitutional | Active | 2026-07-31 | Enterprise KC exists to be the platform's long-term memory and constitutional archive. |
| Research-Driven Product Evolution | memory/audits/BOARD_DIRECTIVE_RESEARCH_DRIVEN_EVOLUTION.md | Board Directive | Active | 2026-07-31 | New features frozen until 15-20 field interviews with association presidents complete. |
