# Recette de la V1 du scan — plan scan 10

> **État : V1 du scan livrée le 29 octobre 2026** (tag `scan-v1.0.0`). Remplissage initial mené en production le 28 octobre 2026 (déploiement `51ce5b1`, `https://saisonnier.vercel.app`), avec le compte admin du fondateur ; les actions dans l'application ont été faites par Claude dans le navigateur du fondateur, chacune annoncée avant d'être faite. Premier passage quotidien contrôlé le 29 octobre 2026 (voir ci-dessous).

## Décisions du fondateur (28/10/2026)

| Sujet | Décision |
|---|---|
| Répétition générale en preview (plan 10, étape 1) | **non** : lancement directement en production ; la lecture supplémentaire de France Travail depuis une preview n'est pas couverte par les décisions 2 et 3 de la [recette des sources](recette-sources.md) |
| Sources du remplissage initial | France Travail seule ; réserves (MS Vacances, puis Club Med) seulement si la cible ou la marge de 20 % manque |
| Actions dans l'application | faites par Claude dans le navigateur du fondateur |
| « Scan quotidien des offres » | activé le 28/10/2026 vers 12 h 45, après la fin du remplissage initial |
| « Tâche quotidienne » (expiration, rappels de validité) | trouvée désactivée en production ; laissée désactivée |
| Doublons potentiels (29/10/2026) | un doublon signalé en revue suffit au critère « aucun doublon connu » : les 10 rapprochements du remplissage initial se tranchent pendant la revue |
| Temps de revue (29/10/2026) | estimation du fondateur : 2 à 3 min par dossier, recherche de l'URL officielle de l'employeur comprise ; non chronométré |
| Plan suivant (29/10/2026) | annoncé à la clôture (plan scan V2-02), rédigé dans une session dédiée |

## Configuration de la production

- Variables : `CRON_SECRET` présent ; `SCAN_TEST_SOURCE_URL` absente ; aucune variable Workflow ; variables système exposées (`autoExposeSystemEnvs`), Fluid, 300 s par fonction, région `fra1`.
- Crons enregistrés par Vercel : `/api/cron/quotidien` (`0 3 * * *`), `/api/cron/scan` (`0 1 * * *` et `0 2 * * *`).
- Sources : France Travail prête et activée (remplissage initial et passages quotidiens, justification d'accès programmé consignée), jamais de publication automatique (découverte) ; toutes les autres désactivées. Aucune fiche entreprise nécessaire (découverte).
- Diagnostic « Tester l'orchestration » : run `wrun_41M614FW5F50XNY0T29TH2YFBH` terminé en 10 s.

## Remplissage initial

Passage `d7cc396f-5f34-4138-b632-8a4973dc0730`, workflow `wrun_41M614GZQ150VNCQYR0YNZ84P7`.

| Mesure | Valeur |
|---|---|
| T0 | 28/10/2026 12:32:31 (Paris) |
| Échéance | 28/10/2026 18:32 |
| Premier dossier livré | 12:33:03 (T+32 s) |
| Seuil de 50 atteint (`targetReachedAt`) | 12:34:43 (T+2 min 12 s) |
| Seuil confirmé (sans les rejets d'admission) | 12:34:43 (T+2 min 12 s), aucun rejet à la fin du passage |
| Fin du passage | 12:37:22 (T+4 min 51 s), statut « Terminé » |
| Cumul livré à T+15 min, T+1 h, T+2 h, T+3 h | 128 (passage déjà terminé) |
| Livrés avant T+6 h | 128 / 50 |
| France Travail | 128 offres listées (7 pages), 128 lues, 128 livrées, 0 écartée, 0 échec, 135 requêtes, 1,9 Mo |
| Publications | humaines 0, automatiques 0 |
| Revue ouverte | 128 dossiers à vérifier, 10 doublons potentiels, 97 suggestions de métiers |
| Workflow | 12 étapes : `claimRunStep`, 7 `listPageStep` (2,7 à 3,9 s), 3 `processBatchStep` (1 min 22 à 1 min 30), `finishRunStep` ; 3 Ko de données |
| Email de bilan (SH16) | reçu à 12:37 par le fondateur, une seule fois |

État de la revue le 29/10/2026 vers 10 h : 3 dossiers publiés par l'admin, 1 rejeté (« Offre close »), 124 à vérifier ; 10 doublons potentiels et 95 suggestions de métiers ouverts.

## Premier passage quotidien (29/10/2026)

Passage `ed05b237-8962-4666-96dd-de28cdc68bca`, workflow `wrun_41M62QKV4150GNQQQEJZFV4SWA`, déclenché par « Tâche planifiée ». Relevé le 29/10 depuis `/admin`, `/admin/scan/passages` et le bilan du passage, et dans la boîte du fondateur.

| Contrôle (plan 10, étape 6) | Constat |
|---|---|
| Démarrage entre 3 h et 3 h 59 à Paris | 03:25 (cron `0 2 * * *` UTC, 3 h à Paris depuis le passage à l'heure d'hiver du 25/10 ; Vercel Hobby le déclenche dans l'heure) ; fin à 03:26, statut « Terminé » |
| Fenêtre de 72 h | posée à la création du passage (`createDailyRun` : `windowStart` = T0 − 72 h, `scanLimits.dailyWindowMs`) ; le bilan ne l'affiche pas ; aucune exclusion « Hors fenêtre » |
| Aucun nouvel amorçage | l'historique compte deux passages : le remplissage initial du 28/10 et ce quotidien ; aucun passage créé par le cron de 1 h UTC (2 h à Paris) |
| France Travail | 125 offres listées, 8 lues, 8 livrées, 0 écartée, 0 échec, 15 requêtes, 1 Mo |
| Dossiers | 8 livrés pour vérification, le premier à 03:25 ; 0 doublon potentiel ; aucune exclusion ni rejet ; publications humaines 0, automatiques 0 (découverte) |
| Résumé dans la carte des tâches | « Dernier passage : 29/10/2026 03:25 — Passage démarré. » |
| Email de bilan | « Scan quotidien du 29 octobre 2026 — bilan » reçu à 03:26 par le fondateur, une seule fois (8 dossiers livrés) |

Stock à vérifier après ce passage : 132 dossiers.

## Consommation

- Fournisseurs : 0 € ; aucune clé d'API payante configurée.
- Vercel (offre Hobby) : de l'ordre de 40 événements Workflow pour ce passage (trois au moins par étape) et 3 Ko écrits. Un passage quotidien de même taille représente environ 1 200 événements par mois, pour 50 000 inclus ; la marge permet le plafond de 20 sources (SH30). Relevé du tableau d'usage le 28/10 (période du 28/09 au 28/10, toute l'équipe) : 32 000 invocations de fonctions, 38 min 45 s de CPU Fluid, 66 invocations de crons.

## Critères (plan 10, étape 5)

- [x] `targetReachedAt < startedAt + 6 h` : T+2 min 12 s.
- [x] Seuil confirmé avant T+6 h : T+2 min 12 s ; la marge (128 livrés pour 50) absorbe jusqu'à 78 rejets pour motif d'admission.
- [x] Aucun doublon connu parmi les dossiers livrés : les 10 doublons potentiels du remplissage initial sont signalés en revue, aucun n'est publié ; ils se tranchent pendant la revue (décision du fondateur du 29/10/2026). Le premier passage quotidien n'en signale aucun.
- [x] Livraison indépendante de la présence de l'admin : le passage s'exécute en arrière-plan (Vercel Workflow) ; la fermeture de l'écran est démontrée par l'E2E « Scan §6 — recette de livraison progressive ». En production, l'écran de l'admin est resté ouvert pendant les cinq minutes du remplissage initial ; le premier passage quotidien (3 h 25) a été déclenché par le cron, sans action de l'admin.

Minutes de revue par dossier : 2 à 3 min, recherche de l'URL officielle de l'employeur comprise, selon l'estimation du fondateur du 29/10/2026 ; mesure distincte du délai de collecte, non chronométrée.

## Constats

- Le volume dépasse l'estimation du réservoir (94) : la recherche France Travail a donné 128 offres en trois jours, toutes admises en revue. Aucune réserve n'a été nécessaire.
- 97 suggestions de métiers pour 128 dossiers : les intitulés de France Travail sont rarement des libellés du référentiel ; la revue des suggestions est le principal travail.
- Chaque dossier France Travail exige l'URL officielle de l'employeur pour être publié (découverte, SH17).
- Après la fusion de la PR #53 (design « ma saison »), la CI de `main` a échoué sur `e2e/scan-presentation.spec.ts` (labels affichés deux fois par la nouvelle fiche) : corrigé par la PR #54.
- Le premier passage quotidien n'a lu que 8 des 125 offres listées, les autres étant déjà connues : il a duré une minute.
- La carte des tâches résume le déclenchement (« Passage démarré »), pas le résultat ; le bilan du passage et l'email donnent les dossiers livrés.

## Clôture (29/10/2026)

Plans scan 01 à 10 terminés ; V1 du scan notée livrée dans le [plan technique](../plan-technique-scan-v1-v5.md) ; tag `scan-v1.0.0`.

Écarts reportés au plan suivant (plan scan V2-02, à rédiger) :

1. Temps de revue : chronométrer la revue d'un échantillon de dossiers, au lieu de l'estimation actuelle.
2. Suggestions de métiers : 95 ouvertes pour 136 dossiers ; c'est la principale charge de la revue.
3. URL officielle de l'employeur : à rechercher à la main pour chaque dossier France Travail (SH17).
4. Écarts du lot G du plan V2-01 ([recette des sources](recette-sources.md)) : détection d'un plan de site, JobAnim dans les plateformes connues, demande de flux ou de partenariat des job-boards, extraction Club Med.
