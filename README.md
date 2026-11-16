# Rallly auto-hébergé, derrière un SSO Authentik

Déploiement conteneurisé de [Rallly](https://github.com/lukevella/rallly) (sondages
de disponibilité) derrière un reverse proxy Caddy, avec authentification unique par
**Authentik** et une image applicative construite par notre propre CI.

Projet de groupe — cours Docker de M. Guillemard. Robin Kilbertus, Matis Rault,
Yohan Page.

---

## 1. Architecture

![Schéma d'architecture](docs/img/architecture.svg)

Un **unique point d'entrée** (Caddy, ports 80 et 443), **aucune base de données
publiée**, et trois réseaux applicatifs `internal: true` donc sans route vers
Internet.

Détail des réseaux, ports, volumes et du flux d'une connexion :
**[`docs/architecture.md`](docs/architecture.md)**.

| Service | Rôle | Port sur l'hôte |
|---|---|---|
| `caddy` | Reverse proxy, TLS par CA interne | **80, 443** |
| `authentik-server` / `-worker` / `-db` | Fournisseur d'identité, SSO OIDC | aucun |
| `rallly` / `rallly-db` / `garage` | Application, base, stockage S3 | aucun |
| `mailpit` | SMTP de laboratoire + webmail | aucun |
| `ca-export` | One-shot : exporte le certificat public de la CA | aucun |

---

## 2. Démarrage rapide en local

**Prérequis** : Docker avec Compose v2 (Docker Desktop, ou Rancher Desktop sous
macOS), Git, et au moins **6 Go de RAM** alloués au moteur Docker. Les ports 80 et
443 doivent être libres.

```bash
git clone https://github.com/MatisRault/Rendu-dev-docker-robin-matis-yohan-projet-groupe-du-fond.git
cd Rendu-dev-docker-robin-matis-yohan-projet-groupe-du-fond
./stack.sh env     # genere .env avec des secrets aleatoires
./stack.sh up      # Authentik met 1 a 2 minutes a devenir healthy
./stack.sh ps
```

Puis ouvrir :

| Service | URL locale |
|---|---|
| Rallly | https://rallly.localhost |
| Authentik | https://auth.localhost |
| Mailpit | https://mail.localhost *(réservé aux admins)* |

Les scripts sont en bash. Sous Windows, ils se lancent depuis **Git Bash**, pas
depuis PowerShell.

### Supprimer l'avertissement de certificat

Le TLS est assuré par la **CA interne de Caddy** : le navigateur avertit, c'est
normal. Pour le faire disparaître :

```bash
./stack.sh ca          # exporte certs/caddy-root.crt
./stack.sh ca-trust    # macOS uniquement : installe la CA dans le trousseau
```

- **Windows** : double-clic sur `certs/caddy-root.crt` → *Installer le certificat* →
  *Utilisateur actuel* → **Autorités de certification racines de confiance**.
- **Firefox** a son propre magasin : Paramètres → Vie privée et sécurité →
  Certificats → Afficher les certificats → Autorités → Importer.

⚠️ Chaque environnement génère **sa propre CA**. Celle de votre stack locale ne
valide pas les certificats de la VM, et réciproquement.

### Les commandes du projet

Il n'y a pas de `make` : tout passe par `./stack.sh`.

```
./stack.sh env             genere .env (--force pour ecraser)
./stack.sh up | down | ps | pull | config
./stack.sh logs [service]  logs en continu
./stack.sh ca | ca-trust   exporte / installe la CA interne
./stack.sh validate-caddy  verifie la syntaxe du Caddyfile
./stack.sh scan            scan Trivy de toutes les images
./stack.sh smoke [domaine] test de bout en bout
./stack.sh build-rallly    construit l'image depuis app/rallly
./stack.sh reset           SUPPRIME TOUTES LES DONNEES (demande confirmation)
```

---

## 3. Comptes de démonstration

Créés automatiquement par les blueprints Authentik. Mot de passe commun :
`DEMO_PASSWORD`, dans le `.env` — **jamais dans le dépôt**.

| Compte | Groupe | Rallly | Mailpit | Ce qu'il démontre |
|---|---|---|---|---|
| `alice` | `rallly-users` | ✅ | ❌ | utilisatrice standard |
| `admin` | `rallly-admins` | ✅ | ✅ | administrateur applicatif |
| `bob` | `sans-acces` | ❌ **refusé** | ❌ | la policy de refus fonctionne |
| `carol` | `externes` | ✅ | ❌ | invitation d'un externe, créée en démo |
| `akadmin` | authentik Admins | — | — | administration de l'IdP (`AUTHENTIK_BOOTSTRAP_PASSWORD`) |

Détail et captures : **[`docs/comptes-demo.md`](docs/comptes-demo.md)**.

Pour récupérer les mots de passe générés :

```bash
grep -E '^(DEMO_PASSWORD|AUTHENTIK_BOOTSTRAP_PASSWORD)=' .env
```

---

## 4. Déploiement sur la VM Énov

La stack tourne sur une VM OpenNebula de la salle serveur Énov, joignable **via le
VPN NetBird**.

| Service | URL |
|---|---|
| Rallly | https://rallly.10-2-192-3.sslip.io |
| Authentik | https://auth.10-2-192-3.sslip.io |
| Mailpit | https://mail.10-2-192-3.sslip.io |

Procédure complète, pièges de la plateforme et test de résilience après reboot :
**[`docs/vm-enov.md`](docs/vm-enov.md)**.

---

## 5. Authentification unique (Authentik)

SSO OIDC, groupes, policies d'autorisation, protection de Mailpit par forward-auth et
invitation d'un utilisateur externe : **[`docs/authentik.md`](docs/authentik.md)**.

---

## 6. Intégration et déploiement continus

Pipeline GitHub Actions : lint, qualité applicative, construction de l'image,
scan Trivy, smoke test de **toute** la stack, puis publication sur GHCR —
uniquement si le smoke test passe. **[`docs/ci-cd.md`](docs/ci-cd.md)**.

Image publiée :
`ghcr.io/matisrault/rendu-dev-docker-robin-matis-yohan-projet-groupe-du-fond/rallly`

---

## 7. Fonctionnalités ajoutées

Trois fonctionnalités développées dans `app/rallly/` :
**[`docs/features.md`](docs/features.md)**.

Pour voir exactement ce que nous avons écrit, par rapport à l'import figé de
Rallly v4.15.4 :

```bash
git diff rallly-import..main --stat -- app/rallly
```

---

## 8. Sécurité et limites

`read_only` et `no-new-privileges` sur les 9 services, `cap_drop: [ALL]` partout,
**7 services sur 9 en utilisateur non privilégié**, scan Trivy des 7 images avec
analyse commentée des CVE — et les limites assumées, écrites noir sur blanc :
**[`docs/securite.md`](docs/securite.md)**.

---

## 9. Pièges rencontrés

Chacun a coûté du temps ; ils sont documentés pour que personne ne les repaye.

| Piège | Où c'est expliqué |
|---|---|
| Rallly doit joindre Authentik par son **URL publique** — alias réseau + `NODE_EXTRA_CA_CERTS` | [architecture.md §6](docs/architecture.md) |
| Un `git pull` **ne met pas à jour** une config montée en bind : le conteneur reste collé à l'ancien inode. Mailpit s'est retrouvé sans authentification à cause de ça | [vm-enov.md §5.4](docs/vm-enov.md) |
| Réutiliser une URL d'autorisation OIDC provoque un `state_security_mismatch` qui ressemble à une panne | [architecture.md §5](docs/architecture.md) |
| Postgres exige 5 capabilities, et l'échec ne survient **qu'au redémarrage** sur un datadir existant | [securite.md §3.1](docs/securite.md) |
| Le contexte OpenNebula ne fournit **aucun DNS** ; corriger dans netplan ne survit pas au reboot | [vm-enov.md §4.1](docs/vm-enov.md) |
| `docker compose exec id` donne un **faux** utilisateur pour Postgres ; il faut `docker top` | [securite.md §2](docs/securite.md) |
| Un `docker pull` passe par l'interface de l'hôte et **ne teste pas** le réseau des conteneurs | [vm-enov.md §4.7](docs/vm-enov.md) |
| Mot de passe de base changé après la première init : Postgres garde l'ancien, il faut un `reset` | [securite.md](docs/securite.md) |
| Chaque environnement a **sa propre CA** : installer celle du local ne vaut pas pour la VM | §2 ci-dessus |
| `*.localhost` peut ne pas résoudre dans **Safari** : utiliser Chrome ou Firefox en local | — |
