import { ArrowUpRightIcon } from "lucide-react"
import Link from "next/link"
import { Brand } from "@/components/public/brand"
import { site } from "@/config/site"
import styles from "./public.module.css"

const links = [
  { href: "/mentions-legales", label: "Mentions légales" },
  { href: "/cgu", label: "CGU" },
  { href: "/confidentialite", label: "Confidentialité" },
  { href: "/contact", label: "Contact" },
]

export function PublicFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerTop}>
        <div>
          <Link href="/" aria-label="Accueil">
            <Brand />
          </Link>
          <p>
            Des carrières qui se construisent.
            <br />
            Des équipes qui se retrouvent.
            <br />
            Saison après saison.
          </p>
        </div>
        <nav aria-label="Découvrir la plateforme">
          <span>VOTRE PROCHAINE SAISON</span>
          <Link href="/#saisonniers">
            Pour les saisonniers <ArrowUpRightIcon aria-hidden />
          </Link>
          <Link href="/#employeurs">
            Pour les employeurs <ArrowUpRightIcon aria-hidden />
          </Link>
          <Link href="/#recherche">
            Trouver ma saison <ArrowUpRightIcon aria-hidden />
          </Link>
          <Link href="/inscription/employeur">
            Publier une offre <ArrowUpRightIcon aria-hidden />
          </Link>
        </nav>
        <nav aria-label="À propos de ma saison">
          <span>ON CONSTRUIT LA SUITE</span>
          <Link href="/#notre-vision">
            Notre vision <ArrowUpRightIcon aria-hidden />
          </Link>
          <Link href="/#questions">
            Vos questions <ArrowUpRightIcon aria-hidden />
          </Link>
          <Link href="/contact">
            Parlons de vos besoins <ArrowUpRightIcon aria-hidden />
          </Link>
        </nav>
      </div>
      <div className={styles.footerBottom}>
        <p>
          © {new Date().getFullYear()} {site.name} · ma-saison.fr
        </p>
        <nav aria-label="Informations légales et contact">
          {links.map(({ href, label }) => (
            <Link key={href} href={href}>
              {label}
            </Link>
          ))}
        </nav>
        <span>Pensé pour durer plus d’une saison.</span>
      </div>
    </footer>
  )
}
