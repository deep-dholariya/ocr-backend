# Business Card Scanner — Backend

A production-hardened Node.js/Express backend providing Google OAuth 2.0
authentication (JWT access/refresh tokens with rotation), business-card
image upload + OCR (PaddleOCR via a standalone Python HTTP service), and
structured data extraction and search.

> **Deployment architecture**: this backend now runs as one of two
> independently deployable services — this Node.js API, and a separate
> `python-service/` project that exposes PaddleOCR over HTTP. See
> [`RENDER_DEPLOYMENT.md`](../RENDER_DEPLOYMENT.md) at the repo root for
> full deployment instructions for both.

Designed to run **unchanged in code** across four environments:

| Environment | Example URL |
|---|---|
| Localhost | `http://localhost:5000` |
| Same-WiFi (PC ↔ Mobile) | `http://192.168.x.x:5000` |
| ngrok (HTTPS tunnel) | `https://your-subdomain.ngrok-free.dev` |
| Render (production) | `https://your-app.onrender.com` |

Switching between them is a **`.env` change only** — see
["Environment Support"](#environment-support) below for exactly how.

---

## 1. Project Overview

- **Runtime**: Node.js ≥ 18, Express 4, ESM (`"type": "module"`)
- **Database**: MongoDB via Mongoose
- **Auth**: Google OAuth 2.0 (Passport) → application JWTs (access + refresh,
  with refresh-token rotation and reuse detection)
- **OCR**: Images are sent over HTTP to a separate Python OCR service
  (`PYTHON_API_URL`, see the sibling `python-service/` project) running
  PaddleOCR; extracted text is parsed into structured fields (name, company,
  designation, email, phone, website, address) by `parser.service.js`.
- **Architecture**: layered — `routes → controllers → services → repositories → models`,
  with `validators/` and `middleware/` cross-cutting each layer.

## 2. Folder Structure

```
backend/
├── server.js                  # Entry point: connects DB, starts HTTP server, graceful shutdown
├── package.json
├── .env.example                # Copy to .env and fill in
├── uploads/
│   ├── originals/               # Uploaded business card images
│   ├── processed/
│   └── temp/
└── src/
    ├── app.js                   # Express app: middleware, routes, error handling
    ├── config/                  # env, database, cors, multer, passport
    ├── constants/                # cookie / jwt / message constants
    ├── controllers/              # HTTP layer (thin — no business logic)
    ├── middleware/                # auth, error, rate-limit, upload, validate
    ├── models/                    # Mongoose schemas: User, RefreshToken, BusinessCard
    ├── repositories/               # All direct DB access lives here
    ├── routes/                      # Route definitions per resource
    ├── services/                     # Business logic
    ├── utils/                         # ApiError, ApiResponse, jwt, cookie, logger, environment
    └── validators/                     # express-validator chains
```

## 3. Installation Steps

```bash
cd backend
npm install
cp .env.example .env
# edit .env with your MongoDB URI, Google OAuth credentials, JWT secrets,
# and PYTHON_API_URL (pointing at the python-service — see below)

npm run dev      # nodemon, auto-restart
# or
npm start        # production
```

The Python OCR service is a separate project (`../python-service/`) that
must be running and reachable at `PYTHON_API_URL` — see its own README /
[`RENDER_DEPLOYMENT.md`](../RENDER_DEPLOYMENT.md) for setup.

Server starts on `PORT` (default `5000`) and refuses to start if any
required environment variable is missing (see `src/config/env.js`).

## 4. Environment Variables

See `.env.example` for the full, commented list. Summary:

| Variable | Required | Purpose |
|---|---|---|
| `NODE_ENV` | no (default `development`) | `production` enables stricter checks |
| `PORT` | no (default `5000`) | HTTP port |
| `SERVER_URL` | no | Logged on startup only |
| `CLIENT_URL` | **yes** | Primary allowed frontend origin (see CORS below) |
| `EXTRA_ALLOWED_ORIGINS` | no | Comma-separated extra exact CORS origins |
| `MONGODB_URI` | **yes** | MongoDB connection string |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | **yes** | Google OAuth app credentials |
| `GOOGLE_CALLBACK_URL` | **yes** | Must match a URI registered in Google Cloud Console |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | **yes** | Long random strings (`openssl rand -hex 64`) |
| `JWT_ACCESS_EXPIRY` / `JWT_REFRESH_EXPIRY` | no | Default `15m` / `7d` |
| `COOKIE_DOMAIN` | no | Only set if frontend + API share a parent domain |
| `PYTHON_API_URL` | **yes** | Base URL of the Python OCR service, e.g. `http://localhost:5001` or `https://<python-service>.onrender.com` |
| `OCR_TIMEOUT_MS` | no (default `30000`) | Hard timeout per OCR request |
| `UPLOAD_DIR` | no (default `uploads`) | Where images are stored |
| `MAX_FILE_SIZE` | no (default `10485760` = 10MB) | Upload size limit |

In production, the app refuses to start if `JWT_ACCESS_SECRET` /
`JWT_REFRESH_SECRET` are still the placeholder values from `.env.example`.

## 5. Required Packages

Node (see `package.json`): `express`, `mongoose`, `passport` +
`passport-google-oauth20`, `jsonwebtoken`, `multer`, `helmet`, `cors`,
`compression`, `express-mongo-sanitize`, `express-rate-limit`,
`express-validator`, `cookie-parser`, `dotenv`. Dev: `nodemon`. HTTP
calls to the Python OCR service use Node's built-in `fetch`/`FormData`
(no new HTTP client dependency needed).

Python OCR service dependencies now live in the separate
`python-service/requirements.txt`: `paddleocr`, `paddlepaddle`,
`opencv-python`, `numpy`, `Pillow`, `pillow-heif` (HEIC/HEIF support),
plus `flask` + `gunicorn` for the HTTP layer.

## 6. API Documentation

Full endpoint-by-endpoint reference (method, body, headers, responses) is
in **[`API_REFERENCE.md`](./API_REFERENCE.md)**, including the
route → controller → service → middleware → database traceability table.

Quick index:

```
GET    /health                      Liveness/readiness probe
GET    /api/camera/status           Camera / secure-context diagnostics
POST   /api/camera/report           Client reports real getUserMedia() outcome

GET    /api/auth/google             Start Google OAuth flow
GET    /api/auth/google/callback    OAuth callback → issues JWTs, redirects to frontend
POST   /api/auth/refresh            Rotate refresh token → new access token
POST   /api/auth/logout             Revoke refresh token
GET    /api/auth/me                 Current user profile          [auth required]

GET    /api/user/profile            Get profile                   [auth required]
PATCH  /api/user/profile            Update name/picture            [auth required]
DELETE /api/user/account            Delete account + revoke sessions [auth required]

POST   /api/ocr/scan                Upload + OCR a business card    [auth required]
GET    /api/ocr/cards               List all of the user's cards    [auth required]
GET    /api/ocr/cards/search        Search cards (q, page, limit)    [auth required]
GET    /api/ocr/cards/:id           Get one card                     [auth required]
PUT    /api/ocr/cards/:id           Update a card's fields            [auth required]
DELETE /api/ocr/cards/:id           Delete a card                      [auth required]
```

## 7. Authentication Flow

1. Frontend redirects the browser to `GET /api/auth/google`.
2. User consents on Google's page; Google redirects to
   `GET /api/auth/google/callback`.
3. Passport's Google strategy (`src/config/passport.js`) resolves the
   profile and calls `userService.findOrCreateFromGoogleProfile`.
4. The controller issues an access + refresh token pair
   (`tokenService.issueTokenPair`):
   - **Access token** (short-lived, e.g. 15m): handed to the frontend via
     the URL **fragment** (`#accessToken=...`), never a query string, so it
     is never logged by servers/proxies. The frontend reads it from
     `window.location.hash`, stores it in memory, and strips it from the URL.
   - **Refresh token** (long-lived, e.g. 7d): set as an `HttpOnly` cookie
     scoped to `/api/auth`. Its SHA-256 hash (never the raw token) is
     persisted in MongoDB with a TTL index for automatic expiry.
5. The frontend sends the access token as `Authorization: Bearer <token>`
   on every request; `requireAuth` middleware verifies it.
6. When the access token expires, the frontend calls
   `POST /api/auth/refresh` (cookie sent automatically). The server
   verifies the refresh token, **rotates** it (old hash deleted, new one
   issued) — a stolen/replayed old refresh token will fail because its
   hash no longer exists in the DB — and returns a new access token.
7. `POST /api/auth/logout` deletes the refresh token's hash and clears the cookie.

### Cookie behavior across environments

The refresh-token cookie's `Secure`/`SameSite` flags are computed
**per-request**, not hardcoded (see `src/utils/cookie.js`):

- Request arrived over **HTTPS** (ngrok, Render) → `Secure: true`,
  `SameSite: None` (required for cross-site HTTPS frontends).
- Request arrived over **HTTP** (localhost, LAN) → `Secure: false`,
  `SameSite: Lax` (works because frontend and API share the same host,
  differing only by port, which counts as "same-site").

This is the fix that makes auth cookies work on plain-HTTP LAN/mobile
testing *and* stay properly secured on HTTPS — a single hardcoded
`Secure: true` (the previous behavior) silently breaks cookies over HTTP.

## 8. OCR Flow

1. `POST /api/ocr/scan` (multipart, field name `businessCard`) — validated
   by `multer` (JPEG/PNG/WEBP only, size-limited by `MAX_FILE_SIZE`).
2. `ocrService.scanBusinessCard` hands the saved file path to
   `pythonService.runOCR`, which `POST`s the image (`multipart/form-data`)
   to `${PYTHON_API_URL}/api/ocr/process` on the separate Python service:
   - The Python service normalizes the image (HEIC/HEIF → JPEG) via Pillow.
   - Runs PaddleOCR, returns `{ success, text, lines }` as JSON.
   - **Timeout**: the HTTP request is aborted and retried once if it doesn't
     finish within `OCR_TIMEOUT_MS` (default 30s) — see "Retry handling" below.
   - **Errors**: a non-2xx response or invalid JSON body is surfaced as a
     `500` with the Python-side error message (never a raw stack trace).
3. `parserService.parseBusinessCard` extracts structured fields (name,
   company, designation, email, phone, website, address) from the raw OCR
   text using regex + keyword heuristics — this is a best-effort parser,
   not guaranteed 100% accurate for every card layout; fields the user
   corrects can be persisted via `PUT /api/ocr/cards/:id`.
4. Result is persisted via `businessCardRepository.create`.

**Timeout handling**: the HTTP request is aborted via `AbortController` after `OCR_TIMEOUT_MS`.
**Retry handling**: exactly one retry on timeout (not on a clean OCR-side
failure, e.g. "unsupported image", since that would just fail again).
**Logging**: every stage logs via the structured logger (`debug` level in
development, silent in production for the debug lines).

## 9. Google OAuth Flow

See ["Authentication Flow"](#7-authentication-flow) above for the request
sequence. Setup steps:

1. In [Google Cloud Console](https://console.cloud.google.com/) → APIs &
   Services → Credentials, create an OAuth 2.0 Client ID (type: Web application).
2. Under **Authorized redirect URIs**, add **all** URIs you might test with
   at once (there's no limit that matters here):
   ```
   http://localhost:5000/api/auth/google/callback
   https://your-subdomain.ngrok-free.dev/api/auth/google/callback
   https://your-app.onrender.com/api/auth/google/callback
   ```
3. Set `GOOGLE_CALLBACK_URL` in `.env` to whichever one matches how you're
   *currently* running the server, and restart. No code change — env only.
4. Copy the Client ID/Secret into `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.

> Note: Google's OAuth consent screen generally requires the redirect URI
> to be `https://` or `http://localhost` — a plain-HTTP LAN IP redirect
> URI will typically be rejected by Google itself. For OAuth testing on a
> mobile device over WiFi, use the ngrok HTTPS URL rather than the LAN IP.
> (Everything else — uploads, OCR, `/api/user/*`, `/api/ocr/*` — works
> fine over plain HTTP on the LAN once already logged in via ngrok/HTTPS,
> since the access token is just a Bearer header, not tied to origin.)

## 10. Camera Permission Flow

`getUserMedia()` (camera access) is a **browser-side** API — the server
cannot grant or detect permission; only the browser can. What this backend
provides is a diagnostics endpoint so the frontend can pre-flight the
environment and show a helpful message instead of a cryptic browser error.

**`GET /api/camera/status`** returns:
```json
{
  "success": true,
  "isSecureContext": true,
  "mediaDevicesSupported": true,
  "cameraAvailable": null,
  "environment": "ngrok",
  "protocol": "https",
  "host": "your-subdomain.ngrok-free.dev",
  "device": { "isAndroid": false, "isIOS": false, "userAgent": "..." },
  "guidance": "This origin is a secure context. Camera access should work if the user grants permission in the browser prompt."
}
```

`cameraAvailable` is always `null` from the server — only the browser
knows this. The frontend should:

```js
const status = await fetch('/api/camera/status').then(r => r.json());
if (!status.isSecureContext) {
  // show: "Camera requires HTTPS. Use the ngrok link or the deployed app."
  return;
}
if (!navigator.mediaDevices?.getUserMedia) {
  // report reason: 'BROWSER_NOT_SUPPORTED'
  return;
}
try {
  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  // camera granted
} catch (err) {
  const reasonMap = {
    NotAllowedError: 'PERMISSION_DENIED',
    NotFoundError: 'CAMERA_NOT_AVAILABLE',
    NotReadableError: 'CAMERA_NOT_AVAILABLE',
    SecurityError: 'INSECURE_CONTEXT',
  };
  const reason = reasonMap[err.name] || 'UNKNOWN';
  // Optionally tell the backend, for logging:
  await fetch('/api/camera/report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: false, reason, message: err.message }),
  });
}
```

### Why camera fails on plain HTTP

Browsers require a **secure context** for `getUserMedia()`: `https://`, or
the special-cased `http://localhost` (any port). Plain HTTP on a LAN IP
(`http://192.168.1.5:3000`) is **not** a secure context in any modern
browser — this is a browser security policy, not something a server can
override. This is exactly why "same-WiFi mobile testing" needs **ngrok**
(HTTPS tunnel) for the camera specifically, even though auth, uploads, and
OCR all work fine over plain HTTP on the LAN.

| Environment | Secure context? | Camera works? |
|---|---|---|
| `http://localhost:3000` | Yes (browser special-case) | Yes |
| `http://192.168.x.x:3000` (LAN) | **No** | **No** — use ngrok instead |
| `https://*.ngrok-free.dev` | Yes | Yes |
| `https://*.onrender.com` | Yes | Yes |

Browser support baseline: Chrome/Edge/Samsung Internet on Android and
Safari on iOS all support `getUserMedia()` in a secure context; very old
WebViews or in-app browsers (e.g. some social-media in-app browsers) may
not — `mediaDevicesSupported` in the frontend should be checked with
`!!navigator.mediaDevices?.getUserMedia` before showing any camera UI.

## 11. Database Overview

Three collections:

- **`users`**: `googleId` (unique), `email` (unique), `name`, `picture`,
  `isVerified`, `lastLoginAt`, timestamps. `toJSON` strips `_id`/`__v` and
  exposes `id`.
- **`refreshtokens`**: `userId`, `tokenHash` (SHA-256 of the raw token,
  unique), `expiresAt`. A **TTL index** on `expiresAt` makes MongoDB
  auto-delete expired tokens — no cron/sweeper job needed.
- **`businesscards`**: `user` (ref), `imagePath`, `extractedText`,
  `rawLines`, parsed fields (`name`, `company`, `designation`, `email`,
  `phone`, `website`, `address`), `structuredData`, `status`. Indexed on
  `user + createdAt`, each searchable field individually, and a compound
  `text` index for full-text search.

## 12. Health Check

`GET /health` — no auth required. Returns `200` when Mongo is connected,
`503` otherwise (so a load balancer/orchestrator can distinguish "process
up, DB down" from healthy):

```json
{
  "success": true,
  "message": "OK",
  "env": "production",
  "environment": "render",
  "uptimeSeconds": 4213,
  "database": "connected",
  "timestamp": "2026-07-17T05:00:00.000Z"
}
```

## 13. Render Deployment

1. Push this repo to GitHub/GitLab.
2. Render → New → Web Service → connect the repo, root directory `backend/`.
3. Build command: `npm install`. Start command: `npm start`.
4. Add all required environment variables from `.env.example` in Render's
   dashboard (**do not** commit `.env`). Set `NODE_ENV=production`.
5. Set `GOOGLE_CALLBACK_URL` and `CLIENT_URL` to your Render/frontend URLs.
6. Render provides HTTPS automatically — no TLS config needed. The app
   already sets `trust proxy` so `req.secure`/cookies work correctly behind
   Render's proxy.
7. **Persistent storage note**: Render's filesystem is ephemeral on the
   free/standard tiers — uploaded images in `uploads/` will be lost on
   redeploy/restart. For production, point `UPLOAD_DIR` at a mounted disk
   (Render Disks) or swap the storage layer for S3/Cloudinary/etc.
   (`src/config/multer.js` is the only file that would need to change.)
8. Confirm `GET https://your-app.onrender.com/health` returns `200`.

## 14. ngrok Setup

```bash
# In one terminal:
npm run dev            # backend on http://localhost:5000

# In another terminal:
ngrok http 5000
# ngrok prints: https://<random>.ngrok-free.dev -> http://localhost:5000
```

- Set `GOOGLE_CALLBACK_URL=https://<your-subdomain>.ngrok-free.dev/api/auth/google/callback`
  in `.env` and restart the server (must also be registered in Google
  Cloud Console — see [section 9](#9-google-oauth-flow)).
- Point your frontend's API base URL at the ngrok HTTPS URL.
- CORS and cookies auto-adapt: any `https://*.ngrok-free.dev` /
  `.ngrok.io` / `.ngrok.app` origin is allowed automatically
  (`src/config/cors.js`) — no `.env` origin list edits needed.
- This is the environment to use for **camera testing on a real mobile
  device** (see [section 10](#10-camera-permission-flow) for why).

## 15. Same-WiFi Mobile Setup

1. Find your PC's LAN IP: `ipconfig` (Windows, look for IPv4) or
   `ifconfig` / `ip addr` (macOS/Linux).
2. Start the backend: `npm run dev` (it already binds `0.0.0.0`, so it's
   reachable from other devices on the network — see `server.js`).
3. On your phone (same WiFi), open `http://<pc-lan-ip>:5000/health` to
   confirm connectivity.
4. Point your frontend's API base URL at `http://<pc-lan-ip>:5000`.
5. Any `http://192.168.x.x:*`, `http://10.x.x.x:*`, or
   `http://172.16-31.x.x:*` origin is auto-allowed by CORS — no config
   needed as your IP changes across networks.
6. **Camera will NOT work over plain HTTP on a LAN IP** (see section 10) —
   use ngrok for that specific flow if testing on a phone.
7. Google OAuth also generally requires HTTPS or localhost for the
   redirect — use ngrok if you need to test the full Google login flow
   from a phone; everything else (already-issued tokens, uploads, OCR,
   profile) works fine over LAN HTTP.

## 16. Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Server exits immediately with "Missing required environment variable(s)" | Fill in `.env` from `.env.example` |
| `CORS: Origin '...' is not allowed` | Origin doesn't match `CLIENT_URL`, `EXTRA_ALLOWED_ORIGINS`, or the auto-allowed LAN/ngrok/Render patterns — check `src/config/cors.js` |
| Refresh token cookie never gets set / login "works" but next request is 401 | Frontend and API origins mismatched, or testing HTTPS frontend against an HTTP-only API (mixed content) — check the Network tab for a `Set-Cookie` header on the callback response |
| `getUserMedia` throws `NotAllowedError` immediately with no browser prompt | Almost always "not a secure context" — see section 10 |
| OCR request hangs then times out | Check `PYTHON_API_URL` is correct and the Python service is up (`GET <PYTHON_API_URL>/health`); check the Python service's own logs |
| `Google authentication failed` | `GOOGLE_CALLBACK_URL` doesn't exactly match a URI registered in Google Cloud Console (including protocol and trailing slash) |
| Mongoose "Duplicate schema index" warning at startup | Already fixed — if you see this again after further edits to `BusinessCard.js`, you likely re-added a `schema.index()` for a field that also has `index: true` |
| `413`/`400` on file upload | File exceeds `MAX_FILE_SIZE`, or wrong field name (must be `businessCard`), or unsupported MIME type (JPEG/PNG/WEBP only) |

## 17. Common Errors

All errors share one JSON shape (`src/middleware/error.middleware.js`):
```json
{ "success": false, "message": "...", "errors": [] }
```
Validation errors additionally populate `errors` with `{ field, message }`
entries. In non-production environments, `5xx` errors also include a
`stack` field.

## 18. Production Checklist

- [ ] `NODE_ENV=production`
- [ ] Strong, unique `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` (app refuses to boot with placeholders in production)
- [ ] `MONGODB_URI` points at a real, backed-up cluster (e.g. Atlas)
- [ ] `CLIENT_URL` set to the real production frontend origin
- [ ] `GOOGLE_CALLBACK_URL` set to the production callback URL, registered in Google Cloud Console
- [ ] `COOKIE_DOMAIN` set only if frontend + API share a parent domain
- [ ] Persistent (non-ephemeral) storage configured for `uploads/` if deploying to a platform with an ephemeral filesystem
- [ ] Uptime monitor pointed at `GET /health`
- [ ] Logs shipped somewhere durable (the built-in logger writes structured JSON-ish lines to stdout/stderr — pipe them to your platform's log aggregator)

## 19. Testing Guide

No automated test suite is included in this project. Recommended manual
verification per environment:

```bash
curl http://localhost:5000/health
curl http://localhost:5000/api/camera/status
# Open <CLIENT_URL>/... and run through: login -> upload a card -> search -> edit -> delete -> logout
```

For CORS/cookie behavior specifically, watch the browser DevTools Network
tab: the OAuth callback response should include a `Set-Cookie:
refreshToken=...` header, and subsequent `/api/auth/refresh` calls should
include `Cookie: refreshToken=...` in the request.

## 20. Performance Notes

- MongoDB reads use `.lean()` where the result is read-only (skips
  Mongoose document hydration overhead).
- Search queries run the filtered `find()` and `countDocuments()` in
  parallel (`Promise.all`) rather than sequentially.
- `compression` middleware gzips JSON responses.
- The global rate limiter (300 req/15min) and a tighter OCR-specific
  limiter (30 req/15min) protect against a single client exhausting
  server resources, particularly relevant for the CPU/GPU-bound OCR path.
- OCR runs on a completely separate Python **service** (its own process,
  its own Render instance), not a Node worker thread, so a slow/stuck OCR
  call cannot block Node's event loop — only the request that triggered it
  (and it's bounded by `OCR_TIMEOUT_MS`).

---

See also: **[`API_REFERENCE.md`](./API_REFERENCE.md)** for full endpoint
docs and **[`BUGS_AND_FIXES.md`](./BUGS_AND_FIXES.md)** for the complete
audit findings and what was changed.
