// Activités principales (NAF rév. 2) du tourisme et de l'hôtellerie de loisirs (§2), avec leur
// libellé INSEE. L'API Recherche d'entreprises ne donne que le code : ce tableau en fournit le
// libellé et signale à l'admin les activités qui relèvent du périmètre. Ce n'est qu'une aide :
// une entreprise hors de cette liste peut relever du tourisme (à vérifier sur l'annuaire).
export const tourismNafLabels: Record<string, string> = {
  "49.39C": "Téléphériques et remontées mécaniques",
  "50.10Z": "Transports maritimes et côtiers de passagers",
  "50.30Z": "Transports fluviaux de passagers",
  "55.10Z": "Hôtels et hébergement similaire",
  "55.20Z": "Hébergement touristique et autre hébergement de courte durée",
  "55.30Z":
    "Terrains de camping et parcs pour caravanes ou véhicules de loisirs",
  "55.90Z": "Autres hébergements",
  "56.10A": "Restauration traditionnelle",
  "56.10B": "Cafétérias et autres libres-services",
  "56.10C": "Restauration de type rapide",
  "56.21Z": "Services des traiteurs",
  "56.29B": "Autres services de restauration n.c.a.",
  "56.30Z": "Débits de boissons",
  "77.21Z": "Location et location-bail d'articles de loisirs et de sport",
  "79.11Z": "Activités des agences de voyage",
  "79.12Z": "Activités des voyagistes",
  "79.90Z": "Autres services de réservation et activités connexes",
  "85.51Z": "Enseignement de disciplines sportives et d'activités de loisirs",
  "90.01Z": "Arts du spectacle vivant",
  "91.02Z": "Gestion des musées",
  "91.03Z":
    "Gestion des sites et monuments historiques et des attractions touristiques similaires",
  "91.04Z":
    "Gestion des jardins botaniques et zoologiques et des réserves naturelles",
  "93.11Z": "Gestion d'installations sportives",
  "93.13Z": "Activités des centres de culture physique",
  "93.19Z": "Autres activités liées au sport",
  "93.21Z": "Activités des parcs d'attractions et parcs à thèmes",
  "93.29Z": "Autres activités récréatives et de loisirs",
  "96.04Z": "Entretien corporel",
}

export function isTourismActivity(nafCode: string | null | undefined) {
  return !!nafCode && Object.hasOwn(tourismNafLabels, nafCode)
}

// Libellé connu d'un code, ou null.
export function nafLabel(nafCode: string | null | undefined) {
  return nafCode && isTourismActivity(nafCode)
    ? tourismNafLabels[nafCode]
    : null
}
