import { userRepository } from '../repositories/user.repository.js';
import { tokenService } from './token.service.js';
import { ApiError } from '../utils/ApiError.js';
import { MESSAGES } from '../constants/message.constant.js';

/**
 * User Service
 * Business logic for user lifecycle: find-or-create from OAuth profile,
 * profile reads/updates, and account deletion.
 */
class UserService {
  /**
   * Finds a user by their Google ID, or creates a new one if this is
   * their first login. Updates lastLoginAt on every successful login.
   *
   * @param {import('passport-google-oauth20').Profile} googleProfile
   */
  async findOrCreateFromGoogleProfile(googleProfile) {
    const googleId = googleProfile.id;
    const email = googleProfile.emails?.[0]?.value;
    const isVerified = googleProfile.emails?.[0]?.verified ?? false;
    const name = googleProfile.displayName;
    const picture = googleProfile.photos?.[0]?.value ?? null;

    if (!email) {
      throw ApiError.badRequest('Google account has no accessible email address.');
    }

    let user = await userRepository.findByGoogleId(googleId);

    if (!user) {
      // Defensive: a user may have previously signed up with the same email
      // through a different flow. Since this app only supports Google OAuth,
      // this mainly guards against duplicate-email edge cases.
      const existingByEmail = await userRepository.findByEmail(email);
      if (existingByEmail) {
        throw ApiError.conflict('An account with this email already exists.');
      }

      user = await userRepository.create({
        googleId,
        name,
        email,
        picture,
        isVerified,
        lastLoginAt: new Date(),
      });
    } else {
      user = await userRepository.updateLastLogin(user._id);
    }

    return user;
  }

  async getProfile(userId) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw ApiError.notFound(MESSAGES.USER.NOT_FOUND);
    }
    return user;
  }

  /**
   * Updates mutable profile fields only. googleId, email, and isVerified
   * are intentionally NOT updatable via this endpoint.
   */
  async updateProfile(userId, updates) {
    const allowedFields = ['name', 'picture'];
    const sanitizedUpdates = Object.fromEntries(
      Object.entries(updates).filter(([key]) => allowedFields.includes(key))
    );

    if (Object.keys(sanitizedUpdates).length === 0) {
      throw ApiError.badRequest('No valid fields provided to update.');
    }

    const user = await userRepository.updateById(userId, sanitizedUpdates);
    if (!user) {
      throw ApiError.notFound(MESSAGES.USER.NOT_FOUND);
    }
    return user;
  }

  async deleteAccount(userId) {
    const user = await userRepository.deleteById(userId);
    if (!user) {
      throw ApiError.notFound(MESSAGES.USER.NOT_FOUND);
    }
    // Revoke every refresh token belonging to this user so no stale
    // session can continue to be refreshed after account deletion.
    await tokenService.revokeAllSessionsForUser(userId);
    return user;
  }
}

export const userService = new UserService();
