# Les quatre annonces de la landing

## État au 28 octobre 2026

**Design uniquement, à la demande du propriétaire.** Le bloc est placé entre la recherche et la FAQ. Il montre quatre exemples statiques du catalogue fictif local, avec la mention visible « Aperçu · annonces de démonstration ». Il n'interroge pas la base, ne calcule aucun classement et n'exécute aucune tâche planifiée.

Les cartes partagent les illustrations, catégories et repères saisonniers de l'application. Grille de quatre colonnes sur grand écran, deux sous 1 100 px et une sous 540 px. Les salaires sont mis en évidence, avec leur base nette mensuelle et la mention avant impôt. Une seule action « Explorer les offres » conduit au catalogue, via la connexion si nécessaire. Les exemples ne renvoient pas vers de fausses fiches.

Implémentation : `src/components/public/featured-offers.tsx` et son CSS Module.

## Comportement futur demandé — non implémenté

- Afficher les **quatre salaires nets mensuels les plus élevés**, choix confirmé par le propriétaire.
- Classer par borne basse décroissante pour les fourchettes. Conserver la fourchette complète à l'affichage. À égalité, publication la plus récente, puis identifiant stable.
- Retenir uniquement les annonces publiées et actives, avec un montant net mensuel exploitable. Exclure les salaires absents ou à confirmer. Ne convertir ni brut vers net, ni taux horaire/journalier/saisonnier vers mensuel.
- Recalculer la sélection toutes les 24 heures à **6 h GMT+1 fixe**, donc **5 h UTC**, y compris l'été. Ce choix ne signifie pas « 6 h Europe/Paris ».
- Prévoir un déclencheur Vercel à `0 5 * * *`, protégé par le secret cron existant. Le déclarer dans le registre des tâches administrables avec un compte rendu d'exécution, sans modifier la tâche d'expiration existante.
- Pour respecter le changement de journée même si le cron est retardé, recalculer aussi à la première lecture d'une sélection périmée après 5 h UTC. Stockage persistant partagé, traitement idempotent et protection contre les exécutions concurrentes.
- Ne conserver dans la sélection que des identifiants. Relire les données publiques autorisées à l'affichage : identité confidentielle masquée, aucun contact candidat/recruteur, aucune URL de candidature privée.
- Retirer immédiatement toute annonce dépubliée ou expirée, même entre deux renouvellements. Compléter avec la prochaine annonce admissible. S'il y en a moins de quatre, afficher le nombre réel ; ne pas fabriquer de cartes.
- Une fois raccordées, les cartes conduisent à leur fiche en conservant la destination après connexion. L'accès au détail continue de respecter les droits du rôle.
- Remplacer la mention de démonstration par une formulation exacte du classement et de sa dernière actualisation. Prévoir les états chargement, moins de quatre résultats, zéro résultat et indisponibilité temporaire.

La [documentation Vercel](https://vercel.com/docs/cron-jobs) précise que les horaires cron sont en UTC. La [précision dépend du forfait](https://vercel.com/docs/cron-jobs/usage-and-pricing) : le forfait Hobby peut déclencher dans l'heure, d'où le mécanisme de rattrapage à la lecture. Aucune configuration de déploiement n'a été modifiée pour cette fonctionnalité.

## Vérifications à prévoir au raccordement

Classement et égalités ; exclusion brut/unité différente/salaire inconnu ; fourchettes ; passage à 5 h UTC en hiver et en été ; retrait immédiat ; moins de quatre offres ; concurrence et répétition du cron ; secret absent/invalide ; absence de contacts ou d'identité masquée dans le HTML et les données RSC ; retour de connexion vers la bonne fiche.
