#!/usr/bin/env bash
# Met à jour la stack sur la VM (Linux). Usage : bash scripts/deploy.sh
# Option A du plan : la CI publie l'image sur GHCR, la VM la tire (manuel ou cron).
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env ] || { echo "❌ .env absent : lancer d'abord ./stack.sh env"; exit 1; }

AVANT="$(git rev-parse HEAD)"
echo "→ git pull";            git pull --ff-only
echo "→ pull des images";     docker compose pull
echo "→ redémarrage";         docker compose up -d --remove-orphans

# Un bind mount de fichier unique suit l'inode : git pull remplace le fichier, le
# conteneur garde l'ancien et ni `up -d` ni `caddy reload` ne le voient (cf. PR #9).
# On recrée donc les services dont le fichier de config monté a changé.
recreer_si_change() { # $1 service, $2 fichier monté
  if ! git diff --quiet "$AVANT" HEAD -- "$2"; then
    echo "→ $2 modifié : recréation de $1"
    docker compose up -d --force-recreate --no-deps "$1"
  fi
}
recreer_si_change caddy  proxy/Caddyfile
recreer_si_change garage config/garage.toml

echo "→ nettoyage";           docker image prune -f
BASE_DOMAIN="$(grep -E '^BASE_DOMAIN=' .env | cut -d= -f2)"
bash scripts/smoke-test.sh "$BASE_DOMAIN"
docker compose ps
