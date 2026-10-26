#!/usr/bin/env bash
# Vérifie que la stack répond et que l'OIDC est en place. Usage : ./stack.sh smoke [BASE_DOMAIN]
set -euo pipefail
cd "$(dirname "$0")/.."
D="${1:-localhost}"
RES=(--resolve "auth.$D:443:127.0.0.1" --resolve "rallly.$D:443:127.0.0.1")

wait_for() {  # url, libellé
  for _ in $(seq 1 60); do
    # sortie redirigée plutôt que "-o /dev/null" : le curl de Git Bash plante avec -o
    if curl -fsk "${RES[@]}" "$1" >/dev/null; then echo "✅ $2"; return 0; fi
    sleep 5
  done
  echo "❌ $2 ($1)"; return 1
}

# Tant que compose.authentik.yml (P2) est vide, on ne peut pas tester le SSO
if docker compose config --services | grep -qx authentik-server; then
  wait_for "https://auth.$D/-/health/ready/" "Authentik prêt"
  wait_for "https://auth.$D/application/o/rallly/.well-known/openid-configuration" "Découverte OIDC Rallly (blueprint appliqué)"
  AUTH=1
else
  echo "⚠️  Authentik absent de la stack : vérifications SSO ignorées"
  AUTH=0
fi

wait_for "https://rallly.$D/" "Rallly répond"

if [ "$AUTH" = 1 ]; then
  # Rallly joint Authentik depuis l'intérieur (alias réseau + CA)
  docker compose exec -T rallly node -e \
    "fetch('https://auth.$D/application/o/rallly/.well-known/openid-configuration').then(r=>{if(!r.ok)process.exit(1);console.log('✅ Rallly → Authentik OK')}).catch(e=>{console.error(e);process.exit(1)})"

  # SSO obligatoire : la connexion par code e-mail ne doit pas contourner Authentik
  CODE="$(curl -sk "${RES[@]}" -X POST -H "Origin: https://rallly.$D" -H "Content-Type: application/json" \
    -d '{"email":"smoke@example.com","type":"sign-in"}' -w '\n%{http_code}' \
    "https://rallly.$D/api/better-auth/email-otp/send-verification-otp" | tail -n 1)"
  if [ "$CODE" = 403 ]; then echo "✅ Connexion par e-mail refusée (SSO obligatoire)"
  else echo "❌ Connexion par e-mail possible (HTTP $CODE) : contournement du SSO"; exit 1; fi
fi

# Aucune BDD exposée sur l'hôte
if docker compose ps --format '{{.Service}} {{.Ports}}' | grep -E 'db.*->' ; then
  echo "❌ Une base de données est exposée"; exit 1
fi
echo "✅ Aucune BDD exposée"
