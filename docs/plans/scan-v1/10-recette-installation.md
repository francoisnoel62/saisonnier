# Plan scan 10 — Recette et installation en production

| Dépend de | Débloque | Taille | Références |
|---|---|---|---|
| 01 à 09 ; [V2-01](../scan-v2/01-gestion-des-sources.md) (lots A à G) | suite de la V2 du scan | M (plusieurs jours de calendrier) | plan technique §1, §4 (six premières heures, comptage), §6 (lot 8), §11 ; cahier §3, §9, §10 ; V2-01 §14.3 ; [recette des sources](../../scan/recette-sources.md) |

Rédigé le 23/10/2026. **Actualisé le 28/10/2026** après le plan scan V2-01 : les sources se qualifient et s'activent depuis `/admin/scan/sources`, et la recette des sources du 28/10 a fixé l'état de départ ci-dessous.

## Objectif

Valider la V1 en preview, l'installer en production, lancer le premier remplissage et démontrer **au moins 50 dossiers distincts et exploitables livrés avant T+6 h**, sans frais de fournisseur ; puis activer le scan quotidien.

Le délai mesuré est celui de la mise à disposition dans la file. Ni la vérification humaine ni la publication ne sont requises dans ces six heures ; elles sont mesurées à part.

## État de départ en production (28/10/2026)

| Source | État | Rôle pour la recette |
|---|---|---|
| France Travail (`france-travail@3`, découverte) | prête, activée, « Passages quotidiens » activés | source principale ; jamais de publication automatique ; chaque dossier se valide en revue, avec l'URL officielle de l'employeur |
| MS Vacances (`teamtailor@2`) | prête, désactivée ; reprise acceptée | réserve ; fiche entreprise à créer avant ses premiers dossiers |
| Club Med (`career-page@1`) | prête, désactivée ; reprise acceptée | réserve ; lieu, période et candidature rarement établis : revue plus longue |
| Belambra, VVF | brouillons ; autorisation écrite à demander | non disponibles tant que la décision de reprise n'est pas favorable |
| SeasonJobs, JobAnim | brouillons (découvertes) | en attente d'un flux ou d'un partenariat |
| Indeed, LinkedIn, Accor, Pierre & Vacances – Center Parcs, Sandaya | écartées | — |

Réservoir estimé de France Travail : `floor(118 × 8/10) = 94` dossiers potentiels (inventaire du 24/10, avant déduplication), ce qui n'est pas un stock confirmé. Le seuil de 50 avec 20 % de marge suppose au moins 60 dossiers livrés avant T+6 h.

## Étapes

1. **Répétition générale en preview.** Branche de recette `plan/scan-10-recette` ; sa base Neon de preview est copiée de la production au premier déploiement, sources et décisions comprises. Sources réelles.
   - Avant la première lecture réelle depuis la preview, l'accord du fondateur : la répétition relit France Travail en entier (de l'ordre de 120 fiches, une requête toutes les 2 s), en plus du remplissage de production.
   - Qualifier depuis la preview chaque source retenue (échantillon réussi de la version courante, décision de reprise) puis l'activer, « Publication automatique » désactivée. France Travail l'est déjà.
   - Lancer le premier remplissage et relever : T0 ; délai du premier dossier ; cumul livré à T+15 min, T+1 h, T+2 h, T+3 h ; `targetReachedAt` ; durée totale ; requêtes et octets par source ; étapes et événements Workflow ; incidents ; sources suspendues.
   - Revoir un échantillon de 20 dossiers : pertinence pour le périmètre, exclusions respectées (aucun dossier vide, clos, hors périmètre ou en double), qualité du préremplissage, minutes de revue par dossier, chronométrées (recherche de l'URL officielle de l'employeur comprise pour France Travail).
   - **Décision** : si la répétition n'atteint pas 50 avant T+6 h, ou seulement de justesse (moins de 20 % de marge sur le délai ou sur le volume), activer une réserve (MS Vacances, puis Club Med), après « Créer la fiche entreprise » depuis sa fiche, ou corriger les extracteurs, puis recommencer. Ne pas déclarer la V1 prête (plan technique §4).
   - Relever la consommation Vercel (onglet Usage : Workflow Events, Workflow Data Written, fonctions) et la rapporter au mois, à comparer au plafond de 20 sources activées (SH30).
   - Après le merge, supprimer la branche Neon de la preview (10 branches au plus).
2. **Configuration de la production.**
   - Variables : rien de nouveau. `CRON_SECRET` existe ; `SCAN_TEST_SOURCE_URL` est absente, et `env.ts` la refuserait.
   - Vercel : variables système exposées (Workflow) ; deux crons `/api/cron/scan` visibles dans « Cron Jobs », à côté de `/api/cron/quotidien` ; section Workflows visible dans l'observabilité.
   - Fiches entreprise des sources employeur activées, créées depuis leur fiche (« Créer la fiche entreprise », SH15). France Travail, découverte, n'en a pas : l'entreprise se choisit en revue.
   - Qualification de production (SH23) : un échantillon réussi depuis la production pour chaque source activée.
   - Sources retenues activées, publication automatique désactivée ; tâche « Scan quotidien des offres » **désactivée** jusqu'à la fin du remplissage initial.
   - Diagnostic « Tester l'orchestration » réussi (plan 09).
3. **Lancement (T0).** L'admin clique sur « Lancer le premier remplissage » et note l'heure. Il peut commencer la revue dès le premier dossier ou fermer l'écran : la collecte continue.
4. **Suivi des six heures**, selon le découpage du plan technique (§4) :

   | Échéance | À vérifier |
   |---|---|
   | T0 | passage créé, échéance T+6 h affichée, run visible dans l'observabilité |
   | Premier dossier | apparition dans la file au rafraîchissement suivant, sans attendre un lot |
   | T0 à T+1 h | sources principales en cours ; cumul qui progresse ; aucune source bloquée |
   | T+1 à T+3 h | sources de réserve si besoin ; « reste à livrer pour atteindre 50 » cohérent |
   | T+3 à T+5 h | reprises d'échecs temporaires ; signalement si la cible n'est plus atteignable |
   | Avant T+6 h | seuil de 50 atteint et horodaté |
   | T+6 h | bilan figé : livrés, en attente, doublons et écarts, échecs, consommation ; publications à part |

   Pendant ce suivi :
   - une source qui refuse l'accès s'arrête : ne jamais contourner ;
   - si le bilan annonce une cible inatteignable, activer une source de réserve puis « Reprendre » : même passage, même échéance ; la réserve rejoint le passage avec sa version courante.
5. **Compte rendu** `docs/scan/recette-v1.md` :
   - T0, échéance, délai du premier dossier, `targetReachedAt`, seuil confirmé (SH5) ;
   - livrés à T+6 h, en attente, publiés (humains, automatiques), rejetés par motif, doublons, exclusions par motif, échecs par source, sources suspendues ;
   - consommation : Vercel relevée, 0 € de fournisseur, aucune clé d'API payante configurée ;
   - minutes de revue par dossier, mesurées à part ;
   - constats, écarts et décisions.

   **Critères** :
   - `targetReachedAt < startedAt + 6 h` ;
   - seuil confirmé, lui aussi, avant T+6 h ;
   - aucun doublon connu parmi les dossiers livrés ;
   - livraison indépendante de la présence de l'admin.
6. **Activation du scan quotidien.**
   - Une fois le remplissage initial terminé (ou plus tôt, si le fondateur le décide), activer « Scan quotidien des offres » sur `/admin`, et « Passages quotidiens » pour chaque source retenue (France Travail l'a déjà, avec sa justification d'accès programmé).
   - Contrôler le premier passage quotidien : il démarre entre 3 h et 3 h 59 à Paris ; sa fenêtre est de 72 h ; il ne relance aucun remplissage élargi ; son résumé s'affiche dans la carte des tâches ; l'email de bilan n'est envoyé que s'il y a des dossiers ou un incident.
   - Publication automatique : jamais pour France Travail (découverte). Pour une source employeur, seulement après plusieurs passages quotidiens sans erreur d'extraction constatée, sur décision du fondateur (SH4).
7. **Clôture.**
   - Cocher les statuts des plans (`docs/plans/scan-v1/README.md`).
   - Noter la V1 comme livrée, avec sa date, dans le plan technique.
   - Mettre `CLAUDE.md` à jour.
   - Poser le tag `scan-v1.0.0`.
   - Ouvrir le plan suivant de la V2 du scan : catalogue par entreprise, et écarts du lot G du plan V2-01 (détection d'un plan de site, JobAnim, demande de flux des job-boards, extraction Club Med).

## Critères d'acceptation

- [ ] La répétition en preview a atteint 50 dossiers exploitables avant T+6 h, avec marge, et elle est consignée.
- [ ] En production, `targetReachedAt` et le seuil confirmé précèdent T0 + 6 h, sans admin connecté pendant la collecte.
- [ ] Aucun frais de fournisseur ; la consommation Vercel est relevée et compatible avec l'offre du compte.
- [ ] Publications et temps de revue sont mesurés séparément du délai de collecte.
- [ ] Le scan quotidien est actif, et son premier passage respecte la fenêtre de 72 h sans nouvel amorçage.

## Hors périmètre

- Couverture nationale, nouvelles familles de sources, recherche Web (V2 à V5).
- Plan 18 de l'application (domaine définitif, passage en Pro, RGPD), qui suit son propre calendrier.
