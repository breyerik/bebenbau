/* Bebenbau – Level-Aufbereitung (Lastfälle aus lastfaelle.json), Raster, Validierung, Kosten */
(function () {
'use strict';
const BB = globalThis.BB = globalThis.BB || {};
const { G, CFG, num } = BB;
function vehicleSpec(t) {
  if (t <= 3.5) return { kind: 'pkw', length: 4.2, axles: [0.7, 3.3], name: 'Pkw' };
  if (t <= 16) return { kind: 'mischer', length: 7.5, axles: [0.9, 4.8, 6.2], name: 'Betonmischer' };
  return { kind: 'lkw', length: 10, axles: [0.9, 2.2, 7.5, 8.8], name: 'Lkw' };
}

function prepLevel(raw, idx) {
  const L = raw.last || {};
  const typ = String(L.typ || '').toLowerCase();
  let anchors = (Array.isArray(raw.ankerpunkte) && raw.ankerpunkte.length ? raw.ankerpunkte : [[0, 0], [num(raw.spannweite_m, 8), 0]])
    .map(p => ({ x: num(Array.isArray(p) ? p[0] : p.x, 0), y: num(Array.isArray(p) ? p[1] : p.y, 0) }));
  // doppelte Anker entfernen
  anchors = anchors.filter((a, i) => anchors.findIndex(b => Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6) === i);
  const xs = anchors.map(a => a.x), ys = anchors.map(a => a.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const span = num(raw.spannweite_m, maxX - minX);
  const H = num(L.turmhoehe_m, num(raw.turmhoehe_m, 0));
  const kind = H > 0 ? 'tower' : 'bridge';
  const lv = {
    nr: num(raw.nr, idx + 1), name: String(raw.name || ('Level ' + (idx + 1))), beschreibung: String(raw.beschreibung || ''),
    budget: num(raw.budget, 1000), span, anchors, kind, H, raw,
    quake: null, wind: null, truck: null, walkers: null, payload: 0,
  };
  if (typ === 'erdbeben' || L.pga_g !== undefined) {
    lv.quake = { pga: num(L.pga_g, 0.2), f: num(L.frequenz_hz, 1.5), dur: num(L.dauer_s, 10) };
  }
  if (typ === 'sturm' || L.wind_kmh !== undefined) {
    const v = num(L.wind_kmh, 90);
    lv.wind = { v: v / 3.6, gust: num(L.boen_kmh, v * 1.3) / 3.6, dur: num(L.dauer_s, 15) };
  }
  const truckT = typ === 'lkw' ? num(L.gewicht_t, 3) : num(L.zusatz_lkw_t, 0);
  if (truckT > 0) lv.truck = { t: truckT, kmh: num(L.geschwindigkeit_kmh, 15), brake: !!L.bremsen, spec: vehicleSpec(truckT) };
  lv.payload = num(L.nutzlast_t, 0) * 1000;
  if (kind === 'bridge') {
    const leftC = anchors.filter(a => Math.abs(a.x - minX) < 1e-6).sort((a, b) => Math.abs(a.y) - Math.abs(b.y));
    const rightC = anchors.filter(a => Math.abs(a.x - maxX) < 1e-6).sort((a, b) => Math.abs(a.y) - Math.abs(b.y));
    lv.roadA = leftC[0]; lv.roadB = rightC[0];
    if (!lv.truck) lv.walkers = { n: 4, kg: 90, speed: 1.3 };
  }
  const width = maxX - minX;
  const height = kind === 'tower' ? H : Math.max(...ys) - Math.min(...ys);
  lv.grid = Math.max(width, height) <= 16 ? 1 : 2;
  const g = lv.grid;
  if (kind === 'bridge') {
    const ry = [lv.roadA.y, lv.roadB.y];
    const extra = Math.max(2, Math.min(6, lv.span * 0.3));
    lv.bx0 = lv.roadA.x; lv.bx1 = lv.roadB.x;
    lv.by0 = Math.floor(Math.min(Math.min(...ys), Math.min(...ry) - extra) / g) * g;
    lv.by1 = Math.ceil(Math.max(Math.max(...ys), Math.max(...ry) + extra) / g) * g;
    lv.gapBottom = Math.min(lv.by0, Math.min(...ys)) - 1.5;
    lv.sagLimit = Math.max(CFG.sagLimitMin, lv.span / 12);
  } else {
    lv.bx0 = Math.floor((minX - g) / g) * g; lv.bx1 = Math.ceil((maxX + g) / g) * g;
    lv.by0 = 0; lv.by1 = Math.ceil(H / g) * g + g;
    lv.gapBottom = 0;
  }
  lv.maxLen = g * 7;
  lv.snaps = snapPoints(lv);
  return lv;
}

function onRoad(lv, x, y) {
  if (!lv.roadA) return false;
  const a = lv.roadA, b = lv.roadB;
  if (x < a.x - 1e-6 || x > b.x + 1e-6) return false;
  const yy = a.y + (b.y - a.y) * (x - a.x) / ((b.x - a.x) || 1);
  return Math.abs(yy - y) < 1e-3;
}
function roadY(lv, x) { const a = lv.roadA, b = lv.roadB; return a.y + (b.y - a.y) * (x - a.x) / ((b.x - a.x) || 1); }
function groundAt(lv, x) {
  if (lv.kind === 'tower') return 0;
  if (x <= lv.roadA.x) return lv.roadA.y;
  if (x >= lv.roadB.x) return lv.roadB.y;
  return lv.gapBottom;
}

function snapPoints(lv) {
  const g = lv.grid, pts = [];
  const key = (x, y) => Math.round(x * 1000) + ',' + Math.round(y * 1000);
  const seen = new Set();
  const add = (x, y, road) => { const k = key(x, y); if (seen.has(k)) return; seen.add(k); pts.push({ x, y, road: !!road }); };
  lv.anchors.forEach(a => add(a.x, a.y, onRoad(lv, a.x, a.y)));
  if (lv.roadA) {
    for (let x = Math.ceil(lv.roadA.x / g) * g; x <= lv.roadB.x + 1e-9; x += g) add(x, roadY(lv, x), true);
  }
  for (let x = Math.ceil(lv.bx0 / g) * g; x <= lv.bx1 + 1e-9; x += g)
    for (let y = lv.by0; y <= lv.by1 + 1e-9; y += g) {
      if (lv.kind === 'bridge' && lv.roadA && Math.abs(lv.roadA.y - lv.roadB.y) > 1e-6) {
        // Rampe: Rasterpunkte zu nah an der Fahrbahn weglassen
        const ry = roadY(lv, x);
        if (Math.abs(ry - y) < g * 0.35 && Math.abs(ry - y) > 1e-3) continue;
      }
      add(x, y, onRoad(lv, x, y));
    }
  return pts;
}

function designCost(design, mats) {
  let c = 0;
  for (const [a, b, m] of design.members) {
    const p = design.nodes[a], q = design.nodes[b];
    c += Math.hypot(p[0] - q[0], p[1] - q[1]) * (mats[m] ? mats[m].cost : 0);
  }
  return Math.round(c);
}
function stars(cost, budget) { if (cost > budget) return 0; if (cost <= budget * 0.7) return 3; if (cost <= budget * 0.85) return 2; return 1; }

function payloadNodeIdx(lv, design) {
  const out = [];
  design.nodes.forEach((p, i) => { if (p[1] >= lv.H - 0.01) out.push(i); });
  return out;
}

function validate(lv, design) {
  if (!design.members.length) return 'Bau zuerst ein paar Stäbe!';
  if (lv.kind === 'tower') {
    const used = new Set(); design.members.forEach(m => { used.add(m[0]); used.add(m[1]); });
    if (!payloadNodeIdx(lv, design).some(i => used.has(i))) return 'Der Turm muss bis zur Zielhöhe von ' + fmt(lv.H) + ' m reichen.';
  } else {
    // Fahrbahn durchgehend?
    const segs = design.members.filter(m => onRoad(lv, ...design.nodes[m[0]]) && onRoad(lv, ...design.nodes[m[1]]))
      .map(m => [Math.min(design.nodes[m[0]][0], design.nodes[m[1]][0]), Math.max(design.nodes[m[0]][0], design.nodes[m[1]][0])]).sort((a, b) => a[0] - b[0]);
    let reach = lv.roadA.x;
    for (const s of segs) if (s[0] <= reach + 1e-6) reach = Math.max(reach, s[1]);
    if (reach < lv.roadB.x - 1e-6) return 'Die Fahrbahn (gestrichelte Linie) muss durchgehend gebaut sein.';
  }
  return null;
}
function fmt(n) { return String(Math.round(n * 10) / 10).replace('.', ','); }


Object.assign(BB, { vehicleSpec, prepLevel, onRoad, roadY, groundAt, snapPoints, designCost, stars, payloadNodeIdx, validate, fmt });
if (typeof module !== 'undefined' && module.exports) module.exports = BB;
})();
