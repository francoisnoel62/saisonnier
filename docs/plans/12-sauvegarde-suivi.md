# Plan 12 — Offres sauvegardées & suivi « J'ai postulé »

| Dépend de | Débloque | Taille | Cahier des charges |
|---|---|---|---|
| 11 | 18 | S | §5 (sauvegarde et suivi), §9 |

## Objectif

Permettre au candidat de sauvegarder des offres et de déclarer « J'ai postulé » — et rien de plus.

## Étapes

1. **Table `offer_tracking`.**

   | Colonne | Contenu |
   |---|---|
   | `userId` | → `user.id`, suppression en cascade |
   | `offerId` | → `offers.id`, suppression en cascade |
   | `savedAt`, `appliedAt` | |
   | `createdAt`, `updatedAt` | |

   La clé primaire est (`userId`, `offerId`).
2. **Server Actions** dans `src/server/candidates/tracking-actions.ts`.
   - Chaque action appelle `requireRole("candidate")` et est idempotente.
   - Actions : `toggleSaved(offerId)`, `declareApplied(offerId)` et `undoApplied(offerId)`.
3. **Interface.**
   - Un bouton favori sur la carte et sur la fiche, avec mise à jour optimiste.
   - Sur la fiche, sous les coordonnées : un bouton « J'ai postulé ». Une fois cliqué, il devient « Vous avez indiqué avoir postulé le {date} · Annuler ».
4. **Page `/mes-offres`.**
   - Deux onglets : « Sauvegardées (n) » et « J'ai postulé (n) ».
   - Une offre devenue inactive reste listée, avec le badge « Offre expirée » et sans coordonnées.
5. **Ce qu'il ne faut pas ajouter** (§5) : statuts de pipeline, notes, rappels, relances, alertes, recherches enregistrées.

## Tests

**E2E** dans `e2e/suivi.spec.ts` :

- un clic sur un lien `mailto:` ou `tel:` ne crée aucune déclaration ;
- « J'ai postulé » fait apparaître l'offre dans l'onglet, avec la date ;
- « Annuler » la retire ;
- une offre sauvegardée, puis expirée, affiche « Offre expirée ».

## Critères d'acceptation

- [ ] §5 : le candidat dispose d'une liste d'offres sauvegardées et d'une déclaration manuelle ; un clic sur un contact ne vaut pas candidature.
- [ ] §9 : la sauvegarde et le suivi restent simples.

## Hors périmètre

Tout ce que liste l'étape 5.
