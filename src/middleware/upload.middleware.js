import multer from "multer";
import upload from "../config/multer.js";

// Single Business Card Upload
export const uploadBusinessCard = (req, res, next) => {
  const handler = upload.single("businessCard");

  handler(req, res, (err) => {
    // Multer Errors
    if (err instanceof multer.MulterError) {
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }

    // Custom Errors
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }

    // File Required
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Business card image is required.",
      });
    }

    next();
  });
};