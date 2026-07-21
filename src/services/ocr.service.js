import path from "path";

import pythonService from "./python.service.js";
import parserService from "./parser.service.js";

import businessCardRepository from "../repositories/businessCard.repository.js";
import { ApiError } from "../utils/ApiError.js";
import { logger } from "../utils/logger.js";
import { UPDATABLE_CARD_FIELDS } from "../validators/ocr.validator.js";

class OCRService {
  /**
   * Scan Business Card
   */
  async scanBusinessCard(userId, file) {
    if (!file) {
      throw ApiError.badRequest("Business card image is required.");
    }

    logger.debug("OCR scan started", { userId, image: file.path });

    const imagePath = path
      .relative(process.cwd(), file.path)
      .replace(/\\/g, "/");

    let ocrResult;

    try {
      ocrResult = await pythonService.runOCR(file.path);
      logger.debug("OCR completed successfully", { userId });
    } catch (error) {
      logger.error("OCR processing failed", { userId, error: error.message });
      throw ApiError.internal(error.message || "Failed to process business card.");
    }

    // -----------------------------
    // OCR Result
    // -----------------------------

    const rawText = (ocrResult.text || "").trim();

    const rawLines =
      Array.isArray(ocrResult.lines) && ocrResult.lines.length
        ? ocrResult.lines
        : rawText
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean);

    // -----------------------------
    // Parse Business Card
    // -----------------------------

    const structuredData = parserService.parseBusinessCard(rawText);

    // -----------------------------
    // Save Database
    // -----------------------------

    const card = await businessCardRepository.create({
      user: userId,
      imagePath,
      extractedText: rawText,
      rawLines,
      name: structuredData.name || "",
      company: structuredData.company || "",
      designation: structuredData.designation || "",
      email: structuredData.email || "",
      phone: structuredData.phone || "",
      website: structuredData.website || "",
      address: structuredData.address || "",
      structuredData,
      status: "processed",
    });

    logger.debug("Business card saved", { userId, cardId: card._id.toString() });

    return {
      success: true,
      message: "Business card scanned successfully.",
      card,
      rawText,
      structuredData,
    };
  }

  /**
   * Get All Cards
   */
  async getCards(userId) {
    return businessCardRepository.findAllByUser(userId);
  }

  /**
   * Search Cards
   */
  async searchCards(userId, q, page = 1, limit = 20) {
    return businessCardRepository.search(userId, q, page, limit);
  }

  /**
   * Get Card By Id
   */
  async getCard(id, userId) {
    const card = await businessCardRepository.findByIdAndUser(id, userId);

    if (!card) {
      throw ApiError.notFound("Business card not found.");
    }

    return card;
  }

  /**
   * Update Card
   * Only whitelisted fields may be written — prevents a client from using
   * this endpoint to overwrite server-managed fields (imagePath, status,
   * rawLines, extractedText, user, structuredData, or Mongo internals).
   */
  async updateCard(id, userId, data) {
    const card = await businessCardRepository.findByIdAndUser(id, userId);

    if (!card) {
      throw ApiError.notFound("Business card not found.");
    }

    const sanitizedUpdates = Object.fromEntries(
      Object.entries(data).filter(
        ([key, value]) => UPDATABLE_CARD_FIELDS.includes(key) && value !== undefined
      )
    );

    if (Object.keys(sanitizedUpdates).length === 0) {
      throw ApiError.badRequest("No valid fields provided to update.");
    }

    return businessCardRepository.update(id, {
      ...sanitizedUpdates,
      structuredData: {
        ...card.structuredData,
        ...sanitizedUpdates,
      },
    });
  }

  /**
   * Delete Card
   */
  async deleteCard(id, userId) {
    const card = await businessCardRepository.findByIdAndUser(id, userId);

    if (!card) {
      throw ApiError.notFound("Business card not found.");
    }

    await businessCardRepository.delete(id);

    return {
      success: true,
      message: "Business card deleted successfully.",
    };
  }
}

export default new OCRService();
