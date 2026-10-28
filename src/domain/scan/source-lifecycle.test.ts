import { describe, expect, it } from "vitest"

import {
  moveInOrder,
  sourceAutoPublishes,
  sourceParticipates,
  sourceTransitionMoves,
  sourceTransitions,
  switchBlockerMessage,
  switchBlockers,
  transitionBlockerMessage,
  transitionBlockers,
  type SourceSwitchState,
  type SourceTransition,
} from "./source-lifecycle"
import {
  scanModes,
  scanSourceKinds,
  scanSourceStatuses,
  type ScanSourceStatus,
  type ScanSourceSwitch,
} from "./vocabulary"

const ready: SourceSwitchState = {
  status: "ready",
  kind: "employer",
  enabled: true,
  dailyEnabled: true,
  autoPublish: true,
  suspendedAt: null,
  scheduledAccessBasis: null,
}
const available = { adapterAvailable: true }

describe("sourceParticipates et sourceAutoPublishes", () => {
  const cases = scanSourceStatuses.flatMap((status) =>
    scanSourceKinds.flatMap((kind) =>
      [true, false].flatMap((enabled) =>
        [true, false].flatMap((dailyEnabled) =>
          [true, false].flatMap((autoPublish) =>
            [null, "2026-10-27T03:00:00Z"].flatMap((suspendedAt) =>
              [true, false].flatMap((adapterAvailable) =>
                scanModes.map((mode) => ({
                  source: {
                    ...ready,
                    status,
                    kind,
                    enabled,
                    dailyEnabled,
                    autoPublish,
                    suspendedAt,
                  },
                  adapterAvailable,
                  mode,
                })),
              ),
            ),
          ),
        ),
      ),
    ),
  )
  it("table complète : statut × interrupteurs × suspension × connecteur × mode × type", () => {
    expect(cases).toHaveLength(512)
    for (const { source, adapterAvailable, mode } of cases) {
      const participates =
        source.status === "ready" &&
        source.enabled &&
        !source.suspendedAt &&
        adapterAvailable &&
        (mode === "bootstrap" || source.dailyEnabled)
      const label = JSON.stringify({ source, adapterAvailable, mode })
      expect(
        sourceParticipates(source, mode, { adapterAvailable }),
        label,
      ).toBe(participates)
      expect(sourceAutoPublishes(source, { adapterAvailable }), label).toBe(
        source.kind === "employer" &&
          source.autoPublish &&
          source.status === "ready" &&
          source.enabled &&
          source.dailyEnabled &&
          !source.suspendedAt &&
          adapterAvailable,
      )
    }
  })
  it("une découverte ne publie jamais automatiquement, même tout activé", () => {
    expect(
      sourceAutoPublishes({ ...ready, kind: "discovery" }, available),
    ).toBe(false)
    expect(sourceAutoPublishes(ready, available)).toBe(true)
  })
})

describe("portes des interrupteurs", () => {
  const off = {
    ...ready,
    enabled: false,
    dailyEnabled: false,
    autoPublish: false,
  }
  const context = { ...available, enabledCount: 0 }
  it.each<
    [string, SourceSwitchState, ScanSourceSwitch, typeof context, string[]]
  >([
    ["prête : tout est permis", off, "enabled", context, []],
    [
      "brouillon",
      { ...off, status: "draft" },
      "enabled",
      context,
      ["not_ready"],
    ],
    [
      "connecteur indisponible",
      off,
      "enabled",
      { ...context, adapterAvailable: false },
      ["adapter_unavailable"],
    ],
    [
      "suspendue",
      { ...off, suspendedAt: "2026-10-27T03:00:00Z" },
      "enabled",
      context,
      ["suspended"],
    ],
    [
      "plafond de 20 sources activées",
      off,
      "enabled",
      { ...context, enabledCount: 20 },
      ["max_enabled"],
    ],
    [
      "découverte sans justification d'accès programmé",
      { ...off, kind: "discovery" },
      "dailyEnabled",
      context,
      ["scheduled_access_missing"],
    ],
    [
      "découverte justifiée",
      { ...off, kind: "discovery", scheduledAccessBasis: "API officielle" },
      "dailyEnabled",
      context,
      [],
    ],
    [
      "découverte en publication automatique",
      { ...off, kind: "discovery" },
      "autoPublish",
      context,
      ["discovery_auto_publish"],
    ],
    [
      "écartée",
      { ...off, status: "rejected" },
      "autoPublish",
      context,
      ["not_ready"],
    ],
  ])("%s", (_name, source, flag, switchContext, expected) => {
    expect(switchBlockers(source, flag, true, switchContext)).toEqual(expected)
  })
  it("désactiver est toujours possible", () => {
    expect(
      switchBlockers({ ...ready, status: "rejected" }, "enabled", false, {
        ...context,
        adapterAvailable: false,
      }),
    ).toEqual([])
  })
  it("le message d'une source non prête dépend de son statut", () => {
    expect(switchBlockerMessage("not_ready", { status: "draft" })).toContain(
      "À qualifier",
    )
    expect(switchBlockerMessage("not_ready", { status: "rejected" })).toContain(
      "écartée",
    )
    expect(switchBlockerMessage("not_ready", { status: "archived" })).toContain(
      "archivée",
    )
  })
})

describe("transitions du cycle de vie", () => {
  const allowed: Record<SourceTransition, ScanSourceStatus[]> = {
    mark_ready: ["draft"],
    back_to_draft: ["ready"],
    reject: ["draft", "ready"],
    reexamine: ["rejected"],
    archive: ["draft", "ready", "rejected"],
    restore: ["archived"],
  }
  it("table complète : depuis, vers, conditions", () => {
    for (const transition of sourceTransitions)
      for (const status of scanSourceStatuses) {
        const blockers = transitionBlockers(status, transition, {
          reason: "Liste construite par JavaScript.",
        })
        expect(
          blockers.includes("wrong_status"),
          `${status} ${transition}`,
        ).toBe(!allowed[transition].includes(status))
      }
    expect(sourceTransitionMoves.archive.to).toBe("archived")
    expect(sourceTransitionMoves.restore.to).toBe("draft")
  })
  it("écarter exige un motif de 10 à 500 caractères", () => {
    expect(transitionBlockers("draft", "reject")).toEqual(["reason_required"])
    expect(transitionBlockers("draft", "reject", { reason: "court" })).toEqual([
      "reason_required",
    ])
    expect(
      transitionBlockers("draft", "reject", { reason: "x".repeat(501) }),
    ).toEqual(["reason_required"])
    expect(
      transitionBlockerMessage("wrong_status", "restore", "draft"),
    ).toContain("Brouillon")
  })
  it("monter et descendre échangent deux voisines, sans sortir de la liste", () => {
    expect(moveInOrder(["a", "b", "c"], 1, -1)).toEqual(["b", "a", "c"])
    expect(moveInOrder(["a", "b", "c"], 1, 1)).toEqual(["a", "c", "b"])
    expect(moveInOrder(["a", "b", "c"], 0, -1)).toEqual(["a", "b", "c"])
    expect(moveInOrder(["a", "b", "c"], 2, 1)).toEqual(["a", "b", "c"])
  })
})
