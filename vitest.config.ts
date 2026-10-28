import { fileURLToPath } from "node:url"
// Import par défaut : Vite charge ce fichier en ESM natif (@next/env est en CommonJS).
import nextEnv from "@next/env"
import { workflow } from "@workflow/vitest"
import { defineConfig } from "vitest/config"

// Vitest fixe NODE_ENV à "test" : Next charge alors .env.test.local (base saisonnier_test).
nextEnv.loadEnvConfig(process.cwd())

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Hors de Next, « server-only » refuse tout import : les tests importent les modules serveur.
      "server-only": fileURLToPath(
        new URL("./src/test/server-only.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/**/*.test.ts"],
          exclude: ["src/**/*.int.test.ts", "src/**/*.wf.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["src/**/*.int.test.ts"],
          globalSetup: ["./src/test/integration-setup.ts"],
          // Une seule base partagée : les fichiers s'exécutent l'un après l'autre.
          fileParallelism: false,
        },
      },
      {
        extends: true,
        // Workflows exécutés en mémoire (@workflow/vitest), sur la base de test.
        plugins: [workflow()],
        test: {
          name: "workflow",
          include: ["src/**/*.wf.test.ts"],
          globalSetup: ["./src/test/integration-setup.ts"],
          fileParallelism: false,
          testTimeout: 60_000,
        },
      },
    ],
  },
})
