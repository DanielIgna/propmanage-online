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
- **Status:** Closed ✅ (verificat de agent cu playwright: tastare `35000` → `35.000`, append `9` → `350.009`, caret stabil)
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

## ENH #001 – Formatare live cu separator de mii pe input-uri de sumă (Revolut-style)
- **Status:** Closed ✅ (verificat de agent cu playwright — formatare live corectă, caret păstrat)
- **Cerință:** Ex: user tastează `35000` → afișează `35.000` live, cu caret păstrat la locul corect.
- **Implementare:**
  - Nouă componentă `AmountInput` în `frontend/src/pages/clientv2/ui.jsx`.
  - Stochează raw digits (string) în state parent; afișează formatat cu `Intl.NumberFormat("ro-RO")`.
  - Restaurează caret position după fiecare re-format prin `useLayoutEffect` (numără cifrele înaintea caret-ului).
  - Optional prop `suffix` pentru ex: "RON" inline.
- **Aplicat în:**
  - `RequestWizard.jsx` — câmp "Buget estimat (RON)".
  - `PropertyHubV2.jsx` (WalletSheet) — câmp "Altă sumă (RON)".
- **Payload backend:** Neschimbat. `parseFloat("35000")` → `35000` (număr) la submit.

---

## Backlog Open (pre-existing)
- **BUG #003 – Resend Custom Domain DNS** — Status: Blocked (user action pe registrar DKIM/SPF)
- **BUG #004 – Restore icon lipsă pentru marketplace partners terminate** — Status: Closed ✅ (buton RotateCcw `restore-{id}` în MarketplacePartnersPage → PATCH status=active; testat E2E iter86)
