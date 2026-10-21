# Plan 06 — Pages publiques, contact du fondateur & pages légales

| Dépend de | Débloque | Taille | Cahier des charges |
|---|---|---|---|
| 04 | 11, 17 | M | §1 (positionnement), §5 (compte obligatoire), §6 (contacter le fondateur), §7 (engagements) |

## Objectif

Construire trois choses :

- une vitrine publique qui présente le service **sans jamais montrer d'offre** ;
- un formulaire « Contacter le fondateur », avec sa boîte de réception dans l'admin, réutilisé plus tard pour les annonces collectées et les employeurs ;
- des pages légales en brouillon.

## Étapes

1. **Layout public** `src/app/(public)/layout.tsx`.
   - En-tête : nom provisoire, « Se connecter », « Créer un compte », « Employeurs : publier une offre ».
   - Pied de page : mentions légales, CGU, confidentialité, contact.
   - Y rattacher au besoin les pages d'authentification du plan 03.
2. **Accueil `/`**, qui remplace l'accueil provisoire.
   - **Promesse (§1)** : des emplois **explicitement saisonniers** dans le tourisme et l'hôtellerie de loisirs, l'été et l'hiver, partout en France.
   - **Deux différenciateurs** :
     - des annonces **en direct des employeurs**, avec candidature sans détour par un autre job-board ;
     - des **filtres combinables** : logement, repas, dates, salaire net ou brut, couples, animaux…
   - **« Comment ça marche » côté candidat** : compte gratuit, recherche, puis candidature directe ; le candidat envoie lui-même son dossier.
   - **Bloc employeurs** : dépôt gratuit avec contact direct, vérification du déposant avant publication, prestations sur demande sans garantie d'embauche.
   - **À proscrire** :
     - des chiffres ou des témoignages inventés ;
     - une promesse d'exclusivité des annonces (§2) ;
     - toute mention d'une fonctionnalité hors V1 (alertes, CVthèque…).
   - Pour un utilisateur connecté, un bouton « Accéder à mon espace » mène à `homePathFor(role)`.
   - **Référencement** :
     - métadonnées SEO et Open Graph ;
     - `robots.ts`, qui autorise les pages publiques et interdit l'application ;
     - `sitemap.ts`.
3. **Table `contact_messages`**, dans `src/lib/db/schema/requests.ts`.

   | Colonne | Contenu |
   |---|---|
   | `id` | uuid |
   | `topic` | enum `contact_topic` : `collected_offer`, `employer`, `candidate`, `other` |
   | `offerId` | uuid, nullable ; la clé étrangère vers `offers` est ajoutée au plan 07 |
   | `name`, `email`, `companyName`, `phone` | coordonnées de l'expéditeur |
   | `message` | 3 000 caractères maximum |
   | `userId` | text, nullable |
   | `status` | enum : `new`, `handled` |
   | `adminNote`, `createdAt`, `handledAt` | suivi |

4. **Page `/contact`** (publique).
   - Le formulaire est pré-rempli si l'utilisateur est connecté.
   - `?motif=annonce-collectee&offre=<id>` présélectionne le sujet et rattache l'offre.
   - La Server Action :
     - valide avec zod ;
     - utilise un champ piège anti-robot ;
     - limite à 3 messages par email et par heure (compte en base) ;
     - enregistre le message ;
     - envoie un email à `ADMIN_NOTIFICATION_EMAIL` ;
     - confirme l'envoi (toast et écran de succès).
   - Ajouter « Contact » à la navigation secondaire du shell.
5. **Boîte admin** `/admin/demandes`, onglet « Messages ».
   - Un tableau TanStack v9 : date, sujet, nom, email, offre liée, statut.
   - Un filtre par statut.
   - Le détail s'ouvre dans un `Drawer`, comme dans `data-table.tsx`.
   - L'action « Marquer comme traité » accepte une note.
   - L'onglet « Prestations » arrive au plan 17.
6. **Pages légales en brouillon**, chacune avec un bandeau « Brouillon à valider ».
   - **`/mentions-legales`** :
     - éditeur et directeur de publication, à compléter ;
     - hébergeur : Vercel Inc., coordonnées à vérifier sur vercel.com/legal.
   - **`/cgu`** :
     - accès gratuit pour les candidats et dépôt gratuit pour les employeurs ;
     - vérification des déposants ;
     - annonces collectées modifiables uniquement via le fondateur ;
     - aucune transmission automatique de documents ;
     - prestations sans garantie d'embauche.
   - **`/confidentialite`** :
     - données traitées, dont le CV, qui reste privé ;
     - finalités et bases légales ;
     - durées de conservation, à fixer ;
     - sous-traitants : Vercel, Neon, Resend ;
     - droits RGPD et contact ;
     - cookies strictement nécessaires uniquement, donc pas de bandeau.
7. **E2E** dans `e2e/public.spec.ts` :
   - l'accueil ne contient aucune offre ni aucun lien vers une fiche ;
   - un message envoyé par un visiteur anonyme est visible et traitable par l'admin.

## Critères d'acceptation

- [x] Un visiteur non connecté voit l'accueil, les pages légales et le contact, mais jamais une offre.
- [x] Un message de contact est enregistré, notifié au fondateur (en console en local) et traitable dans `/admin/demandes`.
- [x] Les pages légales existent, sont signalées comme brouillons et ne décrivent que la V1.

## Hors périmètre

- Pages de référencement par métier ou par région ; blog et guides (hors V1).
- Bandeau cookies : inutile sans traceur.
