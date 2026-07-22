/**
 * ============================================================
 * Business Card Parser Service
 * ------------------------------------------------------------
 * Uses Google Gemini (gemini-2.0-flash) as the sole parsing
 * engine to turn raw OCR text into structured business-card
 * fields.
 * ============================================================
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const SYSTEM_PROMPT = `You are an expert business card parser.

Your task is to extract structured information from OCR text generated from business cards.

Rules:
- Return ONLY valid JSON.
- Never include markdown.
- Never include explanations.
- Correct obvious OCR mistakes when confidence is high.
- Preserve phone numbers, emails, and websites exactly unless clearly corrupted.
- Support English, Hindi, Gujarati, and multilingual business cards.
- If a field is missing, return an empty string.
- Always return every field.`;

const FIELDS = [
  "name",
  "company",
  "designation",
  "email",
  "phone",
  "website",
  "address"
];

class ParserService {
  buildUserPrompt(rawText) {
    return `Extract:

- name
- company
- designation
- email
- phone
- website
- address

OCR Text:

${rawText}

Return:

{
  "name": "",
  "company": "",
  "designation": "",
  "email": "",
  "phone": "",
  "website": "",
  "address": ""
}`;
  }

  /**
   * Strips accidental markdown code fences from a model response
   * before attempting JSON.parse.
   */
  stripMarkdownFences(text = "") {
    return text
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/, "")
      .replace(/```$/, "")
      .trim();
  }

  /**
   * Parse raw OCR text into structured business-card fields
   * using Gemini as the sole extraction engine.
   * @param {string} rawText - raw text from an OCR engine
   * @param {object} [options] - reserved for future use
   * @returns {Promise<object>} structured result (never throws)
   */
  async parseBusinessCard(rawText = "", options = {}) {
    if (typeof rawText !== "string" || !rawText.trim()) {
      return { success: false, error: "Empty OCR text." };
    }

    console.log("[ParserService] Gemini request start");

    let response;
    try {
      const model = client.getGenerativeModel({
        model: "gemini-2.0-flash",
        systemInstruction: SYSTEM_PROMPT,
        generationConfig: {
          responseMimeType: "application/json"
        }
      });

      const result = await model.generateContent(this.buildUserPrompt(rawText));
      response = result?.response;

      console.log("[ParserService] Gemini request success");
    } catch (err) {
      console.error(
        "[ParserService] Gemini request failure:",
        err && err.message ? err.message : err
      );
      return { success: false, error: "Invalid AI response." };
    }

    try {
      const raw = response?.text ? response.text() : "";
      const cleaned = this.stripMarkdownFences(raw);
      const parsed = JSON.parse(cleaned);

      const result = { success: true };
      for (const field of FIELDS) {
        result[field] = typeof parsed[field] === "string" ? parsed[field] : "";
      }

      return result;
    } catch (err) {
      console.error(
        "[ParserService] Response parsing failure:",
        err && err.message ? err.message : err
      );
      return { success: false, error: "Invalid AI response." };
    }
  }
}

export default new ParserService();