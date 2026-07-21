import { User } from '../models/User.js';

/**
 * User Repository
 * Encapsulates all direct Mongoose/MongoDB access for the User collection.
 * Services must go through this layer instead of importing the model directly —
 * this keeps persistence concerns isolated and swappable.
 */
class UserRepository {
  async findById(userId) {
    return User.findById(userId);
  }

  async findByGoogleId(googleId) {
    return User.findOne({ googleId });
  }

  async findByEmail(email) {
    return User.findOne({ email: email.toLowerCase() });
  }

  async create(userData) {
    return User.create(userData);
  }

  async updateById(userId, updateData) {
    return User.findByIdAndUpdate(userId, { $set: updateData }, { new: true, runValidators: true });
  }

  async updateLastLogin(userId) {
    return User.findByIdAndUpdate(userId, { $set: { lastLoginAt: new Date() } }, { new: true });
  }

  async deleteById(userId) {
    return User.findByIdAndDelete(userId);
  }
}

export const userRepository = new UserRepository();
