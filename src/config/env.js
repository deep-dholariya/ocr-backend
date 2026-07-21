import dotenv from 'dotenv';

dotenv.config();

/**
 * Environment Validation
 *
 * Fails fast (at boot) if any required environment variable is missing,
 * rather than surfacing confusing errors deep inside the request lifecycle.
 */

const REQUIRED_VARS = [
  'MONGODB_URI',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_CALLBACK_URL',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'CLIENT_URL',
  'PYTHON_API_URL',
];

const missing = REQUIRED_VARS.filter(
  (key) => !process.env[key] || process.env[key].trim() === ''
);

if (missing.length > 0) {
  throw new Error(
    `Missing required environment variable(s): ${missing.join(', ')}. ` +
      'Copy .env.example to .env and fill in the values.'
  );
}

if (process.env.NODE_ENV === 'production') {
  const insecureDefaults = [
    'replace_with_a_long_random_access_secret',
    'replace_with_a_long_random_refresh_secret',
  ];

  if (
    insecureDefaults.includes(process.env.JWT_ACCESS_SECRET) ||
    insecureDefaults.includes(process.env.JWT_REFRESH_SECRET)
  ) {
    throw new Error(
      'Refusing to start in production with default/placeholder JWT secrets.'
    );
  }
}

export const env = Object.freeze({
  // ---------------------------------------------------------------------------
  // Application
  // ---------------------------------------------------------------------------

  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: Number(process.env.PORT) || 5000,
  SERVER_URL:
    process.env.SERVER_URL ||
    `http://localhost:${process.env.PORT || 5000}`,
  CLIENT_URL: process.env.CLIENT_URL,

  // ---------------------------------------------------------------------------
  // Database
  // ---------------------------------------------------------------------------

  MONGODB_URI: process.env.MONGODB_URI,

  // ---------------------------------------------------------------------------
  // Google OAuth
  // ---------------------------------------------------------------------------

  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL,

  // ---------------------------------------------------------------------------
  // JWT
  // ---------------------------------------------------------------------------

  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,

  JWT_ACCESS_EXPIRY:
    process.env.JWT_ACCESS_EXPIRY || '15m',

  JWT_REFRESH_EXPIRY:
    process.env.JWT_REFRESH_EXPIRY || '7d',

  // ---------------------------------------------------------------------------
  // Cookies
  // ---------------------------------------------------------------------------

  COOKIE_DOMAIN: process.env.COOKIE_DOMAIN || '',

  // ---------------------------------------------------------------------------
  // OCR
  // ---------------------------------------------------------------------------

  // Base URL of the standalone Python OCR service (Service 2 on Render).
  // e.g. http://localhost:5001 in dev, https://<python-service>.onrender.com in prod.
  // No trailing slash.
  PYTHON_API_URL: process.env.PYTHON_API_URL,

  UPLOAD_DIR: process.env.UPLOAD_DIR || 'uploads',

  MAX_FILE_SIZE:
    Number(process.env.MAX_FILE_SIZE) ||
    10 * 1024 * 1024, // 10 MB

  // Hard timeout (ms) for a single call to the Python OCR service, so a
  // hung/stuck OCR call can never block a request indefinitely.
  OCR_TIMEOUT_MS: Number(process.env.OCR_TIMEOUT_MS) || 30000,
});