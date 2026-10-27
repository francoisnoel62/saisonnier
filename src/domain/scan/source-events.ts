import { z } from "zod"

import {
  scanSourceEventKinds,
  scanSourceStatuses,
  scanSourceSwitches,
  type ScanSourceEventKind,
} from "./vocabulary"

// Détails du journal des sources, validés à l'écriture. Ni coordonnées ni texte de page :
// les résultats de sonde et d'échantillon n'en contiennent déjà pas.
const text = (max: number) => z.string().max(max).regex(/\S/)
const genericDetails = z.record(z.string(), z.unknown())
export const scanSourceEventDetailsSchemas = {
  imported: z.object({
    references: z.array(text(300)).max(10),
    note: text(2000).optional(),
  }),
  switched: z.object({
    flag: z.enum(scanSourceSwitches),
    value: z.boolean(),
    reason: text(2000).optional(),
  }),
  status_changed: z.object({
    from: z.enum(scanSourceStatuses).nullable(),
    to: z.enum(scanSourceStatuses),
    reason: text(2000).optional(),
  }),
  created: genericDetails,
  revised: genericDetails,
  reuse_decided: genericDetails,
  probed: genericDetails,
  sampled: genericDetails,
  detected: genericDetails,
  suspended: genericDetails,
  resumed: genericDetails,
  company_linked: genericDetails,
  domain_excluded: genericDetails,
  alias_learned: genericDetails,
} satisfies Record<ScanSourceEventKind, z.ZodType>
export type ScanSourceEventDetails = Record<string, unknown>
export type ScanSourceEventInput = {
  [K in ScanSourceEventKind]: {
    kind: K
    details: z.input<(typeof scanSourceEventDetailsSchemas)[K]>
  }
}[ScanSourceEventKind]

// Détails sérialisés de 32 Ko au plus (CHECK scan_source_events_details).
export const maxEventDetailsBytes = 32 * 1024
export function parseEventDetails(event: ScanSourceEventInput) {
  if (!scanSourceEventKinds.includes(event.kind))
    throw new RangeError("Événement de source inconnu")
  const details = scanSourceEventDetailsSchemas[event.kind].parse(
    event.details,
  ) as ScanSourceEventDetails
  if (
    new TextEncoder().encode(JSON.stringify(details)).length >
    maxEventDetailsBytes
  )
    throw new RangeError("Détails d'événement trop volumineux")
  return details
}
