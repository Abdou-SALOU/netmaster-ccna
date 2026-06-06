/* ===================== MODULE : Le Protocole IPv6 ===================== */
NM.register({
  id: "ipv6", kind: "course", color: "ipv6", icon: "📡",
  title: "Le Protocole IPv6",
  kicker: "Next Generation IP",
  est: "32 min",
  desc: "Adressage 128 bits, en-tête simplifié, ICMPv6 et découverte de voisins, multicast, en-têtes d'extension et transition depuis IPv4.",
  chips: ["128 bits", "Compression", "EUI-64", "ICMPv6 / ND", "RIPng / OSPFv3"],

  sections: [
    /* 1 */ {
      id: "pourquoi", title: "Pourquoi IPv6 ?",
      html:
        `<p class="lead">IPv6 (« Next Generation ») répond aux déficiences d'IPv4, en premier lieu
        l'<strong>épuisement de l'espace d'adressage</strong>.</p>
        <div class="compare">
          <div class="col a"><h4>Déficiences d'IPv4</h4>
            <ul><li>Épuisement des adresses</li>
            <li>Besoin de nouveaux services intégrés (multicast, QoS, sécurité, mobilité)</li>
            <li>Limitations du format d'en-tête</li></ul></div>
          <div class="col b"><h4>Apports d'IPv6</h4>
            <ul><li>Espace d'adressage <b>énorme</b></li>
            <li>En-tête <b>amélioré</b> & extensions</li>
            <li>Allocation de ressources, <b>sécurité</b> (IPsec), <b>mobilité</b> (MIPv6)</li></ul></div>
        </div>` +
        note("info", `Une adresse IPv6 fait <b>128 bits</b> → ≈ 3,4 × 10³⁸ adresses. De quoi adresser chaque grain de sable de la planète… plusieurs fois.`)
    },

    /* 2 */ {
      id: "entete", title: "Format de l'en-tête",
      html:
        `<p>L'en-tête IPv6 est de <strong>taille fixe (40 octets)</strong>, bien plus simple que celui d'IPv4.
        Survole chaque champ :</p>` +
        dg("ipv6header") +

        key("Champs clés", [
          "<b>Version</b> (4 bits) = 6.",
          "<b>Traffic Class</b> (8 bits) : QoS / DiffServ.",
          "<b>Flow Label</b> (20 bits) : identifie un <b>flux</b> nécessitant un traitement spécial (source + dest + label).",
          "<b>Payload Length</b> (16 bits) : longueur des données <b>+ en-têtes d'extension</b>.",
          "<b>Next Header</b> (8 bits) : type de l'en-tête suivant (extension ou couche supérieure).",
          "<b>Hop Limit</b> (8 bits) : remplace le TTL."
        ]) +
        note("exam", `IPv6 a <b>supprimé</b> le checksum d'en-tête, l'IHL, les options et la fragmentation par les routeurs. Résultat : routage plus rapide.`)
    },

    /* 3 */ {
      id: "compression", title: "Notation & compression",
      html:
        `<p>Une adresse IPv6 (128 bits) s'écrit en <span class="kw">colon-hex</span> : 8 groupes de 16 bits
        en hexadécimal, séparés par « : ». On la <strong>compresse</strong> selon deux règles :</p>
        <ol>
          <li>Supprimer les <b>zéros non significatifs</b> de chaque groupe (<code>0db8</code> → <code>db8</code>).</li>
          <li>Remplacer la <b>plus longue suite</b> de groupes nuls par <code>::</code> — <b>une seule fois</b> par adresse.</li>
        </ol>
        <p>Selon la RFC 5952, si deux suites de zéros ont la même longueur, on compresse celle de <b>gauche</b>.
        Entraîne-toi avec le compresseur (les 7 exercices du cours sont inclus) :</p>` +
        dg("ipv6compress") +
        note("warn", `On ne peut utiliser <code>::</code> qu'<b>une seule fois</b> par adresse, sinon l'adresse devient ambiguë (impossible de savoir combien de groupes nuls chaque <code>::</code> représente).`)
    },

    /* 4 */ {
      id: "types", title: "Types & portées d'adresses",
      html:
        `<p>En IPv6, les adresses sont attribuées aux <strong>interfaces</strong> (pas aux hôtes), et une interface
        possède <strong>plusieurs adresses</strong> avec des <strong>portées</strong> différentes :</p>
        <div class="tbl-wrap"><table class="ntbl"><thead><tr><th>Type</th><th>Préfixe</th><th>Portée / rôle</th></tr></thead><tbody>
          <tr><td><b>Global Unicast</b></td><td>2000::/3</td><td>Routable sur Internet (préfixe global + sous-réseau + ID interface).</td></tr>
          <tr><td><b>Link-Local</b></td><td><code>FE80::/64</code></td><td>Valable sur <b>une seule liaison</b>, jamais routée. <b>Obligatoire</b> et auto-configurée (requise pour le ND).</td></tr>
          <tr><td><b>Unique-Local</b></td><td>FC00::/7</td><td>Équivalent des adresses privées IPv4 (remplace le Site-Local <code>FEC0::/48</code>, abandonné).</td></tr>
          <tr><td><b>Loopback</b></td><td><code>::1</code></td><td>Équivalent de 127.0.0.1.</td></tr>
          <tr><td><b>Non spécifiée</b></td><td><code>::</code></td><td>Tous les bits à 0.</td></tr>
          <tr><td><b>Multicast</b></td><td><code>FF00::/8</code></td><td>Vers un groupe (le broadcast n'existe plus).</td></tr>
        </tbody></table></div>` +
        note("info", `Un routeur IPv6 ne <b>transfère jamais</b> le trafic link-local au-delà de la liaison. L'adresse mappée IPv4 s'écrit <code>::FFFF:w.x.y.z</code>.`)
    },

    /* 5 */ {
      id: "eui64", title: "EUI-64 & autoconfiguration",
      html:
        `<p>L'ID d'interface (64 bits de poids faible) peut être construit automatiquement à partir de
        l'adresse MAC, au format <span class="kw">EUI-64 modifié</span> : on coupe la MAC en deux, on insère
        <code>FFFE</code> au milieu, puis on inverse le <strong>bit U/L</strong> (7ᵉ bit du 1ᵉʳ octet). Essaie :</p>` +
        dg("eui64") +

        `<h3>Autoconfiguration (Plug-and-Play)</h3>
        <div class="compare">
          <div class="col a"><h4>Sans état (SLAAC)</h4>
            <ul><li>L'hôte utilise son adresse link-local et sollicite « tous les routeurs » (RS).</li>
            <li>Le routeur répond (RA) avec le <b>préfixe</b>.</li>
            <li>L'hôte forme son adresse seul (EUI-64). Préfixes à durée de vie limitée.</li></ul></div>
          <div class="col b"><h4>Avec état (DHCPv6)</h4>
            <ul><li>Le routeur demande à l'hôte de contacter un <b>serveur DHCP</b> (bit « managed »).</li>
            <li>L'hôte diffuse vers « tous les serveurs DHCP ».</li>
            <li>Le serveur attribue l'adresse (contrôle centralisé).</li></ul></div>
        </div>` +
        note("tip", `BOOTP/DHCP existaient en IPv4 ; en IPv6 on a <b>SLAAC</b> (sans serveur) ou <b>DHCPv6</b>. La nouveauté est de pouvoir s'auto-configurer <b>sans aucun serveur</b>.`)
    },

    /* 6 */ {
      id: "multicast", title: "Multicast (et fin du broadcast)",
      html:
        `<p>En IPv6, le <strong>broadcast est éliminé</strong>. Seul le <span class="kw">multicast</span> permet de
        livrer un message à plusieurs destinations. Les 4 modes de communication :</p>
        <ul>
          <li><b>Unicast</b> : un hôte → un hôte précis.</li>
          <li><b>Multicast</b> : un hôte → un groupe d'hôtes.</li>
          <li><b>Anycast</b> : un hôte → le membre le <b>plus proche</b> d'un groupe (ex. DHCP le plus proche).</li>
          <li><s>Broadcast</s> : supprimé.</li>
        </ul>
        <p>Les adresses multicast commencent par <code>FF02:</code>. À connaître :</p>
        <div class="tbl-wrap"><table class="ntbl"><thead><tr><th>Adresse</th><th>Cible</th></tr></thead><tbody>
          <tr><td><code>FF02::1</code></td><td>Toutes les machines IPv6 (≈ ancien broadcast).</td></tr>
          <tr><td><code>FF02::2</code></td><td>Tous les routeurs IPv6.</td></tr>
          <tr><td><code>FF02::1:FFxx:xxxx</code></td><td>Nœud sollicité (solicited-node) : 4 derniers octets de l'IP. Sert au ND/DAD.</td></tr>
        </tbody></table></div>` +
        note("info", `Les adresses <b>Anycast</b> sont prises dans l'espace <b>unicast</b> : plusieurs interfaces partagent la même adresse, le routage livre à la plus proche.`)
    },

    /* 7 */ {
      id: "extensions", title: "En-têtes d'extension",
      html:
        `<p>Plutôt que des options dans l'en-tête de base, IPv6 chaîne des <span class="kw">en-têtes d'extension</span>
        via le champ <b>Next Header</b>. Ils doivent apparaître dans un <strong>ordre précis</strong> :</p>
        <div class="tbl-wrap"><table class="ntbl"><thead><tr><th>Ordre</th><th>En-tête</th><th>Code</th></tr></thead><tbody>
          <tr><td>1</td><td>En-tête IPv6 de base</td><td>—</td></tr>
          <tr><td>2</td><td>Hop-by-Hop (examiné par <b>chaque routeur</b>)</td><td>0</td></tr>
          <tr><td>3</td><td>Options de destination</td><td>60</td></tr>
          <tr><td>4</td><td>Routage (routage par la source)</td><td>43</td></tr>
          <tr><td>5</td><td>Fragment</td><td>44</td></tr>
          <tr><td>6</td><td>Authentification (AH)</td><td>51</td></tr>
          <tr><td>7</td><td>ESP (chiffrement)</td><td>50</td></tr>
          <tr><td>—</td><td>Couche supérieure : TCP / UDP / ICMPv6</td><td>6 / 17 / 58</td></tr>
        </tbody></table></div>` +
        note("warn", `En IPv6, la <b>fragmentation est faite par la source</b> (en-tête Fragment), pas par les routeurs comme en IPv4. Le drapeau <b>M</b> = 1 signifie « d'autres fragments suivent ».`)
    },

    /* 8 */ {
      id: "icmpv6", title: "ICMPv6 & Neighbor Discovery",
      html:
        `<p><span class="kw">ICMPv6</span> est une <strong>partie intégrante</strong> d'IPv6 (Next Header = 58) et
        DOIT être implémenté par chaque nœud. Il signale les erreurs, fournit l'écho (ping) et porte la
        <strong>découverte de voisins (ND)</strong> et la découverte d'écouteurs multicast (MLD).</p>

        <h3>ND remplace plusieurs mécanismes IPv4</h3>
        <div class="tbl-wrap"><table class="ntbl"><thead><tr><th>IPv4</th><th>→ IPv6</th></tr></thead><tbody>
          <tr><td>ARP</td><td>ICMPv6 <b>ND</b> (résolution d'adresse)</td></tr>
          <tr><td>ARP gratuit</td><td>ICMPv6 <b>DAD</b> (détection d'adresse dupliquée)</td></tr>
          <tr><td>Découverte routeur ICMP / redirection</td><td>ICMPv6 <b>RS/RA</b></td></tr>
          <tr><td>IGMP</td><td>ICMPv6 <b>MLD</b> (gestion de groupes)</td></tr>
        </tbody></table></div>` +

        key("Fonctions de ND", [
          "<b>Découverte de routeur / préfixe / paramètres</b> (MTU, hop limit…).",
          "<b>Résolution d'adresse</b> (équivalent ARP).",
          "<b>Détermination du saut suivant</b>.",
          "<b>NUD</b> : détection d'inaccessibilité d'un voisin.",
          "<b>DAD</b> : détection d'adresse dupliquée avant d'utiliser une adresse.",
          "<b>Redirection</b> : indiquer un meilleur premier saut."
        ]) +
        note("tip", `En IPv6 tu n'as <b>plus besoin de configurer la passerelle par défaut</b> sur les hôtes : ils la découvrent via les RA, et l'adresse MAC via ND (plus d'ARP).`)
    },

    /* 9 */ {
      id: "routage", title: "Routage IPv6",
      html:
        `<p>Le routage IPv6 reprend les mêmes principes qu'IPv4, avec les protocoles <strong>adaptés au nouvel
        adressage</strong>. Il doit être <strong>activé explicitement</strong> (désactivé par défaut) :</p>` +
        cli("Activation & routage statique",
`R(config)# ipv6 unicast-routing                     // active le routage IPv6
R(config)# ipv6 route 2001:AAAA::/64 2001:1122::1   // route statique
R(config)# ipv6 route ::/0 2001:1122::2             // route par défaut`) +

        `<h3>Routage dynamique</h3>
        <div class="tbl-wrap"><table class="ntbl"><thead><tr><th>Protocole</th><th>Famille</th><th>Métrique</th></tr></thead><tbody>
          <tr><td><b>RIPng</b></td><td>Vecteur de distance (sur UDP)</td><td>Nombre de sauts</td></tr>
          <tr><td><b>OSPFv3</b></td><td>État de lien (Dijkstra)</td><td>Bande passante</td></tr>
        </tbody></table></div>
        <p>Particularité : RIPng et OSPFv3 se configurent <b>sur l'interface</b> (et non plus avec des
        instructions <code>network</code>).</p>` +
        cli("RIPng & OSPFv3 (configuration sur interface)",
`! --- RIPng ---
R1(config)# interface fa0/0
R1(config-if)# ipv6 rip ENSA enable
R1(config)# ipv6 router rip ENSA
!
! --- OSPFv3 ---
R1(config)# interface fa0/0
R1(config-if)# ipv6 ospf 10 area 0
R1(config)# ipv6 router ospf 10
R1(config-router)# router-id 1.1.1.1`) +
        note("exam", `OSPFv3 ne possède <b>pas d'authentification propre</b> : il s'appuie sur la sécurité d'IPv6 (IPsec). Même distance administrative que les versions IPv4.`)
    }
  ],

  quiz: [
    { q: "Sur combien de bits est codée une adresse IPv6 ?",
      opts: ["32", "64", "128", "256"], a: 2,
      exp: "128 bits (16 octets), soit ~3,4 × 10³⁸ adresses." },
    { q: "Quel est le préfixe des adresses link-local ?",
      opts: ["FF02::/8", "FE80::/64", "2000::/3", "FC00::/7"], a: 1,
      exp: "Link-local = FE80::/64, valable sur une seule liaison, requise pour le ND." },
    { q: "Forme compressée de 2001:0db8:0000:0000:0000:0000:0000:0c50 ?",
      opts: ["2001:db8::c50", "2001:0db8::c5", "2001:db8:0:0:c50", "21:db8::c50"], a: 0,
      exp: "On retire les zéros (db8, c50) et on remplace la longue suite de groupes nuls par :: → 2001:db8::c50." },
    { q: "En IPv6, le broadcast est…",
      opts: ["sur FF01::1", "supprimé, remplacé par le multicast", "le même qu'en IPv4", "réservé aux routeurs"], a: 1,
      exp: "Le broadcast n'existe plus en IPv6 ; seul le multicast (FF00::/8) atteint plusieurs destinations." },
    { q: "Que représente l'adresse FF02::2 ?",
      opts: ["toutes les machines IPv6", "tous les routeurs IPv6", "la loopback", "l'adresse non spécifiée"], a: 1,
      exp: "FF02::1 = toutes les machines, FF02::2 = tous les routeurs IPv6." },
    { q: "Dans EUI-64, quelle valeur est insérée au milieu de la MAC ?",
      opts: ["FFFF", "FFFE", "FE80", "00FF"], a: 1,
      exp: "On insère FFFE entre les deux moitiés de la MAC, puis on inverse le bit U/L." },
    { q: "Quel mécanisme remplace ARP en IPv6 ?",
      opts: ["DHCPv6", "ICMPv6 Neighbor Discovery", "MLD", "RIPng"], a: 1,
      exp: "Le Neighbor Discovery (ND) d'ICMPv6 remplace ARP pour la résolution d'adresse." },
    { q: "Quelle est la valeur du champ Next Header pour ICMPv6 ?",
      opts: ["6", "17", "58", "41"], a: 2,
      exp: "ICMPv6 = 58. (TCP = 6, UDP = 17, IPv6-in-IPv4 = 41.)" },
    { q: "En IPv6, la fragmentation est réalisée par…",
      opts: ["chaque routeur du chemin", "la source uniquement", "le destinataire", "le serveur DHCP"], a: 1,
      exp: "Contrairement à IPv4, seuls les hôtes source fragmentent (en-tête Fragment)." },
    { q: "Quelle commande active le routage IPv6 sur un routeur Cisco ?",
      opts: ["ip routing", "ipv6 unicast-routing", "ipv6 enable", "router ipv6"], a: 1,
      exp: "« ipv6 unicast-routing » active le routage IPv6 (désactivé par défaut)." },
    { q: "OSPFv3 utilise quelle métrique ?",
      opts: ["nombre de sauts", "bande passante", "délai", "fiabilité"], a: 1,
      exp: "OSPFv3 (état de lien) se base sur la bande passante, comme OSPFv2." },
    { q: "Combien de fois peut-on utiliser « :: » dans une adresse IPv6 ?",
      opts: ["autant qu'on veut", "deux fois", "une seule fois", "jamais"], a: 2,
      exp: "Une seule fois, sinon l'adresse est ambiguë (on ne saurait pas combien de groupes nuls chaque :: cache)." }
  ],

  flashcards: [
    { k: "Taille", f: "Taille d'une adresse IPv6 et de l'en-tête ?", b: "Adresse = <b>128 bits</b>. En-tête de base = <b>40 octets fixes</b>." },
    { k: "Compression", f: "Les 2 règles de compression ?", b: "① Retirer les zéros non significatifs de chaque groupe. ② Remplacer la plus longue suite de groupes nuls par <code>::</code> (1 seule fois)." },
    { k: "Link-local", f: "Préfixe link-local et son utilité ?", b: "<code>FE80::/64</code> : valable sur une liaison, jamais routée, requise pour le ND. Auto-configurée." },
    { k: "EUI-64", f: "Les 3 étapes EUI-64 ?", b: "① Couper la MAC en deux ② insérer <code>FFFE</code> ③ inverser le 7ᵉ bit (U/L) du 1ᵉʳ octet." },
    { k: "Multicast", f: "FF02::1 et FF02::2 ?", b: "<b>FF02::1</b> = toutes les machines IPv6. <b>FF02::2</b> = tous les routeurs IPv6. (Broadcast supprimé.)" },
    { k: "Modes", f: "Les 4 modes de communication IPv6 ?", b: "<b>Unicast</b>, <b>Multicast</b>, <b>Anycast</b> (le plus proche) — plus de Broadcast." },
    { k: "ND", f: "Que remplace le Neighbor Discovery (ICMPv6) ?", b: "<b>ARP</b> (résolution), <b>ARP gratuit→DAD</b>, découverte routeur/redirection (RS/RA), et complète IGMP via MLD." },
    { k: "Next Header", f: "Codes Next Header de TCP/UDP/ICMPv6 ?", b: "<b>TCP = 6</b>, <b>UDP = 17</b>, <b>ICMPv6 = 58</b>." },
    { k: "Autoconf", f: "SLAAC vs DHCPv6 ?", b: "<b>SLAAC</b> (sans état) : préfixe via RA, hôte forme son adresse seul. <b>DHCPv6</b> (avec état) : serveur attribue l'adresse." },
    { k: "Routage", f: "RIPng vs OSPFv3 (métrique) ?", b: "<b>RIPng</b> = vecteur de distance (sauts). <b>OSPFv3</b> = état de lien (bande passante). Config sur l'interface." }
  ]
});
