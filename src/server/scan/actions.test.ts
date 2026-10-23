import { beforeEach, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ requireRole: vi.fn(), probe: vi.fn() }))
vi.mock("@/lib/dal", () => ({ requireRole: mocks.requireRole }))
vi.mock("./probe", () => ({ probeScanSource: mocks.probe }))

import { probeScanSourceAction } from "./actions"

beforeEach(() => vi.resetAllMocks())
it("vérifie le rôle admin dans l'action avant de lire la source", async () => {
  mocks.requireRole.mockRejectedValue(new Error("forbidden"))
  await expect(probeScanSourceAction("belambra")).rejects.toThrow("forbidden")
  expect(mocks.requireRole).toHaveBeenCalledWith("admin")
  expect(mocks.probe).not.toHaveBeenCalled()
})
it.each(["missing", "__proto__", "constructor", "https://127.0.0.1"])(
  "refuse une clé non déclarée : %s",
  async (key) => {
    expect(await probeScanSourceAction(key)).toMatchObject({ ok: false })
    expect(mocks.probe).not.toHaveBeenCalled()
  },
)
it("ne permet de sonder qu'une définition du registre", async () => {
  mocks.probe.mockResolvedValue({ sourceKey: "belambra", requests: [] })
  expect(await probeScanSourceAction("belambra")).toMatchObject({
    ok: true,
    result: { sourceKey: "belambra" },
  })
  expect(mocks.probe.mock.calls[0][0].listUrls).toEqual([
    "https://recrute.belambra.fr/jobs.rss",
  ])
})
