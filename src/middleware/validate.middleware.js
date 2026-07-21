import { validationResult } from 'express-validator';
import { ApiError } from '../utils/ApiError.js';
import { MESSAGES } from '../constants/message.constant.js';

/**
 * Runs after an array of express-validator checks. If any failed,
 * short-circuits the request with a 400 and a structured error list.
 * Otherwise passes control to the actual controller.
 */
export const validate = (req, _res, next) => {
  const errors = validationResult(req);

  if (errors.isEmpty()) {
    return next();
  }

  const formattedErrors = errors.array().map((err) => ({
    field: err.path,
    message: err.msg,
  }));

  next(ApiError.badRequest(MESSAGES.VALIDATION.FAILED, formattedErrors));
};
