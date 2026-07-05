"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#08111f", color: "#f8fafc", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ maxWidth: 420, textAlign: "center", padding: "2rem" }}>
          <h1 style={{ fontSize: "1.4rem", marginBottom: "0.6rem" }}>Something went wrong</h1>
          <p style={{ color: "#94a3b8", marginBottom: "1.4rem" }}>
            An unexpected error occurred. Our team has been notified.
          </p>
          <button
            onClick={reset}
            style={{ background: "#2563eb", color: "#fff", border: 0, borderRadius: 10, padding: "0.6rem 1.2rem", fontWeight: 700, cursor: "pointer" }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
