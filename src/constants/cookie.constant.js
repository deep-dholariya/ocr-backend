/**
 * Cookie related constants.
 */

export const REFRESH_TOKEN_COOKIE_NAME = 'refreshToken';

/**
 * Base cookie options shared between "set" and "clear" operations.
 *
 * `secure` and `sameSite` are derived PER-REQUEST (not hardcoded) because
 * this backend must work identically over:
 *   - plain HTTP on localhost / LAN (mobile same-WiFi testing)
 *   - HTTPS via ngrok
 *   - HTTPS on Render
 *
 * A cookie with `Secure: true` is silently dropped by browsers over plain
 * HTTP (except on `localhost`, which some browsers special-case) — so
 * hardcoding `secure: true` breaks LAN/mobile testing over HTTP. Likewise,
 * `SameSite=None` REQUIRES `Secure: true`, so the two must move together.
 *
 * Rule applied:
 *   - Request arrived over HTTPS  -> secure: true,  sameSite: 'none'
 *     (required for cross-site HTTPS front-ends, e.g. ngrok/Render where
 *     the frontend and API are on different origins)
 *   - Request arrived over HTTP   -> secure: false, sameSite: 'lax'
 *     (localhost/LAN IP front-end and API share the same host, so 'lax'
 *     is sent on the cross-port XHR/fetch call and works without HTTPS)
 *
 * `isRequestSecure(req)` (see utils/cookie.js) determines the scheme,
 * honoring `X-Forwarded-Proto` since `app.set('trust proxy', 1)` is set
 * (Render and ngrok both terminate TLS in front of the Node process).
 */
export const getBaseCookieOptions = (env, isSecureRequest) => ({
  httpOnly: true,
  secure: isSecureRequest,
  sameSite: isSecureRequest ? 'none' : 'lax',
  path: '/api/auth',
  ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
});
