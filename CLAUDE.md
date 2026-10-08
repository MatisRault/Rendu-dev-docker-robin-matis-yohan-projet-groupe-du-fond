# Règles du projet (lues par Claude Code)

## Plan de référence
Le plan complet est dans `docs/plan/` :

| Fichier | Pour qui |
|---|---|
| `docs/plan/00-COMMUN.md` | contrat partagé — **à appliquer intégralement, section 0 en premier** |
| `docs/plan/01-PLATEFORME-INFRA.md` | P1 — plateforme, Caddy, durcissement, VM Énov |
| `docs/plan/02-IDENTITE-AUTHENTIK.md` | P2 — Authentik, SSO, policies, invitation |
| `docs/plan/03-APP-RALLLY-CICD.md` | P3 — Rallly, image custom, CI/CD |

Applique la **section 0 de `docs/plan/00-COMMUN.md`** (rôle, vérification du poste,
dépôt, reprise de session, workflow Git) avant toute chose, à chaque nouvelle session.

## Règles absolues
- **Blocs 🛑 STOP** : t'arrêter, afficher le message à l'humain, ne rien faire de plus
  avant sa confirmation explicite.
- **Ne modifier que ses fichiers** (propriétaires : `docs/plan/00-COMMUN.md` §4).
  Exceptions : `docs/avancement/pX.md` et le tableau §11, pour sa propre ligne.
- **Ne jamais commiter `.env`, `certs/`, ni aucun secret.** `git status` avant chaque
  push. Toute nouvelle variable d'env passe par `.env.example` **et** `scripts/gen-env.sh`
  dans la même PR.
- **Jamais de commit direct sur `main`** après le GO de P1 : branche `pX/<sujet>` ou
  `feat/<nom>` + PR (merge commit, pas squash).
- **Fichiers en LF**, toujours. `.gitattributes` l'impose ; `git ls-files --eol | grep crlf`
  doit rester vide.

## Commandes
Tout passe par **`./stack.sh`** (il remplace `make`, absent sous Windows).
`./stack.sh` sans argument liste les commandes.

Ne lance jamais `./stack.sh reset` toi-même : il pose une question interactive à
laquelle tu ne peux pas répondre. Demande à l'humain de la taper.

## Environnements (l'équipe est mixte — vérifie avec `uname -s`)

| | macOS (P1 — Yohan) | Windows (P2, P3) |
|---|---|---|
| Runtime | **Rancher Desktop** (moteur moby), Apple Silicon arm64 | Docker Desktop (WSL2) |
| Shell de tes commandes | zsh / bash | **Git Bash** (pas PowerShell, pas WSL) |
| Commandes données à l'humain | syntaxe zsh, `&&` autorisé | syntaxe **PowerShell** : pas de `&&`, une commande par ligne, `$HOME\…` |
| Clone | `~/development/Rendu-dev-docker-…` | `~/projets/Rendu-dev-docker-…` |
| RAM Docker mini | 6 Go (`rdctl set --virtual-machine.memory-in-gb 8`) | 6 Go (Settings → Resources ou `~/.wslconfig`) |
| CA Caddy | `./stack.sh ca` puis `./stack.sh ca-trust` | `./stack.sh ca` puis double-clic sur `certs/caddy-root.crt` |

Écris les scripts en **bash portable** : ils tournent sur macOS (BSD), dans Git Bash,
sur la VM Ubuntu et dans la CI. En particulier, pas de `sed -i` sans argument de suffixe
(BSD `sed` l'exige), pas de `readlink -f`, pas de `grep -P`.

## Pièges spécifiques macOS
- **Safari ne résout pas toujours `*.localhost`** : utiliser Chrome ou Firefox, ou
  basculer `BASE_DOMAIN=127-0-0-1.sslip.io`.
- `.DS_Store` est gitignoré — ne pas le commiter.
