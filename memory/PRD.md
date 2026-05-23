# PropManage - Property Operating System (Full E2E)

## Original Problem Statement
Continuare: Photo upload pentru request evidence, Reviews UI complete flow, Email/Push notifications (SendGrid), Specialist profile pages publice, Property CRUD multi-property.

## Architecture
- **Frontend**: React 19 + Tailwind + Framer Motion + react-router-dom + WebSocket + base64 file upload
- **Backend**: FastAPI + MongoDB + JWT cookies + bcrypt + Stripe + WebSocket + httpx (Emergent OAuth + SendGrid)
- **4 user roles**: client, specialist, admin, operator
- **Auth methods**: Email/password (JWT), Google OAuth (Emergent), Demo quick-login

## What's Implemented

### Phase 1 (Landing)
- 10-section premium landing page with auto-play User Journey, bilingual RO/EN

### Phase 2 (Auth + Marketplace) - 36/36 tests ✅
- JWT auth, 5 demo accounts, 4 role dashboards
- Full marketplace flow: create → accept (45 RON) → start → complete → confirm
- Escrow logic, tokens, property health scoring

### Phase 3 (Integrations) - 20/23 tests ✅
- Google OAuth via Emergent
- Stripe Checkout (with demo-mode fallback)
- WebSocket real-time chat
- Extended bilingual landing coverage

### Phase 4 (UX Completeness) - 19/19 tests ✅
- ✅ **Photo upload**: base64 data URLs in request.photos (max 5 per request, 2MB each), client-side preview
- ✅ **Reviews UI**: Star rating + comment modal, auto-opens after confirm, +20 tokens, updates specialist rating
- ✅ **SendGrid notifications**: With graceful fallback to db.email_log when key missing. Triggers on key events
- ✅ **Specialist public profiles** (`/specialists/:id`): Public route, no auth, rating/reviews/specialties/portfolio
- ✅ **Property CRUD**: PUT/DELETE endpoints, multi-property selector in client dashboard, block delete on active requests
- ✅ **Notifications Bell**: In-app notifications panel (top-right) with badge count, 15s polling, mark-as-read

## Files (Frontend)
- /app/frontend/src/App.js - Landing + router
- /app/frontend/src/auth.js - AuthContext
- /app/frontend/src/i18n.js - RO/EN translations  
- /app/frontend/src/pages/Auth.jsx - Login + Register + Google
- /app/frontend/src/pages/AuthCallback.jsx - Emergent OAuth handler
- /app/frontend/src/pages/Dashboards.jsx - 4 role dashboards + NotificationsBell
- /app/frontend/src/pages/ChatPanel.jsx - WebSocket real-time chat
- /app/frontend/src/pages/Components.jsx - PhotoUploader + ReviewModal + PropertyManagerModal
- /app/frontend/src/pages/SpecialistProfile.jsx - Public specialist profile

## Files (Backend)
- /app/backend/server.py - All endpoints (~800 lines)
- /app/backend/.env - Secrets

## API Endpoints (Complete List)
**Auth**: POST /api/auth/{login,register,logout,google/session}, GET /api/auth/{me,ws-token}
**Properties**: GET/POST /api/properties, GET/PUT/DELETE /api/properties/{id}
**Requests**: GET/POST /api/requests, GET /api/requests/{id}
**Specialist actions**: POST /api/requests/{id}/{accept,start,complete}
**Client actions**: POST /api/requests/{id}/{escrow,confirm,review}
**Specialists**: GET /api/specialists, GET /api/specialists/{id}/profile
**Wallet**: GET /api/transactions, POST /api/wallet/topup
**Payments**: POST /api/payments/checkout-session, GET /api/payments/status/{id}
**Admin**: GET /api/admin/{stats,specialists/pending,disputes}, POST /api/admin/specialists/{id}/verify
**Operator**: GET /api/operator/queue, POST /api/operator/logs/{id}/validate
**Chat**: GET /api/chat/{request_id}/messages, WS /api/ws/chat/{request_id}
**Notifications**: GET /api/notifications, POST /api/notifications/{id}/read

## Demo Accounts (Pre-seeded, idempotent)
- Client: client@propmanage.io / Client123!
- Specialist (HVAC): specialist@propmanage.io / Spec123!
- Specialist (Plumbing): specialist2@propmanage.io / Spec123!
- Admin: admin@propmanage.io / Admin123!
- Operator: operator@propmanage.io / Op123!

## SendGrid Setup (For Real Emails)
1. Sign up at sendgrid.com (free, 100 emails/day)
2. Create API key with Mail Send permission
3. Verify a sender email (Settings → Sender Authentication)
4. Add to /app/backend/.env:
   ```
   SENDGRID_API_KEY="SG.xxxxxxxxxxxx"
   SENDGRID_SENDER="noreply@yourdomain.com"
   ```
5. Restart backend: `sudo supervisorctl restart backend`
Without these, system uses demo mode (logs to db.email_log).

## P1 Backlog
- Two-factor auth (2FA)
- Stripe Connect for direct specialist payouts
- Public specialist marketplace page (`/marketplace`)
- Search & filters on requests
- Mobile responsive polish
- Property timeline view (all interventions chronologically)

## P2 Future
- IoT live telemetry integration
- LiDAR/3D scanning workflow
- AI-powered specialist matching (Claude/Gemini)
- Mobile native apps (React Native)
- White-label for property managers
- Multi-tenant SaaS
