# API Reference & Traceability

Base URL: `{SERVER_URL}/api` (e.g. `http://localhost:5000/api`, or the
ngrok/Render URL — see README.md for environment auto-detection).

All responses share this envelope on success:
```json
{ "success": true, "message": "...", "data": { ... } }
```
and on error:
```json
{ "success": false, "message": "...", "errors": [] }
```
(a couple of legacy-shaped OCR endpoints return `data` fields inline
rather than nested — noted per-endpoint below.)

---

## Health

### `GET /health`
**Traceability**
```
Route:       src/app.js (inline)
Database:    mongoose.connection.readyState (read-only check)
```
- Auth: none
- Response `200` (DB connected) / `503` (DB not connected):
```json
{ "success": true, "message": "OK", "env": "production", "environment": "render", "uptimeSeconds": 4213, "database": "connected", "timestamp": "..." }
```

---

## Camera Diagnostics

### `GET /api/camera/status`
**Traceability**
```
Route:       src/routes/camera.routes.js
Controller:  src/controllers/camera.controller.js -> getCameraStatus
Utility:     src/utils/environment.js, src/utils/cookie.js (isRequestSecure)
Database:    none
```
- Auth: none
- Response `200`:
```json
{
  "success": true,
  "isSecureContext": true,
  "mediaDevicesSupported": true,
  "cameraAvailable": null,
  "environment": "ngrok",
  "protocol": "https",
  "host": "abc123.ngrok-free.dev",
  "device": { "isAndroid": false, "isIOS": false, "userAgent": "..." },
  "guidance": "..."
}
```

### `POST /api/camera/report`
**Traceability**
```
Route:       src/routes/camera.routes.js
Controller:  src/controllers/camera.controller.js -> reportCameraStatus
Database:    none (log-only)
```
- Auth: none
- Body: `{ "success": false, "reason": "PERMISSION_DENIED", "message": "..." }`
- Response `200`: `{ "success": true, "received": { "success": false, "reason": "PERMISSION_DENIED", "message": "..." } }`
- Reason codes the frontend is expected to send: `PERMISSION_DENIED`,
  `CAMERA_NOT_AVAILABLE`, `INSECURE_CONTEXT`, `BROWSER_NOT_SUPPORTED`, `UNKNOWN`.

---

## Auth

### `GET /api/auth/google`
**Traceability**
```
Route:       src/routes/auth.routes.js
Middleware:  googleAuthLimiter (src/middleware/rateLimiter.middleware.js), passport.authenticate('google')
Config:      src/config/passport.js
```
- Auth: none. Redirects the browser to Google's consent screen.

### `GET /api/auth/google/callback`
**Traceability**
```
Route:       src/routes/auth.routes.js
Middleware:  googleAuthLimiter, passport.authenticate('google', { failureRedirect: '/api/auth/google/failure' })
Controller:  src/controllers/auth.controller.js -> googleCallback
Service:     src/services/user.service.js -> findOrCreateFromGoogleProfile
             src/services/token.service.js -> issueTokenPair
Repository:  user.repository.js, refreshToken.repository.js
Database:    User.findOne/create, RefreshToken.create
```
- Auth: none (this IS the login step)
- Success: `302` redirect to `{CLIENT_URL}/oauth/callback#accessToken=...`,
  sets the `refreshToken` HttpOnly cookie.
- Failure: `401` via `/api/auth/google/failure`.

### `POST /api/auth/refresh`
**Traceability**
```
Route:       src/routes/auth.routes.js
Middleware:  refreshLimiter
Controller:  src/controllers/auth.controller.js -> refresh
Service:     src/services/auth.service.js -> refreshSession -> token.service.js -> rotateRefreshToken
Repository:  refreshToken.repository.js
Database:    RefreshToken.findOne(hash), RefreshToken.deleteOne(old), RefreshToken.create(new)
```
- Auth: `refreshToken` HttpOnly cookie (no header needed)
- Response `200`: `{ "success": true, "message": "Access token refreshed successfully.", "data": { "accessToken": "..." } }`
- Response `401`: missing/invalid/expired/reused refresh token (cookie is cleared)

### `POST /api/auth/logout`
**Traceability**
```
Route:       src/routes/auth.routes.js
Controller:  src/controllers/auth.controller.js -> logout
Service:     src/services/auth.service.js -> logout -> token.service.js -> revokeRefreshToken
Database:    RefreshToken.deleteOne(hash)
```
- Auth: `refreshToken` cookie (optional — always succeeds)
- Response `200`: `{ "success": true, "message": "Logged out successfully.", "data": null }`

### `GET /api/auth/me`
**Traceability**
```
Route:       src/routes/auth.routes.js
Middleware:  requireAuth (src/middleware/auth.middleware.js)
Controller:  src/controllers/auth.controller.js -> getCurrentUser
Service:     src/services/user.service.js -> getProfile
Database:    User.findById
```
- Auth: `Authorization: Bearer <accessToken>`
- Response `200`: `{ "success": true, "message": "Current user fetched successfully.", "data": { "user": { ... } } }`
- Response `401`: missing/invalid/expired access token

---

## User

All routes below require `Authorization: Bearer <accessToken>`.

### `GET /api/user/profile`
```
Route:       src/routes/user.routes.js
Controller:  src/controllers/user.controller.js -> getProfile
Service:     user.service.js -> getProfile
Database:    User.findById
```
Response `200`: `{ "success": true, "message": "Profile fetched successfully.", "data": { "user": {...} } }`

### `PATCH /api/user/profile`
```
Route:       src/routes/user.routes.js
Middleware:  updateProfileValidator, validate
Controller:  user.controller.js -> updateProfile
Service:     user.service.js -> updateProfile  (whitelists: name, picture)
Database:    User.findByIdAndUpdate
```
Body: `{ "name"?: string, "picture"?: string(URL) }` (at least one field required)
Response `200`: `{ "success": true, "message": "Profile updated successfully.", "data": { "user": {...} } }`
Response `400`: validation failed / no valid fields

### `DELETE /api/user/account`
```
Route:       src/routes/user.routes.js
Controller:  user.controller.js -> deleteAccount
Service:     user.service.js -> deleteAccount -> token.service.js -> revokeAllSessionsForUser
Database:    User.findByIdAndDelete, RefreshToken.deleteMany({ userId })
```
Response `200`: `{ "success": true, "message": "Account deleted successfully.", "data": null }`. Refresh cookie is cleared.

---

## OCR / Business Cards

All routes below require `Authorization: Bearer <accessToken>`.

### `POST /api/ocr/scan`
```
Route:       src/routes/ocr.routes.js
Middleware:  ocrScanLimiter (30/15min), uploadBusinessCard (multer: field "businessCard", JPEG/PNG/WEBP, <= MAX_FILE_SIZE)
Controller:  src/controllers/ocr.controller.js -> scanBusinessCard
Service:     src/services/ocr.service.js -> scanBusinessCard
             -> src/services/python.service.js -> runOCR (spawns python/ocr.py, timeout + 1 retry)
             -> src/services/parser.service.js -> parseBusinessCard
Repository:  businessCard.repository.js -> create
Database:    BusinessCard.create
```
- Headers: `Content-Type: multipart/form-data`
- Body: form field `businessCard` = image file
- Response `201`:
```json
{
  "success": true,
  "message": "Business card scanned successfully.",
  "data": {
    "success": true,
    "message": "Business card scanned successfully.",
    "card": { "...": "full saved document" },
    "rawText": "...",
    "structuredData": { "name": "...", "company": "...", "...": "..." }
  }
}
```
- Response `400`: no file, wrong field name, unsupported MIME type, or file too large
- Response `500`: OCR processing failed (Python-side error, or timeout after retry)

### `GET /api/ocr/cards`
```
Route:       src/routes/ocr.routes.js
Controller:  ocr.controller.js -> getCards
Service:     ocr.service.js -> getCards
Database:    BusinessCard.find({ user }).sort(-createdAt).lean()
```
Response `200`: `{ "success": true, "message": "...", "data": { "cards": [...] } }`

### `GET /api/ocr/cards/search?q=&page=&limit=`
```
Route:       src/routes/ocr.routes.js  (registered ABOVE /cards/:id — order matters)
Middleware:  searchCardsValidator, validate
Controller:  ocr.controller.js -> searchCards
Service:     ocr.service.js -> searchCards
Repository:  businessCard.repository.js -> search (regex-escapes `q` before building the Mongo $regex filter)
Database:    BusinessCard.find($or regex across 7 fields), BusinessCard.countDocuments (run in parallel)
```
Query params: `q` (optional, max 100 chars), `page` (optional, >=1), `limit` (optional, 1-100, default 20)
Response `200`: `{ "success": true, "message": "...", "data": { "cards": [...], "total": n, "page": n, "limit": n, "totalPages": n } }`

### `GET /api/ocr/cards/:id`
```
Route:       src/routes/ocr.routes.js
Middleware:  cardIdValidator (must be a valid 24-char Mongo ObjectId), validate
Controller:  ocr.controller.js -> getCard
Service:     ocr.service.js -> getCard
Database:    BusinessCard.findOne({ _id, user }).lean()
```
Response `200`: `{ "success": true, "message": "...", "data": { "card": {...} } }`
Response `404`: not found / not owned by the authenticated user

### `PUT /api/ocr/cards/:id`
```
Route:       src/routes/ocr.routes.js
Middleware:  updateCardValidator (whitelists name/company/designation/email/phone/website/address), validate
Controller:  ocr.controller.js -> updateCard
Service:     ocr.service.js -> updateCard  (re-whitelists via UPDATABLE_CARD_FIELDS — defense in depth against mass-assignment)
Database:    BusinessCard.findByIdAndUpdate
```
Body: any subset of `{ name, company, designation, email, phone, website, address }`
Response `200`: `{ "success": true, "message": "...", "data": { "card": {...} } }`
Response `400`: no valid fields / validation failed
Response `404`: not found / not owned by the authenticated user

### `DELETE /api/ocr/cards/:id`
```
Route:       src/routes/ocr.routes.js
Middleware:  cardIdValidator, validate
Controller:  ocr.controller.js -> deleteCard
Service:     ocr.service.js -> deleteCard
Database:    BusinessCard.findByIdAndDelete
```
Response `200`: `{ "success": true, "message": "Business card deleted successfully.", "data": null }`
Response `404`: not found / not owned by the authenticated user

---

## Error Response Reference

| Status | Meaning | Typical cause |
|---|---|---|
| 400 | Bad Request | Validation failed, empty update body, missing file |
| 401 | Unauthorized | Missing/invalid/expired access or refresh token |
| 403 | Forbidden | Disallowed CORS origin |
| 404 | Not Found | Unknown route, or resource not found / not owned by caller |
| 409 | Conflict | Duplicate email during account creation |
| 413 | Payload Too Large | Upload/body exceeds configured limits |
| 429 | Too Many Requests | Rate limit exceeded (see per-route limiter) |
| 500 | Internal Server Error | Unexpected failure (message generic in production) |
