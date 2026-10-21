# Plan 18 — Recette de conformité, RGPD & mise en production

| Dépend de | Débloque | Taille | Cahier des charges |
|---|---|---|---|
| 12, 15, 16, 17 | — | M | §9 (points de contrôle), §8 (rien de la V2) |

## Objectif

Prouver la conformité au cahier des charges, compléter les obligations RGPD et ouvrir la V1 en production.

## Étapes

1. **Suppression de compte**, sur `/compte`, pour tous les rôles.
   - S'appuyer sur `user.deleteUser` de Better Auth, avec confirmation par mot de passe et un hook exécuté avant la suppression.
   - **Candidat** : supprimer ses documents Blob, son dossier et son suivi.
   - **Employeur** :
     - ses annonces passent hors ligne ;
     - `createdByUserId` est mis à null ;
     - l'entreprise et l'historique restent, pour le fondateur.
   - Mettre à jour `/confidentialite` en conséquence.
2. **Matrice de recette** dans `docs/recette-v1.md`.
   - Chaque point du §9, et chaque règle des §3 à §6, y est relié :
     - aux tests automatisés qui le couvrent (fichier et nom du test) ;
     - à une vérification manuelle ;
     - au résultat obtenu.
   - Écrire les tests manquants.
3. **Revue de périmètre** (§8, et dernier point du §9). Vérifier qu'aucune de ces fonctionnalités n'a été introduite :
   - alertes ou recherches enregistrées ;
   - CVthèque ;
   - pipeline de candidature ou relance automatique ;
   - coaching ;
   - revendication d'annonce ;
   - paiement.
4. **Sécurité.**
   - Chaque Server Action et chaque route vérifie la session, le rôle et la propriété de la ressource. La liste exhaustive figure dans la recette.
   - Ajouter des en-têtes de sécurité dans `next.config.ts`.
   - Lancer `npm audit`.
   - Lancer la revue `/security-review` de Claude Code et traiter ses points.
5. **Production.**
   - **Offre Vercel** : l'offre Hobby est réservée à un usage non commercial. Passer l'équipe en **Pro** avant l'ouverture commerciale (prestations payantes).
   - **Domaine**, dès que le nom est choisi (H14) :
     - ajouter le domaine sur Vercel ;
     - vérifier le domaine d'envoi chez Resend (SPF et DKIM), puis mettre à jour `EMAIL_FROM` ;
     - mettre à jour `BETTER_AUTH_URL` ;
     - renommer le service dans `src/config/site.ts`.
   - **Configuration** :
     - toutes les variables de Production sont renseignées (`env.ts` fait foi) ;
     - le store Blob privé et Neon sont connectés à la Production ;
     - le cron est visible dans le dashboard Vercel.
   - **Neon** : vérifier la fenêtre de restauration (PITR).
   - **Mesure** : activer Vercel Web Analytics et Speed Insights, qui n'utilisent pas de cookies.
   - **Compte admin du fondateur** :
     - s'inscrire sur le site ;
     - lancer `npm run admin:grant` avec l'environnement de production ;
     - écrire la procédure dans `docs/exploitation.md`.
6. **Recette en production.**
   - **Côté candidat** : inscription avec une vraie adresse, recherche, dossier, candidature.
   - **Côté employeur** : inscription, vérification, dépôt.
   - **Côté admin** : saisie d'une annonce collectée ; message de contact ; déclenchement manuel d'un rappel de validité.
7. **Clôture.**
   - Finaliser les pages légales avec les informations du fondateur ; le bandeau « brouillon » disparaît.
   - Poser le tag `v1.0.0`.

## Critères d'acceptation

- [ ] `docs/recette-v1.md` : tous les points du §9 sont au vert, preuves à l'appui.
- [ ] La suppression de compte efface les données en base et les fichiers.
- [ ] La production est servie sur le domaine définitif, les emails sont délivrés et le cron est actif.

## Hors périmètre

- Critères de product-market fit, pilotés par le fondateur.
- Acquisition : réseau, communautés, Instagram.
- V2.
