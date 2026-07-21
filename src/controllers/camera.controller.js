import { asyncHandler } from "../utils/asyncHandler.js";
import { detectEnvironment } from "../utils/environment.js";
import { isRequestSecure } from "../utils/cookie.js";
import { logger } from "../utils/logger.js";

/**
 * GET /api/camera/status
 *
 * Diagnostics endpoint for the frontend to call BEFORE attempting
 * `navigator.mediaDevices.getUserMedia()`, so it can show a helpful,
 * environment-specific message instead of a generic browser error.
 *
 * IMPORTANT: `mediaDevices` / camera access is entirely a BROWSER API —
 * the server cannot detect whether the browser will actually grant camera
 * permission (that's decided client-side, per-origin, by the user). What
 * this endpoint CAN tell the frontend accurately is:
 *   - whether THIS request reached the server over a secure context
 *     (HTTPS, or localhost, both of which `getUserMedia` requires)
 *   - which deployment environment it's running in
 *   - the expected browser-support baseline for that environment
 *
 * The frontend is still responsible for calling `getUserMedia()` itself,
 * inspecting `navigator.mediaDevices` for support, and handling the
 * `NotAllowedError` / `NotFoundError` / `NotReadableError` cases —
 * see README.md "Camera Permission Flow" for the full client-side pattern
 * and the exact error-code mapping this API expects the frontend to send
 * back on failure (see POST /api/camera/report below).
 */
export const getCameraStatus = asyncHandler(async (req, res) => {
  const environment = detectEnvironment(req);
  const secureRequest = isRequestSecure(req);

  // getUserMedia() requires a "secure context": HTTPS, or the special-cased
  // `localhost` (any port). Plain HTTP on a LAN IP (e.g. http://192.168.1.5)
  // is NOT a secure context in any browser, so camera access will fail there
  // even though everything else (auth, uploads, OCR) works fine over HTTP.
  const isSecureContext = secureRequest || environment === "localhost";

  const userAgent = req.headers["user-agent"] || "";
  const isAndroid = /android/i.test(userAgent);
  const isIOS = /iphone|ipad|ipod/i.test(userAgent);

  res.status(200).json({
    success: true,
    isSecureContext,
    mediaDevicesSupported: true, // all modern evergreen browsers support it; real support is verified client-side
    cameraAvailable: null, // cannot be determined server-side — the frontend must call getUserMedia() and report back
    environment,
    protocol: secureRequest ? "https" : "http",
    host: req.headers.host || null,
    device: {
      isAndroid,
      isIOS,
      userAgent,
    },
    guidance: isSecureContext
      ? "This origin is a secure context. Camera access should work if the user grants permission in the browser prompt."
      : "This origin is NOT a secure context. Browsers block getUserMedia() on plain HTTP except on localhost. Use ngrok or deploy to Render (HTTPS) to test the camera over LAN/mobile.",
  });
});

/**
 * POST /api/camera/report
 * Optional: the frontend can report the ACTUAL client-side getUserMedia()
 * outcome here (permission denied, no camera, insecure context, etc.) for
 * server-side logging/analytics. This is the only way to know the real
 * permission result, since that decision happens entirely in the browser.
 */
export const reportCameraStatus = asyncHandler(async (req, res) => {
  const { success = false, reason = "UNKNOWN", message } = req.body || {};

  // Intentionally does not persist anything by default — this is a log-only
  // hook. Wire it to your logger/analytics of choice as needed.
  logger.info("Camera status report received from client", { success, reason, message });

  // This response describes the HTTP call itself, NOT the camera outcome —
  // the camera outcome the client reported is echoed back under `received`.
  res.status(200).json({
    success: true,
    received: { success, reason, message: message || null },
  });
});
