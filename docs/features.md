# Features ajoutées à Rallly

Chaque porteur écrit sa section. Le code ajouté se lit avec
`git diff rallly-import..main --stat -- app/rallly` ; chaque modification est repérée par
un commentaire `[projet]`.

## Catalogue #4 (P2) — expiration des sondages

Inspirée de la discussion Rallly [#134](https://github.com/lukevella/rallly/discussions/134)
(« Add (automatic) expiry option »).

- **Problème** : Rallly ne ferme un sondage que lorsque toutes ses dates sont passées, ou à la
  main. L'organisateur ne peut pas dire « je veux les réponses avant vendredi 18 h ». La colonne
  `deadline` existe dans le schéma, héritée d'une ancienne version, mais aucun code ne
  l'utilise.
- **Périmètre** :
  - à la création et dans les réglages, l'organisateur choisit une **date limite** facultative
    (refusée si elle est déjà passée à la création) ;
  - les votants voient « Réponses acceptées jusqu'au … » dans l'en-tête du sondage ;
  - après l'échéance, l'**API refuse** les nouveaux votes, la modification d'un vote et les
    invitations par e-mail. La règle est évaluée à chaque requête : elle tient même si aucune
    tâche planifiée ne tourne ;
  - l'interface affiche le sondage comme fermé, avec un badge « Expiré » ;
  - la tâche de maintenance existante `auto-close-polls` ferme aussi en base les sondages
    expirés (`closedReason: auto`) ;
  - repousser ou retirer la date rouvre un sondage fermé par l'échéance, s'il lui reste des
    dates à venir ;
  - interface en anglais et en français.
- **Hors périmètre** : suppression automatique (Rallly supprime déjà les sondages inactifs),
  rappel par e-mail avant l'échéance. Les commentaires restent ouverts, comme sur un sondage
  fermé dans Rallly.
- **Aucune migration** : la colonne `polls.deadline` existe déjà.

### Fichiers

| Fichier | Rôle |
|---|---|
| `features/poll/utils.ts` (+ `utils.test.ts`) | `isPollExpired`, `isPollAcceptingResponses`, conversion `datetime-local` |
| `trpc/routers/polls.ts` | `deadline` à la création, à la modification et en lecture ; réouverture |
| `trpc/routers/polls/participants.ts`, `polls/utils.ts` | Refus du vote et de la modification de vote |
| `features/poll/invite/mutations.ts` | Refus des invitations |
| `features/poll/mutations.ts` | `autoClosePolls` ferme aussi les sondages expirés |
| `features/poll/client.tsx` | Même règle côté client (formulaire de vote masqué) |
| `features/poll/components/poll-deadline.tsx`, `event-card.tsx`, `responsive-results.tsx` | Affichage |
| `features/poll/components/forms/poll-settings.tsx` (+ création, réglages) | Champ « Date limite » |

### Démo (1 min 15)

1. Créer un sondage avec une date limite dans 2 minutes : l'en-tête affiche
   « Réponses acceptées jusqu'au … ».
2. Voter en invité : accepté.
3. Après l'échéance, recharger la page : « Fermé — la date limite de ce sondage est
   dépassée », badge « Expiré », plus de formulaire de vote.
4. Appel API forgé (le vote rejoué depuis l'onglet Réseau du navigateur) : refusé par le
   serveur (`This poll has expired and no longer accepts responses`).
5. Dans les réglages, repousser la date : le sondage accepte de nouveau les votes.

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
