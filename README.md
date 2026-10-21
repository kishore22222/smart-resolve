# SmartResolve AI

A campus issue-management web app. Students and staff report problems
(broken projectors, leaky taps, lost-and-found, facilities faults), the system
routes each one to the right department, sets a consistent priority, and gives
everyone a status they can follow to resolution.

It is three cooperating services:

```
   React SPA (Vite)                Express REST API                 Python ML service
 ┌──────────────────┐          ┌────────────────────┐          ┌────────────────────┐
 │  localhost:5173  │  HTTP    │   localhost:5000   │  HTTP    │   localhost:8000   │
 │  reporter /      │ ───────▶ │  auth · issues ·   │ ───────▶ │  /classify         │
 │  staff / admin   │  JSON    │  users · reports   │  JSON    │  /similarity       │
 └──────────────────┘          └─────────┬──────────┘          └────────────────────┘
                                          │ Mongoose
                                          ▼
                                   ┌──────────────┐
                                   │   MongoDB     │
                                   └──────────────┘
```

The ML service is the **routing authority**: the department is derived from its
prediction. Reporters never pick a department. The API still works if the ML
service is down or slow — the issue is simply flagged `needsReview` for an
administrator to route, and duplicate detection is skipped.

## Repository layout

```
.
├─ client/         React + Vite single-page app (Tailwind CSS v4)
├─ server/         Express REST API (ES Modules)
├─ ml-service/     Flask + scikit-learn classifier / similarity service
├─ OPENCODE_FRONTEND_DESIGN.md   UI design plan and rationale
└─ .opencode/      Skills used while building this project
```

## Prerequisites

- Node.js 18+ (developed on Node 20)
- Python 3.11+ (developed on Python 3.14 with scikit-learn 1.8)
- MongoDB 6+ running locally, **or** a MongoDB Atlas connection string

## Quick start

Run the three services in three terminals. Start them in this order.

### 1. ML service

```bash
cd ml-service
python -m venv .venv
.venv\Scripts\activate          # Windows (use `source .venv/bin/activate` on macOS/Linux)
pip install -r requirements.txt
python train.py                 # writes artifacts/ (gitignored); prints held-out accuracy
python app.py                   # serves http://127.0.0.1:8000
```

### 2. API server

```bash
cd server
npm install
copy .env.example .env          # then edit .env (see Environment below)
npm run seed                    # optional: create an admin + sample staff
npm run dev                     # nodemon, serves http://localhost:5000
```

### 3. Client

```bash
cd client
npm install
copy .env.example .env          # VITE_API_BASE_URL=http://localhost:5000/api
npm run dev                     # serves http://localhost:5173
```

Open http://localhost:5173 and sign in with the seeded admin account (see
`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` in `server/.env`), or register a
reporter account.

## Environment

Both `server/.env` and `client/.env` are gitignored; only `*.env.example`
templates are committed. Do not commit real secrets.

`server/.env` keys (full list in `server/.env.example`):

| Key | Purpose |
| --- | --- |
| `MONGODB_URI` | Local Mongo URI or an Atlas `mongodb+srv://…` string |
| `JWT_SECRET` | Signing secret for auth tokens — use a long random value |
| `JWT_EXPIRES_IN` | Token lifetime (e.g. `8h`) |
| `CORS_ORIGINS` | Comma-separated allowed browser origins |
| `TRUST_PROXY` | `false` (default) or a number of trusted proxy hops — see [Rate limiting](#rate-limiting) |
| `RATE_LIMIT_WINDOW_MS` | Shared rate-limit window in ms (default `900000` = 15 min) |
| `RATE_LIMIT_LOGIN_MAX` | Login attempts per IP per window (default `10`) |
| `RATE_LIMIT_REGISTER_MAX` | Registrations per IP per window (default `5`) |
| `RATE_LIMIT_API_MAX` | General API requests per IP per window (default `100`) |
| `RATE_LIMIT_ISSUE_CREATE_MAX` | Issue creations per authenticated user per window (default `20`) |
| `ML_SERVICE_URL` | Base URL of the Flask service |
| `ML_TIMEOUT_MS` | Per-call timeout before ML is treated as unavailable |
| `ML_CONFIDENCE_THRESHOLD` | Below this, an issue is flagged for human review |
| `DUPLICATE_THRESHOLD` | Minimum cosine similarity to surface a duplicate |

`client/.env`:

| Key | Purpose |
| --- | --- |
| `VITE_API_BASE_URL` | Base URL of the Express API (browser-visible, no secrets) |

`ml-service` (optional; sensible defaults are used when unset):

| Key | Purpose |
| --- | --- |
| `ML_PORT` | Port the Flask service listens on (default `8000`; keep it in sync with `ML_SERVICE_URL` in `server/.env`) |
| `ML_HOST` | Interface the Flask dev server binds (default `127.0.0.1`; set `0.0.0.0` on deployment platforms) |

## Deployment

The three services deploy independently. Production request flow:

```
Browser ──▶ React SPA (static host) ──HTTPS──▶ Express API ──▶ MongoDB (Atlas)
                                                        └──▶ Flask ML service (private)
```

No service should point at another's `localhost` in production: the SPA reads
its API URL from `VITE_API_BASE_URL` at build time, and the API reads
`MONGODB_URI`, `ML_SERVICE_URL`, `CORS_ORIGINS`, and `JWT_SECRET` from the
hosting platform's environment settings (startup fails fast in production if
`MONGODB_URI`, `ML_SERVICE_URL`, or `JWT_SECRET` are missing/weak). ML calls
are bounded by `ML_TIMEOUT_MS` and any failure degrades to admin manual
review (`needsReview`) — the core workflow never depends on the ML service.

| Service | Directory | Install | Build | Start | Health |
| --- | --- | --- | --- | --- | --- |
| Frontend | `client/` | `npm ci` | `npm run build` (set `VITE_API_BASE_URL` to the deployed API) | static hosting of `client/dist/` | — |
| Backend | `server/` | `npm ci` | — | `npm start` (`node index.js`, Node 18+) | `GET /api/health` (never rate-limited) |
| ML service | `ml-service/` | `pip install -r requirements.txt` | `python train.py` (generates `artifacts/` from tracked `data/`) | `ML_HOST=0.0.0.0 python app.py` (port: `ML_PORT` or platform `PORT`) | `GET /health` |

Notes:

- The SPA uses `BrowserRouter`: the static host must rewrite all paths to
  `index.html` (e.g. Netlify `_redirects` `/* /index.html 200`, Vercel
  `rewrites` to `/index.html`).
- The ML service needs no public ingress; keep it on private
  service-to-service networking if the platform offers it, and allowlist only
  the backend in `CORS_ORIGINS` for browser traffic.
- Required platform env vars are documented in `server/.env.example` and
  `client/.env.example` (placeholders only; real values live in the platform's
  env settings, never in Git).
- Recommended order: MongoDB → ML service → backend (`npm run seed` once to
  provision the first admin) → frontend.

## Testing

```bash
# API: Jest (ESM) + supertest, 67 tests
cd server && npm test

# ML: pytest, 13 tests
cd ml-service && python -m pytest -q

# Client: Vitest + Testing Library
cd client && npm test
```

## API reference

All responses use the envelope `{ "data": … }` on success and
`{ "error": { "code", "message", "details?" } }` on failure.

| Method | Path | Who | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/health` | public | Liveness check |
| `POST` | `/api/auth/register` | public | Create a **reporter** account |
| `POST` | `/api/auth/login` | public | Obtain a JWT |
| `GET` | `/api/auth/me` | any | Current profile |
| `GET` | `/api/issues` | any (scoped) | List/filter issues (paged) |
| `POST` | `/api/issues` | reporter/admin | Create an issue |
| `GET` | `/api/issues/:id` | any (scoped) | Issue + viewer permissions |
| `POST` | `/api/issues/:id/follow-up` | any (scoped) | Add a note |
| `POST` | `/api/issues/:id/status` | staff/admin/reporter | Change status |
| `POST` | `/api/issues/:id/assign` | staff/admin | Assign to staff |
| `DELETE` | `/api/issues/:id` | reporter (own) | Soft-delete own issue (initial state only) |
| `PATCH` | `/api/issues/:id/department` | admin | Set/correct department (manual review) |
| `POST` | `/api/issues/:id/duplicate` | staff/admin | Mark as duplicate |
| `GET` | `/api/issues/:id/duplicates` | any (scoped) | Similarity suggestions |
| `GET` | `/api/users` | staff/admin | List accounts |
| `POST` | `/api/users/staff` | admin | Provision staff/admin |
| `PATCH` | `/api/users/:id` | admin | Update role / department / active |
| `GET` | `/api/dashboard/summary` | any (scoped) | Role-aware counters |
| `GET` | `/api/reports/summary` | admin | Aggregate reporting |

### Roles

- **reporter** — students/staff-with-a-problem. See only their own issues; can
  report new ones, reopen a resolved issue, and soft-delete one of their own
  issues while it is still in an initial (`SUBMITTED`/`TRIAGED`) state.
- **staff** — department queue. See issues routed to their department (plus any
  assigned directly to them); can assign, move status, and mark duplicates.
- **admin** — campus-wide view, user management, and reports.

### Issue lifecycle

```
SUBMITTED → TRIAGED → ASSIGNED → IN_PROGRESS → RESOLVED → CLOSED
                                    ▲               │
                                    └──── REOPENED ◀┘
```

Allowed next statuses depend on the current status and the actor's role, and
are enforced on the server. Every change is appended to the issue's history so
each issue has a full audit trail.

### Soft deletion

A reporter can remove an issue they no longer want to track, but only while they
still own it and it has not moved past the initial stage:

- **Who** — only a `reporter`, and only for their *own* issues. `staff` and
  `admin` requests receive `403`; the client never shows them a delete control.
- **When** — only while the issue is `SUBMITTED` or `TRIAGED` **and** unassigned.
  Assigned, in-progress, resolved, closed, and reopened issues are rejected with
  `409` (`ISSUE_NOT_DELETABLE`). The rule adapts the "initial / not yet actioned"
  intent to this app's actual statuses.
- **How** — deletion is *soft*: the issue is stamped with `archivedAt` /
  `archivedBy` and an `archived` history entry is appended, so the act stays
  auditable and recoverable (no user records or history are erased). Archived
  issues are filtered out of every ordinary query — lists, dashboard counters,
  reports, assignment queues, duplicate detection, and direct id lookups — so
  they can no longer be assigned, updated, reopened, or resolved.
- **Safety** — ownership and eligibility are checked server-side from the
  authenticated user and the stored issue (client-supplied `reporter`, `role`, or
  status is ignored), and the final write is a single conditional update so an
  issue that becomes assigned mid-request cannot be deleted.

### Rate limiting

Every limit is enforced server-side with `express-rate-limit` and is
configurable through the environment (see `server/.env.example`):

| Limit | Default | Keyed on | Applied to |
| --- | --- | --- | --- |
| Login | 10 / 15 min | client IP | `POST /api/auth/login`, **before** validation and bcrypt work |
| Registration | 5 / 15 min | client IP | `POST /api/auth/register` (separate counter from login) |
| General API | 100 / 15 min | client IP | every non-auth endpoint (`/api/issues`, `/api/users`, `/api/dashboard`, `/api/reports`, `/api/auth/me`) |
| Issue creation | 20 / 15 min | authenticated user id (from the verified JWT — never a client-supplied field) | `POST /api/issues`, after auth and before validation/classification |

Notes:

- Exceeding any limit returns **HTTP 429** with the standard error envelope
  `{ "error": { "code": "RATE_LIMITED", "message": "…" } }`, a `Retry-After`
  header, and draft-6 `RateLimit-*` headers on every counted response.
  Messages are generic and leak no credentials.
- Login and registration have independent counters, and auth routes are
  mounted ahead of the general limiter, so no request is ever charged to (or
  blocked by) two limiters at once.
- `GET /api/health` is always exempt so deployment monitoring keeps working
  even when a client has exhausted its quota.
- The window and all four limits are configurable via
  `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_LOGIN_MAX`, `RATE_LIMIT_REGISTER_MAX`,
  `RATE_LIMIT_API_MAX`, and `RATE_LIMIT_ISSUE_CREATE_MAX`. Invalid values
  fail fast at startup.
- **Reverse proxy:** if Express sits behind nginx/ALB/a CDN, set
  `TRUST_PROXY` to the number of trusted hops (e.g. `1`) so limits key on
  the real client IP from `X-Forwarded-For`. Leave it `false` when Express is
  directly exposed. `true` is deliberately rejected — trusting arbitrary
  forwarded headers lets attackers spoof IPs and bypass limiting.
- **Multi-instance deployments:** counters are in-memory and per-process.
  That is exact for a single instance; across N instances each client gets
  roughly N times the configured quota. For strict global limits, swap the
  store for a shared one (e.g. `rate-limit-redis`).

## How routing and priority work

1. **Priority** is deterministic and separate from classification — computed
   from keyword signals (urgency words, safety terms) so it is consistent and
   explainable. No ML output influences it.
2. **Routing** is driven by the ML classifier. The reporter does not choose a
   department (and any client-supplied `department`/`category` is rejected). The
   API validates the classifier's prediction against the supported departments
   and trusts it only when it is confident (above `ML_CONFIDENCE_THRESHOLD`).
   When the prediction is missing, unsupported, or below the threshold — or the
   ML service is unreachable — the issue is flagged `needsReview` and left
   unrouted for an administrator to assign. It is never silently routed to an
   arbitrary department. Corrections are recorded in the issue history.
3. **Duplicate detection** compares the new issue against recent ones using
   TF-IDF cosine similarity. Matches above `DUPLICATE_THRESHOLD` are shown to
   staff as *candidates* — the system never auto-merges issues.

## Machine learning service

- `ml_service/model.py` builds a TF-IDF + Multinomial Naive Bayes classifier
  over the labelled dataset in `ml-service/data/issues_dataset.csv` (98 examples
  across three departments).
- `train.py` trains, saves to `ml-service/artifacts/`, and prints **held-out
  accuracy**. On the included dataset that is roughly **0.76** — a small,
  honest dataset, not a benchmark result. The classifier is the routing
  authority, so low-confidence results are escalated to human review rather
  than guessed.
- The service exposes `POST /classify` and `POST /similarity` and has no auth of
  its own; keep it on loopback / an internal network.

## Design notes

The UI is a "campus work-order ledger": IBM Plex Sans for text, IBM Plex Mono
for identifiers, a left directory rail (a bottom tab bar on mobile), ledger
rows rather than a card wall, and a rotated rubber-stamp element for status —
the one deliberately bold element in an otherwise quiet interface. Full
rationale and wireframes are in `OPENCODE_FRONTEND_DESIGN.md`.

Styling is **Tailwind CSS v4**, wired in through the `@tailwindcss/vite` plugin.
The design tokens (palette, type scale, radii, shadow, motion) live in one place
— a Tailwind `@theme` block in `client/src/index.css` — so utilities such as
`bg-ink`, `text-graphite`, `text-h1`, `rounded` and `shadow-card` map directly to
the design system. Common UI elements (buttons, form fields, panels, status
stamps, tags, tables, the dialog, dashboard tiles) are reusable components under
`client/src/components/`; `client/src/index.css` holds only the token theme, a
base layer, and the three keyframes the design genuinely needs (`stamp-in`,
`shimmer`, `spinner`). Keyboard focus, AA contrast, and `prefers-reduced-motion`
are handled globally in that base layer.

## Limitations

- The ML dataset is small and synthetic; the classifier is deliberately
  conservative and flags low-confidence issues for human review instead of
  guessing a department.
- Duplicate detection is lexical (TF-IDF cosine), not semantic embeddings.
- There is no email/push notification; users check the app for updates.
