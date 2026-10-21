# Plan 02 — Base de données PostgreSQL & référentiels

| Dépend de | Débloque | Taille | Cahier des charges |
|---|---|---|---|
| 01 | 03 | M | §2 (territoire : régions et départements ; sources exclues) |

## Objectif

Mettre en place PostgreSQL en local (Docker) et sur Vercel (Neon), avec Drizzle ORM et des migrations versionnées, appliquées automatiquement au déploiement.
Les référentiels (régions, départements, métiers, domaines exclus) doivent exister dans **tous** les environnements.

## Étapes

1. **Postgres local.**
   - Créer `docker-compose.yml` avec un service `db` :
     - image `postgres:17` (même version majeure que le projet Neon ; vérifier si c'est 17 ou 18) ;
     - port 5432 et volume nommé ;
     - base `saisonnier`, plus un script d'initialisation qui crée `saisonnier_test`.
   - Ajouter les scripts `db:up` et `db:down`.
2. **Neon via Vercel.**
   - Dans le projet `saisonnier` : Storage → Create Database → **Neon**, région **Frankfurt (aws-eu-central-1)**.
   - Connecter la base aux environnements **Production et Preview**, pas à Development : le local reste sur Docker.
   - Activer la **création d'une branche de base pour chaque déploiement de preview**.
   - Vérifier les noms des variables injectées : `DATABASE_URL` (poolée) et `DATABASE_URL_UNPOOLED`.
3. **Région des fonctions.** Dans `vercel.json`, ajouter `"regions": ["fra1"]`, au plus près de Neon Frankfurt. La région par défaut `iad1` ajouterait environ 100 ms à chaque requête.
4. **Variables d'environnement.**
   - `src/lib/env.ts` : schéma zod des variables serveur, importé par `db`, `auth`, etc. L'application échoue au démarrage, avec un message explicite, si une variable manque.
   - `.env.development.local` : `DATABASE_URL=postgres://…@localhost:5432/saisonnier`.
   - `.env.test.local` : `DATABASE_URL=postgres://…@localhost:5432/saisonnier_test`.
   - Pour les scripts lancés hors de Next (drizzle-kit, seeds, scripts), charger l'environnement avec `loadEnvConfig` de `@next/env`, pour garder les mêmes priorités que Next.
   - Compléter `.env.example`.
5. **Drizzle.**
   - Installer `npm i drizzle-orm pg @vercel/functions`, puis `npm i -D drizzle-kit @types/pg tsx`.
   - Rester sur Drizzle **0.45 (stable)** : la 1.0 est encore en RC.
   - `src/lib/db/index.ts` :
     - un `Pool` de `pg`, enregistré avec `attachDatabasePool(pool)` pour Fluid compute ;
     - `drizzle({ client: pool, schema, casing: "snake_case" })` ;
     - un singleton sur `globalThis` en développement.
   - `drizzle.config.ts` :
     - `schema: "./src/lib/db/schema"`, `out: "./drizzle"`, `dialect: "postgresql"`, `casing: "snake_case"` ;
     - URL = `DATABASE_URL_UNPOOLED ?? DATABASE_URL`, pour que les migrations ne passent pas par le pooler.
   - Ajouter les scripts `db:generate`, `db:migrate`, `db:studio` et `db:check`.
6. **Schéma** `src/lib/db/schema/reference.ts` :
   - `regions` : `code` (text, PK), `name` ;
   - `departments` : `code` (text, PK : `"01"`…`"2A"`, `"2B"`…`"976"`), `name`, `regionCode` (FK) ;
   - `occupations` : `id` (uuid), `slug` (unique), `label`, `family`, `sortOrder`, `isActive` (booléen, vrai par défaut) ;
   - `blockedDomains` : `domain` (text, PK, en minuscules et sans `www.`), `reason`, `createdAt`.
7. **Données de référence par migration SQL personnalisée.**
   - Générer la migration avec `npx drizzle-kit generate --custom --name=referentiels`.
   - Écrire les insertions en `INSERT … ON CONFLICT DO NOTHING`. Elles existeront ainsi partout (local, test, previews, prod) sans script manuel.
   - Contenu :
     - les 18 régions et 101 départements du COG INSEE en vigueur, dont 2A, 2B et 971 à 976 ;
     - une cinquantaine de métiers, par famille (liste ci-dessous, **à faire relire par le fondateur**) ;
     - les domaines exclus initiaux (liste ci-dessous, **à compléter par le fondateur**). Ils resteront modifiables dans le back-office (plan 15).
8. **Migrations au déploiement.**
   - Dans `vercel.json` : `"buildCommand": "npm run db:migrate && npm run build"`.
   - Chaque preview migre sa propre branche Neon ; la production migre la branche principale.
9. **Tests d'intégration.**
   - Configurer deux projets Vitest (`test.projects`) :
     - `unit` pour `*.test.ts` ;
     - `integration` pour `*.int.test.ts`, lancé sur la base de test.
   - Ajouter le script `test:int`.
   - Premier test : la base contient 18 régions et 101 départements, et chaque département est rattaché à une région existante.

### Métiers proposés

Libellés « masculin / féminin », à valider.

- **Réception & hébergement** :
  - réceptionniste ;
  - veilleur / veilleuse de nuit ;
  - concierge ;
  - bagagiste / voiturier ;
  - chef / cheffe de réception.
- **Étages & entretien** :
  - valet / femme de chambre ;
  - gouvernant / gouvernante ;
  - lingère / linger ;
  - agent / agente d'entretien.
- **Salle & bar** :
  - serveur / serveuse ;
  - chef / cheffe de rang ;
  - commis de salle / runner ;
  - barman / barmaid ;
  - maître / maîtresse d'hôtel ;
  - sommelier / sommelière.
- **Cuisine** :
  - commis de cuisine ;
  - cuisinier / cuisinière ;
  - chef / cheffe de partie ;
  - second / seconde de cuisine ;
  - pâtissier / pâtissière ;
  - plongeur / plongeuse.
- **Animation & enfance** :
  - animateur / animatrice polyvalent ;
  - animateur / animatrice enfants (mini-club) ;
  - animateur / animatrice sportif ;
  - technicien / technicienne son et lumière ;
  - artiste / danseur ;
  - auxiliaire de puériculture.
- **Sport & loisirs** :
  - moniteur / monitrice de ski ou de snowboard ;
  - maître-nageur sauveteur (MNS) ;
  - surveillant / surveillante de baignade (BNSSA) ;
  - moniteur / monitrice de voile ou d'activités nautiques ;
  - guide / accompagnateur.
- **Domaine skiable** :
  - agent / agente de remontées mécaniques ;
  - pisteur / pisteuse secouriste ;
  - conducteur / conductrice d'engin de damage ;
  - vendeur / vendeuse de forfaits.
- **Commerce & location** :
  - vendeur / vendeuse ;
  - loueur / loueuse de matériel ;
  - skiman ;
  - hôte / hôtesse de caisse.
- **Bien-être** :
  - praticien / praticienne spa ;
  - esthéticien / esthéticienne.
- **Accueil touristique** :
  - conseiller / conseillère en séjour ;
  - hôte / hôtesse d'accueil (camping, village vacances).
- **Technique & transport** :
  - agent / agente de maintenance ;
  - jardinier / jardinière ;
  - chauffeur / chauffeuse de navette.
- **Encadrement** :
  - responsable de restaurant ;
  - responsable d'hébergement / chef de village ;
  - responsable animation.

### Domaines exclus initiaux

Le §2 exclut Indeed, France Travail, LinkedIn, ainsi que les autres job-boards et agrégateurs.

- **Indeed** : `indeed.com`, `indeed.fr`, `indeedemail.com`.
- **France Travail** : `francetravail.fr`, `pole-emploi.fr`.
- **LinkedIn** : `linkedin.com`, `lnkd.in`.
- **SeasonJobs** : `seasonjobs.com` (*vérifier le domaine exact*).
- **Autres job-boards** : `hellowork.com`, `regionsjob.com`, `monster.fr`, `glassdoor.fr`, `glassdoor.com`, `jobteaser.com`, `meteojob.com`, `cadremploi.fr`, `apec.fr`, `welcometothejungle.com`, `lhotellerie-restauration.fr`, `staffme.fr`, `studentjob.fr`, `keljob.com`.
- **Agrégateurs** : `jobijoba.com`, `optioncarriere.com`, `talent.com`, `jooble.org`, `adzuna.fr`.

## Critères d'acceptation

- [ ] `npm run db:up && npm run db:migrate` fonctionne en local.
- [ ] Drizzle Studio affiche 18 régions, 101 départements, les métiers et les domaines exclus.
- [ ] `npm run test:int` passe sur `saisonnier_test`.
- [ ] Une PR déclenche une preview qui migre sa branche Neon ; le merge migre la production.
- [ ] Les fonctions Vercel tournent en `fra1`, et aucun secret n'est versionné.

## Hors périmètre

- Tables métier (plans 03, 07 et suivants).
- Données de démonstration (plan 07).
