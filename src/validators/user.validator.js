import { body } from 'express-validator';

/**
 * User Validators
 * express-validator chains for user-facing endpoints.
 */

export const updateProfileValidator = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters.')
    .escape(),
  body('picture')
    .optional()
    .trim()
    .isURL()
    .withMessage('Picture must be a valid URL.'),
  body().custom((value) => {
    if (!value || (Object.keys(value).length === 0)) {
      throw new Error('Request body cannot be empty.');
    }
    return true;
  }),
];
