import { isValidSiren } from "@/domain/membership"

// Pistes employeur (lot F, SH31). Le nom d'un employeur est comparé sans accents, sans casse
// et sans forme juridique : « SAS Hôtel du Lac » et « hotel du lac » sont la même piste.
const legalForms = [
  "sas",
  "sasu",
  "sarl",
  "eurl",
  "sa",
  "sci",
  "snc",
  "scop",
  "sca",
  "selarl",
  "ei",
  "eirl",
  "association",
  "ste",
  "societe",
]

export function normalizeEmployerName(name: string) {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter((word) => word && !legalForms.includes(word))
    .join(" ")
}

// Clé de regroupement : le SIREN s'il est connu, sinon le nom normalisé.
export function employerLeadKey({
  siren,
  name,
}: {
  siren?: string | null
  name: string
}) {
  const digits = siren?.replace(/\s/g, "")
  if (digits && isValidSiren(digits)) return `employer:${digits}`
  const normalized = normalizeEmployerName(name)
  return normalized ? `employer:${normalized}` : null
}

export type EmployerLeadDetails = {
  name: string
  siren: string | null
  communeName: string | null
  sourceKey: string
  candidateIds: string[]
  lastSeenTitle: string | null
}
