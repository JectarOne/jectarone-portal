import "server-only";

// Minimal structured (JSON-line) logger for server code. One line per event so
// Vercel Runtime Logs / log drains can parse and index fields. Errors are also
// forwarded to Sentry when configured.

type Level = "debug" | "info" | "warn" | "error";
type Fields = Record<string, unknown>;

function emit(level: Level, message: string, fields?: Fields, err?: unknown) {
  const entry: Fields = {
    level,
    time: new Date().toISOString(),
    message,
    ...fields,
  };
  if (err instanceof Error) {
    entry.error = err.message;
    entry.stack = err.stack;
  } else if (err !== undefined) {
    entry.error = String(err);
  }
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);

  if (level === "error" && process.env.SENTRY_DSN) {
    // Lazy import so the SDK is only pulled when a DSN is configured.
    import("@sentry/nextjs")
      .then((S) => (err instanceof Error ? S.captureException(err, { extra: fields }) : S.captureMessage(message, { level: "error", extra: fields })))
      .catch(() => {});
  }
}

export const logger = {
  debug: (message: string, fields?: Fields) => emit("debug", message, fields),
  info: (message: string, fields?: Fields) => emit("info", message, fields),
  warn: (message: string, fields?: Fields) => emit("warn", message, fields),
  error: (message: string, err?: unknown, fields?: Fields) => emit("error", message, fields, err),
};
