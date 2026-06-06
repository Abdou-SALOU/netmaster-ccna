/* ===================== MODULE : VLANs ===================== */
NM.register({
  id: "vlan", kind: "course", color: "vlan", icon: "🔀",
  title: "Les VLANs",
  kicker: "Commutation · Couche 2",
  est: "25 min",
  desc: "Segmentation logique d'un réseau commuté : 802.1Q, ports access/trunk, DTP, VTP et routage inter-VLAN.",
  chips: ["802.1Q", "Trunk / Access", "VTP", "Inter-VLAN", "STP"],

  sections: [
    /* 1 */ {
      id: "intro", title: "Vue d'ensemble",
      html:
        `<p class="lead">Un <span class="kw">VLAN</span> (Virtual LAN) regroupe logiquement des équipements
        comme s'ils étaient sur le même câble — <strong>indépendamment de leur emplacement physique</strong>.
        On segmente ainsi un grand réseau commuté en plusieurs réseaux logiques isolés.</p>

        <p>Sans VLAN, tous les ports d'un commutateur appartiennent au même <strong>domaine de diffusion</strong> :
        un broadcast émis par une machine est reçu par <em>toutes</em> les autres. Les VLAN permettent de
        découper ce domaine selon la fonction, l'équipe, le service ou l'application.</p>` +

        dg("vlanSegment") +

        note("info",
          `Les VLAN reposent sur des connexions <b>logiques</b>, et non physiques. Deux PC branchés sur le même
          switch mais dans des VLAN différents se comportent comme s'ils étaient sur deux réseaux totalement séparés.`) +

        key("Les 6 avantages clés des VLAN", [
          "<b>Sécurité</b> — isolation des groupes sensibles",
          "<b>Réduction des coûts</b> — moins de matériel, meilleure utilisation",
          "<b>Réduction des domaines de diffusion</b> — moins de broadcast inutile",
          "<b>Meilleures performances</b>",
          "<b>Efficacité accrue</b> du personnel informatique",
          "<b>Gestion simplifiée</b> des projets et applications"
        ]) +

        note("warn",
          `Règle de base : <b>chaque port access est attribué à un seul VLAN</b>.
          Exceptions : les ports vers un autre commutateur (trunk) et les ports vers un téléphone IP (voix + données).`)
    },

    /* 2 */ {
      id: "types", title: "Les types de VLAN",
      html:
        `<p>On distingue plusieurs <strong>rôles</strong> de VLAN selon leur usage :</p>` +
        `<div class="tbl-wrap"><table class="ntbl"><thead><tr><th>Type</th><th>Rôle</th></tr></thead><tbody>
          <tr><td><b>VLAN par défaut</b></td><td>Configuration initiale. VLAN <code>1</code> pour Ethernet ; <code>1002–1005</code> réservés aux protocoles L2 non-Ethernet (Token Ring, FDDI).</td></tr>
          <tr><td><b>VLAN de données</b></td><td>VLAN « utilisateur », transporte le trafic généré par les postes.</td></tr>
          <tr><td><b>VLAN de voix (VoIP)</b></td><td>Trafic voix : nécessite un traitement prioritaire (QoS), surtout dans les zones congestionnées.</td></tr>
          <tr><td><b>VLAN de gestion</b></td><td>Reçoit une <b>adresse IP + masque</b> pour administrer le switch via le réseau (HTTP, Telnet, SSH, SNMP).</td></tr>
          <tr><td><b>VLAN natif</b></td><td>Affecté à un port trunk 802.1Q. Défini par la norme pour assurer la compatibilité avec le <b>trafic non étiqueté</b>.</td></tr>
        </tbody></table></div>` +

        note("exam",
          `Retiens les nombres : VLAN <b>1</b> = défaut, <b>1002–1005</b> = réservés, max <b>4094</b> VLAN utilisables
          (VID sur 12 bits → 4096, moins le 0 et le 4095 réservés).`)
    },

    /* 3 */ {
      id: "impl", title: "Implémentations & types de port",
      html:
        `<h3>Les 4 façons d'attribuer un VLAN</h3>
        <div class="tbl-wrap"><table class="ntbl"><thead><tr><th>Niveau</th><th>Critère</th><th>Particularité</th></tr></thead><tbody>
          <tr><td><b>Niveau 1</b> (par port)</td><td>On affecte chaque <b>port</b> du switch à un VLAN.</td><td>Le plus courant. Simple, lisible physiquement.</td></tr>
          <tr><td><b>Niveau 2</b> (par adresse MAC)</td><td>On affecte les <b>adresses MAC</b> à un VLAN.</td><td>Plus souple (peu importe le port). Nécessite un serveur <b>VMPS</b>.</td></tr>
          <tr><td><b>Niveau 3</b> (par adresse IP)</td><td>On affecte des <b>adresses / plages IP</b>.</td><td>Même principe que le niveau 2 mais avec l'IP.</td></tr>
          <tr><td><b>Par authentification</b></td><td>Selon le résultat de l'<b>authentification</b>.</td><td>Nécessite un serveur RADIUS / TACACS+.</td></tr>
        </tbody></table></div>` +

        `<h3>Port Access vs Port Trunk</h3>` +
        `<div class="compare">
          <div class="col a"><h4>🔌 Port Access</h4>
            <ul><li>Associé à <b>un seul VLAN</b></li>
            <li>Ne reçoit que le trafic de son VLAN</li>
            <li>Trafic <b>non étiqueté</b> (l'hôte ignore le VLAN)</li>
            <li>Côté postes de travail / serveurs</li></ul></div>
          <div class="col b"><h4>🚛 Port Trunk</h4>
            <ul><li>Transporte <b>plusieurs VLAN</b></li>
            <li>N'appartient à aucun VLAN spécifique</li>
            <li>Trafic <b>étiqueté 802.1Q</b> (+ natif non étiqueté)</li>
            <li>Liens switch–switch, switch–routeur, ou NIC 802.1Q</li></ul></div>
        </div>` +

        mnemo("🎯", `<b>Access = 1 VLAN</b>, le poste ne voit rien du VLAN. <b>Trunk = N VLAN</b>, on doit étiqueter pour les distinguer.`)
    },

    /* 4 */ {
      id: "dot1q", title: "Étiquetage 802.1Q",
      html:
        `<p>Sur un lien <strong>trunk</strong> partagé par plusieurs VLAN, il faut <strong>marquer chaque trame</strong>
        pour savoir à quel VLAN elle appartient. C'est le rôle de la norme <span class="kw">IEEE 802.1Q</span> :
        elle insère une étiquette (<em>tag</em>) de 4 octets dans la trame Ethernet.</p>` +

        dg("dot1q") +

        `<h3>Détail du champ d'étiquette</h3>
        <div class="tbl-wrap"><table class="ntbl"><thead><tr><th>Champ</th><th>Taille</th><th>Rôle</th></tr></thead><tbody>
          <tr><td><b>TPID</b> (Type)</td><td>16 bits</td><td>Identifiant de protocole = <code>0x8100</code> pour Ethernet.</td></tr>
          <tr><td><b>Priorité (PCP)</b></td><td>3 bits</td><td>Standard 802.1p : niveaux de service / QoS.</td></tr>
          <tr><td><b>CFI</b></td><td>1 bit</td><td>Compatibilité Token Ring / Ethernet.</td></tr>
          <tr><td><b>VID</b></td><td>12 bits</td><td>Numéro de VLAN. <code>0</code> = pas de VLAN, <code>4095</code> réservé → jusqu'à <b>4094</b> VLAN.</td></tr>
        </tbody></table></div>` +

        `<p>Concrètement, voici comment une trame circule : non étiquetée sur les ports access, étiquetée sur le trunk.</p>` +
        dg("trunkTag")
    },

    /* 5 */ {
      id: "native", title: "Le VLAN natif",
      html:
        `<p>Le <span class="kw">VLAN natif</span> est le VLAN dont le trafic circule <strong>sans étiquette</strong>
        sur un trunk. Il assure la compatibilité avec les équipements qui ne comprennent pas 802.1Q.</p>` +

        key("Les deux règles à connaître", [
          "<b>Trames du VLAN natif</b> : elles ne doivent <u>pas</u> être étiquetées. Une trame étiquetée arrivant sur le VLAN natif est <b>abandonnée</b>.",
          "<b>Trames non étiquetées</b> reçues sur un trunk → transférées vers le <b>VLAN natif</b>. En sortie du trunk, les trames du VLAN natif partent sans tag."
        ]) +

        note("warn",
          `Le VLAN natif doit être <b>identique des deux côtés</b> du trunk, sinon fuite de trafic entre VLAN
          (« VLAN hopping ») et erreurs. Par défaut c'est le VLAN 1 — bonne pratique : le changer.`)
    },

    /* 6 */ {
      id: "dtpvtp", title: "DTP & VTP",
      html:
        `<h3>DTP — Dynamic Trunking Protocol</h3>
        <p>DTP permet de négocier automatiquement si une interface devient un trunk. Les modes :</p>
        <div class="tbl-wrap"><table class="ntbl"><thead><tr><th>Commande</th><th>Comportement</th></tr></thead><tbody>
          <tr><td><code>switchport mode access</code></td><td>Jamais trunk (port d'accès).</td></tr>
          <tr><td><code>switchport mode dynamic auto</code></td><td>Devient trunk <b>si le voisin le demande</b>.</td></tr>
          <tr><td><code>switchport mode dynamic desirable</code></td><td><b>Essaie de forcer</b> le voisin à passer en trunk.</td></tr>
          <tr><td><code>switchport mode trunk</code></td><td>Trunk <b>permanent</b>.</td></tr>
          <tr><td><code>switchport nonegotiate</code></td><td>Fige le mode (trunk/access) <b>sans négocier</b> avec le voisin.</td></tr>
        </tbody></table></div>` +

        `<h3>VTP — VLAN Trunking Protocol</h3>
        <p>VTP <strong>réplique automatiquement</strong> la base de données des VLAN entre commutateurs, pour
        ne pas avoir à recréer chaque VLAN sur chaque switch. Trois modes :</p>
        <ul>
          <li><b>Serveur</b> — crée / modifie / supprime des VLAN, et les propage.</li>
          <li><b>Client</b> — reçoit et applique, mais ne peut pas modifier.</li>
          <li><b>Transparent</b> — ne participe pas, relaie seulement les annonces (garde ses VLAN locaux).</li>
        </ul>` +

        note("exam", `Distingue bien <b>DTP</b> (négocie le <i>trunk</i>) de <b>VTP</b> (réplique la <i>base de VLAN</i>). Ce sont deux protocoles différents, souvent confondus.`)
    },

    /* 7 */ {
      id: "intervlan", title: "Routage inter-VLAN",
      html:
        `<p>Deux machines dans des VLAN différents = deux domaines de diffusion = deux réseaux IP.
        Elles <strong>ne peuvent pas communiquer directement</strong> : il faut un <span class="kw">routage inter-VLAN</span>.
        Trois méthodes existent :</p>

        <h3>① Plusieurs interfaces physiques</h3>
        <p>Un routeur avec <b>autant d'interfaces que de VLAN</b>. Simple mais coûteux et non extensible
        (une interface par VLAN).</p>

        <h3>② Router-on-a-stick</h3>
        <p>Une <b>seule interface physique en trunk</b>, découpée en plusieurs <b>sous-interfaces logiques</b>
        (une par VLAN, chacune avec une encapsulation 802.1Q et une passerelle).</p>` +
        cli("Router-on-a-stick",
`Router(config)# interface fa0/0.10
Router(config-subif)# encapsulation dot1Q 10
Router(config-subif)# ip address 192.168.10.1 255.255.255.0
Router(config-subif)# exit
Router(config)# interface fa0/0.20
Router(config-subif)# encapsulation dot1Q 20
Router(config-subif)# ip address 192.168.20.1 255.255.255.0`) +

        `<h3>③ Commutateur multicouche (L3)</h3>
        <p>Un <b>switch multicouche</b> effectue les tâches de niveau 2 <em>et</em> niveau 3. On crée une
        <b>interface virtuelle (SVI)</b> par VLAN, qui sert de passerelle, et on active le routage.
        C'est la méthode moderne (haute performance).</p>` +
        cli("Routage inter-VLAN sur switch L3",
`SW-L3(config)# interface vlan 20
SW-L3(config-if)# ip address 192.168.20.1 255.255.255.0
SW-L3(config)# interface vlan 30
SW-L3(config-if)# ip address 192.168.30.1 255.255.255.0
SW-L3(config)# ip routing            // active le routage (désactivé par défaut)`) +

        mnemo("🏎️", `<b>Router-on-a-stick</b> = pratique mais l'unique lien peut saturer.
        <b>Switch L3</b> = routage en hardware, bien plus rapide → privilégié en production.`)
    },

    /* 8 */ {
      id: "extra", title: "STP & EtherChannel (extra)",
      html:
        `<h3>STP — Spanning Tree Protocol (802.1D)</h3>
        <p>Dans un réseau commuté, on veut de la <b>redondance</b> (liens de secours) mais une boucle de
        niveau 2 provoque des <b>tempêtes de diffusion</b> qui paralysent le réseau. <span class="kw">STP</span>
        (algorithme de Radia Perlman, 1985) construit une <b>topologie sans boucle</b> en <b>bloquant
        administrativement</b> certains ports, tout en gardant les liens redondants prêts à reprendre en cas de panne.</p>` +
        note("info", `Idée clé : un <b>chemin unique</b> entre deux points à un instant donné, sans pour autant interdire les câbles en surnombre.`) +

        `<h3>EtherChannel</h3>
        <p><span class="kw">EtherChannel</span> agrège <b>plusieurs liens physiques</b> (de 2 à 8) en un
        <b>seul lien logique</b>. Objectif : augmenter la bande passante et la tolérance aux pannes entre
        switchs, routeurs et serveurs. Version ouverte normalisée : <b>IEEE 802.3ad</b> (LACP).</p>` +
        note("tip", `STP <i>bloque</i> les liens redondants ; EtherChannel les <i>regroupe</i> pour les utiliser tous à la fois — STP les voit comme un seul lien, donc pas de boucle.`)
    }
  ],

  /* ---------- QUIZ ---------- */
  quiz: [
    { q: "Sur combien de bits est codé le VID (identifiant de VLAN) dans l'étiquette 802.1Q ?",
      opts: ["8 bits", "12 bits", "16 bits", "24 bits"], a: 1,
      exp: "Le VID fait 12 bits → 4096 valeurs, dont 0 et 4095 réservés, soit 4094 VLAN utilisables." },
    { q: "Quelle valeur hexadécimale identifie le TPID 802.1Q pour Ethernet ?",
      opts: ["0x0800", "0x8100", "0x86DD", "0x8847"], a: 1,
      exp: "Le TPID vaut 0x8100. (0x0800 = IPv4, 0x86DD = IPv6 — à ne pas confondre.)" },
    { q: "Un port configuré en « access » transporte…",
      opts: ["plusieurs VLAN étiquetés", "un seul VLAN, trafic non étiqueté", "uniquement le VLAN natif", "tous les VLAN sauf le 1"], a: 1,
      exp: "Un port access appartient à un seul VLAN et envoie/reçoit du trafic non étiqueté." },
    { q: "Que se passe-t-il pour une trame du VLAN natif sur un trunk 802.1Q ?",
      opts: ["Elle est étiquetée comme les autres", "Elle circule sans étiquette", "Elle est toujours abandonnée", "Elle est dupliquée"], a: 1,
      exp: "Le trafic du VLAN natif circule SANS étiquette. Une trame étiquetée arrivant sur le natif est abandonnée." },
    { q: "Quel protocole réplique automatiquement la base de données des VLAN entre commutateurs ?",
      opts: ["DTP", "STP", "VTP", "LACP"], a: 2,
      exp: "VTP (VLAN Trunking Protocol) propage les VLAN. DTP négocie les trunks, STP évite les boucles." },
    { q: "Quelle commande force une interface à devenir un trunk permanent ?",
      opts: ["switchport mode dynamic auto", "switchport mode access", "switchport mode trunk", "switchport nonegotiate"], a: 2,
      exp: "« switchport mode trunk » fige le port en trunk permanent." },
    { q: "Dans la méthode « router-on-a-stick », l'interface du routeur est…",
      opts: ["une interface par VLAN", "une seule interface trunk découpée en sous-interfaces", "une interface VLAN (SVI)", "un port access"], a: 1,
      exp: "Une seule interface physique en trunk, divisée en sous-interfaces logiques (une par VLAN)." },
    { q: "Sur un switch multicouche, quelle commande active le routage inter-VLAN ?",
      opts: ["ip routing", "no switchport", "switchport mode trunk", "vlan database"], a: 0,
      exp: "« ip routing » active le routage L3 (désactivé par défaut). On crée aussi une SVI par VLAN." },
    { q: "L'implémentation de VLAN par adresse MAC nécessite…",
      opts: ["un serveur RADIUS", "un serveur VMPS", "un serveur DHCP", "rien de particulier"], a: 1,
      exp: "Le VLAN de niveau 2 (par MAC) requiert un serveur VMPS. L'attribution par authentification utilise RADIUS/TACACS+." },
    { q: "Quel est le rôle principal de STP ?",
      opts: ["Agréger des liens", "Éviter les boucles de niveau 2", "Router entre VLAN", "Étiqueter les trames"], a: 1,
      exp: "STP (802.1D) construit une topologie sans boucle en bloquant certains ports, tout en gardant la redondance." },
    { q: "EtherChannel permet de…",
      opts: ["bloquer les liens redondants", "regrouper 2 à 8 liens physiques en un lien logique", "créer des VLAN", "chiffrer le trafic"], a: 1,
      exp: "EtherChannel agrège plusieurs liens (norme ouverte 802.3ad / LACP) pour la bande passante et la redondance." }
  ],

  /* ---------- FLASHCARDS ---------- */
  flashcards: [
    { k: "Définition", f: "Qu'est-ce qu'un VLAN ?", b: "Un regroupement <b>logique</b> d'équipements en un domaine de diffusion, indépendant de l'emplacement physique." },
    { k: "Chiffres", f: "Combien de VLAN utilisables et pourquoi ?", b: "<b>4094</b> : le VID est sur 12 bits (4096) moins le 0 et le 4095 réservés." },
    { k: "802.1Q", f: "TPID Ethernet en 802.1Q ?", b: "<b>0x8100</b>." },
    { k: "Ports", f: "Access vs Trunk ?", b: "<b>Access</b> = 1 VLAN, non étiqueté. <b>Trunk</b> = plusieurs VLAN, étiqueté 802.1Q (+ natif non étiqueté)." },
    { k: "VLAN natif", f: "Comment circule le VLAN natif sur un trunk ?", b: "<b>Sans étiquette</b>. Les trames non étiquetées reçues sont affectées au VLAN natif." },
    { k: "Protocoles", f: "Différence DTP / VTP ?", b: "<b>DTP</b> négocie le trunk ; <b>VTP</b> réplique la base de VLAN entre switchs." },
    { k: "VTP", f: "Les 3 modes VTP ?", b: "<b>Serveur</b> (crée/propage), <b>Client</b> (reçoit), <b>Transparent</b> (relaie, garde ses VLAN locaux)." },
    { k: "Inter-VLAN", f: "Les 3 méthodes de routage inter-VLAN ?", b: "① Plusieurs interfaces physiques ② Router-on-a-stick (sous-interfaces) ③ Switch multicouche (SVI + ip routing)." },
    { k: "STP", f: "À quoi sert STP (802.1D) ?", b: "Éviter les <b>boucles de niveau 2</b> en bloquant des ports, tout en conservant la redondance." },
    { k: "EtherChannel", f: "Rôle d'EtherChannel (802.3ad) ?", b: "Agréger 2 à 8 liens physiques en un seul lien logique (bande passante + tolérance aux pannes)." }
  ]
});
