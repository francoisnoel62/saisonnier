import { load, type CheerioAPI, type Cheerio } from "cheerio"
import type { AnyNode } from "domhandler"

import { boundText } from "@/domain/scan/observation"
import { fold } from "@/domain/scan/text"

export { load }
const excluded =
  "script,style,nav,header,footer,form,noscript,[id*=cookie],[class*=cookie]"
export function usefulText($: CheerioAPI, root: Cheerio<AnyNode> = $("body")) {
  const clone = root.clone()
  clone.find(excluded).remove()
  clone.find("p,div,li,h1,h2,h3,h4,br,dt,dd,tr").append("\n")
  return boundText(
    clone
      .text()
      .replace(/[\t\r ]+/g, " ")
      .replace(/ *\n */g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  )
}
// Les descriptions JSON-LD sont parfois du HTML échappé une ou deux fois.
export function plainText(value: string) {
  let text = value
  for (let pass = 0; pass < 3; pass++) {
    const $ = load(text)
    const next = usefulText($)
    if (next === text) break
    text = next
  }
  return text
}
export type TextSection = {
  heading: string
  text: string
  scope: "posting" | "site"
}
export function sectionTexts($: CheerioAPI): TextSection[] {
  const sections: TextSection[] = []
  let heading = "",
    siteSection = false
  $("h1,h2,h3,h4,p,li").each((_i, node) => {
    const element = $(node)
    if (
      element.parents("p,li,script,style,form,[id*=cookie],[class*=cookie]")
        .length
    )
      return
    const text = element.text().replace(/\s+/g, " ").trim()
    if (!text) return
    const isHeading =
      /^h[1-4]$/.test(node.tagName) ||
      (element.children("strong,b").length > 0 &&
        element.children("strong,b").text().replace(/\s+/g, " ").trim() ===
          text)
    if (isHeading) {
      heading = text
      siteSection =
        /nos atouts|nos avantages|les avantages|les.*plus.*difference|pour tous|notre groupe|a propos|notre histoire|nos valeurs/.test(
          fold(text),
        )
    }
    const scope =
      siteSection || element.closest("header,footer,nav").length
        ? "site"
        : "posting"
    const previous = sections.at(-1)
    if (
      !isHeading &&
      previous &&
      previous.heading === heading &&
      previous.scope === scope
    )
      previous.text = boundText(`${previous.text}\n${text}`)
    else sections.push({ heading, text: boundText(text), scope })
  })
  if (!sections.length)
    sections.push({ heading: "", text: usefulText($), scope: "posting" })
  return sections
}
export function labeledValues($: CheerioAPI) {
  const values: { label: string; value: string; scope: "posting" | "site" }[] =
    []
  $("dt,th").each((_i, node) => {
    const element = $(node)
    const value = element
      .next(node.tagName === "dt" ? "dd" : "td")
      .text()
      .replace(/\s+/g, " ")
      .trim()
    if (value)
      values.push({
        label: element.text().trim(),
        value,
        scope: element.closest("header,footer,nav").length ? "site" : "posting",
      })
  })
  return values
}
