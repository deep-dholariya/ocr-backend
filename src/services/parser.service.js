/**
 * ============================================================
 * Business Card Parser Service
 * ------------------------------------------------------------
 * Uses OpenAI (gpt-5-mini) as the sole parsing engine to turn
 * raw OCR text into structured business-card fields.
 * ============================================================
 */

import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

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
   * using OpenAI as the sole extraction engine.
   * @param {string} rawText - raw text from an OCR engine
   * @param {object} [options] - reserved for future use
   * @returns {Promise<object>} structured result (never throws)
   */
  async parseBusinessCard(rawText = "", options = {}) {
    if (typeof rawText !== "string" || !rawText.trim()) {
      return { success: false, error: "Empty OCR text." };
    }

    console.log("[ParserService] OpenAI request start");

    let response;
    try {
      response = await client.chat.completions.create({
        model: "gpt-5-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: this.buildUserPrompt(rawText) }
        ]
      });

      console.log("[ParserService] OpenAI request success");
    } catch (err) {
      console.error(
        "[ParserService] OpenAI request failure:",
        err && err.message ? err.message : err
      );
      return { success: false, error: "Invalid AI response." };
    }

    try {
      const raw = response?.choices?.[0]?.message?.content ?? "";
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