# Rendu-dev-docker-robin-matis-yohan-projet-groupe-du-fond
Rendu du projet dev avec docker de robin matis et yohan lors du cours de monsieur Guillemard, on est le groupe du fond.

## Feature libre (P3) — champs personnalisés pour les votants

Inspirée de la discussion Rallly [#201](https://github.com/lukevella/rallly/discussions/201)
(et de la proposition d'un commentaire d'y permettre des champs « dynamiques »).

- **Problème** : un organisateur a souvent besoin d'informations en plus du nom pour exploiter
  un sondage (société, régime alimentaire, numéro de téléphone…). Aujourd'hui il doit les demander
  dans la description, et la plupart des votants les oublient. Rallly ne sait exiger que l'e-mail,
  et cette exigence n'est **vérifiée que dans le navigateur**.
- **Périmètre** :
  - à la création (et dans les réglages), l'organisateur ajoute jusqu'à 5 champs : libellé,
    type (*texte*, *e-mail*, *liste de choix*), obligatoire ou non ;
  - les votants les remplissent dans le formulaire de vote ;
  - **validation côté serveur** (champ obligatoire, format e-mail, valeur présente dans la liste),
    plus vérification serveur de l'option existante « Exiger l'e-mail » ;
  - les réponses ne sont visibles **que par l'organisateur** (filtrées par l'API, pas seulement
    masquées dans l'interface) et sont ajoutées à l'export CSV ;
  - interface en anglais et en français.
- **Hors périmètre** : types avancés (date, nombre, choix multiple), modification des réponses
  après le vote, champs dans l'API REST publique.
- **Critère de démo** : créer un sondage avec « Société » (texte, obligatoire) et « Repas »
  (liste) ; voter en invité → le formulaire exige les champs ; appeler l'API sans « Société » →
  refus du serveur ; l'organisateur voit les réponses et les exporte en CSV ; un autre votant
  ne les voit pas.
