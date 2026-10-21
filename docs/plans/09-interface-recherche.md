# Plan 09 — Interface de recherche : filtres dynamiques

| Dépend de | Débloque | Taille | Cahier des charges |
|---|---|---|---|
| 08 | 11 | M | §4 (filtres combinables, mise à jour immédiate, critères actifs retirables), §9 |

## Objectif

Construire la page `/offres`. Chaque modification d'un filtre y met immédiatement à jour la liste **et** le nombre de résultats.
Les critères actifs restent visibles et se retirent un par un.

## Étapes

1. **nuqs.** Installer `npm i nuqs` et placer `NuqsAdapter` (`nuqs/adapters/next/app`) dans le layout `(app)`.
2. **Paramètres d'URL** dans `src/server/search/search-params.ts`.
   - Des parseurs nuqs partagés entre client et serveur, plus `createLoader`, qui produit un `SearchCriteria`.
   - Clés courtes en français : `metier`, `region`, `dept`, `du`, `au`, `flexible`, `base` (`net` ou `brut`), `min`, `logement`, `repas`, `debutant`, `langues`, `temps`, `sanspermis`, `couple`, `animaux`, `page`.
   - L'URL est la seule source de vérité : un rechargement ou un lien partagé conserve la recherche.
3. **Page serveur** `src/app/(app)/offres/page.tsx`.
   - Elle fait `await searchParams`, passe par le loader, puis appelle `searchOffers`.
   - Elle rend `<SearchFilters>`, `<ActiveFilters>`, `<ResultsHeader>` (« 42 offres », avec `aria-live="polite"`) et `<ResultsList>`.
4. **Filtres (composants client).**
   - **Mise à jour** :
     - `useQueryStates(parsers, { shallow: false, startTransition })` relance le rendu serveur ;
     - un état « mise à jour… » s'affiche pendant la transition ;
     - chaque changement ramène à la page 1 ;
     - la saisie du salaire minimum est temporisée (environ 400 ms).
   - **Contrôles** :
     - **Métier** : combobox multiple (`Popover` + `Command`), groupée par famille.
     - **Lieu** : combobox multiple, régions et départements.
     - **Dates** : `Calendar` en mode plage, en locale `fr` : « Je suis disponible du … au … ».
       - Un interrupteur « Dates flexibles » l'accompagne, avec son explication : « inclut les contrats qui chevauchent vos dates ».
     - **Rémunération** : `ToggleGroup` Net / Brut, puis un montant minimum mensuel.
       - Le montant reste désactivé tant que la base n'est pas choisie.
       - Texte d'aide : « seules les offres indiquant un salaire mensuel {net ou brut} sont comparées ».
     - **Interrupteurs** : Logement fourni, Repas fournis, Débutants acceptés, Permis non exigé, Couples acceptés, Animaux acceptés.
     - **Langues que je parle** : sélection multiple.
     - **Temps de travail** : plein ou partiel.
   - **Disposition** :
     - sur ordinateur : une barre de filtres, avec un `Popover` par groupe, et un `Sheet` « Tous les filtres » ;
     - sur mobile : un `Sheet` plein écran, avec un bouton « Voir N offres ».
5. **Critères actifs.**
   - `activeCriteriaChips(criteria, referentiels)`, dans `src/domain/search-chips.ts`, produit les libellés français. La fonction est testée.
   - Chaque `Badge` porte un bouton « retirer » qui n'enlève **que** ce critère.
   - Un bouton « Tout effacer » retire tous les critères.
6. **Carte d'offre** `src/components/offers/offer-card.tsx`. Elle affiche :
   - le titre et l'entreprise publique ;
   - la commune et son département ;
   - la saison, avec les dates ou la durée ;
   - le salaire affiché, ou « Salaire non précisé » ;
   - le logement et les repas, en Oui / Non / **Non précisé** : jamais masqués ;
   - un badge de provenance : « Déposée par l'employeur » ou « Collectée sur le site de l'employeur ».

   La carte renvoie vers `/offres/[id]`, page créée au plan 11.
7. **Pagination et état vide.** Utiliser la pagination shadcn. L'état vide (`Empty`) invite à retirer un critère.

## Tests

**Unitaires** : `activeCriteriaChips`, et l'aller-retour URL ↔ critères.

**E2E** dans `e2e/recherche.spec.ts` :

- trois filtres activés l'un après l'autre changent le compteur à chaque fois, sans bouton « valider » ;
- retirer un badge élargit les résultats ;
- après un rechargement, les résultats sont identiques ;
- le filtre « Logement fourni » n'affiche jamais une offre dont le logement est « Non précisé » ;
- le filtre Net à 1 800 € n'affiche pas une offre brute à 2 000 € ;
- sur mobile, le `Sheet` annonce le bon nombre d'offres.

## Critères d'acceptation

- [ ] §4 : les filtres se combinent, et les résultats comme leur nombre se mettent à jour immédiatement.
- [ ] §4 : les critères actifs sont visibles et se retirent individuellement.
- [ ] La page est utilisable au doigt à 375 px.

## Hors périmètre

- Recherches enregistrées et alertes (hors V1).
- Carte géographique.
