import { beforeEach, expect, it, vi } from "vitest"

import { testScanSourceDefinitions, toSnapshot } from "@/test/scan-sources"

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  probe: vi.fn(),
  sample: vi.fn(),
  setSwitch: vi.fn(),
  load: vi.fn(),
  refusal: vi.fn(),
  revalidate: vi.fn(),
}))
vi.mock("@/lib/dal", () => ({ requireRole: mocks.requireRole }))
vi.mock("./probe", () => ({ probeScanSource: mocks.probe }))
vi.mock("./sample", () => ({ sampleScanSource: mocks.sample }))
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }))
vi.mock("./sources/writes", () => ({ setSourceSwitch: mocks.setSwitch }))
vi.mock("./sources/registry", async () => {
  const { definitionFrom } =
    await vi.importActual<typeof import("./sources/registry")>(
      "./sources/registry",
    )
  return {
    definitionFrom,
    loadScanSource: mocks.load,
    sourceTestRefusal: mocks.refusal,
  }
})

import {
  probeScanSourceAction,
  sampleScanSourceAction,
  setScanSourceSwitchAction,
} from "./actions"

const belambra = testScanSourceDefinitions().belambra
const stored = {
  row: { key: "belambra", role: "reserve", priority: 10, status: "draft" },
  revision: { revision: 1, complete: true, definition: toSnapshot(belambra) },
}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.load.mockImplementation(async (key: string) =>
    key === "belambra" ? stored : null,
  )
  mocks.refusal.mockReturnValue(null)
})

it("l'extraction d'échantillon vérifie le rôle admin et le registre avant toute lecture", async () => {
  mocks.requireRole.mockRejectedValue(new Error("forbidden"))
  await expect(sampleScanSourceAction("belambra")).rejects.toThrow("forbidden")
  expect(mocks.load).not.toHaveBeenCalled()
  expect(mocks.sample).not.toHaveBeenCalled()
  mocks.requireRole.mockResolvedValue({ user: { id: "admin" } })
  expect(await sampleScanSourceAction("__proto__")).toMatchObject({ ok: false })
  expect(mocks.sample).not.toHaveBeenCalled()
  mocks.sample.mockResolvedValue({ sourceKey: "belambra", items: [] })
  expect(await sampleScanSourceAction("belambra")).toMatchObject({
    ok: true,
    result: { sourceKey: "belambra" },
  })
})

it("vérifie le rôle admin dans l'action avant de lire la source", async () => {
  mocks.requireRole.mockRejectedValue(new Error("forbidden"))
  await expect(probeScanSourceAction("belambra")).rejects.toThrow("forbidden")
  expect(mocks.requireRole).toHaveBeenCalledWith("admin")
  expect(mocks.load).not.toHaveBeenCalled()
  expect(mocks.probe).not.toHaveBeenCalled()
})

it.each(["missing", "__proto__", "constructor", "https://127.0.0.1"])(
  "refuse une clé absente du registre : %s",
  async (key) => {
    mocks.requireRole.mockResolvedValue({ user: { id: "admin" } })
    expect(await probeScanSourceAction(key)).toMatchObject({
      ok: false,
      message: "Source inconnue.",
    })
    expect(mocks.probe).not.toHaveBeenCalled()
  },
)

it("une source écartée ou incomplète n'est ni sondée ni échantillonnée", async () => {
  mocks.requireRole.mockResolvedValue({ user: { id: "admin" } })
  mocks.refusal.mockReturnValue("Configuration incomplète.")
  expect(await probeScanSourceAction("belambra")).toEqual({
    ok: false,
    message: "Configuration incomplète.",
  })
  expect(await sampleScanSourceAction("belambra")).toEqual({
    ok: false,
    message: "Configuration incomplète.",
  })
  expect(mocks.probe).not.toHaveBeenCalled()
  expect(mocks.sample).not.toHaveBeenCalled()
})

it("sonde la version courante de la source, lue en base", async () => {
  mocks.requireRole.mockResolvedValue({ user: { id: "admin" } })
  mocks.probe.mockResolvedValue({ sourceKey: "belambra", requests: [] })
  expect(await probeScanSourceAction("belambra")).toMatchObject({
    ok: true,
    result: { sourceKey: "belambra" },
  })
  expect(mocks.probe.mock.calls[0][0]).toMatchObject({
    key: "belambra",
    revision: 1,
    listUrls: ["https://recrute.belambra.fr/jobs.rss"],
  })
})

it("vérifie le rôle admin avant toute modification d'interrupteur", async () => {
  mocks.requireRole.mockRejectedValue(new Error("forbidden"))
  await expect(
    setScanSourceSwitchAction("belambra", 1, "enabled", true),
  ).rejects.toThrow("forbidden")
  expect(mocks.setSwitch).not.toHaveBeenCalled()
})

it("attribue chaque changement à l'admin connecté, avec la version lue, et revalide", async () => {
  mocks.requireRole.mockResolvedValue({ user: { id: "admin" } })
  mocks.setSwitch.mockResolvedValue({ ok: true, version: 3 })
  expect(
    await setScanSourceSwitchAction("belambra", 2, "autoPublish", false),
  ).toEqual({ ok: true, version: 3 })
  expect(mocks.setSwitch).toHaveBeenCalledWith(
    "belambra",
    "autoPublish",
    false,
    "admin",
    { version: 2 },
  )
  expect(mocks.revalidate).toHaveBeenCalledWith("/admin/scan", "layout")
})

it("un refus des portes renvoie son message sans revalider", async () => {
  mocks.requireRole.mockResolvedValue({ user: { id: "admin" } })
  mocks.setSwitch.mockResolvedValue({
    ok: false,
    reason: "blocked",
    message: "À qualifier : la source n’est pas prête.",
  })
  expect(
    await setScanSourceSwitchAction("belambra", 1, "enabled", true),
  ).toEqual({ ok: false, message: "À qualifier : la source n’est pas prête." })
  expect(mocks.revalidate).not.toHaveBeenCalled()
  expect(
    await setScanSourceSwitchAction("belambra", Number.NaN, "enabled", true),
  ).toMatchObject({ ok: false })
})
