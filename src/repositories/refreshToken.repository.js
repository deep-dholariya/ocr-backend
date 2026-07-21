import { RefreshToken } from '../models/RefreshToken.js';

/**
 * RefreshToken Repository
 * Encapsulates all direct Mongoose/MongoDB access for the RefreshToken collection.
 */
class RefreshTokenRepository {
  async create({ userId, tokenHash, expiresAt }) {
    return RefreshToken.create({ userId, tokenHash, expiresAt });
  }

  async findByHash(tokenHash) {
    return RefreshToken.findOne({ tokenHash });
  }

  async deleteByHash(tokenHash) {
    return RefreshToken.findOneAndDelete({ tokenHash });
  }

  async deleteById(id) {
    return RefreshToken.findByIdAndDelete(id);
  }

  // Used on logout-from-all-devices or on refresh-token-reuse detection,
  // to immediately invalidate every active session for a user.
  async deleteAllByUserId(userId) {
    return RefreshToken.deleteMany({ userId });
  }
}

export const refreshTokenRepository = new RefreshTokenRepository();
