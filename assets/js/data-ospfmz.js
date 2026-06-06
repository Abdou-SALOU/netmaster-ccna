/* ===================== MODULE : OSPF Multizones ===================== */
NM.register({
  id: "ospfmz", kind: "course", color: "mz", icon: "🗺️",
  title: "OSPF Multizones",
  kicker: "Routage hiérarchique",
  est: "26 min",
  desc: "Découpage d'un domaine OSPF en zones reliées par un backbone : rôles des routeurs (IR, ABR, ASBR), types de LSA et types de zones (Stub, Totally Stubby, NSSA).",
  chips: ["Area 0", "ABR / ASBR", "LSA 1→7", "Stub / NSSA"],

  sections: [
    /* 1 */ {
      id: "concept", title: "Pourquoi des zones ?",
      html:
        `<p class="lead">Quand un réseau OSPF devient trop grand, le « passage à l'échelle » pose problème :
        surcharge du réseau, calculs SPF trop longs (CPU) et besoin de RAM important.</p>

        <p>La solution est le <span class="kw">routage hiérarchique</span> : on découpe le domaine OSPF en
        <strong>zones (areas)</strong> indépendantes, toutes reliées par une zone centrale appelée
        <strong>backbone (Area 0)</strong>.</p>` +

        key("Fonctionnement d'une zone", [
          "Chaque zone est un réseau <b>indépendant</b> : sa base topologique ne contient que ses propres liaisons.",
          "Le protocole d'<b>inondation s'arrête aux frontières</b> de la zone.",
          "Les routeurs ne calculent que les <b>routes internes</b> à leur zone.",
          "Les <b>ABR</b> (Area Border Router) appartiennent à plusieurs zones et transmettent des <b>résumés</b> entre elles."
        ]) +

        note("info", `Objectifs : <b>localiser les mises à jour</b> dans la zone, <b>limiter la taille</b> de la base topologique, et <b>réduire</b> les tables de routage. Cela impose un adressage hiérarchique soigné.`)
    },

    /* 2 */ {
      id: "regles", title: "Règles des zones & backbone",
      html:
        `<ul>
          <li><b>Toutes les zones doivent être connectées à la zone backbone (Area 0).</b></li>
          <li>Il y a <b>toujours une seule</b> zone principale (Area 0) par domaine OSPF.</li>
          <li>Les autres zones sont <b>secondaires</b> et se raccordent à l'Area 0.</li>
          <li>Tous les routeurs d'une même zone ont la <b>même table topologique</b>… mais peuvent avoir des <b>tables de routage différentes</b>.</li>
        </ul>` +

        cli("Déclaration des réseaux par zone",
`Router(config)# router ospf 100         // 100 = process-id (local au routeur)
Router(config-router)# network 10.10.1.1 0.0.0.0 area 0
Router(config-router)# network 10.1.1.2  0.0.0.0 area 1`) +

        note("warn", `Si on ne souhaite pas découper le domaine, <b>toutes les interfaces de tous les routeurs sont dans l'Area 0</b>. Une zone secondaire isolée du backbone est inaccessible (sauf virtual-link).`)
    },

    /* 3 */ {
      id: "routeurs", title: "Les types de routeurs",
      html:
        `<p>Selon leur position dans la hiérarchie, les routeurs OSPF jouent des rôles différents :</p>
        <div class="tbl-wrap"><table class="ntbl"><thead><tr><th>Routeur</th><th>Position</th><th>Rôle</th></tr></thead><tbody>
          <tr><td><b>IR</b> — Interne</td><td>Une seule zone</td><td>Toutes ses interfaces dans la même zone.</td></tr>
          <tr><td><b>ABR</b> — Border Router</td><td>Zone 0 + zone X</td><td>Frontière entre deux zones ; génère les <b>résumés (LSA 3)</b>.</td></tr>
          <tr><td><b>Backbone</b></td><td>Au moins une interface dans Area 0</td><td>Participe au backbone.</td></tr>
          <tr><td><b>ASBR</b> — AS Boundary Router</td><td>Bord du domaine OSPF</td><td>Connecté à un réseau <b>non-OSPF</b> (RIP, EIGRP, BGP…) ; <b>redistribue</b> les routes externes (LSA 5).</td></tr>
        </tbody></table></div>` +

        mnemo("📍", `<b>IR</b> reste chez lui · <b>ABR</b> garde la frontière entre zones · <b>ASBR</b> est la porte de sortie vers un autre protocole de routage.`)
    },

    /* 4 */ {
      id: "lsa", title: "Les types de LSA",
      html:
        `<p>Les <span class="kw">LSA</span> (Link State Advertisements) sont les annonces qui circulent dans OSPF.
        Leur type détermine ce qu'elles décrivent et jusqu'où elles vont :</p>
        <div class="tbl-wrap"><table class="ntbl"><thead><tr><th>Type</th><th>Nom</th><th>Description</th></tr></thead><tbody>
          <tr><td><b>1</b></td><td>Router LSA</td><td>Décrit les interfaces d'un routeur (intra-zone).</td></tr>
          <tr><td><b>2</b></td><td>Network LSA</td><td>Décrit les routeurs connectés à un segment (généré par le DR).</td></tr>
          <tr><td><b>3</b></td><td>Summary LSA</td><td>Route de <b>résumé</b> envoyée vers une autre zone par l'<b>ABR</b> (routes internes au domaine).</td></tr>
          <tr><td><b>4</b></td><td>ASBR Summary</td><td>Décrit l'<b>ASBR</b> ; généré par l'ABR pour faire connaître l'ASBR dans les autres zones.</td></tr>
          <tr><td><b>5</b></td><td>External LSA</td><td>Route <b>externe</b> redistribuée par l'ASBR (RIP, EIGRP, BGP…).</td></tr>
          <tr><td><b>7</b></td><td>NSSA External</td><td>Comme le type 5, mais autorisé dans une <b>NSSA</b> ; converti en type 5 à la sortie.</td></tr>
        </tbody></table></div>` +

        note("exam", `Moyen mnémo : <b>1</b> = mes interfaces, <b>2</b> = mon segment, <b>3</b> = résumé inter-zone, <b>4</b> = « où est l'ASBR », <b>5</b> = route externe, <b>7</b> = la « 5 déguisée » pour traverser une NSSA.`)
    },

    /* 5 */ {
      id: "zones", title: "Les types de zones",
      html:
        `<p>Pour réduire encore la taille des tables, OSPF propose des zones « spéciales » qui
        <strong>filtrent certains LSA</strong> et les remplacent par une <strong>route par défaut</strong>.
        Sélectionne un type ci-dessous pour voir ce qui passe :</p>` +

        dg("ospfAreas") +

        `<h3>Résumé comparatif</h3>
        <div class="tbl-wrap"><table class="ntbl"><thead><tr><th>Zone</th><th>LSA autorisés</th><th>Routes externes</th><th>Autres zones</th></tr></thead><tbody>
          <tr><td><b>Standard</b></td><td>1,2,3,4,5</td><td>✅ via LSA 5</td><td>✅ via LSA 3</td></tr>
          <tr><td><b>Stub</b></td><td>1,2,3</td><td>🚫 → route par défaut</td><td>✅ via LSA 3</td></tr>
          <tr><td><b>Totally Stubby</b></td><td>1,2</td><td>🚫 → route par défaut</td><td>🚫 → route par défaut</td></tr>
          <tr><td><b>NSSA</b></td><td>1,2,3,7</td><td>✅ via LSA 7 (ASBR local)</td><td>✅ via LSA 3</td></tr>
          <tr><td><b>Totally Stubby NSSA</b></td><td>1,2,7</td><td>✅ via LSA 7 (ASBR local)</td><td>🚫 → route par défaut</td></tr>
        </tbody></table></div>` +

        key("À retenir absolument", [
          "<b>Stub</b> : bloque LSA 4 & 5 (externes → route par défaut). Pas d'ASBR possible.",
          "<b>Totally Stubby</b> : bloque LSA 3, 4 & 5 (autres zones <i>et</i> externes → route par défaut).",
          "<b>NSSA</b> : une Stub qui <b>contient un ASBR</b> ; les externes entrent en <b>LSA 7</b> (→ converti en 5 par l'ABR).",
          "Par défaut, l'ABR d'une NSSA <b>n'injecte pas</b> de route par défaut : il faut <code>default-information-originate</code>.",
          "Pour une NSSA « totally stubby » (sans LSA 3) : ajouter <code>no-summary</code> sur l'ABR."
        ]) +

        cli("Configuration des zones non standards",
`Router(config)# router ospf 100
Router(config-router)# area 5 stub               // zone Stub
Router(config-router)# area 6 stub no-summary    // zone Totally Stubby
Router(config-router)# area 7 nssa               // zone NSSA
Router(config-router)# area 7 nssa default-information-originate  // injecter la défaut dans la NSSA`)
    }
  ],

  quiz: [
    { q: "Toutes les zones OSPF doivent être connectées à…",
      opts: ["l'ASBR", "la zone backbone (Area 0)", "un serveur DHCP", "la zone NSSA"], a: 1,
      exp: "Règle d'or d'OSPF multizone : chaque zone se raccorde à l'Area 0 (le backbone)." },
    { q: "Quel routeur génère les LSA de type 3 (résumés inter-zones) ?",
      opts: ["L'IR", "L'ABR", "L'ASBR", "Le DR"], a: 1,
      exp: "L'ABR (Area Border Router) génère les LSA 3 pour résumer les routes d'une zone vers une autre." },
    { q: "Un ASBR est un routeur OSPF qui…",
      opts: ["relie deux zones OSPF", "est connecté à un réseau non-OSPF (RIP, BGP…)", "est le routeur désigné", "appartient à une seule zone"], a: 1,
      exp: "L'ASBR est à la frontière du domaine OSPF, connecté à un protocole externe, et redistribue (LSA 5)." },
    { q: "Quel type de LSA transporte une route externe redistribuée par l'ASBR ?",
      opts: ["LSA 1", "LSA 3", "LSA 5", "LSA 2"], a: 2,
      exp: "Le LSA de type 5 (External) porte les routes externes (RIP, EIGRP, BGP) redistribuées par l'ASBR." },
    { q: "Une zone Stub bloque quels LSA ?",
      opts: ["1 et 2", "4 et 5", "3 et 7", "tous"], a: 1,
      exp: "La Stub bloque les LSA 4 et 5 : les routes externes sont remplacées par une route par défaut." },
    { q: "Quelle zone remplace À LA FOIS les routes externes ET celles des autres zones par une route par défaut ?",
      opts: ["Standard", "Stub", "Totally Stubby", "NSSA"], a: 2,
      exp: "La Totally Stubby bloque les LSA 3, 4 et 5 : tout l'extérieur de la zone devient une route par défaut." },
    { q: "Qu'est-ce qu'une zone NSSA ?",
      opts: ["Une zone sans routeur", "Une zone Stub qui contient un ASBR (LSA 7)", "Le backbone", "Une zone sans LSA 1"], a: 1,
      exp: "La NSSA (Not-So-Stubby Area) est une Stub autorisant un ASBR : les externes y entrent en LSA 7." },
    { q: "Le LSA 7 d'une NSSA est converti en quel type à la sortie (par l'ABR) ?",
      opts: ["LSA 1", "LSA 3", "LSA 5", "il n'est pas converti"], a: 2,
      exp: "Le LSA 7 (« LSA 5 déguisé ») est transformé en LSA 5 par l'ABR à la sortie de la NSSA." },
    { q: "Pour qu'une NSSA se comporte comme Totally Stubby (sans LSA 3), on configure l'ABR avec…",
      opts: ["default-information-originate", "no-summary", "passive-interface", "redistribute"], a: 1,
      exp: "« area X nssa no-summary » élimine les LSA 3 : la NSSA devient totally stubby." }
  ],

  flashcards: [
    { k: "But", f: "Pourquoi découper OSPF en zones ?", b: "Pour le passage à l'échelle : <b>localiser les mises à jour</b>, limiter la base topologique et réduire les tables de routage." },
    { k: "Backbone", f: "Quelle est la règle des zones ?", b: "Toutes les zones doivent se connecter à la zone <b>backbone (Area 0)</b>, unique par domaine." },
    { k: "Routeurs", f: "IR vs ABR vs ASBR ?", b: "<b>IR</b> = une seule zone · <b>ABR</b> = frontière entre zones (LSA 3) · <b>ASBR</b> = porte vers un réseau non-OSPF (LSA 5)." },
    { k: "LSA 1-2", f: "Que décrivent les LSA 1 et 2 ?", b: "<b>1</b> = interfaces d'un routeur · <b>2</b> = routeurs d'un segment (par le DR). Intra-zone." },
    { k: "LSA 3-4-5", f: "LSA 3, 4 et 5 ?", b: "<b>3</b> = résumé inter-zone (ABR) · <b>4</b> = localisation de l'ASBR · <b>5</b> = route externe (ASBR)." },
    { k: "Stub", f: "Que bloque une zone Stub ?", b: "Les LSA <b>4 et 5</b> ; les externes deviennent une route par défaut. Pas d'ASBR." },
    { k: "Totally Stubby", f: "Que bloque une Totally Stubby ?", b: "Les LSA <b>3, 4 et 5</b> : autres zones + externes → une seule route par défaut." },
    { k: "NSSA", f: "Spécificité d'une NSSA ?", b: "Stub <b>avec ASBR</b> : externes en <b>LSA 7</b>, convertis en LSA 5 par l'ABR. <code>no-summary</code> = totally stubby NSSA." }
  ]
});
