import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';
import { MESSAGES } from '../constants/message.constant.js';
import { env } from '../config/env.js';

/**
 * Central Error Handler.
 * Every thrown/forwarded error in the app funnels through here, guaranteeing
 * a single, consistent JSON error response shape and centralized logging.
 *
 * Must be registered LAST, after all routes and other middleware.
 */
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, _next) => {
  let error = err;

  // Normalize unexpected (non-ApiError) errors into ApiError so the response
  // shape is always consistent, without leaking internals to the client.
  if (!(error instanceof ApiError)) {
    const statusCode = error.statusCode || 500;
    const message = error.message || MESSAGES.SERVER.INTERNAL_ERROR;
    error = new ApiError(statusCode, message, [], false);
  }

  const isServerError = error.statusCode >= 500;

  if (isServerError) {
    logger.error(error.message, {
      path: req.originalUrl,
      method: req.method,
      stack: err.stack,
    });
  } else {
    logger.warn(error.message, { path: req.originalUrl, method: req.method });
  }

  return res.status(error.statusCode).json({
    success: false,
    message: isServerError && env.NODE_ENV === 'production' ? MESSAGES.SERVER.INTERNAL_ERROR : error.message,
    errors: error.errors || [],
    // Stack traces are only ever exposed outside production, and only for real bugs.
    ...(env.NODE_ENV !== 'production' && isServerError ? { stack: err.stack } : {}),
  });
};
