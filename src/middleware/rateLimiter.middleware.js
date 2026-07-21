import rateLimit from 'express-rate-limit';

/**
 * Rate limiters.
 * Auth endpoints are prime brute-force / credential-stuffing / token-guessing
 * targets, so they get tighter limits than the general API.
 */

// Applies to the whole API as a baseline defense.
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again later.' },
});

// Applies to Google OAuth entry points.
export const googleAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Please try again later.' },
});

// Applies to POST /api/auth/refresh — tight, since this is the most
// sensitive, repeatable endpoint (guards against refresh-token brute forcing).
export const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many refresh attempts. Please try again later.' },
});

// Applies to POST /api/ocr/scan — OCR spawns a Python process per request
// (CPU/GPU-heavy), so it gets a much tighter ceiling than the general API
// to prevent a single client from exhausting server resources.
export const ocrScanLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many scan requests. Please try again later.' },
});
