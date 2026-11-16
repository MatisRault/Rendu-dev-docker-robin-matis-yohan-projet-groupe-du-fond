# Plan de tests — balayage avant soutenance

Ce document sert à **rejouer** la validation complète, par quelqu'un d'autre que
celui qui a écrit le code. Chacun remplit la colonne **Résultat** des lignes de son
périmètre, dans une PR, en datant.

- ✅ conforme · ❌ écart · ⏭️ non applicable (dire pourquoi)
- Un écart ne se corrige pas en silence : on remplit la ligne, **puis** on corrige.

> **Ce que le smoke test couvre déjà** (`bash scripts/smoke-test.sh <domaine>`) :
> Authentik prêt, découverte OIDC servie, Rallly répond, Rallly joint Authentik,
> connexion par e-mail refusée, aucune base exposée. Les tests ci-dessous ciblent
> **ce qu'il ne peut pas voir** : l'interface, les policies, les règles métier et la
> reproductibilité.

---

## A. Démarrage à froid — le test qui compte le plus

L'exigence du sujet est qu'un poste vierge y arrive. **À faire sur une machine qui
n'a jamais ouvert le projet**, ou au minimum après un `reset` complet.

| # | Test | Comment | Attendu | Porteur | Résultat |
|---|---|---|---|---|---|
| A1 | Clone et démarrage | `git clone` puis `./stack.sh env && ./stack.sh up` | Les 9 services montent sans intervention | P1 | |
| A2 | Délai de disponibilité | chronométrer jusqu'à ce que `auth` et `rallly` répondent | **< 3 min** (Authentik met 1 à 2 min) | P1 | |
| A3 | État des services | `./stack.sh ps` | 8 `healthy`, `ca-export` `Exited (0)` | P1 | |
| A4 | Config valide | `docker compose config -q` | code 0, aucune sortie | P1 | |
| A5 | Après `reset` | `./stack.sh reset` (à taper par un humain) puis `up` | tout remonte, démo rejouable | P1 | |

⚠️ A5 efface les données : à faire **en local**, jamais sur la VM.

## B. Exposition réseau et durcissement

| # | Test | Comment | Attendu | Porteur | Résultat |
|---|---|---|---|---|---|
| B1 | Ports publiés | `docker compose ps` | **seul** `caddy` publie, et uniquement 80 et 443 | P1 | |
| B2 | Liaison de l'écoute | `grep HTTP_BIND .env` | `127.0.0.1` en local, `0.0.0.0` sur la VM | P1 | |
| B3 | Base inaccessible | `psql -h <hôte> -p 5432` depuis l'extérieur | connexion refusée | P1 | |
| B4 | Réseaux internes | `docker compose config \| grep -A1 internal` | `mail`, `authentik_backend`, `rallly_backend` à `true` | P1 | |
| B5 | Pas d'egress interne | `docker compose exec rallly-db ping -c1 1.1.1.1` | **échec** (réseau `internal`) | P1 | |
| B6 | Utilisateurs effectifs | `docker top <conteneur>` sur les 9 | conforme au tableau de `securite.md` §1 | P1 | |
| B7 | `read_only` | `docker inspect -f '{{.HostConfig.ReadonlyRootfs}}'` | `true` sur les 9 | P1 | |
| B8 | Capabilities | `docker inspect -f '{{.HostConfig.CapDrop}}'` | `[ALL]` partout | P1 | |
| B9 | Redirection HTTP | `curl -s -o /dev/null -w '%{http_code}' http://rallly.<domaine>/` | **308** | P1 | |
| B10 | Émetteur du certificat | `openssl s_client -connect rallly.<domaine>:443` | `Caddy Local Authority` | P1 | |

⚠️ **B6 : ne pas utiliser `docker compose exec … id`**, qui renvoie un faux `root`
pour Postgres. Seul `docker top` montre le processus réel (cf. `securite.md` §2).

## C. SSO, groupes et policies

| # | Test | Comment | Attendu | Porteur | Résultat |
|---|---|---|---|---|---|
| C1 | Connexion `alice` | SSO depuis Rallly | accès accordé, nom et e-mail venus de l'IdP | P2 | |
| C2 | Refus `bob` | SSO avec `bob` (groupe `sans-acces`) | **« Permission refusée »** côté Authentik | P2 | |
| C3 | Mailpit pour `admin` | ouvrir `mail.<domaine>` connecté en `admin` | accès accordé | P2 | |
| C4 | Mailpit refusé à `alice` | même URL connectée en `alice` | **refusé** | P2 | |
| C5 | Mailpit sans session | même URL en navigation privée | **302** vers Authentik, pas 200 | P2 | |
| C6 | Contournement par e-mail | tenter la connexion par code e-mail | **refusée** (`EMAIL_LOGIN_ENABLED=false`) | P2 | |
| C7 | Invitation d'un externe | parcours d'invitation de `carol` | compte créé, accès conforme au groupe `externes` | P2 | |
| C8 | Blueprints rejoués | `docker compose restart authentik-worker` | aucune duplication de groupe ni de compte | P2 | |

⚠️ **C5 est le vrai test de la protection de Mailpit.** Un 200 avec une session
d'admin ne prouve rien : il faut vérifier qu'**un anonyme est bien renvoyé**.

## D. CI/CD et déploiement

| # | Test | Comment | Attendu | Porteur | Résultat |
|---|---|---|---|---|---|
| D1 | CI verte sur `main` | `gh run list --branch main --limit 1` | `success` sur les 5 jobs | P3 || ✅ 16/11, run 43854533985 (`b0db423`) : `success`. **4 jobs** et non 5 (lint, app-quality, image, scan-stack) : coquille du plan |
| D2 | Tests unitaires joués | journal du job `app-quality` | l'étape « Tests unitaires » apparaît et passe | P3 || ✅ 16/11 : étape « Tests unitaires » verte, 61 fichiers de tests dont `custom-fields/utils.test.ts` (12 tests) |
| D3 | Image publique | `docker manifest inspect ghcr.io/…/rallly:main` **sans être authentifié** | manifeste rendu | P3 || ✅ 16/11 : `docker manifest inspect …:main` avec un `DOCKER_CONFIG` vide → manifeste OCI rendu |
| D4 | Tag par commit | `docker manifest inspect …:sha-<commit de main>` | existe | P3 || ✅ 16/11 : `sha-b0db423` (main) et `sha-d3690c5` existent |
| D5 | Déploiement | `bash scripts/deploy.sh` sur la VM | smoke test vert de bout en bout | P1 | |
| D6 | **Image effectivement exécutée** | `docker inspect <conteneur rallly> --format '{{.Config.Image}}'` | le tag **`sha-<commit de main>`**, pas `:main` | P1 | |
| D7 | Migrations appliquées | `select migration_name from _prisma_migrations order by finished_at desc limit 1` | la dernière migration du dépôt | P1 | |
| D8 | Secrets hors dépôt | `git log -p \| grep -i 'password='` et job `lint` (gitleaks) | aucun secret, gitleaks vert | P3 || ✅ 16/11 : gitleaks vert ; le `grep` ne trouve que des exemples de doc Prisma importés avec Rallly (`app/rallly/.agents/skills/prisma-database-setup/…`), aucun secret |

⚠️ **D6 et D7 sont les plus importants de cette section**, et les plus faciles à
rater : le 16/11, le smoke test était **entièrement vert** alors que la VM tournait
sur une image périmée avec une migration de retard. Un service qui répond ne prouve
pas qu'il exécute le bon code (cf. `vm-enov.md` §5.5).

## E. Les trois fonctionnalités

Chaque feature se vérifie **deux fois** : dans l'interface, et par un appel d'API
qui court-circuite l'interface. Le sujet autorise le formateur à tester l'API.

| # | Test | Attendu | Porteur | Résultat |
|---|---|---|---|---|
| E1 | #4 Expiration — vote avant échéance | accepté | P2 | |
| E2 | #4 — vote après échéance, dans l'interface | formulaire fermé | P2 | |
| E3 | #4 — **vote forgé après échéance par l'API** | **400**, refus serveur | P2 | |
| E4 | #4 — échéance repoussée | le sondage rouvre | P2 | |
| E5 | #8 Réservation — un créneau par `alice` | accepté | P1 | |
| E6 | #8 — **même créneau par `admin`** | **409 CONFLICT**, aucune ligne en base | P1 | |
| E7 | #8 — **deux créneaux d'un coup** | **400**, message « un seul créneau » | P1 | |
| E8 | #8 — messages affichés | en français, sans parler de connexion réseau | P1 | |
| E9 | #8 — « si nécessaire » absent | le bouton n'alterne qu'entre réservé et non réservé | P1 | |
| E10 | Libre (#201) champs personnalisés | réponses enregistrées, visibles de l'organisateur seul | ✅ 16/11, revérifié après merge de la PR #24 (image `sha-f25de16`, navigateur) : champ facultatif vide → vote enregistré ; champ requis vide → « Ce champ est obligatoire. » ; champ rendu requis après ouverture de la page → « Les informations demandées par ce sondage ont changé… ». Écart initial : un champ vide bloquait le vote avec « Invalid input » (corrigé PR #24) |
| E11 | Libre — **champ requis contourné par l'API** | refus serveur | P3 || ✅ 16/11 : vote forgé sans le champ requis (ou avec des espaces) → **400** ; choix hors liste → 400. Message UI si seul le serveur refuse (champs modifiés après ouverture de la page) : « vérifiez votre connexion » → corrigé dans la même PR (« Les informations demandées par ce sondage ont changé… ») |

⚠️ **E8 existe parce que le défaut a été réel.** La règle refusait correctement,
mais Rallly affichait « vérifiez votre connexion » — faux, et poussant à réessayer
sans fin. Aucun test automatique ne l'a vu. **À vérifier pour les trois features.**

## F. Résilience

| # | Test | Comment | Attendu | Porteur | Résultat |
|---|---|---|---|---|---|
| F1 | Reboot de la VM | `systemctl reboot` (avec l'accord de l'équipe) | tout remonte seul en ~40 s | P1 | |
| F2 | Swap réactivé | `swapon --show` après reboot | 2 Go actifs | P1 | |
| F3 | DNS conservé | `getent hosts github.com` après reboot | résolution OK | P1 | |
| F4 | Pare-feu actif | `ufw status` | 22, 80, 443 seulement | P1 | |
| F5 | Config montée à jour | après `git pull`, recréer caddy | la règle `forward_auth` est bien chargée | P1 | |

⚠️ **F5** : un bind mount de fichier suit l'inode. Après un `git pull`, le conteneur
garde l'ancien fichier et ni `up -d` ni `caddy reload` ne le voient. C'est ainsi que
**Mailpit s'est retrouvé sans authentification** sur la VM (cf. `vm-enov.md` §5.4).

## G. Accès extérieur et documentation

| # | Test | Attendu | Porteur | Résultat |
|---|---|---|---|---|
| G1 | **Une personne extérieure au groupe** ouvre les 3 URL avec la seule doc | y parvient **sans poser de question** | P1 | |
| G2 | Points d'hésitation relevés | chacun est un trou de doc à combler | P1 | |
| G3 | Liens du README | tous pointent vers un fichier existant | P1 | |
| G4 | Schéma d'architecture lisible | présent dans le README et à jour | P1 | |
| G5 | Comptes de démo | la table du README correspond à Authentik | P2 | |

⚠️ **G1 ne se teste pas entre nous** : nous connaissons déjà les réponses. Ce qui
est évalué, c'est la documentation, pas la stack. **G2 compte autant que G1** — une
hésitation non notée est un trou qui ressortira en soutenance.

## H. Répétition de la soutenance

| # | Test | Attendu | Porteur | Résultat |
|---|---|---|---|---|
| H1 | Démo chronométrée | 15 min tenues, 4 / 4 / 3 / 4 | les 3 | |
| H2 | Démo rejouée après `reset` | fonctionne sans retouche | les 3 | |
| H3 | Captures et vidéo de secours | prêtes, au cas où le VPN tombe | les 3 | |
| H4 | Questions sur les limites assumées | chacun sait défendre les siennes | les 3 | |

⚠️ **H4** : les limites écrites dans `securite.md` §4 et `features.md` seront
questionnées. Un durcissement présenté **sans** ses limites est moins crédible qu'un
durcissement dont on connaît les trous.

---

## Suivi du balayage

| Section | Porteur | Date | Écarts trouvés |
|---|---|---|---|
| A — démarrage à froid | | | |
| B — réseau et durcissement | | | |
| C — SSO et policies | | | |
| D — CI/CD et déploiement | P3 (D1-D4, D8) | 16/11/2026 | aucun ; D5-D7 restent à P1 (VM) |
| E — fonctionnalités | P3 (E10, E11) | 16/11/2026 | E10 : champ vide bloquant + messages d'erreur (corrigé PR #24, revérifié) |
| F — résilience | | | |
| G — accès extérieur | | | |
| H — soutenance | | | |
