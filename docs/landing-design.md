# Direction de la landing page

Concept : « Un job. Un lieu. Une saison à vivre. » Une présentation sobre qui associe photographie de destination, typographie affirmée et parcours de recherche concret, dans la continuité de l’interface shadcn/ui de l’application.

- Palette : blanc, noir et nuances de gris, à partir des variables sémantiques du thème shadcn/ui existant (`background`, `foreground`, `muted`, `border`, `primary`). Geist est la seule police utilisée.
- Les boutons d’action utilisent le composant `Button` de l’application ; le logo reprend son icône soleil/flocon. Les cartes, bordures et fonds gris remplacent les décors de carnet de voyage.
- Le style est limité au groupe public, dans `src/components/public/public.module.css`. Les espaces authentifiés conservent leur interface.
- La recherche réutilise `searchHref` et les filtres existants. Les visiteurs sont dirigés vers la connexion avec leur recherche dans `next`.
- Les destinations sont des entrées vers des départements ou des métiers, sans faux compteur ni fausse annonce.
- Le bandeau sous la recherche présente « 10 000+ entreprises explorées », la recherche et l’actualisation des offres chaque jour, ainsi que les échanges humains. Le volume et la fréquence ont été confirmés par le propriétaire du site le 22 octobre 2026 ; ces mentions sont éditoriales, sans compteur en temps réel.
- Photos hébergées localement et optimisées par `next/image`, affichées en noir et blanc avec un filtre CSS ; image principale chargée immédiatement avec priorité haute, images secondaires chargées à la demande.
- Menu mobile Radix avec gestion du focus et fermeture par Échap ; FAQ native au clavier ; animations désactivées si réduction des mouvements.
- Aucun service externe ni moteur d’IA ajouté.

## Photographies

Photographies d’illustration provenant d’Unsplash, sans affirmation d’affiliation ou de poste disponible dans les lieux représentés.

| Fichier | Source |
| --- | --- |
| alpine-lake.jpg | [Raymond Rutjes, Chamonix](https://unsplash.com/photos/a-mountain-range-is-reflected-in-the-still-water-of-a-lake-gk_aDEdTv2w) |
| coast.jpg | [Image Unsplash](https://images.unsplash.com/photo-1507525428034-b723cf961d3e) |
| restaurant.jpg | [Image Unsplash](https://images.unsplash.com/photo-1414235077428-338989a2e8c0) |

Licence : https://unsplash.com/license

## Vérifications

Vérifications réalisées le 22 octobre 2026 :

- Après la révision monochrome : `npm run typecheck` et `npm run lint` réussis.
- Après la révision monochrome : `npm run e2e -- e2e/public.spec.ts --grep accueil`, 15 tests réussis sur desktop et mobile, incluant la préparation des comptes.
- Contrôle visuel de la révision monochrome sur mobile et desktop, menu mobile et fermeture par Échap vérifiés ; aucun débordement horizontal constaté aux cinq largeurs testées.
- Avant la révision des styles : `npm test`, 318 tests réussis ; suite publique E2E complète, 39 tests réussis.
- Build de production de la première version réussi avec les variables locales de développement injectées dans le processus de build. Le fichier `.env.development.local` n’est pas chargé automatiquement par `next build`.

Le fichier `e2e/public.spec.ts` couvre l’accès protégé, les critères de recherche, les destinations, la FAQ et les pages publiques. La base locale `saisonnier_landing_test` et `E2E_PORT=3210` dans le fichier ignoré `.env.test.local` isolent les tests de ce worktree. Le port par défaut du projet reste 3100.

L’aperçu local se lance avec `npm run dev -- --port 3200` depuis le worktree.
