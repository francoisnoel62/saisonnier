# Plan 13 — Entreprise employeur & vérification du déposant

| Dépend de | Débloque | Taille | Cahier des charges |
|---|---|---|---|
| 07 | 14, 17 | M | §2 (secteurs), §3 (entreprise identifiable), §6 (vérification avant publication), H2 |

## Objectif

Permettre à un employeur de rattacher son compte à une entreprise identifiable, et au fondateur de vérifier ce rattachement avant toute publication.

## Étapes

1. **Onboarding** sur `/employeur/entreprise`. Tant qu'aucun rattachement n'existe, `/employeur` y redirige.
   - **Recherche de l'entreprise** par nom ou par SIRET, via l'**API Recherche d'entreprises** (`https://recherche-entreprises.api.gouv.fr/search?q=…`).
     - L'API est gratuite, sans clé, limitée à environ 7 requêtes par seconde.
     - Elle est appelée côté serveur, avec un délai d'expiration.
     - Choisir un résultat pré-remplit la raison sociale, le SIREN, le SIRET, l'activité principale (code NAF et libellé) et la commune.
     - Si l'API ne répond pas, la saisie manuelle reste possible.
   - **Informations complémentaires** :
     - nom d'usage ou enseigne ;
     - site web ;
     - fonction du déposant ;
     - lien avec l'entreprise : dirigeant·e, RH / recrutement, responsable d'établissement, ou autre (à préciser) ;
     - téléphone professionnel ;
     - case « Je certifie être habilité·e à publier des offres pour cette entreprise ».
   - **SIREN déjà connu** : le compte est rattaché à l'entreprise existante, sans créer de doublon.
2. **Création et notification.**
   - Créer `companies` et `company_members`, avec `status = pending`.
   - Envoyer un email au fondateur.
   - Afficher à l'employeur la bannière « Votre rattachement est en cours de vérification. Vos annonces seront publiées après validation. »
3. **File de vérification admin** sur `/admin/verifications`, sous forme de tableau TanStack v9.
   - **Colonnes** : date, déposant, email, fonction, lien avec l'entreprise, entreprise, SIREN, activité (NAF), site.
   - **Aides à la décision** :
     - l'indicateur « domaine de l'email = domaine du site », qui n'est qu'une aide et jamais une décision automatique ;
     - le code NAF, pour juger si l'entreprise relève bien du tourisme ou de l'hôtellerie de loisirs (§2) ;
     - un lien vers `annuaire-entreprises.data.gouv.fr/entreprise/{siren}`.
   - **Actions** : **Valider** ou **Refuser** (motif obligatoire). Chaque décision envoie un email à l'employeur.
4. **Conséquences de la décision**, appliquées dans une transaction.
   - **Validation** : le rattachement passe à `verified`. Ses annonces `pending_review` passent à `published`, avec `publishedAt` et `validityConfirmedAt` à maintenant.
   - **Refus** : le rattachement passe à `rejected`, et ses annonces à `rejected`.
5. **Page `/employeur/entreprise`** une fois l'onboarding fait.
   - Elle affiche la fiche de l'entreprise et le statut du rattachement.
   - L'employeur peut modifier l'enseigne, le site et le téléphone. Changer de SIREN passe par le formulaire de contact.
6. **Règles** dans `src/domain/membership.ts` :
   - `canPublishDirectly(status)` n'est vrai que pour `verified` ;
   - `emailMatchesWebsite(email, website)`.

## Tests

**Unitaires** : `canPublishDirectly` et `emailMatchesWebsite`.

**E2E** dans `e2e/verification.spec.ts`, en passant par la saisie manuelle de l'entreprise :

1. l'employeur fait son onboarding ;
2. son statut est « en vérification » ;
3. l'admin valide ;
4. le statut devient « vérifié » et l'email s'affiche en console.

Un second test couvre le refus avec motif.

## Critères d'acceptation

- [ ] §6 : aucun déposant non vérifié ne peut publier.
- [ ] L'admin dispose des éléments nécessaires pour vérifier l'entreprise, son secteur et le lien du déposant.

## Hors périmètre

- Plusieurs entreprises par compte.
- Invitation de collègues.
- Vérification automatique (Kbis, SIRENE).
