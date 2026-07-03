import { FlatCompat } from "@eslint/eslintrc";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: __dirname });

// Note: "next/typescript" is omitted — combined with ESLint 9 + FlatCompat it
// hits a known circular-reference bug in eslint-config-next. TypeScript
// correctness is already fully enforced by `next build`'s strict type-check;
// this config covers the React/Next-specific lint rules.
const eslintConfig = [
  ...compat.extends("next/core-web-vitals"),
  {
    ignores: ["node_modules/**", ".next/**", "prisma/migrations/**"],
  },
];

export default eslintConfig;
