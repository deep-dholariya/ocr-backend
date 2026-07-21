/**
 * Auth Validators
 *
 * Note: /api/auth/refresh and /api/auth/logout intentionally have no body
 * validation because the refresh token is read from the HttpOnly cookie,
 * not from the request body — so there is nothing user-supplied to validate
 * beyond what auth.middleware / token.service already verify.
 *
 * This file exists for structural completeness and future auth-related
 * request bodies (e.g. if additional OAuth providers or profile-linking
 * endpoints are added later).
 */

export const authValidators = {
  // Reserved for future use.
};
