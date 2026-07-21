import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const refreshTokenSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // SHA-256 hash of the raw refresh token. The raw token is NEVER persisted.
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// TTL index: MongoDB automatically deletes the document once expiresAt passes,
// keeping the collection self-cleaning without a manual cron/sweeper job.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken = model('RefreshToken', refreshTokenSchema);
