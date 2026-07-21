import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import { hashToken } from '../utils/hash.js';
import { refreshTokenRepository } from '../repositories/refreshToken.repository.js';
import { REFRESH_TOKEN_EXPIRY_MS } from '../constants/jwt.constant.js';
import { ApiError } from '../utils/ApiError.js';
import { MESSAGES } from '../constants/message.constant.js';

/**
 * Token Service
 * Owns all business logic around issuing, hashing, persisting, verifying,
 * and rotating JWT Access/Refresh tokens.
 */
class TokenService {
  /**
   * Issues a brand-new Access + Refresh token pair for a user and
   * persists the HASH of the refresh token in MongoDB.
   *
   * @param {string} userId
   * @returns {Promise<{accessToken: string, refreshToken: string}>}
   */
  async issueTokenPair(userId) {
    const accessToken = signAccessToken(userId);
    const refreshToken = signRefreshToken(userId);

    const tokenHash = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);

    await refreshTokenRepository.create({ userId, tokenHash, expiresAt });

    return { accessToken, refreshToken };
  }

  /**
   * Verifies a raw refresh token against the JWT signature AND the
   * hashed record in MongoDB, then rotates it: deletes the old record
   * and issues a brand-new pair.
   *
   * Rotation prevents replay: if a refresh token is ever stolen and used
   * after the legitimate client has already rotated it, the hash will no
   * longer exist in the DB and the request will be rejected.
   *
   * @param {string} rawRefreshToken
   * @returns {Promise<{accessToken: string, refreshToken: string, userId: string}>}
   */
  async rotateRefreshToken(rawRefreshToken) {
    if (!rawRefreshToken) {
      throw ApiError.unauthorized(MESSAGES.AUTH.NO_REFRESH_TOKEN);
    }

    // 1. Verify JWT signature/expiry first (cheap, no DB round-trip needed).
    let decoded;
    try {
      decoded = verifyRefreshToken(rawRefreshToken);
    } catch {
      throw ApiError.unauthorized(MESSAGES.AUTH.INVALID_REFRESH_TOKEN);
    }

    const tokenHash = hashToken(rawRefreshToken);

    // 2. Confirm the hash still exists in the DB (i.e. hasn't been rotated/revoked already).
    const storedToken = await refreshTokenRepository.findByHash(tokenHash);
    if (!storedToken) {
      throw ApiError.unauthorized(MESSAGES.AUTH.INVALID_REFRESH_TOKEN);
    }

    if (storedToken.expiresAt.getTime() < Date.now()) {
      await refreshTokenRepository.deleteByHash(tokenHash);
      throw ApiError.unauthorized(MESSAGES.AUTH.INVALID_REFRESH_TOKEN);
    }

    // 3. Delete the old token record (rotation: one-time use).
    await refreshTokenRepository.deleteByHash(tokenHash);

    // 4. Issue a brand-new pair.
    const { accessToken, refreshToken } = await this.issueTokenPair(decoded.sub);

    return { accessToken, refreshToken, userId: decoded.sub };
  }

  /**
   * Revokes a single refresh token (used on logout).
   * @param {string} rawRefreshToken
   */
  async revokeRefreshToken(rawRefreshToken) {
    if (!rawRefreshToken) return;
    const tokenHash = hashToken(rawRefreshToken);
    await refreshTokenRepository.deleteByHash(tokenHash);
  }

  /**
   * Revokes every active session for a user (used on account deletion,
   * password/security changes, or suspected compromise).
   * @param {string} userId
   */
  async revokeAllSessionsForUser(userId) {
    await refreshTokenRepository.deleteAllByUserId(userId);
  }
}

export const tokenService = new TokenService();
