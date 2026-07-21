import { REFRESH_TOKEN_COOKIE_NAME, getBaseCookieOptions } from '../constants/cookie.constant.js';
import { REFRESH_TOKEN_EXPIRY_MS } from '../constants/jwt.constant.js';
import { env } from '../config/env.js';

/**
 * Determines whether the INCOMING request should be treated as HTTPS,
 * honoring reverse-proxy headers (Render, ngrok) since Express's own
 * `req.secure` only inspects the direct socket, which is always plain
 * HTTP when a proxy terminates TLS in front of the app.
 * `app.set('trust proxy', 1)` in app.js makes `req.secure` proxy-aware
 * already, but we defensively also check the header directly.
 *
 * @param {import('express').Request} req
 * @returns {boolean}
 */
export const isRequestSecure = (req) => {
  if (req.secure) return true;
  const forwardedProto = req.headers['x-forwarded-proto'];
  if (!forwardedProto) return false;
  return forwardedProto.split(',')[0].trim().toLowerCase() === 'https';
};

/**
 * Sets the Refresh Token as an HttpOnly, environment-appropriate cookie.
 * This is the ONLY place the raw refresh token ever leaves the server boundary,
 * and it is never included in any JSON response body.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {string} refreshToken - raw (unhashed) refresh JWT
 */
export const setRefreshTokenCookie = (req, res, refreshToken) => {
  res.cookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, {
    ...getBaseCookieOptions(env, isRequestSecure(req)),
    maxAge: REFRESH_TOKEN_EXPIRY_MS,
  });
};

/**
 * Clears the Refresh Token cookie (used on logout / invalid refresh).
 * Options must mirror those used to set the cookie, or some browsers won't clear it.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export const clearRefreshTokenCookie = (req, res) => {
  res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, getBaseCookieOptions(env, isRequestSecure(req)));
};

export { REFRESH_TOKEN_COOKIE_NAME };
