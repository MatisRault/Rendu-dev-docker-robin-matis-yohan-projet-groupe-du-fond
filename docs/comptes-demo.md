# Comptes de démo

Créés automatiquement par le blueprint `authentik/blueprints/10-rallly-stack.yaml`, sauf
`akadmin` (compte de bootstrap d'Authentik) et `carol` (créée en direct pendant la démo, par
invitation).

| Compte | E-mail | Groupe Authentik | Rallly | Mailpit | Rôle dans la démo |
|---|---|---|---|---|---|
| `akadmin` | `akadmin@example.com` | authentik Admins | — | — | Admin IdP (mot de passe : `AUTHENTIK_BOOTSTRAP_PASSWORD`) |
| `admin` | `admin@example.com` | `rallly-admins` | ✅ + Control Panel | ✅ | Admin applicatif |
| `alice` | `alice@example.com` | `rallly-users` | ✅ | ❌ refusé | Utilisatrice standard |
| `bob` | `bob@example.com` | `sans-acces` | ❌ refusé | ❌ | Prouve la policy de refus |
| `carol` (créée en démo) | `carol@example.org` | `externes` | ✅ | ❌ | Invitée externe |

## Mots de passe

**Aucun mot de passe n'est dans le dépôt.** Chaque environnement génère les siens avec
`./stack.sh env` :

- `admin`, `alice`, `bob` : `DEMO_PASSWORD` du `.env` ;
- `akadmin` : `AUTHENTIK_BOOTSTRAP_PASSWORD` du `.env`.

Pour la VM, ces valeurs sont communiquées au formateur **hors dépôt** (slide ou message).
