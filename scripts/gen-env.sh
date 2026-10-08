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
