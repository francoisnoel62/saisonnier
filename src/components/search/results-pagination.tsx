import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@/components/ui/pagination"
import { pageLinks } from "@/domain/pagination"
import type { SearchCriteria } from "@/domain/search-criteria"
import { searchHref } from "@/server/search/search-params"

// Pages de résultats d'une même recherche : de simples liens, qui gardent tous les critères.
export function ResultsPagination({
  criteria,
  page,
  pageCount,
}: {
  criteria: SearchCriteria
  page: number
  pageCount: number
}) {
  if (pageCount <= 1) return null

  return (
    <Pagination aria-label="Pages de résultats">
      <PaginationContent>
        {page > 1 && (
          <PaginationItem>
            <Link
              href={searchHref(criteria, Math.min(page, pageCount + 1) - 1)}
              className={buttonVariants({ variant: "ghost", size: "lg" })}
              aria-label="Page précédente"
            >
              <ChevronLeftIcon aria-hidden />
              <span className="hidden sm:inline">Précédente</span>
            </Link>
          </PaginationItem>
        )}
        {pageLinks(page, pageCount).map((link, index) => (
          <PaginationItem key={link === "gap" ? `gap-${index}` : link}>
            {link === "gap" ? (
              <span aria-hidden className="px-1 text-muted-foreground">
                …
              </span>
            ) : (
              <Link
                href={searchHref(criteria, link)}
                className={buttonVariants({
                  variant: link === page ? "outline" : "ghost",
                  size: "icon-lg",
                })}
                aria-current={link === page ? "page" : undefined}
                aria-label={`Page ${link}`}
              >
                {link}
              </Link>
            )}
          </PaginationItem>
        ))}
        {page < pageCount && (
          <PaginationItem>
            <Link
              href={searchHref(criteria, page + 1)}
              className={buttonVariants({ variant: "ghost", size: "lg" })}
              aria-label="Page suivante"
            >
              <span className="hidden sm:inline">Suivante</span>
              <ChevronRightIcon aria-hidden />
            </Link>
          </PaginationItem>
        )}
      </PaginationContent>
    </Pagination>
  )
}
