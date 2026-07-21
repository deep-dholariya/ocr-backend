import { param, query, body } from 'express-validator';

/**
 * OCR / Business Card Validators
 * express-validator chains for the business-card endpoints. These exist
 * primarily to reject malformed input early (before it reaches Mongo)
 * and to enumerate exactly which fields a client is allowed to send.
 */

const MONGO_ID_REGEX = /^[0-9a-fA-F]{24}$/;

export const cardIdValidator = [
  param('id')
    .matches(MONGO_ID_REGEX)
    .withMessage('Invalid business card id.'),
];

export const searchCardsValidator = [
  query('q')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search query must be at most 100 characters.'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('page must be a positive integer.')
    .toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('limit must be between 1 and 100.')
    .toInt(),
];

// Only these fields may ever be written by a client via PUT /api/ocr/cards/:id.
// imagePath, extractedText, rawLines, structuredData, status, user, and any
// Mongo internals (_id, __v) are intentionally NOT updatable from the API —
// exposing them would allow a client to overwrite server-managed data
// (mass-assignment).
export const updateCardValidator = [
  ...cardIdValidator,
  body('name').optional().trim().isLength({ max: 200 }).escape(),
  body('company').optional().trim().isLength({ max: 200 }).escape(),
  body('designation').optional().trim().isLength({ max: 200 }).escape(),
  body('email')
    .optional({ checkFalsy: true })
    .trim()
    .isEmail()
    .withMessage('Invalid email.')
    .customSanitizer((value) => value.toLowerCase()),
  body('phone').optional().trim().isLength({ max: 50 }).escape(),
  body('website').optional().trim().isLength({ max: 200 }).escape(),
  body('address').optional().trim().isLength({ max: 500 }).escape(),
  body().custom((value) => {
    if (!value || Object.keys(value).length === 0) {
      throw new Error('Request body cannot be empty.');
    }
    return true;
  }),
];

// Field whitelist used by the service layer as a second line of defense,
// independent of validation, so a future route change can't accidentally
// reintroduce mass-assignment.
export const UPDATABLE_CARD_FIELDS = [
  'name',
  'company',
  'designation',
  'email',
  'phone',
  'website',
  'address',
];
