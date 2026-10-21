# Plan 07 — Modèle « Offre » & règles métier

| Dépend de | Débloque | Taille | Cahier des charges |
|---|---|---|---|
| 05 | 08, 13 | L | §2, §3 (minimum, compléments, « non précisé », rémunération), §6 (actualité), §7 (anonymat) |

## Objectif

Poser le schéma des entreprises et des offres, et écrire les règles métier **pures et testées** dont dépendent la recherche, la fiche, le dépôt et le back-office.
Ce plan ne contient aucune interface.

## 1. Énumérations (`pgEnum`)

| Enum | Valeurs |
|---|---|
| `tri_state` | `yes`, `no`, `unknown` (« Non précisé », valeur par défaut) |
| `offer_origin` | `deposited`, `collected` |
| `offer_status` | `pending_review`, `published`, `unpublished`, `expired`, `rejected` |
| `season` | `summer`, `winter` |
| `duration_unit` | `weeks`, `months` |
| `salary_unit` | `hour`, `day`, `week`, `month`, `season`, `lump_sum` |
| `work_time` | `full_time`, `part_time`, `unknown` |
| `application_channel` | `employer`, `recruiter` |
| `membership_status` | `pending`, `verified`, `rejected` |

## 2. Tables

Fichiers `src/lib/db/schema/companies.ts` et `offers.ts`.

**`companies`**

| Colonne | Contenu |
|---|---|
| `id` | uuid |
| `legalName` | raison sociale |
| `displayName` | enseigne ; facultatif |
| `siren` | unique ; facultatif |
| `siret` | |
| `nafCode`, `nafLabel` | activité principale, pré-remplie au plan 13 ; aide à vérifier le secteur |
| `website` | |
| `createdAt`, `updatedAt` | |

**`company_members`**

| Colonne | Contenu |
|---|---|
| `userId` | text, PK → `user.id` ; en V1, un employeur = une entreprise |
| `companyId` | → `companies` |
| `jobTitle`, `relationship`, `phone` | fonction, lien avec l'entreprise, téléphone |
| `status` | `membership_status` |
| `reviewNote`, `reviewedAt` | décision de l'admin |
| `reviewedBy` | → `user.id` |
| `createdAt` | |

**`offers`**

| Groupe | Colonnes |
|---|---|
| Identité | `id` (uuid) · `origin` · `status` · `companyId` (obligatoire : entreprise identifiable) · `createdByUserId` (nullable) · `title` (obligatoire, H13) · `occupationId` (nullable) |
| Contenu | `description` (description libre) · `missions` |
| Contrat & période | `season` (obligatoire) · `startDate` · `endDate` · `durationValue` · `durationUnit` · `applicationDeadline` |
| Lieu | `communeName` (obligatoire) · `communeInseeCode` · `postalCode` · `departmentCode` (→ `departments`, obligatoire) · `locationDetails` (station, lieu-dit) |
| Rémunération | `salaryNetMinCents` · `salaryNetMaxCents` · `salaryNetUnit` · `salaryGrossMinCents` · `salaryGrossMaxCents` · `salaryGrossUnit` · `salaryNotes` |
| Conditions | `housing` (tri) · `housingDetails` · `meals` (tri) · `mealsDetails` |
| Profil | `experienceRequired` (tri) · `experienceDetails` · `languagesRequired` (tri) · `languages` (text[], codes ISO 639-1) · `drivingLicenseRequired` (tri) · `drivingLicenseDetails` |
| Organisation | `workTime` · `weeklyHours` · `scheduleDetails` |
| Vie pratique | `couplesWelcome` (tri) · `petsAllowed` (tri) · `otherConstraints` |
| Candidature | `applicationChannel` (`employer` par défaut) · `applyEmail` · `applyPhone` · `applyUrl` · `recruiterName` · `hideCompanyIdentity` (faux par défaut) |
| Collecte | `sourceUrl` · `sourceName` · `sourceCheckedAt` |
| Cycle de vie | `publishedAt` · `validityConfirmedAt` · `validityReminderSentAt` · `unpublishedAt` · `expiredAt` · `createdAt` · `updatedAt` |

**Contraintes `CHECK`** : ce sont des invariants, vrais pour toute ligne.

- **Période ou durée** : (`startDate` et `endDate`) ou (`durationValue` et `durationUnit`).
- **Cohérence des dates** : `endDate ≥ startDate`.
- **Candidature** : au moins un moyen parmi `applyEmail`, `applyPhone` et `applyUrl`.
- **Salaire** : pour chaque base (net, brut), montant et unité sont présents ensemble, et le maximum est supérieur ou égal au minimum.
- **Anonymat** : `hideCompanyIdentity` ⇒ `applicationChannel = 'recruiter'`.
- **Chargé de recrutement** : `applicationChannel = 'recruiter'` ⇒ `recruiterName` renseigné.
- **Collecte** :
  - `origin = 'collected'` ⇒ `sourceUrl` renseigné ;
  - un index unique partiel porte sur `sourceUrl` pour les annonces collectées.

**Index** : `status`, `departmentCode`, `occupationId`, `(startDate, endDate)`, `publishedAt`, et un index GIN sur `languages`.

Ajouter aussi la clé étrangère `contact_messages.offerId → offers.id` (`ON DELETE SET NULL`).

## 3. Règles métier pures

Elles vivent dans `src/domain/`, et chaque règle est testée.

**`tri-state.ts`**

- `triLabel(v)` renvoie « Oui », « Non » ou « Non précisé ».
- Aucune fonction ne transforme `unknown` en booléen.

**`salary.ts`**

- `salaryStatements(offer)` renvoie 0 à 2 déclarations de la forme `{ basis, unit, minCents, maxCents? }`, où `basis` vaut `net` ou `gross`.
- `displayedSalary(offer)` choisit, dans cet ordre :
  1. le net mensuel ;
  2. sinon le brut disponible, mensuel en priorité ;
  3. sinon le net dans son unité d'origine.
- `formatSalary(s)` produit par exemple :
  - « 1 850 € net / mois (avant impôt) » ;
  - « 12,50 € brut / heure » ;
  - « 1 800 – 2 000 € brut / mois ».
- **Aucune conversion**, ni brut ↔ net, ni horaire ↔ mensuel.

**`offer-activity.ts`**

- `todayInParis(now)` renvoie la date du jour dans le fuseau Europe/Paris.
- `expiryReason(offer, today)` renvoie :
  - `deadline` si `applicationDeadline < today` ;
  - `end_date` si `endDate < today` ;
  - `null` sinon.
- `isActive(offer, today)` : l'offre est publiée et n'a aucun motif d'expiration.
- **Une date de début passée ne retire pas l'offre** (§6).

**`blocked-domains.ts`**

- `hostOf(urlOrEmail)` renvoie l'hôte en minuscules, sans `www.`.
- `isBlockedHost(host, list)` détecte le domaine exact ou l'un de ses sous-domaines.
- `findBlockedTargets({ applyUrl, applyEmail, sourceUrl }, list)` liste les cibles bloquées.

**`offer-minimum.ts`**

- `checkPublicationMinimum(input, { origin, blockedDomains })` renvoie `{ ok, missing[] }`, avec des libellés français.
- Éléments vérifiés :
  - une entreprise identifiable ;
  - un contrat explicitement saisonnier : saison renseignée et confirmation cochée ;
  - un lieu précis : commune et département ;
  - une période ou une durée ;
  - un moyen de candidature utilisable, hors domaines exclus. Pour une annonce déposée, il faut un email ou un téléphone.
- Les formulaires l'utilisent pour leur liste en direct, et le serveur pour sa validation.

**`application.ts`**

- `publicCompanyName(offer)` renvoie « Entreprise confidentielle » si `hideCompanyIdentity` est vrai.
- `applicationModeExplanation(offer)` renvoie une phrase française qui explique comment candidater (§7), par exemple :
  - « Candidature directe auprès de l'employeur par email ou téléphone. Vous envoyez vous-même votre CV. »
  - « Candidature sur le site officiel de l'employeur. »
  - « Candidature auprès de {recruiterName}, chargé·e de recrutement de {site} pour le compte de {entreprise}. »

## 4. Accès aux données

Fichier `src/server/offers/queries.ts`.

- **`activeOfferConditions(today)`**
  - L'offre est active si :
    - `status = 'published'` ;
    - **et** `applicationDeadline` est nulle ou ≥ aujourd'hui ;
    - **et** `endDate` est nulle ou ≥ aujourd'hui.
  - `today` est passé en paramètre (date `YYYY-MM-DD`, calculée en Europe/Paris), ce qui rend la condition testable.
  - Toute lecture côté candidat passe par ce fragment. La recherche reste donc juste même si le cron du plan 16 n'a pas tourné.
- **`getOfferWithRelations(id)`** charge l'offre avec son entreprise, son métier, son département et sa région.

## 5. Données de démonstration

**Commande.**
`npm run db:seed:demo` exécute `src/lib/db/seed/demo.ts`. Le script refuse de tourner si `VERCEL_ENV=production`.

**Contenu.** Environ 8 entreprises **fictives** et 40 offres, dont les dates sont calculées **par rapport à aujourd'hui**. Le jeu couvre :

- l'été et l'hiver ;
- des annonces déposées et collectées ;
- des salaires nets mensuels, bruts mensuels, bruts horaires, et des offres sans salaire ;
- beaucoup de valeurs « non précisé » ;
- des offres avec une durée seule ;
- des dates limites dépassées ;
- des débuts passés avec une fin future ;
- des régions variées : Savoie, Haute-Savoie, Hautes-Alpes, Pyrénées, Var, Alpes-Maritimes, Gironde, Charente-Maritime, Corse, Finistère, La Réunion…

**Export.** Le jeu est exporté sous le nom `demoOffers`, pour servir d'oracle au plan 08.

## Tests

**Unitaires** : chaque règle de la section 3, avec ses cas limites.

- Une date limite égale à aujourd'hui laisse l'offre active.
- Une fin de contrat hier la rend inactive.
- Un début de contrat hier la laisse active.
- `fr.indeed.com` et `x@indeedemail.com` sont bloqués ; `notindeed.com` ne l'est pas.
- Une fourchette brute horaire n'est jamais affichée comme mensuelle.

**Intégration** : les contraintes `CHECK` rejettent :

- une offre sans moyen de candidature ;
- une offre anonyme sans chargé de recrutement ;
- une offre collectée sans source.

## Critères d'acceptation

- [ ] Les migrations sont appliquées en local, en test et en preview.
- [ ] Toutes les règles du §3 et du §6 sont couvertes par des tests verts.
- [ ] `npm run db:seed:demo` remplit la base de développement de façon reproductible.

## Hors périmètre

- Recherche (plan 08).
- Formulaires (plan 14).
- Collecte automatique (H10).
