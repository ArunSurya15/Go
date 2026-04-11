"use client";

import { useEffect } from "react";
import { RefreshCw, WifiOff } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[e-GO global error]", error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f8fafc" }}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem",
            textAlign: "center",
          }}
        >
          {/* Icon */}
          <div
            style={{
              width: 72, height: 72,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #4f46e5, #2563eb)",
              display: "flex", alignItems: "center", justifyContent: "center",
              marginBottom: "1.5rem",
              boxShadow: "0 4px 24px rgba(79,70,229,0.25)",
            }}
          >
            <WifiOff size={32} color="white" />
          </div>

          {/* e-GO wordmark */}
          <div
            style={{
              background: "#4f46e5", color: "white",
              fontWeight: 700, fontSize: "1rem",
              padding: "0.2rem 0.75rem", borderRadius: "0.5rem",
              marginBottom: "1.25rem", letterSpacing: "0.05em",
            }}
          >
            e-GO
          </div>

          <h1 style={{ fontSize: "2rem", fontWeight: 800, color: "#0f172a", margin: "0 0 0.75rem" }}>
            We hit a dead end.
          </h1>
          <p style={{ color: "#64748b", fontSize: "1rem", maxWidth: 420, lineHeight: 1.6, margin: "0 0 2rem" }}>
            Something critical broke before the page could load. This is on us — our team has been notified.
            Please try refreshing, or come back in a moment.
          </p>

          {error.digest && (
            <div
              style={{
                background: "#f1f5f9", border: "1px solid #e2e8f0",
                borderRadius: "0.75rem", padding: "0.5rem 1rem",
                fontSize: "0.75rem", color: "#94a3b8", fontFamily: "monospace",
                marginBottom: "1.5rem",
              }}
            >
              Error ref: {error.digest}
            </div>
          )}

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center" }}>
            <button
              onClick={reset}
              style={{
                display: "flex", alignItems: "center", gap: "0.5rem",
                background: "#4f46e5", color: "white",
                border: "none", borderRadius: "0.75rem",
                padding: "0.65rem 1.25rem", fontWeight: 600,
                fontSize: "0.875rem", cursor: "pointer",
              }}
            >
              <RefreshCw size={16} />
              Try again
            </button>
            <a
              href="/"
              style={{
                display: "flex", alignItems: "center", gap: "0.5rem",
                background: "white", color: "#334155",
                border: "1px solid #e2e8f0", borderRadius: "0.75rem",
                padding: "0.65rem 1.25rem", fontWeight: 500,
                fontSize: "0.875rem", textDecoration: "none",
              }}
            >
              Go to homepage
            </a>
          </div>

          <p style={{ marginTop: "2rem", fontSize: "0.75rem", color: "#94a3b8" }}>
            Persistent issues? Email us at{" "}
            <a href="mailto:support@e-go.in" style={{ color: "#6366f1" }}>support@e-go.in</a>
          </p>
        </div>
      </body>
    </html>
  );
}
