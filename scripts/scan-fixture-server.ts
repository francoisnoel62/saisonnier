// Serveur local réservé à Playwright ; aucune dépendance aux portails réels.
import { createScanFixtureServer } from "../src/test/scan-fixture-server"

const port = Number(process.env.SCAN_FIXTURE_PORT ?? 3200)
const fixtures = createScanFixtureServer(port)
void fixtures
  .listen()
  .then(() => console.log(`Fixtures scan : http://localhost:${port}`))
for (const signal of ["SIGTERM", "SIGINT"] as const)
  process.on(signal, () => void fixtures.close())
