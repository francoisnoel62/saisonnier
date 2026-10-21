// Job-boards et agrégateurs exclus (§2, H9) : aucune destination de candidature ni aucune source
// d'annonce ne doit y mener. La liste vient de la table `blocked_domains`.

// Adresse email simple : pas d'espace, un seul « @ », pas de « / » (sinon c'est un chemin d'URL).
const EMAIL = /^[^\s@/]+@([^\s@/]+)$/

function normalizeHost(host: string) {
  const normalized = host
    .toLowerCase()
    .replace(/\.+$/, "")
    .replace(/^www\./, "")
  return normalized || null
}

// Hôte tel que le lirait un navigateur : l'analyseur d'URL normalise la casse, l'encodage %,
// les caractères pleine chasse et les noms internationalisés.
function parseHost(url: string) {
  try {
    return normalizeHost(new URL(url).hostname)
  } catch {
    return null
  }
}

// Hôte d'une URL, ou domaine d'une adresse email, en minuscules et sans « www. » :
// "https://www.Indeed.fr/emploi" → "indeed.fr", "x@indeedemail.com" → "indeedemail.com".
// Sans protocole, la valeur est lue comme une URL https ("fr.indeed.com/emploi", "//indeed.com").
// Renvoie null si la valeur n'est pas exploitable.
export function hostOf(urlOrEmail: string) {
  let value = urlOrEmail.trim()
  if (/^mailto:/i.test(value)) {
    value = value.slice("mailto:".length).split("?")[0]
  }

  const email = EMAIL.exec(value)
  if (email) return parseHost(`https://${email[1]}`)
  // La valeur telle quelle d'abord : un navigateur suit "http:/indeed.com" jusqu'à indeed.com.
  return parseHost(value) ?? parseHost(`https://${value}`)
}

// Domaine exclu qui couvre cet hôte : le domaine lui-même ou l'un de ses sous-domaines
// ("fr.indeed.com" relève de "indeed.com", "notindeed.com" non).
function blockingDomain(host: string, list: readonly string[]) {
  const normalized = normalizeHost(host)
  if (!normalized) return null
  for (const entry of list) {
    const domain = normalizeHost(entry)
    if (
      domain &&
      (normalized === domain || normalized.endsWith(`.${domain}`))
    ) {
      return domain
    }
  }
  return null
}

export function isBlockedHost(host: string, list: readonly string[]) {
  return blockingDomain(host, list) !== null
}

export type BlockedTargetField = "applyUrl" | "applyEmail" | "sourceUrl"

export type BlockedTarget = {
  field: BlockedTargetField
  // Hôte de la valeur saisie, et domaine exclu qui le couvre.
  host: string
  domain: string
}

export type BlockableTargets = Partial<
  Record<BlockedTargetField, string | null>
>

// Liens, emails et sources d'une annonce qui mènent à un domaine exclu.
export function findBlockedTargets(
  targets: BlockableTargets,
  list: readonly string[],
): BlockedTarget[] {
  const fields: BlockedTargetField[] = ["applyUrl", "applyEmail", "sourceUrl"]
  return fields.flatMap((field) => {
    const value = targets[field]
    const host = value ? hostOf(value) : null
    const domain = host ? blockingDomain(host, list) : null
    return host && domain ? [{ field, host, domain }] : []
  })
}
