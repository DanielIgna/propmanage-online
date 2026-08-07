# INTERVIEW REGISTRY

**Artifact Type**: REGISTRY
**Owner**: Fondator (danieligna1@gmail.com)
**Last Review**: 2026-02-06
**Schema**: InterviewID · Date · AssociationBloc · YearBuilt · Apartments · PresidentTenure · Status · FilePath
**Purpose**: Enumerează toate interviurile de research validate în cadrul BOARD_DIRECTIVE_RESEARCH_DRIVEN_EVOLUTION. Sursa unică de adevăr pentru progres cantitativ (nr. interviuri) și acoperire (tipuri de bloc/vechime).

> Reguli: (1) o intrare adăugată doar când statusul devine `Validated`; (2) FilePath obligatoriu; (3) fiecare interviu contribuie la Pattern Registry (P-XXX cu +1 confirmare); (4) target Fondator: 15-20 interviuri Validated înainte de dezghețarea features.

## Schema Fields

| Field | Description |
|---|---|
| InterviewID | Cod unic (AP-NNN pentru Association President). |
| Date | ISO date (YYYY-MM-DD). |
| AssociationBloc | Denumire scurtă bloc/asociație. |
| YearBuilt | Anul construcției blocului. |
| Apartments | Numărul de apartamente în bloc. |
| PresidentTenure | Vechimea președintelui în funcție. |
| Status | Validated · Pending · Rejected. |
| FilePath | Cale relativă către fișier. |

## Entries

| InterviewID | Date | AssociationBloc | YearBuilt | Apartments | PresidentTenure | Status | FilePath |
|---|---|---|---|---|---|---|---|
| AP-003 | 2026-02-06 | Negoiu 8D | 2006 | 13 | ~1 an | Validated | memory/audits/INTERVIEW_2026-02-06_NEGOIU-8D.md |

## Coverage Metrics (auto-updated on next interview)

- **Total Validated Interviews**: 1
- **Target Fondator**: 15-20 (Feature Freeze until reached)
- **Progress**: 5-7% (1/15)
- **Distribuție vechime bloc**: post-2000 = 1 (100%) · pre-2000 = 0
- **Distribuție vechime președinte**: <2 ani = 1 (100%) · ≥2 ani = 0
