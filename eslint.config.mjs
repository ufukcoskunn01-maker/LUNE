import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.property.name='upload']",
          message: "Use src/features/files/uploadFile.ts instead of direct Supabase upload calls.",
        },
      ],
    },
  },
  {
    files: ["src/features/files/uploadFile.ts"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Project-specific archives and extracted vendor assets:
    "_archive/**",
    "_zip_tmp/**",
  ]),
]);

export default eslintConfig;
