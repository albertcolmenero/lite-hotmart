"use client";

import { useEffect } from "react";

/**
 * Last-resort boundary for when the root layout itself throws. It replaces the
 * whole document, so globals.css and the app logger may not be available —
 * everything here is inline and self-contained.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(
      JSON.stringify({
        level: "error",
        msg: error.message,
        boundary: "global",
        digest: error.digest,
        stack: error.stack,
      }),
    );
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          background: "#FBFAF8",
          color: "#0A0A0B",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif',
        }}
      >
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600, margin: 0 }}>
            Something went wrong
          </h1>
          <p style={{ marginTop: 8, color: "#6B6B6B" }}>
            The page failed to load. Please try again.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: 24,
              height: 40,
              padding: "0 16px",
              borderRadius: 10,
              border: "1px solid #0A0A0B",
              background: "#0A0A0B",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
