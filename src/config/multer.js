import multer from "multer";
import fs from "fs";
import path from "path";

import { env } from "./env.js";

// -----------------------------------------------------------------------------
// Upload Directories
// -----------------------------------------------------------------------------

const uploadDir = path.resolve(env.UPLOAD_DIR);

const originalDir = path.join(uploadDir, "originals");

// Create upload directories if they don't exist
fs.mkdirSync(originalDir, { recursive: true });

// -----------------------------------------------------------------------------
// Multer Storage
// -----------------------------------------------------------------------------

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, originalDir);
  },

  filename: (_req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();

    const fileName = `${Date.now()}-${Math.round(
      Math.random() * 1e9
    )}${extension}`;

    cb(null, fileName);
  },
});

// -----------------------------------------------------------------------------
// Allowed MIME Types
// -----------------------------------------------------------------------------

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

// -----------------------------------------------------------------------------
// File Filter
// -----------------------------------------------------------------------------

const fileFilter = (_req, file, cb) => {
  if (allowedMimeTypes.has(file.mimetype)) {
    return cb(null, true);
  }

  cb(
    new Error(
      "Invalid file type. Only JPG, JPEG, PNG and WEBP images are allowed."
    )
  );
};

// -----------------------------------------------------------------------------
// Multer Instance
// -----------------------------------------------------------------------------

const upload = multer({
  storage,

  fileFilter,

  limits: {
    fileSize: env.MAX_FILE_SIZE,
  },
});

export default upload;