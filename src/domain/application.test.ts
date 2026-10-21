import { describe, expect, it } from "vitest"

import { site } from "@/config/site"

import {
  applicationModeExplanation,
  publicCompanyName,
  type ApplicationFields,
} from "./application"

const company = {
  legalName: "SAS Hôtellerie du Grand Sérac",
  displayName: "Hôtel du Grand Sérac",
}

describe("publicCompanyName", () => {
  it("montre l'enseigne, sinon la raison sociale", () => {
    expect(publicCompanyName({ hideCompanyIdentity: false, company })).toBe(
      "Hôtel du Grand Sérac",
    )
    for (const displayName of [null, undefined, "  "]) {
      expect(
        publicCompanyName({
          hideCompanyIdentity: false,
          company: { ...company, displayName },
        }),
      ).toBe("SAS Hôtellerie du Grand Sérac")
    }
  })

  it("renvoie « Entreprise confidentielle » si l'identité est masquée", () => {
    expect(publicCompanyName({ hideCompanyIdentity: true, company })).toBe(
      "Entreprise confidentielle",
    )
  })
})

describe("applicationModeExplanation", () => {
  const employer: ApplicationFields = {
    applicationChannel: "employer",
    hideCompanyIdentity: false,
    company,
    applyEmail: null,
    applyPhone: null,
    applyUrl: null,
    recruiterName: null,
  }
  const email = "recrutement@grand-serac.example"
  const phone = "04 65 71 20 10"
  const url = "https://www.grand-serac.example/recrutement"

  it.each([
    [
      { applyEmail: email, applyPhone: phone },
      "Candidature directe auprès de l'employeur par email ou téléphone. Vous envoyez vous-même votre CV.",
    ],
    [
      { applyEmail: email },
      "Candidature directe auprès de l'employeur par email. Vous envoyez vous-même votre CV.",
    ],
    [
      { applyPhone: phone },
      "Candidature directe auprès de l'employeur par téléphone. Vous envoyez vous-même votre CV.",
    ],
    [{ applyUrl: url }, "Candidature sur le site officiel de l'employeur."],
    [
      { applyEmail: email, applyUrl: url },
      "Candidature directe auprès de l'employeur par email ou sur son site officiel. Vous envoyez vous-même votre CV.",
    ],
    [
      { applyEmail: email, applyPhone: phone, applyUrl: url },
      "Candidature directe auprès de l'employeur par email, téléphone ou sur son site officiel. Vous envoyez vous-même votre CV.",
    ],
  ])("candidature directe %j", (means, expected) => {
    expect(applicationModeExplanation({ ...employer, ...means })).toBe(expected)
  })

  const recruiter: ApplicationFields = {
    ...employer,
    applicationChannel: "recruiter",
    recruiterName: "Camille Rivière",
    applyEmail: "recrutement@saisonnier.example",
    applyPhone: "01 99 00 12 34",
  }

  it("nomme le chargé de recrutement du service et l'entreprise", () => {
    expect(applicationModeExplanation(recruiter)).toBe(
      `Candidature à adresser par email ou téléphone à Camille Rivière, chargé·e de recrutement chez ${site.name}, pour le compte de l'entreprise Hôtel du Grand Sérac. Vous envoyez vous-même votre CV.`,
    )
  })

  it("ne nomme jamais une entreprise anonyme", () => {
    const text = applicationModeExplanation({
      ...recruiter,
      hideCompanyIdentity: true,
    })
    expect(text).toBe(
      `Candidature à adresser par email ou téléphone à Camille Rivière, chargé·e de recrutement chez ${site.name}, pour le compte d'une entreprise qui souhaite rester confidentielle. Vous envoyez vous-même votre CV.`,
    )
    expect(text).not.toContain("Sérac")
  })
})
