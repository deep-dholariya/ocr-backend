import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { TOKEN_TYPES } from '../constants/jwt.constant.js';
import { ApiError } from './ApiError.js';

/**
 * Signs a new Access Token.
 * Payload intentionally contains ONLY the user id + token type —
 * never email, name, picture, or Google ID (per spec: no PII in JWTs).
 *
 * @param {string} userId
 * @returns {string} signed JWT
 */
export const signAccessToken = (userId) => {
  return jwt.sign({ sub: userId, type: TOKEN_TYPES.ACCESS }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRY,
  });
};

/**
 * Signs a new Refresh Token.
 * @param {string} userId
 * @returns {string} signed JWT
 */
export const signRefreshToken = (userId) => {
  return jwt.sign({ sub: userId, type: TOKEN_TYPES.REFRESH }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRY,
  });
};

/**
 * Verifies an Access Token and asserts its type is "access".
 * @param {string} token
 * @throws {ApiError} 401 if invalid, expired, or wrong type.
 */
export const verifyAccessToken = (token) => {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
    if (decoded.type !== TOKEN_TYPES.ACCESS) {
      throw ApiError.unauthorized('Invalid access token type.');
    }
    return decoded;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw ApiError.unauthorized('Invalid or expired access token.');
  }
};

/**
 * Verifies a Refresh Token and asserts its type is "refresh".
 * @param {string} token
 * @throws {ApiError} 401 if invalid, expired, or wrong type.
 */
export const verifyRefreshToken = (token) => {
  try {
    const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET);
    if (decoded.type !== TOKEN_TYPES.REFRESH) {
      throw ApiError.unauthorized('Invalid refresh token type.');
    }
    return decoded;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw ApiError.unauthorized('Invalid or expired refresh token.');
  }
};
