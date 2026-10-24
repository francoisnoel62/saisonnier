import { expect, it } from "vitest"

import { absent, established } from "./field"
import { proposalToAdminFormValues } from "./proposal-form"
import { buildProposal } from "./proposal"
import {
  proposalToOfferInput,
  sourceDay,
  truncatePostingText,
} from "./proposal-offer"
import { observation, posting } from "./rules-fixtures"

it("seules les conditions établies et les contacts de recrutement deviennent des colonnes", () => {
  const proposal = buildProposal(
    posting({
      observations: [
        observation("Logement possible. Salaire de 2000 € mensuels."),
      ],
      contacts: [
        {
          kind: "email",
          value: "accueil@hotel.example",
          section: "Contact",
          role: "accueil",
          official: true,
          evidence: observation("").evidence,
        },
      ],
    }),
    { referenceDate: "2026-10-24" },
  )
  const result = proposalToOfferInput(proposal)
  expect(result).toMatchObject({
    housing: "unknown",
    housingDetails: expect.stringContaining("possible"),
    salaryGrossMinCents: null,
    salaryNetMinCents: null,
    applyEmail: null,
    applyUrl: null,
  })
  expect(
    proposalToOfferInput({
      ...proposal,
      locations: absent(),
      period: absent(),
      season: absent(),
    }),
  ).toMatchObject({
    departmentCode: "",
    communeName: "",
    startDate: null,
    endDate: null,
    durationValue: null,
    season: null,
  })
})

it("les textes publiés sont bornés à une fin de phrase, sans modifier les preuves", () => {
  const text = "Une phrase complète. " + "Suite ".repeat(1200)
  const proposal = buildProposal(
    posting({ observations: [observation(text)] }),
    { referenceDate: "2026-10-24" },
  )
  expect(proposalToOfferInput(proposal).description).toBe(
    "Une phrase complète.",
  )
  expect(proposal.description).toMatchObject({ value: text.trim() })
  expect(truncatePostingText("Un titre très long", 8)).toBe("Un titre")
})

it("un instant source est affiché au jour de Paris, une date civile garde sa précision", () => {
  expect(sourceDay({ precision: "instant", at: "2026-10-23T23:30:00Z" })).toBe(
    "2026-10-24",
  )
  expect(
    sourceDay({
      precision: "day",
      date: "2026-10-23",
      timeZone: "Europe/Paris",
    }),
  ).toBe("2026-10-23")
})

it("transmet les contradictions facultatives à la publication et à la revue", () => {
  const proposal = buildProposal(
    posting({
      observations: [observation("Logement fourni. Logement non fourni.")],
    }),
    { referenceDate: "2026-10-24" },
  )
  const result = proposalToOfferInput(proposal)
  expect(result).toMatchObject({
    housing: "unknown",
    fieldsToConfirm: ["housing"],
  })
})

it("préremplit tous les lieux établis du même poste, sans inventer les lieux incertains", () => {
  const proposal = buildProposal(posting(), { referenceDate: "2026-10-24" })
  proposal.locations = established(
    [
      { communeName: "Huez", departmentCode: "38" },
      { communeName: "Tignes", departmentCode: "73", inseeCode: "73296" },
    ],
    [observation("Lieux du poste : Huez et Tignes.").evidence],
  )
  expect(proposalToOfferInput(proposal)).toMatchObject({
    communeName: "Huez",
    extraLocations: [{ communeName: "Tignes", communeInseeCode: "73296" }],
  })
  expect(
    proposalToAdminFormValues(proposal, { companyId: null }).extraLocations,
  ).toEqual([
    {
      communeName: "Tignes",
      communeInseeCode: "73296",
      departmentCode: "73",
      postalCode: "",
      locationDetails: "",
    },
  ])
  proposal.locations = absent()
  expect(proposalToOfferInput(proposal).extraLocations).toEqual([])
})
