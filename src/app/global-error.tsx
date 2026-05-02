"use client";

/** Inline-стили — без globals.css для устойчивого бандла на fatal error. Та же палитра, что и приложение. */
export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ru">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          backgroundColor: "#000000",
          color: "#ffffff",
          fontFamily: 'ui-sans-serif, system-ui, "Segoe UI", Roboto, sans-serif',
          padding: "1.75rem",
          WebkitFontSmoothing: "antialiased"
        }}
      >
        <div style={{ maxWidth: 420, margin: "0 auto" }}>
          <h1
            style={{
              fontSize: "0.8rem",
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              marginBottom: "0.75rem"
            }}
          >
            Что-то сломалось
          </h1>
          <p style={{ fontSize: "0.9rem", lineHeight: 1.55, color: "#808080", marginBottom: "1rem" }}>
            Перезагрузите страницу или снова выполните{" "}
            <code style={{ background: "rgb(255 255 255 / 0.08)", padding: "0.15rem 0.35rem", borderRadius: 6 }}>npm run dev</code>.
            Если пустой экран — проверьте{" "}
            <code style={{ background: "rgb(255 255 255 / 0.08)", padding: "0.15rem 0.35rem", borderRadius: 6 }}>DATABASE_URL</code>{" "}
            и схему БД:{" "}
            <code style={{ background: "rgb(255 255 255 / 0.08)", padding: "0.15rem 0.35rem", borderRadius: 6 }}>npx prisma db push</code>
            или{" "}
            <code style={{ background: "rgb(255 255 255 / 0.08)", padding: "0.15rem 0.35rem", borderRadius: 6 }}>npx prisma migrate deploy</code>.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              padding: "0.75rem 1.25rem",
              borderRadius: 8,
              border: "none",
              background: "#003322",
              color: "#ffffff",
              fontWeight: 700,
              fontSize: "11px",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              cursor: "pointer"
            }}
          >
            Попробовать снова
          </button>
          {process.env.NODE_ENV === "development" ? (
            <pre
              style={{
                marginTop: "1.25rem",
                fontSize: 11,
                color: "#808080",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                padding: "0.65rem",
                borderRadius: 8,
                background: "rgb(255 255 255 / 0.06)",
                border: "1px solid rgb(255 255 255 / 0.12)"
              }}
            >
              {error.message}
            </pre>
          ) : null}
        </div>
      </body>
    </html>
  );
}
