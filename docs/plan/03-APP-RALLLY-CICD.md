# 03 — Personne 3 : Application Rallly, image custom, CI/CD

**Tu es responsable de l'application et de la chaîne de livraison** : les réglages du dépôt GitHub, l'import des sources Rallly dans `app/rallly/`, l'image custom, la partie Rallly du Compose (app + BDD + stockage), le pipeline CI/CD, le script de déploiement. Plus la feature libre et la consolidation de la doc des features.

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
   Lis ~/projets/plan-rallly/00-COMMUN.md puis ~/projets/plan-rallly/03-APP-RALLLY-CICD.md, et exécute la section « Instructions pour Claude Code » du second, du début à la fin.
   ```
6. Ensuite, **réponds simplement à ses questions**. Quand il demande l'autorisation de lancer une commande, accepte. Pour `git`, `gh`, `docker` et `./stack.sh`, choisis « Yes, and don't ask again » pour aller plus vite.

**Les sessions suivantes** : PowerShell → `cd $HOME\projets\Rendu-dev-docker-robin-matis-yohan-projet-groupe-du-fond` → `claude` → recolle le même message. Il reprend tout seul là où il s'était arrêté.

## 🤖 Instructions pour Claude Code

Tu es l'assistant de **P3**. Fais exactement ceci, dans l'ordre :

1. **Règles** : applique toute la section 0 de `00-COMMUN.md`.
2. **PC** : vérification §0.3, jusqu'à ce que tout soit ✅. Pour P3, `gh` connecté est **obligatoire** (réglages du dépôt). Node est recommandé : s'il manque, propose à l'humain `winget install -e --id OpenJS.NodeJS.LTS` dans PowerShell, puis de rouvrir Git Bash.
3. **Dépôt** : §0.4. Vérifie aussi ta permission : `gh repo view --json viewerPermission -q .viewerPermission`. Si ce n'est pas `ADMIN`, préviens l'humain que la protection de `main` (étape 1) devra être faite par le propriétaire du dépôt, et rédige-lui le message à envoyer.
4. **Avant le GO** : prépare l'import de Rallly **hors du dépôt** (étape 1, uniquement les commandes `git ls-remote` et `git clone … /tmp/rallly-src`). Ensuite, si `git pull` ne fait pas apparaître `compose.yml` et `stack.sh` sur `main`, demande : « As-tu reçu le message **GO** de P1 ? ». Tant que la réponse est non, n'écris rien dans le dépôt.
5. **Reprise** : §0.5.
6. **Juste après le GO**, dans cet ordre : protection de `main` (étape 1), puis `git switch main && git pull`, `git switch -c p3/import-rallly`, import de Rallly, PR, merge **le plus vite possible** (les features de tout le monde en dépendent). Donne ensuite à l'humain le message pour le groupe : « ✅ Rallly importé dans `app/rallly/` sur main. Vous pouvez commencer vos features (Claude vous demandera le numéro attribué). »
7. Puis étapes 2 à 7 dans l'ordre, en respectant les STOP (§0.6 pour les PR).
8. Quand l'image GHCR est publique, donne le message pour le groupe : « ✅ Image publiée : `ghcr.io/matisrault/rendu-dev-docker-robin-matis-yohan-projet-groupe-du-fond/rallly:main` (publique). P1 : tu peux la mettre sur la VM. »
9. À la fin : coche la *Definition of done* et dis à l'humain ce qui reste éventuellement à faire.

## Tes livrables
- [ ] `main` protégée juste après le GO de P1 (J0)
- [ ] Sources Rallly importées dans `app/rallly/` (J0)
- [ ] `compose.rallly.yml` + `config/garage.toml`
- [ ] Pipeline unique `.github/workflows/ci.yml` : lint → qualité app → build image → scan → smoke test de toute la stack → push GHCR
- [ ] `scripts/deploy.sh` + `scripts/smoke-test.sh`
- [ ] `docs/ci-cd.md` (avec captures du pipeline vert) + `docs/features.md`
- [ ] Feature libre

---

## Étape 1 — Dépôt et import des sources Rallly (J0)

### Le dépôt
1. Le dépôt existe déjà et les 3 sont collaborateurs : rien à créer.
2. **Après le GO de P1** : protège `main` (PR obligatoire, 0 review) avec cette commande, si tu es ADMIN :
   ```bash
   gh api -X PUT "repos/{owner}/{repo}/branches/main/protection" --input - <<'JSON'
   {"required_status_checks": null,
    "enforce_admins": false,
    "required_pull_request_reviews": {"required_approving_review_count": 0},
    "restrictions": null}
   JSON
   ```
   Quand le pipeline existe et est vert une première fois, ajoute les checks obligatoires :
   ```bash
   gh api -X PATCH "repos/{owner}/{repo}/branches/main/protection/required_status_checks" \
     -f strict=false -f 'contexts[]=lint' -f 'contexts[]=image'
   ```
   Si tu n'es pas ADMIN, voici les clics à envoyer au propriétaire : *Settings → Branches → Add branch ruleset* (ou *Add rule*) → branche `main` → cocher *Require a pull request before merging* (0 approbation) → *Save*.
3. Dis à l'humain de faire ce réglage (1 clic) : *Settings → Actions → General → Fork pull request workflows from outside collaborators* → « Require approval for all outside collaborators » → *Save*.

### Importer Rallly (une seule fois, sur une branche `p3/import-rallly`)
On copie une **version figée** de Rallly, sans son historique Git. Pas de fork, pas de submodule : le code devient le nôtre, et on le modifie librement.

```bash
# Dernier tag v4 stable :
git ls-remote --tags https://github.com/lukevella/rallly | grep -oE 'v4\.[0-9]+\.[0-9]+$' | sort -V | tail -1
RALLLY_VERSION=v4.12.3        # ← mettre le résultat de la commande ci-dessus

# -c core.autocrlf=false : INDISPENSABLE sous Windows, sinon les scripts de Rallly passent en CRLF
# et l'image construite plante au démarrage
git clone -c core.autocrlf=false --depth 1 --branch "$RALLLY_VERSION" https://github.com/lukevella/rallly.git /tmp/rallly-src
rm -rf /tmp/rallly-src/.git /tmp/rallly-src/.github   # historique et workflows upstream inutiles
mkdir -p app && cp -a /tmp/rallly-src app/rallly
echo "$RALLLY_VERSION" > app/rallly/UPSTREAM_VERSION

git add app/rallly
git ls-files --eol app/rallly | grep -c 'w/crlf' || true   # doit afficher 0
git commit -m "chore: import Rallly $RALLLY_VERSION (sources upstream non modifiées)"
```
Après le merge dans `main`, pose un tag sur ce commit : il sert de point de référence pour montrer tout votre code en soutenance.
```bash
git tag rallly-import <sha-du-commit-d-import-sur-main> && git push origin rallly-import
# Plus tard : git diff rallly-import..main --stat -- app/rallly
```

Notes :
- On supprime `.github/` de Rallly : GitHub n'exécute que les workflows à la racine, et ceux-là ne serviraient qu'à semer la confusion.
- **On garde `LICENSE`** (AGPL-3.0). Le dépôt public suffit à respecter la licence. Mentionne-le dans le README.
- Ce commit d'import ne doit contenir **aucune modification** : sinon on ne distingue plus notre code de l'upstream.
- Vérifie que le `.gitignore` de Rallly (dans `app/rallly/`) ignore bien `node_modules`, `.next` et les `.env` de dev. Git applique les `.gitignore` des sous-dossiers.

---

## Étape 2 — `compose.rallly.yml`

```yaml
# compose.rallly.yml — application Rallly et ses dépendances (P3)
services:
  rallly-db:
    image: postgres:18-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: rallly
      POSTGRES_USER: rallly
      POSTGRES_PASSWORD: ${RALLLY_DB_PASSWORD}
    volumes:
      # Postgres ≥ 18 attend le volume sur /var/lib/postgresql (pas .../data)
      - rallly_db:/var/lib/postgresql
    networks: [rallly_backend]
    security_opt: ["no-new-privileges:true"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -d rallly -U rallly"]
      interval: 5s
      timeout: 5s
      retries: 10

  garage:
    image: dxflrs/garage:v2.3.0
    restart: unless-stopped
    command: /garage server --single-node --default-bucket
    environment:
      GARAGE_RPC_SECRET: ${GARAGE_RPC_SECRET}
      GARAGE_DEFAULT_ACCESS_KEY: ${S3_ACCESS_KEY_ID}
      GARAGE_DEFAULT_SECRET_KEY: ${S3_SECRET_ACCESS_KEY}
      GARAGE_DEFAULT_BUCKET: rallly
    volumes:
      - ./config/garage.toml:/etc/garage.toml:ro
      - garage_meta:/var/lib/garage/meta
      - garage_data:/var/lib/garage/data
    networks: [rallly_backend]
    security_opt: ["no-new-privileges:true"]

  rallly:
    image: ${RALLLY_IMAGE}
    restart: unless-stopped
    environment:
      NEXT_PUBLIC_BASE_URL: https://rallly.${BASE_DOMAIN}
      DATABASE_URL: postgres://rallly:${RALLLY_DB_PASSWORD}@rallly-db:5432/rallly
      SECRET_PASSWORD: ${RALLLY_SECRET_PASSWORD}
      SUPPORT_EMAIL: ${SUPPORT_EMAIL}
      NOREPLY_EMAIL: ${MAIL_FROM}
      INITIAL_ADMIN_EMAIL: ${RALLLY_ADMIN_EMAIL}
      # SMTP de lab (Mailpit accepte n'importe quels identifiants)
      SMTP_HOST: mailpit
      SMTP_PORT: "1025"
      SMTP_SECURE: "false"
      SMTP_USER: lab
      SMTP_PWD: lab
      # SSO Authentik (contrat avec P2)
      OIDC_NAME: Authentik
      OIDC_DISCOVERY_URL: https://auth.${BASE_DOMAIN}/application/o/rallly/.well-known/openid-configuration
      OIDC_CLIENT_ID: ${RALLLY_OIDC_CLIENT_ID}
      OIDC_CLIENT_SECRET: ${RALLLY_OIDC_CLIENT_SECRET}
      # Stockage S3 interne
      S3_ENDPOINT: http://garage:3900
      S3_BUCKET_NAME: rallly
      S3_REGION: garage
      S3_ACCESS_KEY_ID: ${S3_ACCESS_KEY_ID}
      S3_SECRET_ACCESS_KEY: ${S3_SECRET_ACCESS_KEY}
      # Confiance dans la CA interne de Caddy (exportée par ca-export)
      NODE_EXTRA_CA_CERTS: /ca/root.crt
    volumes:
      - ca_public:/ca:ro
    depends_on:
      rallly-db:
        condition: service_healthy
      garage:
        condition: service_started
      ca-export:
        condition: service_completed_successfully
    networks: [edge, rallly_backend, mail]
    security_opt: ["no-new-privileges:true"]
    cap_drop: [ALL]
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:3000').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"]
      interval: 15s
      timeout: 5s
      retries: 10
      start_period: 60s
```

### `config/garage.toml`
Récupère la config officielle (même version que l'image Garage) :
```bash
curl -fsSL -o config/garage.toml \
  https://raw.githubusercontent.com/lukevella/rallly-selfhosted/main/config/garage.toml
```
Relis-la et vérifie qu'aucun secret n'y est en dur (ils passent par l'environnement).

Notes :
- Les migrations Prisma sont jouées **au démarrage** du conteneur Rallly, donc les migrations de vos features s'appliquent toutes seules au déploiement.
- Licence Rallly v4 : une instance auto-hébergée sans licence est prévue pour **un seul utilisateur**, sur un système d'honneur. Au-delà, le Control Panel affiche un rappel mais rien ne bloque. À citer dans les « limites assumées ».
- Garage est optionnel (avatars et fichiers). S'il bloque plus d'une heure, retire-le, retire les variables `S3_*` et documente l'écart.

Test : `docker compose up -d` puis `https://rallly.localhost` → le bouton « Authentik » doit apparaître sur la page de connexion.

---

## Étape 3 — L'image custom

1. Lis `app/rallly/apps/web/Dockerfile` et, dans le dépôt upstream, le workflow qui publie l'image officielle (sur GitHub, dossier `.github/workflows/` de `lukevella/rallly` au tag importé) : **reproduis les mêmes build args** (mode self-hosted, version…). Sinon tu obtiendras une image « cloud » avec facturation.
2. Build local (contexte = `app/rallly`, car le Dockerfile utilise tout le monorepo). ⚠️ Si quelqu'un a lancé `pnpm install` dans `app/rallly`, vérifie que le `.dockerignore` de Rallly exclut bien `node_modules`, sinon le build envoie des Go à Docker :
   ```bash
   ./stack.sh build-rallly
   docker run --rm rallly-local:dev id    # utilisateur effectif ?
   ```
3. Durcissement de l'image, à documenter dans `docs/ci-cd.md` et à donner à P1 pour son tableau :
   - utilisateur non-root (`USER` dans le Dockerfile, sinon ajoute-le) ;
   - image de base minimale et épinglée ;
   - `.dockerignore` (pas de `.git`, `.env*`, `node_modules`) ;
   - label OCI `org.opencontainers.image.source` = URL du dépôt (lie le package GHCR au dépôt).
4. Garde les modifs du Dockerfile minimes et commente chaque changement.

---

## Étape 4 — Pipeline unique `.github/workflows/ci.yml`

Le pipeline construit **votre** image puis démarre **toute la stack avec elle** dans le runner, et vérifie que le SSO est en place. C'est une preuve forte pour la soutenance.

```
lint ─┬─> app-quality (lint/types de app/rallly)
      ├─> image : build ─> scan Trivy ─> smoke test stack complète ─> push GHCR (main)
      └─> scan-stack : Trivy des autres images (Caddy, Authentik, Postgres…)
```

### `scripts/smoke-test.sh`
```bash
#!/usr/bin/env bash
# Vérifie que la stack répond et que l'OIDC est en place. Usage : ./stack.sh smoke [BASE_DOMAIN]
set -euo pipefail
D="${1:-localhost}"
RES=(--resolve "auth.$D:443:127.0.0.1" --resolve "rallly.$D:443:127.0.0.1")

wait_for() {  # url, libellé
  for _ in $(seq 1 60); do
    if curl -fsk "${RES[@]}" -o /dev/null "$1"; then echo "✅ $2"; return 0; fi
    sleep 5
  done
  echo "❌ $2 ($1)"; return 1
}

wait_for "https://auth.$D/-/health/ready/" "Authentik prêt"
wait_for "https://auth.$D/application/o/rallly/.well-known/openid-configuration" "Découverte OIDC Rallly (blueprint appliqué)"
wait_for "https://rallly.$D/" "Rallly répond"

# Rallly joint Authentik depuis l'intérieur (alias réseau + CA)
docker compose exec -T rallly node -e \
  "fetch('https://auth.$D/application/o/rallly/.well-known/openid-configuration').then(r=>{if(!r.ok)process.exit(1);console.log('✅ Rallly → Authentik OK')}).catch(e=>{console.error(e);process.exit(1)})"

# Aucune BDD exposée sur l'hôte
if docker compose ps --format '{{.Service}} {{.Ports}}' | grep -E 'db.*->' ; then
  echo "❌ Une base de données est exposée"; exit 1
fi
echo "✅ Aucune BDD exposée"
```

### `.gitleaks.toml` (à la racine)
Le code de Rallly contient des fixtures de test qui peuvent déclencher des faux positifs. Ajoute ici les chemins concernés si gitleaks en signale, **après avoir vérifié** que ce ne sont pas de vrais secrets.
```toml
[extend]
useDefault = true

[allowlist]
description = "Faux positifs dans les sources Rallly importées"
paths = [
  '''app/rallly/.*\.(test|spec)\.tsx?''',
  '''app/rallly/.*sample\.env''',
]
```

### Le workflow
Avant de le pousser, lis les scripts de `app/rallly/package.json` (`lint`, `type-check`, `test`…) et adapte le job `app-quality`.

```yaml
name: ci

on:
  push:
    branches: [main]
  pull_request:
  workflow_dispatch:

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: read

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - name: Secrets dans l'historique (gitleaks)
        run: docker run --rm -v "$PWD:/repo" zricethezav/gitleaks:latest detect --source /repo --config /repo/.gitleaks.toml -v
      - run: bash scripts/gen-env.sh
      - name: Compose valide
        run: docker compose config -q
      - name: Caddyfile valide
        run: bash stack.sh validate-caddy
      - name: Fins de ligne LF (anti-CRLF Windows)
        run: |
          if git ls-files --eol | grep -q 'i/crlf'; then
            git ls-files --eol | grep 'i/crlf'; echo "❌ fichiers en CRLF dans le dépôt"; exit 1
          fi
      - name: Scripts shell
        run: docker run --rm -v "$PWD:/mnt" -w /mnt koalaman/shellcheck:stable stack.sh scripts/*.sh

  app-quality:
    needs: lint
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: app/rallly
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          package_json_file: app/rallly/package.json   # lit "packageManager"
      - uses: actions/setup-node@v4
        with:
          node-version-file: app/rallly/package.json   # ou app/rallly/.nvmrc s'il existe
          cache: pnpm
          cache-dependency-path: app/rallly/pnpm-lock.yaml
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint          # adapter aux scripts réels
      - run: pnpm type-check    # adapter

  image:
    needs: lint
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
      security-events: write
    steps:
      - uses: actions/checkout@v4

      - name: Nom d'image en minuscules
        run: echo "IMAGE=ghcr.io/${GITHUB_REPOSITORY,,}/rallly" >> "$GITHUB_ENV"

      - uses: docker/setup-buildx-action@v3

      - uses: docker/metadata-action@v5
        id: meta
        with:
          images: ${{ env.IMAGE }}
          tags: |
            type=raw,value=main,enable={{is_default_branch}}
            type=sha,format=short
            type=ref,event=pr

      - name: Build
        uses: docker/build-push-action@v6
        with:
          context: app/rallly
          file: app/rallly/apps/web/Dockerfile
          load: true
          push: false
          tags: |
            ${{ steps.meta.outputs.tags }}
            rallly-ci:${{ github.sha }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          # build-args: |      # recopier ceux du workflow de release upstream
          #   SELF_HOSTED=true

      - name: Scan Trivy de l'image (SARIF)
        run: |
          docker run --rm -v /var/run/docker.sock:/var/run/docker.sock -v "$PWD:/out" \
            aquasec/trivy:latest image --scanners vuln --severity HIGH,CRITICAL \
            --format sarif -o /out/trivy.sarif "rallly-ci:${GITHUB_SHA}"

      - uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: trivy.sarif

      - name: Smoke test de toute la stack avec CETTE image
        run: |
          bash scripts/gen-env.sh
          sed -i "s|^RALLLY_IMAGE=.*|RALLLY_IMAGE=rallly-ci:${GITHUB_SHA}|" .env
          docker compose up -d
          bash scripts/smoke-test.sh localhost

      - name: Logs en cas d'échec
        if: failure()
        run: docker compose logs --tail=200

      - name: Login GHCR
        if: github.event_name == 'push' && github.ref == 'refs/heads/main'
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Push
        if: github.event_name == 'push' && github.ref == 'refs/heads/main'
        run: docker push --all-tags "${IMAGE}"

      - if: always()
        run: docker compose down -v || true

  scan-stack:
    needs: lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: bash scripts/gen-env.sh
      - name: Trivy sur les images tierces de la stack
        run: |
          for img in $(docker compose config --images | sort -u); do
            echo "::group::$img"
            docker run --rm aquasec/trivy:latest image --scanners vuln \
              --severity HIGH,CRITICAL --ignore-unfixed "$img" || true
            echo "::endgroup::"
          done
```

> 🛑 **STOP — rendre l'image publique.** ⚠️ Le package est rangé sous le compte **MatisRault** : seul Matis peut faire ces clics. Si l'humain n'est pas Matis, rédige-lui le message à envoyer à Matis, avec le lien direct `https://github.com/users/MatisRault/packages/container/package/rendu-dev-docker-robin-matis-yohan-projet-groupe-du-fond%2Frallly` et les clics. Après le premier pipeline vert sur `main`, Claude Code dit à l'humain : « Va sur GitHub → Packages → rallly → Package settings → Change visibility → **Public**, puis préviens P1 que l'image est dispo. Réponds *c'est fait* ensuite. »

Après le 1er push sur `main` : **profil ou orga GitHub → Packages → rallly → Package settings → Change visibility → Public**. Sinon la VM ne pourra pas faire `pull` sans login.
Ensuite, passe `RALLLY_IMAGE=ghcr.io/matisrault/rendu-dev-docker-robin-matis-yohan-projet-groupe-du-fond/rallly:main` (en minuscules) dans `.env.example`.

> L'image n'est publiée que si le smoke test passe : on ne publie jamais une image qui casse la stack. Explique-le en soutenance.
> Le scan ne bloque pas (rapport dans l'onglet *Security*). Pour un vrai quality gate, ajoute `--exit-code 1 --ignore-unfixed` sur `CRITICAL` et documente le choix.
> Bonne pratique à citer : épingler les actions tierces par **SHA de commit** plutôt que par tag. Des tags d'actions populaires ont déjà été compromis (tj-actions/changed-files, 2025).

---

## Étape 5 — Déploiement

La VM est derrière le VPN NetBird : les runners GitHub hébergés **ne peuvent pas** la joindre. Trois options, à documenter dans `docs/ci-cd.md` :

| Option | Principe | Pour / contre |
|---|---|---|
| **A (par défaut)** | Livraison continue : la CI publie l'image ; sur la VM, `bash scripts/deploy.sh` (manuel ou cron) | Simple et sûr ; le déploiement n'est pas déclenché par la CI |
| B | Runner GitHub **auto-hébergé** sur la VM (connexion sortante vers GitHub), job `deploy` sur `push main` | Vrai CD. ⚠️ Sur un dépôt public, ne jamais lancer ce runner sur des `pull_request` |
| C | Le job rejoint le VPN avec une setup key NetBird, puis SSH | Seulement si Énov fournit une setup key |

### `scripts/deploy.sh` (exécuté sur la VM)
```bash
#!/usr/bin/env bash
# Met à jour la stack sur la VM (Linux). Usage : bash scripts/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."
echo "→ git pull";            git pull --ff-only
echo "→ pull des images";     docker compose pull
echo "→ redémarrage";         docker compose up -d --remove-orphans
echo "→ nettoyage";           docker image prune -f
BASE_DOMAIN="$(grep -E '^BASE_DOMAIN=' .env | cut -d= -f2)"
bash scripts/smoke-test.sh "$BASE_DOMAIN"
docker compose ps
```
La VM n'a pas besoin des sources pour tourner : elle tire l'image GHCR. Le `git pull` sert à récupérer les fichiers Compose, Caddy et les blueprints.

Option B : job à ajouter si vous installez le runner (Settings → Actions → Runners → New self-hosted runner, label `enov`) :
```yaml
  deploy:
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    needs: [image]
    runs-on: [self-hosted, enov]
    steps:
      - run: cd ~/Rendu-dev-docker-robin-matis-yohan-projet-groupe-du-fond && bash scripts/deploy.sh
```

---

## Étape 6 — Feature libre

> 🛑 **STOP — choix de la feature libre.** Claude Code, ne choisis **pas** la feature toi-même. Présente à l'humain les idées ci-dessous. Pour chacune, vérifie d'abord dans `app/rallly/` (code, schéma Prisma, traductions) si une fonction équivalente existe déjà, et dis-le. Demande ensuite : « Laquelle prends-tu ? » N'écris rien avant sa réponse. Après le choix : rédige la proposition dans le README (problème, périmètre, critère de démo), mets à jour le tableau §11 de `docs/plan/00-COMMUN.md`, puis crée la branche `feat/<nom>`.

Rédige d'abord la **proposition dans le README**, comme l'exige le sujet : problème résolu, périmètre, critère de démo. Idées qui valorisent votre infra :
- **Sondage réservé à un groupe Authentik** : Rallly lit le claim `groups` (scope mapping à ajouter avec P2), et le créateur restreint le vote à un groupe. Différenciant et cohérent avec le projet, mais il faut stocker les groupes à la connexion.
- **Relance des non-votants** : bouton « relancer » qui envoie un e-mail aux invités n'ayant pas voté (démo dans Mailpit).
- **Export CSV des résultats** : rapide, utile, facile à démontrer.
- **Badge « identité vérifiée »** sur les votes venant d'une session OIDC (complémentaire de la #1 si P2 l'a).

Le sujet autorise à s'inspirer d'une issue ou discussion Rallly non listée : cite le lien si c'est le cas. Contribuer en retour à Rallly n'est **pas** nécessaire.

---

## Étape 7 — Documentation

`docs/ci-cd.md` : schéma du pipeline, capture **verte** sur `main` (onglet Actions), lien vers le package GHCR, explication de l'import figé de Rallly (version, tag `rallly-import`, licence), option de déploiement choisie et pourquoi, résultats du scan de l'image.

`docs/features.md` : une section par feature (rédigée par son porteur), avec ce gabarit :
```markdown
## <Nom> (catalogue #X | libre) — <porteur>
- Problème / issue Rallly d'origine : <lien>
- Périmètre : …
- Implémentation : schéma Prisma, API, UI (liens vers les PR)
- Démo : étapes + captures
- Limites : …
```

---

## Definition of done
- [ ] Pipeline `ci` **vert sur `main`** (capture dans la doc)
- [ ] `ghcr.io/matisrault/rendu-dev-docker-robin-matis-yohan-projet-groupe-du-fond/rallly:main` est public et tourne sur la VM
- [ ] Le pipeline démarre toute la stack avec l'image fraîchement construite et valide l'OIDC
- [ ] Feature libre mergée, proposée dans le README, démontrable en 1 min
- [ ] `docs/ci-cd.md` et `docs/features.md` complets

## Pièges connus
- **Sous Windows, un script plante avec `$'\r'`** : fichier en CRLF. Le job « Fins de ligne LF » de la CI le détecte ; corrige avec `git add --renormalize .`.
- **Build Next.js long** (plus de 10 min au 1er run) : le cache `type=gha` accélère beaucoup les suivants. N'ajoute pas de tests e2e.
- **`pnpm install --frozen-lockfile` échoue** : quelqu'un a modifié un `package.json` de `app/rallly` sans commiter `pnpm-lock.yaml`.
- **Conflits de migrations Prisma** entre features : une migration par feature ; on rebase et on régénère avant de merger.
- **Image « cloud » au lieu de « self-hosted »** : build args de l'upstream non reproduits.
- **`denied` au pull sur la VM** : package GHCR encore privé.
- **`invalid reference format`** : nom d'image GHCR avec des majuscules (d'où l'étape « minuscules »).
- **Le bouton Authentik n'apparaît pas** : une des 4 variables OIDC est vide (toutes sont requises).
- **`fetch failed` / `self signed certificate`** dans les logs Rallly : `ca-export` n'a pas tourné, ou `NODE_EXTRA_CA_CERTS` pointe au mauvais endroit.
