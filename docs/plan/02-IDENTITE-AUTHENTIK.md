# 02 — Personne 2 : Identité (Authentik, SSO, policies, invitation)

**Tu es responsable de tout ce qui touche à l'identité** : le service Authentik, le SSO OIDC vers Rallly, les groupes et policies, l'invitation d'un externe, la protection de Mailpit, et la documentation qui prouve tout ça. Plus une feature du catalogue (idéalement la #1 « vote verrouillé par OAuth » si elle vous est attribuée : c'est ton domaine).

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
   Lis ~/projets/plan-rallly/00-COMMUN.md puis ~/projets/plan-rallly/02-IDENTITE-AUTHENTIK.md, et exécute la section « Instructions pour Claude Code » du second, du début à la fin.
   ```
6. Ensuite, **réponds simplement à ses questions**. Quand il demande l'autorisation de lancer une commande, accepte. Pour `git`, `gh`, `docker` et `./stack.sh`, choisis « Yes, and don't ask again » pour aller plus vite.

**Les sessions suivantes** : PowerShell → `cd $HOME\projets\Rendu-dev-docker-robin-matis-yohan-projet-groupe-du-fond` → `claude` → recolle le même message. Il reprend tout seul là où il s'était arrêté.

## 🤖 Instructions pour Claude Code

Tu es l'assistant de **P2**. Fais exactement ceci, dans l'ordre :

1. **Règles** : applique toute la section 0 de `00-COMMUN.md`.
2. **PC** : vérification §0.3, jusqu'à ce que tout soit ✅. Tu peux le faire **avant** le GO.
3. **Dépôt** : §0.4.
4. **Attendre le GO** : si `git pull` ne fait pas apparaître `compose.yml`, `stack.sh` et `docs/plan/` sur `main`, demande à l'humain : « As-tu reçu le message **GO** de P1 sur le groupe ? ». Tant que la réponse est non, ne crée **aucun** fichier dans le dépôt. Propose à l'humain de te relancer plus tard avec le même message.
5. **Reprise** : §0.5.
6. Après le GO : `git switch main && git pull`, `git switch -c p2/authentik`, `./stack.sh env`, puis les étapes 1 à 7 dans l'ordre, en respectant les STOP (§0.6 pour les PR).
7. Quand ta PR Authentik est mergée, donne à l'humain le message pour le groupe : « ✅ Authentik mergé sur main (SSO configuré par blueprint). P3 : dès que ta PR Rallly est mergée, on teste le SSO de bout en bout. »
8. À la fin : coche la *Definition of done* et dis à l'humain ce qui reste éventuellement à faire.

**Principe clé : configuration as code.** Tout ce qui est configurable dans Authentik doit finir dans un **blueprint YAML** commité. Résultat : un `./stack.sh reset && ./stack.sh up` (en local comme sur la VM) recrée exactement les mêmes groupes, comptes, provider et application, sans un clic. C'est un vrai argument en soutenance.

## Tes livrables
- [ ] `compose.authentik.yml`
- [ ] `authentik/blueprints/10-rallly-stack.yaml` (groupes, comptes, provider OIDC, application, policies, Mailpit)
- [ ] `authentik/blueprints/20-invitation.yaml` (flow d'enrôlement sur invitation)
- [ ] Bloc `mail.*` du Caddyfile avec forward-auth (PR vers P1)
- [ ] `docs/authentik.md` + `docs/comptes-demo.md` avec captures
- [ ] Feature catalogue B dans `app/rallly/`

---

## Étape 1 — `compose.authentik.yml`

```yaml
# compose.authentik.yml — IdP (P2)
x-authentik-env: &authentik-env
  AUTHENTIK_SECRET_KEY: ${AUTHENTIK_SECRET_KEY}
  AUTHENTIK_POSTGRESQL__HOST: authentik-db
  AUTHENTIK_POSTGRESQL__NAME: authentik
  AUTHENTIK_POSTGRESQL__USER: authentik
  AUTHENTIK_POSTGRESQL__PASSWORD: ${AUTHENTIK_DB_PASSWORD}
  # SMTP de lab
  AUTHENTIK_EMAIL__HOST: mailpit
  AUTHENTIK_EMAIL__PORT: "1025"
  AUTHENTIK_EMAIL__USE_TLS: "false"
  AUTHENTIK_EMAIL__USE_SSL: "false"
  AUTHENTIK_EMAIL__FROM: ${MAIL_FROM}
  # Compte admin initial (akadmin)
  AUTHENTIK_BOOTSTRAP_EMAIL: ${AUTHENTIK_BOOTSTRAP_EMAIL}
  AUTHENTIK_BOOTSTRAP_PASSWORD: ${AUTHENTIK_BOOTSTRAP_PASSWORD}
  # Pas de télémétrie
  AUTHENTIK_ERROR_REPORTING__ENABLED: "false"
  AUTHENTIK_DISABLE_STARTUP_ANALYTICS: "true"
  AUTHENTIK_DISABLE_UPDATE_CHECK: "true"

services:
  authentik-db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: authentik
      POSTGRES_USER: authentik
      POSTGRES_PASSWORD: ${AUTHENTIK_DB_PASSWORD}
    volumes:
      - authentik_db:/var/lib/postgresql/data
    networks: [authentik_backend]
    security_opt: ["no-new-privileges:true"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -d authentik -U authentik"]
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 20s

  authentik-server:
    image: ghcr.io/goauthentik/server:${AUTHENTIK_TAG}
    restart: unless-stopped
    command: server
    environment:
      <<: *authentik-env
    depends_on:
      authentik-db:
        condition: service_healthy
    networks: [edge, authentik_backend, mail]
    security_opt: ["no-new-privileges:true"]
    cap_drop: [ALL]

  authentik-worker:
    image: ghcr.io/goauthentik/server:${AUTHENTIK_TAG}
    restart: unless-stopped
    command: worker
    # PAS de "user: root" ni de socket Docker (contrairement au compose officiel) :
    # on n'utilise pas les outposts gérés par Docker → moins de privilèges.
    environment:
      <<: *authentik-env
      # Variables lues par les blueprints (!Env)
      BASE_DOMAIN: ${BASE_DOMAIN}
      RALLLY_OIDC_CLIENT_ID: ${RALLLY_OIDC_CLIENT_ID}
      RALLLY_OIDC_CLIENT_SECRET: ${RALLLY_OIDC_CLIENT_SECRET}
      DEMO_PASSWORD: ${DEMO_PASSWORD}
      RALLLY_ADMIN_EMAIL: ${RALLLY_ADMIN_EMAIL}
    volumes:
      - ./authentik/blueprints:/blueprints/custom:ro
    depends_on:
      authentik-db:
        condition: service_healthy
    networks: [authentik_backend, mail]
    security_opt: ["no-new-privileges:true"]
    cap_drop: [ALL]
```

Notes :
- Depuis la version 2025.10, **Authentik n'utilise plus Redis** : PostgreSQL + server + worker suffisent. Ignore les tutos qui en ajoutent un.
- Le tag `AUTHENTIK_TAG` est épinglé dans `.env.example`. Vérifie la dernière version stable sur la page des releases et mets-la à jour **via PR** (changer de version majeure en cours de projet = risque).
- Compare avec le `docker-compose.yml` officiel de la version choisie (volumes `media`/`templates`, healthchecks) et documente les écarts dans `docs/authentik.md`.

Test :
```bash
docker compose up -d authentik-db authentik-server authentik-worker caddy
docker compose logs -f authentik-worker   # attendre la fin des migrations
```
Ouvre `https://auth.localhost`, puis connecte-toi avec `akadmin` et `AUTHENTIK_BOOTSTRAP_PASSWORD`.

---

## Étape 2 — Blueprint principal `authentik/blueprints/10-rallly-stack.yaml`

> Méthode sûre : si une entrée pose problème, crée l'objet **à la main dans l'UI**, puis exporte-le (Customization → Blueprints, ou `docker compose exec authentik-worker ak export_blueprint`) pour récupérer la syntaxe exacte de ta version. L'état d'application d'un blueprint se lit dans **Customization → Blueprints** (statut + logs).

```yaml
# yaml-language-server: $schema=https://goauthentik.io/blueprints/schema.json
version: 1
metadata:
  name: Rallly stack
  labels:
    blueprints.goauthentik.io/description: Groupes, comptes de démo, OIDC Rallly, Mailpit
entries:
  # ─── Groupes ────────────────────────────────────────────────
  - model: authentik_core.group
    identifiers: { name: rallly-admins }
  - model: authentik_core.group
    identifiers: { name: rallly-users }
  - model: authentik_core.group
    identifiers: { name: externes }
  - model: authentik_core.group
    identifiers: { name: sans-acces }

  # ─── Comptes de démo ────────────────────────────────────────
  # state: created → créés une fois, pas écrasés si vous les modifiez dans l'UI
  - model: authentik_core.user
    state: created
    identifiers: { username: admin }
    attrs:
      name: Admin Rallly
      email: !Env RALLLY_ADMIN_EMAIL
      password: !Env DEMO_PASSWORD
      groups:
        - !Find [authentik_core.group, [name, rallly-admins]]
  - model: authentik_core.user
    state: created
    identifiers: { username: alice }
    attrs:
      name: Alice Martin
      email: alice@example.com
      password: !Env DEMO_PASSWORD
      groups:
        - !Find [authentik_core.group, [name, rallly-users]]
  - model: authentik_core.user
    state: created
    identifiers: { username: bob }
    attrs:
      name: Bob Refusé
      email: bob@example.com
      password: !Env DEMO_PASSWORD
      groups:
        - !Find [authentik_core.group, [name, sans-acces]]

  # ─── Provider OIDC pour Rallly ──────────────────────────────
  - model: authentik_providers_oauth2.oauth2provider
    id: rallly-provider
    identifiers: { name: rallly }
    attrs:
      authorization_flow: !Find [authentik_flows.flow, [slug, default-provider-authorization-implicit-consent]]
      invalidation_flow: !Find [authentik_flows.flow, [slug, default-provider-invalidation-flow]]
      client_type: confidential
      client_id: !Env RALLLY_OIDC_CLIENT_ID
      client_secret: !Env RALLLY_OIDC_CLIENT_SECRET
      redirect_uris:
        - matching_mode: strict
          url: !Format ["https://rallly.%s/api/auth/callback/oidc", !Env BASE_DOMAIN]
        - matching_mode: strict
          url: http://localhost:3000/api/auth/callback/oidc   # dev (pnpm dev)
      # INDISPENSABLE : sans clé de signature, les jetons sont en HS256 et Rallly les refuse
      signing_key: !Find [authentik_crypto.certificatekeypair, [name, authentik Self-signed Certificate]]
      property_mappings:
        - !Find [authentik_providers_oauth2.scopemapping, [managed, goauthentik.io/providers/oauth2/scope-openid]]
        - !Find [authentik_providers_oauth2.scopemapping, [managed, goauthentik.io/providers/oauth2/scope-email]]
        - !Find [authentik_providers_oauth2.scopemapping, [managed, goauthentik.io/providers/oauth2/scope-profile]]

  # ─── Application Rallly ─────────────────────────────────────
  - model: authentik_core.application
    identifiers: { slug: rallly }       # → URL de découverte /application/o/rallly/
    attrs:
      name: Rallly
      provider: !KeyOf rallly-provider
      meta_launch_url: !Format ["https://rallly.%s", !Env BASE_DOMAIN]
      policy_engine_mode: any            # accès si AU MOINS un binding passe

  # ─── Policies par groupe : qui peut ouvrir Rallly ───────────
  # Dès qu'une application a des bindings, tout utilisateur qui n'en
  # satisfait aucun est refusé → bob (sans-acces) est bloqué.
  - model: authentik_policies.policybinding
    identifiers:
      target: !Find [authentik_core.application, [slug, rallly]]
      group: !Find [authentik_core.group, [name, rallly-admins]]
    attrs: { order: 0 }
  - model: authentik_policies.policybinding
    identifiers:
      target: !Find [authentik_core.application, [slug, rallly]]
      group: !Find [authentik_core.group, [name, rallly-users]]
    attrs: { order: 10 }
  - model: authentik_policies.policybinding
    identifiers:
      target: !Find [authentik_core.application, [slug, rallly]]
      group: !Find [authentik_core.group, [name, externes]]
    attrs: { order: 20 }

  # ─── Mailpit protégé : réservé aux admins (2e droit distinct) ─
  - model: authentik_providers_proxy.proxyprovider
    id: mailpit-provider
    identifiers: { name: mailpit-forward-auth }
    attrs:
      mode: forward_single
      external_host: !Format ["https://mail.%s", !Env BASE_DOMAIN]
      authorization_flow: !Find [authentik_flows.flow, [slug, default-provider-authorization-implicit-consent]]
      invalidation_flow: !Find [authentik_flows.flow, [slug, default-provider-invalidation-flow]]
  - model: authentik_core.application
    identifiers: { slug: mailpit }
    attrs:
      name: Mailpit (admins)
      provider: !KeyOf mailpit-provider
      meta_launch_url: !Format ["https://mail.%s", !Env BASE_DOMAIN]
  - model: authentik_policies.policybinding
    identifiers:
      target: !Find [authentik_core.application, [slug, mailpit]]
      group: !Find [authentik_core.group, [name, rallly-admins]]
    attrs: { order: 0 }
```

### L'outpost embarqué (pour Mailpit)
Dans **Applications → Outposts → authentik Embedded Outpost → Modifier** :
- ajoute l'application **Mailpit (admins)** ;
- dans la config : `authentik_host: https://auth.<BASE_DOMAIN>` et `authentik_host_insecure: true` (CA interne).

Tente ensuite de l'automatiser en ajoutant ceci au blueprint. Vérifie bien que les **autres** clés de config de l'outpost ne sont pas écrasées ; si c'est le cas, garde la version manuelle et documente-la :
```yaml
  - model: authentik_outposts.outpost
    identifiers: { managed: goauthentik.io/outposts/embedded }
    attrs:
      providers:
        - !KeyOf mailpit-provider
```

### Bloc Caddy à proposer à P1 (PR sur `proxy/Caddyfile`)
```caddyfile
mail.{$BASE_DOMAIN} {
	import security_headers
	route {
		reverse_proxy /outpost.goauthentik.io/* authentik-server:9000
		forward_auth authentik-server:9000 {
			uri /outpost.goauthentik.io/auth/caddy
			copy_headers X-Authentik-Username X-Authentik-Groups X-Authentik-Email
			trusted_proxies private_ranges
		}
		reverse_proxy mailpit:8025
	}
}
```

---

> 🛑 **STOP — avant le test SSO de bout en bout.** Claude Code, ouvre la PR de ta branche (étapes 1 et 2), puis dis à l'humain : « Le test SSO avec Rallly nécessite que ma PR **et** la PR Rallly de P3 soient mergées dans `main`. Préviens-moi quand c'est le cas. » En attendant, passe directement à l'étape 4 (invitation), qui ne dépend pas de Rallly, puis reviens ici.

## Étape 3 — Côté Rallly (contrat avec P3)

Ces variables sont déjà câblées par P3 dans `compose.rallly.yml`. Tu n'as rien à lui transmettre, mais vérifie que ça correspond :

| Variable Rallly | Valeur |
|---|---|
| `OIDC_NAME` | `Authentik` |
| `OIDC_DISCOVERY_URL` | `https://auth.${BASE_DOMAIN}/application/o/rallly/.well-known/openid-configuration` |
| `OIDC_CLIENT_ID` / `OIDC_CLIENT_SECRET` | `${RALLLY_OIDC_CLIENT_ID}` / `${RALLLY_OIDC_CLIENT_SECRET}` |
| Callback attendu par Rallly | `https://rallly.${BASE_DOMAIN}/api/auth/callback/oidc` |
| `INITIAL_ADMIN_EMAIL` | `${RALLLY_ADMIN_EMAIL}` → `admin` devient admin du Control Panel Rallly |

Test de bout en bout :
```bash
curl -sk https://auth.localhost/application/o/rallly/.well-known/openid-configuration | head -c 300
docker compose exec rallly node -e "fetch('https://auth.localhost/application/o/rallly/.well-known/openid-configuration').then(r=>console.log(r.status))"
# → 200 : Rallly joint bien Authentik via l'alias Caddy et fait confiance à la CA
```

⚠️ **Contournement du SSO** : Rallly permet aussi la connexion par lien magique e-mail. Si ce mode reste actif, un utilisateur refusé par Authentik peut quand même entrer, ce qui affaiblit tes policies. Cherche dans la doc de configuration Rallly et dans le Control Panel s'il existe une option pour désactiver la connexion par e-mail ou l'inscription, et restreins `ALLOWED_EMAILS` si besoin. Sinon, présente-le comme **limite assumée**.

---

## Étape 4 — Invitation externe `authentik/blueprints/20-invitation.yaml`

Authentik fournit un blueprint d'exemple d'enrôlement sur invitation. Pars de celui-ci :
```bash
docker compose exec authentik-worker ls /blueprints/example/
docker compose exec authentik-worker cat /blueprints/example/flows-invitation-enrollment.yaml \
  > authentik/blueprints/20-invitation.yaml
```
Puis modifie le fichier :
1. Renomme `metadata.name` (ex. `Rallly - invitation externe`) et le slug du flow (ex. `rallly-invitation`).
2. Dans le stage d'invitation : `continue_flow_without_invitation: false` (sans jeton = pas d'inscription).
3. Dans le stage **user write** : `user_creation_mode: always_create` et `create_users_group: !Find [authentik_core.group, [name, externes]]`. L'invité arrive alors directement dans le groupe qui a accès à Rallly.
4. Ajoute en tête des entrées une dépendance au blueprint principal, pour que le groupe existe :
```yaml
  - model: authentik_blueprints.metaapplyblueprint
    attrs:
      identifiers:
        name: Rallly stack
      required: true
```

### Scénario de démo (à documenter avec captures)
1. `akadmin` → **Directory → Invitations → Create** : flow `rallly-invitation`, usage unique, expiration J+7, données fixes facultatives (`email: carol@example.org`).
2. Copie le lien d'invitation (`https://auth.<domaine>/if/flow/rallly-invitation/?itoken=…`) et envoie-le par e-mail (il arrivera dans Mailpit) ou colle-le directement.
3. En navigation privée : carol ouvre le lien, crée son compte, est connectée.
4. Elle ouvre Rallly → « Se connecter avec Authentik » → accès accordé (groupe `externes`).
5. Montre que le lien ne fonctionne plus une seconde fois (usage unique).

---

## Étape 5 — Le scénario de démo complet (4 min, à répéter)

| # | Action | Résultat attendu | Prouve |
|---|---|---|---|
| 1 | alice → Rallly → Se connecter avec Authentik | Connectée, nom/e-mail IdP visibles | SSO OIDC |
| 2 | bob → même chose | Page Authentik « accès refusé » | Policy par groupe |
| 3 | alice → `https://mail.<domaine>` | Refusée | Droits distincts |
| 4 | admin → `https://mail.<domaine>` + Control Panel Rallly | Accès aux deux | Groupe admin |
| 5 | Invitation de carol (étape 4) | Compte créé et accès à Rallly | Invitation externe |
| 6 | (bonus) `./stack.sh reset && ./stack.sh up` puis UI Authentik | Tout est recréé | Config as code |

Utilise un profil de navigateur par compte (ou des fenêtres privées) pour enchaîner sans déconnexion.

---

## Étape 6 — Documentation `docs/authentik.md`
1. Rôle d'Authentik dans l'architecture, version, écarts avec le compose officiel.
2. SSO : provider, application, URL de découverte, redirect URI, scopes, clé de signature (captures UI).
3. Groupes et policies : tableau groupe → applications, explication de `policy_engine_mode`.
4. Invitation : flow, stages, captures du parcours de carol.
5. Blueprints : comment ils sont chargés (`/blueprints/custom`), comment vérifier leur statut, comment les régénérer.
6. Pièges rencontrés (voir ci-dessous).

`docs/comptes-demo.md` : le tableau de `00-COMMUN.md` §7, avec la consigne que les mots de passe sont donnés hors dépôt.

---

## Étape 7 — Ta feature (catalogue B)

> 🛑 **STOP — choix de la feature.** Claude Code, ne choisis **jamais** la feature toi-même. Demande à l'humain : « Quel numéro du catalogue le formateur t'a-t-il attribué ? Et la PR d'import de Rallly (P3) est-elle mergée dans `main` ? » Si l'une des réponses manque, arrête-toi et termine plutôt les étapes Authentik. Quand tu as le numéro, mets à jour le tableau §11 de `docs/plan/00-COMMUN.md`, puis crée la branche `feat/<nom>`.

Si c'est la **#1 (vote verrouillé OAuth)**, voici le scénario que le sujet attend : sans session OAuth, le vote est impossible ; avec session, le nom et l'e-mail IdP apparaissent sur le vote.
- Ajoute une option de sondage (ex. `requireAuth`) dans le schéma Prisma, avec sa migration.
- Côté serveur : dans la mutation d'ajout/modification de participant, refuse si l'utilisateur de la session est un invité (guest) et que l'option est active. Prends le nom et l'e-mail **de la session**, pas du formulaire.
- Côté UI : remplace le formulaire de vote par un bouton « Se connecter avec Authentik » ; affiche un badge « identité vérifiée » sur le vote.
- Démo : fenêtre privée (refus), puis alice connectée (vote avec identité IdP), puis un appel API forgé refusé.

Sinon, vois les pistes dans `00-COMMUN.md` §8. Écris ta section dans `docs/features.md`.

---

## Definition of done
- [ ] `./stack.sh reset && ./stack.sh up` → groupes, comptes, provider, application et policies recréés **sans aucun clic**
- [ ] Les 6 lignes du scénario de démo fonctionnent en local **et** sur la VM
- [ ] `docs/authentik.md` complet avec captures

## Pièges connus
- **`redirect_uri` invalide** : l'URL doit correspondre exactement (schéma `https`, domaine, chemin `/api/auth/callback/oidc`, sans `/` final). Sur la VM, c'est `BASE_DOMAIN` qui change : le blueprint s'adapte seul, à condition que le worker ait bien la variable.
- **Rallly → `/auth/error?error=AccessDenied`** après un login Authentik réussi : vérifie `ALLOWED_EMAILS` et que l'utilisateur a un e-mail. Si le problème vient de `email_verified` absent ou à `false` dans le jeton, crée un scope mapping `email` personnalisé qui renvoie `"email_verified": True` et utilise-le à la place du mapping par défaut.
- **Jetons HS256** : `signing_key` manquant dans le provider.
- **Blueprint « error »** : un `!Find` renvoie vide (mauvais nom ou slug). Regarde les logs du blueprint dans l'UI ; les slugs des flows par défaut se lisent dans Flows & Stages → Flows.
- **Blueprint modifié mais rien ne change** : sous Windows, le worker ne voit pas toujours les changements de fichiers montés. `docker compose restart authentik-worker`.
- **Variables `!Env` vides** : elles doivent être dans l'`environment` du **worker** (c'est lui qui applique les blueprints).
- **Horloge** : un décalage d'heure entre l'hôte et le navigateur casse les jetons. Sur la VM : `timedatectl` (NTP actif).
- **Boucle de redirection Mailpit** : `authentik_host` de l'outpost embarqué non renseigné ou incorrect.
