import fs from "fs";
import path from "path";

import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

class PythonService {
  /**
   * Sends the image to the Python OCR service over HTTP, with a hard
   * timeout so a stuck/hung PaddleOCR call can never block a request
   * (and its Express worker) indefinitely.
   *
   * This preserves the exact same contract the previous in-process
   * `spawn()` implementation had: resolves with the parsed OCR result
   * object on success, rejects with an Error (or ApiTimeoutError) on
   * failure.
   */
  runOnce(imagePath) {
    return new Promise((resolve, reject) => {
      const controller = new AbortController();

      const timer = setTimeout(() => {
        controller.abort();
      }, env.OCR_TIMEOUT_MS);
      timer.unref?.();

      (async () => {
        try {
          const fileBuffer = await fs.promises.readFile(imagePath);
          const fileName = path.basename(imagePath);

          const form = new FormData();
          form.append("image", new Blob([fileBuffer]), fileName);

          const response = await fetch(
            `${env.PYTHON_API_URL}/api/ocr/process`,
            {
              method: "POST",
              body: form,
              signal: controller.signal,
            },
          );

          let result;

          try {
            console.log("STATUS:", response.status);

            const text = await response.text();

            console.log("RAW PYTHON RESPONSE:");
            console.log(text);

            result = JSON.parse(text);
          } catch (error) {
            console.log("JSON ERROR:", error.message);

            return reject(new Error("Invalid JSON received from Python OCR."));
          }

          if (!response.ok || !result.success) {
            return reject(
              new Error(
                result.error ||
                  `Python OCR service responded with status ${response.status}.`,
              ),
            );
          }

          resolve(result);
        } catch (error) {
          if (error.name === "AbortError") {
            return reject(
              new ApiTimeoutError(
                `OCR processing timed out after ${env.OCR_TIMEOUT_MS}ms.`,
              ),
            );
          }

          reject(
            new Error(`Failed to reach Python OCR service: ${error.message}`),
          );
        } finally {
          clearTimeout(timer);
        }
      })();
    });
  }

  /**
   * Runs OCR with automatic retry.
   * Retries once on timeout or transient network failure (not on a
   * clean OCR-side failure such as "unsupported image format", since
   * retrying a deterministic failure just wastes a second GPU/CPU pass).
   */
  async runOCR(imagePath) {
    try {
      return await this.runOnce(imagePath);
    } catch (error) {
      if (error instanceof ApiTimeoutError) {
        logger.warn("OCR attempt timed out, retrying once", { imagePath });
        return this.runOnce(imagePath);
      }
      throw error;
    }
  }
}

class ApiTimeoutError extends Error {}

export default new PythonService();
