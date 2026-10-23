# Job-board saisonnier — Cahier des charges du scan V1

**Statut : cadrage initial validé le 21 octobre 2026, révisé selon les arbitrages du fondateur du 23 octobre 2026. Le plan technique et la mise en service restent à réaliser.**

Ce document complète le [cahier des charges du job-board V1](./cahier-des-charges-job-board-saisonnier-v1.md). Il décrit le fonctionnement à réaliser ; aucun scan n’est développé ni programmé par ce document. Les choix techniques, notamment le rôle éventuel de l’IA, feront l’objet du plan technique détaillé.

**Dernier arbitrage du 23 octobre 2026 :** le fondateur demande un [plan technique progressif du scan, V1 à V5](./plan-technique-scan-v1-v5.md). La V1 doit fournir au moins 50 nouvelles annonces distinctes à vérifier par l’admin, en moins de six heures suivant l’installation et le lancement initial, avec zéro frais de services supplémentaires hors Vercel. Ce délai ne comprend ni le développement ni la vérification humaine ; aucune publication n’est requise pour atteindre l’objectif. Le premier remplissage peut inclure des annonces plus anciennes que 72 heures, sans signal explicite de clôture ; cette exception ne s’applique pas aux passages quotidiens suivants. L’admission en file et les critères minimums de publication sont distincts.

## 1. Objectif et périmètre

Découvrir chaque jour sur le Web des offres provenant directement des employeurs, les qualifier, les publier lorsqu’elles satisfont les critères.

La recherche vise une couverture large. Elle ne promet pas de trouver immédiatement toutes les annonces publiées sur Internet. Un doute sur un critère obligatoire place l’annonce dans la file de prévalidation de `/admin`, sans publication préalable. Les informations facultatives suivent les règles du §5.

| Dimension | Décision |
|---|---|
| Territoire des postes | France, avec localisation exploitable par région et département |
| Secteurs | Tourisme et hôtellerie de loisirs |
| Contrats | Explicitement saisonniers uniquement |
| Saisons | Été et hiver. Priorité aux annonces les plus récentes et aux recrutements urgents |
| Métiers | Tous les métiers des établissements concernés, y compris maintenance, espaces verts, transport et autres fonctions support s’ils sont explicitement et contractuellement saisonniers |
| Langues des annonces | Français |
| Sources de découverte | Toutes les catégories de sources sont admissibles. Priorité à Indeed, France Travail, LinkedIn et aux autres job-boards ou agrégateurs, puis aux sites officiels et portails de recrutement des employeurs, enfin aux moteurs de recherche. Les accès réellement disponibles, notamment API ou MCP, seront étudiés dans le plan technique. |

Les job-boards et agrégateurs servent uniquement à la découverte. La publication nécessite de retrouver une source officielle de l’employeur ; aucun lien public de source ou de candidature ne doit renvoyer vers un job-board ou un agrégateur.

Le téléphone ou l’email de candidature constitue le parcours privilégié. Une offre proposant uniquement un formulaire officiel reste admissible et porte le badge coloré « Candidature externe », selon le §6. Un portail de recrutement officiellement utilisé par l’employeur est admissible pour ce parcours, à condition de mener à son recrutement sans détour par un job-board.

## 2. Déroulement général

Le scan de découverte comporte une seule opération quotidienne : découvrir des annonces, établir leur provenance, vérifier leur admissibilité et publier ou soumettre à examen.

Les offres conformes peuvent être publiées automatiquement hors de la campagne initiale de vérification. Cette campagne initiale alimente la file admin, y compris avec des dossiers complets, sans publication automatique. Les situations ambiguës restent présentées au fondateur dans la file de vérification lors des autres passages.

**Collecte asynchrone et revue au fil de l’eau :** chaque dossier exploitable est enregistré et rendu accessible à l’admin dès qu’il est prêt, pendant que le scan continue en arrière-plan. L’admin peut commencer sa vérification, le corriger, le valider ou le rejeter sans attendre la fin du passage, l’arrivée des 50 annonces ou l’échéance des six heures. Le fil se rafraîchit automatiquement sans perdre la saisie ni remplacer le dossier ouvert. La collecte continue même si l’admin ferme l’écran ; les dossiers déjà livrés restent accessibles si une autre source échoue.

1. Les doublons sont traités manuellement par l’admin. Le scan ne fusionne pas automatiquement des annonces distinctes (§7).
2. Le contrôle des annonces déjà publiées relève entièrement d’un autre cron : vérification des URL, modifications, retraits et échéances dépassées. Le §8 consigne les règles destinées à ce chantier ; ce contrôle ne fait pas partie du scan de découverte.
3. Le parcours exhaustif récurrent des offres ouvertes de chaque entreprise est prévu dans une V2, avec un autre cron. Le remplissage initial de la V1 peut consulter un ensemble limité de sources employeurs pour atteindre son objectif, selon l’exception du §3.

## 3. Calendrier et fenêtres de découverte

| Passage | Règle |
|---|---|
| Scan quotidien | Rechercher les nouveautés dans les 72 heures précédant le début du passage |
| Heure cible | Vers 3 h, selon le fuseau Europe/Paris |
| Premier lancement | Remplissage initial déclenché immédiatement, sans attendre le cron nocturne ; offres encore actives admissibles même si leur publication est antérieure à 72 heures |
| Reprise des passages quotidiens après interruption | Même fenêtre de 72 heures ; aucun élargissement pour couvrir toute la période manquée |

Pour les passages quotidiens, la fenêtre est fixée au début de chaque passage, borne de début incluse. Elle permet de récupérer une annonce publiée quelques jours auparavant mais découverte plus tard. Une telle annonce conserve sa véritable date de publication lorsqu’elle est disponible. Elle n’est pas présentée comme publiée le jour de sa découverte.

Le remplissage initial est une campagne unique, suivie séparément, avec un objectif d’au moins 50 nouveaux dossiers distincts exploitables pour la revue avant six heures. Il conserve également les vraies dates de publication. Une reprise technique de cette campagne réutilise son avancement ; un redéploiement, une réactivation du cron ou un passage quotidien ne déclenche pas automatiquement un nouveau remplissage élargi. Une annonce explicitement close ou dont l’échéance est dépassée ne compte pas dans l’objectif. Les critères minimums devront être établis avant toute publication ultérieure.

Un dossier livré doit présenter un intitulé, une URL de découverte précise, la date de collecte, du texte utile ou des données extraites, des indices documentés de pertinence pour le périmètre et les points restant à vérifier. La source officielle employeur, la période ou le canal de candidature peuvent encore manquer ; ces lacunes sont explicites et bloquent la publication, pas la remise du dossier à l’admin. Une annonce découverte sur France Travail peut donc alimenter cette file sans devenir publiable sur la seule foi de France Travail. Cela ne présume pas de l’accès automatisé autorisé à ce site.

Les simples liens sans contenu exploitable, les annonces manifestement hors périmètre, les doublons connus et les dossiers déjà présents sont exclus du compteur. Les suggestions de métiers et alertes ne sont pas des annonces supplémentaires. Le compteur cumule les dossiers admissibles devenus accessibles à la revue, indépendamment du stock encore en attente et du nombre publié ; l’admin peut commencer dès le premier dossier ou revenir plus tard. L’instant d’atteinte du seuil doit être strictement antérieur à la fin des six heures. Ce délai est un objectif de volume, jamais une durée d’attente avant de rendre les dossiers visibles.

Lorsque la source indique seulement une date sans heure, une date dont le jour civil recoupe la fenêtre reste admissible. La précision de la source est conservée, sans inventer d’heure. Les dates sont interprétées dans le fuseau de la source lorsqu’il est connu, sinon dans Europe/Paris.

Une annonce sans date de publication peut être admise si les critères minimums sont établis et si le recrutement reste pertinent pour la saison concernée. Elle est signalée comme « découverte le… ». Son inclusion ne prouve pas qu’elle a été publiée dans les dernières 24 heures.

La fenêtre de découverte n’est pas une durée de vie des fiches : une offre déjà publiée n’est pas retirée simplement parce qu’elle devient plus ancienne que cette fenêtre.

L’heure exacte pourra être ajustée après mesure de la durée du scan. Le fuseau de référence reste Europe/Paris, indépendamment du lieu où se trouve le fondateur. Le jour de parution importe davantage que l’heure exacte.

## 4. Provenance et accès à la source

Une nouvelle source peut être validée automatiquement lorsque son caractère officiel est établi : site de l’employeur ou portail de recrutement relié depuis son site officiel. Un nom de marque dans une URL ne suffit pas ; dans ce cas, une vérification admin est nécessaire avant publication.

Si le lien avec l’employeur reste incertain, le résultat est soumis à vérification par l’admin avant publication.

Un extrait de moteur de recherche ou une annonce sur un job-board constitue une piste, pas une source suffisante pour publier. Il faut pouvoir consulter une source officielle assez complète pour établir les informations minimums et le moyen de candidature. Si cette consultation échoue, la piste reste dans la file de prévalidation, sans publication.

Le contenu repris comprend des informations structurées, un résumé fidèle des missions et conditions, le lien vers la source officielle et le canal de candidature. Le lien de découverte sur un job-board ou un agrégateur peut être conservé pour la traçabilité interne. La reprise doit tenir compte des conditions de réutilisation de la source. Les montants, dates et conditions importants doivent conserver leur sens exact.

## 5. Qualification et publication

### Informations minimums

La publication nécessite :

- une entreprise identifiable et une provenance officielle établie ;
- un contrat explicitement saisonnier ;
- un lieu précis ;
- une période ou une durée ;
- un téléphone ou un email de candidature utilisable ; à défaut, un formulaire officiel utilisable avec le badge « Candidature externe » (§6) ;
- aucune indication explicite de poste pourvu ni d’échéance déjà dépassée au sens des règles de retrait.

Les cas incertains concernant le contrat, le lieu, la période ou durée, la provenance ou le canal de candidature restent invisibles aux candidats jusqu’à validation par l’admin. La validation doit établir les critères minimums ; elle ne dispense pas de leur respect.

### Informations complémentaires

Les informations disponibles sont structurées pour alimenter les fiches et les filtres : rémunération, logement, repas, expérience, langues, horaires, permis, accueil des couples et des animaux, et autres conditions documentées.

- Une donnée absente reste « non précisé », jamais « non » par défaut.
- Le salaire conserve sa valeur, sa qualification net/brut et son unité d’origine.
- Le net mensuel avant impôt est affiché lorsqu’il est fourni par l’employeur ; à défaut, le brut disponible est conservé.
- Aucune conversion silencieuse du brut en net ou d’un montant horaire en montant mensuel n’est autorisée.
- Logement et repas sont distingués, avec les conditions renseignées à la source.
- Un logement simplement possible n’est pas présenté comme confirmé.
- Une donnée inconnue ou à confirmer ne satisfait pas un filtre exigeant une condition établie.

L’absence de salaire ou de conditions pratiques ne bloque pas une annonce et ne nécessite pas d’intervention admin obligatoire : les champs concernés sont affichés « non précisé ».

Les informations complémentaires documentées qui ne correspondent à aucun champ prévu sont ajoutées dans un champ « Divers » de l’annonce.

### Contradictions dans la source

| Nature du conflit | Traitement |
|---|---|
| Champ obligatoire, par exemple dates incompatibles avec la durée | Publication suspendue jusqu’à vérification par admin |
| Champ facultatif, par exemple deux salaires différents | Publication des éléments fiables, mention « à confirmer » pour le champ concerné et signalement admin non bloquant. La valeur incertaine n’est pas utilisée pour satisfaire les filtres. |

Le scan ne choisit pas arbitrairement entre deux valeurs contradictoires.

### Suggestions de métiers et de familles

Lorsqu’une offre entre dans le périmètre saisonnier mais que son métier ou sa famille de métiers n’existe pas dans le référentiel, le scan ajoute une entrée de type « Suggestion » dans la file de vérification admin. Il ne crée ni métier ni famille automatiquement.

La suggestion précise ce qui manque — métier, famille ou les deux — et présente l’intitulé original, le contexte utile de l’annonce, le lien vers la source officielle et les offres concernées. Un rattachement proposé est présenté comme une suggestion à valider, sans inventer de classification certaine.

L’admin peut créer l’entrée manquante, rattacher le métier à une famille existante, associer l’offre à un métier déjà présent ou rejeter la suggestion. La décision est conservée. Une même suggestion déjà enregistrée est réutilisée lors des passages suivants ; le scan ne recrée pas chaque jour une suggestion rejetée ou déjà traitée sans élément nouveau.

Le classement dans le référentiel n’étant pas un critère minimum de publication, cette suggestion ne bloque pas une offre autrement admissible. L’intitulé source reste affiché ; aucun rattachement incertain ne permet de satisfaire un filtre métier. Après validation du rattachement, les offres concernées peuvent alimenter les filtres correspondants. Un doute sur le caractère saisonnier ou sur le secteur suit en revanche la prévalidation bloquante du §5.

Valider une suggestion de référentiel ne vaut pas validation humaine de l’annonce pour publication et n’attribue donc pas à lui seul le label « Vérifiée par un humain ».

## 6. Contacts et annonces regroupées

Le téléphone ou l’email doit être explicitement utilisable pour candidater, d’après l’annonce ou une autre page officielle de recrutement de l’employeur. Sa provenance officielle est vérifiée ; cette consultation ne signifie pas qu’une personne a répondu ni que le contact a été confirmé personnellement.

| Canal établi | Publication et présentation |
|---|---|
| Téléphone ou email de candidature disponible | Publication possible ; le contact direct est présenté en priorité. Un formulaire officiel peut être proposé en complément. |
| Formulaire officiel comme seul canal de candidature | Publication possible sans téléphone ni email ; badge coloré « Candidature externe » visible sur la carte de résultat et la fiche, avant l’ouverture du formulaire. |
| Formulaire comme seul canal, sur un portail externe officiellement utilisé par l’employeur | Même exception, avec le badge « Candidature externe », si le rattachement à l’employeur est établi. |
| Seul canal disponible sur un job-board ou un agrégateur, ou aucun canal établi | Pas de publication ; piste conservée dans la file de prévalidation pour recherche d’un canal admissible. |

Le badge « Candidature externe » renseigne le mode de candidature. Il est indépendant des labels de provenance et de validation du §7, et son attribution est gratuite.

Un contact général trouvé sur le site officiel peut être proposé en complément. Son rôle est explicite, par exemple « accueil de l’établissement ». Il n’est pas présenté comme un contact RH et ne remplace pas, à lui seul, la vérification d’un canal de candidature utilisable.

Pour une annonce regroupant plusieurs métiers ou lieux :

- séparer les fiches seulement lorsque les associations métier–lieu–période sont explicites ;
- pour un même poste proposé dans plusieurs lieux clairement listés, conserver une fiche avec plusieurs localisations ;
- soumettre les associations ambiguës à prévalidation, sans inventer de combinaisons.

## 7. Dates, doublons et modifications

Conserver distinctement :

- la date de publication par l’employeur, lorsqu’elle est connue ;
- la date de première découverte par le scan ;
- la date du dernier contrôle réussi ;
- les dates du contrat et l’éventuelle date limite de candidature.

La nouveauté est présentée à partir de la publication lorsqu’elle est connue ; sinon, employer explicitement « découverte le… ». Une date de début de contrat ou une simple mise à jour ne doit pas être confondue avec la publication initiale.

Les doublons sont traités manuellement par l’admin : rapprochement, fusion éventuelle ou conservation de fiches distinctes. Aucun rapprochement automatique entre plusieurs URL ou entre une annonce collectée et une annonce déposée par un employeur n’autorise une fusion ou un écrasement. Les doublons potentiels identifiés sont présentés dans la file de vérification ; une nouvelle fiche suspectée de faire doublon attend la décision de l’admin avant publication.

La redécouverte d’une piste déjà enregistrée pour le même recrutement réutilise son dossier, sans créer une nouvelle fiche ni une nouvelle demande de vérification pour ce seul motif. Une URL ne suffit pas à identifier un recrutement : une même page peut regrouper plusieurs postes ou être réutilisée pour une autre saison. Des recrutements pour des périodes distinctes restent séparés, même si l’employeur, le métier et le lieu sont identiques.

Le scan de découverte ne met pas automatiquement à jour une annonce déjà publiée. Les changements observés sont transmis au traitement de contrôle distinct ou signalés à l’admin. Les corrections confirmées directement auprès de l’employeur par le fondateur sont préservées ; une divergence avec la source est signalée sans écrasement silencieux. Les règles d’actualisation des autres champs relèvent du cron de contrôle.

Une nouvelle découverte ne remet pas automatiquement en ligne une annonce retirée ou archivée. Un retrait volontaire du fondateur reste applicable jusqu’à une décision explicite de remise en ligne.

L’employeur qui souhaite compléter, corriger ou retirer une annonce collectée contacte le fondateur directement. Aucun accès autonome de revendication ou de modification d’annonce collectée n’est ajouté à la V1.

### Labels

| Label | Règle d’attribution |
|---|---|
| « Sourcée sur internet » | Annonce collectée publiée automatiquement par le scan, sans validation humaine de publication. |
| « Vérifiée par un humain » | Annonce en attente dans la file de vérification que l’admin valide explicitement pour publication, avec ou sans modification de son contenu. Cette validation est datée. |
| « Recruteur vérifié » | Label attribué à tous les employeurs inscrits sur l’application, selon le choix du fondateur. Il est présenté avec leurs annonces déposées dans l’application. |

La validation humaine remplace le label d’affichage « Sourcée sur internet », tout en conservant la provenance collectée et son historique. Une simple modification sans validation de publication ne suffit pas à attribuer le label humain.

Le label « Recruteur vérifié » est attribué au compte employeur ; il ne transforme pas automatiquement une annonce collectée en annonce déposée par cet employeur. Il ne dispense pas de la vérification du déposant et de son lien avec l’entreprise exigée avant publication par le cahier des charges général.

Les labels ci-dessus et le badge « Candidature externe » ne constituent pas une mise en avant payante. Celle-ci relève d’un chantier séparé (§11).

## 8. Maintien et retrait — règles destinées au cron de contrôle séparé

Cette section décrit les règles fonctionnelles du contrôle des annonces déjà publiées. Leur exécution relève entièrement d’un autre cron et d’un plan distinct. Sa fréquence, sa date de mise en service et la définition opérationnelle des deux passages de confirmation restent à préciser dans ce chantier. « Retrait immédiat » signifie dès la détection du signal de clôture par ce contrôle.

| Situation observée | Action |
|---|---|
| Offre toujours présente, sans signal explicite de clôture ni échéance dépassée | Maintien dans le catalogue actif |
| Source indiquant explicitement un poste pourvu ou une offre expirée | Retrait immédiat des résultats actifs + archivage |
| Date limite de candidature ou date de fin de contrat dépassée | Retrait des résultats actifs, même si la page reste en ligne + archivage |
| Date de début de contrat dépassée, sans autre signal de clôture | Pas de retrait sur ce seul motif ; signalement admin sans retrait automatique. |
| Première disparition confirmée | Maintien à revérifier ; nouvelle vérification nécessaire et signalement admin. |
| Disparition confirmée lors de deux passages | Retrait des résultats actifs + archivage |
| Échec de collecte, problème d’accès ou panne du site | Maintien à revérifier ; ne pas assimiler l’échec à une disparition ; signalement admin. |

## 9. Échecs partiels et tableau de contrôle

Si une partie du passage échoue, les offres validées sont publiées. Le travail restant est conservé pour reprise et le passage est indiqué comme partiellement terminé. Une source défaillante ne bloque pas les autres. Reprendre une piste déjà découverte ou une validation en attente ne déclenche pas une recherche historique au-delà de la fenêtre du prochain passage.

Le tableau de contrôle et le fil de vérification sont actualisés automatiquement pendant le passage, au fur et à mesure des dossiers enregistrés. Un bilan final les complète à l’issue du passage. Ils indiquent :

- les pistes découvertes, les dossiers exploitables livrés pour vérification et, séparément, les offres publiées par ce scan ;
- pour la campagne initiale, la progression vers 50 dossiers et l’instant d’atteinte du seuil avant six heures ;
- les cas à examiner et les divergences nécessitant une décision ;
- les suggestions de métiers et de familles à examiner ;
- le résultat global du passage et les parties qui n’ont pas pu être couvertes.

Les modifications et retraits exécutés par le cron de contrôle seront suivis dans le compte rendu de ce cron, distinct du passage de découverte.

Une notification interne est envoyée seulement lorsqu’une anomalie ou une décision nécessite l’intervention du fondateur.

## 10. Cas de vérification fonctionnelle

Ces cas serviront à contrôler la réalisation ; ils ne constituent pas des tests déjà exécutés.

| Cas | Résultat attendu |
|---|---|
| Une offre horodatée exactement 72 heures avant le début du passage est découverte | Inclusion possible, avec sa date de publication réelle |
| Premier lancement du scan | Campagne initiale immédiate, annonces plus anciennes admises sans signal de clôture, dates originales préservées et au moins 50 dossiers distincts exploitables pour la revue avant six heures |
| Le dossier initial est complet et paraît publiable | Présentation dans la file admin ; pas de publication automatique pendant cette campagne |
| Un dossier pertinent contient du texte utile mais sa période ou sa source officielle reste à établir | Compté comme livré pour vérification ; publication bloquée tant que les minimums ne sont pas établis |
| L’admin n’est pas connecté pendant les six premières heures | Livraison et compteur indépendants de sa présence ; aucune validation humaine requise pour atteindre la cible |
| Le premier dossier est prêt alors que les autres sont encore en cours de collecte | Apparition au prochain rafraîchissement automatique du fil ; vérification et décision possibles immédiatement, sans attendre 50 dossiers ni six heures |
| Une nouvelle annonce arrive pendant la saisie d’une correction | Fil et compteurs actualisés sans remplacer le dossier ouvert ni perdre la saisie |
| L’admin commence la revue avant la fin de la collecte | Le cumul des dossiers livrés reste distinct du stock en attente et des publications ; une reprise du scan n’écrase pas ses corrections ou décisions |
| L’admin ferme l’écran ou une autre source échoue | Collecte indépendante de la présence de l’admin ; dossiers déjà livrés conservés, accessibles et traitables |
| Passage quotidien après le remplissage initial | Fenêtre habituelle de 72 heures ; aucune répétition implicite du remplissage élargi |
| Le scan reprend après cinq jours d’arrêt | Recherche limitée aux dernières 72 heures, sans rattrapage des cinq jours |
| Une annonce admissible ne comporte aucune date de publication | Mention « découverte le… », sans prétendre connaître son ancienneté |
| Un résultat de recherche est visible mais la source officielle est illisible | Piste en prévalidation, sans publication fondée sur le seul extrait |
| Un contrat est seulement qualifié de CDD, sans caractère saisonnier établi | Prévalidation, sans publication tant que le caractère saisonnier n’est pas établi |
| Une offre admissible ne précise ni salaire ni logement | Publication possible, données « non précisées », sans intervention admin obligatoire |
| Une source donne deux salaires contradictoires | Publication des éléments fiables, salaire « à confirmer », exclusion des filtres de salaire exigeant une valeur établie et signalement admin |
| Une offre saisonnière admissible mentionne un métier absent du référentiel | Suggestion admin avec le contexte et la source ; aucune création automatique ; publication possible avec l’intitulé source, sans rattachement incertain dans les filtres |
| Le métier découvert ne correspond à aucune famille existante | Suggestion de nouvelle famille ou de rattachement à examiner par l’admin, sans création automatique |
| L’admin reconnaît dans la suggestion un métier déjà présent sous un autre intitulé | Rattachement au métier existant, sans création d’un doublon de référentiel |
| Une suggestion déjà traitée est retrouvée sans élément nouveau | Conservation de la décision, sans nouvelle entrée quotidienne dans la file |
| L’admin valide uniquement une suggestion de métier | Mise à jour du classement des offres concernées, sans attribution automatique du label « Vérifiée par un humain » |
| Une offre ne propose qu’un formulaire officiel de candidature | Publication possible avec le badge coloré « Candidature externe » |
| Seul un formulaire de candidature sur un job-board est disponible | Prévalidation, sans publication tant qu’un canal admissible n’est pas trouvé |
| Un téléphone général d’accueil et un formulaire officiel de candidature sont disponibles | Le téléphone reste un contact complémentaire ; le formulaire reste le canal de candidature et le badge « Candidature externe » est affiché |
| Une piste déjà enregistrée pour le même recrutement revient au passage suivant | Réutilisation du dossier existant, sans nouvelle fiche ni nouvelle entrée de revue due à cette seule redécouverte |
| Deux annonces distinctes semblent correspondre au même recrutement | Décision manuelle de l’admin, aucune fusion automatique |
| Le scan retrouve un recrutement déjà déposé dans l’application | Rapprochement éventuel soumis à l’admin, sans écraser l’annonce déposée |
| Deux annonces du même employeur et du même métier concernent des périodes différentes | Maintien de deux offres distinctes |
| Le scan retrouve un ancien texte contredisant un logement confirmé par l’employeur | Correction préservée et divergence signalée à l’admin |
| Le scan retrouve une annonce retirée volontairement par le fondateur | Aucune remise en ligne automatique |
| L’admin valide pour publication une annonce de sa file sans modifier son texte | Attribution du label « Vérifiée par un humain » et conservation de la date de validation |
| Une annonce avec formulaire seul est validée par l’admin | Présence du label « Vérifiée par un humain » et du badge « Candidature externe » |
| Un employeur s’inscrit | Attribution du label « Recruteur vérifié » au compte ; les conditions de publication restent applicables |
| Une source échoue alors que d’autres ont fourni des offres valides | Publication des offres valides et passage signalé comme partiel |

Les cas de contrôle suivants appartiennent au chantier séparé du §8 :

| Cas | Résultat attendu du cron de contrôle |
|---|---|
| Une page encore accessible indique que le poste est pourvu | Retrait des résultats actifs et archivage dès la détection |
| Une date limite de candidature ou de fin de contrat est dépassée | Retrait des résultats actifs et archivage |
| Le site d’un employeur est indisponible | Annonces maintenues à revérifier, sans fermeture générale |

## 11. Chantiers séparés, V2 et choix techniques à effectuer

**Contrôle des annonces publiées :** cron et plan distincts, avec les règles consignées au §8. Sa fréquence et sa date de mise en service seront fixées dans ce chantier.

**Mise en avant payante :** chantier séparé du scan et de son prochain plan technique. Le principe retenu comprend des badges visuels supplémentaires, par exemple « Urgent », une présence sur la landing page et une priorité dans les résultats de recherche. Cette priorité s’applique parmi les annonces satisfaisant les filtres et les règles de visibilité. Les tarifs, la durée, le paiement et les modalités d’affichage seront définis dans ce chantier.

**V2 du scan :** ajouter un scan récurrent par entreprise pour récupérer toutes ses offres ouvertes qui satisfont les critères, au-delà des fenêtres de découverte quotidiennes de la V1. La campagne initiale limitée de la V1 constitue l’exception définie au §3. Les cinq niveaux proposés sont décrits dans le [plan technique V1–V5](./plan-technique-scan-v1-v5.md) ; ils ne désignent pas les versions de l’application entière.

La conception technique devra déterminer les moyens de recherche et de collecte, la couverture des requêtes, les mécanismes d’extraction et de validation, l’aide à la revue manuelle des doublons, les suggestions de métiers et de familles, le stockage, l’orchestration, la reprise après erreur, l’hébergement et la gestion des accès nécessaires. Elle devra préciser le rôle éventuel de l’IA sans modifier les critères de publication ni remplacer les décisions réservées à l’admin.

Le plan devra adapter l’intégration existante : préserver les retraits et corrections humaines, distinguer les dates de publication et de découverte, permettre plusieurs fiches issues d’une même page et plusieurs localisations sur une fiche. L’import actuel ne peut pas être raccordé au scan sans ces adaptations.

Aucun fournisseur ni abonnement de collecte ou d’IA n’est choisi par ce cadrage. Le plan tiendra compte de la stack déjà en place dans l’application. Les moyens, le calendrier et l’évaluation de l’utilité du produit restent pilotés par le fondateur.
