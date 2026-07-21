/**
 * Minimal, dependency-free structured logger.
 * Replace with winston/pino in a larger production system if needed;
 * this keeps the dependency surface small while still giving
 * timestamped, leveled, structured output.
 */

const LEVELS = Object.freeze({
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG',
});

const isProduction = process.env.NODE_ENV === 'production';

const format = (level, message, meta) => {
  const timestamp = new Date().toISOString();
  const base = `[${timestamp}] [${level}] ${message}`;
  if (meta && Object.keys(meta).length > 0) {
    return `${base} ${JSON.stringify(meta)}`;
  }
  return base;
};

export const logger = {
  info: (message, meta) => console.log(format(LEVELS.INFO, message, meta)),
  warn: (message, meta) => console.warn(format(LEVELS.WARN, message, meta)),
  error: (message, meta) => console.error(format(LEVELS.ERROR, message, meta)),
  debug: (message, meta) => {
    if (!isProduction) {
      console.debug(format(LEVELS.DEBUG, message, meta));
    }
  },
};
