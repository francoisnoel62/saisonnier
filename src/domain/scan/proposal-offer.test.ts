import { expect, it } from "vitest"

import { absent } from "./field"
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
