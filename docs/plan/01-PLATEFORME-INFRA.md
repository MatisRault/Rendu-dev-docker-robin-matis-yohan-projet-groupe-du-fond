# 01 — Personne 1 : Plateforme, reverse proxy, durcissement, VM Énov

**Tu es le gardien du socle** : le `compose.yml` de base, Caddy, les réseaux, Mailpit, le durcissement de toute la stack, le scan commenté et le déploiement sur la VM. Plus une feature du catalogue.

## 👤 Pour toi, humain (2 minutes, rien d'autre à lire)

1. Ouvre **PowerShell** (menu Démarrer → tape « PowerShell »).
2. Copie-colle cette ligne et appuie sur Entrée : elle crée un dossier et l'ouvre dans l'explorateur.
   ```powershell
   New-Item -ItemType Directory -Force "$HOME\projets\plan-rallly" | Out-Null; explorer "$HOME\projets\plan-rallly"
   ```
3. Glisse les **4 fichiers `.md` du plan** dans la fenêtre qui s'est ouverte.
4. Dans PowerShell, tape ces lignes **une par une** (Entrée après chacune) :
   ```powershell
   cd $HOME\projets
   git clone https://github.com/MatisRault/Rendu-dev-docker-robin-matis-yohan-projet-groupe-du-fond.git
   cd Rendu-dev-docker-robin-matis-yohan-projet-groupe-du-fond
   claude
   ```
   Si la 2e ligne répond que le dossier existe déjà, ce n'est pas grave : continue.
5. Colle ce message à Claude Code :
   ```
   Lis ~/projets/plan-rallly/00-COMMUN.md puis ~/projets/plan-rallly/01-PLATEFORME-INFRA.md, et exécute la section « Instructions pour Claude Code » du second, du début à la fin.
   ```
6. Ensuite, **réponds simplement à ses questions**. Quand il demande l'autorisation de lancer une commande, accepte. Pour `git`, `gh`, `docker` et `./stack.sh`, choisis « Yes, and don't ask again » pour aller plus vite.

**Les sessions suivantes** : PowerShell → `cd $HOME\projets\Rendu-dev-docker-robin-matis-yohan-projet-groupe-du-fond` → `claude` → recolle le même message. Il reprend tout seul là où il s'était arrêté.

## 🤖 Instructions pour Claude Code

Tu es l'assistant de **P1**. Fais exactement ceci, dans l'ordre :

1. **Règles** : applique toute la section 0 de `00-COMMUN.md` (rôle, environnement Windows/Git Bash, workflow Git, blocs STOP).
2. **PC** : vérification §0.3, jusqu'à ce que tout soit ✅.
3. **Dépôt** : §0.4.
4. **Reprise** : §0.5. Si un travail existe déjà, reprends-le. Sinon, continue.
5. **Démarrage** : tu es **le premier**, personne à attendre. Fais les étapes 1 à 4 ci-dessous **directement sur `main`** (c'est la seule exception au §0.6), puis le bloc **🛑 STOP — fin du squelette**.
6. Après le GO : étapes 5 à 8 dans l'ordre, chacune sur sa branche `p1/…` avec une PR (§0.6). Dès que l'étape 5 est lancée, déclenche le **STOP de l'étape 6** (VM) pour que l'humain crée la VM en parallèle : c'est l'étape la plus longue.
7. Quand une étape terminée débloque quelqu'un (voir §9 « Les seuls moments où on s'attend »), donne à l'humain **le message exact à envoyer au groupe**.
8. À la fin : coche la *Definition of done* et dis à l'humain ce qui reste éventuellement à faire (en principe : la répétition de la soutenance).

## Tes livrables
- [ ] Squelette du dépôt (J0, **en premier** : les autres en dépendent)
- [ ] `.gitattributes`, `compose.yml`, `proxy/Caddyfile`, `stack.sh`, `scripts/gen-env.sh`, `.gitignore`, `.env.example`
- [ ] Durcissement appliqué et documenté pour **tous** les services (y compris ceux de P2/P3, via PR ou review)
- [ ] Scan Trivy commenté → `docs/securite.md`
- [ ] Stack déployée sur la VM Énov + `docs/vm-enov.md`
- [ ] `README.md` + `docs/architecture.md` avec un schéma (draw.io / Excalidraw exporté en PNG/SVG)
- [ ] Feature catalogue A dans `app/rallly/`

---

## Étape 1 — Squelette (J0, ~1 h)

Toutes les commandes se lancent **dans Git Bash**, sous Windows.

```bash
# On travaille dans le clone du dépôt existant (pas de git init)
cd ~/projets/Rendu-dev-docker-robin-matis-yohan-projet-groupe-du-fond
git checkout main && git pull
mkdir -p proxy authentik/blueprints config scripts docs/plan .github/workflows certs
# app/rallly/ est créé par P3 (import des sources Rallly)
# Si le dépôt contient déjà un README généré par GitHub, on le garde et on le remplira (étape 7)
touch authentik/blueprints/.gitkeep certs/.gitkeep
```

Copie depuis `00-COMMUN.md` : `.env.example` et `scripts/gen-env.sh`.

### `.gitattributes` — à commiter EN PREMIER
Sous Windows, Git convertit les fins de ligne en CRLF à l'extraction. Or les scripts bash, et les fichiers montés ou copiés dans des conteneurs Linux, **cassent** avec du CRLF. Ce fichier force LF pour tout le monde, quelle que soit la config Git de chacun :
```gitattributes
* text=auto eol=lf
*.png binary
*.jpg binary
*.ico binary
*.woff binary
*.woff2 binary
```

### Bit exécutable
Windows ne gère pas le bit exécutable, alors que la CI et la VM sont sous Linux. Après avoir créé les scripts :
```bash
git add stack.sh scripts/*.sh
git update-index --chmod=+x stack.sh scripts/*.sh
```
Par sécurité, la CI et la doc appellent de toute façon les scripts via `bash scripts/xxx.sh`.

### `.gitignore`
```gitignore
.env
.env.*
!.env.example
certs/*
!certs/.gitkeep
docs/scan/*.json
*.pem
*.key
node_modules/
.next/
```

Pour que `docker compose up` marche dès J0, crée aussi des fichiers **vides mais valides** pour P2 et P3 (ils les remplaceront) :
```yaml
# compose.authentik.yml et compose.rallly.yml (temporaire)
services: {}
```

Ne pousse pas encore : termine les étapes 2 à 4, valide le test du §9 de `00-COMMUN.md`, **puis** pousse sur `main` et envoie « GO ». P3 protège `main` juste après.

---

## Étape 2 — `compose.yml` (base)

```yaml
# compose.yml — socle : réseaux, volumes, reverse proxy, mail de lab
# Les services Authentik (P2) et Rallly (P3) sont dans leurs propres fichiers,
# chargés via COMPOSE_FILE dans .env.

services:
  caddy:
    image: caddy:2.10-alpine
    restart: unless-stopped
    ports:
      - "${HTTP_BIND:-127.0.0.1}:80:80"
      - "${HTTP_BIND:-127.0.0.1}:443:443"
    environment:
      BASE_DOMAIN: ${BASE_DOMAIN}
    volumes:
      - ./proxy/Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    networks:
      edge:
        # Permet aux conteneurs (Rallly) de joindre les URL publiques via Caddy
        aliases:
          - auth.${BASE_DOMAIN}
          - rallly.${BASE_DOMAIN}
          - mail.${BASE_DOMAIN}
    read_only: true
    tmpfs: [/tmp]
    cap_drop: [ALL]
    cap_add: [NET_BIND_SERVICE]
    security_opt: ["no-new-privileges:true"]
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://127.0.0.1:2019/config/"]
      interval: 10s
      timeout: 3s
      retries: 10

  # Copie UNIQUEMENT le certificat public de la CA Caddy dans un volume dédié,
  # pour que Rallly lui fasse confiance sans accéder à la clé privée de la CA.
  ca-export:
    image: busybox:1.37
    restart: "no"
    depends_on:
      caddy:
        condition: service_started
    command:
      - sh
      - -c
      - |
        i=0
        until [ -f /data/caddy/pki/authorities/local/root.crt ]; do
          i=$$((i+1)); [ $$i -gt 60 ] && echo "CA introuvable" && exit 1; sleep 1
        done
        cp /data/caddy/pki/authorities/local/root.crt /ca/root.crt
        chmod 444 /ca/root.crt
        echo "CA exportée"
    volumes:
      - caddy_data:/data:ro
      - ca_public:/ca
    network_mode: none
    security_opt: ["no-new-privileges:true"]

  mailpit:
    image: axllent/mailpit:v1.27   # vérifier la dernière version stable
    restart: unless-stopped
    user: "65534:65534"
    environment:
      MP_SMTP_AUTH_ACCEPT_ANY: "true"      # SMTP de lab : accepte n'importe quel login
      MP_SMTP_AUTH_ALLOW_INSECURE: "true"
      MP_MAX_MESSAGES: "500"
    networks: [edge, mail]
    read_only: true
    tmpfs: [/tmp]
    cap_drop: [ALL]
    security_opt: ["no-new-privileges:true"]

networks:
  edge: {}
  mail:
    internal: true
  authentik_backend:
    internal: true
  rallly_backend:
    internal: true

volumes:
  caddy_data:
  caddy_config:
  ca_public:
  authentik_db:
  rallly_db:
  garage_meta:
  garage_data:
```

> Les volumes de P2 et P3 sont déclarés ici, à un seul endroit : leurs fichiers les **utilisent** sans les redéclarer.
> Mailpit est sur `edge` uniquement pour que Caddy serve son UI. Il n'a aucun port publié.

---

## Étape 3 — `proxy/Caddyfile`

```caddyfile
{
	# Toute la stack utilise la CA interne de Caddy (VM non publique → pas de Let's Encrypt)
	local_certs
	skip_install_trust
	admin 127.0.0.1:2019
}

(security_headers) {
	header {
		Strict-Transport-Security "max-age=31536000"
		X-Content-Type-Options "nosniff"
		Referrer-Policy "strict-origin-when-cross-origin"
		-Server
	}
}

auth.{$BASE_DOMAIN} {
	import security_headers
	reverse_proxy authentik-server:9000
}

rallly.{$BASE_DOMAIN} {
	import security_headers
	reverse_proxy rallly:3000
}

# Bloc géré par P2 : forward-auth Authentik (réservé au groupe rallly-admins).
# En attendant, Mailpit est accessible sans auth.
mail.{$BASE_DOMAIN} {
	import security_headers
	reverse_proxy mailpit:8025
}
```

Valider la syntaxe (après l'étape 4) : `./stack.sh validate-caddy`.

---

## Étape 4 — `stack.sh` (remplace `make`, absent sous Windows)

Script à la racine, à lancer dans Git Bash (Windows), et aussi sur la VM et en CI (Linux).

```bash
#!/usr/bin/env bash
# Commandes du projet. Usage : ./stack.sh <commande>   (dans Git Bash sous Windows)
set -euo pipefail
cd "$(dirname "$0")"

# Git Bash convertit les chemins /xxx en C:/Program Files/Git/xxx : on désactive
# cette conversion, sinon les volumes et docker cp cassent.
export MSYS_NO_PATHCONV=1
# Chemin du dépôt au format compris par Docker Desktop (C:/...) sous Windows, $PWD sinon
if HERE="$(pwd -W 2>/dev/null)"; then :; else HERE="$PWD"; fi

cmd="${1:-help}"; shift || true
case "$cmd" in
  env)          bash scripts/gen-env.sh "$@" ;;
  up)           docker compose up -d ;;
  down)         docker compose down ;;
  ps)           docker compose ps ;;
  logs)         docker compose logs -f --tail=100 "$@" ;;          # ./stack.sh logs rallly
  config)       docker compose config -q && echo "config OK" ;;
  pull)         docker compose pull ;;
  ca)           mkdir -p certs
                docker compose cp caddy:/data/caddy/pki/authorities/local/root.crt certs/caddy-root.crt
                echo "→ certs/caddy-root.crt (double-clic pour l'installer)" ;;
  reset)        read -r -p "⚠️  Supprimer TOUTES les données ? (oui/non) " r
                [[ "$r" == "oui" ]] && docker compose down -v --remove-orphans ;;
  build-rallly) docker build -f app/rallly/apps/web/Dockerfile -t rallly-local:dev app/rallly ;;
  validate-caddy)
                docker run --rm -e BASE_DOMAIN=localhost -v "$HERE/proxy:/etc/caddy:ro" \
                  caddy:2.10-alpine caddy validate --config /etc/caddy/Caddyfile ;;
  scan)         mkdir -p docs/scan
                for img in $(docker compose config --images | sort -u); do
                  name="$(echo "$img" | tr '/:' '__')"
                  docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy:latest \
                    image --scanners vuln --severity HIGH,CRITICAL --format table "$img" \
                    | tee "docs/scan/$name.txt"
                done ;;
  smoke)        bash scripts/smoke-test.sh "${1:-localhost}" ;;
  *) cat <<'USAGE'
Usage : ./stack.sh <commande>
  env            génère .env (secrets aléatoires)   [--force pour écraser]
  up | down | ps | pull | config
  logs [svc]     logs en continu (ex. ./stack.sh logs authentik-worker)
  ca             exporte la CA Caddy dans certs/caddy-root.crt
  reset          ⚠️ supprime toutes les données
  build-rallly   construit l'image Rallly depuis app/rallly
  validate-caddy vérifie la syntaxe du Caddyfile
  scan           scan Trivy de toutes les images → docs/scan/
  smoke [dom]    test de bout en bout (Authentik, OIDC, Rallly)
USAGE
  ;;
esac
```

> `reset` demande une confirmation, parce qu'un `down -v` lancé par erreur efface Authentik et les sondages. Pour cette raison, la CI ne l'utilise pas : elle appelle directement `docker compose down -v`.
> Claude Code ne peut pas répondre à la question de confirmation. Pour un reset, il doit demander à l'humain de lancer `./stack.sh reset` lui-même.

---

## 🛑 STOP — fin du squelette (après l'étape 4)

Claude Code, arrête-toi ici. Fais seulement ceci :
1. Copie les 4 fichiers du plan (depuis `~/projets/plan-rallly/`) dans `docs/plan/`, crée `docs/avancement/p1.md` (§0.5), et crée `CLAUDE.md` à la racine avec les règles du projet : appliquer la section 0 de `docs/plan/00-COMMUN.md` ; respecter les blocs 🛑 STOP ; ne modifier que ses fichiers ; ne jamais commiter `.env` ni `certs/` ; **environnement Windows, shell Git Bash, toujours passer par `./stack.sh`, pas de `make`, fichiers en LF**.
2. Applique le bit exécutable : `git update-index --chmod=+x stack.sh scripts/*.sh` (après `git add`).
3. Lance le test du §9 de `00-COMMUN.md` (dans Git Bash) et montre le résultat.
4. Vérifie avec `git status` que `.env` et `certs/` ne sont pas suivis, et avec `git ls-files --eol | grep crlf` qu'aucun fichier n'est en CRLF (la sortie doit être vide).
5. Fais un commit `chore: squelette du dépôt`.
6. Demande à l'humain : « Le squelette est prêt et testé (résumé : …). Je pousse sur `main` ? (oui/non) »
7. Après le oui : `git push origin main`. Si c'est refusé parce que `main` est déjà protégée : `git switch -c p1/squelette && git push -u origin p1/squelette && gh pr create --fill && gh pr merge --merge --admin` (si l'humain n'est pas admin, donne-lui le lien de la PR et le message à envoyer pour qu'un autre la merge).
8. Donne à l'humain le message exact à envoyer au groupe :
   > « **GO** ✅ Le squelette est sur `main`. Lancez Claude Code avec votre fichier. »
   Puis attends qu'il confirme l'avoir envoyé.

**Ne continue pas à l'étape 5 avant cette confirmation.** Après le GO, tout se fait sur des branches `p1/…` avec des PR (P3 protège `main`).

---

## Étape 5 — Durcissement (toute la stack)

Ce que le sujet attend (« utilisateur non-root, surface d'attaque réduite, scan commenté ») doit se voir dans un tableau de `docs/securite.md`. Remplis-le en exécutant `docker compose exec <svc> id` et `docker inspect`.

| Service | Utilisateur effectif | `read_only` | `cap_drop` | Ports hôte | Réseaux | Remarque |
|---|---|---|---|---|---|---|
| caddy | root (caps réduites à NET_BIND_SERVICE) | ✅ | ALL | 80/443 | edge | Seul point d'entrée |
| ca-export | root, `network_mode: none` | — | — | — | aucun | One-shot |
| mailpit | 65534 | ✅ | ALL | — | edge, mail | |
| authentik-server | à compléter (normalement uid 1000) | | | — | | |
| authentik-worker | idem, **sans socket Docker** | | | — | | Le compose officiel le passe en root uniquement pour le socket : on ne monte pas le socket |
| authentik-db | postgres (après entrypoint) | | | — | interne | |
| rallly | à vérifier (`docker inspect -f '{{.Config.User}}'`) | | | — | | |
| rallly-db | postgres | | | — | interne | |
| garage | à vérifier | | | — | interne | |

Checklist à appliquer (et à faire appliquer en review sur les PR de P2/P3) :
- `security_opt: ["no-new-privileges:true"]` partout.
- `cap_drop: [ALL]` partout où ça démarre. Postgres a besoin de `CHOWN`, `SETUID`, `SETGID`, `FOWNER`, `DAC_OVERRIDE` à l'init : teste, et documente ce que tu as dû rajouter.
- `read_only: true` + `tmpfs` là où c'est possible ; sinon, explique pourquoi.
- Aucun `ports:` hors Caddy. Les réseaux backend sont `internal: true` (pas d'egress Internet).
- Images **épinglées** par tag de version (bonus : par digest `@sha256:` sur la VM).
- Secrets uniquement via `.env` (hors dépôt). Bonus : passer les mots de passe BDD en `secrets:` Compose (`POSTGRES_PASSWORD_FILE`).
- Amélioration possible pour Caddy non-root : `user: "1000:1000"` + `sysctls: net.ipv4.ip_unprivileged_port_start: 0` + volumes `/data` et `/config` appartenant à 1000. Tente-le si tu as le temps, sinon mets-le en « limite assumée ».

### Scan commenté (`docs/securite.md`)
`./stack.sh scan`, puis pour chaque image : nombre de HIGH/CRITICAL, 2-3 CVE commentées (« paquet de l'OS de base, non exploitable car… », « corrigé en version X, montée de version faite / prévue »), et les actions prises (changement de tag, image alpine…). C'est ce commentaire qui est noté, pas le chiffre brut.

---

## Étape 6 — VM Énov (J4)

> 🛑 **STOP — partie manuelle (guide l'humain pas à pas).** Claude Code, prépare d'abord tout ce que tu peux faire toi-même :
> - Si `~/.ssh/id_ed25519.pub` n'existe pas : `ssh-keygen -t ed25519 -N "" -f ~/.ssh/id_ed25519`.
> - Lance `winget search netbird` pour trouver l'identifiant exact du client NetBird.
>
> Puis guide l'humain **une action à la fois**, en attendant sa confirmation entre chaque :
> 1. Ouvrir la doc Énov (https://github.com/Enov-Salle-Serveur/Documentation_Public) et créer son compte. Tu lui résumes la section concernée si besoin.
> 2. Installer NetBird : dans PowerShell, `winget install -e --id <id trouvé>`, puis se connecter au VPN comme indiqué par la doc Énov.
> 3. Déposer la clé SSH sur le portail : affiche-lui le contenu de `~/.ssh/id_ed25519.pub` et dis-lui où le coller.
> 4. Créer la VM (2 vCPU, 4 Go de RAM, 20 Go de disque minimum, Ubuntu ou Debian), puis te donner **l'IP** et **le nom d'utilisateur**.
>
> Teste ensuite `ssh -o BatchMode=yes <user>@<ip> echo ok`. Pendant que l'humain fait tout ça, tu peux continuer l'étape 5, mais rien de l'étape 6. Ensuite, fais toi-même toute l'étape 6 **en SSH** depuis ce terminal.

### 6.1 Accès (doc officielle Énov)
Suis **dans l'ordre** la doc publique `Enov-Salle-Serveur/Documentation_Public` : création du compte → installation du client **NetBird** et connexion au VPN → dépôt de ta **clé SSH** publique → **création de la VM**. Note dans `docs/vm-enov.md` chaque étape avec captures et pièges rencontrés.

Dimensionnement : Authentik demande 2 vCPU / 2 Go à lui seul. Vise **2 vCPU minimum, 4 Go de RAM, 20 Go de disque** pour toute la stack. Si l'offre est plus petite, documente-le et ajoute du swap.

Récupère l'IP de la VM joignable via le VPN (`ip -4 a` sur la VM). Exemple : `10.42.0.17` → `BASE_DOMAIN=10-42-0-17.sslip.io`.

### 6.2 Préparation de la VM
Depuis Windows : le client NetBird s'installe comme une application Windows normale. `ssh` et `ssh-keygen` sont disponibles dans Git Bash et dans PowerShell. La clé publique à déposer est `~/.ssh/id_ed25519.pub` (créée avec `ssh-keygen -t ed25519` si besoin).
```bash
ssh <user>@<ip-vm>
sudo apt update && sudo apt -y upgrade
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER   # ⚠️ groupe docker = équivalent root : à mentionner dans les limites
exit && ssh <user>@<ip-vm>     # reconnexion pour appliquer le groupe
docker compose version          # v2.20+ requis
```

Pare-feu : `sudo ufw allow OpenSSH && sudo ufw allow 80,443/tcp && sudo ufw enable`.
⚠️ **Piège** : Docker contourne ufw pour les ports publiés. C'est sans gravité ici puisque seul Caddy publie des ports, mais **dis-le** en soutenance.

### 6.3 Déploiement
```bash
git clone https://github.com/MatisRault/Rendu-dev-docker-robin-matis-yohan-projet-groupe-du-fond.git
cd Rendu-dev-docker-robin-matis-yohan-projet-groupe-du-fond
bash scripts/gen-env.sh
nano .env
#   BASE_DOMAIN=10-42-0-17.sslip.io
#   HTTP_BIND=0.0.0.0
#   RALLLY_IMAGE=ghcr.io/matisrault/rendu-dev-docker-robin-matis-yohan-projet-groupe-du-fond/rallly:main   (dès que P3 l'a publiée, en minuscules)
docker compose up -d
docker compose ps
```
Si l'image GHCR ne se télécharge pas : elle est privée par défaut. P3 doit la rendre publique (Package settings → Visibility).

Ensuite, les mises à jour passent par `scripts/deploy.sh` (fourni par P3).

### 6.4 Écarts local / VM à documenter (tableau dans `docs/vm-enov.md`)
| Élément | Local | VM | Pourquoi |
|---|---|---|---|
| `BASE_DOMAIN` | `localhost` | `<ip>.sslip.io` | Pas de DNS public sur le réseau campus |
| `HTTP_BIND` | `127.0.0.1` | `0.0.0.0` | Accès via VPN |
| `RALLLY_IMAGE` | `lukevella/rallly:4` ou `rallly-local:dev` | image GHCR construite depuis `app/rallly/` | Produite par la CI |
| TLS | CA interne Caddy | CA interne Caddy | Identique, aucun écart |
| Fichiers Compose | identiques | identiques | |

### 6.5 Accès formateur
Dans le README : les 3 URL, la consigne « se connecter au VPN NetBird Énov » et « accepter l'avertissement de certificat ou importer `caddy-root.crt` », plus la liste des comptes de démo de `00-COMMUN.md` §7 (mots de passe transmis hors dépôt). Teste depuis le poste d'un camarade **qui n'a jamais ouvert le projet**.

---

## Étape 7 — Documentation

`README.md` (plan imposé, sections remplies par les autres) :
1. Présentation et schéma d'architecture
2. Démarrage rapide local sous Windows (Docker Desktop + Git Bash, `./stack.sh env && ./stack.sh up`, URL, installation de la CA)
3. Comptes de démo
4. Déploiement VM → `docs/vm-enov.md`
5. Authentik → `docs/authentik.md` (P2)
6. CI/CD → `docs/ci-cd.md` (P3)
7. Features → `docs/features.md` (P3 + chacun)
8. Sécurité et limites → `docs/securite.md`
9. Pièges rencontrés (redirect URI, CA, DNS/VPN, SMTP…)

`docs/architecture.md` : le schéma, les tableaux réseaux/ports/volumes de `00-COMMUN.md`, et le flux d'une connexion (navigateur → Caddy → Rallly → redirection Authentik → callback → session).

---

## Étape 8 — Ta feature (catalogue A)

> 🛑 **STOP — choix de la feature.** Claude Code, ne choisis **jamais** la feature toi-même. Demande à l'humain : « Quel numéro du catalogue le formateur t'a-t-il attribué ? Et la PR d'import de Rallly (P3) est-elle mergée dans `main` ? » Si l'une des réponses manque, arrête-toi et continue plutôt les étapes d'infra non terminées. Quand tu as le numéro, mets à jour le tableau §11 de `docs/plan/00-COMMUN.md` (numéro, porteur, branche), puis crée la branche `feat/<nom>`.

Workflow et pistes dans `00-COMMUN.md` §8. Pour la démo, prépare un scénario reproductible en 1 min : sondage préparé à l'avance, deux comptes (admin + alice), et si possible une preuve côté API (refus serveur) en plus de l'UI. Écris ta section dans `docs/features.md` : problème, périmètre, captures, limites.

---

## Definition of done
- [ ] Sur un PC Windows vierge (Docker Desktop + Git) : `git clone` → `./stack.sh env` → `./stack.sh up` → Authentik et Rallly répondent en HTTPS en moins de 3 min
- [ ] `docker compose ps` : aucun port hormis 80/443 ; `docker compose config` valide
- [ ] Tableau de durcissement rempli, scan commenté commité
- [ ] VM accessible depuis le VPN par une personne extérieure au groupe
- [ ] Schéma d'architecture dans le README

## Pièges connus
- **Mot de passe BDD changé après la 1re init** : Postgres garde l'ancien. Il faut `./stack.sh reset`.
- **`*.localhost` dans Safari** : peut ne pas résoudre. Utilisez Chrome/Firefox, ou mettez `BASE_DOMAIN=127-0-0-1.sslip.io` en local.
- **Port 80/443 déjà pris** (Apache, IIS, Skype…) : `sudo lsof -i :443`.
- **`COMPOSE_FILE` ignoré** : il faut lancer les commandes depuis la racine du dépôt (là où se trouve `.env`). Le séparateur est forcé à `:` par `COMPOSE_PATH_SEPARATOR`, ce qui fonctionne sous Windows comme sous Linux, puisque les chemins sont relatifs.
- **`$'\r': command not found`** : un fichier est en CRLF. Vérifie que `.gitattributes` est commité, puis `git add --renormalize . && git commit`.
- **Chemins bizarres (`C:/Program Files/Git/...`) dans une commande docker** : la commande a été lancée hors de `stack.sh`, donc sans `MSYS_NO_PATHCONV=1`. Passe par `./stack.sh`, ou préfixe la commande avec `MSYS_NO_PATHCONV=1`.
- **Port 80 ou 443 occupé sous Windows** : `netstat -ano | findstr ":443"` dans PowerShell, puis regarde le PID dans le Gestionnaire des tâches. Les coupables habituels sont IIS (« Service de publication World Wide Web »), Skype ou un autre logiciel. Si c'est `System` (PID 4), c'est souvent le service HTTP.sys / IIS : arrête-le.
- **Docker Desktop lent ou plantage pendant le build** : augmente la RAM allouée (≥ 6 Go).
- **Blueprints modifiés mais pas pris en compte** : depuis Windows, les changements de fichiers dans un volume monté ne sont pas toujours détectés par le conteneur. `docker compose restart authentik-worker`.
