import Link from "next/link"

import { site } from "@/config/site"

const links = [
  { href: "/mentions-legales", label: "Mentions légales" },
  { href: "/cgu", label: "CGU" },
  { href: "/confidentialite", label: "Confidentialité" },
  { href: "/contact", label: "Contact" },
]

export function PublicFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>{site.name}</p>
        <nav aria-label="Informations légales et contact">
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {links.map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="underline-offset-4 hover:text-foreground hover:underline"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  )
}
