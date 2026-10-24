import {
  applicationModeExplanation,
  publicCompanyName,
  type ApplicationFields,
} from "@/domain/application"
import { findBlockedTargets } from "@/domain/blocked-domains"
import type { OfferOrigin } from "@/domain/offer"
import { establishFields } from "@/domain/field-certainty"
import { isExternalApplication } from "@/domain/offer-labels"
import {
  previewOfferInput,
  type OfferFormReferentials,
  type OfferFormValues,
  type AdminOfferFormValues,
} from "@/domain/offer-input"

import {
  offerDetailsFields,
  toOfferDetailsData,
  type OfferDetailsData,
} from "./offer-details"
import type { OfferPreviewData } from "./offer-preview"

// Données de l'aperçu candidat (OfferPreview) : une annonce enregistrée, ou une saisie en cours.

// Lien et email qu'un candidat verrait : ceux qui mènent à un domaine exclu sont écartés, même
// devenu exclu après la publication (§9).
function withoutBlocked<
  T extends { applyEmail: string | null; applyUrl: string | null },
>(offer: T, blockedDomains: readonly string[]): T {
  const blocked = findBlockedTargets(offer, blockedDomains)
  const isBlocked = (field: "applyEmail" | "applyUrl") =>
    blocked.some((target) => target.field === field)
  return {
    ...offer,
    applyEmail: isBlocked("applyEmail") ? null : offer.applyEmail,
    applyUrl: isBlocked("applyUrl") ? null : offer.applyUrl,
  }
}

// Annonce enregistrée, lue avec son entreprise, son métier et son département.
export function savedOfferPreview(
  saved: Parameters<typeof toOfferDetailsData>[0] &
    ApplicationFields & {
      title: string
      origin: OfferOrigin
      applyEmail: string | null
      applyUrl: string | null
    },
  blockedDomains: readonly string[],
): OfferPreviewData {
  const offer = withoutBlocked(saved, blockedDomains)
  return {
    title: offer.title,
    origin: offer.origin,
    companyName: publicCompanyName(offer),
    details: toOfferDetailsData(offer),
    applicationExplanation: applicationModeExplanation(offer),
    contacts: {
      email: offer.applyEmail,
      phone: offer.applyPhone ?? null,
      url: offer.applyUrl,
    },
  }
}

// Origine et canal de la saisie : l'employeur dépose pour sa propre entreprise et reçoit lui-même
// les candidatures ; l'admin choisit (plan 15).
type DraftSetting = Pick<
  ApplicationFields,
  "applicationChannel" | "recruiterName" | "hideCompanyIdentity"
> & { origin: OfferOrigin }

const employerDraft: DraftSetting = {
  origin: "deposited",
  applicationChannel: "employer",
  recruiterName: null,
  hideCompanyIdentity: false,
}

// Saisie du formulaire : chaque champ tel qu'il serait enregistré ; un champ invalide reste vide,
// comme un lien ou un email vers un domaine exclu, qu'aucun candidat ne verrait (§9). Sans
// entreprise choisie (admin), l'aperçu l'annonce comme telle.
export function draftOfferPreview(
  values: OfferFormValues,
  referentials: OfferFormReferentials,
  company: { legalName: string; displayName: string | null } | null,
  setting: DraftSetting = employerDraft,
): OfferPreviewData {
  const draft = withoutBlocked(
    {
      ...previewOfferInput(values),
      additionalInfo:
        (values as AdminOfferFormValues).additionalInfo?.trim() || null,
      fieldsToConfirm: establishFields(
        previewOfferInput(values),
        (values as AdminOfferFormValues).fieldsToConfirm ?? [],
      ),
    },
    referentials.blockedDomains,
  )
  const occupation = referentials.occupations.find(
    (item) => item.id === draft.occupationId,
  )
  const department = referentials.departments.find(
    (item) => item.code === draft.departmentCode,
  )
  const fields = Object.fromEntries(
    offerDetailsFields.map((field) => [field, draft[field]]),
  ) as Omit<
    OfferDetailsData,
    | "occupationLabel"
    | "department"
    | "regionName"
    | "provenance"
    | "newness"
    | "externalApplication"
  >
  const recruiter = setting.applicationChannel === "recruiter"
  const application: ApplicationFields = {
    applicationChannel: setting.applicationChannel,
    applyEmail: draft.applyEmail,
    applyPhone: draft.applyPhone,
    applyUrl: draft.applyUrl,
    recruiterName: recruiter ? setting.recruiterName?.trim() || null : null,
    hideCompanyIdentity: recruiter && setting.hideCompanyIdentity,
    company: company ?? { legalName: "Entreprise à choisir" },
  }

  return {
    title: draft.title,
    origin: setting.origin,
    companyName: publicCompanyName(application),
    details: {
      ...fields,
      occupationLabel: occupation?.label ?? null,
      department: department
        ? { code: department.code, name: department.name }
        : null,
      regionName: department?.regionName ?? null,
      provenance:
        setting.origin === "collected" ? "human_verified" : "deposited",
      newness: null,
      externalApplication: isExternalApplication(application),
    },
    applicationExplanation: applicationModeExplanation(application),
    contacts: {
      email: draft.applyEmail,
      phone: draft.applyPhone,
      url: draft.applyUrl,
    },
  }
}
