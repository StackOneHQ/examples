/**
 * Logging utility. Verbose logs only when DEBUG is set to reduce noise.
 * Set DEBUG=1 or DEBUG_CHAT=1 in .env.local to enable verbose logging.
 */

const isDevelopment = process.env.NODE_ENV === 'development';
const isDebug = isDevelopment && (process.env.DEBUG === '1' || process.env.DEBUG === 'true' || process.env.DEBUG_CHAT === '1' || process.env.DEBUG_CHAT === 'true');

export const logger = {
  /** Only logs when DEBUG or DEBUG_CHAT is set (in dev). Use for verbose/trace. */
  log: (...args: unknown[]) => {
    if (isDebug) {
      console.log(...args);
    }
  },
  warn: (...args: unknown[]) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },
  error: (...args: unknown[]) => {
    if (isDevelopment) {
      console.error(...args);
    }
  },
  info: (...args: unknown[]) => {
    if (isDebug) {
      console.info(...args);
    }
  },
  debug: (...args: unknown[]) => {
    if (isDebug) {
      console.debug(...args);
    }
  }
};

// For backward compatibility, also export individual functions
export const devLog = logger.log;
export const devWarn = logger.warn;
export const devError = logger.error;
export const devInfo = logger.info;
export const devDebug = logger.debug;
