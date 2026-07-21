import { env } from "./env.js";
import { ApiError } from "../utils/ApiError.js";

/**
 * -----------------------------------------------------------------------------
 * Allowed Origins — Environment Auto-Detection
 * -----------------------------------------------------------------------------
 * Rather than hardcoding a single LAN IP (which breaks the moment the
 * developer's network changes), origins are resolved as:
 *
 *   1. Exact matches: CLIENT_URL (.env) + any comma-separated values in
 *      EXTRA_ALLOWED_ORIGINS (.env) — use this for your ngrok URL and your
 *      Render frontend URL if they differ from CLIENT_URL.
 *   2. Pattern matches, always allowed with no config needed:
 *        - http(s)://localhost:*  and  http(s)://127.0.0.1:*
 *        - http(s)://<private LAN IP>:*  (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
 *          -> makes "same WiFi" PC <-> mobile testing work out of the box.
 *        - https://*.ngrok-free.app , https://*.ngrok-free.dev , https://*.ngrok.io
 *        - https://*.onrender.com
 *
 * This means switching between localhost, LAN, ngrok, and Render requires
 * ZERO code changes — only .env values.
 */

const staticAllowedOrigins = [
  env.CLIENT_URL,
  ...(process.env.EXTRA_ALLOWED_ORIGINS
    ? process.env.EXTRA_ALLOWED_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)
    : []),
].filter(Boolean);

const patternAllowedOrigins = [
  /^https?:\/\/localhost(:\d+)?$/i,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/i,
  // Private LAN ranges (RFC 1918) — same-WiFi PC <-> mobile testing.
  /^https?:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/i,
  /^https?:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/i,
  /^https?:\/\/172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}(:\d+)?$/i,
  // ngrok tunnels (free + legacy domains)
  /^https:\/\/[a-z0-9-]+\.ngrok-free\.(app|dev)$/i,
  /^https:\/\/[a-z0-9-]+\.ngrok\.io$/i,
  /^https:\/\/[a-z0-9-]+\.ngrok\.app$/i,
  // Render deployments
  /^https:\/\/[a-z0-9-]+\.onrender\.com$/i,
];

const isOriginAllowed = (origin) => {
  if (staticAllowedOrigins.includes(origin)) return true;
  return patternAllowedOrigins.some((pattern) => pattern.test(origin));
};

/**
 * -----------------------------------------------------------------------------
 * CORS Configuration
 * -----------------------------------------------------------------------------
 */

export const corsOptions = {
  origin(origin, callback) {
    // Allow requests without an Origin header (native mobile apps, curl,
    // server-to-server, Postman). This does NOT weaken browser security —
    // a browser always sends Origin on cross-origin requests.
    if (!origin) {
      return callback(null, true);
    }

    if (isOriginAllowed(origin)) {
      return callback(null, true);
    }

    return callback(ApiError.forbidden(`CORS: Origin '${origin}' is not allowed.`));
  },

  credentials: true,

  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],

  allowedHeaders: ["Content-Type", "Authorization"],
};

// Exported for reuse (e.g. the /api/camera/status diagnostics endpoint).
export { isOriginAllowed };
