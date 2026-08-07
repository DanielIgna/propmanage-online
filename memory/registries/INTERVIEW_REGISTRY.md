# INTERVIEW REGISTRY

**Artifact Type**: REGISTRY
**Owner**: Fondator (danieligna1@gmail.com)
**Last Review**: 2026-02-06
**Schema**: InterviewID · Date · AssociationBloc · YearBuilt · Apartments · PresidentTenure · Status · FilePath
**Purpose**: Sursă unică de adevăr pentru interviurile validate în cadrul BOARD_DIRECTIVE_RESEARCH_DRIVEN_EVOLUTION. Enumeră cronologic toate interviurile, cu tracking coverage + progres către target Fondator (15-20).

> Reguli: (1) intrare adăugată doar la status `Validated`; (2) FilePath obligatoriu; (3) fiecare interviu contribuie la PATTERN_REGISTRY (fie confirmă existente, fie emite noi); (4) target 15-20 Validated → dezghețare Feature Freeze.

## Schema Fields

| Field | Description |
|---|---|
| InterviewID | Cod unic (AP-NNN pentru Association President). |
| Date | ISO date. |
| AssociationBloc | Denumire scurtă. |
| YearBuilt | An construcție. |
| Apartments | Nr. apartamente. |
| PresidentTenure | Vechime președinte declarată. |
| Status | Validated · Pending · Rejected. |
| FilePath | Cale relativă. |

## Entries

| InterviewID | Date | AssociationBloc | YearBuilt | Apartments | PresidentTenure | Status | FilePath |
|---|---|---|---|---|---|---|---|
| AP-002 | 2026-02-06 | Mehedinți (P+4, 2 scări) | 1976 | 20 | 40+ ani | Validated | memory/audits/INTERVIEW_2026-02-06_MEHEDINTI-ILIE.md |
| AP-003 | 2026-02-06 | Negoiu 8D | 2006 | 13 | ~1 an | Validated | memory/audits/INTERVIEW_2026-02-06_NEGOIU-8D.md |

## Research Analytics (Coverage Metrics)

- **Total Validated Interviews**: **2** / 15-20 target Fondator
- **Progress**: 10-13%
- **Feature Freeze**: ACTIV (dezghețare la target atins + ≥1 Validated Pattern Candidate)

### Distribuție pe anul construcției
- **Pre-1990**: 1 (50%) — AP-002 (1976)
- **1990-2000**: 0
- **Post-2000**: 1 (50%) — AP-003 (2006)
- **Diversitate cohort**: BUNĂ (până acum)

### Distribuție pe nr. apartamente
- **≤15 apts**: 1 — AP-003 (13)
- **16-30 apts**: 1 — AP-002 (20)
- **>30 apts**: 0

### Distribuție pe vechime președinte
- **<2 ani**: 1 (50%) — AP-003 (~1 an)
- **2-10 ani**: 0
- **>10 ani**: 1 (50%) — AP-002 (40+ ani)
- **Extreme reprezentate; median gap**.

### Distribuție pe profesie / tip persoană
- **Fost cadru academic / economist**: 1 (AP-002)
- **N/A**: 1 (AP-003)

### Localitate
- **N/A pentru ambele** (neîncheiată — GAP de umplut la interviurile viitoare)

## Next Interview Recommendation

Pentru diversificare optimă cohort la AP-004:
- **Bloc mid-life** (1990-2000, un „missing" în cohort)
- **Bloc mai mare** (>30 apartamente)
- **Președinte cu vechime medie** (2-10 ani)
- **Localitate specificată** (Bucuresti sector / oraș secundar)
