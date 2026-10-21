# Plan 15 — Back-office : annonces collectées, modération & référentiels

| Dépend de | Débloque | Taille | Cahier des charges |
|---|---|---|---|
| 14 | 18 | M | §2 (origine des annonces), §6 (annonces collectées, modifications par le fondateur), §7 (anonymat), H10 |

## Objectif

Donner au fondateur la gestion de toutes les annonces, y compris les annonces collectées, qu'il saisit lui-même en V1.
Il y applique les demandes des employeurs et y maintient les référentiels.

## Étapes

1. **Point d'entrée unique** `upsertCollectedOffer(input, actor)`, dans `src/server/offers/ingest.ts`.
   - Déduplication par `sourceUrl`.
   - Validation du minimum de publication et des domaines exclus, sur la source **et** sur la destination.
   - Valeurs fixées : `origin = collected`, `status = published`, `sourceCheckedAt = maintenant`.
   - Un refus renvoie ses motifs : éléments manquants (`checkPublicationMinimum`) et domaines exclus. Le futur scan les conservera, avec les données brutes, dans une file de revue du back-office (H16).
   - Le futur scan nocturne appellera cette fonction. **Ce plan ne contient aucun scraping** (§6, §8).
2. **Page `/admin/annonces`** : un tableau de toutes les annonces.
   - **Filtres** : origine, statut, entreprise, recherche dans l'intitulé.
   - **Actions** :
     - Aperçu et Modifier ;
     - Dépublier ou Republier ;
     - « Source vérifiée aujourd'hui », pour les annonces collectées : met à jour `sourceCheckedAt`.
3. **Création et édition admin**, sur `/admin/annonces/nouvelle` et `/admin/annonces/[id]/modifier`. Elles utilisent `OfferForm` en mode `admin`.
   - **Entreprise** : recherche parmi les entreprises existantes, ou création d'une fiche entreprise sans compte.
   - **Origine collectée** : l'URL et le nom de la source deviennent obligatoires.
   - **Canal de candidature** : `employer` ou `recruiter`. Le canal `recruiter` demande le nom et les coordonnées du chargé de recrutement.
   - **Anonymat** : « Masquer l'identité de l'entreprise » ne s'active **qu'avec** le canal `recruiter`. Une contrainte en base l'impose aussi (plan 07).
   - **Demande d'un employeur** : depuis un message de contact lié à une offre (plan 06), un lien mène directement à l'édition.
4. **Page `/admin/referentiels`.**
   - **Métiers** : ajouter, renommer, ordonner, désactiver. Un métier désactivé disparaît des formulaires et des filtres, mais reste affiché sur les anciennes annonces.
   - **Domaines exclus** :
     - ajouter ou retirer un domaine, avec un motif ;
     - à l'ajout, afficher les annonces publiées qui pointent vers ce domaine, avec un lien d'édition.
5. **Tableau de bord `/admin`.**
   - Des `SectionCards` : annonces actives déposées et collectées, vérifications en attente, messages non traités, candidats inscrits.
   - `ChartAreaInteractive`, adapté pour montrer les inscriptions de candidats et les annonces publiées par jour sur 90 jours, à partir de requêtes réelles.

## Tests

**Intégration** :

- `upsertCollectedOffer` crée une annonce, puis met à jour la même pour le même `sourceUrl` ;
- elle refuse une source `indeed.fr`.

**E2E** dans `e2e/back-office.spec.ts` :

- l'admin crée une annonce collectée avec un lien officiel ; elle est visible côté candidat, avec la mention de provenance ;
- après l'ajout d'un domaine exclu, l'annonce concernée est signalée et son lien n'est plus affiché ;
- pour une annonce anonyme avec chargé de recrutement, le nom de l'entreprise n'apparaît pas côté candidat.

## Critères d'acceptation

- [ ] §6 / §9 : les modifications d'annonces collectées passent par le fondateur ; aucun écran employeur ne les modifie.
- [ ] §7 : l'anonymat complet n'existe qu'avec intermédiation, et l'identité reste toujours connue du service.
- [ ] Les référentiels se gèrent sans toucher au code.

## Hors périmètre

- Scan nocturne et découverte des sources (discussion reportée).
- Import CSV.
- Gestion des comptes utilisateurs.
