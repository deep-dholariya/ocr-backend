/**
 * Wraps an async Express route/middleware handler so that any rejected
 * promise (thrown error) is forwarded to next(), instead of requiring
 * a try/catch block in every single controller.
 *
 * Usage: router.get('/route', asyncHandler(controllerFn));
 */
export const asyncHandler = (requestHandler) => (req, res, next) => {
  Promise.resolve(requestHandler(req, res, next)).catch(next);
};
