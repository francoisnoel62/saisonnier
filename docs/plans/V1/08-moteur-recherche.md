# Plan 08 — Moteur de recherche (critères → SQL)

| Dépend de | Débloque | Taille | Cahier des charges |
|---|---|---|---|
| 07 | 09 | M | §4 (filtres, règles particulières), §9 |

## Objectif

Écrire `searchOffers(criteria)`, qui renvoie les offres actives satisfaisant **tous** les critères, avec leur nombre total, selon les règles du §4.
La conformité est prouvée par comparaison avec un oracle en mémoire.

## 1. Critères

Le schéma zod `SearchCriteria` vit dans `src/domain/search-criteria.ts`. Tous les critères sont facultatifs et combinables.

| Critère | Champs | Règle de correspondance |
|---|---|---|
| Métier | `occupations` (slugs) | le métier de l'offre est dans la liste ; une offre sans métier est exclue |
| Lieu | `regions`, `departments` | le département de l'offre est sélectionné, **ou** sa région l'est |
| Dates | `availableFrom`, `availableTo`, `flexibleDates` | voir le détail ci-dessous (H4) |
| Rémunération | `salaryBasis` (`net` ou `gross`), `salaryMinMonthly` (en euros) | voir le détail ci-dessous (H5) |
| Logement | `housing` | `housing = yes` |
| Repas | `meals` | `meals = yes` |
| Expérience | `beginnersWelcome` | `experienceRequired = no` (H8) |
| Langues | `spokenLanguages` | `languagesRequired = no`, **ou** `yes` avec des langues exigées toutes sélectionnées (H6) |
| Horaires | `workTime` (`full_time` ou `part_time`) | égalité stricte (H7) |
| Permis | `noLicenseRequired` | `drivingLicenseRequired = no` (H8) |
| Couples | `couplesWelcome` | `couplesWelcome = yes` |
| Animaux | `petsAllowed` | `petsAllowed = yes` |

**Dates (H4).**

- Mode strict, par défaut : `startDate ≥ from` et `endDate ≤ to`.
- Mode flexible : les périodes se chevauchent, c'est-à-dire `startDate ≤ to` et `endDate ≥ from`.
- Si une seule borne est renseignée, elle s'applique seule.
- Une offre sans dates précises est exclue.

**Rémunération (H5).**

- Seule compte la déclaration de la base choisie, en unité `month`, et sa borne basse doit atteindre le seuil.
- Un brut n'est jamais comparé à un seuil net.
- Une offre payée à l'heure ou à la journée est exclue.

**Règle transversale.** La valeur `unknown` ne satisfait jamais un critère actif. Un critère absent n'impose aucune restriction.

## 2. Oracle

`src/domain/offer-matching.ts` définit `matchesCriteria(offer, criteria, today)`.
C'est une implémentation pure et lisible du tableau ci-dessus, combinée avec `isActive` ; elle sert de spécification exécutable.

## 3. Implémentation SQL

Dans `src/server/search/` :

- **`build-conditions.ts`**
  - Une fonction par critère produit un fragment Drizzle : `inArray`, sous-requête sur `departments` pour les régions, `arrayContained` pour les langues, comparaisons de dates…
  - Les fragments sont combinés par `and(activeOfferConditions(today), …)`.
- **`search-offers.ts`**
  - `searchOffers(criteria, { page, pageSize = 20, today })` renvoie `{ items: OfferListItem[], total }`.
  - Deux requêtes partent en parallèle : la page de résultats et le `count`.
  - Tri : `publishedAt` décroissant, puis `id`.
  - `OfferListItem` ne contient que ce qu'affiche la carte : titre, entreprise publique, commune et département, saison, dates ou durée, salaire affiché, logement, repas, origine.

## Tests

**Unitaires** (`offer-matching`) : un tableau de cas par critère, dont :

- les cas `unknown` ;
- net contre brut ;
- un salaire horaire ;
- une offre avec une durée seule ;
- des bornes de dates égales.

**Intégration** : base de test avec `demoOffers` et une date `today` figée.

- Pour chaque critère seul **et** pour une douzaine de combinaisons, les identifiants renvoyés par `searchOffers` doivent être exactement ceux de `demoOffers.filter(matchesCriteria)`.
- Le `total` est exact, et la pagination stable.

## Critères d'acceptation

- [x] Chaque règle du §4 a ses tests unitaires, cas inconnus compris.
- [x] La requête SQL donne le même résultat que l'oracle sur toutes les combinaisons testées.
- [x] En local, une recherche sur la base de démonstration répond en moins de 100 ms.

## Hors périmètre

- Interface (plan 09).
- Recherche plein texte et tri par pertinence.
- Compteurs par option de filtre.
