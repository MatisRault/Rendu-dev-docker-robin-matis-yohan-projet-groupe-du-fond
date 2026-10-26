# Sécurité : durcissement et scan de vulnérabilités

Ce document couvre le durcissement de **toute** la stack (y compris les services
livrés par P2 et P3) et le commentaire du scan Trivy. Toutes les valeurs du tableau
sont **mesurées**, pas déduites de la configuration : la méthode de mesure est donnée
en §2.

## 1. Tableau de durcissement

| Service | Utilisateur effectif | `read_only` | `cap_drop` | `cap_add` | Ports hôte | Réseaux |
|---|---|---|---|---|---|---|
| `caddy` | **root** (voir §4.1) | ✅ | ALL | `NET_BIND_SERVICE` | **80, 443** | `edge` |
| `ca-export` | root, `network_mode: none` | ✅ | ALL | — | — | aucun |
| `mailpit` | `nobody` (65534) | ✅ | ALL | — | — | `edge`, `mail` |
| `authentik-server` | `authentik` (1000) | ✅ | ALL | — | — | `edge`, `authentik_backend`, `mail` |
| `authentik-worker` | `authentik` (1000) | ✅ | ALL | — | — | `authentik_backend`, `mail` |
| `authentik-db` | `postgres` (70) | ✅ | ALL | 5 caps, voir §3.1 | — | `authentik_backend` |
| `rallly` | `nextjs` (100) | ✅ | ALL | — | — | `edge`, `rallly_backend`, `mail` |
| `rallly-db` | `postgres` (70) | ✅ | ALL | 5 caps, voir §3.1 | — | `rallly_backend` |
| `garage` | **root** (voir §4.2) | ✅ | ALL | — | — | `rallly_backend` |

`security_opt: ["no-new-privileges:true"]` est appliqué aux **9 services**, sans
exception.

Résultat : **7 services sur 9 tournent en utilisateur non privilégié**, les deux
exceptions sont documentées en §4. `read_only: true` est appliqué **partout**, sans
aucune exception à assumer.

### Ce qui n'est pas exposé
- Seul `caddy` publie des ports sur l'hôte, liés à `${HTTP_BIND}` (`127.0.0.1` en
  local, `0.0.0.0` sur la VM). Les colonnes « Ports » ci-dessus sont vides pour tous
  les autres : les ports visibles dans `docker compose ps` (5432, 3000, 8025…) sont
  des ports **de conteneur**, pas des publications sur l'hôte.
- **Aucune base de données n'est publiée.**
- Les trois réseaux applicatifs (`mail`, `authentik_backend`, `rallly_backend`) sont
  `internal: true` : leurs membres n'ont **aucun accès sortant vers Internet**.
- Toutes les images sont épinglées par tag de version. Une réserve : `lukevella/rallly:4`
  est un tag de **version majeure flottante**, il bougera dans le temps. Sur la VM,
  l'image à utiliser est celle de notre CI, épinglable par digest `@sha256:`.

## 2. Méthode de mesure

La colonne « utilisateur effectif » ne peut pas se lire dans le Compose, et une
mesure naïve donne un résultat **faux** :

```bash
docker compose exec rallly-db id      # => uid=0(root)   ← TROMPEUR
docker top <conteneur> -o user,comm   # => 70 postgres   ← la vérité
```

`docker compose exec` démarre un **nouveau** processus avec l'utilisateur par défaut
de l'image. Or l'entrypoint de Postgres démarre en root puis abandonne ses privilèges
vers l'uid 70 pour le serveur lui-même. Seul `docker top`, qui liste les processus
réellement en cours, donne l'utilisateur du service. Les valeurs du §1 viennent
de `docker top`.

## 3. Capabilities : ce qu'il a fallu rajouter, et pourquoi

### 3.1 Postgres exige 5 capabilities à cause de son entrypoint

Avec `cap_drop: [ALL]` seul, les deux bases refusent de démarrer :

```
chmod: /var/lib/postgresql/data: Operation not permitted
chown: /var/run/postgresql: Operation not permitted
find: /var/lib/postgresql/18/docker: Permission denied
```

L'entrypoint démarre en root et doit : ajuster le propriétaire et les droits du
datadir (`CHOWN`, `FOWNER`), basculer vers l'uid 70 (`SETUID`, `SETGID`), et
parcourir un datadir en `0700` qui ne lui appartient pas (`DAC_OVERRIDE`). D'où :

```yaml
cap_drop: [ALL]
cap_add: [CHOWN, SETUID, SETGID, FOWNER, DAC_OVERRIDE]
```

**Piège méthodologique rencontré, qui vaut d'être raconté en soutenance.** Ce jeu de
capabilities a d'abord été testé sur un **volume neuf**, dans un projet Compose
jetable. Résultat : `postgres:18-alpine` démarrait très bien **sans** `DAC_OVERRIDE`,
et la conclusion « le 18 n'en a pas besoin » a été écrite. Elle était fausse. Au
redémarrage sur le volume **déjà initialisé** de la stack réelle, le même service
échouait sur `find: Permission denied`.

Explication : au premier `initdb`, l'entrypoint crée lui-même le datadir et en est
propriétaire ; au redémarrage, le datadir existe en `0700` et appartient à l'uid 70,
donc le root du conteneur a besoin de `DAC_OVERRIDE` pour le parcourir. **Un jeu de
capabilities doit être validé sur les deux chemins** — première initialisation *et*
redémarrage sur données existantes. Tester un seul des deux donne un faux positif
dans un sens ou dans l'autre.

### 3.2 `read_only: true` partout, sans exception

Appliqué aux 9 services et validé : tous `healthy`. Les écritures légitimes passent
par des `tmpfs` ou des volumes, qui restent inscriptibles malgré `read_only`
(`read_only` ne concerne que la couche de système de fichiers propre au conteneur) :

| Service | `tmpfs` ajouté | Pourquoi |
|---|---|---|
| `caddy`, `mailpit`, `rallly` | `/tmp` | fichiers temporaires |
| `authentik-server`, `authentik-worker` | `/tmp`, `/media`, `/certs` | téléversements et certificats générés au vol |
| `authentik-db`, `rallly-db` | `/tmp`, `/var/run/postgresql` | socket Unix du serveur |
| `garage` | `/tmp` | fichiers temporaires |
| `ca-export` | — | n'écrit que dans le volume `ca_public` |

## 4. Limites assumées

### 4.1 Caddy tourne en root — et la bascule a été mesurée, pas supposée

Caddy démarre en root avec une seule capability (`NET_BIND_SERVICE`), nécessaire pour
écouter sur les ports 80 et 443.

La variante non privilégiée suggérée par le plan a été **testée** dans un projet
Compose isolé, en deux temps :

1. `user: "1000:1000"` + `cap_drop: [ALL]` + `sysctls net.ipv4.ip_unprivileged_port_start: 0`
   → **échec** : `exec /usr/bin/caddy: operation not permitted`.
   Cause : le binaire Caddy porte `cap_net_bind_service` en *file capability*. Avec
   `cap_drop: [ALL]`, cette capability sort du *bounding set*, et
   `no-new-privileges:true` interdit à l'`execve` de l'acquérir — le binaire ne peut
   donc même pas démarrer.
2. `user: "1000:1000"` + `cap_drop: [ALL]` + `cap_add: [NET_BIND_SERVICE]`
   → **succès** : Caddy démarre, génère sa CA interne et sert le HTTPS (vérifié par
   une requête depuis un conteneur voisin : TLS terminé, 502 attendu faute
   d'*upstream* dans le bac à sable).

**Pourquoi la bascule n'est malgré tout pas appliquée en l'état.** Elle ne fonctionne
que sur un volume `caddy_data` **neuf**. Sur un volume existant, tout
`/data/caddy` est en `0700` propriété de root (vérifié : la PKI, les clés
intermédiaires et les certificats sont tous en `-rw-------` root) : Caddy en uid 1000
ne peut plus lire sa propre CA. La bascule exige donc un `chown -R 1000:1000` ponctuel
du volume sur **chaque** environnement — les trois postes de l'équipe et la VM — et un
oubli casse la stack entière, puisque Caddy est l'unique point d'entrée.

Arbitrage : le gain est réel mais marginal (root dans un conteneur `read_only`,
`no-new-privileges`, une seule capability, aucun montage sensible), le risque de
rupture est collectif. La bascule est donc **documentée et prête**, à appliquer au
moment d'un `reset` de l'équipe plutôt qu'en cours de développement.

### 4.2 Garage tourne en root

Mesuré : `garage` démarre en root. L'image est minimale (binaire Rust statique) et
`garage` écrit dans ses deux volumes `garage_meta` et `garage_data`, créés par Docker
avec le propriétaire root. Un `user:` non privilégié exigerait de pré-positionner le
propriétaire de ces volumes, donc un conteneur d'initialisation supplémentaire.
Atténuations en place : `cap_drop: [ALL]`, `read_only: true`,
`no-new-privileges:true`, aucun port publié, et réseau `rallly_backend` en
`internal: true` — garage n'a **aucun accès à Internet** et n'est joignable que par
`rallly`.

### 4.3 Docker contourne ufw sur la VM

Sur la VM Énov, `ufw` est actif et n'autorise que 22, 80 et 443. Mais Docker insère
ses règles dans la chaîne `DOCKER-USER` d'iptables, **en amont** d'ufw : un port
publié par un conteneur serait joignable même si ufw le refusait. Ce qui protège
réellement les services internes n'est donc pas ufw, mais l'absence de `ports:` sur
tous les services sauf Caddy et les réseaux `internal: true`. Voir `docs/vm-enov.md`.

### 4.4 La stack est pilotée en root sur la VM

Le template Énov ne fournit que le compte `root`. Conséquence favorable : pas de
`usermod -aG docker`, donc pas d'utilisateur non privilégié disposant d'un accès
équivalent à root via le socket Docker. Conséquence défavorable : les commandes
Compose sont lancées en root. En production, un compte dédié serait préférable.

### 4.5 Secrets en variables d'environnement

Les mots de passe transitent par le `.env` (permissions `600`, hors dépôt) puis par
les variables d'environnement des conteneurs, donc visibles dans
`docker inspect`. L'amélioration prévue par le plan — passer les mots de passe de
base en `secrets:` Compose avec `POSTGRES_PASSWORD_FILE` — n'est **pas** appliquée.
C'est un écart assumé : il faudrait l'étendre à Authentik et Rallly, qui ne lisent
pas tous leurs secrets depuis des fichiers.

## 5. Scan Trivy commenté

Commande : `./stack.sh scan` → sorties brutes dans `docs/scan/`.
Filtre : `--scanners vuln --severity HIGH,CRITICAL`.

### 5.1 Résultats par image

| Image | Paquets OS | Binaires / dépendances | Total HIGH+CRITICAL |
|---|---|---|---|
| `caddy:2.10-alpine` | alpine 3.22.3 : **34** | `usr/bin/caddy` (Go) : **66** | 100 |
| `ghcr.io/goauthentik/server:2026.5.6` | debian 13.6 : **129** | Python + Node : **61** | 190 |
| `lukevella/rallly:4` | debian : **68** | Node : **8** | 76 |
| `postgres:16-alpine` | alpine : **24** | `gosu` (Go) : **26** | 50 |
| `postgres:18-alpine` | alpine 3.24.3 : **2** | `gosu` (Go) : **26** | 28 |
| `axllent/mailpit:v1.27` | alpine : **21** | binaire Go : **54** | 75 |
| `busybox:1.37` | **non scanné** | — | — |
| `dxflrs/garage:v2.3.0` | **non scanné** | — | — |

⚠️ **`busybox` et `garage` ne sont pas « propres », ils ne sont pas analysés.** Trivy
rend `'-' : Not scanned` parce qu'il n'y trouve aucun gestionnaire de paquets à
interroger : ce sont des images minimales contenant un binaire statique. Annoncer
« 0 vulnérabilité » serait un contresens. C'est une **limite de la méthode**, à
compenser en suivant les avis de sécurité des deux projets en amont. Atténuation
pour `busybox` : conteneur jetable, `network_mode: none`, qui s'arrête en quelques
secondes après avoir copié un certificat public.

### 5.2 Quatre CVE commentées

**CVE-2025-68121 — Go stdlib `crypto/tls`, validation de certificat incorrecte (CRITICAL).**
Présente dans `caddy`, `mailpit` et le binaire `gosu` des deux Postgres, parce que la
bibliothèque standard de Go est **compilée dans** chaque binaire : on ne peut pas la
corriger par un `apt upgrade`, il faut que l'éditeur recompile avec Go ≥ 1.25.7.
Exploitabilité très inégale selon le service : critique pour Caddy, qui valide
réellement des certificats TLS ; **sans objet pour `gosu`**, un utilitaire de
changement d'utilisateur qui n'ouvre jamais de connexion TLS — le code vulnérable est
présent mais inatteignable. Action : surveiller les tags de Caddy et monter de
version dès qu'une build avec un Go corrigé est publiée.

**CVE-2026-31789 — OpenSSL, dépassement de tas (CRITICAL), corrigé en 3.5.6-r0.**
Touche `caddy` et `postgres:16-alpine`. Le bulletin précise **« on 32-bit systems »**.
Nos deux cibles sont 64 bits (Mac arm64 en développement, VM Énov x86_64) : le chemin
de code vulnérable n'est pas atteignable chez nous. Non exploitable dans notre
contexte, et de toute façon corrigée au prochain rafraîchissement de l'image de base.

**CVE-2023-45853 — zlib, dépassement d'entier (CRITICAL), `will_not_fix`.**
Dans `lukevella/rallly:4`. Debian la classe explicitement « ne sera pas corrigée » :
elle concerne le composant `minizip`, qui n'est pas utilisé par l'application. Aucune
version corrigée n'existe côté distribution, donc **aucune action de mise à jour
possible** : c'est le cas typique où le chiffre brut du scan ne peut pas descendre.
Ce qui limite réellement l'impact ici, c'est le durcissement : le conteneur tourne en
uid 100, en `read_only`, sans aucune capability.

**CVE-2025-44005 — `smallstep/certificates` embarqué dans Caddy (CRITICAL), corrigé en 0.29.0.**
La plus pertinente des quatre, et la seule qui touche une fonction que nous
utilisons vraiment : c'est le composant qui implémente la **CA interne** de Caddy,
donc exactement notre `local_certs`. Caddy 2.10 embarque la 0.28.4. Action concrète :
monter Caddy dès qu'un tag embarquant la 0.29.0 est disponible. En attendant,
l'atténuation est contextuelle — la CA ne sert que des noms internes
(`*.localhost`, `*.sslip.io`) sur un réseau non public, et sa clé privée reste dans
le volume `caddy_data`, jamais exposée (le service `ca-export` ne recopie que le
certificat **public**).

### 5.3 Deux réserves sur la méthode

- **Le scan a tourné sur les variantes arm64** des images (poste de développement
  Apple Silicon), alors que la VM exécute les variantes amd64. Les CVE de paquets
  OS et de bibliothèques Go sont identiques, puisqu'issues des mêmes sources et des
  mêmes versions de paquets ; les conclusions se transposent. À refaire sur la VM si
  l'on veut une preuve stricto sensu pour l'architecture déployée.
- **Le scan de la CI et celui-ci sont complémentaires, et la différence n'est pas
  celle qu'on croit.** La CI (`.github/workflows/ci.yml`, écrite par P3) fait déjà
  deux scans : le job `image` scanne l'image Rallly que nous construisons, au format
  SARIF remonté dans l'onglet *Security* de GitHub ; le job `scan-stack` scanne,
  lui aussi, **toutes** les images de la stack. Ce document ne comble donc pas un
  trou de couverture. Deux écarts le justifient quand même :
  1. la CI passe `--ignore-unfixed`, donc elle **masque les CVE sans correctif
     disponible**. C'est exactement le cas de `CVE-2023-45853` (zlib,
     `will_not_fix`) commentée en §5.2 : elle n'apparaît jamais dans la CI, alors
     qu'elle est bien présente dans l'image que nous déployons ;
  2. la CI termine ses scans par `|| true` et n'écrit que dans les journaux du job,
     qui expirent. Ici les sorties brutes sont **commitées** dans `docs/scan/` et
     **commentées**, ce qui est ce que le sujet demande d'évaluer.
  Autrement dit : la CI surveille en continu ce qui est corrigeable, ce document
  évalue et explique la surface d'attaque réelle à un instant donné.

## 6. Vérifications fonctionnelles après durcissement

Le durcissement ne vaut rien s'il casse le produit. État mesuré après application,
stack complète en local :

| Vérification | Résultat |
|---|---|
| `docker compose ps` | 8 services `healthy`, `ca-export` `Exited (0)` |
| `https://rallly.localhost` | **200** |
| `https://auth.localhost` | **302** (Authentik redirige vers son flux) |
| `https://mail.localhost` | **302** (forward-auth Authentik : Mailpit est protégé) |
| Découverte OIDC servie par Authentik | **200**, `issuer` conforme |
| Découverte OIDC **depuis le conteneur `rallly`** | **200** |

La dernière ligne est la plus importante : elle valide le « piège n°1 » du plan. Le
serveur Rallly joint Authentik par son **URL publique** `https://auth.<domaine>`
depuis l'intérieur du réseau Docker, grâce aux alias réseau portés par Caddy sur
`edge` et à `NODE_EXTRA_CA_CERTS` qui lui fait accepter la CA interne — sans jamais
exposer la clé privée de cette CA.
