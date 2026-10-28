import type { NextConfig } from "next"
import { withWorkflow } from "workflow/next"

const nextConfig: NextConfig = {
  // L'E2E lance son propre `next dev` (port 3100) : Next refuse deux serveurs de développement
  // dans un même distDir.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  turbopack: {
    rules: {
      "*.css": {
        // Préserver le traitement natif des CSS Modules par Next.js.
        condition: { not: { path: "*.module.css" } },
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
}

// Directives "use workflow" et "use step" du scan (src/workflows/).
export default withWorkflow(nextConfig)
