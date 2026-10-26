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
