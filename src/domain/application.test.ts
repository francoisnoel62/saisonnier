import { describe, expect, it } from "vitest"

import { site } from "@/config/site"

import {
  applicationContacts,
  applicationMailto,
  applicationModeExplanation,
  publicCompanyName,
  recruiterIntroduction,
  telHref,
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

describe("recruiterIntroduction", () => {
  const recruiter: ApplicationFields = {
    applicationChannel: "recruiter",
    recruiterName: "Camille Rivière",
    hideCompanyIdentity: false,
    company,
  }

  it("présente le chargé de recrutement et l'entreprise publique", () => {
    expect(recruiterIntroduction(recruiter)).toBe(
      `Camille Rivière, chargé·e de recrutement de ${site.name} pour le compte de Hôtel du Grand Sérac`,
    )
  })

  it("tait le nom d'une entreprise anonyme", () => {
    const text = recruiterIntroduction({
      ...recruiter,
      hideCompanyIdentity: true,
    })
    expect(text).toBe(
      `Camille Rivière, chargé·e de recrutement de ${site.name} pour le compte de une entreprise qui souhaite rester confidentielle`,
    )
    expect(text).not.toContain("Sérac")
  })
})

describe("applicationMailto", () => {
  it("nomme l'offre et le candidat dans l'objet, reprend le message", () => {
    const href = applicationMailto({
      to: "recrutement@grand-serac.example",
      title: "Réceptionniste de nuit",
      candidateName: "Camille Candidat",
      message: "Bonjour,\nje suis disponible & motivée.",
    })
    const url = new URL(href)
    expect(url.protocol).toBe("mailto:")
    expect(url.pathname).toBe("recrutement@grand-serac.example")
    expect(url.searchParams.get("subject")).toBe(
      "Candidature – Réceptionniste de nuit – Camille Candidat",
    )
    expect(url.searchParams.get("body")).toBe(
      "Bonjour,\nje suis disponible & motivée.",
    )
    // Les espaces s'écrivent %20 : certains logiciels de messagerie affichent les « + ».
    expect(href).not.toContain("+")
  })

  it("n'ajoute pas de corps sans message", () => {
    for (const message of [null, undefined, "  "]) {
      const href = applicationMailto({
        to: "a@b.example",
        title: "Serveur",
        candidateName: "Lou",
        message,
      })
      expect(href).toBe(
        "mailto:a@b.example?subject=Candidature%20%E2%80%93%20Serveur%20%E2%80%93%20Lou",
      )
    }
  })
})

describe("telHref", () => {
  it("ne garde que les chiffres et le + initial", () => {
    expect(telHref("04 65 71 20 10")).toBe("tel:0465712010")
    expect(telHref("06.39.98.12.34")).toBe("tel:0639981234")
    expect(telHref("+33 6 39 98 12 34")).toBe("tel:+33639981234")
    expect(telHref("+41 (0)79 123 45 67")).toBe("tel:+41791234567")
  })
})

describe("applicationContacts", () => {
  const offer = {
    title: "Chef de partie",
    applicationChannel: "employer" as const,
    hideCompanyIdentity: false,
    company,
    applyEmail: "recrutement@grand-serac.example",
    applyPhone: "04 65 71 20 10",
    applyUrl: "https://www.grand-serac.example/recrutement",
  }
  const context = {
    blockedDomains: ["indeed.com", "indeedemail.com"],
    candidateName: "Camille Candidat",
    message: "Bonjour",
  }

  it("donne un lien pour chaque moyen de candidature", () => {
    const contacts = applicationContacts(offer, context)
    expect(contacts.blocked).toEqual([])
    expect(contacts.email).toMatchObject({
      label: "recrutement@grand-serac.example",
      href: expect.stringMatching(/^mailto:recrutement@grand-serac\.example\?/),
    })
    expect(contacts.phone).toEqual({
      label: "04 65 71 20 10",
      href: "tel:0465712010",
    })
    expect(contacts.url).toEqual({
      label: "grand-serac.example",
      href: "https://www.grand-serac.example/recrutement",
      domain: "grand-serac.example",
    })
  })

  it("rend indisponible un lien ou un email vers un domaine exclu", () => {
    const contacts = applicationContacts(
      {
        ...offer,
        applyEmail: "job@indeedemail.com",
        applyUrl: "https://fr.indeed.com/emploi/123",
      },
      context,
    )
    expect(contacts.email).toBe("unavailable")
    expect(contacts.url).toBe("unavailable")
    expect(contacts.phone).not.toBeNull()
    expect(contacts.blocked.map((target) => target.field)).toEqual([
      "applyUrl",
      "applyEmail",
    ])
  })

  it("n'ouvre que des liens web", () => {
    expect(
      applicationContacts(
        { ...offer, applyUrl: "javascript:alert(1)" },
        context,
      ).url,
    ).toBe("unavailable")
    expect(
      applicationContacts(
        { ...offer, applyUrl: "www.grand-serac.example/jobs" },
        context,
      ).url,
    ).toMatchObject({ href: "https://www.grand-serac.example/jobs" })
  })

  it("ignore un moyen absent", () => {
    const contacts = applicationContacts(
      { ...offer, applyEmail: null, applyPhone: " ", applyUrl: undefined },
      context,
    )
    expect(contacts).toMatchObject({ email: null, phone: null, url: null })
  })
})
