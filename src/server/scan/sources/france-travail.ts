import { z } from "zod"
import { established } from "@/domain/scan/field"

import { franceTravailPostingDataUrl } from "@/domain/scan/france-travail"
import { parseSourceDate } from "@/domain/scan/source-date"

import { evidence, observed } from "../extract/evidence"
import { load, plainText } from "../extract/html"
import { resolvePlace } from "../places"
import {
  listedPosting,
  readDocument,
  listFailure,
  postingFailure,
  pageLimit,
  type ListedPosting,
  type ScanAdapter,
} from "./adapter"

const postingSchema = z.object({
  intituleOffre: z.string().min(1),
  descriptif: z.string().min(1),
  syntheseContrat: z.string().optional(),
  salaire: z.string().optional(),
  dateCreation: z.string().optional(),
  datePublication: z.string().optional(),
  lieuTravail: z
    .object({
      libelleCommuneLieuTravail: z.string().optional(),
      codeDepartementLieuTravail: z.string().optional(),
      codePostalLieuTravail: z.string().optional(),
    })
    .optional(),
  etablissement: z
    .object({
      libelleEnseigne: z.string().optional(),
      urlEntreprise: z.string().nullable().optional(),
    })
    .optional(),
  conditionTravailPoste: z
    .object({ listeLibelleTypeHoraire: z.array(z.string()).optional() })
    .optional(),
})
export const franceTravailAdapter: ScanAdapter = {
  kind: "france-travail",
  extractorVersion: "france-travail@3",
  async listPage(ctx, cursor) {
    // Plusieurs recherches (lot D) : chacune parcourue dans la limite de pages, l'une après
    // l'autre ; une offre vue par deux recherches reste une seule piste (unicité par source).
    const list = cursor?.list ?? 0
    const page = cursor?.page ?? 0
    const nextList =
      list + 1 < ctx.source.listUrls.length ? { page: 0, list: list + 1 } : null
    if (page >= pageLimit(ctx) || !ctx.source.listUrls[list])
      return { kind: "listed", postings: [], next: nextList }
    const url = new URL(ctx.source.listUrls[list])
    url.searchParams.set("range", `${page * 20}-${page * 20 + 19}`)
    const response = await readDocument(ctx, url.href)
    if (!response.ok) return listFailure(response)
    const $ = load(response.body),
      postings: ListedPosting[] = []
    $("a[href]").each((_i, node) => {
      try {
        const element = $(node),
          target = new URL(element.attr("href")!, response.finalUrl).href
        const id = /\/offres\/recherche\/detail\/([A-Z0-9]+)\/?$/.exec(
          target,
        )?.[1]
        if (!id) return
        const title = plainText(element.find("h2,h3").first().text())
        const text = plainText(element.text())
          .replace(
            /\(déjà vu\)|(?:Publié|Actualisé) (?:aujourd'hui|hier|il y a \d+ jours?)/gi,
            "",
          )
          .trim()
        const listed = listedPosting(
          ctx,
          target,
          {
            title,
            text,
            sourceDate: element.find("time[datetime]").attr("datetime") ?? "",
          },
          id,
        )
        if (
          listed &&
          !postings.some(
            (posting) => posting.identityKey === listed.identityKey,
          )
        )
          postings.push(listed)
      } catch {
        /* Liens de compte et de candidature ignorés. */
      }
    })
    return {
      kind: "listed",
      postings,
      next:
        postings.length === 20 && page + 1 < pageLimit(ctx)
          ? { page: page + 1, list }
          : nextList,
    }
  },
  async readPosting(ctx, listed) {
    const url = franceTravailPostingDataUrl(listed.url)
    if (!url) return { kind: "unreadable", reason: "invalid_url" }
    const response = await readDocument(ctx, url)
    if (!response.ok) return postingFailure(response)
    try {
      const data = postingSchema.parse(JSON.parse(response.body))
      const observations = [
        observed(
          "title",
          plainText(data.intituleOffre),
          evidence("api", url, data.intituleOffre),
          "france-travail@3",
          ctx.now,
        ),
        observed(
          "description",
          plainText(data.descriptif),
          evidence("api", url, data.descriptif),
          "france-travail@3",
          ctx.now,
        ),
      ]
      for (const [field, value] of [
        // « Saisonnier » est la nature du contrat dans ce champ structuré,
        // pas une simple mention de saison dans une description générale.
        [
          "contract",
          data.syntheseContrat?.replace(
            /^\s*saisonnier\b/i,
            "Contrat saisonnier",
          ),
        ],
        ["salary", data.salaire],
        [
          "organization",
          data.conditionTravailPoste?.listeLibelleTypeHoraire?.join(" · "),
        ],
      ] as const)
        if (value)
          observations.push(
            observed(
              field,
              plainText(value),
              evidence("api", url, value),
              "france-travail@3",
              ctx.now,
            ),
          )
      if (data.etablissement?.libelleEnseigne)
        observations.push(
          observed(
            "company",
            { name: plainText(data.etablissement.libelleEnseigne) },
            evidence("api", url, data.etablissement.libelleEnseigne),
            "france-travail@3",
            ctx.now,
          ),
        )
      if (data.etablissement?.urlEntreprise)
        observations.push(
          observed(
            "employerWebsite",
            data.etablissement.urlEntreprise,
            evidence("api", url, data.etablissement.urlEntreprise),
            "france-travail@3",
            ctx.now,
          ),
        )
      if (data.lieuTravail?.libelleCommuneLieuTravail) {
        // La commune et le département explicitement fournis par France Travail
        // suffisent au lieu de l'annonce ; le code INSEE reste facultatif.
        const sourcePlace = data.lieuTravail
        const proof = evidence("api", url, JSON.stringify(sourcePlace))
        const resolution =
          sourcePlace.codeDepartementLieuTravail &&
          ctx.departmentCodes.includes(sourcePlace.codeDepartementLieuTravail)
            ? established(
                [
                  {
                    communeName: plainText(
                      sourcePlace.libelleCommuneLieuTravail!,
                    ),
                    departmentCode: sourcePlace.codeDepartementLieuTravail,
                    country: "France",
                  },
                ],
                [proof],
              )
            : await resolvePlace(
                {
                  communeName: data.lieuTravail.libelleCommuneLieuTravail,
                  postalCode: data.lieuTravail.codePostalLieuTravail,
                  country: "France",
                  proof,
                },
                ctx,
              )
        for (const proof of resolution.evidence)
          observations.push(
            observed(
              resolution.status === "established"
                ? "locations"
                : "locationCandidates",
              resolution.status === "established" ||
                resolution.status === "to_verify"
                ? resolution.value
                : [],
              proof,
              "france-travail@3",
              ctx.now,
            ),
          )
      }
      return {
        kind: "extracted",
        posting: {
          title: plainText(data.intituleOffre),
          externalId: listed.externalId,
          discoveryUrl: listed.url,
          collectedAt: ctx.now,
          sourceDate: parseSourceDate(
            data.datePublication ??
              data.dateCreation ??
              listed.sourceDate ??
              "",
          ),
          usefulText: plainText(data.descriptif),
          observations,
          contacts: [],
          detailReadable: true,
          listing: { evidence: evidence("api", url, data.intituleOffre) },
        },
      }
    } catch {
      return { kind: "unreadable", reason: "invalid_document" }
    }
  },
}
