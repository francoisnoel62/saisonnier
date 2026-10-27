# Plan 03 — Authentification & rôles

| Dépend de | Débloque | Taille | Cahier des charges |
|---|---|---|---|
| 02 | 04 | M | §5 (compte obligatoire), §6 (déposants), H1 |

## Objectif

Mettre en place des comptes email + mot de passe, avec vérification d'email obligatoire et trois rôles : `candidate`, `employer` et `admin`.
Les pages d'authentification sont en français, et l'accès est contrôlé côté serveur.

## Étapes

1. **Dépendances et variables.**
   - Installer `npm i better-auth resend`.
   - Variables :
     - `BETTER_AUTH_SECRET` (générée avec `openssl rand -base64 32`) ;
     - `BETTER_AUTH_URL` ;
     - `RESEND_API_KEY`, absente en local ;
     - `EMAIL_FROM` ;
     - `ADMIN_NOTIFICATION_EMAIL` : la boîte du fondateur.
   - Les ajouter à `env.ts`, à `.env.example` et sur Vercel (Production, Preview, Development).
2. **Emails.**
   - `src/lib/email/send.ts` expose `sendEmail({ to, subject, text, html })` :
     - si `RESEND_API_KEY` est définie, l'email part via Resend ;
     - sinon, il s'affiche dans la console, liens compris.
   - `src/lib/email/templates.ts` contient les gabarits français, en texte et en HTML simple : vérification d'email, réinitialisation du mot de passe.
   - Tant qu'aucun domaine n'est vérifié chez Resend, l'expéditeur `onboarding@resend.dev` n'envoie qu'à l'adresse du compte Resend. Cela suffit pour les previews.
3. **`src/lib/auth.ts`** :
   - `drizzleAdapter(db, { provider: "pg", schema })`, importé de `better-auth/adapters/drizzle` ;
   - `emailAndPassword: { enabled: true, requireEmailVerification: true, sendResetPassword }` ;
   - `emailVerification: { sendOnSignUp: true, autoSignInAfterVerification: true, sendVerificationEmail }` ;
   - `user.additionalFields.role` : `type: "string"`, `defaultValue: "candidate"`, **`input: false`**, donc jamais fourni par le client ;
   - `baseURL` et `trustedOrigins` compatibles avec les URL de preview (`VERCEL_URL`, `VERCEL_BRANCH_URL`) ;
   - `plugins: [nextCookies()]`, ce plugin restant toujours le dernier.
4. **Schéma.**
   - Générer le schéma : `npx auth@latest generate --output src/lib/db/schema/auth.ts`. La CLI de Better Auth est le paquet `auth`.
   - Appliquer : `npm run db:generate && npm run db:migrate`.
   - Vérifier la colonne `role`, avec `candidate` par défaut.
   - Les identifiants de Better Auth sont de type `text` : les futures clés étrangères vers `user.id` seront aussi en `text`.
5. **Route et client.**
   - La route `src/app/api/auth/[...all]/route.ts` exporte `toNextJsHandler(auth)`.
   - Le client `src/lib/auth-client.ts` utilise `createAuthClient` avec `inferAdditionalFields<typeof auth>()`.
6. **Couche d'accès (DAL) `src/lib/dal.ts`** :
   - `getSession()`, mémoïsée par requête avec `cache` ;
   - `requireUser()` : sans session, `redirect("/connexion?next=…")` ;
   - `requireRole(...roles)` : si le rôle ne correspond pas, redirection vers l'accueil du rôle ;
   - `homePathFor(role)` : `candidate` → `/offres`, `employer` → `/employeur`, `admin` → `/admin`.
   - `src/domain/roles.ts` définit le type `Role` et la garde `isRole`.
7. **Inscription par Server Actions** dans `src/server/auth/actions.ts` :
   - `signUpCandidate` et `signUpEmployer` valident le formulaire avec zod, puis appellent `auth.api.signUpEmail(…)` ;
   - pour un employeur, le rôle passe à `employer` côté serveur ;
   - le rôle n'est **jamais** lu depuis le formulaire.
8. **Pages** dans `src/app/(auth)/`, avec une mise en page centrée. S'inspirer des blocs shadcn `login-03` et `signup-03` (`npx shadcn@latest view login-03`).
   - `/inscription` : choix entre « Je cherche un job saisonnier » et « Je recrute ».
   - `/inscription/candidat` et `/inscription/employeur` : nom, email, mot de passe d'au moins 10 caractères, case d'acceptation des CGU (la page CGU est créée au plan 06).
   - `/verification-email` : consigne et bouton de renvoi du lien.
   - `/connexion` : accepte `?next=` ; message clair si l'email n'est pas vérifié.
   - `/mot-de-passe-oublie` et `/reinitialiser-mot-de-passe`.
   - `/apres-connexion` : page serveur qui redirige vers `homePathFor(role)`. Elle sert de `callbackURL` après la vérification d'email et de cible après connexion.
9. **`src/proxy.ts`.**
   - Routes concernées : `/offres`, `/mes-offres`, `/dossier`, `/compte`, `/employeur`, `/admin` et `/dashboard`.
   - Sans cookie de session (`getSessionCookie` de `better-auth/cookies`), le proxy redirige vers `/connexion?next=…`.
   - Ce contrôle n'est qu'optimiste : l'autorisation réelle reste dans la DAL.
10. **Accueils provisoires protégés** : `/offres` (candidat, admin), `/employeur` (employeur) et `/admin` (admin). Ils seront remplacés par les plans suivants.
11. **Administrateur.**
    - Le script `npm run admin:grant -- <email>` (`scripts/grant-admin.ts`) passe en `admin` un compte **existant et vérifié**.
    - Aucun email d'admin codé en dur.

## Tests

**Unitaires** : `isRole` et `homePathFor`.

**Vérification manuelle** (l'E2E arrive au plan 05) :

- un candidat s'inscrit, ouvre le lien affiché en console, puis arrive sur `/offres` ;
- un employeur arrive sur `/employeur` ;
- un candidat qui ouvre `/admin` est redirigé ;
- un `POST /api/auth/sign-up/email` contenant `role: "admin"` crée un compte `candidate`.

## Critères d'acceptation

- [ ] Inscription candidat et employeur, vérification d'email obligatoire avant connexion, déconnexion et mot de passe oublié fonctionnent.
- [ ] Le client ne peut ni choisir ni modifier son rôle.
- [ ] Les espaces employeur et admin sont refusés aux autres rôles, et la vérification se fait côté serveur.
- [ ] Les emails s'affichent en console en local et partent via Resend sur les previews.

## Hors périmètre

- Connexion Google et 2FA.
- Suppression de compte (plan 18).
- Intégration dans le shell (plan 04).
