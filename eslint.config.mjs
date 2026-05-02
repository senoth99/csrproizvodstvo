import js from "@eslint/js";
import nextEslintPkg from "@next/eslint-plugin-next";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

const { flatConfig: nextFlatConfigs } = nextEslintPkg;

export default defineConfig(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  nextFlatConfigs.coreWebVitals,
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "postcss.config.js",
      "tailwind.config.js",
      "next-env.d.ts",
      "ecosystem.config.js"
    ]
  },
  {
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { jsx: true }
      }
    },
    linterOptions: {
      reportUnusedDisableDirectives: true
    }
  }
);
