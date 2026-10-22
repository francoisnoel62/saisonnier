import { ArrowUpRightIcon, HeartIcon } from "lucide-react"
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
            Les belles saisons commencent
            <br />
            par une rencontre.
          </p>
        </div>
        <nav aria-label="Découvrir la plateforme">
          <span>À VOUS DE JOUER</span>
          <Link href="/#recherche">
            Trouver ma saison <ArrowUpRightIcon aria-hidden />
          </Link>
          <Link href="/inscription/employeur">
            Recruter mon équipe <ArrowUpRightIcon aria-hidden />
          </Link>
          <Link href="/contact">
            Nous écrire <ArrowUpRightIcon aria-hidden />
          </Link>
        </nav>
        <div className={styles.footerSignature}>
          <HeartIcon aria-hidden />
          <p>
            Pensé pour les rencontres.
            <br />
            <strong>Fait pour la vraie vie.</strong>
          </p>
        </div>
      </div>
      <div className={styles.footerBottom}>
        <p>
          © {new Date().getFullYear()} {site.name}
        </p>
        <nav aria-label="Informations légales et contact">
          {links.map(({ href, label }) => (
            <Link key={href} href={href}>
              {label}
            </Link>
          ))}
        </nav>
        <span>À chaque saison, un nouveau départ.</span>
      </div>
    </footer>
  )
}
