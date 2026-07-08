# PropManage — QA Bug Tracker

Format: `BUG #NNN – Titlu` · Status: `Open` | `In Progress` | `Fixed (verificare pending)` | `Closed`

---

## BUG #001 – Text invizibil în input-uri Client V2 (contrast alb pe alb)
- **Status:** Closed
- **Cauză:** Overlay global dark theme peste input-urile V2.
- **Fix:** Override CSS global în `/app/frontend/src/index.css` (Faza 5 UX Refinement).
- **Fișiere:** `frontend/src/index.css`, `frontend/src/pages/clientv2/*`
- **Verificat de user:** ✅

## BUG #002 – Cursor săre la început în input numeric "Buget estimat (RON)"
- **Status:** Fixed (verificare pending user)
- **Simptom:** Utilizatorul scria `250` dar primea `0250`, cursorul repoziționat forțat la începutul câmpului.
- **Cauză root:**
  1. `budget_estimate` era stocat ca **număr** în state, iar `onChange` făcea `parseFloat(e.target.value) || 0` pe fiecare tastă.
  2. `|| 0` forța valoarea la `0` când user ștergea câmpul → afișa "0" → orice tastare producea "02", "025", "0250".
  3. `parseFloat` normaliza valoarea la fiecare tastă (ex: "0250" → 250) → React re-randează cu string nou → browser resetează caret position.
- **Fix aplicat:** State controlat ca **string** în timpul editării, `parseFloat` doar la submit (același pattern ca `WalletSheet` care nu are bug). Adăugat `inputMode="numeric"` pentru keyboard mobil optim.
- **Fișiere modificate:**
  - `frontend/src/pages/clientv2/RequestWizard.jsx` (linia 17: `budget_estimate: "200"`; linii 24, 89-91)
- **Verificat de user:** ⏳
- **Alte input-uri numerice audit-uite:**
  - `PropertyHubV2.jsx` (Wallet topup): ✅ deja folosea string state — no fix needed.
  - Nu există alte `type="number"` în Client V2.

---

## Backlog Open (pre-existing)
- **BUG #003 – Resend Custom Domain DNS** — Status: Blocked (user action pe registrar DKIM/SPF)
- **BUG #004 – Restore icon lipsă pentru marketplace partners terminate** — Status: Open (P2)
