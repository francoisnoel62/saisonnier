# Plan 14 — Dépôt & gestion des annonces employeur

| Dépend de | Débloque | Taille | Cahier des charges |
|---|---|---|---|
| 11, 13 | 15, 16 | L | §2 (destinations admises), §3 (minimum, compléments, rémunération), §6 (dépôt, actualité) |

## Objectif

Construire un formulaire structuré, complété par une description libre, qui publie toute annonce satisfaisant le minimum, même incomplète.
Un champ laissé vide ne devient jamais une réponse.
Le plan ajoute aussi la gestion des annonces par l'employeur.

## Étapes

1. **Schéma d'entrée partagé** dans `src/domain/offer-input.ts` (zod).
   - Le formulaire l'utilise via react-hook-form et `@hookform/resolvers`, et les Server Actions le réutilisent.
   - Les montants sont saisis en euros et stockés en centimes.
2. **`OfferForm`** dans `src/components/offers/offer-form/`.
   - Composants shadcn : `field`, `radio-group`, `calendar`, `textarea`…
   - Sections (* = obligatoire) :

     | # | Section | Champs |
     |---|---|---|
     | 1 | Poste | intitulé*, métier (référentiel actif), description libre, missions |
     | 2 | Contrat* | case « Il s'agit d'un contrat saisonnier », saison, dates de début et de fin **ou** durée, date limite de candidature |
     | 3 | Lieu* | commune (autocomplétion, voir ci-dessous), précisions (station, lieu-dit) |
     | 4 | Rémunération | net et/ou brut : montant ou fourchette, avec unité ; précisions |
     | 5 | Conditions | logement et repas, avec leurs conditions |
     | 6 | Profil | expérience exigée, langues exigées (et leur liste), permis exigé (et précisions) |
     | 7 | Organisation | temps de travail, heures hebdomadaires, horaires |
     | 8 | Vie pratique | couples, animaux, autres contraintes documentées |
     | 9 | Candidature* | email et/ou téléphone ; lien officiel facultatif (H9) |

   - **Lieu** : l'autocomplétion interroge `geo.api.gouv.fr/communes?nom=…&fields=nom,code,codesPostaux,codeDepartement&boost=population&limit=8`, et le département s'en déduit.
   - **Rémunération** : le texte d'aide invite à indiquer le net mensuel avant impôt, si l'employeur le connaît.
   - **`TriStateField`** : un `RadioGroup` Oui / Non / **Non précisé**, dont la valeur initiale est « Non précisé ».
   - **Encart « Minimum de publication »**, mis à jour en direct par `checkPublicationMinimum`. L'interface dit clairement que le reste est facultatif.
   - **Aperçu candidat** : un `Sheet` qui rend `OfferDetails` (plan 11) avec les valeurs saisies.
3. **Server Actions** dans `src/server/offers/employer-actions.ts` : `createOffer`, `updateOffer`, `unpublishOffer` et `republishOffer`.
   - Chacune appelle `requireRole("employer")` et vérifie que l'offre appartient à l'entreprise de l'employeur.
   - **Validation** :
     - zod, minimum de publication, et domaines exclus lus en base ;
     - le message d'erreur est précis, par exemple : « Les liens vers indeed.fr ne sont pas acceptés : indiquez un contact direct de l'entreprise ».
   - **Valeurs imposées** : `origin = deposited` et `applicationChannel = employer`. L'anonymat est réservé à l'admin (plan 15).
   - **Statut à la création** :
     - si le rattachement est vérifié, l'annonce passe `published`, avec `publishedAt` et `validityConfirmedAt` à maintenant ;
     - sinon, elle reste `pending_review`.
   - **Remise en ligne** : refusée pour une annonce expirée, tant que ses dates n'ont pas été corrigées.
4. **Page `/employeur/annonces`**, sous forme de tableau TanStack v9 (modèle `data-table.tsx`, sans glisser-déposer).
   - **Colonnes** : intitulé, statut (badge en français), lieu, saison et dates, dernière confirmation de validité.
   - **Actions** : Aperçu, Modifier, Mettre hors ligne ou Remettre en ligne.
   - La page ne liste que les annonces **déposées** de l'entreprise de l'employeur. Les annonces collectées n'y apparaissent jamais et ne sont jamais modifiables par lui (§6).
5. **Tableau de bord `/employeur`.**
   - Des `SectionCards` : en ligne, en attente de vérification, hors ligne ou expirées.
   - Un bouton « Déposer une annonce ».
   - La bannière de vérification du plan 13.

## Tests

**Unitaires** (`offer-input`) :

- la conversion des euros en centimes ;
- un champ vide devient `unknown` ou `null`, jamais `no`.

**E2E** dans `e2e/depot.spec.ts` :

- un employeur vérifié publie une annonce **minimale** ; elle est visible côté candidat, avec « Non précisé » sur tout le reste ;
- l'annonce d'un employeur non vérifié est « en attente » et invisible ;
- un lien `indeed.fr` est refusé ;
- un email `@indeedemail.com` est refusé ;
- une annonce modifiée puis mise hors ligne disparaît de la recherche.

## Critères d'acceptation

- [x] §3 : une annonce est publiable dès que le minimum est satisfait, et « non précisé » est préservé de bout en bout.
- [x] §2 / §9 : aucune destination de candidature ne mène à un job-board exclu.
- [x] §6 : une annonce reste en ligne tant que le déposant la maintient, sauf échéance dépassée.

## Hors périmètre

- Brouillons, duplication d'annonce, import en masse.
- Options payantes dans le formulaire.
