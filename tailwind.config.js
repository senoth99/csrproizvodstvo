/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./src/**/*.{js,ts,jsx,tsx}", "./src/app/globals.css"],
  theme: {
    extend: {
      /** Без загрузки шрифтов с Google (редкие 500/таймауты на проде) — UI Sans / Inter-подобный стек */
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif"
        ]
      },
      colors: {
        /** Techwear/minimal dark: pure black & white + deep forest green + dusty rose accents. */
        /** Чуть светлее чистого чёрного — контраст к шапке/нижней панели (bg-black). */
        background: "#0b0b0c",
        foreground: "#ffffff",
        muted: "#808080",
        accent: "#003322",
        /** Плашки «ожидание» / вторичный акцент (референс с розовато-пыльным маркетинговым блоком). */
        highlight: "#b89a93",
        /** Панели/карточки — чуть темнее canvas (`background`), чтобы блоки читались без лишнего акцента на рамке */
        surface: "#060607",
        card: "#060607",
        border: "rgb(255 255 255 / 0.12)"
      },
      letterSpacing: {
        display: "0.14em"
      }
    }
  },
  plugins: []
};
