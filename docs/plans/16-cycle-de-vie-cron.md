# Plan 16 — Cycle de vie des annonces (cron quotidien)

| Dépend de | Débloque | Taille | Cahier des charges |
|---|---|---|---|
| 14 | 18 | S | §6 (actualité des annonces), §9 (échéances) |

## Objectif

Chaque nuit, deux traitements :

- retirer des résultats les annonces dont l'échéance est dépassée ;
- tous les 30 jours, demander au déposant si son annonce est toujours valable, sans la retirer automatiquement s'il ne répond pas.

## Étapes

1. **Expiration** : `expireOffers(today)`, dans `src/server/jobs/expire-offers.ts`.
   - Les annonces `published` dont `applicationDeadline < today` ou `endDate < today` passent à `expired`, et `expiredAt` est renseigné.
   - La date de début n'entre pas en compte.
   - Le traitement est idempotent et renvoie le nombre d'annonces traitées.
   - La recherche exclut déjà ces annonces en SQL (plan 07). Ce job garde des statuts exacts dans les tableaux de bord.
2. **Rappel de validité.**
   - **Règle pure** `isReminderDue(offer, now)`, dans `src/domain/validity-reminder.ts`. Elle est vraie si l'annonce est déposée, publiée, et si `max(publishedAt, validityConfirmedAt, validityReminderSentAt) ≤ now − 30 jours`.
   - **Job** `src/server/jobs/validity-reminders.ts` :
     - il envoie au déposant un email « Votre annonce {intitulé} est-elle toujours valable ? », avec un lien signé `/annonce/confirmer/<jeton>` ;
     - il enregistre ensuite `validityReminderSentAt = now`.
   - **Aucune dépublication en l'absence de réponse** (§6).
3. **Jeton signé** dans `src/lib/signed-token.ts`.
   - HMAC-SHA256 avec `VALIDITY_TOKEN_SECRET`, sur `{ offerId, exp }`, où `exp` vaut 30 jours.
   - La vérification compare les signatures en temps constant.
4. **Page publique** `/annonce/confirmer/[token]`.
   - Elle rappelle l'annonce et propose deux boutons. Ce sont des Server Actions en POST : un simple GET ne déclenche jamais d'action.
     - « Oui, toujours valable » enregistre `validityConfirmedAt = now`.
     - « Non, retirer l'annonce » passe l'annonce à `unpublished`.
   - Si le jeton est invalide ou expiré, la page l'indique et propose un lien de connexion.
5. **Espace employeur.** Une annonce dont le rappel est postérieur à la dernière confirmation affiche « Toujours valable ? », avec les mêmes deux actions (l'employeur est connecté).
6. **Route cron** `GET /api/cron/quotidien`.
   - Elle vérifie l'en-tête `Authorization: Bearer ${CRON_SECRET}`.
   - Elle exécute les deux jobs, puis renvoie et journalise un résumé JSON.
   - Dans `vercel.json` : `"crons": [{ "path": "/api/cron/quotidien", "schedule": "0 3 * * *" }]`. L'heure est en UTC.
   - L'offre Hobby limite chaque cron à une exécution par jour, à l'heure près, ce qui suffit ici.
7. **Variables.** Ajouter `CRON_SECRET` et `VALIDITY_TOKEN_SECRET` à `env.ts`, à `.env.example` et sur Vercel.

## Tests

**Unitaires** :

- `isReminderDue` :
  - 29 jours → non ;
  - 30 jours → oui ;
  - confirmation récente → non ;
  - annonce collectée → jamais.
- Jeton : signature valide, expiration, altération.

**Intégration** (`expireOffers` sur la base de test) :

- une date limite hier → l'annonce expire ;
- un début hier avec une fin future → l'annonce reste publiée ;
- une seconde exécution n'a aucun effet.

**E2E** : le lien signé, puis « toujours valable », met à jour la date affichée côté employeur.

## Critères d'acceptation

- [x] §6 / §9 : les échéances dépassées sont retirées des résultats actifs ; une date de début dépassée ne suffit pas.
- [x] Le rappel part tous les 30 jours, sans retrait automatique.
- [x] La route cron refuse tout appel sans le secret.

## Hors périmètre

- Collecte nocturne des sources. Elle se branchera plus tard sur `upsertCollectedOffer` (plan 15).
- Notifications par SMS ou push.
