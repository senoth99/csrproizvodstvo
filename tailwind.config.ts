import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#090b0f",
        surface: "#11141a",
        card: "#131720",
        border: "#232833",
        accent: "#ffffff",
        foreground: "#f5f7fb",
        muted: "#9ba3b2"
      }
    }
  },
  plugins: []
};

export default config;
