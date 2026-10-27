# Plan 17 — Prestations employeurs (demandes traitées manuellement)

| Dépend de | Débloque | Taille | Cahier des charges |
|---|---|---|---|
| 06, 13 | 18 | S | §7 (modèle économique, confidentialité et engagements), H15 |

## Objectif

Présenter les prestations et recueillir les demandes des employeurs, que le fondateur traite à la main.
Pas de tarif, pas de paiement.

## Étapes

1. **Table `service_requests`.**

   | Colonne | Contenu |
   |---|---|
   | `id` | uuid |
   | `companyId`, `requestedByUserId` | demandeur |
   | `services` | tableau de `service_kind` : `questionnaire`, `screening`, `human_selection`, `candidate_contact`, `sourcing` |
   | `scope` | `offer`, `campaign`, `establishment` |
   | `offerId` | si la portée est une annonce |
   | `scopeDetails` | précisions |
   | `purchaseFormat` | `single`, `package` |
   | `message` | |
   | `status` | `new`, `in_progress`, `done`, `cancelled` |
   | `adminNote` | note interne |
   | `createdAt`, `updatedAt` | |

2. **Page `/employeur/prestations`.**
   - **Les cinq prestations du §7** :
     - questionnaire préalable ;
     - tri selon les critères du poste ;
     - sélection humaine ;
     - prise de contact et confirmation de l'intérêt des candidats ;
     - recherche proactive et sourcing.
   - **Engagements affichés** :
     - des prestations définies, **sans garantie d'embauche** ;
     - **aucun achat nécessaire** pour publier une annonce conforme ;
     - des tarifs sur devis ;
     - un anonymat complet seulement quand le service assure l'intermédiation ;
     - des incompatibilités signalées, sans rejet automatique ;
     - les CV privés des inscrits ne servent jamais de base de sourcing.
   - **Formulaire** :
     - prestations voulues (cases à cocher) ;
     - portée : une de ses annonces, une campagne ou un établissement, avec des précisions ;
     - formule : à l'unité ou en package ;
     - message.

     L'envoi enregistre la demande, envoie un email au fondateur et affiche une confirmation.
   - **« Mes demandes »** liste les demandes de l'employeur avec leur statut.
3. **Admin** : `/admin/demandes`, onglet « Prestations ».
   - Un tableau, et un `Drawer` pour le détail.
   - Le fondateur change le statut et ajoute une note interne.
   - Si la prestation implique l'intermédiation, il bascule l'annonce sur le canal `recruiter` (et, le cas échéant, sur l'anonymat) depuis le back-office du plan 15.

## Tests

**E2E** dans `e2e/prestations.spec.ts` :

- un employeur envoie une demande ;
- l'admin la voit et la passe « en cours » ;
- l'employeur voit le nouveau statut ;
- le dépôt d'annonce reste possible sans aucune demande.

## Critères d'acceptation

- [x] §7 : aucune prestation n'est obligatoire pour publier.
- [x] §7 : les engagements sont visibles.
- [x] Le traitement manuel des demandes est outillé.

## Hors périmètre

- Tarifs, devis et paiement en ligne.
- Questionnaire en ligne et tri automatique.
- Prestations destinées aux candidats (V2).
