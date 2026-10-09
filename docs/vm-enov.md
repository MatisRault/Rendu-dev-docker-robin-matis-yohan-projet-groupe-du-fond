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

### 4.5 Docker

```bash
curl -fsSL https://get.docker.com -o /root/get-docker.sh
sh /root/get-docker.sh
```

Résultat : Docker Engine **29.8.2** et Compose **5.6.0** (le plan exige v2.20+).

**Pas de `usermod -aG docker`**, contrairement au plan : le template Énov ne fournit
que le compte `root`, qui est déjà le propriétaire du socket Docker. Cela nous évite
au passage la limite que le plan demandait de documenter — « appartenir au groupe
`docker` équivaut à être root », puisqu'il n'y a pas de compte non privilégié à qui
accorder cet accès. La contrepartie, à assumer en soutenance : **toute la stack est
pilotée en root sur la VM**, alors qu'un utilisateur dédié serait préférable en
production.

### 4.6 Pare-feu ufw

`ufw` est préinstallé mais **inactif**. L'ordre des trois commandes est **critique** :
activer le pare-feu avant d'avoir autorisé SSH coupe la session en cours et rend la
VM inaccessible (seule la console VNC de Sunstone permettrait alors de la récupérer).

```bash
ufw allow OpenSSH        # 1. D'ABORD, sinon lock-out
ufw allow 80,443/tcp     # 2. Caddy
ufw --force enable       # 3. Seulement maintenant
```

⚠️ **Limite à mentionner en soutenance** : Docker insère ses propres règles dans la
chaîne `DOCKER-USER` d'iptables, **en amont** de celles d'ufw. Les ports publiés par
un conteneur sont donc joignables **même si ufw les refuse**. Ici c'est sans
conséquence — seul Caddy publie des ports, et ce sont précisément 80 et 443 qu'on
veut ouvrir — mais ufw ne doit pas être présenté comme la protection des conteneurs.
Ce qui protège réellement, c'est l'absence de `ports:` sur tous les autres services
et les réseaux `internal: true`.

### 4.7 MTU : le 1450 de la doc Énov ne s'applique pas — mesuré

La doc Énov impose MTU 1450 à cause de l'encapsulation VXLAN. **Testé, et ce n'est
pas nécessaire sur notre chemin réseau.**

Le test doit se faire **depuis l'intérieur d'un conteneur**, pas depuis l'hôte : un
`docker pull` est exécuté par le daemon via `eth0` et ne traverse jamais le bridge
`docker0`. Il ne prouve donc rien sur le réseau des conteneurs — c'est le piège de
cette vérification.

```bash
docker run --rm alpine:3.22 sh -c '
  apk add --no-cache iputils curl
  ping -M do -s 1472 -c 2 1.1.1.1          # 1472 + 28 d en-tetes = trames de 1500
  curl -o /dev/null https://speed.cloudflare.com/__down?bytes=10000000'
```

| Mesure | Résultat |
|---|---|
| `eth0` / `docker0` | MTU 1500 tous les deux (défaut) |
| ping *Don't Fragment*, trames de 1500 octets | **0 % de perte**, RTT 16 ms |
| Téléchargement de 10 Mo en HTTPS depuis le conteneur | **10 000 000 octets en 0,48 s** |

Conclusion : l'encapsulation VXLAN est absorbée par le réseau sous-jacent (jumbo
frames sur l'*underlay*), le système invité peut rester à 1500. **Aucun `mtu:` n'a
été ajouté aux réseaux Compose**, ce qui évite un écart de configuration entre le
local et la VM.

Si un jour le symptôme apparaissait — connexions TCP qui s'établissent puis se
figent au milieu d'un transfert, typique d'une *Path MTU Discovery* cassée — le
correctif serait `ip link set eth0 mtu 1450` plus une clé `driver_opts:
com.docker.network.driver.mtu: 1450` sur chaque réseau de `compose.yml`.

## 5. Déploiement

```bash
git clone https://github.com/MatisRault/Rendu-dev-docker-robin-matis-yohan-projet-groupe-du-fond.git /root/rallly-stack
cd /root/rallly-stack
bash scripts/gen-env.sh
sed -i 's/^BASE_DOMAIN=.*/BASE_DOMAIN=10-2-192-3.sslip.io/' .env
sed -i 's/^HTTP_BIND=.*/HTTP_BIND=0.0.0.0/'               .env
docker compose config -q      # valide avant de démarrer
docker compose pull           # séparé du up : distingue une erreur de pull d'une erreur de démarrage
docker compose up -d
```

Le `.env` est généré **sur la VM**, avec ses propres secrets : rien n'est copié
depuis le poste de développement, et aucun secret ne transite par le dépôt. Il est
créé en permissions `600` par `gen-env.sh`.

Note : séparer `pull` et `up` n'est pas cosmétique. Les images pèsent 2,1 Go au total
(dont 1,4 Go pour Rallly) ; en cas de problème réseau, on sait immédiatement s'il
s'agit du téléchargement ou de la configuration.

### 5.1 État obtenu

| Service | Statut | Ports publiés |
|---|---|---|
| `caddy` | Up (healthy) | **0.0.0.0:80, 0.0.0.0:443** |
| `rallly` | Up (healthy) | aucun (3000 interne) |
| `rallly-db` | Up (healthy) | aucun (5432 interne) |
| `garage` | Up | aucun |
| `mailpit` | Up (healthy) | aucun (8025 et 1025 internes) |
| `ca-export` | Exited (0) | aucun — `network_mode: none` |

Caddy est bien le **seul** service à publier des ports, conformément au contrat §3 de
`00-COMMUN.md`. La CA a été exportée dans le volume `ca_public` (`root.crt`, 627
octets, en lecture seule).

### 5.2 Vérifications depuis le poste client, à travers le VPN

| Test | Résultat |
|---|---|
| `https://rallly.10-2-192-3.sslip.io` | **200** en 0,67 s |
| `https://mail.10-2-192-3.sslip.io` | **200** |
| `https://auth.10-2-192-3.sslip.io` | **502** — attendu, Authentik pas encore livré par P2 |
| `http://` → `https://` | **308** |
| Résolution `rallly.10-2-192-3.sslip.io` | `10.2.192.3` — aucun filtrage anti-rebinding à contourner |
| Émetteur du certificat | `CN=Caddy Local Authority - ECC Intermediate` |
| Page Rallly complète via le VPN | 85 276 octets en 0,40 s |

Ce dernier test confirme le §4.7 **du côté VPN** aussi : un transfert de plusieurs
dizaines de kilo-octets passe sans blocage, donc la *Path MTU Discovery* fonctionne
sur tout le chemin poste → NetBird → VXLAN Énov → conteneur.

### 5.3 Consommation mémoire mesurée

961 Mo utilisés et **0 octet de swap** avec cinq services actifs. Le swap de §4.4
reste donc une assurance non consommée — mais Authentik, qui réclame 2 Go à lui seul,
n'est pas encore déployé. C'est précisément à ce moment-là que la marge sera utile ;
la mesure sera à refaire après la livraison de P2.

## 6. Écarts local / VM

| Élément | Local (poste de P1) | VM Énov | Pourquoi |
|---|---|---|---|
| `BASE_DOMAIN` | `localhost` | `10-2-192-3.sslip.io` | Pas de DNS public sur le réseau campus ; `sslip.io` encode l'IP dans le nom |
| `HTTP_BIND` | `127.0.0.1` | `0.0.0.0` | Accès nécessaire depuis le VPN, pas seulement depuis la machine |
| **Architecture CPU** | **arm64** (Apple Silicon) | **x86_64** | Écart non prévu par le plan, qui supposait tout le monde sous Windows/amd64. Toutes les images utilisées sont multi-arch, donc transparent — **mais** l'image GHCR produite par la CI (`ubuntu-latest`, donc amd64) ne tournera pas sur le Mac de P1 sans émulation. À anticiper avec P3 : soit un build multi-arch (`docker/build-push-action` + `platforms: linux/amd64,linux/arm64`), soit P1 teste en local avec `RALLLY_IMAGE=rallly-local:dev` |
| Runtime Docker | Rancher Desktop (moby) | Docker Engine 29.8.2 | Imposé par le poste de P1 ; Compose v2+ des deux côtés, aucune différence de comportement constatée |
| Swap | géré par macOS | **2 Go explicites** | 4 Go de RAM seulement sur la VM |
| `RALLLY_IMAGE` | `lukevella/rallly:4` | `lukevella/rallly:4` pour l'instant → image GHCR dès que P3 l'a publiée | Produite par la CI |
| TLS | CA interne Caddy | CA interne Caddy | **Aucun écart** : identique en local et sur la VM |
| Fichiers Compose | identiques | identiques | Seul le `.env` diffère |
| Pare-feu | aucun | `ufw` actif (22, 80, 443) | Machine exposée sur le VLAN |

## 7. Accès pour le formateur

1. Être connecté au **VPN NetBird Énov** (`netbird.enov.icu`) — sans lui, les trois
   URL sont injoignables.
2. Ouvrir l'une des adresses :
   - Rallly — `https://rallly.10-2-192-3.sslip.io`
   - Authentik — `https://auth.10-2-192-3.sslip.io`
   - Mailpit — `https://mail.10-2-192-3.sslip.io` (réservé aux admins)
3. **Accepter l'avertissement de certificat**, ou importer la CA interne pour le faire
   disparaître : `./stack.sh ca` produit `certs/caddy-root.crt`.
   - macOS : `./stack.sh ca-trust` (ajoute la CA au trousseau).
   - Windows : double-clic → *Installer le certificat* → *Utilisateur actuel* →
     **Autorités de certification racines de confiance**. Firefox a son propre
     magasin (Paramètres → Vie privée et sécurité → Certificats → Importer).
4. Comptes de démo : voir `00-COMMUN.md` §7. **Les mots de passe sont transmis hors
   dépôt** (ils sont générés aléatoirement par `gen-env.sh` sur la VM).

## 8. Reste à faire

- [ ] **Reboot de validation** : le noyau 6.8.0-146 attend un redémarrage (§4.3).
      Il servira de test de résilience — après reboot, la stack doit remonter seule
      (`restart: unless-stopped`), le swap être réactivé par `fstab` et le DNS tenir
      grâce au drop-in de §4.1. À faire avec l'accord de l'équipe, pas en pleine
      séance de travail de P2 ou P3.
- [ ] Repasser `RALLLY_IMAGE` sur l'image GHCR dès que P3 l'a publiée en public.
- [ ] Refaire la mesure mémoire de §5.3 après le déploiement d'Authentik par P2.
- [ ] Tester l'accès depuis le poste d'une personne extérieure au groupe
      (*Definition of done* de l'étape 6).
