import { userService } from './user.service.js';
import { tokenService } from './token.service.js';

/**
 * Auth Service
 * Orchestrates the higher-level authentication flows by composing
 * the User and Token services. Controllers should talk to THIS layer,
 * not directly to the repositories.
 */
class AuthService {
  /**
   * Full Google OAuth login flow:
   * 1. Find-or-create the user from the Google profile.
   * 2. Issue a fresh Access + Refresh token pair.
   *
   * @param {import('passport-google-oauth20').Profile} googleProfile
   */
  async loginWithGoogle(googleProfile) {
    const user = await userService.findOrCreateFromGoogleProfile(googleProfile);
    const { accessToken, refreshToken } = await tokenService.issueTokenPair(user._id.toString());
    return { user, accessToken, refreshToken };
  }

  /**
   * Refresh Token Rotation flow. Delegates directly to tokenService,
   * which handles verify -> delete-old -> issue-new atomically.
   *
   * @param {string} rawRefreshToken
   */
  async refreshSession(rawRefreshToken) {
    return tokenService.rotateRefreshToken(rawRefreshToken);
  }

  /**
   * Logout flow: revoke the presented refresh token.
   * @param {string} rawRefreshToken
   */
  async logout(rawRefreshToken) {
    await tokenService.revokeRefreshToken(rawRefreshToken);
  }
}

export const authService = new AuthService();
