/* ===================== MODULE : BGP 4 (Routage externe) ===================== */
NM.register({
  id: "bgp", kind: "course", color: "bgp", icon: "🛰️",
  title: "Routage Externe — BGP 4",
  kicker: "Inter-AS · à vecteur de chemin",
  est: "26 min",
  desc: "Le protocole de routage d'Internet : systèmes autonomes, sessions eBGP/iBGP sur TCP, attributs et politique de routage.",
  chips: ["AS", "eBGP / iBGP", "AS_PATH", "Attributs", "TCP 179"],

  sections: [
    /* 1 */ {
      id: "as", title: "Le système autonome (AS)",
      html:
        `<p class="lead">Pour réduire la taille des tables de routage, Internet est découpé en
        <span class="kw">systèmes autonomes (AS)</span> : un domaine de routage (réseaux + routeurs) sous
        la responsabilité d'une <strong>autorité unique</strong>, avec sa propre politique.</p>

        <ul>
          <li>Chaque AS est identifié par un <b>numéro unique</b> attribué par le NIC.
          16 bits (RFC 1771), puis <b>32 bits</b> depuis 2007 (RFC 4893).</li>
          <li>AS <b>officiels</b> (enregistrés) : <code>1 → 64511</code>.</li>
          <li>AS <b>privés</b> : <code>64512 → 65535</code>.</li>
          <li>À l'intérieur d'un AS, on utilise un ou plusieurs <b>IGP</b> (OSPF…) et/ou du routage statique.</li>
        </ul>` +

        key("Deux types d'AS (fonctionnels)", [
          "<b>AS clients</b> : producteurs ou consommateurs de paquets IP.",
          "<b>AS de transit</b> : ne font que transporter le trafic qu'on leur confie — généralement les <b>FAI</b>."
        ])
    },

    /* 2 */ {
      id: "intro", title: "Le protocole BGP 4",
      html:
        `<p>Un <strong>protocole de routage externe</strong> échange les informations de routage <em>entre</em> AS.
        Historiquement EGP (obsolète, classful), aujourd'hui <span class="kw">BGP</span> (Border Gateway Protocol),
        en version 4 depuis 1994 (RFC 4271).</p>

        <ul>
          <li>BGP est le <b>seul protocole</b> utilisé pour le routage <b>sur Internet</b>.</li>
          <li>Il est <b>sans classe</b> (classless) et utilise l'<b>agrégation de routes</b> pour limiter la taille des tables.</li>
          <li>Deux composantes :
            <ul>
              <li><b>eBGP</b> (Exterior) : <b>entre deux AS</b>.</li>
              <li><b>iBGP</b> (Interior) : <b>à l'intérieur d'un AS</b>.</li>
            </ul></li>
        </ul>` +

        key("Objectifs de BGP", [
          "Échanger des routes entre organismes indépendants (opérateurs, gros sites).",
          "Implémenter la <b>politique de routage</b> de chaque organisme (respect des contrats).",
          "Être <b>indépendant des IGP</b> internes.",
          "Supporter le <b>passage à l'échelle</b> d'Internet, minimiser le trafic, stabiliser le routage."
        ])
    },

    /* 3 */ {
      id: "principes", title: "Principes & connectivité",
      html:
        `<p>BGP ne se base pas sur une métrique classique mais sur les <strong>chemins parcourus</strong>
        (les AS traversés), les <strong>attributs</strong> des préfixes et un ensemble de <strong>règles de
        sélection</strong> définies par l'administrateur. C'est un protocole de type <span class="kw">PATH-vecteur</span>.</p>` +

        key("Caractéristiques fondamentales", [
          "Chaque entité est identifiée par un <b>numéro d'AS</b>.",
          "BGP est un protocole <b>applicatif sur TCP, port 179</b> → transmission fiable, garantie.",
          "<b>Mode connecté</b> : envoi initial complet, puis <b>seulement les mises à jour</b>.",
          "Sessions <b>point-à-point</b> entre routeurs de bord d'AS (symétrie entre pairs).",
          "Politique de routage = <b>filtrage</b> des routes apprises et annoncées, via les attributs."
        ]) +

        note("warn", `Règle d'or : <b>annoncer une route vers un réseau, c'est accepter le trafic à destination de ce réseau.</b>`) +

        `<h3>eBGP vs iBGP — la connectivité</h3>
        <div class="compare">
          <div class="col a"><h4>eBGP (entre AS)</h4>
            <ul><li>Sur liens <b>point-à-point</b> directs (TTL = 1).</li>
            <li>Si le lien physique tombe, la session tombe.</li></ul></div>
          <div class="col b"><h4>iBGP (dans l'AS)</h4>
            <ul><li>Établi sur des <b>adresses logiques</b> (loopback).</li>
            <li>Survit à une panne de lien si un chemin alternatif existe (grâce à l'IGP, ex. OSPF).</li>
            <li>Doit former un <b>maillage complet (full mesh)</b> logique entre routeurs de bord.</li></ul></div>
        </div>` +

        note("info", `Le maillage iBGP est <b>logique</b> (sessions TCP), pas physique : ce sont les IGP internes (OSPF…) qui assurent la connectivité réelle entre les routeurs de bord.`)
    },

    /* 4 */ {
      id: "pathvector", title: "AS_PATH & vecteur de chemin",
      html:
        `<p>Lorsqu'une route est annoncée d'un AS à l'autre, chaque AS <strong>préfixe son propre numéro</strong>
        dans l'attribut <span class="kw">AS_PATH</span>. Ce chemin sert à choisir la meilleure route <em>et</em>
        à <strong>détecter les boucles</strong> : si un routeur voit son propre numéro d'AS dans l'AS_PATH reçu, il rejette la route.</p>` +

        dg("bgpAS") +

        `<h3>Les tables (RIB) d'un routeur BGP</h3>
        <p>Un routeur BGP manipule trois tables :</p>
        <div class="tbl-wrap"><table class="ntbl"><thead><tr><th>Table</th><th>Sens</th><th>Contenu</th></tr></thead><tbody>
          <tr><td><b>Adj-RIB-In</b></td><td>Entrée</td><td>Informations <b>reçues</b> et non encore traitées.</td></tr>
          <tr><td><b>Loc-RIB</b></td><td>Interne</td><td>Informations <b>locales</b> au routeur (après filtrage en entrée + config).</td></tr>
          <tr><td><b>Adj-RIB-Out</b></td><td>Sortie</td><td>Informations <b>à annoncer</b> aux voisins (après filtrage en sortie).</td></tr>
        </tbody></table></div>` +
        note("tip", `Flux : réception → <b>filtrage en entrée</b> → Adj-RIB-In → Loc-RIB → <b>filtrage en sortie</b> → Adj-RIB-Out → annonce.`)
    },

    /* 5 */ {
      id: "attributs", title: "Les attributs BGP",
      html:
        `<p>Chaque préfixe est associé à des <span class="kw">attributs</span> classés en 4 catégories :</p>
        <div class="tbl-wrap"><table class="ntbl"><thead><tr><th>Catégorie</th><th>Pris en charge ?</th><th>Propagé ?</th></tr></thead><tbody>
          <tr><td><span class="badge b-wm">Well-known Mandatory</span></td><td>Obligatoire</td><td>Obligatoire</td></tr>
          <tr><td><span class="badge b-wd">Well-known Discretionary</span></td><td>Obligatoire</td><td>Optionnel</td></tr>
          <tr><td><span class="badge b-ot">Optional Transitive</span></td><td>Pas forcément</td><td>Propagé</td></tr>
          <tr><td><span class="badge b-on">Optional Non-transitive</span></td><td>Pas forcément</td><td>Ignoré si non supporté</td></tr>
        </tbody></table></div>

        <h3>Les attributs à connaître</h3>
        <div class="tbl-wrap"><table class="ntbl"><thead><tr><th>Attribut</th><th>Rôle</th><th>Type</th></tr></thead><tbody>
          <tr><td><b>AS_PATH</b></td><td>Liste ordonnée des AS traversés (anti-boucle).</td><td><span class="badge b-wm">WM</span></td></tr>
          <tr><td><b>Next Hop</b></td><td>Adresse IP du prochain saut (voisin eBGP).</td><td><span class="badge b-wm">WM</span></td></tr>
          <tr><td><b>Origin</b></td><td>Origine de la route (IGP, EGP, Incomplete).</td><td><span class="badge b-wm">WM</span></td></tr>
          <tr><td><b>Local Preference</b></td><td>Préférer certaines routes <b>sortantes</b> (interne à l'AS).</td><td><span class="badge b-wd">WD</span></td></tr>
          <tr><td><b>Atomic Aggregate</b></td><td>Indique une agrégation de routes.</td><td><span class="badge b-wd">WD</span></td></tr>
          <tr><td><b>Aggregator</b></td><td>Routeur/AS ayant réalisé l'agrégation.</td><td><span class="badge b-ot">OT</span></td></tr>
          <tr><td><b>Community</b></td><td>Marquage de routes (étiquette de politique).</td><td><span class="badge b-ot">OT</span></td></tr>
          <tr><td><b>MED</b></td><td>Préférer un <b>point d'entrée</b> (destiné aux AS voisins).</td><td><span class="badge b-on">ON</span></td></tr>
          <tr><td><b>Weight</b></td><td>Extension <b>Cisco</b> : préférence purement <b>locale</b>, jamais transmise.</td><td>local</td></tr>
        </tbody></table></div>` +

        note("exam", `Ne confonds pas : <b>Local Preference</b> influence le trafic <i>sortant</i> de ton AS ; <b>MED</b> suggère aux voisins par où <i>entrer</i> dans ton AS ; <b>Weight</b> est Cisco et reste local au routeur.`)
    },

    /* 6 */ {
      id: "politique", title: "La politique de routage",
      html:
        `<p>La <span class="kw">politique de routage</span> est ce qui distingue BGP des IGP : on choisit
        <strong>quelles routes accepter et annoncer</strong>, et on <strong>manipule les attributs</strong>.</p>
        <div class="compare">
          <div class="col a"><h4>🎯 Objectifs</h4>
            <ul><li>Sélection parmi les routes reçues</li>
            <li>Sélection parmi les routes à annoncer</li>
            <li>Positionnement d'attributs</li></ul></div>
          <div class="col b"><h4>🛠️ Moyens</h4>
            <ul><li>Filtrage de préfixes</li>
            <li>Filtrage d'AS_PATH (expressions régulières)</li>
            <li>Manipulation d'attributs</li>
            <li>Agrégation de préfixes</li></ul></div>
        </div>` +

        cli("Voisinage eBGP minimal",
`R1(config)# router bgp 65001                          // mon n° d'AS
R1(config-router)# neighbor 200.0.0.2 remote-as 65002 // voisin eBGP (autre AS)
R1(config-router)# network 200.1.0.0 mask 255.255.255.0
!
! iBGP : on s'appuie souvent sur les loopbacks (update-source)
R1(config-router)# neighbor 10.0.0.2 remote-as 65001  // même AS = iBGP
R1(config-router)# neighbor 10.0.0.2 update-source loopback0`) +

        note("info", `Pour l'eBGP multisaut (routeurs non directement connectés), on utilise <code>ebgp-multihop</code> et souvent <code>update-source</code> sur une loopback.`)
    }
  ],

  quiz: [
    { q: "Sur quel protocole et quel port BGP établit-il ses sessions ?",
      opts: ["UDP 520", "TCP 179", "TCP 89", "UDP 179"], a: 1,
      exp: "BGP est applicatif et fiable : il utilise TCP, port 179." },
    { q: "BGP est un protocole de routage de type…",
      opts: ["vecteur de distance", "état de lien", "à vecteur de chemin (path-vector)", "statique"], a: 2,
      exp: "BGP fonde ses décisions sur les chemins (AS_PATH) et les attributs : c'est un path-vector." },
    { q: "Quelle plage correspond aux numéros d'AS privés ?",
      opts: ["1 à 64511", "64512 à 65535", "0 à 1023", "1024 à 4095"], a: 1,
      exp: "AS officiels : 1–64511. AS privés : 64512–65535 (sur 16 bits)." },
    { q: "À quoi sert l'attribut AS_PATH ?",
      opts: ["À chiffrer la route", "À lister les AS traversés et détecter les boucles", "À donner la métrique", "À indiquer le port TCP"], a: 1,
      exp: "AS_PATH liste les AS traversés ; un routeur rejette une route contenant son propre AS (anti-boucle)." },
    { q: "Les sessions iBGP entre routeurs de bord d'un AS doivent former…",
      opts: ["une étoile", "un maillage complet (full mesh) logique", "un anneau", "un arbre"], a: 1,
      exp: "iBGP n'a pas de mécanisme anti-boucle interne → full mesh logique requis (ou route-reflectors)." },
    { q: "Quel attribut, propre à Cisco, reste local au routeur et n'est jamais transmis ?",
      opts: ["Local Preference", "MED", "Weight", "Community"], a: 2,
      exp: "Le Weight est une extension Cisco, purement locale au routeur." },
    { q: "Local Preference influence principalement…",
      opts: ["le trafic entrant depuis les voisins", "le trafic sortant de l'AS", "le port d'écoute", "la fragmentation"], a: 1,
      exp: "Local Preference est diffusé en interne pour choisir la route SORTANTE préférée de l'AS." },
    { q: "Quelles sont les trois tables (RIB) d'un routeur BGP ?",
      opts: ["In, Out, Forward", "Adj-RIB-In, Loc-RIB, Adj-RIB-Out", "FIB, RIB, CAM", "ARP, MAC, Routing"], a: 1,
      exp: "Adj-RIB-In (reçu), Loc-RIB (local), Adj-RIB-Out (à annoncer)." },
    { q: "Que signifie « annoncer une route vers un réseau » en BGP ?",
      opts: ["Refuser ce réseau", "Accepter le trafic à destination de ce réseau", "Le supprimer de la table", "Le chiffrer"], a: 1,
      exp: "Annoncer une route = se déclarer chemin vers ce réseau = accepter d'acheminer son trafic." },
    { q: "Un AS de transit est typiquement…",
      opts: ["un poste client", "un FAI qui transporte le trafic des autres", "un serveur DNS", "un switch L2"], a: 1,
      exp: "Les AS de transit (FAI) ne font que transporter le trafic ; les AS clients en sont source/destination." }
  ],

  flashcards: [
    { k: "AS", f: "Qu'est-ce qu'un système autonome (AS) ?", b: "Un domaine de routage (réseaux + routeurs) sous une <b>autorité unique</b>, avec sa propre politique, identifié par un numéro." },
    { k: "Transport", f: "BGP utilise quel transport ?", b: "<b>TCP port 179</b> (fiable). Envoi initial complet puis seulement les mises à jour." },
    { k: "Type", f: "Famille de BGP ?", b: "<b>Path-vector</b> (à vecteur de chemin) : décisions basées sur l'AS_PATH et les attributs." },
    { k: "eBGP/iBGP", f: "eBGP vs iBGP ?", b: "<b>eBGP</b> = entre 2 AS (lien direct, TTL 1). <b>iBGP</b> = dans l'AS (loopbacks, full mesh logique)." },
    { k: "AS_PATH", f: "Double rôle de l'AS_PATH ?", b: "Choisir la meilleure route ET <b>détecter les boucles</b> (rejet si son propre AS apparaît)." },
    { k: "Attributs WM", f: "Les 3 attributs Well-known Mandatory ?", b: "<b>AS_PATH</b>, <b>Next Hop</b>, <b>Origin</b>." },
    { k: "LocalPref/MED", f: "Local Preference vs MED ?", b: "<b>Local Pref</b> = trafic <i>sortant</i> (interne à l'AS). <b>MED</b> = suggère aux voisins le point d'<i>entrée</i>." },
    { k: "RIB", f: "Les 3 RIB BGP ?", b: "<b>Adj-RIB-In</b> (reçu), <b>Loc-RIB</b> (local), <b>Adj-RIB-Out</b> (à annoncer)." }
  ]
});
