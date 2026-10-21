import { expect, type Page } from "@playwright/test"

// Même seuil que useIsMobile (src/hooks/use-mobile.ts) : en dessous, la barre latérale est un panneau.
const MOBILE_BREAKPOINT = 768

export function isMobileViewport(page: Page) {
  return (page.viewportSize()?.width ?? Infinity) < MOBILE_BREAKPOINT
}

// Sur mobile, on ouvre le panneau de navigation ; sur bureau, la barre est déjà visible.
export async function openMenu(page: Page) {
  if (isMobileViewport(page)) {
    await page.getByRole("button", { name: "Toggle Sidebar" }).click()
  }
}

export function navLink(page: Page, title: string) {
  return page.getByRole("link", { name: title, exact: true })
}

export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
}
