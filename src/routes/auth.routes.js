import { Router } from 'express';
import passport from '../config/passport.js';
import { googleCallback, refresh, logout, getCurrentUser } from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { googleAuthLimiter, refreshLimiter } from '../middleware/rateLimiter.middleware.js';

const router = Router();

/**
 * GET /api/auth/google
 * Kicks off the Google OAuth 2.0 consent flow.
 * `session: false` because auth state is carried via JWTs, not server sessions.
 */
router.get(
  '/google',
  googleAuthLimiter,
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
  })
);

/**
 * GET /api/auth/google/callback
 * Google redirects here after consent. Passport's Google strategy verify
 * callback (config/passport.js) runs first and populates req.user;
 * the controller then issues our app's JWTs.
 */
router.get(
  '/google/callback',
  googleAuthLimiter,
  passport.authenticate('google', {
    session: false,
    failureRedirect: '/api/auth/google/failure',
  }),
  googleCallback
);

/**
 * GET /api/auth/google/failure
 * Landing point when passport.authenticate fails the callback step.
 */
router.get('/google/failure', (_req, res) => {
  res.status(401).json({ success: false, message: 'Google authentication failed.' });
});

/**
 * POST /api/auth/refresh
 * Rotates the refresh token (read from the HttpOnly cookie) and returns
 * a new access token.
 */
router.post('/refresh', refreshLimiter, refresh);

/**
 * POST /api/auth/logout
 * Revokes the current refresh token and clears the cookie.
 */
router.post('/logout', logout);

/**
 * GET /api/auth/me
 * Returns the authenticated user's profile. Requires a valid access token.
 */
router.get('/me', requireAuth, getCurrentUser);

export default router;
