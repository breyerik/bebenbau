/* Bebenbau – Kern: Konfiguration, Materialien, Hilfsfunktionen */
(function () {
'use strict';
const BB = globalThis.BB = globalThis.BB || {};
const G = 9.81;
const CFG = {
  dt: 1 / 60,
  substeps: 40,
  stiff: 120,          // Dehnsteifigkeit EA = stiff * max. Tragkraft  (=> ca. 0,8 % Dehnung beim Versagen)
  strength: 1.0,       // globaler Faktor auf alle Tragkräfte
  lRef: 6,             // Knicklänge: Druckstäbe länger als lRef verlieren Tragkraft mit (lRef/L)^2
  windDepthBridge: 3,  // m Breite, die bei Brücken Wind fängt (Fahrbahnbreite)
  windDepthTower: 0.25,  // m Breite pro Stab bei Türmen (Planen, Fassade)
  quakeQ: 1.0,         // Verhaltensbeiwert q (Duktilität, vgl. EN 1998): Ersatzkraft F = pga·m·g / q
  damping: 1.0,        // 1/s Geschwindigkeitsdämpfung (~5 % Bauwerksdämpfung)
  jointMass: 5,        // kg pro Knoten (Knotenblech)
  gravRamp: 0.6,       // s Hochlaufzeit der Schwerkraft
  loadStart: 0.8,      // s bis Erdbeben/Wind einsetzen
  maxTime: 90,
  sagLimitMin: 0.6,
};
const STYLE = {
  'holz': { color: '#b4783a', dark: '#7a4a1e', w: 0.22, icon: 'holz' },
  'stahlseil': { color: '#2f343a', dark: '#111', w: 0.07, icon: 'seil' },
  'stahlprofil': { color: '#3f6c99', dark: '#22415f', w: 0.2, icon: 'stahl' },
  'stahlbeton': { color: '#a3a39d', dark: '#6c6c66', w: 0.3, icon: 'beton' },
  'mauerwerk': { color: '#b8553c', dark: '#7b2f1f', w: 0.3, icon: 'mauer' },
};
const FALLBACK_COLORS = ['#8a6', '#a68', '#68a', '#aa6', '#6aa'];

function num(v, d) { const n = Number(v); return (v === null || v === undefined || v === '' || !isFinite(n)) ? d : n; }

function prepMaterials(raw) {
  raw = Array.isArray(raw) && raw.length ? raw : [{ name: 'Holz', max_zug_kN: 60, max_druck_kN: 45, gewicht_kg_pro_m: 8, kosten_pro_m: 10 }];
  return raw.map((m, i) => {
    const name = String(m.name || ('Material ' + (i + 1)));
    const st = STYLE[name.toLowerCase()] || { color: FALLBACK_COLORS[i % 5], dark: '#333', w: 0.2, icon: 'stahl' };
    const zug = Math.max(0, num(m.max_zug_kN, 50)) * 1000;
    const druck = Math.max(0, num(m.max_druck_kN, 50)) * 1000;
    return {
      name, zug, druck, kgpm: Math.max(0.5, num(m.gewicht_kg_pro_m, 10)), cost: Math.max(0, num(m.kosten_pro_m, 10)),
      color: st.color, dark: st.dark, width: st.w, icon: st.icon, cable: druck <= 0,
    };
  });
}


Object.assign(BB, { G, CFG, STYLE, num, prepMaterials });
if (typeof module !== 'undefined' && module.exports) module.exports = BB;
})();
