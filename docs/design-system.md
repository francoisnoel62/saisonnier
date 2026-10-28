# ma saison — Bible du design system

Version 1.1 · 28 octobre 2026

Ce document est le contrat de design commun à la landing, à l’authentification et aux espaces saisonnier, employeur et administration. Il doit être consulté avant de créer ou modifier une interface. Les tokens et composants existants sont la source de vérité exécutable ; une évolution de ces règles s’accompagne d’une mise à jour du code et de ce document.

## 1. L’idée directrice

**Des carrières qui se construisent. Des équipes qui se retrouvent. Saison après saison.**

ma saison accompagne une relation dans la durée. Le site ne doit jamais se réduire visuellement ou éditorialement à un catalogue d’annonces.

- Saisonnier : trouver, organiser ses démarches, valoriser son parcours, préparer la saison suivante.
- Employeur : recruter, fidéliser, réembaucher, anticiper et apprendre de chaque saison.
- Administration : vérifier, comprendre et agir avec précision.

L’interface est calme, lisible et chaleureuse. Elle donne de la place aux personnes et aux informations utiles. La référence [Jack & Jill](https://www.jackandjill.ai/) inspire la composition éditoriale, les espaces, le double parcours et la place donnée au produit. Aucun logo, témoignage, chiffre ou média de cette marque n’est repris.

## 2. Stack et sources de vérité

**Conserver Next.js, React, shadcn/ui, Radix, Tailwind CSS et Lucide.**

| Élément | Source |
| --- | --- |
| Nom, description et domaine public | `src/config/site.ts` |
| Palette et tokens de marque | `src/app/design-tokens.css` |
| Mapping du thème shadcn/Tailwind | `src/app/globals.css` |
| Primitives interactives | `src/components/ui/` |
| Logo partagé | `src/components/public/brand.tsx` |
| Header, footer et navigation publique | `src/components/public/public.module.css` |
| Composition de la landing | `src/components/public/landing.module.css` |
| Recherche publique | `src/components/public/search.module.css` |
| Aperçus agrandissables | `src/components/public/product-screenshot.tsx` |

Tailwind est le premier choix pour les grilles, flex, espacements, tailles et breakpoints. Les CSS Modules servent aux compositions spécifiques : typographie éditoriale, cadrage des captures, header public. Ils consomment les mêmes variables. Ne pas créer un deuxième kit de boutons, d’onglets ou de fenêtres modales.

## 3. Identité

- Écrire **ma saison**, en minuscules, avec une espace ; domaine **www.ma-saison.fr**.
- Réutiliser `Brand`, composé du soleil Lucide et du mot-symbole serif. Ne pas reconstituer le logo dans chaque écran.
- La landing, l’authentification et la sidebar utilisent le même composant.
- Le nom n’est pas un titre de page : chaque écran conserve son propre H1.
- Les URL SEO reposent sur `site.url`. Les URL techniques d’authentification restent configurées par environnement : un changement de domaine public n’autorise pas un changement implicite des cookies ou des secrets.

## 4. Couleurs

| Token | Valeur | Usage |
| --- | --- | --- |
| `--ms-ink` | `#20231F` | Texte principal, boutons primaires |
| `--ms-muted` | `#666B63` | Descriptions, aide et métadonnées |
| `--ms-paper` | `#FFFFFF` | Surfaces de travail et lecture |
| `--ms-canvas` | `#F7F8F2` | Fonds secondaires et sidebar |
| `--ms-line` | `#E3E6DC` | Séparateurs décoratifs et contours de surfaces |
| `--ms-sage` | `#EAF0E4` | Univers saisonnier, fond d’accent doux |
| `--ms-peach` | `#F6EAE1` | Univers employeur, fond d’aperçu produit |
| `--ms-lime` | `#D6EC8B` | Accent ponctuel disponible ; jamais pour du texte courant |
| `--ms-green` | `#3C5745` | Accent éditorial, focus et texte sur fond clair |

Dans l’application, utiliser les classes sémantiques : `bg-background`, `bg-card`, `bg-muted`, `text-foreground`, `text-muted-foreground`, `border-border`, `ring-ring`. Le thème clair relie ces valeurs aux tokens de marque. Les fonds sauge et pêche indiquent un univers, pas un statut.

Une erreur reste associée à `destructive` et à un message explicite. Ne jamais utiliser le vert ou la couleur seule pour signifier « validé ». Les bordures pâles sont décoratives : une information ou un contrôle essentiel doit aussi avoir un libellé et un état perceptible.

Le thème sombre existant est conservé pour les composants applicatifs. La landing éditoriale est une composition claire. Tout nouvel écran sombre doit faire l’objet d’une vérification spécifique ; ne pas supposer que des valeurs hexadécimales claires s’y adaptent automatiquement.

## 5. Typographies et hiérarchie

Deux voix, une seule identité : **Georgia** pour la marque et les grands messages éditoriaux ; **Geist** pour les interfaces et les textes. Geist est servi par `next/font`. Georgia utilise la police système, sans requête externe.

| Rôle | Desktop | Mobile | Règle |
| --- | --- | --- | --- |
| H1 de landing | 48–88 px, serif, 400 | 36–56 px | Interligne 1,08–1,13 ; deux lignes si possible |
| H2 éditorial | 38–57 px, serif, 400 | 36 px | Interligne 1,12 ; approche légèrement serrée |
| Accroche produit | 25–36 px, sans, 450 | 28 px | Formulation concrète, 2–3 lignes |
| Titre d’écran applicatif | 20–24 px, sans, 600 | 20 px | Un seul H1 ; pas de serif dans les tableaux |
| Sous-titre de bloc | 16–20 px, sans, 500–600 | 16–18 px | Décrit la tâche ou le contenu |
| Texte de lecture | 14–17 px | 14–16 px | Interligne 1,6–1,9 |
| Métadonnées | 12–13 px | 12 px | Jamais la seule indication d’une action |
| Surtitre décoratif | 9–10 px, capitales | 8–10 px | Court, espacement de lettres 1–1,6 px |

L’italique serif souligne une idée, pas un paragraphe. Le texte essentiel d’une interaction ne doit pas être réduit à la taille d’un surtitre décoratif. Les corps de formulaires restent lisibles, avec un objectif de 16 px sur mobile pour les nouvelles saisies.

## 6. Grille, densité et responsive

- Base d’espacement : 4 px. Préférer 8, 12, 16, 24, 32, 48, 64, 80 et 112.
- Largeur éditoriale maximale : 1 240 px ; sections de fond jusqu’à 1 440 px.
- Marges publiques : 40 px sur grand écran, 20 px sur mobile.
- Espacement entre sections : 112 px sur desktop, 72 px sur tablette/mobile.
- Les écrans métier gardent une densité adaptée au travail : 24–32 px entre sections et 12–16 px dans les listes. Ne pas leur imposer les grands blancs du marketing.
- Les parcours du hero passent de deux colonnes à une à 600 px. Les compositions secondaires se simplifient à 800 px. Le header passe au menu mobile à 850 px.
- Les nouveaux écrans applicatifs privilégient les breakpoints Tailwind standards ; un breakpoint spécifique doit résoudre un besoin réel et être documenté.
- Une table peut défiler dans son propre conteneur. La page entière ne doit pas défiler horizontalement.
- Vérifier au minimum 390 px, 768 px et 1 440 px, avec un contrôle supplémentaire à 320 px pour les contenus sensibles.

## 7. Formes, icônes et mouvement

- Rayon shadcn de base : `--radius: 0.75rem` (12 px). Les dérivés sont calculés par le thème.
- CTA marketing, filtres compacts et onglets : pilule (`rounded-full`). Les boutons applicatifs conservent leur rayon shadcn.
- Captures et photographies : rayon discret de 6–9 px. Éviter de transformer chaque section en carte.
- Ombres légères uniquement pour une surface flottante ou un aperçu produit. Les blocs de contenu reposent sur les espaces et séparateurs.
- Icônes Lucide : 16–20 px dans l’interface, 24–36 px pour un repère éditorial. Décoratives : `aria-hidden`. Bouton sans texte : nom accessible explicite.
- Hover : variation douce, 160–240 ms. Aperçu produit : déplacement de quelques pixels, 400 ms avec `--ms-ease`.
- Respecter `prefers-reduced-motion`. Aucun carrousel automatique, vidéo, animation continue ou apparition qui masque initialement du contenu essentiel.

## 8. Composants et comportements

| Besoin | Composant | Contrat UX |
| --- | --- | --- |
| Action principale | `Button` | Verbe précis ; une priorité visuelle dominante par zone |
| Navigation vers un écran | `Button asChild` + `Link` | Une vraie URL, jamais un bouton avec un faux lien |
| Action secondaire | `Button variant="outline"` | Même taille que l’action principale voisine |
| Bascule entre vues | `Tabs` | Sélection visible, clavier fléché, panneau associé |
| Zoom d’une capture | `Dialog` | Titre, description, fermeture nommée, Échap et retour du focus |
| Navigation mobile | `Sheet` | Titre accessible, fermeture explicite, liens qui referment le menu |
| État et disponibilité | `Badge` | Texte compréhensible ; ne pas confondre « À venir » et « Disponible » |
| Formulaire | `Field`, `Label`, `Input`, `Select` | Label permanent, aide reliée, erreur près du champ |
| Liste vide | `Empty` | Pourquoi c’est vide et une prochaine action utile |
| Chargement | `Skeleton` ou état du bouton | Conserver les dimensions ; empêcher les doubles envois |
| Résultat d’action | `Alert` / `Sonner` | Retour clair ; erreur persistante si elle demande une correction |
| Questions simples | `details` / `summary` | HTML natif, activable au clavier, contenu accessible sans JS |

Écrire les états normal, survol, focus, désactivé, chargement, vide, succès et erreur dès la conception. Pour une sauvegarde, conserver la saisie en cas d’échec. Une confirmation de suppression doit nommer l’objet concerné ; les opérations réversibles peuvent proposer une annulation.

Exemple de CTA respectant le système :

```tsx
<Button asChild className="h-12 rounded-full px-6">
  <Link href="/inscription/employeur">
    Préparer ma saison
    <ArrowUpRightIcon aria-hidden />
  </Link>
</Button>
```

Exemple de bloc applicatif :

```tsx
<section className="space-y-4" aria-labelledby="team-title">
  <h2 id="team-title" className="text-xl font-semibold tracking-tight">
    Mon équipe
  </h2>
  <p className="text-sm leading-7 text-muted-foreground">
    Retrouvez les informations utiles pour préparer la prochaine saison.
  </p>
</section>
```

Cet exemple de texte n’implique pas que le vivier soit déjà développé.

## 9. Architecture des parcours

**Saisonnier.** Le profil s’enrichit progressivement. L’exploration ne demande pas immédiatement un CV. Séparer offre sauvegardée et candidature déclarée. Préserver les filtres lors du passage par la connexion. Une navigation connectée retourne vers l’espace autorisé par le rôle.

**Employeur.** À terme, la structure doit relier les besoins, les recrutements, l’équipe, les intentions de retour et les bilans. Distinguer le poste, la personne et la saison. Mettre en évidence ce qui manque pour la prochaine échéance et permettre d’en comprendre la cause. Ne pas attribuer une note opaque à une personne. Les retours doivent servir l’amélioration des conditions et de l’organisation.

**Fonctions actuelles.** Catalogue filtré, dossier candidat, sauvegardes et candidatures déclarées ; espace entreprise, vérification du rattachement, annonces et état de publication.

**Vision, pas fonctionnalité livrée.** Calendrier de carrière, historique structuré des saisons, vivier de saisonniers, intentions de retour, campagnes de réembauche, prévision des besoins et bilans. Les signaler « À venir », sans fausse date, bouton factice ni capture d’un écran inexistant.

## 10. Voix et microcopy

- Français clair, vouvoiement, accents et apostrophes typographiques dans les textes éditoriaux.
- Parler d’« espace », de « dossier », de « saison », d’« équipe » et de « candidatures » plutôt que de jargon technique.
- Boutons : « Créer mon espace », « Préparer ma saison », « Enregistrer », « Publier une offre ».
- Une erreur indique une solution : « Vérifiez votre adresse email » plutôt que « Erreur 400 ».
- Ne pas promettre un recrutement, un logement ou une date de disponibilité sans preuve.
- Ne pas fabriquer de témoignages, logos clients, statistiques, notifications ou résultats.
- Les données inconnues restent « Non précisé » ; ne pas afficher 0 à la place d’une absence de données.

## 11. Images, captures et illustrations

- Utiliser des **captures réelles** du produit courant, avec des comptes fictifs explicitement autorisés.
- Captures dans `public/images/app/` ; provenance dans `public/images/app/README.md`.
- Aucune donnée personnelle réelle, token, mot de passe ou notification privée ne doit apparaître.
- Conserver l’interface réelle. Le fond sauge/pêche, l’ombre et le cadre navigateur sont une présentation CSS autour de la capture, pas une retouche du produit.
- La légende annonce les données de démonstration. Un clic permet l’agrandissement dans un `Dialog`.
- Réaliser une nouvelle capture après toute modification importante du thème, du logo, de la navigation ou de l’écran montré.
- Les photographies racontent un lieu ou une saison. Les illustrations peuvent expliquer un concept, mais ne doivent pas se faire passer pour un écran livré.
- Utiliser `next/image`, dimensions explicites, `sizes` adaptés, chargement différé sous la ligne de flottaison. Les images décoratives ont un texte alternatif vide.

## 12. Accessibilité et recette

Objectif WCAG AA : contraste du texte courant d’au moins 4,5:1 ; grand texte et information graphique essentielle d’au moins 3:1. Recalculer les contrastes si la palette change, y compris sur les fonds sauge et pêche.

Contrastes vérifiés pour cette palette : texte principal de 13,45:1 à 15,89:1 ; texte secondaire de 4,62:1 à 5,46:1 ; accent vert de 6,73:1 à 7,95:1 sur les quatre fonds clairs documentés. Ces mesures ne remplacent pas une recette d’accessibilité complète de chaque écran.

- Un H1, des titres dans l’ordre, landmarks et noms de navigation distincts.
- Lien d’évitement « Aller au contenu », focus visible et ordre clavier logique.
- Cibles tactiles principales de 44 px minimum ; pas d’actions qui n’existent qu’au survol.
- Les onglets fonctionnent aux flèches, les modales avec Échap, les questions avec Entrée/Espace.
- Les textes doivent rester lisibles à 200 % de zoom. Vérifier les libellés longs et les erreurs de formulaire.
- Contrôler les deux profils, connecté et déconnecté, desktop et mobile.
- Vérifier les images chargées, les ancres sous le header fixe, l’absence de débordement et les URL de destination.
- Lancer lint, typecheck, build et les tests fonctionnels pertinents. Une capture jolie ne remplace pas la vérification des actions.

## 13. Faire évoluer le système

1. Chercher un token ou composant existant avant d’en ajouter un.
2. Distinguer une variation éditoriale locale d’un besoin commun à plusieurs écrans.
3. Pour un besoin partagé, modifier la primitive ou introduire un composant métier réutilisable ; éviter les copies.
4. Vérifier les états et les tailles d’écran concernés.
5. Mettre à jour cette bible et les captures si elles sont affectées.

La refonte applique la marque, la landing et le logo partagé, puis les annonces : catalogue, suivi, fiche, aperçus employeur/admin et repères des tableaux de gestion. Les autres écrans métier évoluent selon ce contrat ; les fonctions de la feuille de route restent identifiées comme telles.

## 14. Annonces : découvrir, comparer, comprendre

### Aperçu d'annonces sur la landing

Le bloc public entre la recherche et la FAQ réutilise `OfferArtwork`, `OfferCategory` et `OfferSeason`, avec une carte éditoriale et une rémunération plus visible. À ce stade, il est **statique et explicitement présenté comme une démonstration**. Une seule action réelle mène au catalogue ; les exemples ne simulent pas une fiche consultable. Le raccordement métier et l'actualisation quotidienne sont spécifiés, mais non implémentés, dans `docs/landing-featured-offers.md`.

Les trois directions de l'exploration du 28 octobre ont été retenues ensemble. La branche `codex/prototype-annonces-vivantes` (commit `3302a41`) conserve les maquettes comme référence. L'intégration métier se fait sur `codex/annonces-vivantes`, sans les simulations et sans la barre de prototype.

### Une identité de métier, distincte des statuts

Les tokens `--offer-*` de `src/app/design-tokens.css` ont une paire texte/fond en clair et en sombre. Les classes sont regroupées dans `src/components/offers/offers.module.css` et les composants dans `offer-visuals.tsx`.

| Famille visuelle | Texte / fond clair | Familles du référentiel |
| --- | --- | --- |
| Terracotta | `#914D34` / `#F8EAE1` | Cuisine ; Salle & bar |
| Lavande | `#65518A` / `#F0EBF8` | Réception & hébergement ; Étages & entretien ; Encadrement |
| Glacier | `#315F79` / `#E6F1F6` | Domaine skiable ; Sport & loisirs ; Commerce & location |
| Ocre | `#79571D` / `#FAF0D9` | Animation & enfance ; Accueil touristique |
| Sauge | `#3C5745` / `#EAF0E4` | Bien-être ; Technique & transport ; Agriculture ; familles libres |

Le libellé reste celui du référentiel. Une famille absente devient « Catégorie non précisée » ; aucune famille n'est déduite du titre. Une famille personnalisée conserve son libellé et utilise l'icône générique. Les illustrations sont abstraites et décoratives : elles n'affirment rien sur le bâtiment ou le paysage du lieu de travail.

Contrastes texte/fond métier : de 5,38:1 à 6,85:1 en clair et de 7,89:1 à 8,45:1 en sombre. Le statut reste un composant distinct : vert et coche « En ligne », ocre et horloge « En attente de vérification », neutre pour hors ligne/expirée, `destructive` pour refusée. Toujours une icône et un texte, jamais la couleur seule.

### Trois vues d'un même catalogue

- **Escales** : cartes illustrées ; métier, entreprise, destination, dates, salaire puis vie pratique. Vue par défaut.
- **Comparateur** : lignes avec les informations disposées en colonnes ; empilement sur mobile.
- **Immersion** : liste et fiche côte à côte à partir de 1 024 px ; panneau shadcn pleine largeur en dessous. La fermeture rend le focus à l'annonce.

Le sélecteur réutilise `Button`, dans un groupe nommé, avec `aria-pressed`. Les modes sont des préférences de présentation portées par `vue=`, pas des filtres métier : le compteur, les critères et la pagination restent les mêmes. Une offre sélectionnée en Immersion est portée par `offre=` et doit appartenir à la page de résultats autorisés. Le retour d'une fiche conserve la recherche et la vue ; sa destination reste limitée à `/offres`.

`OfferCard` sert aussi aux offres sauvegardées et candidatures déclarées. Les dates de publication/découverte, lieux multiples, salaires dans leur unité d'origine, provenance, canal externe et états expirés restent présents.

### Une fiche commune et des actions selon les droits

`OfferHero` et `OfferSummary` donnent immédiatement le métier, le lieu, la saison, les dates, le salaire, le logement et les repas. `OfferDetails` organise le poste, le contrat, les lieux, la rémunération, les conditions, le profil, l'organisation et la vie pratique. Les rubriques profil/organisation/vie pratique entièrement inconnues sont repliables, annoncées « Informations à préciser ». Les valeurs restent consultables ; rien n'est inventé.

Les informations décisives — dates, salaire, logement, repas — restent visibles même inconnues. « Non », « Non précisé » et « À confirmer » restent distincts. Les salaires net/brut ne sont jamais convertis pour la présentation.

`OfferContent` rend la même fiche côté serveur sur la page dédiée et en Immersion, avec les mêmes contrôles de rôle, d'activité et de dossier. Le panneau unique `ApplicationPanel` réunit l'explication et les actions autorisées. Les coordonnées ne sont pas envoyées au navigateur d'un candidat dont le dossier est incomplet. Une sauvegarde reste distincte d'une candidature déclarée, et un clic sur un contact ne déclare jamais une candidature.

Les aperçus de saisie et de gestion réutilisent le même en-tête, résumé et contenu. Les tableaux employeur/admin conservent leur densité et leurs actions ; catégorie, statut et informations à préciser facilitent leur lecture. La provenance détaillée et le lien de correction des annonces collectées restent disponibles sur la fiche.

### Mouvement et contrôle

Survol de carte : translation maximale de 2 px, ombre douce et transition de 200 ms. Signet rempli pour une offre sauvegardée. Respect de la réduction des animations. Vérifier les vues, la pagination, les filtres, le retour, l'ouverture/fermeture mobile, les cas incomplets/anonymes/expirés et les droits de candidature avant de modifier ces composants.
