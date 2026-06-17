/**
 * Structured logger for the scraper subsystem.
 *
 * Outputs JSON lines to stdout/stderr so logs are machine-parseable
 * by any downstream log aggregation tool (Datadog, CloudWatch, etc.).
 */

type LogLevel = "info" | "warn" | "error" | "debug";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  [key: string]: unknown;
}

function formatEntry(
  level: LogLevel,
  metadata: Record<string, unknown>,
  message: string,
): string {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...metadata,
  };
  return JSON.stringify(entry);
}

function createLogger(context?: Record<string, unknown>) {
  const baseContext = context || {};

  return {
    /**
     * Create a child logger with additional default context fields.
     */
    child(childContext: Record<string, unknown>) {
      return createLogger({ ...baseContext, ...childContext });
    },

    info(metadata: Record<string, unknown>, message: string) {
      console.log(formatEntry("info", { ...baseContext, ...metadata }, message));
    },

    warn(metadata: Record<string, unknown>, message: string) {
      console.warn(
        formatEntry("warn", { ...baseContext, ...metadata }, message),
      );
    },

    error(metadata: Record<string, unknown>, message: string) {
      console.error(
        formatEntry("error", { ...baseContext, ...metadata }, message),
      );
    },

    debug(metadata: Record<string, unknown>, message: string) {
      if (process.env.LOG_LEVEL === "debug") {
        console.log(
          formatEntry("debug", { ...baseContext, ...metadata }, message),
        );
      }
    },
  };
}

/** Root logger instance for the scraper subsystem. */
export const logger = createLogger({ service: "asset-worker" });
