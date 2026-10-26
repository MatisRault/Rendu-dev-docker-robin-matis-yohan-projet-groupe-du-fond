# Features ajoutées à Rallly

Une section par feature, rédigée par son porteur. Tout le code est dans `app/rallly/` ;
`git diff rallly-import -- app/rallly` montre l'ensemble de nos modifications.

## Champs personnalisés pour les votants (libre) — Robin (P3)

- **Problème / issue Rallly d'origine** : [discussion #201](https://github.com/lukevella/rallly/discussions/201).
  L'organisateur ne peut demander aux votants que leur nom (et éventuellement leur e-mail). Pour organiser un
  événement, il a souvent besoin d'autre chose : société, régime alimentaire, taille de t-shirt…
- **Périmètre** :
  - à la création ou dans les réglages d'un sondage, l'organisateur ajoute jusqu'à **5 champs** : texte libre,
    e-mail ou liste de choix, chacun obligatoire ou non ;
  - le votant les remplit dans le formulaire de vote ;
  - les réponses ne sont visibles **que par l'organisateur** (bouton à côté de chaque participant) et
    sont ajoutées en colonnes à l'**export CSV** ;
  - interface traduite en français et en anglais ;
  - hors périmètre : modifier ses réponses après le vote, champs numériques ou dates, statistiques sur les réponses.
- **Implémentation** ([PR #5](https://github.com/MatisRault/Rendu-dev-docker-robin-matis-yohan-projet-groupe-du-fond/pull/5)) :
  - *Schéma Prisma* : `Poll.customFields` (JSON, la définition des champs) et `Participant.customAnswers`
    (JSON, les réponses), migration `20261026120000_custom_participant_fields` (deux colonnes avec valeur
    par défaut : sans impact sur les sondages existants) ;
  - *API (tRPC)* : `polls.make`, `polls.modify`, `polls.get` et `polls.duplicate` gèrent les champs ;
    `polls.participants.add` **revalide côté serveur** (champ obligatoire, format e-mail, choix dans la liste,
    réponses à des champs inconnus ignorées, tailles bornées) ; `participants.list` ne renvoie les réponses
    qu'à l'organisateur ;
  - *Validation* : `apps/web/src/features/poll/custom-fields/` (schémas zod partagés client/serveur,
    12 tests unitaires vitest) ;
  - *UI* : éditeur de champs dans les réglages du sondage, champs dans la fenêtre de vote, popover des
    réponses (vues bureau et mobile), colonnes CSV.
  - Au passage : l'option « Exiger l'e-mail des participants » n'était vérifiée que dans le navigateur ;
    elle l'est maintenant aussi côté serveur.
- **Démo (1 min)** :
  1. Créer un sondage, ajouter les champs « Société » (texte, obligatoire) et « Repas » (liste : Végétarien, Standard) ;
  2. Ouvrir le lien d'invitation en navigation privée, voter sans remplir « Société » → refusé ; le remplir → accepté ;
  3. Revenir en organisateur : bouton « réponses » à côté d'Alice, puis export CSV avec les colonnes Société et Repas.
  <!-- TODO P3 : captures -->
- **Limites** :
  - les réponses sont stockées en JSON : pas de requête SQL ou de statistique par champ ;
  - supprimer un champ masque ses réponses (elles restent en base) ;
  - un votant ne peut pas modifier ses réponses une fois son vote envoyé.
