"use server"

import { revalidatePath } from "next/cache"

import type {
  EmployerLeadDecision,
  ScanReuseDecision,
  ScanSourceSwitch,
} from "@/domain/scan/vocabulary"
import type { SourceFormValues } from "@/domain/scan/source-form"
import type { SourceTransition } from "@/domain/scan/source-lifecycle"
import { requireRole } from "@/lib/dal"

import { searchCompanyDirectory } from "@/server/companies/directory"

import { detectStartUrl } from "./detect"
import {
  decideEmployerLead,
  learnPlaceAlias,
  markEmployerWithoutPortal,
} from "./learning"
import { getScanSource } from "./registry"
import { runSourceTest, type SourceTestKind } from "./tests"
import {
  createSource,
  decideReuse,
  deleteSource,
  excludeSourceDomain,
  linkSourceCompany,
  moveSource,
  restoreRevision,
  reviseSource,
  setSourceSwitch,
  transitionSource,
  type SourceWriteResult,
} from "./writes"

// Actions des sources (§12) : rôle admin d'abord, puis validation, puis le service. Un refus
// métier revient en message, jamais en exception ; chaque écriture revalide le scan.
function revalidated<T extends { ok: boolean }>(result: T) {
  if (result.ok) revalidatePath("/admin/scan", "layout")
  return result
}
const invalid = {
  ok: false,
  reason: "invalid",
  message: "Demande invalide.",
} as const

export async function testScanSourceAction(
  key: string,
  kind: SourceTestKind,
  values?: SourceFormValues,
) {
  const { user } = await requireRole("admin")
  if (typeof key !== "string" || (kind !== "probe" && kind !== "sample"))
    return invalid
  return revalidated(await runSourceTest(key, kind, user.id, { values }))
}

export async function setScanSourceSwitchAction(
  key: string,
  version: number,
  flag: ScanSourceSwitch,
  value: boolean,
) {
  const { user } = await requireRole("admin")
  if (!Number.isSafeInteger(version)) return invalid
  return revalidated(
    await setSourceSwitch(key, flag, value, user.id, { version }),
  )
}

export async function createScanSourceAction(
  values: SourceFormValues,
  originCandidateId?: string,
) {
  const { user } = await requireRole("admin")
  return revalidated(
    await createSource(values, user.id, {
      originCandidateId:
        typeof originCandidateId === "string" ? originCandidateId : undefined,
    }),
  )
}

export async function updateScanSourceAction(
  key: string,
  version: number,
  values: SourceFormValues,
  testId?: string,
) {
  const { user } = await requireRole("admin")
  if (!Number.isSafeInteger(version)) return invalid
  return revalidated(
    await reviseSource(key, version, values, user.id, { testId }),
  )
}

export async function transitionScanSourceAction(
  key: string,
  version: number,
  transition: SourceTransition,
  payload: { reason?: string; rejectPending?: boolean } = {},
): Promise<SourceWriteResult> {
  const { user } = await requireRole("admin")
  if (!Number.isSafeInteger(version)) return invalid
  return revalidated(
    await transitionSource(key, version, transition, user.id, payload),
  )
}

export async function decideScanSourceReuseAction(
  key: string,
  version: number,
  decision: {
    decision: ScanReuseDecision
    note: string
    scheduledAccessBasis?: string
  },
) {
  const { user } = await requireRole("admin")
  if (!Number.isSafeInteger(version)) return invalid
  return revalidated(await decideReuse(key, version, decision, user.id))
}

export async function deleteScanSourceAction(key: string) {
  const { user } = await requireRole("admin")
  return revalidated(await deleteSource(key, user.id))
}

export async function restoreScanSourceRevisionAction(
  key: string,
  version: number,
  revision: number,
  testId?: string,
) {
  const { user } = await requireRole("admin")
  if (!Number.isSafeInteger(version) || !Number.isSafeInteger(revision))
    return invalid
  return revalidated(
    await restoreRevision(key, version, revision, user.id, { testId }),
  )
}

export async function moveScanSourceAction(
  key: string,
  direction: "up" | "down",
) {
  const { user } = await requireRole("admin")
  if (direction !== "up" && direction !== "down") return invalid
  return revalidated(await moveSource(key, direction, user.id))
}

export async function detectScanSourceAction(url: string) {
  await requireRole("admin")
  return detectStartUrl(String(url))
}

export async function searchSourceCompaniesAction(query: string) {
  await requireRole("admin")
  return searchCompanyDirectory(String(query).slice(0, 100))
}

export async function createSourceCompanyAction(key: string) {
  const { user } = await requireRole("admin")
  const source = await getScanSource(String(key))
  if (!source)
    return {
      ok: false,
      reason: "unknown",
      message: "Source inconnue.",
    } as const
  // Annuaire indisponible : la fiche reprend le nom et le SIREN de la source.
  const directory = source.employerSiren
    ? await searchCompanyDirectory(source.employerSiren)
    : { ok: false as const }
  const match = directory.ok
    ? directory.results.find((result) => result.siren === source.employerSiren)
    : undefined
  return revalidated(
    await linkSourceCompany(
      source.key,
      user.id,
      match
        ? {
            legalName: match.legalName,
            displayName: match.displayName,
            nafCode: match.nafCode,
            communeName: match.communeName,
          }
        : null,
    ),
  )
}

export async function excludeSourceDomainAction(key: string, domain: string) {
  const { user } = await requireRole("admin")
  const result = await excludeSourceDomain(String(key), String(domain), user.id)
  if (result.ok) revalidatePath("/admin/referentiels")
  return revalidated(result)
}

export async function rememberPlaceAliasAction(
  candidateId: string,
  input: {
    name: string
    communeName: string
    inseeCode: string
    departmentCode: string
  },
) {
  const { user } = await requireRole("admin")
  return revalidated(await learnPlaceAlias(String(candidateId), input, user.id))
}

export async function markEmployerWithoutPortalAction(candidateId: string) {
  const { user } = await requireRole("admin")
  const result = await markEmployerWithoutPortal(String(candidateId), user.id)
  if (result.ok) revalidatePath("/admin/scan/employeurs")
  return revalidated(result)
}

export async function decideEmployerLeadAction(
  reviewId: string,
  decision: EmployerLeadDecision,
  note: string,
) {
  const { user } = await requireRole("admin")
  return revalidated(
    await decideEmployerLead(
      String(reviewId),
      { decision, note: String(note) },
      user.id,
    ),
  )
}
