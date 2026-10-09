// Referenz-Konstruktionen (Nachweis der Lösbarkeit) + Materialoptimierer
const BB = (require('../src/core.js'), require('../src/levels.js'), require('../src/sim.js'), require('../src/explain.js'));
class D {
  constructor(lv) { this.lv = lv; this.nodes = lv.anchors.map(a => [a.x, a.y]); this.members = []; this.brace = []; }
  n(x, y) { x = +x.toFixed(6); y = +y.toFixed(6); let i = this.nodes.findIndex(p => Math.abs(p[0] - x) < 1e-6 && Math.abs(p[1] - y) < 1e-6); if (i < 0) { this.nodes.push([x, y]); i = this.nodes.length - 1; } return i; }
  m(p, q, brace) { const a = this.n(...p), b = this.n(...q); if (a === b) return; if (this.members.some(m => (m[0] === a && m[1] === b) || (m[0] === b && m[1] === a))) return; this.members.push([a, b, brace ? 1 : 2]); this.brace.push(!!brace); }
  get() { return { nodes: this.nodes.map(p => p.slice()), members: this.members.map(m => m.slice()), brace: this.brace.slice() }; }
}
const snapR = (lv, y) => Math.round(y / lv.grid) * lv.grid;
function truss(d, lv, step, h, pattern) {
  const ry = x => BB.roadY(lv, x), x0 = lv.roadA.x, x1 = lv.roadB.x;
  const xs = []; for (let x = x0; x <= x1 + 1e-9; x += step) xs.push(+x.toFixed(6));
  if (xs[xs.length - 1] < x1 - 1e-6) xs.push(x1);
  const ty = x => snapR(lv, ry(x) + h);
  for (let i = 0; i < xs.length - 1; i++) d.m([xs[i], ry(xs[i])], [xs[i + 1], ry(xs[i + 1])]);
  for (let i = 1; i < xs.length - 1; i++) d.m([xs[i], ry(xs[i])], [xs[i], ty(xs[i])]);
  for (let i = 1; i < xs.length - 2; i++) d.m([xs[i], ty(xs[i])], [xs[i + 1], ty(xs[i + 1])]);
  const mid = (x0 + x1) / 2;
  for (let i = 0; i < xs.length - 1; i++) {
    const a = xs[i], b = xs[i + 1];
    if (i === 0) d.m([a, ry(a)], [b, ty(b)]);
    else if (i === xs.length - 2) d.m([b, ry(b)], [a, ty(a)]);
    else if (pattern === 'x') { d.m([a, ty(a)], [b, ry(b)], true); d.m([b, ty(b)], [a, ry(a)], true); }
    else if (((a + b) / 2 < mid) === (pattern === 'pratt')) d.m([a, ty(a)], [b, ry(b)]); else d.m([b, ty(b)], [a, ry(a)]);
  }
  return xs.map(x => [x, ty(x)]).slice(1, -1).concat(xs.map(x => [x, ry(x)]));
}
function connectAnchors(d, lv, pts, k, cable) {
  lv.anchors.forEach(a => {
    if (BB.onRoad(lv, a.x, a.y)) return;
    pts.map(p => [p, Math.hypot(p[0] - a.x, p[1] - a.y)]).filter(q => q[1] <= lv.maxLen && q[1] > 0.1).sort((u, v) => u[1] - v[1]).slice(0, k)
      .forEach(q => d.m([a.x, a.y], q[0], cable && a.y > 0));
  });
}
function tower(d, lv, cols, bay) {
  const H = lv.H, levels = []; for (let y = 0; y <= H + 1e-9; y += bay) levels.push(+y.toFixed(6));
  if (levels[levels.length - 1] < H - 1e-6) levels.push(H);
  for (let k = 1; k < levels.length; k++) {
    const y = levels[k], y0 = levels[k - 1];
    for (let c = 0; c < cols.length - 1; c++) d.m([cols[c], y], [cols[c + 1], y]);
    for (let c = 0; c < cols.length; c++) d.m([cols[c], y0], [cols[c], y]);
    for (let c = 0; c < cols.length - 1; c++) { d.m([cols[c], y0], [cols[c + 1], y], true); d.m([cols[c + 1], y0], [cols[c], y], true); }
  }
}
function candidates(lv) {
  const out = [], g = lv.grid;
  if (lv.kind === 'bridge') {
    for (const step of [g, 2 * g, 3 * g]) for (const hh of [-3, -2, -1, 1, 2, 3]) for (const pat of ['pratt', 'howe', 'x']) for (const k of [0, 3, 5]) {
      const h = hh * g;
      const d = new D(lv);
      const pts = truss(d, lv, step, h, pat);
      if (pts.some(p => p[1] < lv.by0 - 1e-6 || p[1] > lv.by1 + 1e-6)) continue;
      if (k) connectAnchors(d, lv, pts, k, true); else if (lv.anchors.length > 2 && lv.anchors.some(a => !BB.onRoad(lv, a.x, a.y) && a.y < 0)) continue;
      out.push({ tag: `truss step${step} h${h} ${pat} anc${k}`, d: d.get() });
    }
  } else {
    const xs = [...new Set(lv.anchors.map(a => a.x))].sort((a, b) => a - b);
    const sets = [xs]; if (xs.length > 2) sets.push([xs[0], xs[xs.length - 1]]);
    for (const cols of sets) for (const bm of [1, 2, 3, 4, 5, 6]) {
      const bay = bm * g; if (bay > lv.H) continue;
      const d = new D(lv); tower(d, lv, cols, bay);
      out.push({ tag: `tower cols${cols.join('/')} bay${bay}`, d: d.get() });
    }
  }
  return out;
}
function run(lv, design, mats, unbreakable, seed) {
  const s = new BB.Sim(lv, design, mats, { unbreakable, seed });
  let guard = 0; while (!s.done && guard++ < 60 * 100) s.step();
  return s;
}
function optimize(lv, design, mats, sf = 1.3, iters = 6) {
  const order = mats.map((m, i) => i).sort((a, b) => mats[a].cost - mats[b].cost);
  for (let it = 0; it < iters; it++) {
    const s = run(lv, design, mats, true);
    let changed = false;
    s.members.forEach((m, k) => {
      const buck = Math.min(1, (BB.CFG.lRef / m.L0) ** 2), brace = design.brace && design.brace[k];
      let pick = -1;
      for (const i of order) {
        const mt = mats[i];
        if (brace && mt.druck > 0 && mats.some(q => q.druck === 0)) continue;
        const cT = mt.zug * BB.CFG.strength, cC = mt.druck * BB.CFG.strength * buck;
        if (cT >= m.peakT * sf && (cC >= m.peakC * sf || (mt.druck === 0 && (brace || m.peakC < 50)))) { pick = i; break; }
      }
      if (pick < 0) pick = mats.reduce((b, mt, i) => (Math.min(mt.zug, mt.druck * buck) > Math.min(mats[b].zug, mats[b].druck * buck) ? i : b), 0);
      if (design.members[k][2] !== pick) { design.members[k][2] = pick; changed = true; }
    });
    if (!changed && it > 0) break;
  }
  return design;
}
function onSnap(lv, d) { return d.nodes.every(p => lv.snaps.some(s => Math.abs(s.x - p[0]) < 1e-6 && Math.abs(s.y - p[1]) < 1e-6)); }
module.exports = { D, candidates, run, optimize, onSnap };
