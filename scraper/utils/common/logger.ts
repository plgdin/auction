/**
 * Structured logger for the scraper subsystem.
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
    child(childContext: Record<string, unknown>) {
      return createLogger({ ...baseContext, ...childContext });
    },

    info(metadata: Record<string, unknown> | string, message?: string) {
      if (typeof metadata === "string") {
        console.log(formatEntry("info", baseContext, metadata));
      } else {
        console.log(formatEntry("info", { ...baseContext, ...metadata }, message || ""));
      }
    },

    warn(metadata: Record<string, unknown> | string, message?: string) {
      if (typeof metadata === "string") {
        console.warn(formatEntry("warn", baseContext, metadata));
      } else {
        console.warn(
          formatEntry("warn", { ...baseContext, ...metadata }, message || ""),
        );
      }
    },

    error(metadata: Record<string, unknown> | string, message?: string) {
      if (typeof metadata === "string") {
        console.error(formatEntry("error", baseContext, metadata));
      } else {
        console.error(
          formatEntry("error", { ...baseContext, ...metadata }, message || ""),
        );
      }
    },

    debug(metadata: Record<string, unknown> | string, message?: string) {
      if (process.env.LOG_LEVEL === "debug") {
        if (typeof metadata === "string") {
          console.log(formatEntry("debug", baseContext, metadata));
        } else {
          console.log(
            formatEntry("debug", { ...baseContext, ...metadata }, message || ""),
          );
        }
      }
    },
  };
}

export const logger = createLogger({ service: "asset-worker" });
