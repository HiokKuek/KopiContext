import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

/**
 * Keep the framework's recommended performance, accessibility, React, and
 * TypeScript checks enabled for every application and platform source file.
 *
 * This follows the local Next.js ESLint guide. The only global ignores are
 * generated build output and Next's generated environment declaration.
 */
export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      // An underscore makes an intentionally unused binding explicit, which is
      // useful when an adapter's complete shape is intentionally preserved.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);
