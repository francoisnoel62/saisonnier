# Job-board saisonnier — Cahier des charges du scan V1

**Statut : cadrage fonctionnel validé par le fondateur le 21 octobre 2026. A valider une deuxième fois au 23/10/2026 avant de le lancer officiellement pour la première fois.**

Ce document complète le [cahier des charges du job-board V1](./cahier-des-charges-job-board-saisonnier-v1.md). Il rassemble les décisions validées pendant l’entretien consacré au scan. Il décrit le fonctionnement à réaliser ; aucun scan n’est encore développé ni programmé par ce document. Il manque l'encore les aspects techniques et le champ d'application de l'utilisation de l'IA ou pas. 

## 1. Objectif et périmètre

Découvrir chaque jour sur le Web des offres provenant directement des employeurs, les qualifier, les publier lorsqu’elles satisfont les critères.

La recherche vise une couverture large. Elle ne promet pas de trouver immédiatement toutes les annonces publiées sur Internet. En cas de doute, l'annonce est envoyée dans une pile de pré-validation dans /admin

| Dimension | Décision |
|---|---|
| Territoire des postes | France, avec localisation exploitable par région et département |
| Secteurs | Tourisme et hôtellerie de loisirs |
| Contrats | Explicitement saisonniers uniquement |
| Saisons | Été et hiver. Focus sur les annonces les plus récentes/urgentes |
| Métiers | Tous les métiers des établissements concernés, y compris maintenance, espaces verts, transport et autres fonctions support s'ils sont explicitement et contractuellement saisonniers |
| Langues des annonces | Français |
| Sources admissibles | Toutes ! Priorité à : Indeed, France Travail, LinkedIn et autres job-boards ou agrégateurs connus pour plus de facilité (accès via API ou MCP ?). Ensuite, sites officiels des employeurs et portails de recrutement officiellement rattachés à ces employeurs, puis enfin simple recherche google |

Important : aucune annonce publiée sur notre application ne doit renvoyer vers une plateforme de recrutement ou vers un site d'agrégateurs. Ces portails doivent servir uniquement à la découverte des annonces afin de pouvoir ensuite se rediriger vers les sites des entreprises employeurs. Notre application se différencie par la promesse faite aux utilisateurs de pouvoir accéder directement aux contacts vérifées de l'employeur (num de tél/email directs). 


## 2. Déroulement général

Le fonctionnement comporte une seule opération quotidienne :
->  Découvrir des annonces, établir leur provenance, vérifier leur admissibilité et publier ou soumettre à examen.

Les offres conformes peuvent être publiées automatiquement. Les situations ambiguës sont présentées au fondateur dans une file de vérification.

1. Le problème des doublons est géré directement par l'admin dans sa pile de vérif.
2. Recontrôler les URL des annonces déjà publiées pour détecter les modifications, les retraits et les échéances dépassées fera l'objet d'un autre cron job
3. Le parcours exhaustif des offres ouvertes de chaque entreprise est prévu dans une V2, avec un autre cron job

## 3. Calendrier et fenêtres de découverte

| Passage | Règle |
|---|---|
| Scan quotidien | Rechercher les nouveautés avec une fenêtre de rattrapage de trois jours glissants |
| Heure cible | Vers 3 h, selon le fuseau Europe/Paris |

La fenêtre de trois jours permet de récupérer une annonce publiée quelques jours auparavant mais découverte plus tard. Une telle annonce conserve sa véritable date de publication lorsqu’elle est disponible. Elle n’est pas présentée comme publiée le jour de sa découverte.

Une annonce sans date de publication peut être admise si les critères minimums sont établis et si le recrutement reste pertinent pour la saison concernée. Elle est signalée comme « découverte le… ». Son inclusion ne prouve pas qu’elle a été publiée dans les dernières 24 heures.

La fenêtre de découverte n’est pas une durée de vie des fiches : une offre déjà publiée n’est pas retirée simplement parce qu’elle devient plus ancienne que cette fenêtre.

L’heure exacte pourra être ajustée après mesure de la durée du scan. Le fuseau de référence reste Europe/Paris, indépendamment du lieu où se trouve le fondateur (l'heure exacte importe moins que le jour de parution).

## 4. Provenance et accès à la source

Une nouvelle source peut être validée automatiquement lorsque son caractère officiel est établi : site de l’employeur ou portail de recrutement relié depuis son site officiel. Un nom de marque dans une URL ne suffit pas (soumis à vérification auprès de l'admin).

Si le lien avec l’employeur reste incertain, le résultat est soumis à vérification avant publication auprès de l'admin.

Un extrait de moteur de recherche constitue une piste, pas une source suffisante pour publier. Il faut pouvoir consulter une source officielle assez complète pour établir les informations minimums et le moyen de candidature. Si cette consultation échoue, la piste reste à revérifier (soumis à vérification auprès de l'admin).

Le contenu repris comprend des informations structurées, un résumé fidèle des missions et conditions, le lien vers la source et le canal de candidature. La reprise doit tenir compte des conditions de réutilisation de la source. Les montants, dates et conditions importants doivent conserver leur sens exact.

## 5. Qualification et publication

### Informations minimums

La publication nécessite :

- une entreprise identifiable et une provenance officielle établie ;
- un contrat explicitement saisonnier ;
- un lieu précis ;
- une période ou une durée ;
- un moyen de candidature direct utilisable ;
- aucune indication explicite de poste pourvu ni d’échéance déjà dépassée au sens des règles de retrait.

Les cas incertains concernant le contrat, le lieu, la période ou durée, la provenance ou le canal de candidature sont soumis à vérification (soumis à vérification auprès de l'admin).

### Informations complémentaires

Les informations disponibles sont structurées pour alimenter les fiches et les filtres : rémunération, logement, repas, expérience, langues, horaires, permis, accueil des couples et des animaux, et autres conditions documentées.

- Une donnée absente reste « non précisé », jamais « non » par défaut.
- Le salaire conserve sa valeur, sa qualification net/brut et son unité d’origine.
- Le net mensuel avant impôt est affiché lorsqu’il est fourni par l’employeur ; à défaut, le brut disponible est conservé.
- Aucune conversion silencieuse du brut en net ou d’un montant horaire en montant mensuel n’est autorisée.
- Logement et repas sont distingués, avec les conditions renseignées à la source.
- Un logement simplement possible n’est pas présenté comme confirmé.
- Une donnée inconnue ou à confirmer ne satisfait pas un filtre exigeant une condition établie.

L’absence de salaire ou de conditions pratiques ne bloque pas une annonce (soumis à vérification auprès de l'admin).

Si l'annonce propose des imformations complémentaires non-prévues, ils sont ajoutées dans une champ "divers" dans l'annonce.

### Contradictions dans la source

| Nature du conflit | Traitement |
|---|---|
| Champ obligatoire, par exemple dates incompatibles avec la durée | Publication suspendue jusqu’à vérification par admin |
| Champ facultatif, par exemple deux salaires différents | Publication des éléments fiables et mention « à confirmer » pour le champ concerné (soumis à vérification auprès de l'admin) |

Le scan ne choisit pas arbitrairement entre deux valeurs contradictoires.

## 6. Contacts et annonces regroupées

Le canal principal provient de l’annonce : email, téléphone ou lien officiel de candidature auprès de l’employeur.

Un contact général trouvé sur le site officiel peut être proposé en complément. Son rôle est explicite, par exemple « accueil de l’établissement ». Il n’est pas présenté comme un contact RH et ne remplace pas, à lui seul, la vérification d’un canal de candidature utilisable.

Pour une annonce regroupant plusieurs métiers ou lieux :

- séparer les fiches seulement lorsque les associations métier–lieu–période sont explicites ;
- pour un même poste proposé dans plusieurs lieux clairement listés, conserver une fiche avec plusieurs localisations ;
- soumettre les associations ambiguës à vérification, sans inventer de combinaisons (soumis à vérification auprès de l'admin).

## 7. Dates, doublons et modifications

Conserver distinctement :

- la date de publication par l’employeur, lorsqu’elle est connue ;
- la date de première découverte par le scan ;
- la date du dernier contrôle réussi ;
- les dates du contrat et l’éventuelle date limite de candidature.

La nouveauté est présentée à partir de la publication lorsqu’elle est connue ; sinon, employer explicitement « découverte le… ». Une date de début de contrat ou une simple mise à jour ne doit pas être confondue avec la publication initiale.

Un même recrutement retrouvé sous plusieurs URL ou modifié met à jour la fiche existante, en conservant sa première découverte. Des recrutements pour des périodes distinctes restent séparés, même si l’employeur, le métier et le lieu sont identiques. Les rapprochements incertains passent en vérification.

Les corrections confirmées directement auprès de l’employeur par le fondateur sont préservées. Si la source les contredit ensuite, le scan signale la divergence sans les écraser silencieusement (soumis à vérification auprès de l'admin). Les autres champs peuvent être actualisés à partir de la source.

L’employeur qui souhaite compléter, corriger ou retirer une annonce collectée contacte le fondateur directement. Aucun accès autonome de revendication ou de modification d’annonce collectée n’est ajouté à la V1.

! Important = Une annonce publiée directement par le scan obtient le label "sourcée sur internet" ;  celles modifiées et validées par l'admin obtient le label "Vérifiée par un humain" ; celles publiées dans l'application par un employeur-utilisateur authentifié avec une entreprise vérifiée est labelisée "Recruteur vérifié" (elles seront mises en avant d'une façon ou d'une autre sur la landing page ou dans l'app.)   

## 8. Maintien et retrait des annonces

| Situation observée | Action |
|---|---|
| Offre toujours présente, sans signal explicite de clôture ni échéance dépassée | Maintien dans le catalogue actif |
| Source indiquant explicitement un poste pourvu ou une offre expirée | Retrait immédiat des résultats actifs + archivage |
| Date limite de candidature ou date de fin de contrat dépassée | Retrait des résultats actifs, même si la page reste en ligne + archivage |
| Date de début de contrat dépassée, sans autre signal de clôture | Pas de retrait sur ce seul motif - (soumis à vérification auprès de l'admin). |
| Première disparition confirmée | Nouvelle vérification nécessaire (soumis à vérification auprès de l'admin).|
| Disparition confirmée lors de deux passages | Retrait des résultats actifs + archivage |
| Échec de collecte, problème d’accès ou panne du site | Maintien à revérifier ; ne pas assimiler l’échec à une disparition (soumis à vérification auprès de l'admin). |
s

## 9. Échecs partiels et tableau de contrôle

Si une partie du passage échoue, les offres validées sont publiées. Le travail restant est conservé pour reprise et le passage est indiqué comme partiellement terminé. Une source défaillante ne bloque pas les autres.

Le tableau de contrôle est actualisé à l’issue du passage et indique :

- les offres découvertes, publiées, modifiées et retirées ;
- les cas à examiner et les divergences nécessitant une décision ;
- le résultat global du passage et les parties qui n’ont pas pu être couvertes.

Une notification interne est envoyée seulement lorsqu’une anomalie ou une décision nécessite l’intervention du fondateur.

## 10. Cas de vérification fonctionnelle

Ces cas serviront à contrôler la réalisation ; ils ne constituent pas des tests déjà exécutés.

| Cas | Résultat attendu |
|---|---|
| Une offre publiée il y a trois jours est découverte aujourd’hui | Inclusion possible par le rattrapage, avec sa date de publication réelle |
| Une annonce admissible ne comporte aucune date de publication | Mention « découverte le… », sans prétendre connaître son ancienneté |
| Un résultat de recherche est visible mais la source officielle est illisible | Piste à revérifier (soumis à vérification auprès de l'admin), sans publication fondée sur le seul extrait |
| Un contrat est seulement qualifié de CDD, sans caractère saisonnier établi | Pas de publication automatique comme contrat saisonnier (soumis à vérification auprès de l'admin) |
| Une offre admissible ne précise ni salaire ni logement | Publication possible, données « non précisées », (soumis à vérification auprès de l'admin) |
| Deux annonces du même employeur et du même métier concernent des périodes différentes | Maintien de deux offres distinctes |
| Le scan retrouve un ancien texte contredisant un logement confirmé par l’employeur | Correction préservée et divergence signalée + (soumis à vérification auprès de l'admin)|
| Une page encore accessible indique que le poste est pourvu | Retrait immédiat des résultats actifs + archivage |
| Le site d’un employeur est indisponible | Annonces maintenues à revérifier, sans fermeture générale |
| Une source échoue alors que d’autres ont fourni des offres valides | Publication des offres valides et passage signalé comme partiel |

## 11. V2 et choix techniques à effectuer

**V2 :** ajouter un scan par entreprise pour récupérer toutes ses offres ouvertes qui satisfont les critères, au-delà des fenêtres de découverte de la V1.

La conception technique devra déterminer les moyens de recherche et de collecte, la couverture des requêtes, les mécanismes d’extraction, de validation et de rapprochement, le stockage, l’orchestration, la reprise après erreur, l’hébergement et la gestion des accès nécessaires.

Aucun fournisseur, abonnement, langage, framework ou hébergement n’a été choisi par ce cadrage. Les moyens, le calendrier et l’évaluation de l’utilité du produit restent pilotés par le fondateur.
