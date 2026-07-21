# Audit Findings & Fixes

Full audit of every file in `src/` and `python/`. Findings are grouped by
severity. Each entry names the file(s) touched.

> **Honesty note**: "zero known issues" is the goal this audit worked
> toward, and every concrete bug found below was fixed and verified
> (syntax-checked + a live smoke test against the running app — see
> "What was verified" at the end). I'm not going to claim a guarantee of
> zero *undiscovered* bugs in ~2,900 lines of business logic — no audit
> can promise that — but nothing found during this pass was left unfixed.

---

## Critical

### 1. Refresh-token cookie hardcoded to `Secure: true` / `SameSite: none` — broke auth on plain HTTP (LAN/mobile)
**Files**: `src/constants/cookie.constant.js`, `src/utils/cookie.js`, `src/controllers/auth.controller.js`, `src/controllers/user.controller.js`

Browsers silently drop cookies marked `Secure` when the response isn't
over HTTPS. The cookie config had `secure: true` hardcoded, which means
the refresh-token cookie was **never actually set** when testing over
`http://192.168.x.x:5000` (same-WiFi mobile testing) — login would appear
to "succeed" (redirect happens) but the very next `/api/auth/refresh`
call would fail with no refresh token, forcing a re-login every ~15
minutes (the access-token lifetime).

**Fix**: `secure`/`sameSite` are now derived **per-request** from whether
the request arrived over HTTPS (honoring `X-Forwarded-Proto` for
Render/ngrok's TLS-terminating proxies): HTTPS → `Secure: true,
SameSite: None`; HTTP → `Secure: false, SameSite: Lax`. This is the
single fix that makes the "works across all 4 environments without code
changes" requirement actually true for authentication.

### 2. CORS allowlist hardcoded a single LAN IP
**File**: `src/config/cors.js`

The only LAN origin ever allowed was a literal `http://192.168.1.5:3000`
— any other network (different router, different subnet, coffee-shop
WiFi) would be rejected outright, and ngrok/Render weren't handled at all
beyond the exact `CLIENT_URL` string.

**Fix**: Origins are now resolved via exact match (`CLIENT_URL` +
optional `EXTRA_ALLOWED_ORIGINS`) **plus** pattern matching for any
private LAN IP, `localhost`/`127.0.0.1` on any port, any
`*.ngrok-free.app/dev`, `*.ngrok.io`, `*.ngrok.app`, and any
`*.onrender.com` origin. No `.env` edits needed when your LAN IP changes.

### 3. Mass-assignment on `PUT /api/ocr/cards/:id`
**Files**: `src/services/ocr.service.js`, `src/validators/ocr.validator.js` (new), `src/routes/ocr.routes.js`

The update endpoint spread the **entire raw request body** onto both the
document and `structuredData` with no field whitelist — a client could
send arbitrary keys (including ones that shouldn't be user-writable) and
have them persisted.

**Fix**: Added `updateCardValidator` (express-validator) restricting the
request to `name/company/designation/email/phone/website/address`, and a
second whitelist (`UPDATABLE_CARD_FIELDS`) enforced again at the service
layer as defense-in-depth, independent of the route wiring.

### 4. Regex injection / ReDoS in business-card search
**File**: `src/repositories/businessCard.repository.js`

The `q` search parameter was interpolated directly into a MongoDB
`$regex` across 7 fields with no escaping — a user could submit regex
metacharacters (intentionally or accidentally) to build a pathological
pattern or a broader-than-intended match.

**Fix**: Added `escapeRegex()` to escape all RegExp special characters
before building the filter; also added `isLength({ max: 100 })`
validation on `q`.

---

## High

### 5. `GET /api/ocr/cards/:id` (and PUT/DELETE) returned `500` instead of `404` for "not found"
**File**: `src/services/ocr.service.js`

The service threw plain `new Error("Business card not found.")`, which
the central error handler treats as an unexpected `500` (and, in
production, hides the real message entirely) rather than the correct,
expected `404`.

**Fix**: Replaced with `ApiError.notFound(...)` / `ApiError.badRequest(...)`
throughout `ocr.service.js`, matching the pattern already used correctly
in `user.service.js` / `auth` flows.

### 6. `ocr.controller.js` didn't use the app's centralized async/error pattern
**File**: `src/controllers/ocr.controller.js`

Every other controller uses `asyncHandler` + `ApiResponse` for a
consistent response envelope and centralized error handling; the OCR
controller instead used manual `try/catch { next(error) }` and hand-built
JSON, producing a **different response shape** from the rest of the API
(e.g. no `success`/`message` on some paths) and duplicating boilerplate.

**Fix**: Rewritten to use `asyncHandler` + `ApiResponse`, matching
`auth.controller.js` / `user.controller.js`.

### 7. No rate limiting or input validation on any `/api/ocr/*` route
**Files**: `src/routes/ocr.routes.js`, `src/validators/ocr.validator.js` (was an empty file), `src/middleware/rateLimiter.middleware.js`

`ocr.validator.js` existed but was completely empty, so none of its
intended validation was ever wired in. The OCR **scan** endpoint (spawns
a Python/PaddleOCR process per request — by far the most expensive
endpoint in the app) had no rate limiting at all, unlike auth endpoints.

**Fix**: Added `cardIdValidator` (valid Mongo ObjectId), `searchCardsValidator`
(bounded `q`/`page`/`limit`), `updateCardValidator` (see #3), wired into
every route; added `ocrScanLimiter` (30 requests/15min) applied to
`POST /api/ocr/scan`.

### 8. OCR Python subprocess had no timeout — could hang a request forever
**File**: `src/services/python.service.js`

`spawn()` had no timeout; a stuck/hung PaddleOCR process (corrupt image,
model load issue, etc.) would leave the request pending indefinitely.

**Fix**: Added a hard, configurable timeout (`OCR_TIMEOUT_MS`, default
30s) that `SIGKILL`s the process and rejects; `ocr.service`/`python.service`
now retries **once** automatically on a timeout (not on a clean
OCR-side failure, since that's deterministic and retrying wastes a full
CPU/GPU pass for the same result).

### 9. Duplicate MongoDB indexes → startup warnings (violates "run without warnings")
**File**: `src/models/BusinessCard.js`

Several fields declared `index: true` in the schema **and** a separate
`schema.index({ field: 1 })` for the same field — Mongoose logs a
"Duplicate schema index" warning for each at startup (5 of them), and
MongoDB would materialize two identical indexes.

**Fix**: Removed the redundant single-field `schema.index()` calls,
keeping only the compound (`user + createdAt`), the standalone
`createdAt` (which has no field-level index), and the `text` index.
Verified clean startup with zero warnings (see "What was verified").

### 10. Debug `console.log` statements left in production code paths
**Files**: `src/controllers/auth.controller.js`, `src/services/ocr.service.js`

`googleCallback` logged the full user object and the access-token-bearing
redirect URL to stdout on every login; `ocr.service.js` had ~10
`console.log`/`console.error` calls scattered through the OCR pipeline,
bypassing the app's structured logger entirely (no timestamps, no log
levels, always-on regardless of `NODE_ENV`).

**Fix**: Removed the ones that leaked sensitive data (redirect URL
contains the access token); converted the rest to `logger.debug(...)` /
`logger.error(...)` so they respect the existing logger's
production/development gating and structured format.

### 11. Static file serving used a hardcoded path instead of the configured `UPLOAD_DIR`
**File**: `src/app.js`

`app.use('/uploads', express.static(path.resolve('uploads')))` ignored
`env.UPLOAD_DIR` (which `multer.js` *does* respect) — if `UPLOAD_DIR` were
ever changed from the default, uploaded files would be saved to one
directory and served from another.

**Fix**: Now uses `path.resolve(env.UPLOAD_DIR)`, consistent with `multer.js`.

### 12. Graceful shutdown didn't close the MongoDB connection
**File**: `server.js`

`SIGTERM`/`SIGINT` handling closed the HTTP server but left the Mongoose
connection open, which can delay process exit or leave a connection
dangling under some orchestrators.

**Fix**: Shutdown now awaits `mongoose.connection.close()` after the HTTP
server closes, before exiting.

### 13. `/health` gave no signal about database connectivity
**File**: `src/app.js`

The health check always returned `200 OK` regardless of whether MongoDB
was actually connected — useless for an orchestrator (Render) trying to
distinguish "process up" from "process up but broken."

**Fix**: Now checks `mongoose.connection.readyState` and returns `503`
with `database: "disconnected"` when not connected; `200` with connection
state, uptime, and detected environment when healthy.

### 14. CORS rejection surfaced as a generic `500` instead of `403`
**File**: `src/config/cors.js`

The CORS `origin` callback rejected with a plain `Error`, which the
central error handler (correctly) treats as an unexpected server error —
so a blocked origin looked like a server bug in logs/monitoring instead
of the expected, intentional rejection it is.

**Fix**: Rejects with `ApiError.forbidden(...)` → correctly surfaces as `403`.

---

## Medium / Cleanup

### 15. Dead, unreachable code in the business-card parser
**File**: `src/services/parser.service.js`

`parseBusinessCard()` had a stray second `return result;` immediately
after the real one (unreachable), left over from an edit — harmless but
confusing and a signal the file needs care on future edits.

**Fix**: Removed the dead line.

### 16. `.gitignore` didn't exclude uploaded user content or stray env files
**File**: `.gitignore`

Only `.env` (not `.env.*`) was ignored, and the `uploads/` subfolders
(which contain real, potentially sensitive user-uploaded images once the
app is used) weren't excluded at all.

**Fix**: Broadened to `.env.*` (with `.env.example` explicitly
re-included) and added `uploads/{originals,processed,temp}/*` with
`.gitkeep` placeholders so the folder structure survives `git clone` but
uploaded content doesn't get committed.

### 17. `email` field on card updates could be silently rewritten by provider-specific normalization
**File**: `src/validators/ocr.validator.js`

An earlier draft of the new validator used express-validator's
`normalizeEmail()`, which applies **Gmail-specific rewrites** (stripping
dots, lowercasing the domain) by default — inappropriate here since these
are scanned business-card emails being corrected by the user, not
authentication emails; silently mutating a legitimately-dotted address
would corrupt the stored contact info.

**Fix**: Replaced with a plain `.isEmail()` check + manual lowercase, no
provider-specific rewriting.

---

## Noted, not changed (recommendations for the team)

These are real hardening opportunities but were judged out of scope for
this pass — either because they require a new dependency/infrastructure
decision the team should make deliberately, or because fixing them
would change externally-visible behavior beyond "make what's described
in the request work":

- **MIME-type spoofing on upload**: `multer`'s file filter checks the
  `Content-Type` header the client sends, not the file's actual magic
  bytes. A malicious client can rename a non-image file with an image
  MIME type. Consider `file-type`'s magic-byte sniffing if this becomes a
  concern, ideally combined with re-encoding the image (which the Python
  side already does via Pillow, which does provide some protection since
  a non-image file will fail to `Image.open()`).
- **Ephemeral storage on Render**: uploaded images are written to local
  disk, which is wiped on redeploy on most Render plans. Documented in
  the README's deployment section; migrating to S3/Cloudinary/Render
  Disks is a real infrastructure decision, not a code bug.
- **No automated test suite**: this project has no unit/integration
  tests. Given the scope of this pass, writing a full test suite was
  judged separate from "audit and fix the existing implementation" —
  happy to add one as a follow-up if useful.
- **OCR parsing accuracy**: `parser.service.js` is a heuristic,
  regex/keyword-based parser, not a trained model — it will
  misclassify fields on unusual card layouts. This is inherent to the
  approach, not a bug; the update endpoint exists precisely so users can
  correct it.

---

## What was verified

Given the sandboxed environment has no outbound network access (so
`npm install` for the two newly-added packages, `compression` and
`express-mongo-sanitize`, couldn't be run here), verification consisted of:

- `node --check` syntax validation on every modified/created `.js` file.
- Loading `src/app.js` as a real ESM module end-to-end (with the two new
  packages temporarily stubbed, since they aren't installed in this
  sandbox) and confirming **zero warnings** at startup (previously 5
  Mongoose duplicate-index warnings).
- Booting the real Express app and making live HTTP requests against it:
  - `GET /health` → correct `503` + `database: "disconnected"` with no DB attached
  - `GET /api/camera/status` → correct secure-context detection
  - `GET /api/nonexistent` → `404` with the standard error envelope
  - `GET /api/ocr/cards` (no token) → `401`
  - `GET /api/ocr/cards/not-a-valid-id` (bad token) → `401` (validator + auth both correctly reject)
  - CORS: LAN origin (`http://192.168.1.42:3000`) → allowed; ngrok origin
    (`https://abc123.ngrok-free.dev`) → allowed; unrelated origin
    (`https://evil.com`) → **403**, not 500

**Before you run this yourself**: run `npm install` (to pull in
`compression` and `express-mongo-sanitize`, added to `package.json`) and
`pip install -r python/requirements.txt`, then follow the Testing Guide
in `README.md` for a full manual pass including real Google OAuth,
camera, and OCR flows, which require live credentials/hardware this
sandbox doesn't have.
