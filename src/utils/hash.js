import crypto from 'crypto';

/**
 * Hashes a raw token using SHA-256.
 *
 * We use SHA-256 (not bcrypt) for refresh tokens because:
 * 1. Refresh tokens are already high-entropy, randomly-signed JWTs (not low-entropy
 *    user passwords), so slow, salted hashing is unnecessary for brute-force resistance.
 * 2. We need fast, deterministic lookups (hash -> DB row) on every refresh request,
 *    which a slow hash (bcrypt/argon2) would make expensive at scale.
 *
 * The raw refresh token is NEVER stored in the database — only this hash is,
 * so that a database leak alone cannot be used to forge valid sessions.
 *
 * @param {string} token - The raw JWT refresh token string.
 * @returns {string} Hex-encoded SHA-256 hash.
 */
export const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};
