import { defineConfig } from "eslint/config";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import typescriptParser from "@typescript-eslint/parser";
import importPlugin from "eslint-plugin-import";
import prettierPlugin from "eslint-plugin-prettier";
import prettierConfig from "eslint-config-prettier";

/**
 * Shared ESLint configuration for the monorepo.
 * Workspaces can extend this config and add their own rules.
 */
export default defineConfig([
  // Ignore patterns (replaces .eslintignore)
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/out/**",
      "**/dist/**",
      "**/build/**",
      "**/lib/**",
      "**/*.min.js",
      "**/*.bundle.js",
      "**/.firebase/**",
      "**/.cache/**",
      "**/.parcel-cache/**",
      "**/.turbo/**",
      "**/.yarn/**",
      "**/coverage/**",
      "**/.nyc_output/**",
      "**/*.tsbuildinfo",
    ],
  },
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      "@typescript-eslint": typescriptEslint,
      import: importPlugin,
      prettier: prettierPlugin,
    },
    rules: {
      // Prettier integration
      "prettier/prettier": "error",

      // TypeScript rules
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-explicit-any": "warn",

      // Import rules
      "import/order": [
        "error",
        {
          groups: [
            "builtin",
            "external",
            "internal",
            "parent",
            "sibling",
            "index",
          ],
          "newlines-between": "always",
          alphabetize: {
            order: "asc",
            caseInsensitive: true,
          },
        },
      ],
      "import/no-unresolved": "off", // TypeScript handles this

      // General rules
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  prettierConfig, // Must be last to override other configs
]);

