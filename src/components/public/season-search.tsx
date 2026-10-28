"use client"

import {
  ArrowRightIcon,
  ArrowUpRightIcon,
  BriefcaseBusinessIcon,
  ChevronDownIcon,
  HouseIcon,
  MapPinIcon,
  SearchIcon,
} from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { signInPath } from "@/domain/redirects"
import { searchHref } from "@/server/search/search-params"
import styles from "./search.module.css"

export function SeasonSearch({ signedIn }: { signedIn: boolean }) {
  const [occupation, setOccupation] = useState("")
  const [region, setRegion] = useState("")
  const [housing, setHousing] = useState(false)
  const next = searchHref({
    occupations: occupation ? [occupation] : [],
    regions: region ? [region] : [],
    housing,
  })
  const browse = (path: string) => (signedIn ? path : signInPath(path))
  return (
    <div className={styles.searchWrap} id="recherche">
      <form
        className={styles.searchForm}
        action={signedIn ? "/offres" : "/connexion"}
        role="search"
        aria-label="Trouver un emploi saisonnier"
      >
        {!signedIn && <input type="hidden" name="next" value={next} />}
        <label className={styles.searchField}>
          <BriefcaseBusinessIcon aria-hidden />
          <span>
            <span className={styles.fieldLabel}>
              QUEL JOB VOUS FAIT ENVIE ?
            </span>
            <select
              name={signedIn ? "metier" : undefined}
              value={occupation}
              onChange={(event) => setOccupation(event.target.value)}
              aria-label="Métier"
            >
              <option value="">Tous les métiers</option>
              <option value="serveur">Serveur / serveuse</option>
              <option value="cuisinier">Cuisinier / cuisinière</option>
              <option value="receptionniste">Réceptionniste</option>
              <option value="animateur-polyvalent">
                Animateur / animatrice
              </option>
              <option value="animateur-sportif">
                Animateur / animatrice sportif
              </option>
            </select>
          </span>
          <ChevronDownIcon aria-hidden className={styles.selectChevron} />
        </label>
        <label className={styles.searchField}>
          <MapPinIcon aria-hidden />
          <span>
            <span className={styles.fieldLabel}>ET SI VOUS PARTIEZ OÙ ?</span>
            <select
              name={signedIn ? "region" : undefined}
              value={region}
              onChange={(event) => setRegion(event.target.value)}
              aria-label="Région"
            >
              <option value="">Partout en France</option>
              <option value="84">Auvergne-Rhône-Alpes</option>
              <option value="27">Bourgogne-Franche-Comté</option>
              <option value="53">Bretagne</option>
              <option value="24">Centre-Val de Loire</option>
              <option value="94">Corse</option>
              <option value="44">Grand Est</option>
              <option value="32">Hauts-de-France</option>
              <option value="11">Île-de-France</option>
              <option value="28">Normandie</option>
              <option value="75">Nouvelle-Aquitaine</option>
              <option value="76">Occitanie</option>
              <option value="52">Pays de la Loire</option>
              <option value="93">Provence-Alpes-Côte d’Azur</option>
              <option value="01">Guadeloupe</option>
              <option value="02">Martinique</option>
              <option value="03">Guyane</option>
              <option value="04">La Réunion</option>
              <option value="06">Mayotte</option>
            </select>
          </span>
          <ChevronDownIcon aria-hidden className={styles.selectChevron} />
        </label>
        <Button className={styles.searchButton} type="submit">
          <SearchIcon aria-hidden /> Trouver ma saison{" "}
          <ArrowRightIcon aria-hidden />
        </Button>
        {signedIn && housing && (
          <input type="hidden" name="logement" value="oui" />
        )}
      </form>
      <div className={styles.searchBelow}>
        <div className={styles.quickSearches}>
          <label className={styles.housingToggle}>
            <input
              type="checkbox"
              checked={housing}
              onChange={(event) => setHousing(event.target.checked)}
            />
            <HouseIcon aria-hidden /> Avec logement
          </label>
          <span className={styles.quickDivider} />
          <Link href={browse(searchHref({ beginnersWelcome: true }))}>
            Premier job ? <ArrowUpRightIcon aria-hidden />
          </Link>
          <Link href={browse(searchHref({ couplesWelcome: true }))}>
            Partir à deux <ArrowUpRightIcon aria-hidden />
          </Link>
        </div>
        <p>
          {signedIn
            ? "Votre prochaine aventure est à portée de clic."
            : "Compte gratuit pour accéder aux offres."}
        </p>
      </div>
    </div>
  )
}
