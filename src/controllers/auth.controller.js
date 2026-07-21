import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { authService } from '../services/auth.service.js';
import { userService } from '../services/user.service.js';
import { tokenService } from '../services/token.service.js';
import { setRefreshTokenCookie, clearRefreshTokenCookie, REFRESH_TOKEN_COOKIE_NAME } from '../utils/cookie.js';
import { MESSAGES } from '../constants/message.constant.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

/**
 * Auth Controller
 * Thin HTTP layer: parses the request, delegates to the service layer,
 * shapes the HTTP response (status code, cookie, JSON body). No business
 * logic lives here.
 */

/**
 * GET /api/auth/google
 * Fully handled by the passport.authenticate('google', ...) middleware
 * in auth.routes.js — no controller logic needed for the redirect step.
 */

/**
 * GET /api/auth/google/callback
 * Runs AFTER Passport's Google strategy has already run its verify callback
 * (config/passport.js), which calls userService.findOrCreateFromGoogleProfile
 * and attaches the resulting User document to req.user.
 *
 * This controller's only job is to issue our application's own JWT pair
 * for that already-resolved user and hand the Access Token to the frontend.
 */
export const googleCallback = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw ApiError.unauthorized(MESSAGES.AUTH.GOOGLE_AUTH_FAILED);
  }

  const { accessToken, refreshToken } = await tokenService.issueTokenPair(req.user._id.toString());

  setRefreshTokenCookie(req, res, refreshToken);

  logger.debug('Google OAuth login success', { userId: req.user._id.toString() });

  // Hand the access token to the frontend via the URL fragment (not query string),
  // so it is never logged by servers/proxies. The SPA is expected to read it from
  // `window.location.hash` on the /oauth/callback route, store it in memory, and
  // then strip it from the URL/history.
  const redirectUrl = `${env.CLIENT_URL}/oauth/callback#accessToken=${encodeURIComponent(accessToken)}`;
  return res.redirect(redirectUrl);
});

/**
 * POST /api/auth/refresh
 * Reads the refresh token from the HttpOnly cookie, rotates it, and
 * returns a new Access Token in the JSON body. The refresh token itself
 * is never present in the response body — only in the rotated cookie.
 */
export const refresh = asyncHandler(async (req, res) => {
  const rawRefreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME];

  if (!rawRefreshToken) {
    throw ApiError.unauthorized(MESSAGES.AUTH.NO_REFRESH_TOKEN);
  }

  try {
    const { accessToken, refreshToken: newRefreshToken } = await authService.refreshSession(rawRefreshToken);
    setRefreshTokenCookie(req, res, newRefreshToken);
    return new ApiResponse(200, { accessToken }, MESSAGES.AUTH.REFRESH_SUCCESS).send(res);
  } catch (error) {
    // Any failure during rotation (invalid/expired/reused token) must clear the
    // cookie so the frontend stops retrying a dead token and redirects to login.
    clearRefreshTokenCookie(req, res);
    throw error;
  }
});

/**
 * POST /api/auth/logout
 * Revokes the refresh token server-side and clears the cookie client-side.
 */
export const logout = asyncHandler(async (req, res) => {
  const rawRefreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME];

  await authService.logout(rawRefreshToken);
  clearRefreshTokenCookie(req, res);

  return new ApiResponse(200, null, MESSAGES.AUTH.LOGOUT_SUCCESS).send(res);
});

/**
 * GET /api/auth/me
 * Returns the currently authenticated user's public profile.
 * Requires a valid Access Token (see requireAuth middleware).
 */
export const getCurrentUser = asyncHandler(async (req, res) => {
  const user = await userService.getProfile(req.userId);
  return new ApiResponse(200, { user }, MESSAGES.AUTH.USER_FETCHED).send(res);
});
