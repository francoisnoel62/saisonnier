export type PageLink = number | "gap"

// Pages proposées par la pagination : la première, la dernière, et les voisines de la page
// courante ; un « gap » remplace les pages sautées. Une seule page sautée est montrée plutôt
// que remplacée par « … ».
export function pageLinks(page: number, pageCount: number): PageLink[] {
  const shown = new Set(
    [1, page - 1, page, page + 1, pageCount].filter(
      (n) => n >= 1 && n <= pageCount,
    ),
  )
  const pages = [...shown].sort((a, b) => a - b)

  const links: PageLink[] = []
  for (const [index, n] of pages.entries()) {
    const previous = pages[index - 1]
    if (previous !== undefined && n - previous === 2) links.push(n - 1)
    else if (previous !== undefined && n - previous > 2) links.push("gap")
    links.push(n)
  }
  return links
}
