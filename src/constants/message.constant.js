/**
 * Centralized user-facing / log messages.
 */

export const MESSAGES = Object.freeze({
  AUTH: {
    GOOGLE_AUTH_FAILED: 'Google authentication failed.',
    LOGIN_SUCCESS: 'Logged in successfully.',
    LOGOUT_SUCCESS: 'Logged out successfully.',
    REFRESH_SUCCESS: 'Access token refreshed successfully.',
    NO_REFRESH_TOKEN: 'Refresh token missing. Please log in again.',
    INVALID_REFRESH_TOKEN: 'Invalid or expired refresh token. Please log in again.',
    REFRESH_TOKEN_REUSE_DETECTED: 'Refresh token reuse detected. All sessions revoked.',
    UNAUTHORIZED: 'You are not authorized to access this resource.',
    NO_ACCESS_TOKEN: 'Access token missing.',
    INVALID_ACCESS_TOKEN: 'Invalid or expired access token.',
    USER_FETCHED: 'Current user fetched successfully.',
  },
  USER: {
    NOT_FOUND: 'User not found.',
    PROFILE_FETCHED: 'Profile fetched successfully.',
    PROFILE_UPDATED: 'Profile updated successfully.',
    ACCOUNT_DELETED: 'Account deleted successfully.',
  },
  VALIDATION: {
    FAILED: 'Validation failed.',
  },
  SERVER: {
    INTERNAL_ERROR: 'Something went wrong. Please try again later.',
    ROUTE_NOT_FOUND: 'The requested route does not exist.',
  },
});
