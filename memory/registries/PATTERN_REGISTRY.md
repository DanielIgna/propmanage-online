# PATTERN REGISTRY

**Artifact Type**: REGISTRY
**Owner**: Fondator (danieligna1@gmail.com)
**Last Review**: 2026-02-06
**Schema**: PatternID · Description · Confirmations · Maturity · EvidenceInterviews · Confidence · ConflictingEvidence · Recommendation
**Purpose**: Sursa unică de adevăr pentru pattern-urile emise din interviurile de research. Fiecare pattern se maturizează pe măsură ce acumulează confirmări (Observation → Emerging → Validated → High Confidence).

> Reguli metodologice: (1) 1 conf = Observation, 2 = Emerging, 3-4 = Validated Pattern Candidate, 5+ = High Confidence · (2) niciun feature de produs nu se implementează sub Validated · (3) contradicțiile NU șterg pattern-ul, doar marchează `ConflictingEvidence`.

## Schema Fields

| Field | Description |
|---|---|
| PatternID | Cod unic (P-NNN). |
| Description | Fraza-rezumat (≤120 caractere). |
| Confirmations | Număr total de interviuri care confirmă pattern-ul. |
| Maturity | Observation · Emerging Pattern · Validated Pattern Candidate · High Confidence Pattern. |
| EvidenceInterviews | Listă separată prin virgulă de InterviewID-uri care confirmă. |
| Confidence | Low · Medium · High. |
| ConflictingEvidence | InterviewID-urile care contrazic pattern-ul (dacă există). |
| Recommendation | Product / Research / None (blocat până la Validated). |

## Entries

| PatternID | Description | Confirmations | Maturity | EvidenceInterviews | Confidence | ConflictingEvidence | Recommendation |
|---|---|---|---|---|---|---|---|
| P-001 | Infrastructure aging in post-2000 buildings | 1 | Observation | AP-003 | Low | — | Research: verify in future interviews |
| P-002 | Unstandardized president succession | 1 | Observation | AP-003 | Low | — | Research: ask succession process |
| P-003 | WhatsApp as primary communication channel | 1 | Observation | AP-003 | Low | — | Research: confirm channel without prompting |
| P-004 | Preventive maintenance preferred over reactive | 1 | Observation | AP-003 | Low | — | Research: classify priorities preventive/reactive |
| P-005 | Incident tracking absent | 1 | Observation | AP-003 | Low | — | Research: ask about issue-recurrence tracking |
| P-006 | Individual water metering requested | 1 | Observation | AP-003 | Low | — | Research: verify frequency + motivation |
| P-007 | Safety equipment gaps triggered by prior incidents | 1 | Observation | AP-003 | Low | — | Research: ask trigger for PSI investments |

## Maturity Summary

- **Observation (1 conf)**: 7 patterns
- **Emerging Pattern (2 conf)**: 0
- **Validated Pattern Candidate (3-4 conf)**: 0
- **High Confidence Pattern (5+ conf)**: 0
- **Conflicting Evidence**: 0
- **Approved for Product Blueprint**: 0 (blocked — nothing beyond Observation)
