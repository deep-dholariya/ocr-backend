import { ApiError } from '../utils/ApiError.js';
import { MESSAGES } from '../constants/message.constant.js';

/**
 * Catches any request that didn't match a defined route and forwards
 * a 404 ApiError to the central error handler, keeping the 404 response
 * shape consistent with every other error response.
 */
export const notFoundHandler = (req, _res, next) => {
  next(ApiError.notFound(`${MESSAGES.SERVER.ROUTE_NOT_FOUND}: ${req.method} ${req.originalUrl}`));
};
