import { beforeEach, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  runTest: vi.fn(),
  setSwitch: vi.fn(),
  revise: vi.fn(),
  transition: vi.fn(),
  remove: vi.fn(),
  revalidate: vi.fn(),
}))
vi.mock("@/lib/dal", () => ({ requireRole: mocks.requireRole }))
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }))
vi.mock("./tests", () => ({ runSourceTest: mocks.runTest }))
vi.mock("./writes", () => ({
  setSourceSwitch: mocks.setSwitch,
  reviseSource: mocks.revise,
  transitionSource: mocks.transition,
  deleteSource: mocks.remove,
  createSource: vi.fn(),
  decideReuse: vi.fn(),
  moveSource: vi.fn(),
  restoreRevision: vi.fn(),
}))

import {
  deleteScanSourceAction,
  setScanSourceSwitchAction,
  testScanSourceAction,
  transitionScanSourceAction,
  updateScanSourceAction,
} from "./actions"
import { emptySourceFormValues } from "@/domain/scan/source-form"

beforeEach(() => vi.resetAllMocks())

it.each([
  () => testScanSourceAction("belambra", "probe"),
  () => setScanSourceSwitchAction("belambra", 1, "enabled", true),
  () => updateScanSourceAction("belambra", 1, emptySourceFormValues()),
  () => transitionScanSourceAction("belambra", 1, "archive"),
  () => deleteScanSourceAction("belambra"),
])(
  "vérifie le rôle admin avant toute lecture ou écriture (%#)",
  async (action) => {
    mocks.requireRole.mockRejectedValue(new Error("forbidden"))
    await expect(action()).rejects.toThrow("forbidden")
    expect(mocks.requireRole).toHaveBeenCalledWith("admin")
    for (const service of [
      mocks.runTest,
      mocks.setSwitch,
      mocks.revise,
      mocks.transition,
      mocks.remove,
    ])
      expect(service).not.toHaveBeenCalled()
  },
)

it("refuse un type de test ou une version invalide sans appeler le service", async () => {
  mocks.requireRole.mockResolvedValue({ user: { id: "admin" } })
  expect(
    await testScanSourceAction("belambra", "detect" as "probe"),
  ).toMatchObject({ ok: false })
  expect(
    await setScanSourceSwitchAction("belambra", Number.NaN, "enabled", true),
  ).toMatchObject({ ok: false })
  expect(mocks.runTest).not.toHaveBeenCalled()
  expect(mocks.setSwitch).not.toHaveBeenCalled()
})

it("attribue chaque écriture à l'admin connecté et ne revalide qu'après succès", async () => {
  mocks.requireRole.mockResolvedValue({ user: { id: "admin" } })
  mocks.setSwitch.mockResolvedValue({ ok: true, version: 3, key: "belambra" })
  expect(
    await setScanSourceSwitchAction("belambra", 2, "autoPublish", false),
  ).toEqual({ ok: true, version: 3, key: "belambra" })
  expect(mocks.setSwitch).toHaveBeenCalledWith(
    "belambra",
    "autoPublish",
    false,
    "admin",
    { version: 2 },
  )
  expect(mocks.revalidate).toHaveBeenCalledWith("/admin/scan", "layout")
  mocks.revalidate.mockClear()
  mocks.transition.mockResolvedValue({
    ok: false,
    reason: "blocked",
    message: "À qualifier.",
  })
  expect(
    await transitionScanSourceAction("belambra", 2, "mark_ready"),
  ).toMatchObject({ ok: false, message: "À qualifier." })
  expect(mocks.revalidate).not.toHaveBeenCalled()
})

it("transmet le test de la nouvelle configuration à l'enregistrement", async () => {
  mocks.requireRole.mockResolvedValue({ user: { id: "admin" } })
  mocks.revise.mockResolvedValue({ ok: true, version: 2, key: "vvf" })
  const values = { ...emptySourceFormValues(), label: "VVF" }
  await updateScanSourceAction("vvf", 1, values, "test-id")
  expect(mocks.revise).toHaveBeenCalledWith("vvf", 1, values, "admin", {
    testId: "test-id",
  })
})
