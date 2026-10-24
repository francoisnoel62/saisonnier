import { expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  env: { SCAN_TEST_SOURCE_URL: undefined as string | undefined },
}))
vi.mock("@/lib/env", () => ({ env: mocks.env }))

import { context, testDefinitions } from "./adapter-test-fixtures"
import { fixtureAdapter } from "./fixture"

it("l'adaptateur de test n'existe que si sa source locale est explicitement définie", async () => {
  expect(fixtureAdapter()).toBeNull()
  mocks.env.SCAN_TEST_SOURCE_URL = "http://localhost:3200"
  const adapter = fixtureAdapter()!
  const ctx = context(testDefinitions.fixture, {
    "http://localhost:3200/": '<a href="/jobs/1">Serveur de test</a>',
    "http://localhost:3200/jobs/1":
      '<h1>Serveur</h1><p>CDD saisonnier pour notre restaurant.</p><script type="application/ld+json">{"@type":"JobPosting","title":"Serveur","description":"Nous recherchons un serveur en CDD saisonnier pour notre restaurant."}</script>',
  })
  const list = await adapter.listPage(ctx, null)
  if (list.kind !== "listed") throw new Error(list.kind)
  expect(list.postings).toHaveLength(1)
  expect(await adapter.readPosting(ctx, list.postings[0])).toMatchObject({
    kind: "extracted",
    posting: { title: "Serveur" },
  })
  mocks.env.SCAN_TEST_SOURCE_URL = undefined
})
