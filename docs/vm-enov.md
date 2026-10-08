# Déploiement sur la VM Énov

Procédure réelle suivie pour déployer la stack sur l'infrastructure OpenNebula de la
salle serveur Énov, avec les écarts et les pièges rencontrés. La doc officielle de
référence est [`Enov-Salle-Serveur/Documentation_Public`](https://github.com/Enov-Salle-Serveur/Documentation_Public) ;
ce fichier ne la recopie pas, il note **ce qu'elle ne dit pas**.

## 1. La VM

| Élément | Valeur |
|---|---|
| OpenNebula | VM **#225**, nom `rallie-stack-yohan` |
| Template | **#36** — Ubuntu 24.04 |
| OS | Ubuntu 24.04.4 LTS, noyau 6.8, **x86_64** |
| CPU / RAM | 2 vCPU / 4 Go |
| Disque | 20000 Mo demandés → **18 Go utiles** |
| Réseau | NIC0 = `704_ROBOT_M2` |
| IP (via VPN) | **10.2.192.3** |
| Utilisateur | `root` (clé SSH publique injectée par le contexte OpenNebula) |
| `BASE_DOMAIN` | `10-2-192-3.sslip.io` |

Dimensionnement conforme à la cible du plan (2 vCPU / 4 Go / 20 Go).

## 2. Accès — les quatre pièges du portail

### 2.1 L'URL du portail n'est pas celle qu'on devine
```
http://nebula.cloud.enov.local:2616/fireedge/sunstone
```
⚠️ **`http://` simple et le port `2616` sont obligatoires.** En `https://`, ou sans
le port, `curl` renvoie le code **000** (connexion refusée, pas de certificat) et le
navigateur affiche une page blanche. Alternative par IP, utile quand la résolution
de `nebula.cloud.enov.local` échoue : `http://192.168.101.10:2616`.

### 2.2 Le VPN ne route que deux sous-réseaux
Client **NetBird** sur `netbird.enov.icu`. Une fois connecté, les routes reçues
sont exactement :

| Route | Usage |
|---|---|
| `10.2.192.0/24` | VLAN `ROBOT_M2`, donc la VM |
| `192.168.101.10/32` | le portail Sunstone, et rien d'autre |

Conséquence : le **résolveur DNS interne Énov `192.168.101.253` n'est pas joignable**
(il n'est pas dans les routes poussées). Il est donc inutile de le configurer, ni sur
le poste client ni sur la VM — voir §4.1.

### 2.3 La doc annonce un template, il y en a cinq
La doc publique parle d'« un seul template ». Le portail en propose **5**. Celui
utilisé ici est le **#36 (Ubuntu 24.04)**.

### 2.4 Le quota du datastore n'est pas un multiple de 1024
Le datastore **112** est plafonné à **20000 Mo**, pas 20480. Demander « 20 Go » au
sens informatique (20480 Mo) fait **échouer la création de la VM** sur dépassement de
quota, avec un message peu explicite. Il faut saisir **20000**.

## 3. Préparation du poste client (macOS)

La clé publique déposée sur le portail est `~/.ssh/id_ed25519.pub` (créée au besoin
avec `ssh-keygen -t ed25519`). Le contexte OpenNebula l'injecte dans
`/root/.ssh/authorized_keys` au premier démarrage, d'où :

```bash
ssh root@10.2.192.3
```

Sous Windows, NetBird s'installe comme une application normale et `ssh` est fourni
par Git for Windows (ou par OpenSSH de Windows).

## 4. Préparation de la VM

### 4.1 Piège majeur : le contexte OpenNebula ne fournit aucun DNS
Le `netplan` généré par `one-context` (`/etc/netplan/50-one-context.yaml`) configure
l'adresse et la passerelle mais **ne contient aucun bloc `nameservers`**. Résultat :
`apt update` et `docker pull` échouent sur une résolution de noms, alors que le ping
par IP fonctionne — symptôme trompeur.

Correctif appliqué, **par drop-in `systemd-resolved` et non par netplan** :

```bash
cat > /etc/systemd/resolved.conf.d/99-dns.conf <<'EOF'
[Resolve]
DNS=1.1.1.1 8.8.8.8
FallbackDNS=9.9.9.9
EOF
systemctl restart systemd-resolved
```

**Pourquoi pas netplan** : `one-context` régénère `50-one-context.yaml` à **chaque
démarrage**, toute modification y serait perdue au premier reboot. Le drop-in de
`systemd-resolved`, lui, survit.

Vérification :
```bash
getent hosts download.docker.com
curl -o /dev/null -s -w '%{http_code} %{time_total}s\n' https://download.docker.com
# → 200 0,16s
```

Les résolveurs publics sont utilisés parce que le résolveur interne Énov n'est pas
routé par le VPN (§2.2). Aucun nom interne n'est nécessaire à la stack.

### 4.2 IPv6 : rien à faire
Vérifié : la VM n'a **aucune adresse IPv6 globale ni route IPv6**. Les
enregistrements AAAA renvoyés par le DNS sont donc sans effet, toutes les connexions
sortantes partent en IPv4. Aucun correctif n'a été nécessaire — point vérifié
explicitement parce que c'est une cause classique de `docker pull` lent sur les VM.

### 4.3 Mise à jour des paquets

`git` (2.43.0), `curl` et `ufw` sont **déjà présents** dans le template #36 : rien à
installer, contrairement à ce que prévoyait le plan.

```bash
apt update
DEBIAN_FRONTEND=noninteractive apt -y upgrade
```

190 des 193 paquets proposés ont été mis à jour. Les 3 restants
(`libbluetooth3`, `libopeniscsiusr`, `open-iscsi`) sont retenus par le mécanisme de
**phased updates** d'Ubuntu — un déploiement progressif, pas un échec. Aucun des
trois ne concerne la stack.

⚠️ **Piège rencontré** : la mise à jour d'`openssh-server` arrête `ssh.socket` le
temps de son post-installation. Pendant environ une minute, **toute nouvelle
connexion SSH est refusée** (`Connection refused`) alors que la VM répond au ping.
Les sessions déjà ouvertes, elles, survivent — c'est ce qui a permis à l'`apt
upgrade` d'aller au bout. `ssh.socket` est relancé automatiquement ensuite.

Leçon : lancer les mises à jour longues **détachées de la session SSH**
(`setsid nohup … &`) plutôt que dans le terminal interactif, pour qu'une coupure du
canal n'emporte pas `dpkg` au milieu d'une transaction.

Un redémarrage est requis à l'issue de l'upgrade (`libc6`, `apparmor`, noyau
**6.8.0-146** alors que la VM tourne encore sur 6.8.0-117). Il est volontairement
**reporté à la fin du déploiement**, où il sert de test de résilience : après reboot,
toute la stack doit remonter seule grâce à `restart: unless-stopped`, au swap déclaré
dans `/etc/fstab` et au drop-in DNS de §4.1.

### 4.4 Swap de 2 Go — écart assumé

Le plan ne demande du swap que si la VM est plus petite que la cible ; la nôtre est
pile à la cible (2 vCPU / 4 Go). Il a quand même été ajouté, parce que la marge est
courte : Authentik réclame 2 Go à lui seul, auxquels s'ajoutent deux Postgres,
Rallly, Garage, Caddy et Mailpit sur 3,9 Go utilisables.

```bash
fallocate -l 2G /swapfile
chmod 600 /swapfile          # mkswap refuse un fichier aux permissions trop larges
mkswap /swapfile
swapon /swapfile
printf '/swapfile none swap sw 0 0\n' >> /etc/fstab
printf 'vm.swappiness=10\n' > /etc/sysctl.d/99-swappiness.conf
sysctl --system
```

`vm.swappiness=10` au lieu du défaut 60 : sur une machine qui héberge des bases de
données, on ne veut swapper qu'en cas de **vraie** pression mémoire, pas par
anticipation. Réversible en deux commandes (`swapoff /swapfile && rm /swapfile`,
plus le retrait de la ligne de `fstab`).

Vérifié : `swapon --show` → 2 Go actifs, `swappiness=10`, consommation de 474 Mo au
repos avant déploiement.

<!-- Sections 4.5 (Docker), 4.6 (ufw), 4.7 (MTU), 5 (déploiement),
     6 (écarts local/VM), 7 (accès formateur) : en cours. -->
