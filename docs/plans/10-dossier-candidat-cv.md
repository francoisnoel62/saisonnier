# Plan 10 — Dossier candidat & CV privé

| Dépend de | Débloque | Taille | Cahier des charges |
|---|---|---|---|
| 05 | 11 | M | §5 (compte et dossier), §7 (CV non exploités pour le sourcing), §9 |

## Objectif

Construire la page « Mon dossier » : coordonnées, CV, lettre et message facultatifs.
Les documents sont stockés de façon **privée**, et une règle de complétude est réutilisée par le parcours de candidature.

## Étapes

1. **Stockage privé Vercel Blob.**
   - Créer le store et le connecter au projet dans tous les environnements : `vercel blob create-store saisonnier-documents --access private --yes`.
   - Récupérer les variables pour le développement : `vercel env pull .env.local`.
   - Installer `npm i @vercel/blob`. La version 2.3 au moins est requise pour le stockage privé.
2. **Table `candidate_profiles`.**

   | Colonne | Contenu |
   |---|---|
   | `userId` | text, PK → `user.id`, suppression en cascade |
   | `phone`, `city` | coordonnées |
   | `cvPathname`, `cvFilename`, `cvSize`, `cvUploadedAt` | CV |
   | `coverLetterPathname`, `coverLetterFilename`, `coverLetterUploadedAt` | lettre de motivation |
   | `applicationMessage` | 2 000 caractères maximum |
   | `updatedAt` | |

   Le nom vient de `user.name`, et l'email du compte.
3. **Adaptateur** `src/server/storage/documents.ts`.
   - `putPrivateDocument(userId, kind, file)` appelle `put(…, { access: "private", addRandomSuffix: true })`, sous le chemin `candidates/<userId>/<kind>.pdf`.
   - `getPrivateDocument(pathname)` appelle `get(pathname, { access: "private" })`.
   - `deletePrivateDocument(pathname)` appelle `del`.
   - Une implémentation `local`, sélectionnée par `STORAGE_DRIVER=local`, écrit sur disque dans un dossier ignoré par git. Elle sert aux tests E2E.
4. **Envoi** : `POST /api/dossier/documents?type=cv|lettre`.
   - Appeler `requireRole("candidate")`.
   - Accepter uniquement les PDF : vérifier le type MIME **et** la signature `%PDF-`.
   - Limiter à 4 Mo, en dessous de la limite de 4,5 Mo du corps des fonctions Vercel.
   - Un remplacement supprime l'ancien fichier.
   - Mettre à jour la table.
5. **Téléchargement** : `GET /api/dossier/documents/[type]`.
   - La route ne sert que le document **de l'utilisateur connecté** ; le chemin est lu en base, jamais dans l'URL.
   - En-têtes :
     - `Content-Type: application/pdf` ;
     - `Content-Disposition: attachment` ;
     - `Cache-Control: private, no-store` ;
     - `X-Content-Type-Options: nosniff`.
   - **Aucun accès pour l'admin ni pour un employeur** (H11).
6. **Page `/dossier`.**
   - Sections :
     - **Coordonnées** : nom, email en lecture seule, téléphone, ville.
     - **CV** : obligatoire avant la première candidature.
     - **Lettre de motivation** : facultative.
     - **Message d'accompagnement** : facultatif, avec un compteur de caractères. Il servira à pré-remplir les emails de candidature.
   - Actions sur chaque document : Remplacer, Télécharger, Supprimer.
   - Mention visible : « Votre CV reste privé : aucun employeur ne peut le consulter et nous ne l'envoyons jamais à votre place. »
7. **Complétude.** `dossierStatus({ name, phone, cvPathname })`, dans `src/domain/candidate-dossier.ts`, renvoie `{ complete, missing }`. `missing` peut contenir `name`, `phone` et `cv` (H3).
8. **Bannière** sur `/offres` quand le dossier est incomplet : « Complétez votre dossier pour pouvoir candidater ». Elle n'empêche **pas** de rechercher.

## Tests

**Unitaires** : `dossierStatus`.

**E2E** dans `e2e/dossier.spec.ts` :

- un nouveau candidat peut rechercher sans CV ;
- un fichier qui n'est pas un PDF est refusé ;
- un candidat envoie son CV, puis le télécharge ;
- un autre candidat qui appelle la même route reçoit **son propre** document, ou une 404, jamais celui d'un autre ;
- un employeur et l'admin reçoivent un refus.

## Critères d'acceptation

- [ ] §9 : un inscrit peut rechercher sans CV.
- [ ] §9 : les CV restent privés ; l'URL de stockage n'est pas publique et le téléchargement est réservé au propriétaire.
- [ ] Aucune CVthèque ni aucun envoi de document n'existe.

## Hors périmètre

- Suppression du compte (plan 18).
- Plusieurs CV, éditeur de CV, analyse automatique des CV.
