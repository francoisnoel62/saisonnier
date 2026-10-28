import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".next-e2e/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Rapports Playwright
    "playwright-report/**",
    "test-results/**",
    // Vercel Workflow : données locales, bundles de test et routes générées
    ".workflow-data*/**",
    ".workflow-vitest/**",
    "src/app/.well-known/workflow/**",
  ]),
  // `use`, dans les fixtures Playwright, n'est pas un hook React.
  { files: ["e2e/**"], rules: { "react-hooks/rules-of-hooks": "off" } },
])

export default eslintConfig
