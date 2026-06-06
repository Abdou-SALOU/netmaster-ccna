/* ===================== TRAVAUX PRATIQUES ===================== */

/* ---------- TP 1 : VLAN & routage inter-VLAN ---------- */
NM.register({
  id: "tp-vlan", kind: "tp", color: "vlan", icon: "🧪",
  title: "TP — VLAN & Inter-VLAN",
  kicker: "Switch multicouche · DHCP",
  est: "Atelier",
  desc: "Segmenter le réseau de l'ISGA en VLAN par port, router entre eux via un switch L3, distribuer le DHCP par VLAN et activer Telnet.",
  chips: ["VLAN", "SVI", "ip routing", "DHCP", "Telnet"],
  sections: [
    { id: "obj", title: "Objectifs & contexte",
      html: `<p>Réseau intranet ISGA segmenté en VLAN, connecté au FAI via le routeur d'accès « EDGE ».</p>
      <ul>
        <li><b>VLAN 400 « SERVEURS »</b> — Web & RADIUS — <code>192.168.40.0/24</code></li>
        <li><b>VLAN 200 « USERS »</b> — PC ISGA-2 / ISGA-4 — <code>192.168.20.0/24</code></li>
        <li><b>VLAN 300 « ADMIN »</b> — PC ISGA-3 / ISGA-5 — <code>192.168.30.0/24</code></li>
        <li><b>VLAN 500 « GESTION »</b> — administration du switch (IP sur l'interface VLAN)</li>
      </ul>` +
      note("info", "Outils : routeurs + switchs, câbles droits/croisés, câble console (PuTTY), Wireshark. Travail en groupe.") +
      dg("vlanSegment") },
    { id: "create", title: "1 · Créer les VLAN & ports access",
      html: cli("Création d'un VLAN et d'un port access",
`Switch(config)# vlan 300
Switch(config-vlan)# name V_ETUDIANTS
Switch(config-vlan)# exit
Switch(config)# interface fa0/10
Switch(config-if)# switchport access vlan 300`) +
      note("tip", "Répète l'opération pour les VLAN 200, 400 et 500. Vérifie avec <code>show vlan brief</code> (ou <code>show vlan-switch brief</code> sur un EtherSwitch router).") },
    { id: "inter", title: "2 · Routage inter-VLAN (switch L3)",
      html: `<p>Chaque VLAN est relié à une <b>interface virtuelle (SVI)</b> du switch multicouche, qui sert de passerelle.
      Pour faire communiquer les VLAN entre eux, on active le routage L3.</p>` +
      cli("SVI + activation du routage",
`SW-L3(config)# interface vlan 200
SW-L3(config-if)# ip address 192.168.20.1 255.255.255.0   // passerelle VLAN200
SW-L3(config)# interface vlan 300
SW-L3(config-if)# ip address 192.168.30.1 255.255.255.0   // passerelle VLAN300
SW-L3(config)# interface vlan 400
SW-L3(config-if)# ip address 192.168.40.1 255.255.255.0   // passerelle VLAN400
SW-L3(config)# ip routing                                 // active le routage (OFF par défaut)`) +
      note("warn", "Tester : communication intra-VLAN (OK direct) puis inter-VLAN (nécessite le routage). Configurer aussi le routage vers les réseaux externes via EDGE.") },
    { id: "dhcp", title: "3 · DHCP par VLAN",
      html: `<p>Chaque VLAN est un réseau logique distinct → une plage (pool) DHCP par VLAN.</p>` +
      cli("Pools DHCP par VLAN",
`SW-L3(config)# ip dhcp pool VLAN200
SW-L3(dhcp-config)# network 192.168.20.0 255.255.255.0
SW-L3(dhcp-config)# default-router 192.168.20.1     // passerelle du réseau
SW-L3(dhcp-config)# dns-server 8.8.8.8 4.4.4.4       // DNS primaire & secondaire
SW-L3(dhcp-config)# domain-name isga.ac.ma
SW-L3(dhcp-config)# lease 1 0 0                       // bail : jours heures minutes
!
SW-L3(config)# ip dhcp pool VLAN300
SW-L3(dhcp-config)# network 192.168.30.0 255.255.255.0
SW-L3(dhcp-config)# default-router 192.168.30.1
!
SW-L3(config)# service dhcp                           // active le service DHCP (OFF par défaut)`) },
    { id: "telnet", title: "4 · Accès Telnet au switch",
      html: cli("Telnet + mots de passe",
`Switch(config)# line vty 0 4
Switch(config-line)# password isga1
Switch(config-line)# login
Switch(config)# enable password isga2`) +
      note("info", "Le VLAN de gestion (500) reçoit une IP sur son interface VLAN, ce qui permet d'atteindre le switch en Telnet/SSH depuis le réseau.") }
  ],
  quiz: [
    { q: "Quelle commande crée la passerelle d'un VLAN sur un switch L3 ?", opts: ["interface fa0/1", "interface vlan 200 + ip address", "ip default-gateway", "switchport access vlan 200"], a: 1,
      exp: "On crée une SVI : interface vlan <id> puis ip address. C'est la passerelle des hôtes du VLAN.", tag: "TP VLAN" },
    { q: "Sur un switch multicouche, le routage inter-VLAN est activé par…", opts: ["service dhcp", "ip routing", "no shutdown", "vlan database"], a: 1,
      exp: "« ip routing » active le routage L3 (désactivé par défaut).", tag: "TP VLAN" },
    { q: "Pour affecter le port fa0/10 au VLAN 300 :", opts: ["switchport access vlan 300", "switchport mode trunk", "vlan 300", "encapsulation dot1q 300"], a: 0,
      exp: "switchport access vlan 300 place le port d'accès dans le VLAN 300.", tag: "TP VLAN" }
  ]
});

/* ---------- TP 2 : NAT / PAT ---------- */
NM.register({
  id: "tp-nat", kind: "tp", color: "tp", icon: "🧪",
  title: "TP — NAT & PAT",
  kicker: "GNS3 · c3725",
  est: "Atelier",
  desc: "Translation d'adresses sous GNS3 : NAT statique pour un serveur public, PAT (overload) pour le partage d'une IP publique.",
  chips: ["NAT statique", "PAT", "ACL", "inside/outside"],
  sections: [
    { id: "obj", title: "Objectifs & maquette",
      html: `<p>Sous <b>GNS3</b> (IOS c3725), on configure la translation des adresses privées (RFC 1918) du réseau ISGA vers Internet.</p>
      <ol><li>Se familiariser avec GNS3.</li><li>Configurer le NAT statique.</li><li>Configurer le PAT.</li></ol>` +
      note("info", "Câblage : Ethernet croisé PC↔routeur, série entre routeurs. Renommer le routeur de sortie en « NAT », configurer le routage statique, sauvegarder (<code>wr</code> / <code>save</code> côté VPCS).") +
      dg("natTable") },
    { id: "static", title: "1 · NAT statique (serveur public)",
      html: `<p>Le serveur <code>www.isga.ma</code> (192.168.1.100) doit être joignable depuis Internet → mappage <b>1-pour-1</b> vers une IP publique.</p>` +
      cli("NAT statique",
`Routeur(config)# ip nat inside source static 192.168.1.100 212.217.0.2
!
Router(config)# interface fa0/0          // interface interne
Router(config-if)# ip nat inside
Router(config)# interface s0/0           // interface externe
Router(config-if)# ip nat outside`) },
    { id: "pat", title: "2 · PAT (NAT overload)",
      html: `<p>Les autres machines <b>partagent</b> une IP publique (ou un bloc), distinguées par le <b>port</b>.</p>` +
      cli("PAT — étapes",
`! 1) ACL des réseaux à translater
Routeur(config)# access-list 1 permit 192.168.1.0 0.0.0.255
!
! 2a) Vers l'IP de l'interface du routeur :
Router(config)# ip nat inside source list 1 interface s0/0 overload
!
! 2b) OU vers un bloc d'IP publiques :
Routeur(config)# ip nat pool PUB 212.217.1.4 212.217.1.6 netmask 255.255.255.248
Router(config)# ip nat inside source list 1 pool PUB overload
!
! 3) Marquer les interfaces
Routeur(config-if)# ip nat inside     // côté LAN
Routeur(config-if)# ip nat outside    // côté WAN`) },
    { id: "verif", title: "3 · Vérification & débogage",
      html: cli("Commandes de contrôle",
`Router# show ip nat translations
Router# show ip nat statistics
Router# debug ip nat detailed`) +
      note("tip", "Le <code>overload</code> est le mot-clé qui transforme le NAT en PAT (multiplexage par port).") }
  ],
  quiz: [
    { q: "Quel mot-clé transforme un NAT en PAT (partage d'IP par les ports) ?", opts: ["static", "overload", "pool", "inside"], a: 1,
      exp: "« overload » active la translation de ports (PAT).", tag: "TP NAT" },
    { q: "Sur l'interface côté réseau privé, on configure :", opts: ["ip nat outside", "ip nat inside", "ip nat pool", "ip nat enable"], a: 1,
      exp: "ip nat inside sur l'interface LAN, ip nat outside sur l'interface WAN.", tag: "TP NAT" },
    { q: "Commande pour voir la table de translation ?", opts: ["show ip route", "show ip nat translations", "show nat", "debug nat"], a: 1,
      exp: "show ip nat translations affiche les mappages actifs.", tag: "TP NAT" }
  ]
});

/* ---------- TP 3 : OSPF Multizones ---------- */
NM.register({
  id: "tp-ospf", kind: "tp", color: "mz", icon: "🧪",
  title: "TP — OSPF Multizones",
  kicker: "5 zones · redistribution RIP",
  est: "Atelier",
  desc: "Domaine OSPF découpé en 5 zones de types différents, connecté à un réseau RIPv2 avec redistribution mutuelle des routes.",
  chips: ["Area 0/5/6/7/8", "Stub / NSSA", "Redistribution", "RIPv2"],
  sections: [
    { id: "obj", title: "Objectifs & maquette",
      html: `<p>Domaine OSPF de l'ISGA découpé en 5 zones :</p>
      <ul>
        <li><b>Zone 0</b> — backbone</li>
        <li><b>Zone 5</b> — standard</li>
        <li><b>Zone 6</b> — Stub</li>
        <li><b>Zone 7</b> — NSSA</li>
        <li><b>Zone 8</b> — Totally Stubby</li>
      </ul>
      <p>Le domaine est aussi connecté à un réseau géré par <b>RIPv2</b> (routeur R9).</p>` +
      note("info", "On utilise des interfaces <b>loopback</b> pour simuler les réseaux /24 connectés à R5–R9 (elles se comportent comme de vraies interfaces).") +
      dg("ospfAreas") },
    { id: "steps", title: "1 · Mise en place (zones standard)",
      html: `<ol>
        <li>Monter le schéma sous GNS3 (ou Packet Tracer).</li>
        <li>Configurer les adresses des interfaces (physiques + loopback) en CLI.</li>
        <li>Configurer d'abord <b>toutes les zones comme standard</b> (par défaut).</li>
      </ol>` +
      cli("OSPF de base",
`R(config)# router ospf 100
R(config-router)# network 10.0.0.0 0.0.0.255 area 0
R(config-router)# network 10.5.0.0 0.0.0.255 area 5`) },
    { id: "redist", title: "2 · RIPv2 & redistribution",
      html: `<p>Configurer RIPv2 sur R3 (interface 90.0.0.1) et R9 (toutes interfaces), puis <b>redistribuer</b> entre RIP et OSPF.</p>` +
      cli("Redistribution mutuelle",
`! Sur le bord OSPF (ASBR) — injecter RIP dans OSPF :
R(config)# router ospf 300
R(config-router)# redistribute rip metric 5 subnets   // subnets = garder les masques
!
! Côté RIP — injecter OSPF dans RIP :
R(config)# router rip
R(config-router)# redistribute ospf 300 metric 1      // métrique faible (16 = infini en RIP)
!
! Redistribuer des routes statiques :
R(config-router)# redistribute static metric 1`) +
      note("warn", "Observer les codes à côté des routes dans <code>show ip route</code> : <b>O</b> intra, <b>O IA</b> inter-zone, <b>O E1/E2</b> externes, <b>O N1/N2</b> NSSA.") },
    { id: "types", title: "3 · Configurer les types de zones",
      html: cli("Zones non standard",
`R(config)# router ospf 100
R(config-router)# area 6 stub               // Stub
R(config-router)# area 8 stub no-summary    // Totally Stubby
R(config-router)# area 7 nssa               // NSSA
!
! Forcer une route par défaut dans la NSSA (sinon non générée) :
R4(config-router)# area 7 nssa default-information-originate
!
! NSSA totally stubby (élimine aussi les LSA 3) :
R1(config-router)# area 7 nssa no-summary`) +
      note("exam", "Par défaut l'ABR d'une NSSA ne génère <b>pas</b> de route par défaut pour l'externe → il faut <code>default-information-originate</code>.") }
  ],
  quiz: [
    { q: "Pour redistribuer des routes RIP dans OSPF en gardant les masques :", opts: ["redistribute rip", "redistribute rip metric 5 subnets", "network rip", "redistribute connected"], a: 1,
      exp: "Le mot-clé « subnets » permet de redistribuer les routes avec leurs masques de sous-réseau.", tag: "TP OSPF" },
    { q: "Quelle commande rend la zone 8 « Totally Stubby » ?", opts: ["area 8 stub", "area 8 nssa", "area 8 stub no-summary", "area 8 totally"], a: 2,
      exp: "« area X stub no-summary » sur l'ABR élimine aussi les LSA 3 → totally stubby.", tag: "TP OSPF" },
    { q: "En RIP, quelle métrique signifie « infini / inaccessible » ?", opts: ["1", "15", "16", "255"], a: 2,
      exp: "16 = infini en RIP. On redistribue donc avec une métrique faible (1).", tag: "TP OSPF" }
  ]
});

/* ---------- TP 4 : IPv6 bases ---------- */
NM.register({
  id: "tp-ipv6", kind: "tp", color: "ipv6", icon: "🧪",
  title: "TP — IPv6 (bases)",
  kicker: "Adressage · statique · RIPng",
  est: "Atelier",
  desc: "Adressage IPv6 des interfaces routeurs et VPCS, routage statique IPv6 puis routage dynamique avec RIPng.",
  chips: ["ipv6 address", "ipv6 route", "RIPng"],
  sections: [
    { id: "addr", title: "1 · Adressage IPv6",
      html: cli("Interfaces routeur & VPCS",
`R(config)# interface Serial0/0
R(config-if)# ipv6 address 1001:1::1/64
R(config-if)# ipv6 enable
R(config-if)# no shutdown
!
! Côté VPCS (GNS3) :
PC> ip 3003:1::c/64`) },
    { id: "static", title: "2 · Routage statique IPv6",
      html: cli("Routes statiques IPv6",
`R(config)# ipv6 unicast-routing
R(config)# ipv6 route 1001:1::/64 1002:1::2   // route statique
R(config)# ipv6 route ::/0 1002:1::1          // route par défaut
!
R# show ipv6 route`) +
      dg("ipv6compress") },
    { id: "ripng", title: "3 · Routage dynamique RIPng",
      html: `<p>Sur le même réseau, on désactive le statique puis on active <b>RIPng sur chaque interface</b>.</p>` +
      cli("RIPng",
`! Retirer une route statique :
R(config)# no ipv6 route 1001:1::/64 1002:1::2
!
! Activer RIPng par interface :
R1(config)# interface fa0/0
R1(config-if)# ipv6 rip ISGA enable
!
R# show ipv6 route`) +
      note("tip", "« ISGA » est le nom du processus RIPng (choisi librement, mais cohérent partout). Vérifier avec <code>show ipv6 route</code> : les routes RIPng apparaissent avec le code <b>R</b>.") }
  ],
  quiz: [
    { q: "Quelle commande active le routage IPv6 globalement ?", opts: ["ipv6 enable", "ipv6 unicast-routing", "ip routing", "ipv6 rip enable"], a: 1,
      exp: "ipv6 unicast-routing active le routage IPv6 (désactivé par défaut).", tag: "TP IPv6" },
    { q: "RIPng s'active principalement…", opts: ["avec des instructions network", "sur chaque interface (ipv6 rip <nom> enable)", "automatiquement", "via DHCPv6"], a: 1,
      exp: "Contrairement à RIP v4, RIPng se configure sur l'interface : ipv6 rip <nom> enable.", tag: "TP IPv6" }
  ]
});

/* ---------- TP 5 : Tunnel IPv6-in-IPv4 ---------- */
NM.register({
  id: "tp-tunnel", kind: "tp", color: "ospf", icon: "🧪",
  title: "TP — Tunnel IPv6/IPv4",
  kicker: "6in4 · interconnexion de sites",
  est: "Atelier",
  desc: "Interconnecter deux sites IPv6 à travers un FAI IPv4 grâce à un tunnel manuel 6in4 (tunnel mode ipv6ip).",
  chips: ["Tunnel 0", "tunnel mode ipv6ip", "encapsulation"],
  sections: [
    { id: "topo", title: "Topologie & principe",
      html: `<p>Site1 (IPv6) ⟷ R1 ⟷ <b>FAI IPv4</b> ⟷ R2 ⟷ Site2 (IPv6). Le FAI ne route que de l'IPv4 :
      il faut <b>encapsuler</b> l'IPv6 dans de l'IPv4.</p>` + dg("tunnel6in4") },
    { id: "addr", title: "1 · Adressage IPv6 & IPv4",
      html: cli("Adresses des interfaces",
`! IPv6 côté sites :
R(config)# interface fa0/0
R(config-if)# ipv6 address 1001:1::1/64
R(config-if)# ipv6 enable
R(config-if)# no shutdown
!
! IPv4 côté FAI :
R(config)# interface Serial0/0
R(config-if)# ip address 1.1.1.2 255.255.255.0
R(config-if)# no shutdown
!
PC> ip 1001:1::A/64` ) },
    { id: "routefai", title: "2 · Routage IPv4 dans le FAI",
      html: `<p>Pour que le tunnel fonctionne, R1 et R2 doivent pouvoir se joindre en IPv4.</p>` +
      cli("Routage IPv4",
`R1(config)# ip route 0.0.0.0 0.0.0.0 s0/0
R2(config)# ip route 0.0.0.0 0.0.0.0 s0/1`) +
      note("info", "Tester d'abord la connectivité <b>IPv4</b> entre R1 et R2 avant de monter le tunnel.") },
    { id: "tunnel", title: "3 · Créer le tunnel 6in4",
      html: cli("Interface Tunnel 0",
`R1(config)# interface Tunnel 0
R1(config-if)# tunnel mode ipv6ip            // encapsulation IPv6 dans IPv4
R1(config-if)# ipv6 address 1002:1::1/64     // adresse IPv6 du tunnel
R1(config-if)# tunnel source 1.1.1.2         // extrémité IPv4 locale
R1(config-if)# tunnel destination 2.2.2.2    // extrémité IPv4 distante`) },
    { id: "routing", title: "4 · Routage à travers le tunnel",
      html: cli("Statique ou dynamique sur le tunnel",
`! Option A — statique :
R1(config)# ipv6 route 2002:2::/64 Tunnel 0
!
! Option B — OSPFv3 sur les sites ET le tunnel :
R1(config)# router ospf 100
R1(config-rtr)# router-id 1.1.1.1
R1(config)# interface fa0/0
R1(config-if)# ipv6 ospf 100 area 0
R1(config)# interface tunnel0
R1(config-if)# ipv6 ospf 100 area 0`) +
      note("exam", "Le mode <code>tunnel mode ipv6ip</code> = tunnel manuel 6in4. <code>tunnel source/destination</code> sont des adresses <b>IPv4</b> ; l'adresse du tunnel est en <b>IPv6</b>.") }
  ],
  quiz: [
    { q: "Quel mode d'encapsulation pour un tunnel manuel IPv6-in-IPv4 ?", opts: ["tunnel mode gre ip", "tunnel mode ipv6ip", "tunnel mode ipip", "tunnel mode auto"], a: 1,
      exp: "tunnel mode ipv6ip encapsule l'IPv6 dans l'IPv4 (6in4 manuel).", tag: "TP Tunnel" },
    { q: "Les adresses tunnel source / destination sont en…", opts: ["IPv6", "IPv4", "MAC", "les deux"], a: 1,
      exp: "Les extrémités du tunnel (source/destination) sont des adresses IPv4 ; le tunnel porte une adresse IPv6.", tag: "TP Tunnel" }
  ]
});

/* ---------- TP 6 : BGP ---------- */
NM.register({
  id: "tp-bgp", kind: "tp", color: "bgp", icon: "🧪",
  title: "TP — BGP (eBGP / iBGP)",
  kicker: "3 systèmes autonomes",
  est: "Atelier",
  desc: "Interconnecter trois AS avec BGP : établir le voisinage eBGP/iBGP, utiliser update-source et comprendre le multihop eBGP.",
  chips: ["remote-as", "update-source", "eBGP multihop", "network"],
  sections: [
    { id: "obj", title: "Objectifs",
      html: `<ul>
        <li>Comprendre la différence <b>iBGP / eBGP</b>.</li>
        <li>Établir les relations de voisinage BGP.</li>
        <li>Utiliser l'<b>update-source</b> (loopback).</li>
        <li>Comprendre le principe du <b>multisaut eBGP</b> (multihop).</li>
      </ul>` + dg("bgpAS") },
    { id: "ebgp", title: "1 · Voisinage eBGP",
      html: cli("eBGP entre deux AS",
`R1(config)# router bgp 65001
R1(config-router)# neighbor 200.0.0.2 remote-as 65002   // AS différent = eBGP
R1(config-router)# network 200.1.0.0 mask 255.255.255.0`) +
      note("info", "En eBGP direct, les routeurs sont connectés en point-à-point (TTL = 1).") },
    { id: "ibgp", title: "2 · iBGP, update-source & multihop",
      html: cli("iBGP via loopback + eBGP multihop",
`! iBGP : même AS, session sur les loopbacks
R1(config-router)# neighbor 10.0.0.2 remote-as 65001
R1(config-router)# neighbor 10.0.0.2 update-source loopback0
!
! eBGP multisaut (voisins non directement connectés) :
R1(config-router)# neighbor 9.9.9.9 ebgp-multihop 2
R1(config-router)# neighbor 9.9.9.9 update-source loopback0`) +
      note("warn", "Les sessions iBGP doivent former un <b>maillage complet</b> (full mesh) logique entre les routeurs de bord de l'AS.") },
    { id: "verif", title: "3 · Vérification",
      html: cli("Contrôle BGP",
`R# show ip bgp summary        // état des voisins (Established ?)
R# show ip bgp                // table BGP (préfixes + AS_PATH)
R# show ip route bgp          // routes BGP installées`) }
  ],
  quiz: [
    { q: "Comment IOS distingue-t-il une session eBGP d'une session iBGP ?", opts: ["par le port TCP", "selon que le remote-as est différent ou identique au sien", "par update-source", "par la métrique"], a: 1,
      exp: "Si remote-as ≠ AS local → eBGP ; si remote-as = AS local → iBGP.", tag: "TP BGP" },
    { q: "À quoi sert « update-source loopback0 » ?", opts: ["à chiffrer la session", "à établir la session BGP depuis une adresse logique stable", "à augmenter la métrique", "à activer le multihop"], a: 1,
      exp: "La loopback reste joignable tant qu'un chemin existe (via l'IGP), rendant la session iBGP résiliente.", tag: "TP BGP" },
    { q: "Commande pour vérifier l'état (Established) des voisins BGP ?", opts: ["show ip bgp", "show ip bgp summary", "show bgp neighbors detail", "show ip route"], a: 1,
      exp: "show ip bgp summary résume l'état de chaque voisin et le nombre de préfixes reçus.", tag: "TP BGP" }
  ]
});

/* ===================== MÉMO COMMANDES (cheatsheet) ===================== */
NM.cheatsheet = [
  { title: "VLAN & ports", icon: "🔀", color: "vlan", html:
    cli("VLAN",
`Switch(config)# vlan 300
Switch(config-vlan)# name V_ETUDIANTS
Switch(config)# interface fa0/10
Switch(config-if)# switchport access vlan 300
Switch(config-if)# switchport mode access
Switch(config-if)# switchport mode trunk
Switch(config-if)# switchport trunk encapsulation dot1q
Switch# show vlan brief`) },

  { title: "Routage inter-VLAN", icon: "🔁", color: "vlan", html:
    cli("Router-on-a-stick / SVI",
`! Router-on-a-stick
R(config)# interface fa0/0.10
R(config-subif)# encapsulation dot1Q 10
R(config-subif)# ip address 192.168.10.1 255.255.255.0
!
! Switch L3 (SVI)
SW(config)# interface vlan 10
SW(config-if)# ip address 192.168.10.1 255.255.255.0
SW(config)# ip routing`) },

  { title: "DHCP", icon: "📨", color: "vlan", html:
    cli("Pool DHCP",
`R(config)# ip dhcp pool VLAN200
R(dhcp-config)# network 192.168.20.0 255.255.255.0
R(dhcp-config)# default-router 192.168.20.1
R(dhcp-config)# dns-server 8.8.8.8
R(dhcp-config)# domain-name isga.ac.ma
R(config)# service dhcp`) },

  { title: "NAT / PAT", icon: "🌍", color: "tp", html:
    cli("NAT statique & PAT",
`! NAT statique
R(config)# ip nat inside source static 192.168.1.100 212.217.0.2
!
! PAT (overload)
R(config)# access-list 1 permit 192.168.1.0 0.0.0.255
R(config)# ip nat inside source list 1 interface s0/0 overload
!
R(config-if)# ip nat inside      // LAN
R(config-if)# ip nat outside     // WAN
R# show ip nat translations`) },

  { title: "OSPF multizones", icon: "🗺️", color: "mz", html:
    cli("OSPF & zones",
`R(config)# router ospf 100
R(config-router)# network 10.0.0.0 0.0.0.255 area 0
R(config-router)# area 6 stub
R(config-router)# area 8 stub no-summary
R(config-router)# area 7 nssa
R(config-router)# area 7 nssa default-information-originate
R(config-router)# redistribute rip metric 5 subnets`) },

  { title: "BGP", icon: "🛰️", color: "bgp", html:
    cli("eBGP / iBGP",
`R(config)# router bgp 65001
R(config-router)# neighbor 200.0.0.2 remote-as 65002   // eBGP
R(config-router)# neighbor 10.0.0.2 remote-as 65001    // iBGP
R(config-router)# neighbor 10.0.0.2 update-source lo0
R(config-router)# neighbor 9.9.9.9 ebgp-multihop 2
R(config-router)# network 200.1.0.0 mask 255.255.255.0
R# show ip bgp summary`) },

  { title: "IPv6 — adressage & statique", icon: "📡", color: "ipv6", html:
    cli("IPv6 de base",
`R(config)# ipv6 unicast-routing
R(config-if)# ipv6 address 2001:1::1/64
R(config-if)# ipv6 enable
R(config)# ipv6 route 2001:AAAA::/64 2001:1122::1
R(config)# ipv6 route ::/0 2001:1122::2
R# show ipv6 route`) },

  { title: "IPv6 — RIPng / OSPFv3", icon: "🧭", color: "ipv6", html:
    cli("Dynamique IPv6",
`! RIPng
R(config-if)# ipv6 rip ISGA enable
R(config)# ipv6 router rip ISGA
!
! OSPFv3
R(config-if)# ipv6 ospf 10 area 0
R(config)# ipv6 router ospf 10
R(config-router)# router-id 1.1.1.1`) },

  { title: "Tunnel 6in4", icon: "🚇", color: "ospf", html:
    cli("Tunnel IPv6/IPv4",
`R(config)# interface Tunnel 0
R(config-if)# tunnel mode ipv6ip
R(config-if)# ipv6 address 1002:1::1/64
R(config-if)# tunnel source 1.1.1.2
R(config-if)# tunnel destination 2.2.2.2
R(config)# ipv6 route 2002:2::/64 Tunnel 0`) },

  { title: "Vérification & debug", icon: "🔍", color: "tp", html:
    cli("Commandes show / debug",
`R# show running-config
R# show ip route          /  show ipv6 route
R# show ip interface brief
R# show vlan brief
R# show ip nat translations
R# show ip bgp summary
R# show ip ospf neighbor
R# debug ip nat detailed
R# write memory           // sauvegarder (wr)`) }
];
