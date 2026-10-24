import type {
  Evidence,
  ExtractedPosting,
  Observation,
} from "@/domain/scan/observation"
import { parseSourceDate } from "@/domain/scan/source-date"
import { fold } from "@/domain/scan/text"

import { extractContacts } from "../extract/contacts"
import { evidence, observed } from "../extract/evidence"
import { labeledValues, load, plainText, sectionTexts } from "../extract/html"
import { jobPostings } from "../extract/jsonld"
import { splitPostingBlocks } from "../extract/multi"
import { record } from "../extract/rss"
import { resolvePlace, type RawPlace } from "../places"
import type { AdapterContext, ListedPosting, ReadResult } from "./adapter"

export async function extractHtmlPosting(
  ctx: AdapterContext,
  listed: ListedPosting,
  body: string,
  version: string,
): Promise<ReadResult> {
  const $ = load(body)
  const job = jobPostings($)[0]
  const title =
    plainText(job?.title ?? $("h1").first().text() ?? listed.title ?? "") ||
    listed.title
  if (!title) return { kind: "unreadable", reason: "invalid_document" }
  const description = job?.description ? load(job.description) : $
  // Décoder avant de parcourir les sections, sinon les balises échappées ne structurent rien.
  if (job?.description && !description("p,li,h2,h3").length)
    description.root().html(load(job.description).text())
  const sections = sectionTexts(description)
  const postingSections = sections.filter(
    (section) => section.scope === "posting",
  )
  const usefulText = postingSections
    .map((section) => section.text)
    .join("\n\n")
    .slice(0, 20_000)
  const proof = (
    kind: Evidence["kind"],
    value: string,
    locator = listed.url,
    scope: Evidence["scope"] = "posting",
  ) => evidence(kind, locator, value, scope)
  const observations: Observation[] = []
  const add = (
    field: string,
    value: unknown,
    kind: Evidence["kind"],
    excerpt: string,
    scope: Evidence["scope"] = "posting",
  ) =>
    observations.push(
      observed(
        field,
        value,
        proof(kind, plainText(excerpt), listed.url, scope),
        version,
        ctx.now,
      ),
    )
  for (const section of sections)
    add(
      "description",
      section.text,
      job ? "jsonld" : "text",
      section.text,
      section.scope,
    )
  // Plusieurs observations d'une description ne sont pas des versions contradictoires du texte.
  const descriptionObservations = observations.filter(
    (observation) => observation.evidence.scope === "posting",
  )
  observations.splice(
    0,
    observations.length,
    ...observations.filter(
      (observation) => observation.evidence.scope === "site",
    ),
  )
  if (descriptionObservations.length)
    add("description", usefulText, job ? "jsonld" : "text", usefulText)
  const fieldSections: Record<string, string[]> = {
    missions: [],
    profile: [],
    organization: [],
    additionalInfo: [],
  }
  for (const section of postingSections) {
    const heading = fold(section.heading)
    if (/missions|votre quotidien/.test(heading))
      fieldSections.missions.push(section.text)
    if (/votre profil|profil recherche|competences requises/.test(heading))
      fieldSections.profile.push(section.text)
    if (/organisation|horaires|temps de travail/.test(heading))
      fieldSections.organization.push(section.text)
    if (/^divers|informations complementaires/.test(heading))
      fieldSections.additionalInfo.push(section.text)
  }
  for (const [field, texts] of Object.entries(fieldSections))
    if (texts.length)
      add(
        field,
        texts.join("\n\n"),
        job ? "jsonld" : "text",
        texts.join("\n\n"),
      )
  add("title", title, job ? "jsonld" : "text", title)
  if (ctx.source.kind === "employer")
    add("company", ctx.source.employer, "listing", ctx.source.employer.name)
  const rawPlaces: RawPlace[] = []
  const jobLocations = job?.jobLocation
    ? Array.isArray(job.jobLocation)
      ? job.jobLocation
      : [job.jobLocation]
    : []
  for (const { address } of jobLocations)
    rawPlaces.push({
      communeName: address.addressLocality,
      postalCode: address.postalCode ? String(address.postalCode) : undefined,
      country:
        typeof address.addressCountry === "string"
          ? address.addressCountry
          : address.addressCountry?.name,
    })
  if (!rawPlaces.length)
    for (const raw of Array.isArray(listed.data.locations)
      ? listed.data.locations
      : []) {
      const place = record(raw)
      rawPlaces.push({
        name: String(place["tt:name"] ?? ""),
        communeName: String(place["tt:city"] ?? ""),
        postalCode: String(place["tt:zip"] ?? ""),
        country: String(place["tt:country"] ?? ""),
      })
    }
  for (const label of labeledValues($)) {
    const key = fold(label.label)
    if (/contrat/.test(key))
      add(
        "contract",
        label.value,
        "html_label",
        `${label.label} : ${label.value}`,
        label.scope,
      )
    if (/salaire|remuneration/.test(key))
      add("salary", label.value, "html_label", label.value, label.scope)
    if (
      /localisation|lieu/.test(key) &&
      !rawPlaces.length &&
      label.scope === "posting"
    )
      rawPlaces.push({ name: label.value })
  }
  if (ctx.source.adapter === "factorial") {
    // Les quatre puces de synthèse ne sont pas des libellés : conserver leur texte prouvé.
    $("li").each((_i, node) => {
      if ($(node).closest("header,footer,nav").length) return
      const text = $(node).text().trim()
      if (/^(?:CDD|CDI)$/i.test(text)) add("contract", text, "text", text)
      if (/^Temps (?:plein|partiel)$/i.test(text))
        add(
          "workTime",
          /plein/.test(text) ? "full_time" : "part_time",
          "text",
          text,
        )
      if (/^[\d ,.]+\s*€/.test(text)) add("salary", text, "text", text)
      if (/,\s*France$/i.test(text) && text.length < 200)
        rawPlaces.push({
          name: text.replace(/,\s*France$/i, ""),
          country: "France",
        })
    })
    if (!rawPlaces.length && typeof listed.data.place === "string")
      rawPlaces.push({ name: listed.data.place, country: "France" })
  }
  if (job?.employmentType) {
    const types = Array.isArray(job.employmentType)
      ? job.employmentType
      : [job.employmentType]
    for (const type of types)
      if (type === "FULL_TIME" || type === "PART_TIME")
        add(
          "workTime",
          type === "FULL_TIME" ? "full_time" : "part_time",
          "jsonld",
          type,
        )
  }
  if (job?.validThrough)
    add("validThrough", job.validThrough, "jsonld", job.validThrough)
  const salary = job?.baseSalary
  if (salary?.value && salary.currency === "EUR") {
    const amount = salary.value.value ?? salary.value.minValue
    if (amount !== undefined)
      add(
        "salary",
        `${amount}${salary.value.maxValue ? ` à ${salary.value.maxValue}` : ""} € ${({ MONTH: "par mois", HOUR: "par heure", DAY: "par jour", WEEK: "par semaine", YEAR: "par an" } as Record<string, string>)[salary.value.unitText ?? ""] ?? ""}`,
        "jsonld",
        JSON.stringify(salary),
      )
  }
  const resolutions = await Promise.all(
    rawPlaces.map((place) =>
      resolvePlace(
        {
          ...place,
          proof: proof(
            jobLocations.length ? "jsonld" : "html_label",
            plainText(JSON.stringify(place)),
          ),
        },
        ctx,
      ),
    ),
  )
  const resolved = resolutions.every((place) => place.status === "established")
  const values = resolutions.flatMap((place) =>
    place.status === "established" || place.status === "to_verify"
      ? (place.value ?? [])
      : [],
  )
  const unique = values.filter(
    (place, index) =>
      values.findIndex(
        (other) => JSON.stringify(other) === JSON.stringify(place),
      ) === index,
  )
  if (unique.length)
    for (const resolution of resolutions)
      for (const proof of resolution.evidence)
        observations.push(
          observed(
            resolved ? "locations" : "locationCandidates",
            unique,
            proof,
            version,
            ctx.now,
          ),
        )
  const contacts = extractContacts(
    [
      ...sections,
      ...sectionTexts($).filter((section) => section.scope === "site"),
    ],
    listed.url,
    job ? "jsonld" : "text",
  )
  if (job?.applicationContact) {
    const contact =
      typeof job.applicationContact === "string"
        ? job.applicationContact
        : [job.applicationContact.email, job.applicationContact.telephone]
            .filter(Boolean)
            .join(" ")
    contacts.push(
      ...extractContacts(
        [{ heading: "Candidature", text: contact, scope: "posting" }],
        listed.url,
        "jsonld",
      ),
    )
  }
  const applyLink = $("a[href]")
    .filter(
      (_i, node) =>
        /postul|candid/i.test($(node).text()) &&
        /\/apply\//.test($(node).attr("href") ?? ""),
    )
    .first()
    .attr("href")
  const button = $("button:not([disabled])")
    .filter((_i, node) => /^postuler$/i.test($(node).text().trim()))
    .first()
  const formUrl = applyLink
    ? new URL(applyLink, listed.url).href
    : button.length || ctx.source.adapter === "fixture"
      ? listed.url
      : undefined
  if (formUrl)
    add(
      "activity",
      "active",
      "html_label",
      applyLink ? "Postulez maintenant" : "Postuler",
    )
  const posting: ExtractedPosting = {
    title,
    discoveryUrl: listed.url,
    officialUrl: ctx.source.kind === "employer" ? listed.url : undefined,
    externalId: listed.externalId,
    collectedAt: ctx.now,
    sourceDate: parseSourceDate(job?.datePosted ?? listed.sourceDate ?? ""),
    usefulText,
    observations,
    contacts,
    ...(formUrl
      ? {
          formUrl: {
            value: formUrl,
            official:
              new URL(formUrl).hostname === new URL(listed.url).hostname,
            evidence: proof("html_label", "Postuler"),
          },
        }
      : {}),
    detailReadable: usefulText.length > 0,
    listing: { evidence: proof(job ? "jsonld" : "text", title) },
  }
  const postings = splitPostingBlocks($, posting, version)
  return {
    kind: "extracted",
    posting: postings[0],
    ...(postings.length > 1 ? { postings } : {}),
  }
}
