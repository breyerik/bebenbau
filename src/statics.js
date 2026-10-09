/* Bebenbau – exakter statischer Fachwerklöser (Weggrößenverfahren / direct stiffness method).
   Fachwerkstäbe (gelenkig) und Biegebalken (EA, EI), linear-elastisch, kleine Verformungen.
   Lager: Festlager (x+y), Rollenlager (nur x oder nur y), Einspannung (x+y+Verdrehung r).
   Eingabe in SI (m, N). Ausgabe: Stabkräfte N (Zug +, Druck −), Auflagerkräfte und -momente, Knotenverschiebungen. Bewegliche Systeme -> { ok:false, mechanism:true, message:'System ist beweglich' }.
     solve({ nodes:[[x,y],...], members:[{a,b,EA}], supports:[{node, x:true, y:true}], loads:[{node, fx, fy}] }) */
(function () {
'use strict';
const BB = globalThis.BB = globalThis.BB || {};

const MECH_MSG = 'System ist beweglich';
function solve(model) {
  // 3 Freiheitsgrade je Knoten: u, v, Verdrehung φ. Fachwerkstäbe (type 'bar') nutzen nur u, v;
  // Biegebalken (type 'beam', EI > 0) koppeln auch φ (2D-Rahmenelement nach Euler-Bernoulli).
  const nN = model.nodes.length, nd = 3 * nN;
  const K = Array.from({ length: nd }, () => new Float64Array(nd));
  const F = new Float64Array(nd);
  const hasRot = new Uint8Array(nN);
  const geo = model.members.map(m => {
    const [xa, ya] = model.nodes[m.a], [xb, yb] = model.nodes[m.b];
    const L = Math.hypot(xb - xa, yb - ya), c = (xb - xa) / L, s = (yb - ya) / L;
    const EA = m.EA || 1e8, beam = m.type === 'beam' && m.EI > 0, EI = beam ? m.EI : 0;
    if (beam) { hasRot[m.a] = 1; hasRot[m.b] = 1; }
    // lokale Steifigkeitsmatrix [u1 v1 φ1 u2 v2 φ2]
    const a = EA / L, b12 = 12 * EI / L ** 3, b6 = 6 * EI / L ** 2, b4 = 4 * EI / L, b2 = 2 * EI / L;
    const kl = [
      [a, 0, 0, -a, 0, 0], [0, b12, b6, 0, -b12, b6], [0, b6, b4, 0, -b6, b2],
      [-a, 0, 0, a, 0, 0], [0, -b12, -b6, 0, b12, -b6], [0, b6, b2, 0, -b6, b4]];
    const T = [[c, s, 0, 0, 0, 0], [-s, c, 0, 0, 0, 0], [0, 0, 1, 0, 0, 0], [0, 0, 0, c, s, 0], [0, 0, 0, -s, c, 0], [0, 0, 0, 0, 0, 1]];
    const dofs = [3 * m.a, 3 * m.a + 1, 3 * m.a + 2, 3 * m.b, 3 * m.b + 1, 3 * m.b + 2];
    // K_global = T^T k T
    const kT = kl.map(r => T[0].map((_, j) => r.reduce((acc, v, q) => acc + v * T[q][j], 0)));
    for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) {
      let v = 0; for (let q = 0; q < 6; q++) v += T[q][i] * kT[q][j];
      K[dofs[i]][dofs[j]] += v;
    }
    return { L, c, s, kl, T, dofs, beam };
  });
  for (const l of model.loads || []) { F[3 * l.node] += l.fx || 0; F[3 * l.node + 1] += l.fy || 0; F[3 * l.node + 2] += l.m || 0; }
  const fixed = new Uint8Array(nd);
  for (const s of model.supports || []) { if (s.x) fixed[3 * s.node] = 1; if (s.y) fixed[3 * s.node + 1] = 1; if (s.r) fixed[3 * s.node + 2] = 1; }
  const used = new Uint8Array(nN); model.members.forEach(m => { used[m.a] = 1; used[m.b] = 1; });
  for (let i = 0; i < nN; i++) {
    if (!used[i]) { fixed[3 * i] = 1; fixed[3 * i + 1] = 1; }
    if (!hasRot[i]) fixed[3 * i + 2] = 1;   // reiner Gelenkknoten: Verdrehung spielt keine Rolle
  }
  const free = []; for (let i = 0; i < nd; i++) if (!fixed[i]) free.push(i);
  const n = free.length;
  const A = free.map(i => { const r = new Float64Array(n + 1); free.forEach((j, q) => { r[q] = K[i][j]; }); r[n] = F[i]; return r; });
  const diag = free.map((i, q) => A[q][q]);
  const mech = () => ({ ok: false, mechanism: true, message: MECH_MSG, hint: 'Dein Bauwerk klappt zusammen, weil eine Diagonale (ein Dreieck) oder ein Lager fehlt.' });
  // Gauß-Elimination mit Spaltenpivotsuche; ein Pivot, der gegenüber der ursprünglichen Diagonale verschwindet, heißt: singulär = beweglich
  for (let col = 0; col < n; col++) {
    let p = col; for (let r = col + 1; r < n; r++) if (Math.abs(A[r][col]) > Math.abs(A[p][col])) p = r;
    if (!(diag[col] > 0) || Math.abs(A[p][col]) < 1e-9 * diag[col]) return mech();
    if (p !== col) { const t = A[p]; A[p] = A[col]; A[col] = t; }
    for (let r = col + 1; r < n; r++) {
      const f = A[r][col] / A[col][col]; if (!f) continue;
      for (let c = col; c <= n; c++) A[r][c] -= f * A[col][c];
    }
  }
  const u = new Float64Array(nd), x = new Float64Array(n);
  for (let r = n - 1; r >= 0; r--) { let s = A[r][n]; for (let c = r + 1; c < n; c++) s -= A[r][c] * x[c]; x[r] = s / A[r][r]; }
  if (!x.every(isFinite)) return mech();
  free.forEach((i, q) => { u[i] = x[q]; });
  // Schnittgrößen je Stab (lokal): N (Zug +), Querkraft, Momente an beiden Enden
  const ends = geo.map(g => {
    const ug = g.dofs.map(d => u[d]);
    const ul = g.T.map(r => r.reduce((acc, v, q) => acc + v * ug[q], 0));
    const fl = g.kl.map(r => r.reduce((acc, v, q) => acc + v * ul[q], 0));
    return { N: fl[3], V1: fl[1], M1: fl[2], V2: fl[4], M2: fl[5] };
  });
  const forces = ends.map(e => e.N);
  const reactions = (model.supports || []).map(s => {
    const R = [0, 0, 0];
    for (let d = 0; d < 3; d++) {
      const i = 3 * s.node + d; if (!fixed[i] || (d === 2 && !s.r)) continue;
      if ((d === 0 && !s.x) || (d === 1 && !s.y)) continue;
      let v = -F[i]; for (let j = 0; j < nd; j++) v += K[i][j] * u[j];
      R[d] = v;
    }
    return { node: s.node, rx: R[0], ry: R[1], m: R[2] };
  });
  return { ok: true, forces, ends, reactions, u };
}

/* Statische Ersatzrechnung für einen Spielentwurf:
   Eigengewicht + Nutzlast, Fahrzeug in Feldmitte (Brücke), Ersatzlast Erdbeben F = pga·m·g und Böenwind als statische Last. */
function analyzeDesign(lv, design, mats, opts) {
  opts = opts || {};
  const { G, CFG } = BB;
  const nodes = design.nodes, nA = lv.anchors.length;
  const mass = nodes.map(() => CFG.jointMass);
  const members = [];
  design.members.forEach(([a, b, mi], k) => {
    const mat = mats[mi]; if (!mat || a === b) return;
    const L = Math.hypot(nodes[a][0] - nodes[b][0], nodes[a][1] - nodes[b][1]); if (L < 1e-6) return;
    mass[a] += mat.kgpm * L / 2; mass[b] += mat.kgpm * L / 2;
    members.push({ a, b, EA: CFG.stiff * Math.max(mat.zug, mat.druck, 1000), id: k + 1, mat, L });
  });
  const loads = [], cases = [];
  if (lv.kind === 'tower' && lv.payload > 0) {
    const top = BB.payloadNodeIdx(lv, design);
    top.forEach(i => { mass[i] += lv.payload / top.length; });
    cases.push(`Nutzlast ${BB.fmt(lv.payload / 1000)} t oben`);
  }
  if (lv.truck && lv.roadA) {
    const mid = (lv.roadA.x + lv.roadB.x) / 2, sp = lv.truck.spec, mAx = lv.truck.t * 1000 / sp.axles.length;
    const s0 = mid - sp.length / 2;
    const road = members.filter(m => BB.onRoad(lv, ...nodes[m.a]) && BB.onRoad(lv, ...nodes[m.b]));
    for (const off of sp.axles) {
      const x = s0 + off;
      const m = road.find(r => x >= Math.min(nodes[r.a][0], nodes[r.b][0]) - 1e-9 && x <= Math.max(nodes[r.a][0], nodes[r.b][0]) + 1e-9);
      if (!m) continue;
      const xa = nodes[m.a][0], xb = nodes[m.b][0], w = (x - xa) / ((xb - xa) || 1);
      mass[m.a] += mAx * (1 - w); mass[m.b] += mAx * w;
    }
    cases.push(`${sp.name} (${BB.fmt(lv.truck.t)} t) in Feldmitte`);
  }
  const ax = lv.quake ? lv.quake.pga * G / CFG.quakeQ : 0;
  if (lv.quake) cases.push(`Erdbeben-Ersatzlast ${BB.fmt(lv.quake.pga)} g`);
  nodes.forEach((p, i) => { if (i >= nA) loads.push({ node: i, fx: mass[i] * ax, fy: -mass[i] * G }); });
  if (lv.wind) {
    const q = 0.5 * 1.25 * lv.wind.gust * lv.wind.gust;
    const depth = lv.kind === 'tower' ? CFG.windDepthTower : CFG.windDepthBridge;
    for (const m of members) {
      const fx = q * Math.abs(nodes[m.a][1] - nodes[m.b][1]) * depth * 0.5;
      loads.push({ node: m.a, fx }); loads.push({ node: m.b, fx });
    }
    cases.push(`Böe ${Math.round(lv.wind.gust * 3.6)} km/h`);
  }
  const supports = lv.anchors.map((a, i) => ({ node: i, x: true, y: true }));
  // freie Knoten, die auf dem Boden stehen, wirken wie Rollenlager
  nodes.forEach((p, i) => { if (i >= nA && p[1] <= BB.groundAt(lv, p[0]) + 1e-6) supports.push({ node: i, y: true }); });
  const res = solve({ nodes, members, supports, loads });
  res.members = members; res.cases = cases;
  if (res.ok) { res.byId = {}; members.forEach((m, k) => { res.byId[m.id] = res.forces[k]; }); }
  return res;
}
BB.Statics = { solve, analyzeDesign, MECH_MSG };
if (typeof module !== 'undefined' && module.exports) module.exports = BB;
})();
