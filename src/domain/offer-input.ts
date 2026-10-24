import { z } from "zod"

import { findBlockedTargets } from "./blocked-domains"
import { confirmableFields, establishFields } from "./field-certainty"
import { languageCodes } from "./languages"
import {
  applicationChannels,
  durationUnits,
  offerOrigins,
  seasons,
  workTimes,
  type ApplicationChannel,
  type DurationUnit,
  type OfferOrigin,
  type Season,
  type WorkTime,
} from "./offer"
import { isIsoDate } from "./offer-activity"
import { blockedTargetMessage, type PublicationInput } from "./offer-minimum"
import { isPhoneNumber } from "./phone"
import { salaryUnits, type SalaryUnit } from "./salary"
import { triStates, type TriState } from "./tri-state"

// Saisie d'une annonce (§3, §6) : un seul schéma, utilisé par le formulaire (react-hook-form) et
// revérifié par les Server Actions. Il reprend toutes les contraintes CHECK de la table des offres,
// pour qu'aucune erreur SQL n'atteigne l'utilisateur.
//
// Le formulaire manipule des textes ; le schéma les convertit en colonnes. Un champ laissé vide
// devient null, une réponse laissée vide « Non précisé » (unknown), jamais « Non » (§3, §9).

// Ce que le schéma vérifie contre la base et le calendrier.
export type OfferInputContext = {
  // Aujourd'hui à Paris (todayInParis) : une échéance déjà passée n'est pas acceptée.
  today: string
  blockedDomains: readonly string[]
  // Métiers actifs du référentiel, plus celui de l'annonce modifiée s'il a été désactivé depuis.
  occupationIds: readonly string[]
  departmentCodes: readonly string[]
}

// Choix proposés par le formulaire : métiers actifs, départements (saisie manuelle de la commune,
// aperçu) et domaines exclus (encart du minimum). Le serveur en tire le contexte de validation.
export type OfferFormReferentials = {
  occupations: { id: string; label: string; family: string }[]
  departments: { code: string; name: string; regionName: string | null }[]
  blockedDomains: string[]
}

export function offerInputContext(
  referentials: OfferFormReferentials,
  today: string,
): OfferInputContext {
  return {
    today,
    blockedDomains: referentials.blockedDomains,
    occupationIds: referentials.occupations.map((occupation) => occupation.id),
    departmentCodes: referentials.departments.map(
      (department) => department.code,
    ),
  }
}

// Longueurs maximales, reprises par les champs du formulaire.
export const offerTextLimits = {
  title: 150,
  description: 5000,
  missions: 3000,
  communeName: 100,
  locationDetails: 200,
  salaryNotes: 500,
  // Précisions du logement, des repas, de l'expérience, du permis et des horaires.
  details: 500,
  otherConstraints: 1000,
  applyEmail: 254,
  applyPhone: 30,
  applyUrl: 500,
} as const

// Période du contrat : des dates de début et de fin, ou une durée, éventuellement accompagnée de
// la date de début (sans date de fin).
export const periodKinds = ["dates", "duration"] as const
export type PeriodKind = (typeof periodKinds)[number]

export const maxDuration: Record<DurationUnit, number> = {
  weeks: 52,
  months: 12,
}

export const weeklyHoursRange = { min: 1, max: 60 } as const

// 100 000 € : au-delà, c'est une faute de frappe.
export const MAX_SALARY_CENTS = 10_000_000

// Codes des communes (« 74010 », « 2A004 », « 97101 ») et codes postaux, tels que les renvoie
// geo.api.gouv.fr.
export const INSEE_CODE = /^(\d{5}|2[AB]\d{3})$/
export const POSTAL_CODE = /^\d{5}$/

const isOneOf = <T extends string>(
  values: readonly T[],
  value: string,
): value is T => (values as readonly string[]).includes(value)

// Montant saisi en euros, avec ou sans séparateur de milliers ni symbole : « 1 850 », « 1850,50 »,
// « 12.5 », « 2 000 € ». Deux décimales au plus : « 1.850 » est refusé plutôt que lu 1,85 € ou
// 1 850 €. Le calcul porte sur les chiffres, sans arrondi de virgule flottante.
export function eurosToCents(text: string): number | null {
  const compact = text.replace(/\s/g, "").replace(/€$/, "")
  const match = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(compact)
  if (!match) return null
  const [, euros, decimals = ""] = match
  return Number(euros) * 100 + Number(decimals.padEnd(2, "0"))
}

// Centimes → saisie en euros, pour modifier une annonce : 185000 → « 1850 », 1250 → « 12,50 ».
export function centsToEuros(cents: number) {
  const euros = Math.floor(cents / 100)
  const rest = cents % 100
  return rest === 0
    ? String(euros)
    : `${euros},${String(rest).padStart(2, "0")}`
}

// Heures par semaine, une décimale au plus (colonne numeric(3,1)) : « 35 », « 37,5 ».
function parseWeeklyHours(text: string) {
  const match = /^(\d{1,2})(?:[.,](\d))?$/.exec(text)
  return match ? Number(match[1]) + Number(match[2] ?? 0) / 10 : null
}

function parseDuration(text: string) {
  return /^\d{1,3}$/.test(text) ? Number(text) : null
}

// Date de calendrier AAAA-MM-JJ plausible : le sélecteur de dates n'en produit pas d'autre.
function isPlausibleDate(value: string) {
  return isIsoDate(value) && value >= "2000-01-01" && value <= "2099-12-31"
}

const emailFormat = z.email()
const isEmail = (value: string) => emailFormat.safeParse(value).success

// Lien de candidature : une page http(s) ; « www.hotel.fr/emplois » est lu en https. Tout autre
// protocole (mailto:, javascript:…) est refusé, comme une adresse qui contient un identifiant.
// Renvoie le lien tel qu'il sera enregistré, ou null.
export function normalizeWebUrl(value: string) {
  const text = value.trim()
  if (!text) return null
  const hasProtocol = /^https?:\/\//i.test(text)
  if (!hasProtocol && /^[a-z][a-z\d+.-]*:/i.test(text)) return null
  const href = hasProtocol ? text : `https://${text}`
  try {
    const url = new URL(href)
    return url.hostname.includes(".") && !url.username && !url.password
      ? href
      : null
  } catch {
    return null
  }
}

// Texte saisi, sans espaces de bord ; le caractère NUL, que Postgres refuse, est retiré.
const text = (max: number, tooLong: string) =>
  z
    .string()
    .overwrite((value) => value.replace(/\0/g, "").trim())
    .max(max, tooLong)

const tooLong = (what: string, max: number) =>
  `${what} ne doit pas dépasser ${max} caractères.`

const details = text(
  offerTextLimits.details,
  tooLong("La précision", offerTextLimits.details),
)

// Oui / Non / Non précisé : vide, la réponse vaut « Non précisé ».
const triState = z
  .string()
  .optional()
  .refine((value) => !value || isOneOf(triStates, value), "Réponse invalide.")

const optionalChoice = (values: readonly string[], message: string) =>
  z.string().refine((value) => value === "" || values.includes(value), message)

const AMOUNT_FORMAT =
  "Saisissez un montant en euros, par exemple 1 850 ou 12,50."

const amount = text(20, AMOUNT_FORMAT)
  .refine(
    (value) => value === "" || eurosToCents(value) !== null,
    AMOUNT_FORMAT,
  )
  .refine(
    (value) => (eurosToCents(value) ?? 1) > 0,
    "Le montant doit être supérieur à zéro.",
  )
  .refine(
    (value) => (eurosToCents(value) ?? 0) <= MAX_SALARY_CENTS,
    "Ce montant semble trop élevé : vérifiez la saisie.",
  )

const salaryBases = [
  { min: "salaryNetMin", max: "salaryNetMax", unit: "salaryNetUnit" },
  { min: "salaryGrossMin", max: "salaryGrossMax", unit: "salaryGrossUnit" },
] as const

// Champs du formulaire et leur format. Les champs propres à un type de période, et le département
// d'une commune choisie dans la liste, sont contrôlés plus bas : un champ masqué ne bloque rien.
function offerFields(context: OfferInputContext) {
  return z.object({
    // 1. Poste (H13 : l'intitulé est obligatoire, le métier facultatif)
    title: text(
      offerTextLimits.title,
      tooLong("L'intitulé", offerTextLimits.title),
    ).min(1, "Indiquez l'intitulé du poste."),
    occupationId: z
      .string()
      .refine(
        (value) => value === "" || context.occupationIds.includes(value),
        "Choisissez un métier de la liste.",
      ),
    description: text(
      offerTextLimits.description,
      tooLong("La description", offerTextLimits.description),
    ),
    missions: text(
      offerTextLimits.missions,
      tooLong("Le texte des missions", offerTextLimits.missions),
    ),

    // 2. Contrat
    seasonalContract: z
      .boolean()
      .refine(
        (value) => value,
        "Cochez cette case : seuls les contrats saisonniers peuvent être publiés.",
      ),
    season: z
      .string()
      .refine(
        (value) => value === "" || isOneOf(seasons, value),
        "Choisissez la saison : été ou hiver.",
      ),
    periodKind: z.enum(periodKinds),
    startDate: z
      .string()
      .refine(
        (value) => value === "" || isPlausibleDate(value),
        "Date invalide.",
      ),
    endDate: z.string(),
    durationValue: z.string(),
    durationUnit: z.string(),
    applicationDeadline: z
      .string()
      .refine(
        (value) => value === "" || isPlausibleDate(value),
        "Date invalide.",
      ),

    // 3. Lieu : la commune vient de geo.api.gouv.fr, ou d'une saisie manuelle si le service ne
    // répond pas (sans code INSEE ni code postal).
    communeName: text(
      offerTextLimits.communeName,
      tooLong("Le nom de la commune", offerTextLimits.communeName),
    ).min(1, "Indiquez la commune du poste."),
    communeInseeCode: z.string(),
    postalCode: z.string(),
    departmentCode: z.string(),
    locationDetails: text(
      offerTextLimits.locationDetails,
      tooLong("La précision du lieu", offerTextLimits.locationDetails),
    ),

    // 4. Rémunération : le net et le brut, chacun dans son unité (§3)
    salaryNetMin: amount,
    salaryNetMax: amount,
    salaryNetUnit: optionalChoice(salaryUnits, "Unité invalide."),
    salaryGrossMin: amount,
    salaryGrossMax: amount,
    salaryGrossUnit: optionalChoice(salaryUnits, "Unité invalide."),
    salaryNotes: text(
      offerTextLimits.salaryNotes,
      tooLong("La précision", offerTextLimits.salaryNotes),
    ),

    // 5. Conditions
    housing: triState,
    housingDetails: details,
    meals: triState,
    mealsDetails: details,

    // 6. Profil
    experienceRequired: triState,
    experienceDetails: details,
    languagesRequired: triState,
    languages: z.array(z.string()).max(languageCodes.length),
    drivingLicenseRequired: triState,
    drivingLicenseDetails: details,

    // 7. Organisation (H7)
    workTime: optionalChoice(workTimes, "Réponse invalide."),
    weeklyHours: text(5, "Indiquez un nombre d'heures, par exemple 35 ou 37,5.")
      .refine(
        (value) => value === "" || parseWeeklyHours(value) !== null,
        "Indiquez un nombre d'heures, par exemple 35 ou 37,5.",
      )
      .refine((value) => {
        const hours = parseWeeklyHours(value)
        return (
          hours === null ||
          (hours >= weeklyHoursRange.min && hours <= weeklyHoursRange.max)
        )
      }, `Indiquez entre ${weeklyHoursRange.min} et ${weeklyHoursRange.max} heures par semaine.`),
    scheduleDetails: details,

    // 8. Vie pratique
    couplesWelcome: triState,
    petsAllowed: triState,
    otherConstraints: text(
      offerTextLimits.otherConstraints,
      tooLong("Ce texte", offerTextLimits.otherConstraints),
    ),

    // 9. Candidature (H9) : email et/ou téléphone ; le lien officiel est facultatif.
    applyEmail: text(
      offerTextLimits.applyEmail,
      "Saisissez une adresse email valide.",
    ).refine(
      (value) => value === "" || isEmail(value),
      "Saisissez une adresse email valide.",
    ),
    applyPhone: text(
      offerTextLimits.applyPhone,
      tooLong("Le téléphone", offerTextLimits.applyPhone),
    ).refine(
      (value) => value === "" || isPhoneNumber(value),
      "Saisissez un numéro de téléphone valide.",
    ),
    applyUrl: text(
      offerTextLimits.applyUrl,
      tooLong("Le lien", offerTextLimits.applyUrl),
    ).refine(
      (value) => value === "" || normalizeWebUrl(value) !== null,
      "Saisissez l'adresse complète d'une page web, par exemple https://www.mon-hotel.fr/emplois.",
    ),
  })
}

type RawOfferInput = z.output<ReturnType<typeof offerFields>>

// Valeurs du formulaire, telles que react-hook-form les manipule et que les Server Actions les
// reçoivent.
export type OfferFormValues = z.input<ReturnType<typeof offerFields>>
export type OfferFormField = keyof OfferFormValues

// Qui saisit l'annonce, et comment on y candidate : l'employeur dépose pour lui-même ; l'admin
// saisit aussi les annonces collectées et le canal « chargé de recrutement » (plan 15).
type ApplicationSetting = {
  space: "employer" | "admin"
  origin: OfferOrigin
  channel: ApplicationChannel
}

const employerSetting: ApplicationSetting = {
  space: "employer",
  origin: "deposited",
  channel: "employer",
}

// Règles qui portent sur plusieurs champs. Elles s'exécutent même si un champ est invalide, pour
// que toutes les erreurs s'affichent ensemble : les valeurs sont donc encore les textes saisis.
function checkOfferInput(
  input: RawOfferInput,
  ctx: z.RefinementCtx,
  context: OfferInputContext,
  setting: ApplicationSetting = employerSetting,
) {
  const issue = (path: OfferFormField, message: string) =>
    ctx.addIssue({ code: "custom", path: [path], message })
  const validDate = (value: string) => (isPlausibleDate(value) ? value : null)

  // Période : des dates précises, ou une durée.
  const end = validDate(input.endDate)
  if (input.periodKind === "dates") {
    if (!input.startDate) {
      issue("startDate", "Indiquez la date de début du contrat.")
    }
    if (!input.endDate) {
      issue("endDate", "Indiquez la date de fin du contrat.")
    } else if (!end) {
      issue("endDate", "Date invalide.")
    }
    const start = validDate(input.startDate)
    if (start && end && end < start) {
      issue("endDate", "La date de fin doit suivre la date de début.")
    } else if (end && end < context.today) {
      issue("endDate", "La date de fin du contrat est déjà passée.")
    }
  } else {
    const durationText = input.durationValue.trim()
    const value = parseDuration(durationText)
    if (!durationText) {
      issue("durationValue", "Indiquez la durée du contrat.")
    } else if (value === null) {
      issue("durationValue", "Indiquez un nombre entier, par exemple 3.")
    }
    if (!isOneOf(durationUnits, input.durationUnit)) {
      issue("durationUnit", "Précisez l'unité : semaines ou mois.")
    } else if (
      value !== null &&
      (value < 1 || value > maxDuration[input.durationUnit])
    ) {
      issue(
        "durationValue",
        input.durationUnit === "weeks"
          ? `La durée doit être comprise entre 1 et ${maxDuration.weeks} semaines.`
          : `La durée doit être comprise entre 1 et ${maxDuration.months} mois.`,
      )
    }
  }

  // Échéance (§6) : une date déjà passée retirerait l'annonce aussitôt publiée.
  const deadline = validDate(input.applicationDeadline)
  if (deadline && deadline < context.today) {
    issue(
      "applicationDeadline",
      "La date limite de candidature est déjà passée.",
    )
  } else if (
    deadline &&
    input.periodKind === "dates" &&
    end &&
    deadline > end
  ) {
    issue(
      "applicationDeadline",
      "La date limite de candidature doit précéder la fin du contrat.",
    )
  }

  // Lieu : le département existe, et la commune choisie en fait partie. Sans code INSEE (saisie
  // manuelle), le département est choisi dans la liste.
  if (input.communeName) {
    const insee = input.communeInseeCode
    const reselect =
      "Commune non reconnue : choisissez-la à nouveau dans la liste."
    if (!context.departmentCodes.includes(input.departmentCode)) {
      if (insee) issue("communeName", reselect)
      else issue("departmentCode", "Choisissez le département du poste.")
    } else if (
      insee &&
      (!INSEE_CODE.test(insee) || !insee.startsWith(input.departmentCode))
    ) {
      issue("communeName", reselect)
    }
    if (input.postalCode && !POSTAL_CODE.test(input.postalCode)) {
      issue("communeName", reselect)
    }
  }

  // Rémunération : un montant va avec son unité ; une fourchette va du bas vers le haut.
  for (const basis of salaryBases) {
    const min = input[basis.min]
    const max = input[basis.max]
    if (!min && max) {
      issue(basis.min, "Indiquez le montant, ou le bas de la fourchette.")
    }
    if (min && !input[basis.unit]) {
      issue(basis.unit, "Précisez l'unité : heure, mois, saison…")
    }
    const minCents = min ? eurosToCents(min) : null
    const maxCents = max ? eurosToCents(max) : null
    if (minCents !== null && maxCents !== null && maxCents < minCents) {
      issue(
        basis.max,
        "Le haut de la fourchette doit être supérieur ou égal au bas.",
      )
    }
  }

  // Langues exigées : une liste si et seulement si la réponse est « Oui » (H6).
  if (input.languagesRequired === "yes") {
    if (input.languages.length === 0) {
      issue("languages", "Cochez au moins une langue exigée.")
    } else if (!input.languages.every((code) => isOneOf(languageCodes, code))) {
      issue("languages", "Langue inconnue.")
    }
  }

  // Candidature (H9) : un contact direct, et aucune destination vers un job-board exclu (§2, §9).
  // Une annonce collectée peut ne renvoyer qu'à son lien officiel, sauf si le service recrute.
  const urlSuffices =
    setting.origin === "collected" && setting.channel === "employer"
  if (
    !input.applyEmail &&
    !input.applyPhone &&
    !(urlSuffices && input.applyUrl)
  ) {
    issue(
      "applyEmail",
      setting.channel === "recruiter"
        ? "Indiquez l'email ou le téléphone du chargé de recrutement."
        : urlSuffices
          ? "Indiquez un email, un téléphone ou le lien officiel de candidature."
          : setting.space === "admin"
            ? "Indiquez un email ou un téléphone : les candidats doivent pouvoir joindre l'employeur directement."
            : "Indiquez un email ou un téléphone : les candidats doivent pouvoir vous joindre directement.",
    )
  }
  const blocked = findBlockedTargets(
    {
      applyEmail: isEmail(input.applyEmail) ? input.applyEmail : null,
      applyUrl: normalizeWebUrl(input.applyUrl),
    },
    context.blockedDomains,
  )
  for (const target of blocked) {
    issue(
      target.field === "applyEmail" ? "applyEmail" : "applyUrl",
      blockedTargetMessage(target),
    )
  }
}

const fromTriState = (value: string | undefined) =>
  (value || "unknown") as TriState

// Valeurs validées → colonnes de la table des offres. Les champs de l'autre type de période, et
// les langues quand aucune n'est exigée, sont écartés.
function toOfferInput(input: RawOfferInput) {
  const dates = input.periodKind === "dates"
  const cents = (value: string) => (value ? eurosToCents(value) : null)
  const unit = (amount: string, value: string) =>
    amount ? (value as SalaryUnit) : null
  const languagesRequired = fromTriState(input.languagesRequired)

  return {
    title: input.title,
    occupationId: input.occupationId || null,
    description: input.description || null,
    missions: input.missions || null,

    season: input.season ? (input.season as Season) : null,
    startDate: input.startDate || null,
    endDate: dates ? input.endDate : null,
    durationValue: dates ? null : Number(input.durationValue.trim()),
    durationUnit: dates ? null : (input.durationUnit as DurationUnit),
    applicationDeadline: input.applicationDeadline || null,

    communeName: input.communeName,
    communeInseeCode: input.communeInseeCode || null,
    postalCode: input.postalCode || null,
    departmentCode: input.departmentCode,
    locationDetails: input.locationDetails || null,

    salaryNetMinCents: cents(input.salaryNetMin),
    salaryNetMaxCents: cents(input.salaryNetMax),
    salaryNetUnit: unit(input.salaryNetMin, input.salaryNetUnit),
    salaryGrossMinCents: cents(input.salaryGrossMin),
    salaryGrossMaxCents: cents(input.salaryGrossMax),
    salaryGrossUnit: unit(input.salaryGrossMin, input.salaryGrossUnit),
    salaryNotes: input.salaryNotes || null,

    housing: fromTriState(input.housing),
    housingDetails: input.housingDetails || null,
    meals: fromTriState(input.meals),
    mealsDetails: input.mealsDetails || null,

    experienceRequired: fromTriState(input.experienceRequired),
    experienceDetails: input.experienceDetails || null,
    languagesRequired,
    languages:
      languagesRequired === "yes"
        ? languageCodes.filter((code) => input.languages.includes(code))
        : [],
    drivingLicenseRequired: fromTriState(input.drivingLicenseRequired),
    drivingLicenseDetails: input.drivingLicenseDetails || null,

    workTime: (input.workTime || "unknown") as WorkTime,
    weeklyHours: input.weeklyHours ? parseWeeklyHours(input.weeklyHours) : null,
    scheduleDetails: input.scheduleDetails || null,

    couplesWelcome: fromTriState(input.couplesWelcome),
    petsAllowed: fromTriState(input.petsAllowed),
    otherConstraints: input.otherConstraints || null,

    applyEmail: input.applyEmail || null,
    applyPhone: input.applyPhone || null,
    applyUrl: normalizeWebUrl(input.applyUrl),
  }
}

export function offerInputSchema(context: OfferInputContext) {
  return offerFields(context)
    .superRefine((input, ctx) => checkOfferInput(input, ctx, context))
    .transform(toOfferInput)
}

// Colonnes de l'offre issues de la saisie : ni entreprise, ni origine, ni statut.
export type OfferInput = ReturnType<typeof toOfferInput>

// Formulaire vierge : chaque réponse vaut « Non précisé » tant que l'employeur ne l'a pas donnée.
export function emptyOfferFormValues(): OfferFormValues {
  return {
    title: "",
    occupationId: "",
    description: "",
    missions: "",
    seasonalContract: false,
    season: "",
    periodKind: "dates",
    startDate: "",
    endDate: "",
    durationValue: "",
    durationUnit: "",
    applicationDeadline: "",
    communeName: "",
    communeInseeCode: "",
    postalCode: "",
    departmentCode: "",
    locationDetails: "",
    salaryNetMin: "",
    salaryNetMax: "",
    salaryNetUnit: "",
    salaryGrossMin: "",
    salaryGrossMax: "",
    salaryGrossUnit: "",
    salaryNotes: "",
    housing: "unknown",
    housingDetails: "",
    meals: "unknown",
    mealsDetails: "",
    experienceRequired: "unknown",
    experienceDetails: "",
    languagesRequired: "unknown",
    languages: [],
    drivingLicenseRequired: "unknown",
    drivingLicenseDetails: "",
    workTime: "unknown",
    weeklyHours: "",
    scheduleDetails: "",
    couplesWelcome: "unknown",
    petsAllowed: "unknown",
    otherConstraints: "",
    applyEmail: "",
    applyPhone: "",
    applyUrl: "",
  }
}

// Une annonce enregistrée → valeurs du formulaire, pour la modifier. Une annonce qui a des dates
// précises s'édite par ses dates, sinon par sa durée.
export function offerToFormValues(offer: OfferInput): OfferFormValues {
  const dates = !!(offer.startDate && offer.endDate)
  const euros = (cents: number | null) =>
    cents === null ? "" : centsToEuros(cents)
  const textOf = (value: string | null) => value ?? ""

  return {
    title: offer.title,
    occupationId: textOf(offer.occupationId),
    description: textOf(offer.description),
    missions: textOf(offer.missions),
    // Une annonce enregistrée est saisonnière : la case a été cochée à son dépôt.
    seasonalContract: true,
    season: offer.season ?? "",
    periodKind: dates ? "dates" : "duration",
    startDate: textOf(offer.startDate),
    endDate: dates ? textOf(offer.endDate) : "",
    durationValue:
      !dates && offer.durationValue !== null ? String(offer.durationValue) : "",
    durationUnit: dates ? "" : textOf(offer.durationUnit),
    applicationDeadline: textOf(offer.applicationDeadline),
    communeName: offer.communeName,
    communeInseeCode: textOf(offer.communeInseeCode),
    postalCode: textOf(offer.postalCode),
    departmentCode: offer.departmentCode,
    locationDetails: textOf(offer.locationDetails),
    salaryNetMin: euros(offer.salaryNetMinCents),
    salaryNetMax: euros(offer.salaryNetMaxCents),
    salaryNetUnit: textOf(offer.salaryNetUnit),
    salaryGrossMin: euros(offer.salaryGrossMinCents),
    salaryGrossMax: euros(offer.salaryGrossMaxCents),
    salaryGrossUnit: textOf(offer.salaryGrossUnit),
    salaryNotes: textOf(offer.salaryNotes),
    housing: offer.housing,
    housingDetails: textOf(offer.housingDetails),
    meals: offer.meals,
    mealsDetails: textOf(offer.mealsDetails),
    experienceRequired: offer.experienceRequired,
    experienceDetails: textOf(offer.experienceDetails),
    languagesRequired: offer.languagesRequired,
    languages: [...offer.languages],
    drivingLicenseRequired: offer.drivingLicenseRequired,
    drivingLicenseDetails: textOf(offer.drivingLicenseDetails),
    workTime: offer.workTime,
    weeklyHours:
      offer.weeklyHours === null
        ? ""
        : String(offer.weeklyHours).replace(".", ","),
    scheduleDetails: textOf(offer.scheduleDetails),
    couplesWelcome: offer.couplesWelcome,
    petsAllowed: offer.petsAllowed,
    otherConstraints: textOf(offer.otherConstraints),
    applyEmail: textOf(offer.applyEmail),
    applyPhone: textOf(offer.applyPhone),
    applyUrl: textOf(offer.applyUrl),
  }
}

// Saisie en cours → entrée du minimum de publication, pour l'encart mis à jour en direct. Seules
// les valeurs valides comptent : un email mal formé n'est pas un moyen de candidature.
export function publicationInputOf(
  values: OfferFormValues,
  companyId: string | null,
): PublicationInput {
  const dates = values.periodKind === "dates"
  const validDate = (value: string) => (isPlausibleDate(value) ? value : null)
  const duration = parseDuration(values.durationValue.trim())
  const durationUnit = isOneOf(durationUnits, values.durationUnit)
    ? values.durationUnit
    : null
  const email = values.applyEmail.trim()
  const phone = values.applyPhone.trim()

  return {
    companyId,
    seasonalContractConfirmed: values.seasonalContract,
    season: isOneOf(seasons, values.season) ? values.season : null,
    communeName: values.communeName,
    departmentCode: values.departmentCode,
    startDate: dates ? validDate(values.startDate) : null,
    endDate: dates ? validDate(values.endDate) : null,
    durationValue:
      !dates &&
      durationUnit &&
      duration !== null &&
      duration <= maxDuration[durationUnit]
        ? duration
        : null,
    durationUnit: dates ? null : durationUnit,
    applicationChannel: "employer",
    applyEmail: isEmail(email) ? email : null,
    applyPhone: isPhoneNumber(phone) ? phone : null,
    applyUrl: normalizeWebUrl(values.applyUrl),
  }
}

// Montant valide en centimes, ou null.
function validCents(text: string) {
  const cents = eurosToCents(text)
  return cents !== null && cents > 0 && cents <= MAX_SALARY_CENTS ? cents : null
}

export type OfferPreview = Omit<OfferInput, "season"> & {
  season: Season | null
}

// Saisie en cours → ce que l'annonce enregistrerait, pour l'aperçu candidat. Un champ encore vide
// ou invalide reste vide : il s'affiche « Non précisé », rien n'est inventé.
export function previewOfferInput(values: OfferFormValues): OfferPreview {
  const dates = values.periodKind === "dates"
  const textOf = (value: string) => value.replace(/\0/g, "").trim() || null
  const validDate = (value: string) => (isPlausibleDate(value) ? value : null)
  const triStateOf = (value: string | undefined): TriState =>
    value && isOneOf(triStates, value) ? value : "unknown"
  const salary = (min: string, max: string, unit: string) => {
    const minCents = validCents(min)
    const maxCents = validCents(max)
    return minCents !== null && isOneOf(salaryUnits, unit)
      ? {
          minCents,
          maxCents: maxCents !== null && maxCents >= minCents ? maxCents : null,
          unit,
        }
      : { minCents: null, maxCents: null, unit: null }
  }
  const net = salary(
    values.salaryNetMin,
    values.salaryNetMax,
    values.salaryNetUnit,
  )
  const gross = salary(
    values.salaryGrossMin,
    values.salaryGrossMax,
    values.salaryGrossUnit,
  )
  const durationUnit = isOneOf(durationUnits, values.durationUnit)
    ? values.durationUnit
    : null
  const duration = parseDuration(values.durationValue.trim())
  const hours = parseWeeklyHours(values.weeklyHours.trim())
  const languagesRequired = triStateOf(values.languagesRequired)

  return {
    title: textOf(values.title) ?? "",
    occupationId: values.occupationId || null,
    description: textOf(values.description),
    missions: textOf(values.missions),

    season: isOneOf(seasons, values.season) ? values.season : null,
    startDate: validDate(values.startDate),
    endDate: dates ? validDate(values.endDate) : null,
    durationValue:
      !dates &&
      durationUnit &&
      duration !== null &&
      duration >= 1 &&
      duration <= maxDuration[durationUnit]
        ? duration
        : null,
    durationUnit: dates ? null : durationUnit,
    applicationDeadline: validDate(values.applicationDeadline),

    communeName: textOf(values.communeName) ?? "",
    communeInseeCode: values.communeInseeCode || null,
    postalCode: values.postalCode || null,
    departmentCode: values.departmentCode,
    locationDetails: textOf(values.locationDetails),

    salaryNetMinCents: net.minCents,
    salaryNetMaxCents: net.maxCents,
    salaryNetUnit: net.unit,
    salaryGrossMinCents: gross.minCents,
    salaryGrossMaxCents: gross.maxCents,
    salaryGrossUnit: gross.unit,
    salaryNotes: textOf(values.salaryNotes),

    housing: triStateOf(values.housing),
    housingDetails: textOf(values.housingDetails),
    meals: triStateOf(values.meals),
    mealsDetails: textOf(values.mealsDetails),

    experienceRequired: triStateOf(values.experienceRequired),
    experienceDetails: textOf(values.experienceDetails),
    languagesRequired,
    languages:
      languagesRequired === "yes"
        ? languageCodes.filter((code) => values.languages.includes(code))
        : [],
    drivingLicenseRequired: triStateOf(values.drivingLicenseRequired),
    drivingLicenseDetails: textOf(values.drivingLicenseDetails),

    workTime: isOneOf(workTimes, values.workTime) ? values.workTime : "unknown",
    weeklyHours:
      hours !== null &&
      hours >= weeklyHoursRange.min &&
      hours <= weeklyHoursRange.max
        ? hours
        : null,
    scheduleDetails: textOf(values.scheduleDetails),

    couplesWelcome: triStateOf(values.couplesWelcome),
    petsAllowed: triStateOf(values.petsAllowed),
    otherConstraints: textOf(values.otherConstraints),

    applyEmail: isEmail(values.applyEmail.trim())
      ? values.applyEmail.trim()
      : null,
    applyPhone: isPhoneNumber(values.applyPhone.trim())
      ? values.applyPhone.trim()
      : null,
    applyUrl: normalizeWebUrl(values.applyUrl),
  }
}

// Back-office (plan 15) : l'admin choisit aussi l'entreprise, l'origine de l'annonce et le canal
// de candidature. Une annonce collectée indique sa source (§6) ; le canal « chargé de
// recrutement » nomme la personne du service, seule à pouvoir rendre l'entreprise anonyme (§7).

export const adminOfferTextLimits = {
  sourceUrl: 500,
  sourceName: 150,
  recruiterName: 100,
} as const

function adminOfferFields(context: OfferInputContext) {
  return offerFields(context).extend({
    fieldsToConfirm: z
      .array(z.enum(confirmableFields))
      .max(confirmableFields.length)
      .default([]),
    additionalInfo: text(1000, tooLong("Le texte Divers", 1000)).default(""),
    origin: z.enum(offerOrigins),
    companyId: z.string(),
    sourceUrl: text(
      adminOfferTextLimits.sourceUrl,
      tooLong("Le lien de la source", adminOfferTextLimits.sourceUrl),
    ).refine(
      (value) => value === "" || normalizeWebUrl(value) !== null,
      "Saisissez l'adresse complète de l'annonce, par exemple https://www.mon-hotel.fr/emplois/serveur.",
    ),
    sourceName: text(
      adminOfferTextLimits.sourceName,
      tooLong("Le nom de la source", adminOfferTextLimits.sourceName),
    ),
    applicationChannel: z.enum(applicationChannels),
    recruiterName: text(
      adminOfferTextLimits.recruiterName,
      tooLong("Le nom", adminOfferTextLimits.recruiterName),
    ),
    hideCompanyIdentity: z.boolean(),
  })
}

type RawAdminOfferInput = z.output<ReturnType<typeof adminOfferFields>>

export type AdminOfferFormValues = z.input<ReturnType<typeof adminOfferFields>>
export type AdminOfferFormField = keyof AdminOfferFormValues

// Règles propres à la saisie de l'admin, qui s'ajoutent à celles de l'annonce.
function checkAdminOfferInput(
  input: RawAdminOfferInput,
  ctx: z.RefinementCtx,
  context: OfferInputContext,
) {
  const issue = (path: AdminOfferFormField, message: string) =>
    ctx.addIssue({ code: "custom", path: [path], message })

  if (!input.companyId) {
    issue("companyId", "Choisissez l'entreprise, ou créez sa fiche.")
  }

  // Une annonce collectée se suit à sa source, qui ne peut pas être un job-board (§2, §6).
  if (input.origin === "collected") {
    const sourceUrl = normalizeWebUrl(input.sourceUrl)
    if (!input.sourceUrl) {
      issue(
        "sourceUrl",
        "Indiquez l'adresse de l'annonce sur le site officiel de l'employeur.",
      )
    }
    for (const target of findBlockedTargets(
      { sourceUrl },
      context.blockedDomains,
    )) {
      issue("sourceUrl", blockedTargetMessage(target))
    }
    if (!input.sourceName) {
      issue(
        "sourceName",
        "Indiquez le nom de la source, par exemple « Site carrières de l'Hôtel du Lac ».",
      )
    }
  }

  // Intermédiation (§7) : une personne du service est nommée ; l'anonymat n'existe qu'avec elle.
  if (input.applicationChannel === "recruiter" && !input.recruiterName) {
    issue("recruiterName", "Indiquez le nom du chargé de recrutement.")
  }
  if (input.hideCompanyIdentity && input.applicationChannel !== "recruiter") {
    issue(
      "hideCompanyIdentity",
      "L'identité de l'entreprise ne peut être masquée que si le service assure l'intermédiation.",
    )
  }
}

// Valeurs validées → colonnes de l'offre, plus l'entreprise, l'origine, la source et le canal.
function toAdminOfferInput(input: RawAdminOfferInput) {
  const collected = input.origin === "collected"
  const recruiter = input.applicationChannel === "recruiter"
  return {
    ...toOfferInput(input),
    fieldsToConfirm: establishFields(
      toOfferInput(input),
      input.fieldsToConfirm,
    ),
    additionalInfo: input.additionalInfo || null,
    origin: input.origin,
    companyId: input.companyId,
    sourceUrl: collected ? normalizeWebUrl(input.sourceUrl) : null,
    sourceName: collected ? input.sourceName || null : null,
    applicationChannel: input.applicationChannel,
    recruiterName: recruiter ? input.recruiterName : null,
    hideCompanyIdentity: recruiter && input.hideCompanyIdentity,
  }
}

export function adminOfferInputSchema(context: OfferInputContext) {
  return adminOfferFields(context)
    .superRefine((input, ctx) => {
      checkOfferInput(input, ctx, context, {
        space: "admin",
        origin: input.origin,
        channel: input.applicationChannel,
      })
      checkAdminOfferInput(input, ctx, context)
    })
    .transform(toAdminOfferInput)
}

export type AdminOfferInput = ReturnType<typeof toAdminOfferInput>

// Champs propres à l'admin, enregistrés avec l'annonce.
export type AdminOfferFields = Pick<
  AdminOfferInput,
  | "origin"
  | "companyId"
  | "sourceUrl"
  | "sourceName"
  | "applicationChannel"
  | "recruiterName"
  | "hideCompanyIdentity"
  | "fieldsToConfirm"
  | "additionalInfo"
>

// Saisie d'une annonce collectée, le cas le plus fréquent du back-office : les candidatures vont
// à l'employeur, l'entreprise reste nommée. Les clés suivent l'ordre du formulaire.
export function emptyAdminOfferFormValues(): AdminOfferFormValues {
  return {
    origin: "collected",
    companyId: "",
    sourceUrl: "",
    sourceName: "",
    ...emptyOfferFormValues(),
    applicationChannel: "employer",
    recruiterName: "",
    hideCompanyIdentity: false,
    fieldsToConfirm: [],
    additionalInfo: "",
  }
}

export function adminOfferToFormValues(
  offer: OfferInput & AdminOfferFields,
): AdminOfferFormValues {
  return {
    origin: offer.origin,
    companyId: offer.companyId,
    sourceUrl: offer.sourceUrl ?? "",
    sourceName: offer.sourceName ?? "",
    ...offerToFormValues(offer),
    applicationChannel: offer.applicationChannel,
    recruiterName: offer.recruiterName ?? "",
    hideCompanyIdentity: offer.hideCompanyIdentity,
    fieldsToConfirm: offer.fieldsToConfirm ?? [],
    additionalInfo: offer.additionalInfo ?? "",
  }
}

// Saisie en cours de l'admin → entrée du minimum de publication : son entreprise, son canal et,
// pour une annonce collectée, sa source, contrôlée comme les destinations (§2).
export function adminPublicationInputOf(
  values: AdminOfferFormValues,
): PublicationInput {
  return {
    ...publicationInputOf(values, values.companyId || null),
    applicationChannel: values.applicationChannel,
    recruiterName: values.recruiterName,
    sourceUrl:
      values.origin === "collected" ? normalizeWebUrl(values.sourceUrl) : null,
  }
}
