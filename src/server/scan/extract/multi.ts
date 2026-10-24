import type { CheerioAPI } from "cheerio"

import type { ExtractedPosting } from "@/domain/scan/observation"
import { fold } from "@/domain/scan/text"
import { normalizeJobTitle } from "@/domain/scan/title"

import { evidence, observed } from "./evidence"
import { plainText, usefulText } from "./html"

// Ne séparer que des associations explicites. Une liste de métiers sans ces liens reste ambiguë.
export function splitPostingBlocks(
  $: CheerioAPI,
  base: ExtractedPosting,
  version: string,
): ExtractedPosting[] {
  const blocks: {
    title: string
    location: string
    period: string
    text: string
  }[] = []
  let missingAssociation = false
  $("table").each((_i, table) => {
    const headings = $(table)
      .find("tr")
      .first()
      .children("th,td")
      .map((_i, cell) => fold($(cell).text()))
      .get()
    const titleIndex = headings.findIndex((text) =>
      /poste|metier|intitule/.test(text),
    )
    const placeIndex = headings.findIndex((text) =>
      /lieu|commune|localisation/.test(text),
    )
    const periodIndex = headings.findIndex((text) =>
      /periode|dates|contrat/.test(text),
    )
    if ([titleIndex, placeIndex, periodIndex].some((index) => index < 0)) return
    $(table)
      .find("tr")
      .slice(1)
      .each((_j, row) => {
        const cells = $(row).children("td")
        const title = plainText(cells.eq(titleIndex).text()),
          location = plainText(cells.eq(placeIndex).text()),
          period = plainText(cells.eq(periodIndex).text())
        if (title && location && period)
          blocks.push({ title, location, period, text: usefulText($, $(row)) })
        else if (cells.length) missingAssociation = true
      })
  })
  if (!blocks.length)
    $("[data-posting], [data-position]").each((_i, block) => {
      const title = $(block).find("h2,h3,[data-title]").first().text().trim(),
        location = $(block).find("[data-location]").text().trim(),
        period = $(block).find("[data-period]").text().trim()
      if (title && location && period)
        blocks.push({ title, location, period, text: usefulText($, $(block)) })
      else missingAssociation = true
    })
  const groups = new Map<string, typeof blocks>()
  for (const block of blocks) {
    const key = `${normalizeJobTitle(block.title)}|${fold(block.period).replace(/\s+/g, " ")}`
    groups.set(key, [...(groups.get(key) ?? []), block])
  }
  if (blocks.length > 1 && !missingAssociation)
    return [...groups.values()].map((group, index) => ({
      ...base,
      title: group[0].title,
      ...(groups.size > 1 ? { index } : {}),
      usefulText: group.map((block) => block.text).join("\n"),
      associationsExplicit: true,
      multiplePositions: groups.size > 1,
      observations: [
        ...base.observations.filter(
          (observation) =>
            ![
              "title",
              "description",
              "locations",
              "locationCandidates",
              "period",
              "startDate",
              "endDate",
            ].includes(observation.field),
        ),
        observed(
          "title",
          group[0].title,
          evidence(
            "text",
            `${base.discoveryUrl}#posting-${index}`,
            group[0].text,
          ),
          version,
          base.collectedAt,
        ),
        observed(
          "description",
          group
            .map(
              (block) =>
                `${block.title}\n${block.location}\n${block.period}\n${block.text}`,
            )
            .join("\n"),
          evidence(
            "text",
            `${base.discoveryUrl}#posting-${index}`,
            group[0].text,
          ),
          version,
          base.collectedAt,
        ),
        observed(
          "locationCandidates",
          group.map((block) => ({ communeName: block.location })),
          evidence(
            "html_label",
            `${base.discoveryUrl}#posting-${index}`,
            group.map((block) => block.location).join(" · "),
          ),
          version,
          base.collectedAt,
        ),
      ],
    }))
  const ambiguous =
    /plusieurs (?:postes|recrutements)|differents postes|gouvernant[\s\S]*technicien[\s\S]*animateur/.test(
      fold(base.usefulText),
    )
  return [
    {
      ...base,
      multiplePositions: ambiguous || missingAssociation,
      associationsExplicit: false,
    },
  ]
}
