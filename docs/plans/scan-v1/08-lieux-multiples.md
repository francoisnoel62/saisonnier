# Plan scan 08 — Lieux multiples

| Dépend de | Débloque | Taille | Références |
|---|---|---|---|
| 07 | 10 | M | cahier §6 (annonces regroupées) ; plan technique §3, §5 (données : localisations), lot 6 |

## Objectif

Une seule fiche pour un même poste proposé dans plusieurs lieux clairement listés. Elle est trouvée par chacun de ses lieux, sans doublon dans les résultats ni dans le compteur, et affichée de la même façon sur la carte et sur la fiche.

Le lieu principal reste dans `offers` ; les lieux supplémentaires vont dans une table dédiée (SH6). Les offres existantes ne sont pas migrées, et le dépôt employeur reste à un seul lieu.

## Étapes

1. **Table** `offer_locations` (`src/lib/db/schema/offers.ts`) :
   - `id`, `offerId` (`on delete cascade`), `position` (1 et plus ; unique par offre) ;
   - `communeName`, `communeInseeCode`, `postalCode`, `departmentCode` (référence `departments`), `locationDetails`.
   - **CHECK** : textes renseignés ou `NULL` (`notBlank`) ; un code INSEE commence par son département, comme `offers_commune_in_department`.
   - **Unicité** : (`offerId`, `communeInseeCode`) quand le code est connu.
   - **Index** : `departmentCode`, `offerId`.
   - Migration générée ; aucune reprise de données.
2. **Règles** `src/domain/offer-places.ts` :
   - `offerPlaces(offer, extraLocations)` : lieu principal puis lieux supplémentaires, dans l'ordre ;
   - `placesSummary(places)` : « Praz-sur-Arly · Haute-Savoie (74) et 2 autres lieux » ;
   - `MAX_EXTRA_LOCATIONS = 20`.
3. **Recherche** (`src/server/search/build-conditions.ts`). La condition `location` devient : lieu principal retenu, **ou** `exists (select 1 from offer_locations where offer_id = offers.id and …)`, sur les départements choisis comme sur les départements des régions choisies.
   - Aucune jointure : `db.$count` et la pagination comptent chaque offre une fois.
   - **Oracle** : `MatchableOffer` reçoit `extraPlaces?: { departmentCode, regionCode }[]` et la règle `location` de `matchesCriteria` les prend en compte. Les deux écritures restent identiques (CLAUDE.md, « Recherche »).
   - **Démonstration** : une offre à trois lieux dans deux régions, ajoutée à `demoOffers` ; le test de parité la couvre.
4. **Lecture** : `OfferListItem` gagne `placesCount` (la carte garde le lieu principal) ; `toOfferDetailsData` gagne la liste ordonnée des lieux. « Mes offres » suit, par `offerListColumns`.
5. **Affichage** : carte, « Praz-sur-Arly · Haute-Savoie (74) » puis « et 2 autres lieux » ; fiche, liste de tous les lieux avec leurs précisions.
6. **Saisie admin** (`OfferForm`, espace `admin` seulement).
   - Rubrique « Autres lieux du même poste » (`useFieldArray`, nom `extraLocations`), avec « Ajouter un lieu » et « Retirer ».
   - `CommuneField` reçoit une prop `prefix` : `""` pour le lieu principal, `` `extraLocations.${index}.` `` pour les autres. Ses champs cachés (code INSEE, code postal, département) suivent le préfixe. La saisie manuelle (service indisponible) reste possible.
   - Schéma admin : chaque lieu est validé comme le lieu principal (département connu, préfixe du code INSEE) ; une même commune n'apparaît qu'une fois ; 20 lieux supplémentaires au plus.
   - Écriture dans la même transaction que l'annonce : création, modification (remplacement de la liste) et publication par `publishCandidate` (plan 04).
7. **Scan** : une proposition dont les lieux sont établis (même poste, plusieurs lieux listés) donne le lieu principal (le premier) et les lieux supplémentaires, préremplis dans la revue. Des postes différents restent des dossiers différents (plan 05, `multiple_positions`).
8. **Dépôt employeur** inchangé : un seul lieu (hors périmètre).

## Tests

**Unitaires** : `offerPlaces`, `placesSummary`, validation des lieux supplémentaires (doublon de commune, département inconnu, plafond).

**Intégration** :

- parité oracle–requête avec l'offre à plusieurs lieux de la démonstration ;
- recherche sur deux départements de cette offre : un seul résultat, et un compteur de 1 ;
- recherche sur la région d'un lieu supplémentaire seulement : l'offre est trouvée ;
- suppression d'une offre : ses lieux supplémentaires disparaissent ; CHECK du code INSEE.

**E2E** dans `e2e/scan-presentation.spec.ts` :

- « Scan §6 — un poste dans plusieurs lieux : une seule fiche, trouvée par chacun de ses lieux, comptée une fois » ;
- « Scan §6 — l'admin ajoute un deuxième lieu à une annonce : il apparaît sur la fiche ».

## Critères d'acceptation

- [ ] Une offre à plusieurs lieux apparaît une seule fois, quel que soit le nombre de ses lieux retenus par les filtres.
- [ ] Oracle et requête restent d'accord sur tout le jeu de démonstration.
- [ ] Carte et fiche présentent les mêmes lieux ; le dépôt employeur n'est pas modifié.

## Hors périmètre

- Plusieurs lieux saisis par l'employeur ; périodes différentes selon le lieu (deux recrutements distincts, cahier §7).
- Carte géographique, recherche par rayon.
