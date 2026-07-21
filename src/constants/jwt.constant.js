/**
 * JWT related constants.
 * Centralizing these values avoids "magic strings" scattered across the codebase.
 */

export const TOKEN_TYPES = Object.freeze({
  ACCESS: 'access',
  REFRESH: 'refresh',
});

export const DEFAULT_ACCESS_TOKEN_EXPIRY = '15m';
export const DEFAULT_REFRESH_TOKEN_EXPIRY = '7d';

// Refresh token lifetime expressed in milliseconds, used for MongoDB expiresAt / cookie maxAge.
export const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
