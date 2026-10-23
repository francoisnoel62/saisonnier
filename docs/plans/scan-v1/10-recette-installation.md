# Plan scan 10 — Recette et installation en production

| Dépend de | Débloque | Taille | Références |
|---|---|---|---|
| 01 à 09 | V2 du scan | M | plan technique §1, §4 (six premières heures, comptage), §6 (lot 8), §11 ; cahier §3, §9, §10 |

## Objectif

Valider la V1 en preview, l'installer en production, lancer le premier remplissage et démontrer **au moins 50 dossiers distincts et exploitables livrés avant T+6 h**, sans frais de fournisseur ; puis activer le scan quotidien.

Le délai mesuré est celui de la mise à disposition dans la file. Ni la vérification humaine ni la publication ne sont requises dans ces six heures ; elles sont mesurées à part.

## Étapes

1. **Répétition générale en preview.** Branche de recette, base Neon de la preview, sources réelles.
   - Activer les sources retenues (plan 01), « Publication automatique » désactivée.
   - Lancer le premier remplissage et relever : T0 ; délai du premier dossier ; cumul livré à T+15 min, T+1 h, T+2 h, T+3 h ; `targetReachedAt` ; durée totale ; requêtes et octets par source ; étapes et événements Workflow ; incidents.
   - Revoir un échantillon de 20 dossiers : pertinence pour le périmètre, exclusions respectées (aucun dossier vide, clos, hors périmètre ou en double), qualité du préremplissage, minutes de revue par dossier, chronométrées.
   - **Décision** : si la répétition n'atteint pas 50 avant T+6 h, ou seulement de justesse (moins de 20 % de marge sur le délai ou sur le volume), ajouter des sources de réserve ou corriger les extracteurs, puis recommencer. Ne pas déclarer la V1 prête (plan technique §4).
   - Relever la consommation Vercel (onglet Usage : Workflow Events, Workflow Data Written, fonctions) et la rapporter au mois.
   - Après le merge, supprimer la branche Neon de la preview (10 branches au plus).
2. **Configuration de la production.**
   - Variables : rien de nouveau. `CRON_SECRET` existe ; `SCAN_TEST_SOURCE_URL` est absente, et `env.ts` la refuserait.
   - Vercel : variables système exposées (Workflow) ; deux crons `/api/cron/scan` visibles dans « Cron Jobs », à côté de `/api/cron/quotidien` ; section Workflows visible dans l'observabilité.
   - Fiches entreprise des sources (SIREN du registre) créées depuis le formulaire d'annonce admin (« fiche sans compte »), pour que les dossiers aient leur entreprise proposée (SH15).
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
   - si le bilan annonce une cible inatteignable, activer une source de réserve puis « Reprendre » : même passage, même échéance.
5. **Compte rendu** `docs/scan/recette-v1.md` :
   - T0, échéance, délai du premier dossier, `targetReachedAt`, seuil confirmé (SH5) ;
   - livrés à T+6 h, en attente, publiés (humains, automatiques), rejetés par motif, doublons, exclusions par motif, échecs par source ;
   - consommation : Vercel relevée, 0 € de fournisseur, aucune clé d'API payante configurée ;
   - minutes de revue par dossier, mesurées à part ;
   - constats, écarts et décisions.

   **Critères** :
   - `targetReachedAt < startedAt + 6 h` ;
   - seuil confirmé, lui aussi, avant T+6 h ;
   - aucun doublon connu parmi les dossiers livrés ;
   - livraison indépendante de la présence de l'admin.
6. **Activation du scan quotidien.**
   - Une fois le remplissage initial terminé (ou plus tôt, si le fondateur le décide), activer « Scan quotidien des offres » sur `/admin`.
   - Contrôler le premier passage quotidien : il démarre entre 3 h et 3 h 59 à Paris ; sa fenêtre est de 72 h ; il ne relance aucun remplissage élargi ; son résumé s'affiche dans la carte des tâches ; l'email de bilan n'est envoyé que s'il y a des dossiers ou un incident.
   - Activer la publication automatique d'une source seulement après plusieurs passages quotidiens sans erreur d'extraction constatée, sur décision du fondateur (SH4).
7. **Clôture.**
   - Cocher les statuts des plans (`docs/plans/scan-v1/README.md`).
   - Noter la V1 comme livrée, avec sa date, dans le plan technique.
   - Mettre `CLAUDE.md` à jour.
   - Poser le tag `scan-v1.0.0`.
   - Ouvrir la préparation de la V2 du scan (catalogue des employeurs connus).

## Critères d'acceptation

- [ ] La répétition en preview a atteint 50 dossiers exploitables avant T+6 h, avec marge, et elle est consignée.
- [ ] En production, `targetReachedAt` et le seuil confirmé précèdent T0 + 6 h, sans admin connecté pendant la collecte.
- [ ] Aucun frais de fournisseur ; la consommation Vercel est relevée et compatible avec l'offre du compte.
- [ ] Publications et temps de revue sont mesurés séparément du délai de collecte.
- [ ] Le scan quotidien est actif, et son premier passage respecte la fenêtre de 72 h sans nouvel amorçage.

## Hors périmètre

- Couverture nationale, nouvelles familles de sources, recherche Web (V2 à V5).
- Plan 18 de l'application (domaine définitif, passage en Pro, RGPD), qui suit son propre calendrier.
