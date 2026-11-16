#!/usr/bin/env bash
# Met à jour la stack sur la VM (Linux). Usage : bash scripts/deploy.sh
# Option A du plan : la CI publie l'image sur GHCR, la VM la tire (manuel ou cron).
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env ] || { echo "❌ .env absent : lancer d'abord ./stack.sh env"; exit 1; }

# Dernier commit DÉPLOYÉ avec succès (fichier local dans .git, jamais commité).
# On ne compare pas au HEAD d'avant le pull : si un premier lancement s'arrête après
# le pull (image pas encore publiée), le second ne verrait plus aucun changement.
ETAT="$(git rev-parse --git-path deploy-commit)"
DEPLOYE="$(cat "$ETAT" 2>/dev/null || true)"
echo "→ git pull";            git pull --ff-only

# [projet] Déployer CE commit, pas le dernier build vert.
# Le tag `:main` signifie « dernier build vert de main », pas « build de ce
# commit ». Déployer juste après un merge installe donc silencieusement
# l'image précédente — et comme les migrations Prisma voyagent dans l'image,
# le schéma de base reste en arrière sans que le smoke test le voie (il ne
# teste que ce qui existait déjà). Constaté pour de vrai le 16/11/2026.
# Le tag `sha-<commit>` est déjà produit par metadata-action dans ci.yml.
DEPOT="$(grep -E '^RALLLY_IMAGE=' .env | cut -d= -f2)"
case "$DEPOT" in
  ghcr.io/*)
    RALLLY_IMAGE="${DEPOT%%:*}:sha-$(git rev-parse --short=7 HEAD)"
    export RALLLY_IMAGE
    echo "→ image visée";       echo "   $RALLLY_IMAGE"
    if ! docker pull "$RALLLY_IMAGE" >/dev/null 2>&1; then
      echo "❌ $RALLLY_IMAGE absente du registre."
      echo "   La CI de ce commit n'a pas fini de publier, ou elle a échoué."
      echo "   Attendez sa fin puis relancez. La stack n'a pas été touchée."
      exit 1
    fi
    ;;
  *)
    # Image locale ou upstream : on ne force rien, mais on le dit.
    echo "⚠️  RALLLY_IMAGE n'est pas une image GHCR ($DEPOT)."
    echo "   Pas d'épinglage au commit : vous déployez ce que ce tag désigne."
    ;;
esac

echo "→ pull des images";     docker compose pull
echo "→ redémarrage";         docker compose up -d --remove-orphans

# Un bind mount de fichier unique suit l'inode : git pull remplace le fichier, le
# conteneur garde l'ancien et ni `up -d` ni `caddy reload` ne le voient (cf. PR #9).
# On recrée donc les services dont le fichier de config monté a changé.
recreer_si_change() { # $1 service, $2 fichier monté
  # Premier déploiement suivi (ou commit inconnu) : on recrée par précaution
  if [ -z "$DEPLOYE" ] || ! git cat-file -e "$DEPLOYE^{commit}" 2>/dev/null \
     || ! git diff --quiet "$DEPLOYE" HEAD -- "$2"; then
    echo "→ $2 modifié depuis le dernier déploiement : recréation de $1"
    docker compose up -d --force-recreate --no-deps "$1"
  fi
}
recreer_si_change caddy  proxy/Caddyfile
recreer_si_change garage config/garage.toml

echo "→ nettoyage";           docker image prune -f
BASE_DOMAIN="$(grep -E '^BASE_DOMAIN=' .env | cut -d= -f2)"
bash scripts/smoke-test.sh "$BASE_DOMAIN"
git rev-parse HEAD > "$ETAT"   # seulement si tout a réussi (set -e)
docker compose ps
