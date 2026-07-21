import { verifyAccessToken } from '../utils/jwt.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { MESSAGES } from '../constants/message.constant.js';

/**
 * Protects routes by requiring a valid Access Token in the
 * `Authorization: Bearer <token>` header.
 *
 * On success, attaches `req.userId` for downstream controllers.
 * On failure, throws a 401 — the frontend is expected to call
 * POST /api/auth/refresh and retry the original request.
 */
export const requireAuth = asyncHandler(async (req, _res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw ApiError.unauthorized(MESSAGES.AUTH.NO_ACCESS_TOKEN);
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    throw ApiError.unauthorized(MESSAGES.AUTH.NO_ACCESS_TOKEN);
  }

  const decoded = verifyAccessToken(token); // throws ApiError.unauthorized on failure

  req.userId = decoded.sub;
  next();
});
