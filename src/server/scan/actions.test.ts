import { beforeEach, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  probe: vi.fn(),
  enabled: vi.fn(),
  autoPublish: vi.fn(),
  revalidate: vi.fn(),
}))
vi.mock("@/lib/dal", () => ({ requireRole: mocks.requireRole }))
vi.mock("./probe", () => ({ probeScanSource: mocks.probe }))
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }))
vi.mock("./sources/state", () => ({
  isScanSourceKey: (key: string) => key === "belambra",
  setScanSourceEnabled: mocks.enabled,
  setScanSourceAutoPublish: mocks.autoPublish,
}))

import {
  probeScanSourceAction,
  setScanSourceEnabledAction,
  setScanSourceAutoPublishAction,
} from "./actions"

beforeEach(() => vi.resetAllMocks())
it("vérifie le rôle admin dans l'action avant de lire la source", async () => {
  mocks.requireRole.mockRejectedValue(new Error("forbidden"))
  await expect(probeScanSourceAction("belambra")).rejects.toThrow("forbidden")
  expect(mocks.requireRole).toHaveBeenCalledWith("admin")
  expect(mocks.probe).not.toHaveBeenCalled()
})

it.each([setScanSourceEnabledAction, setScanSourceAutoPublishAction])(
  "vérifie le rôle admin avant toute modification de source",
  async (action) => {
    mocks.requireRole.mockRejectedValue(new Error("forbidden"))
    await expect(action("belambra", true)).rejects.toThrow("forbidden")
    expect(mocks.enabled).not.toHaveBeenCalled()
    expect(mocks.autoPublish).not.toHaveBeenCalled()
  },
)

it.each([setScanSourceEnabledAction, setScanSourceAutoPublishAction])(
  "refuse les clés inconnues dans les actions de source",
  async (action) => {
    mocks.requireRole.mockResolvedValue({ user: { id: "admin" } })
    expect(await action("__proto__", true)).toMatchObject({ ok: false })
    expect(mocks.enabled).not.toHaveBeenCalled()
    expect(mocks.autoPublish).not.toHaveBeenCalled()
  },
)

it("attribue chaque changement à l'admin connecté et revalide la page", async () => {
  mocks.requireRole.mockResolvedValue({ user: { id: "admin" } })
  expect(await setScanSourceEnabledAction("belambra", true)).toEqual({
    ok: true,
  })
  expect(await setScanSourceAutoPublishAction("belambra", false)).toEqual({
    ok: true,
  })
  expect(mocks.enabled).toHaveBeenCalledWith("belambra", true, "admin")
  expect(mocks.autoPublish).toHaveBeenCalledWith("belambra", false, "admin")
  expect(mocks.revalidate).toHaveBeenCalledWith("/admin/scan")
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
