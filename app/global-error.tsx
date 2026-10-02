"use client";
/** Last-resort error page (the root layout itself failed). Plain HTML: no data, no site chrome. */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="en-AU">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          padding: "3rem 1rem",
          textAlign: "center",
          color: "#0f172a",
        }}
      >
        <h1 style={{ fontSize: "1.75rem" }}>Sorry — something went wrong</h1>
        <p style={{ color: "#475569" }}>
          Please try again in a moment. If you were making a booking, please call us instead.
        </p>
        <button
          onClick={() => retry()}
          style={{
            marginTop: "1rem",
            background: "#0f766e",
            color: "white",
            border: 0,
            borderRadius: 8,
            padding: "0.75rem 1.5rem",
            fontWeight: 600,
          }}
        >
          Try again
        </button>
        {error.digest && (
          <p style={{ marginTop: "2rem", fontSize: 12, color: "#94a3b8" }}>
            Error ID: {error.digest}
          </p>
        )}
      </body>
    </html>
  );
}
