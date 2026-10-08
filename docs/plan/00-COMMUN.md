# 00 — Contrat commun (lu par Claude Code, les humains n'ont pas besoin de le lire)

Ce fichier fixe **tout ce qui est partagé** : noms, domaines, ports, réseaux, variables d'environnement, conventions Git, comptes de démo. Si chacun respecte ce contrat, vous n'avez presque pas besoin de vous parler pour avancer en parallèle.

> **Règle d'or** : on ne change rien de ce fichier sans prévenir les deux autres. Toute nouvelle variable d'env passe par `.env.example` + `scripts/gen-env.sh` dans la même PR.

---

## 0. Règles communes pour Claude Code (à appliquer quel que soit le fichier perso)

Chaque fichier perso (`01-…`, `02-…`, `03-…`) commence par une section **« 🤖 Instructions pour Claude Code »** qui renvoie ici. Voici les règles qui s'appliquent à tous.

### 0.1 Ton rôle
- Les humains **ne lisent pas** ces fichiers. C'est toi qui les lis et qui exécutes tout. Leur rôle se limite à : répondre à tes questions, accepter tes commandes, et faire les quelques actions impossibles depuis un terminal (installer un logiciel, cliquer dans GitHub ou sur le portail Énov, envoyer un message au groupe).
- Quand tu demandes une action manuelle, donne des instructions **précises et numérotées** : où cliquer, quoi taper exactement, et à quoi ressemble « c'est bon ». Pas de jargon sans explication. Une seule chose à la fois.
- Quand l'humain doit prévenir les autres, **rédige le message exact** à copier-coller dans le groupe.
- Tu parles en français à l'humain.

### 0.2 Environnement
Windows natif. L'humain lance Claude Code depuis **PowerShell**, mais **tes** commandes passent par **Git Bash** (comportement normal de Claude Code sous Windows) : écris donc tes commandes en bash. Pas de WSL, pas de `make` : toutes les commandes du projet passent par `./stack.sh`. Les fichiers sont en LF.
**Quand tu donnes une commande à taper à l'humain, donne-la en syntaxe PowerShell** : pas de `&&` (non supporté par le PowerShell de base de Windows), une commande par ligne, chemins avec `$HOME\…`.

### 0.3 Vérification du PC (toujours en premier, à chaque nouvelle session)
Exécute ce script et analyse le résultat :
```bash
set +e
chk() {
  printf '%-22s' "$1"; shift
  command -v "$1" >/dev/null 2>&1 || { echo "ABSENT"; return; }
  out="$("$@" 2>&1 | head -1)"; [ -n "$out" ] && echo "$out" || echo "ABSENT (vide)"
}
chk "Git"              git --version
chk "Git user.name"    git config --global user.name
chk "Git user.email"   git config --global user.email
chk "Git autocrlf"     git config --global core.autocrlf
chk "Docker client"    docker version --format '{{.Client.Version}}'
chk "Docker serveur"   docker version --format '{{.Server.Version}}'
chk "Docker compose"   docker compose version --short
chk "RAM Docker (o)"   docker info --format '{{.MemTotal}}'
chk "openssl"          openssl version
chk "curl"             curl --version
chk "GitHub CLI"       gh --version
chk "gh connecté"      gh auth status
chk "Node (option.)"   node --version
echo "Ports 80/443 :"; netstat -ano | grep -iE "listen" | grep -E "[:.](80|443)[[:space:]]" || echo "  libres"
```

Corrige chaque problème avec ce tableau. **« Toi »** = tu le fais après avoir prévenu l'humain. **« Humain »** = tu lui donnes les instructions exactes, tu attends sa confirmation, puis tu relances le script.

| Problème | Qui | Quoi faire |
|---|---|---|
| `user.name` ou `user.email` vides | Toi | Demande « Ton prénom + nom, et l'adresse e-mail de ton compte GitHub ? », puis `git config --global user.name "…"` et `git config --global user.email "…"`. **L'e-mail doit être celui de GitHub**, sinon les commits ne sont pas attribués et le savoir-être en pâtit. |
| `autocrlf` ≠ `false` | Toi | `git config --global core.autocrlf false` |
| Docker client ABSENT | Humain | 1) Ouvrir **PowerShell** (menu Démarrer → « PowerShell »). 2) Taper `winget install -e --id Docker.DockerDesktop` et accepter. 3) **Redémarrer le PC.** 4) Lancer « Docker Desktop » depuis le menu Démarrer, accepter les conditions, passer l'inscription (« Skip »). 5) Attendre que l'icône de baleine en bas à droite indique *Engine running*. 6) Fermer et rouvrir PowerShell, `cd $HOME\projets` (ou le dossier du dépôt), puis relancer `claude` et recoller le message de départ. |
| Docker serveur en erreur (« cannot connect », « error during connect »…) | Humain | « Lance **Docker Desktop** depuis le menu Démarrer et attends que la baleine indique *Engine running* (environ 1 min), puis dis-moi *c'est bon*. » |
| RAM Docker < 6 000 000 000 | Toi + humain | Crée (avec l'accord de l'humain) `~/.wslconfig` contenant `[wsl2]` puis `memory=8GB` sur la ligne suivante (`6GB` si le PC a 8 Go). Ensuite, demande à l'humain : 1) Clic droit sur la baleine → *Quit Docker Desktop*. 2) Dans PowerShell : `wsl --shutdown`. 3) Relancer Docker Desktop. |
| GitHub CLI ABSENT | Humain | 1) PowerShell : `winget install -e --id GitHub.cli`. 2) **Fermer et rouvrir PowerShell** (sinon `gh` n'est pas trouvé), revenir dans le dossier, relancer `claude` et recoller le message de départ. |
| `gh` pas connecté | Humain | Ouvrir **une deuxième fenêtre PowerShell** (la commande est interactive) et taper `gh auth login` → GitHub.com → HTTPS → *Yes* (authentifier Git) → *Login with a web browser* → copier le code affiché → valider dans le navigateur. |
| Port 80 ou 443 occupé | Toi + humain | Récupère le PID (dernière colonne), puis `MSYS_NO_PATHCONV=1 tasklist /FI "PID eq <pid>"` pour avoir le nom du programme. Explique à l'humain comment l'arrêter : Skype ou autre appli → la quitter ; IIS / « World Wide Web Publishing » / PID 4 → dans PowerShell **admin** : `Stop-Service W3SVC; Set-Service W3SVC -StartupType Disabled`. |
| openssl / curl ABSENT | Humain | Ils sont fournis par Git for Windows. S'ils manquent, c'est que tes commandes ne passent pas par Git Bash : demande à l'humain d'installer Git (`winget install -e --id Git.Git` dans PowerShell), de rouvrir PowerShell et de relancer `claude`. |
| Node ABSENT | — | Optionnel. Sans Node, tu corriges les erreurs de lint à partir des logs CI (`gh run view --log-failed`). |

**Pas besoin d'installer Rallly, Authentik, Postgres, Caddy ni quoi que ce soit d'autre** : ce sont des images Docker, téléchargées automatiquement par `./stack.sh up`. Le code de Rallly arrive dans le dépôt par la PR d'import de P3 (`git pull`).

Affiche un récapitulatif ✅ / ❌ à l'humain. Ne passe à la suite **que quand tout est ✅** (Node excepté).

### 0.4 Le dépôt
- Le dépôt du projet est `https://github.com/MatisRault/Rendu-dev-docker-robin-matis-yohan-projet-groupe-du-fond`, cloné dans `~/projets/Rendu-dev-docker-robin-matis-yohan-projet-groupe-du-fond`. Si le dossier courant n'en est pas un clone (`git remote -v`) : `git clone https://github.com/MatisRault/Rendu-dev-docker-robin-matis-yohan-projet-groupe-du-fond.git ~/projets/Rendu-dev-docker-robin-matis-yohan-projet-groupe-du-fond` (sauf s'il existe déjà). Dis-lui ensuite exactement : « Tape `/exit`, puis dans PowerShell `cd $HOME\projets\Rendu-dev-docker-robin-matis-yohan-projet-groupe-du-fond`, puis `claude`, et recolle le même message qu'au début. » N'utilise **jamais** le dossier Documents ni un dossier OneDrive : la synchro OneDrive casse Docker et Git.
- Vérifie l'accès en écriture : `gh repo view --json viewerPermission -q .viewerPermission` doit afficher `WRITE`, `MAINTAIN` ou `ADMIN`.

### 0.5 Reprise de session (à chaque nouvelle session)
Tiens à jour un fichier d'avancement **`docs/avancement/pX.md`** (X = ton numéro), commité sur ta branche : étapes faites, en cours, bloquées (et par quoi). Au début de chaque session, après 0.3 et 0.4 : `git fetch --all`, lis ce fichier, regarde `git branch -a`, `gh pr list` et `gh run list --limit 5`, puis **reprends exactement là où tu t'étais arrêté**, sans refaire ce qui est déjà fait. Annonce à l'humain en 2 lignes où on en est.
Avant le GO de P1, le dossier `docs/` n'existe pas encore : garde l'avancement en mémoire et crée le fichier juste après.

### 0.6 Workflow Git (tu fais tout, l'humain n'a rien à faire)
- Une branche par sujet (`p1/…`, `p2/…`, `p3/…`, `feat/…`), jamais de commit direct sur `main` après le GO.
- Après chaque étape terminée et testée : commit (Conventional Commits, en français), `git push`, puis `gh pr create --fill` (ou mise à jour de la PR existante).
- Quand la CI de la PR est verte (`gh pr checks --watch`) : `gh pr merge --merge --delete-branch`. **Merge commit, pas squash**, pour garder les commits individuels qui comptent dans la note de savoir-être.
- Si la CI est rouge : `gh run view --log-failed`, corrige, repousse.
- Avant de commencer une nouvelle branche : `git switch main && git pull`.

### 0.7 Blocs 🛑 STOP
Quand un fichier contient un bloc **🛑 STOP**, arrête-toi immédiatement, affiche le message du bloc à l'humain, et **ne fais rien de plus** tant qu'il n'a pas confirmé (ex. « c'est fait, continue »). Ne saute jamais un STOP, même si tu penses pouvoir faire l'action toi-même. Pendant une attente, tu peux avancer sur une autre étape **seulement si le STOP le dit explicitement**.

---

## 1. Répartition

| | Personne 1 — Plateforme | Personne 2 — Identité | Personne 3 — Application & CI/CD |
|---|---|---|---|
| Doc | `01-PLATEFORME-INFRA.md` | `02-IDENTITE-AUTHENTIK.md` | `03-APP-RALLLY-CICD.md` |
| Infra | Compose de base, Caddy, réseaux, Mailpit, durcissement, scan Trivy, VM Énov | Authentik (Compose + blueprints), SSO, groupes/policies, invitation externe, accès Mailpit protégé | Import des sources Rallly (`app/rallly/`), image custom, Compose Rallly + BDD + Garage, pipeline CI/CD, script de déploiement |
| Feature | Feature catalogue **A** | Feature catalogue **B** (prend la #1 « vote OAuth » si elle vous est attribuée) | Feature **libre** + doc features |
| Soutenance | Architecture, local vs VM, sécurité | Démo SSO, policies, invitation | Preuve CI/CD, démo des features (chacun montre la sienne) |

Les features sont attribuées par le formateur. Dès que vous les connaissez, notez-les dans le tableau §11.

---

## 2. Organisation GitHub

- **Un seul dépôt public, déjà créé** : https://github.com/MatisRault/Rendu-dev-docker-robin-matis-yohan-projet-groupe-du-fond
  - propriétaire : compte **MatisRault** ; P1, P2 et P3 en sont collaborateurs ;
  - clone local de chacun : `~/projets/Rendu-dev-docker-robin-matis-yohan-projet-groupe-du-fond` (c'est-à-dire `C:\Users\<toi>\projets\Rendu-dev-docker-robin-matis-yohan-projet-groupe-du-fond`) ;
  - il contient déjà un README, que P1 garde et complète.
- Docker est installé sur les 3 PC.
- ⚠️ **Seul le compte MatisRault** peut : rendre public le package de l'image GHCR (il est rangé sous son compte), et probablement régler la protection de `main` (si les autres ne sont pas admin). Le plus simple est donc que **Matis soit P3**. Sinon, quand Claude Code arrive à ces étapes, il rédige le message à envoyer à Matis avec les clics exacts.
- Il contient **tout** : Compose, Caddy, blueprints Authentik, scripts, docs, CI, **et le code source de Rallly** importé dans `app/rallly/`. Les features sont développées directement dans ce dossier.
- On ne forke pas Rallly sur GitHub et on n'a pas besoin de contribuer en open source. Le code Rallly est copié une fois (une version figée), puis modifié chez nous. C'est l'option « image custom » du sujet.
- La CI construit l'image depuis `app/rallly/` et la publie sur `ghcr.io/matisrault/rendu-dev-docker-robin-matis-yohan-projet-groupe-du-fond/rallly`.
- Rallly est sous licence AGPL-3.0 : on garde le fichier `LICENSE` d'origine dans `app/rallly/`. Comme le dépôt est public, les obligations de la licence sont respectées.

### Branches et PR
- `main` protégée (réglée par P3 juste après le GO) : PR obligatoire, **0 review** (pour ne pas s'attendre), CI verte. C'est Claude Code qui ouvre et merge les PR (§0.6).
- Branches infra : `p1/<sujet>`, `p2/<sujet>`, `p3/<sujet>` (ex. `p2/blueprint-invitation`).
- Branches features : `feat/<nom>` (elles ne touchent qu'à `app/rallly/` et à `docs/features.md`).
- Commits : style Conventional Commits (`feat:`, `fix:`, `docs:`, `ci:`, `chore:`), petits et fréquents. La traçabilité Git compte dans la note de savoir-être : **chacun fait tourner Claude Code sur son propre PC, avec son propre compte Git**.
- Chaque personne ne modifie **que ses fichiers** (voir §4). Exception : les fichiers d'avancement et le tableau §11, que chacun met à jour pour sa ligne.

---

## 3. Architecture

```
                    navigateur (local ou VPN NetBird)
                                │ 443 (80 → redirection)
                                ▼
                       ┌─────────────────┐   réseau edge
                       │      Caddy      │   alias DNS internes :
                       │  TLS interne    │   auth.<BASE_DOMAIN>
                       └──┬─────┬─────┬──┘   rallly.<BASE_DOMAIN>
                          │     │     │      mail.<BASE_DOMAIN>
          auth.<domaine>  │     │     │ mail.<domaine> (forward-auth Authentik)
                          ▼     │     ▼
              ┌──────────────┐  │  ┌─────────┐
              │  authentik   │  │  │ Mailpit │◄─────────── SMTP 1025 (réseau mail)
              │   server     │  │  └─────────┘                 ▲          ▲
              └──────┬───────┘  │ rallly.<domaine>             │          │
   authentik_backend │          ▼                              │          │
       ┌─────────────┴──┐   ┌──────────┐                       │          │
       │ authentik-db   │   │  Rallly  │───────────────────────┘          │
       │ authentik-     │   └────┬─────┘                                  │
       │   worker ──────┼────────┼──────────────────────────────────────── ┘
       └────────────────┘        │ rallly_backend
                          ┌──────┴──────┐
                          │ rallly-db   │
                          │ garage (S3) │
                          └─────────────┘
```

### Domaines

| Usage | Local | VM Énov |
|---|---|---|
| `BASE_DOMAIN` | `localhost` | `<IP-avec-tirets>.sslip.io` (ex. `10-42-0-17.sslip.io`) |
| Authentik | `https://auth.localhost` | `https://auth.10-42-0-17.sslip.io` |
| Rallly | `https://rallly.localhost` | `https://rallly.10-42-0-17.sslip.io` |
| Mailpit (admins) | `https://mail.localhost` | `https://mail.10-42-0-17.sslip.io` |

- `*.localhost` est résolu vers `127.0.0.1` par Chrome, Firefox et curl : aucune modif de `/etc/hosts`.
- `sslip.io` renvoie l'IP contenue dans le nom : pas besoin de DNS à configurer. Si un DNS filtre la réponse (protection anti-rebinding), mettez les 3 noms dans le fichier `hosts` du poste client.
- TLS : **Caddy `local_certs`** (CA interne) partout, en local comme sur la VM. La VM n'étant pas publique, Let's Encrypt est impossible. Le navigateur affiche un avertissement, à accepter ou à éviter en important la CA (voir §6).

### Le piège n°1 déjà résolu : Rallly doit joindre Authentik par son URL publique
Le serveur Rallly télécharge la découverte OIDC (`https://auth.<domaine>/...`). Dans un conteneur, `auth.localhost` pointerait sur le conteneur lui-même. Deux mécanismes règlent le problème :
1. Caddy porte des **alias réseau** `auth.<BASE_DOMAIN>`, etc. sur le réseau `edge`, donc depuis Rallly ce nom résout vers Caddy.
2. Rallly fait confiance à la CA Caddy via `NODE_EXTRA_CA_CERTS`. Un petit service `ca-export` copie **uniquement** le certificat public de la CA dans un volume `ca_public`, sans exposer la clé privée de la CA.

### Réseaux

| Réseau | `internal` | Membres |
|---|---|---|
| `edge` | non | caddy, authentik-server, rallly, mailpit |
| `mail` | oui | mailpit, authentik-server, authentik-worker, rallly |
| `authentik_backend` | oui | authentik-db, authentik-server, authentik-worker |
| `rallly_backend` | oui | rallly-db, garage, rallly |

### Ports
- Sur l'hôte : **uniquement 80 et 443** (Caddy), liés à `${HTTP_BIND}`.
- En interne : `authentik-server:9000`, `rallly:3000`, `mailpit:8025` (UI) et `mailpit:1025` (SMTP), `garage:3900`, `*-db:5432`.
- **Aucune base de données publiée.**

---

## 4. Arborescence du dépôt et propriétaires

```
Rendu-dev-docker-robin-matis-yohan-projet-groupe-du-fond/
├── app/
│   └── rallly/                  Sources Rallly importées (P3), features : les 3
│       ├── UPSTREAM_VERSION     tag Rallly importé (ex. v4.12.3)
│       ├── LICENSE              AGPL d'origine, à conserver
│       └── apps/web/Dockerfile  Dockerfile upstream (image custom)
├── .env.example                 P1 (gardien, tout le monde y ajoute via PR)
├── .gitignore                   P1
├── .gitattributes               P1 (force LF : indispensable sous Windows)
├── stack.sh                     P1 (commandes du projet, remplace make)
├── README.md                    P1 (sections Authentik → P2, CI/features → P3)
├── compose.yml                  P1  base : réseaux, volumes, caddy, ca-export, mailpit
├── compose.authentik.yml        P2
├── compose.rallly.yml           P3
├── proxy/Caddyfile              P1 (bloc mail.* → P2)
├── authentik/blueprints/        P2
│   ├── 10-rallly-stack.yaml
│   └── 20-invitation.yaml
├── config/garage.toml           P3
├── scripts/
│   ├── gen-env.sh               P1
│   ├── deploy.sh                P3
│   └── smoke-test.sh            P3
├── .github/workflows/ci.yml     P3
└── docs/
    ├── architecture.md          P1 (+ schéma PNG/SVG)
    ├── vm-enov.md               P1
    ├── securite.md              P1 (durcissement + scan commenté)
    ├── authentik.md             P2 (SSO, policies, invitation + captures)
    ├── comptes-demo.md          P2
    ├── ci-cd.md                 P3
    └── features.md              P3 (chacun écrit sa section)
```

Compose charge les 3 fichiers automatiquement grâce à `COMPOSE_FILE` dans `.env`. **Un simple `docker compose up -d` suffit.** Chacun édite son propre fichier, ce qui évite les conflits de merge.

---

## 5. Le contrat `.env`

### `.env.example` (commité)

```dotenv
# ════════════════════════════════════════════════════════════════
#  Contrat partagé. Toute nouvelle variable : l'ajouter ICI
#  (+ dans scripts/gen-env.sh si c'est un secret). Ne JAMAIS commiter .env
# ════════════════════════════════════════════════════════════════

# ── Compose ─────────────────────────────────────────────────────
COMPOSE_PROJECT_NAME=rallly-stack
COMPOSE_FILE=compose.yml:compose.authentik.yml:compose.rallly.yml
COMPOSE_PATH_SEPARATOR=:

# ── Domaines / exposition ───────────────────────────────────────
# Local : localhost  |  VM : <ip-avec-tirets>.sslip.io
BASE_DOMAIN=localhost
# Local : 127.0.0.1 (rien sur le LAN)  |  VM : 0.0.0.0
HTTP_BIND=127.0.0.1

# ── E-mail (Mailpit, SMTP de lab) ───────────────────────────────
MAIL_FROM=noreply@example.com
SUPPORT_EMAIL=support@example.com

# ── Authentik ───────────────────────────────────────────────────
AUTHENTIK_TAG=2026.5.6
AUTHENTIK_SECRET_KEY=__GEN_AUTHENTIK_SECRET_KEY__
AUTHENTIK_DB_PASSWORD=__GEN_AUTHENTIK_DB_PASSWORD__
AUTHENTIK_BOOTSTRAP_EMAIL=akadmin@example.com
AUTHENTIK_BOOTSTRAP_PASSWORD=__GEN_AUTHENTIK_BOOTSTRAP_PASSWORD__

# ── Lien OIDC Rallly <-> Authentik ──────────────────────────────
# Lu à la fois par le blueprint Authentik ET par Rallly :
# rien à copier-coller entre les deux.
RALLLY_OIDC_CLIENT_ID=rallly
RALLLY_OIDC_CLIENT_SECRET=__GEN_RALLLY_OIDC_CLIENT_SECRET__

# ── Comptes de démo (créés par blueprint, cf. §7) ───────────────
DEMO_PASSWORD=__GEN_DEMO_PASSWORD__
RALLLY_ADMIN_EMAIL=admin@example.com

# ── Rallly ──────────────────────────────────────────────────────
# Image upstream au début, puis ghcr.io/matisrault/rendu-dev-docker-robin-matis-yohan-projet-groupe-du-fond/rallly:main
RALLLY_IMAGE=lukevella/rallly:4
RALLLY_SECRET_PASSWORD=__GEN_RALLLY_SECRET_PASSWORD__
RALLLY_DB_PASSWORD=__GEN_RALLLY_DB_PASSWORD__

# ── Stockage S3 (Garage) ────────────────────────────────────────
GARAGE_RPC_SECRET=__GEN_GARAGE_RPC_SECRET__
S3_ACCESS_KEY_ID=__GEN_S3_ACCESS_KEY_ID__
S3_SECRET_ACCESS_KEY=__GEN_S3_SECRET_ACCESS_KEY__
```

### `scripts/gen-env.sh` (commité, exécutable)

Chacun génère **ses propres secrets**. Comme le client secret OIDC est lu par Authentik *et* par Rallly depuis le même `.env`, il n'y a jamais rien à échanger.

```bash
#!/usr/bin/env bash
# Génère .env à partir de .env.example en remplissant tous les __GEN_*__
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -f .env && "${1:-}" != "--force" ]]; then
  echo "❌ .env existe déjà. --force pour l'écraser"
  echo "   (⚠️ ensuite : ./stack.sh reset, sinon les BDD gardent les anciens mots de passe)"
  exit 1
fi
command -v openssl >/dev/null || { echo "openssl requis"; exit 1; }
hex() { openssl rand -hex "$1"; }

tmp="$(mktemp)"
sed \
  -e "s|__GEN_AUTHENTIK_SECRET_KEY__|$(hex 50)|" \
  -e "s|__GEN_AUTHENTIK_DB_PASSWORD__|$(hex 24)|" \
  -e "s|__GEN_AUTHENTIK_BOOTSTRAP_PASSWORD__|$(hex 12)|" \
  -e "s|__GEN_RALLLY_OIDC_CLIENT_SECRET__|$(hex 32)|" \
  -e "s|__GEN_DEMO_PASSWORD__|Demo-$(hex 4)-2026|" \
  -e "s|__GEN_RALLLY_SECRET_PASSWORD__|$(hex 32)|" \
  -e "s|__GEN_RALLLY_DB_PASSWORD__|$(hex 24)|" \
  -e "s|__GEN_GARAGE_RPC_SECRET__|$(hex 32)|" \
  -e "s|__GEN_S3_ACCESS_KEY_ID__|GK$(hex 12)|" \
  -e "s|__GEN_S3_SECRET_ACCESS_KEY__|$(hex 32)|" \
  .env.example > "$tmp"
mv "$tmp" .env
chmod 600 .env

echo "✅ .env généré. À noter dans votre gestionnaire de mots de passe :"
grep -E '^(AUTHENTIK_BOOTSTRAP_PASSWORD|DEMO_PASSWORD)=' .env
```

> Formats imposés : Garage exige une clé d'accès `GK` + 24 caractères hex et un secret de 64 hex, ce que fait le script. Rallly exige `SECRET_PASSWORD` ≥ 32 caractères (64 ici).
> Sous Windows : ces scripts sont en bash. Claude Code les exécute via Git Bash (fourni avec Git for Windows, avec `openssl`, `sed` et `curl`). Si un humain veut les lancer lui-même, c'est dans **Git Bash**, pas dans PowerShell.

---

## 6. Démarrer la stack en local (tout le monde)

```bash
git clone https://github.com/MatisRault/Rendu-dev-docker-robin-matis-yohan-projet-groupe-du-fond.git
cd Rendu-dev-docker-robin-matis-yohan-projet-groupe-du-fond
./stack.sh env    # = bash scripts/gen-env.sh
./stack.sh up     # = docker compose up -d
./stack.sh ps     # tout doit être "running" / "healthy" (Authentik met ~1-2 min)
```

Ouvrir `https://auth.localhost` puis `https://rallly.localhost`.

**Supprimer l'avertissement TLS (optionnel)** : `./stack.sh ca` exporte `certs/caddy-root.crt` (gitignoré). Sous Windows : double-clic sur le fichier → *Installer le certificat* → *Utilisateur actuel* → *Placer tous les certificats dans le magasin suivant* → **Autorités de certification racines de confiance**. Chrome et Edge l'utilisent tout de suite. Firefox a son propre magasin : Paramètres → Vie privée et sécurité → Certificats → Afficher les certificats → Autorités → Importer.

Repartir de zéro : `./stack.sh reset` (= `docker compose down -v`, ⚠️ efface les données).

---

## 7. Comptes de démo (créés automatiquement par le blueprint de P2)

| Compte | E-mail | Groupe Authentik | Rallly | Mailpit | Rôle dans la démo |
|---|---|---|---|---|---|
| `akadmin` | `akadmin@example.com` | authentik Admins | — | — | Admin IdP (mot de passe : `AUTHENTIK_BOOTSTRAP_PASSWORD`) |
| `admin` | `admin@example.com` | `rallly-admins` | ✅ + Control Panel | ✅ | Admin applicatif |
| `alice` | `alice@example.com` | `rallly-users` | ✅ | ❌ refusé | Utilisatrice standard |
| `bob` | `bob@example.com` | `sans-acces` | ❌ refusé | ❌ | Prouve la policy de refus |
| `carol` (créée en démo) | `carol@example.org` | `externes` | ✅ | ❌ | Invitée externe |

Mot de passe commun = `DEMO_PASSWORD`. Sur la VM, il est communiqué au formateur **hors dépôt** (slide ou message).

---

## 8. Développer une feature dans `app/rallly/` (workflow commun)

### Installation (une fois, après l'import fait par P3)
```bash
cd ~/projets/Rendu-dev-docker-robin-matis-yohan-projet-groupe-du-fond/app/rallly
corepack enable                          # active la bonne version de pnpm
# Version de Node : voir .nvmrc / "engines" dans package.json
pnpm install
```
Suivez ensuite la section *development* du README / CONTRIBUTING de Rallly (présent dans `app/rallly/`) : copier le fichier d'env d'exemple, lancer la BDD de dev, appliquer les migrations Prisma, puis `pnpm dev`. Les noms exacts des scripts sont dans `package.json` (cherchez `db:` et `dev`). Le `.env` de dev de Rallly est déjà ignoré par le `.gitignore` de Rallly : vérifiez quand même avec `git status`.

### Repères dans le code (à vérifier sur la version importée)
- Schéma BDD : package `database` → `prisma/schema.prisma`. Toute modif = **une migration Prisma dédiée à votre feature** (`prisma migrate dev --name <feature>`).
- API : routeurs tRPC dans `apps/web/src/trpc/routers/` (sondages, participants, commentaires…). **Toute règle métier doit être vérifiée côté serveur**, pas seulement masquée dans l'UI : le formateur peut tester l'API.
- UI : `apps/web/src/components/` et `apps/web/src/app/`.
- Traductions : `apps/web/public/locales/<langue>/*.json`. Ajoutez au moins `fr` et `en`.
- E-mails : package `emails`.

### Branches et règles
- Une branche par feature : `feat/<nom>`, qui ne modifie que `app/rallly/` (+ sa section de `docs/features.md`).
- **On ne met pas à jour la version de Rallly** en cours de projet (sauf décision commune) : la version importée est figée dans `app/rallly/UPSTREAM_VERSION`.
- Deux migrations Prisma créées en parallèle peuvent entrer en conflit : rebasez sur `main`, et si besoin supprimez/régénérez votre migration avant de merger.
- Pratique pour la soutenance : `git diff rallly-import..main --stat -- app/rallly` (tag posé par P3 sur le commit d'import) montre exactement **tout le code que vous avez ajouté**.

### Tester sa feature dans la vraie stack (SSO compris)
**Sous Windows, préférez l'option B** : l'image Docker se comporte exactement comme en prod, alors que le mode dev de Rallly peut dépendre d'outils Unix.

Option A, rapide : `pnpm dev` sur `http://localhost:3000` avec ces variables dans le `.env` de dev de Rallly (`app/rallly/…`) :
```dotenv
NEXT_PUBLIC_BASE_URL=http://localhost:3000
OIDC_NAME=Authentik
OIDC_DISCOVERY_URL=https://auth.localhost/application/o/rallly/.well-known/openid-configuration
OIDC_CLIENT_ID=rallly
OIDC_CLIENT_SECRET=<valeur de RALLLY_OIDC_CLIENT_SECRET dans le .env racine>
NODE_EXTRA_CA_CERTS=C:\Users\<toi>\projets\Rendu-dev-docker-robin-matis-yohan-projet-groupe-du-fond\certs\caddy-root.crt   # après "./stack.sh ca"
```
Les e-mails de dev : lisez les liens dans les logs de `pnpm dev`, ou utilisez Option B.
L'URI `http://localhost:3000/api/auth/callback/oidc` est déjà autorisée dans le blueprint.

Option B, fidèle à la prod : construire l'image et la brancher dans la stack.
```bash
./stack.sh build-rallly    # = docker build -f app/rallly/apps/web/Dockerfile -t rallly-local:dev app/rallly
# dans le .env racine :
RALLLY_IMAGE=rallly-local:dev
docker compose up -d rallly
```

### Pistes pour les 12 features du catalogue
Vérifiez d'abord ce qui existe déjà dans le schéma Prisma : Rallly propose déjà certaines options de sondage (masquer les participants, désactiver les commentaires, exiger l'e-mail…). Le sujet autorise une **variante ou ré-implémentation**, mais votre démo doit montrer ce que **vous** avez ajouté (ex. contrôle côté API, seuil, mode verrouillé).

| # | Feature | Piste technique |
|---|---|---|
| 1 | Vote verrouillé OAuth | Option de sondage `requireAuth` ; refus dans la mutation « ajouter/modifier participant » si l'utilisateur est invité (guest) ; préremplir et figer nom/e-mail depuis la session OIDC ; UI : bouton « Se connecter avec Authentik » à la place du formulaire. |
| 2 | Votes anonymes | Filtrer côté serveur les votes des autres dans la requête qui renvoie les participants (sauf pour le créateur) ; option de seuil ou « jusqu'à finalisation ». |
| 3 | Plafond par créneau | Champ `maxParticipants` sur `Option` ; dans la mutation de vote, compter les `yes` existants dans une transaction ; UI : option grisée + message. |
| 4 | Expiration | Champ `deadline` sur `Poll` ; refus des mutations de vote après échéance ; badge dans l'UI. |
| 5 | Créneaux passés | Comparer le début de l'option à `now` (attention fuseaux et options « journée entière ») côté API + désactiver dans l'UI. |
| 6 | Sondage de lieu | Nouveau modèle (nom, adresse, lien) lié au sondage + votes associés, ou type d'option « lieu ». |
| 7 | Vue calendrier | Composant grille mensuelle qui réutilise les mutations de vote existantes. |
| 8 | Réservation | Nouveau type de sondage avec créneaux à capacité 1 (proche de la #3). Difficile : à éviter sauf si attribuée. |
| 9 | Désactiver commentaires | Si l'option existe déjà : ajouter le refus côté routeur de commentaires et le démontrer via l'API. |
| 10 | Export ICS | Route `GET /api/polls/[id]/ics` (lib `ics`) pour le créneau finalisé ou les options ; démo : import dans un client calendrier. |
| 11 | Invitations nominatives | Mutation « inviter » (liste d'e-mails) qui envoie via le package e-mails ; démo dans Mailpit. |
| 12 | Analyse des résultats | Score (oui = 2, si nécessaire = 1), classement et graphique. |

---

## 9. Démarrage : qui fait quoi, dans quel ordre (jour 1)

C'est le **seul moment séquentiel** du projet. Le dépôt existe déjà et tout le monde y a accès : **P1 démarre immédiatement**. Après son signal « GO », les 3 travaillent en parallèle.

### Vérification rapide (les 3, 2 min, avant tout)
```bash
# (Claude Code fait cette vérification tout seul au §0.3)
docker version            # le daemon doit répondre (Docker Desktop lancé)
docker compose version    # Compose v2 obligatoire
git config --global core.autocrlf false   # évite que Git convertisse les fins de ligne en CRLF
git clone https://github.com/MatisRault/Rendu-dev-docker-robin-matis-yohan-projet-groupe-du-fond.git
cd Rendu-dev-docker-robin-matis-yohan-projet-groupe-du-fond
```
Environnement : **Windows natif**, avec Docker Desktop, Git for Windows (qui fournit Git Bash) et Claude Code. Les humains lancent `claude` depuis PowerShell ; Claude Code exécute les commandes du projet via Git Bash et `./stack.sh`. Il n'y a pas de `make` sous Windows, d'où ce script.

Côté Docker Desktop : dans *Settings → Resources*, ou via `%UserProfile%\.wslconfig` puisque Docker Desktop tourne sur WSL2 en interne, donnez-lui **au moins 6 Go de RAM**. La stack complète plus le build de l'image Rallly en ont besoin.

| Ordre | Qui | Action | Durée | Signal à envoyer sur le groupe |
|---|---|---|---|---|
| 1 | P1 | Fait les étapes 1 à 4 de `01-PLATEFORME-INFRA.md` dans le clone (squelette, `.gitattributes`, `compose.yml`, Caddyfile, `stack.sh`, `.env.example`, `gen-env.sh`, `compose.authentik.yml` et `compose.rallly.yml` vides, les 4 fichiers du plan dans `docs/plan/` + `CLAUDE.md`). Vérifie le test ci-dessous, puis **pousse directement sur `main`**. | 30-60 min | « **GO** » |
| 1 bis | P3 (en même temps que P1) | Prépare l'import de Rallly dans `/tmp/rallly-src` (étape 1 de `03-…`). **Ne commite et ne pousse rien** dans le dépôt avant le GO. | 15 min | |
| 1 ter | P2 (en même temps que P1) | Lit son fichier et la doc Authentik. **N'écrit rien** dans le dépôt avant le GO. | | |
| 2 | P3 | Juste après le GO : active la protection de `main` (PR obligatoire). | 2 min | « main protégée, tout passe par PR » |
| 3 | P2 et P3 | `git pull`, créent leur branche (`p2/authentik`, `p3/import-rallly`) et démarrent leur fichier. | | |

> Si `main` est **déjà protégée**, P1 ne peut pas pousser directement : il pousse sa branche `p1/squelette`, ouvre une PR, et P3 (ou P2) la merge tout de suite **sans attendre la CI** (elle n'existe pas encore). Le GO est donné après le merge.

### Test que P1 doit valider avant de donner le GO
```bash
./stack.sh env && ./stack.sh config && ./stack.sh up
docker compose ps        # caddy "running", ca-export "exited (0)", mailpit "running"
curl -sk -o /dev/null -w "%{http_code}\n" https://auth.localhost    # 502 attendu (Authentik pas encore là) = Caddy OK
git status               # .env et certs/ NE doivent PAS apparaître
```

### Ce qui n'attend personne après le GO
- **P1** : durcissement, scan, et **tout de suite** la procédure Énov (compte, VPN, VM). C'est la plus longue et elle ne dépend de personne.
- **P2** : Authentik ne dépend que de Caddy. Il peut tout faire et tout tester seul (groupes, comptes, invitation).
- **P3** : import de Rallly (PR à merger en premier, car les features en dépendent), Compose Rallly avec l'image officielle, pipeline CI.
- **Features** : chacun peut démarrer dès que la PR d'import de Rallly est mergée.

### Les seuls moments où on s'attend
| Quand | Condition | Qui attend |
|---|---|---|
| Test SSO de bout en bout | PR Authentik (P2) **et** PR Rallly (P3) mergées | P2 et P3 testent ensemble (15 min) |
| Déploiement VM avec votre image | VM prête (P1) **et** image GHCR publique (P3) | P1. En attendant, il déploie avec `lukevella/rallly:4` |

---

## 10. Jalons (fil rouge sur 28 h) et seuls points de synchro

| Jalon | Contenu | Porteur | Bloque |
|---|---|---|---|
| J0 (1re heure) | Dépôt GitHub + squelette (P1), `.env.example`, `gen-env.sh`, `compose.yml` de base ; import des sources Rallly dans `app/rallly/` (P3) | P1 + P3 | tout |
| J1 | `docker compose up` : Caddy + Authentik + Rallly répondent en HTTPS | les 3 | SSO |
| J2 | SSO Rallly via Authentik + groupes + invitation | P2 | démo |
| J3 | CI verte sur `main`, image GHCR publiée | P3 | VM |
| J4 | Stack déployée sur la VM Énov, URL accessible au formateur | P1 | soutenance |
| J5 | 3 features mergées dans `main`, image redéployée | les 3 | — |
| J6 | Répétition chronométrée de la soutenance | les 3 | — |

**Synchros obligatoires** (15 min max) : après J1, avant J4, à J6. Le reste passe en asynchrone : PR + issues GitHub + un canal de discussion.

**Priorité absolue (critères du sujet)** : l'infra stable avant les features. Si J1 à J4 ne sont pas atteints, on gèle les features.

---

## 11. Suivi

| Feature | Numéro catalogue | Porteur | Branche | Statut |
|---|---|---|---|---|
| Catalogue A | # | P1 | `feat/…` | |
| Catalogue B | # | P2 | `feat/…` | |
| Libre | — | P3 | `feat/…` | |

Bonus upstream (+1 point par feature mergée chez `lukevella/rallly`) : **facultatif**, hors barème de base. On ne le vise pas par défaut. Si une feature s'y prête vraiment et qu'il reste du temps à la fin, on en reparle.

---

## 12. Soutenance (15 min + 3 min de questions)

| Temps | Qui | Contenu |
|---|---|---|
| 0–4 min | P1 | Architecture (schéma), réseaux et volumes, local vs VM, choix de sécurité et limites |
| 4–8 min | P2 | Démo live : SSO alice, refus bob, refus Mailpit pour alice, invitation de carol |
| 8–11 min | P3 | Pipeline vert, image GHCR, déploiement, import de Rallly et diff de notre code |
| 11–15 min | les 3 | Une feature chacun, 1 min 15 max |

Prévoir des **captures et une vidéo de secours** de chaque démo, au cas où la VM ou le VPN tomberait.

---

## 13. Règles anti-galère
- `.env`, `certs/` et tout fichier de secret sont dans `.gitignore`. Avant chaque push : `git status`. Le CI lance gitleaks.
- On ne fait jamais `docker compose down -v` sur la VM sans prévenir.
- Toute variable d'env ajoutée sans `.env.example` = PR refusée.
- Une démo qui marche « chez moi » doit marcher après `./stack.sh reset && ./stack.sh up`.
- Les fins de ligne restent en LF (le `.gitattributes` s'en charge). Si un script plante avec `$'\r': command not found`, c'est un fichier en CRLF : `git add --renormalize .` puis recommitez.
