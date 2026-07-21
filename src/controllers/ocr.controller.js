import ocrService from "../services/ocr.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";

/**
 * OCR Controller
 * Thin HTTP layer over ocrService. Wrapped in asyncHandler so any
 * rejected promise is forwarded to the centralized error handler,
 * keeping error responses consistent with the rest of the API.
 */
class OCRController {
  /**
   * POST /api/ocr/scan
   */
  scanBusinessCard = asyncHandler(async (req, res) => {
    const userId = req.userId;
    const result = await ocrService.scanBusinessCard(userId, req.file);
    return new ApiResponse(201, result, result.message).send(res);
  });

  /**
   * GET /api/ocr/cards
   */
  getCards = asyncHandler(async (req, res) => {
    const userId = req.userId;
    const cards = await ocrService.getCards(userId);
    return new ApiResponse(200, { cards }, "Business cards fetched successfully.").send(res);
  });

  /**
   * GET /api/ocr/cards/search?q=&page=&limit=
   */
  searchCards = asyncHandler(async (req, res) => {
    const userId = req.userId;
    const { q = "", page = 1, limit = 20 } = req.query;

    const result = await ocrService.searchCards(userId, q, Number(page), Number(limit));
    return new ApiResponse(200, result, "Search completed successfully.").send(res);
  });

  /**
   * GET /api/ocr/cards/:id
   */
  getCard = asyncHandler(async (req, res) => {
    const userId = req.userId;
    const card = await ocrService.getCard(req.params.id, userId);
    return new ApiResponse(200, { card }, "Business card fetched successfully.").send(res);
  });

  /**
   * PUT /api/ocr/cards/:id
   */
  updateCard = asyncHandler(async (req, res) => {
    const userId = req.userId;
    const card = await ocrService.updateCard(req.params.id, userId, req.body);
    return new ApiResponse(200, { card }, "Business card updated successfully.").send(res);
  });

  /**
   * DELETE /api/ocr/cards/:id
   */
  deleteCard = asyncHandler(async (req, res) => {
    const userId = req.userId;
    const result = await ocrService.deleteCard(req.params.id, userId);
    return new ApiResponse(200, null, result.message).send(res);
  });
}

export default new OCRController();
