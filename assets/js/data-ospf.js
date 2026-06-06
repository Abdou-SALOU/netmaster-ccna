/* ===================== MODULE : Routage État de Lien (OSPF) ===================== */
NM.register({
  id: "ospf", kind: "course", color: "ospf", icon: "🌐",
  title: "Routage État de Lien",
  kicker: "OSPF · Couche 3",
  est: "22 min",
  desc: "Le principe des protocoles à état de lien : inondation des LSP, base topologique commune et calcul du plus court chemin par l'algorithme de Dijkstra (SPF).",
  chips: ["LSP", "Dijkstra / SPF", "Inondation", "vs Vecteur de distance"],

  sections: [
    /* 1 */ {
      id: "principe", title: "Le principe « État de Lien »",
      html:
        `<p class="lead">Dans un protocole à <span class="kw">état de lien</span> (Link State, ex. OSPF),
        chaque routeur construit une <strong>carte complète</strong> du réseau, puis calcule
        <strong>lui-même</strong> le plus court chemin vers chaque destination.</p>

        <p>Au démarrage, chaque nœud ne connaît que le <strong>coût vers ses voisins directs</strong> —
        pas toute la topologie. Le calcul de la table de routage se fait de manière <strong>distribuée</strong> :</p>
        <ul>
          <li>Les nœuds n'échangent qu'avec leurs <b>voisins directs</b> par des messages.</li>
          <li>Tous les nœuds exécutent <b>exactement le même algorithme</b>, en parallèle.</li>
          <li>Nœuds et liens peuvent tomber en panne, des messages peuvent se perdre → le protocole doit être robuste.</li>
        </ul>` +

        key("Caractéristiques (vue protocolaire)", [
          "Les routeurs <b>testent périodiquement</b> l'état des liens avec leurs voisins.",
          "Ils <b>inondent</b> ces états à tous les autres routeurs du domaine.",
          "Chaque routeur obtient une <b>base de données identique et cohérente</b> (diffusion avec acquittement, contrôle par checksum).",
          "Métriques basées sur des paramètres multiples : débit, délai, coût, fiabilité.",
          "Pas de diffusion périodique des tables complètes : on ne diffuse que <b>les changements d'état</b> (up/down) → moins de charge."
        ])
    },

    /* 2 */ {
      id: "phases", title: "Les deux phases",
      html:
        `<p>Un protocole à état de lien fonctionne en <strong>deux temps</strong> :</p>
        <div class="compare">
          <div class="col a"><h4>① Inondation</h4>
            <p>La topologie est <b>inondée</b> via des paquets « <b>État de lien</b> » (LSP).</p>
            <p style="color:var(--text-2)">➜ Chaque nœud finit par connaître <b>toute la topologie</b>.</p></div>
          <div class="col b"><h4>② Calcul SPF</h4>
            <p>Chaque nœud calcule sa <b>propre table de retransmission</b>.</p>
            <p style="color:var(--text-2)">➜ avec l'algorithme <b>SPF de Dijkstra</b> (ou équivalent).</p></div>
        </div>` +

        note("info", `« Inondation » = <b>diffusion globale d'une connaissance locale</b> : chaque nœud propage à tous ce qu'il sait de ses propres liens.`)
    },

    /* 3 */ {
      id: "dijkstra", title: "Algorithme de Dijkstra (SPF)",
      html:
        `<p>L'algorithme <span class="kw">SPF (Shortest Path First) de Dijkstra</span> construit, depuis un nœud
        source, l'<strong>arbre des plus courts chemins</strong> vers tous les autres nœuds. Le principe, étape par étape :</p>
        <ol>
          <li>On part de la source (distance 0). Tous les autres sont à l'infini.</li>
          <li>On <b>fige</b> le nœud non visité de plus petite distance.</li>
          <li>On <b>relâche</b> ses voisins : si passer par lui réduit leur distance, on met à jour.</li>
          <li>On répète jusqu'à avoir figé tous les nœuds.</li>
        </ol>
        <p>Déroule l'algorithme sur l'exemple ci-dessous (depuis le routeur <b>E</b>) :</p>` +

        dg("dijkstra") +

        note("exam",
          `Remarque clé de cet exemple : pour atteindre <b>A</b>, le meilleur chemin passe par <b>C</b> (coût 4),
          alors que le lien direct E–A coûte 10. Dijkstra trouve toujours le coût total minimal, pas le lien le plus court.`) +

        mnemo("🧠", `Dijkstra = « <b>je fige toujours le moins cher d'abord</b>, puis je vois si ça améliore ses voisins ».`)
    },

    /* 4 */ {
      id: "flooding", title: "LSP, inondation & pannes",
      html:
        `<h3>Le paquet LSP</h3>
        <p>Chaque nœud émet un <span class="kw">LSP</span> (Link State Packet) décrivant <b>sa</b> portion de la topologie :
        la liste de ses voisins et le coût de chaque lien, accompagnée d'un <strong>numéro de séquence</strong>.</p>
        <p>Exemple — le LSP du nœud E contient sa connaissance locale : <code>A=10, B=4, C=1, D=2, F=2</code>.
        Il est envoyé à A, B, C, D et F, qui le relaient à leur tour (inondation).</p>` +

        `<h3>Gestion d'un changement (panne)</h3>
        <p>Supposons que le nœud <b>G</b> tombe en panne. Dès que ses voisins (F et B) détectent son absence,
        ils émettent une <b>mise à jour</b> (nouveau LSP avec un numéro de séquence incrémenté) indiquant
        <code>G = ∞</code>. Cette information est inondée, et chaque routeur <b>recalcule son arbre SPF</b>.</p>` +

        key("Pourquoi le numéro de séquence ?", [
          "Il permet de savoir quel LSP est le plus <b>récent</b>.",
          "On ignore les LSP plus anciens → évite de revenir à un état périmé.",
          "Combiné au checksum et à une <b>durée de validité</b>, il garantit une base cohérente."
        ]) +

        note("tip", `Comme on ne diffuse que les <b>changements</b> d'état (et non toute la table), la charge réseau et la taille des messages restent faibles.`)
    },

    /* 5 */ {
      id: "compare", title: "Vecteur de distance vs État de lien",
      html:
        `<p>Les deux grandes familles de protocoles de routage intérieur :</p>
        <div class="tbl-wrap"><table class="ntbl"><thead>
          <tr><th>Critère</th><th>Vecteur de distance (RIP…)</th><th>État de lien (OSPF…)</th></tr></thead><tbody>
          <tr><td>Vision du réseau</td><td>« par ouï-dire » (ce que disent les voisins)</td><td>Carte <b>complète</b> du réseau</td></tr>
          <tr><td>Information échangée</td><td>Toute la <b>table de routage</b></td><td>Les <b>états de liens</b> (LSP)</td></tr>
          <tr><td>Échangée avec</td><td>Voisins directs</td><td><b>Tout</b> le domaine (par inondation)</td></tr>
          <tr><td>Calcul</td><td>Bellman-Ford</td><td><b>Dijkstra (SPF)</b></td></tr>
          <tr><td>Convergence</td><td>Lente (risque de boucles)</td><td><b>Rapide</b></td></tr>
          <tr><td>Ressources</td><td>Faibles (CPU/RAM)</td><td><b>Plus exigeant</b> (CPU/RAM)</td></tr>
          <tr><td>Métrique</td><td>Nombre de sauts</td><td>Coût (basé sur la bande passante…)</td></tr>
        </tbody></table></div>` +

        note("exam", `À retenir : <b>état de lien = plus de calcul mais plus de flexibilité, d'adaptabilité et une convergence rapide</b>. Utilisé largement depuis 1979.`)
    }
  ],

  quiz: [
    { q: "Quel algorithme un protocole à état de lien utilise-t-il pour calculer les plus courts chemins ?",
      opts: ["Bellman-Ford", "Dijkstra (SPF)", "Spanning Tree", "Diffusion par horizon partagé"], a: 1,
      exp: "Les protocoles à état de lien (OSPF) utilisent l'algorithme SPF de Dijkstra." },
    { q: "Que contient un LSP (Link State Packet) ?",
      opts: ["Toute la table de routage du nœud", "La portion locale de topologie (voisins + coûts) + n° de séquence", "Uniquement l'adresse du routeur", "La liste des VLAN"], a: 1,
      exp: "Un LSP décrit la connaissance locale d'un nœud (ses liens et leurs coûts) avec un numéro de séquence." },
    { q: "Dans un protocole à état de lien, l'information de topologie est diffusée…",
      opts: ["uniquement aux voisins directs", "à tout le domaine par inondation", "au routeur désigné seulement", "jamais (statique)"], a: 1,
      exp: "L'inondation propage les LSP à TOUS les routeurs du domaine : chacun obtient la carte complète." },
    { q: "À quoi sert le numéro de séquence d'un LSP ?",
      opts: ["À chiffrer le LSP", "À identifier le LSP le plus récent", "À compter les sauts", "À définir la métrique"], a: 1,
      exp: "Le numéro de séquence permet de distinguer le LSP le plus récent et d'ignorer les périmés." },
    { q: "Avantage principal de l'état de lien sur le vecteur de distance ?",
      opts: ["Moins de CPU/RAM", "Convergence rapide et vision complète du réseau", "Pas besoin de métrique", "Aucune inondation"], a: 1,
      exp: "L'état de lien converge vite et donne à chaque routeur une carte complète, au prix de plus de ressources." },
    { q: "Au démarrage, que connaît un routeur à état de lien ?",
      opts: ["Toute la topologie", "Seulement le coût vers ses voisins directs", "Toutes les routes externes", "Rien du tout"], a: 1,
      exp: "Initialement, le nœud ne connaît que le coût vers ses voisins ; la topologie complète vient par inondation." },
    { q: "Dans l'exemple Dijkstra depuis E, pourquoi A est-il atteint via C plutôt qu'en direct ?",
      opts: ["Le lien direct E-A est coupé", "Via C le coût total (4) est inférieur au lien direct (10)", "C est le routeur désigné", "A refuse le lien direct"], a: 1,
      exp: "Dijkstra minimise le coût TOTAL : E→C→A = 1+3 = 4, bien moins que le lien direct E-A = 10." },
    { q: "Quand un nœud tombe en panne, comment le réseau réagit ?",
      opts: ["Rien, attend le prochain cycle complet", "Ses voisins inondent une mise à jour, chacun recalcule son SPF", "Le routeur central reconfigure tout", "On redémarre le réseau"], a: 1,
      exp: "Les voisins détectent la panne et inondent un nouveau LSP (n° de séquence incrémenté) ; chaque routeur recalcule." }
  ],

  flashcards: [
    { k: "Principe", f: "En une phrase, l'état de lien ?", b: "Chaque routeur construit une <b>carte complète</b> du réseau (par inondation des LSP) puis calcule lui-même le plus court chemin (Dijkstra)." },
    { k: "Phases", f: "Les 2 phases d'un protocole à état de lien ?", b: "① <b>Inondation</b> des LSP (connaître toute la topologie) ② <b>Calcul SPF</b> de Dijkstra (table de routage)." },
    { k: "LSP", f: "Que décrit un LSP ?", b: "La portion <b>locale</b> de topologie d'un nœud : ses voisins, le coût de chaque lien, + un n° de séquence." },
    { k: "Dijkstra", f: "Règle de base de Dijkstra ?", b: "On fige toujours le nœud non visité de <b>plus petite distance</b>, puis on relâche ses voisins." },
    { k: "Inondation", f: "Définition de l'inondation ?", b: "« Diffusion globale d'une connaissance locale » : chaque nœud propage ses LSP à tout le domaine." },
    { k: "Séquence", f: "Rôle du numéro de séquence ?", b: "Identifier le LSP le plus <b>récent</b> et ignorer les versions périmées." },
    { k: "Comparaison", f: "Calcul : vecteur de distance vs état de lien ?", b: "Vecteur de distance = <b>Bellman-Ford</b> (nb de sauts). État de lien = <b>Dijkstra/SPF</b> (coût)." },
    { k: "Charge", f: "Pourquoi l'état de lien charge peu le réseau en régime établi ?", b: "On ne diffuse que les <b>changements d'état</b> (up/down), pas toute la table périodiquement." }
  ]
});
