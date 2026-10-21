# Plan 05 — Harnais de tests E2E & intégration continue

| Dépend de | Débloque | Taille | Cahier des charges |
|---|---|---|---|
| 04 | 07, 10 | S | §9 (les points de contrôle deviennent des tests) |

## Objectif

Permettre, dès le plan suivant, d'écrire des tests Playwright authentifiés par rôle sur une base de test isolée, et les faire tourner en CI.

## Étapes

1. **Installation.** `npm i -D @playwright/test`, puis `npx playwright install chromium`.
2. **`playwright.config.ts`.**
   - `baseURL` : `http://localhost:3100`.
   - Projets : `setup`, puis `chromium` (bureau) et `mobile` (Pixel 7), qui dépendent de `setup`.
   - `webServer` lance `next dev -p 3100`.
     - Son `env` est lu dans `.env.test.local`, ou dans l'environnement de la CI : base `saisonnier_test`, `BETTER_AUTH_URL=http://localhost:3100`, pas de `RESEND_API_KEY` (emails en console), `STORAGE_DRIVER=local`.
     - Les variables passées ainsi priment sur les fichiers `.env*` chargés par Next.
   - `reuseExistingServer` hors CI.
3. **`e2e/global-setup.ts`.**
   - Appliquer les migrations sur la base de test.
   - Faire un `TRUNCATE` de toutes les tables, **sauf les référentiels** (régions, départements, métiers, domaines exclus).
4. **`e2e/auth.setup.ts`** (projet `setup`), pour chacun des rôles `candidate`, `employer` et `admin` :
   - inscription via `POST /api/auth/sign-up/email` ;
   - en SQL, via `e2e/helpers/db.ts` : `email_verified = true` et rôle voulu ;
   - connexion par l'interface ;
   - sauvegarde de la session dans `e2e/.auth/<rôle>.json`, ignoré par git.
5. **Fixtures** dans `e2e/fixtures.ts`. Le `test` étendu fournit :
   - `asCandidate`, `asEmployer` et `asAdmin` : des pages déjà authentifiées ;
   - `db` : un client `pg` sur la base de test, pour préparer des données.
6. **Premier fichier de tests** `e2e/acces.spec.ts` :
   - un visiteur anonyme sur `/offres` est redirigé vers `/connexion` ;
   - un candidat n'accède ni à `/employeur` ni à `/admin` ;
   - chaque rôle voit sa propre navigation.
7. **Scripts** `e2e` et `e2e:ui`.
8. **CI** dans `.github/workflows/ci.yml`, sur chaque push vers `main` et chaque PR :
   - Node 24, puis `npm ci` ;
   - `lint`, `typecheck`, `test` et `test:int` ;
   - `e2e`, avec un service `postgres:17` ;
   - l'artefact `playwright-report` est conservé en cas d'échec.
9. **Convention pour les plans suivants.**
   - Chaque plan ajoute son fichier `e2e/<sujet>.spec.ts`.
   - Chaque test porte le nom du point de contrôle qu'il couvre, par exemple `§9 — CV privé`.

## Critères d'acceptation

- [ ] `npm run db:up && npm run e2e` passe en local.
- [ ] Le workflow de CI passe sur une PR.
- [ ] La base de test est distincte de la base de développement et réinitialisée à chaque exécution.

## Hors périmètre

- Tests de charge.
- Tests de régression visuelle.
