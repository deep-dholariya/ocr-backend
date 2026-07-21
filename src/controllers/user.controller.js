import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { userService } from '../services/user.service.js';
import { clearRefreshTokenCookie } from '../utils/cookie.js';
import { MESSAGES } from '../constants/message.constant.js';

/**
 * User Controller
 * Handles authenticated, user-scoped profile operations.
 * All routes here sit behind requireAuth (see user.routes.js), so
 * req.userId is guaranteed to be set.
 */

export const getProfile = asyncHandler(async (req, res) => {
  const user = await userService.getProfile(req.userId);
  return new ApiResponse(200, { user }, MESSAGES.USER.PROFILE_FETCHED).send(res);
});

export const updateProfile = asyncHandler(async (req, res) => {
  const { name, picture } = req.body;
  const user = await userService.updateProfile(req.userId, { name, picture });
  return new ApiResponse(200, { user }, MESSAGES.USER.PROFILE_UPDATED).send(res);
});

export const deleteAccount = asyncHandler(async (req, res) => {
  await userService.deleteAccount(req.userId);
  // The user's sessions are already revoked in the service layer;
  // also clear the cookie on this response for immediate client-side cleanup.
  clearRefreshTokenCookie(req, res);
  return new ApiResponse(200, null, MESSAGES.USER.ACCOUNT_DELETED).send(res);
});
