import { Router } from "express";

import ocrController from "../controllers/ocr.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { uploadBusinessCard } from "../middleware/upload.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import { ocrScanLimiter } from "../middleware/rateLimiter.middleware.js";
import {
  cardIdValidator,
  searchCardsValidator,
  updateCardValidator,
} from "../validators/ocr.validator.js";

const router = Router();

/**
 * --------------------------------------------------------------------------
 * POST /api/ocr/scan
 * Scan Business Card
 * Rate-limited separately from the global limiter: OCR is CPU/GPU-heavy
 * (spawns a Python process per request), so it gets a tighter ceiling to
 * protect the server from being overwhelmed.
 * --------------------------------------------------------------------------
 */
router.post(
  "/scan",
  requireAuth,
  ocrScanLimiter,
  uploadBusinessCard,
  ocrController.scanBusinessCard
);

/**
 * --------------------------------------------------------------------------
 * GET /api/ocr/cards
 * Get All Business Cards
 * --------------------------------------------------------------------------
 */
router.get(
  "/cards",
  requireAuth,
  ocrController.getCards
);

/**
 * --------------------------------------------------------------------------
 * GET /api/ocr/cards/search?q=
 * Search Business Cards
 * IMPORTANT:
 * Keep this route ABOVE /cards/:id
 * --------------------------------------------------------------------------
 */
router.get(
  "/cards/search",
  requireAuth,
  searchCardsValidator,
  validate,
  ocrController.searchCards
);

/**
 * --------------------------------------------------------------------------
 * GET /api/ocr/cards/:id
 * Get Business Card By ID
 * --------------------------------------------------------------------------
 */
router.get(
  "/cards/:id",
  requireAuth,
  cardIdValidator,
  validate,
  ocrController.getCard
);

/**
 * --------------------------------------------------------------------------
 * PUT /api/ocr/cards/:id
 * Update Business Card
 * --------------------------------------------------------------------------
 */
router.put(
  "/cards/:id",
  requireAuth,
  updateCardValidator,
  validate,
  ocrController.updateCard
);

/**
 * --------------------------------------------------------------------------
 * DELETE /api/ocr/cards/:id
 * Delete Business Card
 * --------------------------------------------------------------------------
 */
router.delete(
  "/cards/:id",
  requireAuth,
  cardIdValidator,
  validate,
  ocrController.deleteCard
);

export default router;
