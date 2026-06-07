/* ===================================================================
   NetMaster Lab — Simulateur CLI Cisco IOS (100% navigateur)
   Moteur : modèle device + modes + parser (abréviations) + sorties show
   + labs guidés avec validation automatique et XP.
   Expose window.NMLab { render(view, sub) } appelé par app.js.
   =================================================================== */
(function () {
  "use strict";

  /* ---------------- persistance XP / progression ---------------- */
  const LKEY = "nm_lab_v1";
  function loadL() { try { return JSON.parse(localStorage.getItem(LKEY)) || { xp: 0, done: {} }; } catch { return { xp: 0, done: {} }; } }
  function saveL(s) { localStorage.setItem(LKEY, JSON.stringify(s)); }
  const LS = loadL();

  /* ---------------- utils ---------------- */
  const pad = (s, n) => { s = String(s); return s.length >= n ? s : s + " ".repeat(n - s.length); };
  const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  /* ---------------- normalisation interfaces ---------------- */
  function normIf(tok) {
    if (!tok) return null;
    const m = tok.match(/^([a-zA-Z]+)\s*([0-9](?:\/[0-9]+)*(?:\.[0-9]+)?)$/);
    if (!m) return null;
    const p = m[1].toLowerCase(), num = m[2];
    let base = null;
    if ("fastethernet".startsWith(p)) base = "FastEthernet";
    else if ("gigabitethernet".startsWith(p)) base = "GigabitEthernet";
    else if ("ethernet".startsWith(p)) base = "Ethernet";
    else if ("serial".startsWith(p)) base = "Serial";
    else if ("loopback".startsWith(p)) base = "Loopback";
    else if ("vlan".startsWith(p)) base = "Vlan";
    else return null;
    return base + num;
  }
  function shortIf(n) {
    return n.replace("FastEthernet", "Fa").replace("GigabitEthernet", "Gi")
      .replace("Ethernet", "Et").replace("Serial", "Se").replace("Loopback", "Lo").replace("Vlan", "Vl");
  }
  const kw = (tok, full, min) => { tok = (tok || "").toLowerCase(); return tok.length >= min && full.startsWith(tok); };

  /* ---------------- création device ---------------- */
  function mkIface(name, routed) {
    const sub = name.includes(".");
    return {
      name,
      shutdown: routed ? true : false,
      ip: null, mask: null, ipv6: [],
      switchport: routed ? null : { mode: "access", accessVlan: 1, trunkEncap: null, trunkAllowed: "all" },
      encap: null, desc: null
    };
  }
  function makeDevice(spec) {
    const d = {
      type: spec.type, hostname: spec.hostname, mode: "user", enabled: false, ctx: {},
      running: { hostname: spec.hostname, vlans: { 1: { name: "default" } }, ipRouting: spec.type === "router", ipv6Routing: false, ospf: null, bgp: null },
      ifaces: {}, order: []
    };
    (spec.ifaces || []).forEach(n => { d.ifaces[n] = mkIface(n, spec.type === "router"); d.order.push(n); });
    return d;
  }
  const SWITCH_IF = (() => { const a = []; for (let i = 1; i <= 24; i++) a.push("FastEthernet0/" + i); a.push("GigabitEthernet0/1", "GigabitEthernet0/2"); return a; })();
  const ROUTER_IF = ["GigabitEthernet0/0", "GigabitEthernet0/1", "GigabitEthernet0/2"];
  function newSwitch(h) { return makeDevice({ type: "switch", hostname: h, ifaces: SWITCH_IF }); }
  function newRouter(h) { return makeDevice({ type: "router", hostname: h, ifaces: ROUTER_IF }); }

  /* ---------------- prompt ---------------- */
  function prompt(d) {
    const h = d.hostname;
    return ({
      user: h + ">", enable: h + "#", config: h + "(config)#", if: h + "(config-if)#",
      subif: h + "(config-subif)#", range: h + "(config-if-range)#", vlan: h + "(config-vlan)#",
      router: h + "(config-router)#", line: h + "(config-line)#"
    })[d.mode] || h + ">";
  }

  /* ===================================================================
     PARSER — process une ligne, renvoie un tableau de lignes de sortie
     out: [{t, c}]  c = classe (ok|cmd|err|out|cmt)
     =================================================================== */
  function processLine(s, raw) {
    const d = s.dev;
    const out = [];
    const say = (t, c) => out.push({ t, c: c || "out" });
    const inval = () => say("% Invalid input detected at '^' marker.", "err");
    const incomplete = () => say("% Incomplete command.", "err");
    const line = raw.replace(/\s+$/, "");
    const parts = line.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return out;

    // aide contextuelle minimale
    if (parts[parts.length - 1] === "?") { helpFor(d, parts, say); return out; }

    const cfgModes = ["config", "if", "subif", "range", "vlan", "router", "line"];
    const a = parts.map(x => x.toLowerCase());

    /* ---- "do <cmd>" : exécuter une commande EXEC depuis le mode config ---- */
    if (cfgModes.includes(d.mode) && kw(a[0], "do", 2) && parts.length > 1) {
      const saved = d.mode, savedCtx = d.ctx; d.mode = "enable";
      const r = processLine(s, parts.slice(1).join(" "));
      d.mode = saved; d.ctx = savedCtx; return r;
    }

    /* ---- commandes communes de sortie ---- */
    if (kw(a[0], "exit", 2)) { exitMode(d); return out; }
    if (kw(a[0], "end", 3) && cfgModes.includes(d.mode)) { d.mode = "enable"; d.ctx = {}; return out; }

    /* ---- USER EXEC ---- */
    if (d.mode === "user") {
      if (kw(a[0], "enable", 2) || a[0] === "en") { d.mode = "enable"; d.enabled = true; return out; }
      if (kw(a[0], "show", 2)) return doShow(s, parts, out, say) || out;
      if (kw(a[0], "ping", 2)) return doPing(s, parts, say) || out;
      if (kw(a[0], "disable", 4)) { return out; }
      inval(); return out;
    }

    /* ---- PRIVILEGED EXEC ---- */
    if (d.mode === "enable") {
      if (kw(a[0], "configure", 4)) {
        if (a[1] && (kw(a[1], "terminal", 1))) { d.mode = "config"; return out; }
        if (!a[1]) { d.mode = "config"; say("Enter configuration commands, one per line.  End with CNTL/Z.", "cmt"); return out; }
        inval(); return out;
      }
      if (kw(a[0], "disable", 4)) { d.mode = "user"; return out; }
      if (kw(a[0], "show", 2)) return doShow(s, parts, out, say) || out;
      if (kw(a[0], "ping", 2)) return doPing(s, parts, say) || out;
      if ((kw(a[0], "write", 2)) || (kw(a[0], "copy", 2))) { say("Building configuration...", "cmt"); say("[OK]", "ok"); return out; }
      if (kw(a[0], "reload", 4)) { say("Proceed with reload? [confirm] (simulé) — ignoré.", "cmt"); return out; }
      if (kw(a[0], "clear", 3)) { return out; }
      inval(); return out;
    }

    /* ---- GLOBAL CONFIG ---- */
    if (d.mode === "config") return cfgGlobal(s, parts, a, out, say, inval, incomplete);

    /* ---- INTERFACE / SUBIF / RANGE ---- */
    if (d.mode === "if" || d.mode === "subif" || d.mode === "range") return cfgIface(s, parts, a, out, say, inval, incomplete);

    /* ---- VLAN ---- */
    if (d.mode === "vlan") {
      if (kw(a[0], "name", 2) && parts[1]) { d.running.vlans[d.ctx.vlan].name = parts[1]; return out; }
      if (a[0] === "no" && kw(a[1] || "", "name", 2)) { d.running.vlans[d.ctx.vlan].name = "VLAN" + String(d.ctx.vlan).padStart(4, "0"); return out; }
      inval(); return out;
    }

    /* ---- ROUTER (ospf/bgp) ---- */
    if (d.mode === "router") return cfgRouter(s, parts, a, out, say, inval, incomplete);

    /* ---- LINE ---- */
    if (d.mode === "line") {
      if (kw(a[0], "password", 4) || kw(a[0], "login", 3) || kw(a[0], "transport", 3)) return out;
      inval(); return out;
    }

    inval(); return out;
  }

  function exitMode(d) {
    if (["if", "subif", "range", "vlan", "router", "line"].includes(d.mode)) { d.mode = "config"; d.ctx = {}; }
    else if (d.mode === "config") d.mode = "enable";
    else if (d.mode === "enable") d.mode = "user";
    else d.mode = "user";
  }

  /* ---------------- GLOBAL CONFIG ---------------- */
  function cfgGlobal(s, parts, a, out, say, inval, incomplete) {
    const d = s.dev;
    // hostname
    if (kw(a[0], "hostname", 4)) { if (!parts[1]) return incomplete(), out; d.hostname = parts[1]; d.running.hostname = parts[1]; return out; }
    // vlan X
    if (kw(a[0], "vlan", 4) && !a[0].includes(".")) {
      const id = parseInt(parts[1], 10);
      if (!id || id < 1 || id > 4094) return say("% Invalid VLAN id.", "err"), out;
      if (!d.running.vlans[id]) d.running.vlans[id] = { name: "VLAN" + String(id).padStart(4, "0") };
      d.mode = "vlan"; d.ctx = { vlan: id }; return out;
    }
    // interface X  (+ subif)
    if (kw(a[0], "interface", 3)) {
      if (kw(a[1] || "", "range", 3)) {
        const list = parseRange(parts.slice(2).join(" "), d);
        if (!list.length) return say("% Invalid interface range.", "err"), out;
        d.mode = "range"; d.ctx = { range: list }; return out;
      }
      const nm = normIf(parts.slice(1).join(""));
      if (!nm) return say("% Invalid interface.", "err"), out;
      if (!d.ifaces[nm]) {
        // sous-interface créée à la volée si le parent existe
        if (nm.includes(".")) {
          const parent = nm.split(".")[0];
          if (!d.ifaces[parent]) return say("% Interface parente inexistante.", "err"), out;
          d.ifaces[nm] = mkIface(nm, true); d.order.push(nm);
        } else if (/^Loopback/.test(nm) || /^Vlan/.test(nm)) {
          d.ifaces[nm] = mkIface(nm, true); if (/^Vlan/.test(nm)) d.ifaces[nm].switchport = null; d.order.push(nm);
        } else return say("% Interface inexistante sur ce matériel.", "err"), out;
      }
      d.mode = nm.includes(".") ? "subif" : "if"; d.ctx = { iface: nm }; return out;
    }
    // ip routing / no ip routing
    if (kw(a[0], "ip", 2) && kw(a[1] || "", "routing", 4)) { d.running.ipRouting = true; return out; }
    if (a[0] === "no" && kw(a[1] || "", "ip", 2) && kw(a[2] || "", "routing", 4)) { d.running.ipRouting = false; return out; }
    // ipv6 unicast-routing
    if (kw(a[0], "ipv6", 4) && (a[1] || "").startsWith("unicast")) { d.running.ipv6Routing = true; return out; }
    if (a[0] === "no" && kw(a[1] || "", "ipv6", 4) && (a[2] || "").startsWith("unicast")) { d.running.ipv6Routing = false; return out; }
    // router ospf / bgp
    if (kw(a[0], "router", 4)) {
      if (kw(a[1] || "", "ospf", 4)) { const pid = parseInt(parts[2], 10) || 1; d.running.ospf = d.running.ospf || { pid, networks: [] }; d.running.ospf.pid = pid; d.mode = "router"; d.ctx = { rp: "ospf" }; return out; }
      if (kw(a[1] || "", "bgp", 3)) { const as = parseInt(parts[2], 10); if (!as) return incomplete(), out; d.running.bgp = d.running.bgp || { as, networks: [], neighbors: [] }; d.running.bgp.as = as; d.mode = "router"; d.ctx = { rp: "bgp" }; return out; }
      inval(); return out;
    }
    // line ...
    if (kw(a[0], "line", 3)) { d.mode = "line"; d.ctx = {}; return out; }
    // enable secret/password, banner, etc. — acceptés sans effet
    if (kw(a[0], "enable", 3) || kw(a[0], "banner", 3) || kw(a[0], "service", 4) || kw(a[0], "spanning-tree", 4)) return out;
    if (a[0] === "no") return out; // tolère "no <qqch>" générique
    inval(); return out;
  }

  function parseRange(str, d) {
    // ex: "fa0/1 - 5"  ou  "fa0/1-5"
    const m = str.replace(/\s/g, "").match(/^([a-zA-Z]+)([0-9])\/([0-9]+)-([0-9]+)$/);
    if (!m) { const one = normIf(str); return one && d.ifaces[one] ? [one] : []; }
    const base = m[1], slot = m[2], from = +m[3], to = +m[4], res = [];
    for (let i = from; i <= to; i++) { const nm = normIf(base + slot + "/" + i); if (nm && d.ifaces[nm]) res.push(nm); }
    return res;
  }

  /* ---------------- INTERFACE CONFIG ---------------- */
  function cfgIface(s, parts, a, out, say, inval, incomplete) {
    const d = s.dev;
    const targets = d.mode === "range" ? d.ctx.range : [d.ctx.iface];
    const each = fn => targets.forEach(nm => fn(d.ifaces[nm]));

    if (a[0] === "no" && kw(a[1] || "", "shutdown", 4)) { each(i => i.shutdown = false); return out; }
    if (kw(a[0], "shutdown", 4)) { each(i => i.shutdown = true); return out; }
    if (kw(a[0], "description", 4)) { each(i => i.desc = parts.slice(1).join(" ")); return out; }

    // ip address X Y
    if (kw(a[0], "ip", 2) && kw(a[1] || "", "address", 3)) {
      if (!parts[2] || !parts[3]) return incomplete(), out;
      if (!isIp(parts[2]) || !isIp(parts[3])) return say("% Invalid input detected at '^' marker.", "err"), out;
      each(i => { i.ip = parts[2]; i.mask = parts[3]; }); return out;
    }
    // ipv6 address X
    if (kw(a[0], "ipv6", 4) && kw(a[1] || "", "address", 3)) {
      if (!parts[2]) return incomplete(), out;
      each(i => i.ipv6.push(parts[2])); return out;
    }
    // encapsulation dot1Q N  (sous-interface)
    if (kw(a[0], "encapsulation", 4)) {
      if (!(a[1] || "").startsWith("dot1") || !parts[2]) return inval(), out;
      const v = parseInt(parts[2], 10); each(i => i.encap = v); return out;
    }
    // switchport ...
    if (kw(a[0], "switchport", 4)) {
      if (targets.some(nm => !d.ifaces[nm].switchport)) return say("% Commande non disponible sur une interface routée.", "err"), out;
      if (kw(a[1] || "", "mode", 2)) {
        if (kw(a[2] || "", "access", 3)) { each(i => i.switchport.mode = "access"); return out; }
        if (kw(a[2] || "", "trunk", 3)) { each(i => i.switchport.mode = "trunk"); return out; }
        return inval(), out;
      }
      if (kw(a[1] || "", "access", 3) && kw(a[2] || "", "vlan", 4)) {
        const v = parseInt(parts[3], 10); if (!v) return incomplete(), out;
        if (!d.running.vlans[v]) d.running.vlans[v] = { name: "VLAN" + String(v).padStart(4, "0") };
        each(i => { i.switchport.accessVlan = v; }); return out;
      }
      if (kw(a[1] || "", "trunk", 3)) {
        if (kw(a[2] || "", "encapsulation", 3)) { each(i => i.switchport.trunkEncap = (a[3] || "dot1q")); return out; }
        if (kw(a[2] || "", "allowed", 3) && kw(a[3] || "", "vlan", 4)) { each(i => i.switchport.trunkAllowed = parts.slice(4).join(" ")); return out; }
        if (kw(a[2] || "", "native", 3)) return out;
        return inval(), out;
      }
      if (kw(a[1] || "", "nonegotiate", 4)) return out;
      return inval(), out;
    }
    if (a[0] === "no") return out;
    inval(); return out;
  }

  /* ---------------- ROUTER CONFIG ---------------- */
  function cfgRouter(s, parts, a, out, say, inval, incomplete) {
    const d = s.dev, rp = d.ctx.rp;
    if (rp === "ospf") {
      if (kw(a[0], "network", 3)) {
        if (!parts[1] || !kw(a[2] || "", "area", 0)) {
          // network A wild area Z
          if (parts.length >= 5 && kw(a[3] || "", "area", 3)) {
            d.running.ospf.networks.push({ net: parts[1], wild: parts[2], area: parts[4] }); return out;
          }
          return incomplete(), out;
        }
        return incomplete(), out;
      }
      if (kw(a[0], "router-id", 6)) return out;
      if (kw(a[0], "passive-interface", 4)) return out;
      if (a[0] === "no") return out;
      inval(); return out;
    }
    if (rp === "bgp") {
      if (kw(a[0], "neighbor", 4)) {
        if (kw(a[2] || "", "remote-as", 6)) { d.running.bgp.neighbors.push({ ip: parts[1], as: parseInt(parts[3], 10) }); return out; }
        return out;
      }
      if (kw(a[0], "network", 3)) { d.running.bgp.networks.push(parts[1]); return out; }
      if (a[0] === "no") return out;
      inval(); return out;
    }
    inval(); return out;
  }

  /* ---------------- PING (simplifié) ---------------- */
  function doPing(s, parts, say) {
    const dst = parts[1] || "";
    const reach = Object.values(s.dev.ifaces).some(i => i.ip && !i.shutdown);
    if (!dst) { say("% Incomplete command.", "err"); return; }
    say("Type escape sequence to abort.", "cmt");
    say(`Sending 5, 100-byte ICMP Echos to ${dst}, timeout is 2 seconds:`, "cmt");
    say(reach ? "!!!!!" : ".....", reach ? "ok" : "err");
    say(`Success rate is ${reach ? 100 : 0} percent (${reach ? "5/5" : "0/5"})` + (reach ? ", round-trip min/avg/max = 1/2/4 ms" : ""), reach ? "ok" : "err");
  }

  function isIp(x) { return /^(\d{1,3}\.){3}\d{1,3}$/.test(x) && x.split(".").every(o => +o >= 0 && +o <= 255); }

  /* ---------------- SHOW ---------------- */
  function doShow(s, parts, out, say) {
    const d = s.dev, a = parts.map(x => x.toLowerCase());
    const tag = (t) => s.ran.add(t);
    // show running-config
    if (kw(a[1] || "", "running-config", 3) || (kw(a[1] || "", "running", 3))) { genRun(d).forEach(l => say(l.t, l.c)); tag("show running-config"); return out; }
    if (kw(a[1] || "", "startup-config", 4)) { say("% Non-volatile configuration (simulée) identique au running.", "cmt"); return out; }
    // show vlan brief / show vlan
    if (kw(a[1] || "", "vlan", 4)) { showVlan(d, say); tag("show vlan brief"); return out; }
    // show ip ...
    if (kw(a[1] || "", "ip", 2)) {
      if (kw(a[2] || "", "interface", 3) && kw(a[3] || "", "brief", 2)) { showIpIntBr(d, say); tag("show ip interface brief"); return out; }
      if (kw(a[2] || "", "route", 3)) { showIpRoute(d, say); tag("show ip route"); return out; }
      if (kw(a[2] || "", "ospf", 4) && kw(a[3] || "", "neighbor", 4)) { showOspfNei(d, say); tag("show ip ospf neighbor"); return out; }
      if (kw(a[2] || "", "protocols", 4)) { showIpProto(d, say); tag("show ip protocols"); return out; }
      say("% Sous-commande non simulée.", "cmt"); return out;
    }
    if (kw(a[1] || "", "ipv6", 4) && kw(a[2] || "", "interface", 3) && kw(a[3] || "", "brief", 2)) { showIpv6IntBr(d, say); tag("show ipv6 interface brief"); return out; }
    // show interfaces trunk
    if (kw(a[1] || "", "interfaces", 3) && kw(a[2] || "", "trunk", 3)) { showTrunk(d, say); tag("show interfaces trunk"); return out; }
    if (kw(a[1] || "", "bgp", 3) || (kw(a[1] || "", "ip", 2) && kw(a[2] || "", "bgp", 3))) { showBgp(d, say); tag("show bgp summary"); return out; }
    if (kw(a[1] || "", "version", 3)) { say("Cisco IOS Software, NetMaster Lab (simulateur pédagogique)", "out"); say(d.hostname + " uptime is 0 minutes", "out"); return out; }
    if (kw(a[1] || "", "clock", 3)) { say("*00:00:00.000 UTC " + new Date().toDateString(), "out"); return out; }
    say("% Commande show non simulée — essaie: run, vlan brief, ip int brief, ip route, ip ospf neighbor.", "cmt");
    return out;
  }

  function ifList(d) { return d.order.map(n => d.ifaces[n]); }

  function showIpIntBr(d, say) {
    say("Interface              IP-Address      OK? Method Status                Protocol", "out");
    ifList(d).forEach(i => {
      const ip = i.ip || "unassigned";
      const status = i.shutdown ? "administratively down" : (i.ip || d.type === "switch" ? "up" : "down");
      const proto = i.shutdown ? "down" : (i.ip || d.type === "switch" ? "up" : "down");
      say(pad(i.name, 23) + pad(ip, 16) + "YES " + pad(i.ip ? "manual" : "unset", 7) + pad(status, 22) + proto, "out");
    });
  }
  function showIpv6IntBr(d, say) {
    ifList(d).forEach(i => {
      say(pad(i.name, 23) + (i.shutdown ? "[administratively down/down]" : "[up/up]"), "out");
      (i.ipv6.length ? i.ipv6 : []).forEach(x => say("    " + x, "out"));
      if (!i.ipv6.length) say("    unassigned", "cmt");
    });
  }
  function showVlan(d, say) {
    say("VLAN Name                             Status    Ports", "out");
    say("---- -------------------------------- --------- -------------------------------", "out");
    const ids = Object.keys(d.running.vlans).map(Number).sort((x, y) => x - y);
    const accessPortsOf = id => ifList(d).filter(i => i.switchport && i.switchport.mode === "access" && i.switchport.accessVlan === id && !i.name.startsWith("Vlan")).map(i => shortIf(i.name));
    ids.forEach(id => {
      const ports = accessPortsOf(id);
      const chunks = [];
      for (let k = 0; k < ports.length; k += 6) chunks.push(ports.slice(k, k + 6).join(", "));
      say(pad(id, 5) + pad(d.running.vlans[id].name, 33) + pad("active", 10) + (chunks[0] || ""), "out");
      for (let k = 1; k < chunks.length; k++) say(pad("", 48) + chunks[k], "out");
    });
  }
  function showTrunk(d, say) {
    const trunks = ifList(d).filter(i => i.switchport && i.switchport.mode === "trunk");
    if (!trunks.length) { say("(aucun port en mode trunk)", "cmt"); return; }
    say("Port        Mode      Encapsulation  Status        Native vlan", "out");
    trunks.forEach(i => say(pad(shortIf(i.name), 12) + pad("on", 10) + pad(i.switchport.trunkEncap || "802.1q", 15) + pad("trunking", 14) + "1", "out"));
    say("", "out");
    say("Port        Vlans allowed on trunk", "out");
    trunks.forEach(i => say(pad(shortIf(i.name), 12) + (i.switchport.trunkAllowed || "all"), "out"));
  }
  function showIpRoute(d, say) {
    say("Codes: L - local, C - connected, O - OSPF, B - BGP", "cmt");
    say("", "out");
    const conn = ifList(d).filter(i => i.ip && !i.shutdown);
    if (!conn.length) { say("(aucune route — configure des IP et 'no shutdown')", "cmt"); return; }
    conn.forEach(i => {
      const net = networkOf(i.ip, i.mask);
      say(`C    ${net}/${maskToCidr(i.mask)} is directly connected, ${shortIf(i.name)}`, "ok");
      say(`L    ${i.ip}/32 is directly connected, ${shortIf(i.name)}`, "out");
    });
    if (d.running.ospf) say("(OSPF activé — aucune adjacence dans ce lab mono-routeur)", "cmt");
  }
  function showOspfNei(d, say) {
    if (!d.running.ospf) { say("(OSPF non configuré)", "cmt"); return; }
    say("Neighbor ID     Pri   State           Dead Time   Address         Interface", "out");
    say("(aucun voisin — lab mono-routeur ; la config réseau/aire est néanmoins validée)", "cmt");
  }
  function showIpProto(d, say) {
    if (d.running.ospf) {
      say('Routing Protocol is "ospf ' + d.running.ospf.pid + '"', "out");
      d.running.ospf.networks.forEach(n => say(`    ${n.net} ${n.wild} area ${n.area}`, "out"));
    } else if (d.running.bgp) { say('Routing Protocol is "bgp ' + d.running.bgp.as + '"', "out"); }
    else say("(aucun protocole de routage dynamique configuré)", "cmt");
  }
  function showBgp(d, say) {
    if (!d.running.bgp) { say("% BGP not active", "err"); return; }
    say(`BGP router identifier, local AS number ${d.running.bgp.as}`, "out");
    say("Neighbor        V    AS   State/PfxRcd", "out");
    d.running.bgp.neighbors.forEach(n => say(pad(n.ip, 16) + "4 " + pad(n.as, 6) + "Idle (lab mono-routeur)", "out"));
    if (!d.running.bgp.neighbors.length) say("(aucun voisin configuré)", "cmt");
  }
  function genRun(d) {
    const L = [], add = (t, c) => L.push({ t, c: c || "out" });
    add("Building configuration...", "cmt"); add("", "out");
    add("Current configuration:", "cmt"); add("!", "cmt");
    add("hostname " + d.hostname, "out"); add("!", "cmt");
    if (d.running.ipv6Routing) { add("ipv6 unicast-routing", "out"); add("!", "cmt"); }
    Object.keys(d.running.vlans).map(Number).filter(x => x !== 1).sort((x, y) => x - y).forEach(id => {
      add("vlan " + id, "out"); add(" name " + d.running.vlans[id].name, "out"); add("!", "cmt");
    });
    ifList(d).forEach(i => {
      add("interface " + i.name, "out");
      if (i.desc) add(" description " + i.desc, "out");
      if (i.encap) add(" encapsulation dot1Q " + i.encap, "out");
      if (i.switchport) {
        if (i.switchport.mode === "access" && i.switchport.accessVlan !== 1) { add(" switchport mode access", "out"); add(" switchport access vlan " + i.switchport.accessVlan, "out"); }
        if (i.switchport.mode === "trunk") { if (i.switchport.trunkEncap) add(" switchport trunk encapsulation " + i.switchport.trunkEncap, "out"); add(" switchport mode trunk", "out"); }
      }
      if (i.ip) add(" ip address " + i.ip + " " + i.mask, "out");
      i.ipv6.forEach(x => add(" ipv6 address " + x, "out"));
      add(i.shutdown ? " shutdown" : " no shutdown", i.shutdown ? "cmt" : "out");
      add("!", "cmt");
    });
    if (d.running.ipRouting && d.type === "router") { } // implicite
    if (d.running.ospf) { add("router ospf " + d.running.ospf.pid, "out"); d.running.ospf.networks.forEach(n => add(` network ${n.net} ${n.wild} area ${n.area}`, "out")); add("!", "cmt"); }
    if (d.running.bgp) { add("router bgp " + d.running.bgp.as, "out"); d.running.bgp.neighbors.forEach(n => add(` neighbor ${n.ip} remote-as ${n.as}`, "out")); d.running.bgp.networks.forEach(x => add(" network " + x, "out")); add("!", "cmt"); }
    add("end", "out");
    return L;
  }

  /* ---------------- réseau utils ---------------- */
  function maskToCidr(m) { return (m || "").split(".").map(o => (+o).toString(2)).join("").split("0")[0].length || 0; }
  function networkOf(ip, mask) {
    const i = ip.split(".").map(Number), m = mask.split(".").map(Number);
    return i.map((o, k) => o & m[k]).join(".");
  }

  /* ---------------- aide contextuelle ---------------- */
  function helpFor(d, parts, say) {
    const lvl = {
      user: "  enable, ping, show, exit",
      enable: "  configure terminal, show, ping, write, disable, exit",
      config: "  hostname, vlan, interface, ip routing, ipv6 unicast-routing, router ospf|bgp, line, exit",
      if: "  ip address, no shutdown, switchport mode, switchport access vlan, switchport trunk, description, exit",
      subif: "  encapsulation dot1Q <vlan>, ip address, no shutdown, exit",
      range: "  switchport ..., no shutdown, exit",
      vlan: "  name <mot>, exit",
      router: "  network ..., neighbor ... (selon ospf/bgp), exit"
    }[d.mode] || "  exit";
    say("Commandes possibles :", "cmt"); say(lvl, "out");
  }

  /* ===================================================================
     LABS
     =================================================================== */
  const LABS = [
    {
      id: "vlan", title: "TP — VLANs & Trunk", icon: "🔀", color: "vlan", xp: 100,
      device: () => newSwitch("Switch"),
      intro: "Tu es sur un switch d'usine. Configure deux VLANs, affecte des ports en mode accès et crée un lien trunk.",
      topo: "PC1 → Fa0/1  |  PC2 → Fa0/2  |  Trunk vers un autre switch → Fa0/24",
      objectives: [
        { id: "h", t: "Renommer le switch en <b>S1</b>", hint: "En mode config : <code>hostname S1</code>", c: s => s.dev.running.hostname === "S1" },
        { id: "v10", t: "Créer le <b>VLAN 10</b> nommé <b>SALES</b>", hint: "<code>vlan 10</code> puis <code>name SALES</code>", c: s => s.dev.running.vlans[10] && /^sales$/i.test(s.dev.running.vlans[10].name) },
        { id: "v20", t: "Créer le <b>VLAN 20</b> nommé <b>IT</b>", hint: "<code>vlan 20</code> puis <code>name IT</code>", c: s => s.dev.running.vlans[20] && /^it$/i.test(s.dev.running.vlans[20].name) },
        { id: "p1", t: "Mettre <b>Fa0/1</b> en accès VLAN 10", hint: "<code>interface fa0/1</code> → <code>switchport mode access</code> → <code>switchport access vlan 10</code>", c: s => { const i = s.dev.ifaces["FastEthernet0/1"]; return i.switchport.mode === "access" && i.switchport.accessVlan === 10; } },
        { id: "p2", t: "Mettre <b>Fa0/2</b> en accès VLAN 20", hint: "Comme Fa0/1 mais avec le VLAN 20", c: s => { const i = s.dev.ifaces["FastEthernet0/2"]; return i.switchport.mode === "access" && i.switchport.accessVlan === 20; } },
        { id: "tr", t: "Configurer <b>Fa0/24</b> en <b>trunk</b>", hint: "<code>interface fa0/24</code> → <code>switchport mode trunk</code>", c: s => s.dev.ifaces["FastEthernet0/24"].switchport.mode === "trunk" },
        { id: "ver", t: "Vérifier avec <code>show vlan brief</code>", hint: "Tape <code>show vlan brief</code> en mode privilégié (#)", c: s => s.ran.has("show vlan brief") }
      ]
    },
    {
      id: "ros", title: "TP — Routage inter-VLAN (Router-on-a-stick)", icon: "🛣️", color: "ospf", xp: 120,
      device: () => newRouter("Router"),
      intro: "Le switch envoie un trunk vers Gi0/0 du routeur. Crée les sous-interfaces pour router entre VLAN 10 et 20.",
      topo: "Trunk switch → Gi0/0  |  VLAN10 = 192.168.10.0/24  |  VLAN20 = 192.168.20.0/24",
      objectives: [
        { id: "h", t: "Renommer le routeur en <b>R1</b>", hint: "<code>hostname R1</code>", c: s => s.dev.running.hostname === "R1" },
        { id: "up", t: "Activer l'interface physique <b>Gi0/0</b> (<code>no shutdown</code>)", hint: "<code>interface gi0/0</code> → <code>no shutdown</code>", c: s => !s.dev.ifaces["GigabitEthernet0/0"].shutdown },
        { id: "s10", t: "Sous-interface <b>Gi0/0.10</b> : dot1Q 10 + IP 192.168.10.1/24", hint: "<code>interface gi0/0.10</code> → <code>encapsulation dot1Q 10</code> → <code>ip address 192.168.10.1 255.255.255.0</code>", c: s => { const i = s.dev.ifaces["GigabitEthernet0/0.10"]; return i && i.encap === 10 && i.ip === "192.168.10.1"; } },
        { id: "s20", t: "Sous-interface <b>Gi0/0.20</b> : dot1Q 20 + IP 192.168.20.1/24", hint: "Comme la .10 mais VLAN 20 et 192.168.20.1", c: s => { const i = s.dev.ifaces["GigabitEthernet0/0.20"]; return i && i.encap === 20 && i.ip === "192.168.20.1"; } },
        { id: "ver", t: "Vérifier avec <code>show ip route</code>", hint: "<code>show ip route</code> doit montrer les réseaux connectés", c: s => s.ran.has("show ip route") }
      ]
    },
    {
      id: "ospf", title: "TP — OSPF mono-aire", icon: "🌐", color: "mz", xp: 130,
      device: () => newRouter("Router"),
      intro: "Configure les interfaces du routeur puis active OSPF dans l'aire 0 pour les deux réseaux.",
      topo: "Gi0/0 = 10.0.0.1/30 (vers le voisin)  |  Gi0/1 = 192.168.1.1/24 (LAN)",
      objectives: [
        { id: "h", t: "Renommer le routeur en <b>R1</b>", hint: "<code>hostname R1</code>", c: s => s.dev.running.hostname === "R1" },
        { id: "g0", t: "<b>Gi0/0</b> : IP 10.0.0.1/30 + activée", hint: "<code>interface gi0/0</code> → <code>ip address 10.0.0.1 255.255.255.252</code> → <code>no shutdown</code>", c: s => { const i = s.dev.ifaces["GigabitEthernet0/0"]; return i.ip === "10.0.0.1" && !i.shutdown; } },
        { id: "g1", t: "<b>Gi0/1</b> : IP 192.168.1.1/24 + activée", hint: "<code>interface gi0/1</code> → <code>ip address 192.168.1.1 255.255.255.0</code> → <code>no shutdown</code>", c: s => { const i = s.dev.ifaces["GigabitEthernet0/1"]; return i.ip === "192.168.1.1" && !i.shutdown; } },
        { id: "proc", t: "Activer le processus <b>OSPF</b> (router ospf 1)", hint: "<code>router ospf 1</code>", c: s => !!s.dev.running.ospf },
        { id: "n1", t: "Annoncer <b>10.0.0.0 0.0.0.3 area 0</b>", hint: "<code>network 10.0.0.0 0.0.0.3 area 0</code>", c: s => s.dev.running.ospf && s.dev.running.ospf.networks.some(n => n.net === "10.0.0.0" && n.area === "0") },
        { id: "n2", t: "Annoncer <b>192.168.1.0 0.0.0.255 area 0</b>", hint: "<code>network 192.168.1.0 0.0.0.255 area 0</code>", c: s => s.dev.running.ospf && s.dev.running.ospf.networks.some(n => n.net === "192.168.1.0" && n.area === "0") }
      ]
    }
  ];
  function labById(id) { return LABS.find(l => l.id === id); }

  /* ===================================================================
     RENDU
     =================================================================== */
  function render(view, sub) {
    if (!sub || sub === "") return renderList(view);
    if (sub === "sandbox") return renderLab(view, null);
    const lab = labById(sub);
    if (!lab) { location.hash = "#/lab"; return; }
    renderLab(view, lab);
  }

  function crumb(arr) {
    const c = document.getElementById("crumbs");
    if (c) c.innerHTML = arr.map((p, i) => (i ? `<span class="sep">/</span>` : "") +
      (i < arr.length - 1 ? `<span style="cursor:pointer" onclick="location.hash='#/${p[1]}'">${p[0]}</span>` : `<b>${p[0]}</b>`)).join(" ");
  }

  function renderList(view) {
    crumb([["Accueil", ""], ["Labs CLI", ""]]);
    document.documentElement.style.setProperty("--mc", "var(--r-tp)");
    view.innerHTML = `
      <div class="mod-hero" style="--mc:var(--r-tp)">
        <div class="mh-ico">🖥️</div>
        <div><h1>NetMaster Lab — Console Cisco IOS</h1>
        <p>Tape de vraies commandes IOS dans un terminal simulé. Choisis un <b>lab guidé</b> (objectifs validés automatiquement) ou explore en <b>bac à sable</b>.</p></div>
      </div>
      <div class="lab-xpbar">
        <span class="lab-xp">⚡ ${LS.xp} XP</span>
        <span class="lab-xp-sub">${Object.keys(LS.done).length} / ${LABS.length} labs terminés</span>
      </div>
      <div class="section-head"><h2>Labs guidés</h2><span class="sub">Validation automatique + indices</span></div>
      <div class="lab-grid">
        ${LABS.map(labCard).join("")}
        <article class="lab-card sandbox" data-lab="sandbox" style="--mc:var(--r-tp)">
          <div class="lab-top"><div class="lab-ico">🧪</div><div><div class="lab-title">Bac à sable libre</div><div class="lab-kic">Switch + Routeur</div></div></div>
          <div class="lab-desc">Aucune contrainte : entraîne-toi sur toutes les commandes, change de device, teste les <code>show</code>.</div>
          <div class="lab-meta"><span>Ouvrir la console →</span></div>
        </article>
      </div>`;
    [...view.querySelectorAll("[data-lab]")].forEach(c => c.addEventListener("click", () => location.hash = "#/lab/" + c.dataset.lab));
  }
  function labCard(l) {
    const done = LS.done[l.id];
    return `<article class="lab-card" data-lab="${l.id}" style="--mc:var(--r-${l.color})">
      <div class="lab-top"><div class="lab-ico">${l.icon}</div><div><div class="lab-title">${l.title}</div><div class="lab-kic">${l.objectives.length} objectifs · ${l.xp} XP</div></div></div>
      <div class="lab-desc">${l.intro}</div>
      <div class="lab-meta"><span>${done ? "✅ Terminé — rejouer" : "Démarrer le lab"} →</span></div>
      ${done ? `<div class="lab-done-badge">✓</div>` : ""}
    </article>`;
  }

  function renderLab(view, lab) {
    const sandbox = !lab;
    crumb([["Accueil", ""], ["Labs CLI", "lab"], [sandbox ? "Bac à sable" : lab.title, ""]]);
    const color = sandbox ? "tp" : lab.color;
    document.documentElement.style.setProperty("--mc", `var(--r-${color})`);

    // session : devices + device actif
    const devices = sandbox ? [newSwitch("Switch"), newRouter("Router")] : [lab.device()];
    const session = { dev: devices[0], devices, ran: new Set(), history: [], hpos: -1, xpGiven: {} };

    const objHtml = sandbox ? "" : lab.objectives.map((o, i) =>
      `<li class="lab-obj" data-obj="${o.id}"><span class="lab-obj-ck">${i + 1}</span><span class="lab-obj-t">${o.t}</span></li>`).join("");

    view.innerHTML = `
      <div class="lab-run" style="--mc:var(--r-${color})">
        <div class="lab-head">
          <button class="dg-btn" onclick="location.hash='#/lab'">← Labs</button>
          <div class="lab-head-title">${sandbox ? "🧪 Bac à sable" : lab.icon + " " + lab.title}</div>
          <div class="lab-head-actions">
            ${devices.length > 1 ? `<div class="lab-devtabs" id="devtabs">${devices.map((d, i) => `<button class="lab-devtab ${i === 0 ? "on" : ""}" data-dev="${i}">${d.type === "switch" ? "🔀 " : "🛰️ "}${d.hostname}</button>`).join("")}</div>` : ""}
            <button class="dg-btn" id="labReset">↻ Réinitialiser</button>
          </div>
        </div>
        ${sandbox ? "" : `<div class="lab-brief"><b>🎯 Mission :</b> ${lab.intro}<div class="lab-topo">🗺️ ${lab.topo}</div></div>`}
        <div class="lab-body">
          <div class="term" id="term">
            <div class="term-out" id="termOut"></div>
            <div class="term-input-row">
              <span class="term-prompt" id="termPrompt"></span>
              <input class="cli-input" id="cliInput" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="send" />
            </div>
          </div>
          ${sandbox ? "" : `<aside class="lab-objs">
            <div class="lab-objs-head">Objectifs <span id="objCount">0/${lab.objectives.length}</span></div>
            <ul class="lab-objlist" id="objList">${objHtml}</ul>
            <div class="lab-obj-actions">
              <button class="dg-btn" id="labHint">💡 Indice</button>
              <button class="dg-btn primary" id="labCheck">✔ Vérifier</button>
            </div>
            <div class="lab-hintbox" id="hintBox"></div>
          </aside>`}
        </div>
      </div>`;

    const out = view.querySelector("#termOut");
    const input = view.querySelector("#cliInput");
    const promptEl = view.querySelector("#termPrompt");
    const term = view.querySelector("#term");

    function refreshPrompt() { promptEl.textContent = prompt(session.dev); }
    function append(t, c) { const div = document.createElement("div"); div.className = "tl tl-" + (c || "out"); div.innerHTML = esc(t) || "&nbsp;"; out.appendChild(div); }
    function scroll() { term.scrollTop = term.scrollHeight; }

    function banner() {
      append("NetMaster Lab — Cisco IOS (simulateur pédagogique)", "cmt");
      append("Tape '?' pour l'aide contextuelle. 'show running-config' pour voir ta config.", "cmt");
      if (devices.length > 1) append("Astuce : bascule entre Switch et Routeur avec les onglets en haut.", "cmt");
      append("", "out");
    }

    function runCommand(raw) {
      append(prompt(session.dev) + " " + raw, "echo");
      const res = processLine(session, raw);
      res.forEach(l => append(l.t, l.c));
      refreshPrompt(); scroll();
      if (!sandbox) updateObjectives();
    }

    function updateObjectives(announce = true) {
      let done = 0;
      lab.objectives.forEach(o => {
        let ok = false; try { ok = !!o.c(session); } catch (e) { ok = false; }
        const li = view.querySelector(`[data-obj="${o.id}"]`);
        if (ok) {
          done++;
          if (li && !li.classList.contains("done")) {
            li.classList.add("done"); li.querySelector(".lab-obj-ck").textContent = "✓";
            if (announce && !session.xpGiven[o.id]) { session.xpGiven[o.id] = 1; toast("Objectif validé ✓"); }
          }
        }
      });
      view.querySelector("#objCount").textContent = done + "/" + lab.objectives.length;
      if (done === lab.objectives.length && !session.completed) { session.completed = true; completeLab(); }
    }

    function completeLab() {
      const first = !LS.done[lab.id];
      LS.done[lab.id] = lab.objectives.length;
      if (first) LS.xp += lab.xp;
      saveL(LS);
      append("", "out");
      append("════════════════════════════════════════", "ok");
      append("🎉 LAB TERMINÉ ! Tous les objectifs sont validés." + (first ? "  +" + lab.xp + " XP" : "  (déjà complété)"), "ok");
      append("════════════════════════════════════════", "ok");
      scroll();
      toast("🎉 Lab terminé ! " + (first ? "+" + lab.xp + " XP" : ""));
      const ca = view.querySelector("#labCheck"); if (ca) { ca.textContent = "🎉 Terminé"; ca.disabled = true; }
    }

    // device tabs
    [...view.querySelectorAll("[data-dev]")].forEach(b => b.addEventListener("click", () => {
      view.querySelectorAll(".lab-devtab").forEach(x => x.classList.remove("on"));
      b.classList.add("on"); session.dev = devices[+b.dataset.dev]; refreshPrompt();
      append("--- device actif : " + session.dev.hostname + " ---", "cmt"); scroll(); input.focus();
    }));

    // input handling
    input.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        const v = input.value; input.value = "";
        if (v.trim()) { session.history.push(v); }
        session.hpos = session.history.length;
        runCommand(v);
      } else if (e.key === "ArrowUp") {
        if (session.history.length) { session.hpos = Math.max(0, session.hpos - 1); input.value = session.history[session.hpos] || ""; e.preventDefault(); setTimeout(() => input.setSelectionRange(input.value.length, input.value.length), 0); }
      } else if (e.key === "ArrowDown") {
        if (session.history.length) { session.hpos = Math.min(session.history.length, session.hpos + 1); input.value = session.history[session.hpos] || ""; e.preventDefault(); }
      } else if (e.key === "Tab") {
        e.preventDefault(); const c = complete(session.dev, input.value); if (c) input.value = c;
      }
    });
    term.addEventListener("click", () => input.focus());

    if (!sandbox) {
      view.querySelector("#labHint").addEventListener("click", () => {
        const next = lab.objectives.find(o => { try { return !o.c(session); } catch { return true; } });
        const box = view.querySelector("#hintBox");
        box.innerHTML = next ? `💡 <b>Prochain objectif :</b> ${next.t}<br>${next.hint}` : "✅ Tous les objectifs sont déjà validés !";
        box.classList.add("show");
      });
      view.querySelector("#labCheck").addEventListener("click", () => { updateObjectives(true); const box = view.querySelector("#hintBox"); if (!session.completed) { box.innerHTML = "🔍 Vérification effectuée — continue les objectifs restants."; box.classList.add("show"); } });
    }
    view.querySelector("#labReset").addEventListener("click", () => { renderLab(view, lab); });

    banner(); refreshPrompt();
    if (!sandbox) updateObjectives(false);
    setTimeout(() => input.focus(), 60);
  }

  /* ---- complétion simple (Tab) ---- */
  function complete(d, val) {
    const tokens = val.split(/\s+/);
    const last = tokens[tokens.length - 1].toLowerCase();
    if (!last) return null;
    const sets = {
      user: ["enable", "show", "ping", "exit"],
      enable: ["configure", "show", "ping", "write", "disable", "exit"],
      config: ["hostname", "vlan", "interface", "ip", "ipv6", "router", "line", "no", "exit"],
      if: ["ip", "ipv6", "switchport", "shutdown", "no", "description", "encapsulation", "exit"],
      subif: ["encapsulation", "ip", "no", "exit"],
      range: ["switchport", "no", "exit"],
      vlan: ["name", "exit"], router: ["network", "neighbor", "no", "exit"], line: ["password", "login", "exit"]
    }[d.mode] || [];
    const m = sets.filter(w => w.startsWith(last));
    if (m.length === 1) { tokens[tokens.length - 1] = m[0]; return tokens.join(" ") + " "; }
    return null;
  }

  /* ---- toast (réutilise celui de l'app) ---- */
  let tT;
  function toast(msg) { const t = document.getElementById("toast"); if (!t) return; t.textContent = msg; t.classList.add("show"); clearTimeout(tT); tT = setTimeout(() => t.classList.remove("show"), 1900); }

  window.NMLab = { render, LABS };
})();
