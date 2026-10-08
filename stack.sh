#!/usr/bin/env bash
# Commandes du projet. Usage : ./stack.sh <commande>
#   - Windows : dans Git Bash
#   - macOS / Linux : dans le terminal (zsh ou bash)
set -euo pipefail
cd "$(dirname "$0")"

# Git Bash convertit les chemins /xxx en C:/Program Files/Git/xxx : on désactive
# cette conversion, sinon les volumes et docker cp cassent. Sans effet hors Windows.
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
                echo "→ certs/caddy-root.crt"
                echo "  Windows : double-clic → Installer le certificat → Utilisateur actuel"
                echo "            → Autorités de certification racines de confiance"
                echo "  macOS   : ./stack.sh ca-trust  (ou double-clic → Trousseau d'accès)" ;;
  ca-trust)     # macOS uniquement : ajoute la CA Caddy au trousseau système
                [ "$(uname -s)" = "Darwin" ] || { echo "ca-trust : macOS uniquement"; exit 1; }
                [ -f certs/caddy-root.crt ] || { echo "Lance d'abord ./stack.sh ca"; exit 1; }
                sudo security add-trusted-cert -d -r trustRoot \
                  -k /Library/Keychains/System.keychain certs/caddy-root.crt
                echo "✅ CA Caddy approuvée (Safari et Chrome l'utilisent tout de suite)"
                echo "   Firefox a son propre magasin : Réglages → Vie privée et sécurité"
                echo "   → Certificats → Afficher les certificats → Autorités → Importer" ;;
  reset)        read -r -p "⚠️  Supprimer TOUTES les données ? (oui/non) " r
                if [ "$r" = "oui" ]; then
                  docker compose down -v --remove-orphans
                else
                  echo "annulé"
                fi ;;
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
  ca-trust       (macOS) approuve la CA Caddy dans le trousseau système
  reset          ⚠️ supprime toutes les données
  build-rallly   construit l'image Rallly depuis app/rallly
  validate-caddy vérifie la syntaxe du Caddyfile
  scan           scan Trivy de toutes les images → docs/scan/
  smoke [dom]    test de bout en bout (Authentik, OIDC, Rallly)
USAGE
  ;;
esac
