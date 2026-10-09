/* Bebenbau – Physik: 2D-Fachwerk mit XPBD (kleine Teilschritte), Stabkräfte, Auflagerkräfte, Versagen */
(function () {
'use strict';
const BB = globalThis.BB = globalThis.BB || {};
const { G, CFG, payloadNodeIdx, onRoad, roadY, groundAt } = BB;
// deterministisches Rauschen
function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

class Sim {
  constructor(lv, design, mats, opts) {
    opts = opts || {};
    this.lv = lv; this.mats = mats; this.unbreakable = !!opts.unbreakable;
    this.t = 0; this.done = false; this.result = null; this.events = [];
    this.nA = lv.anchors.length;
    const rand = rng(opts.seed || 7);
    this.nodes = design.nodes.map((p, i) => ({ x: p[0], y: p[1], px: p[0], py: p[1], bx: p[0], by: p[1], vx: 0, vy: 0, fixed: i < this.nA, m0: CFG.jointMass, extra: 0, fx: 0, fy: 0, deg: 0 }));
    this.members = [];
    design.members.forEach(([a, b, mi], k) => {
      const A = this.nodes[a], B = this.nodes[b], mat = mats[mi];
      if (!A || !B || !mat || a === b) return;
      const L0 = Math.hypot(A.x - B.x, A.y - B.y); if (L0 < 1e-6) return;
      const mass = mat.kgpm * L0;
      A.m0 += mass / 2; B.m0 += mass / 2; A.deg++; B.deg++;
      const EA = CFG.stiff * Math.max(mat.zug, mat.druck, 1000);
      this.members.push({
        id: k + 1, a, b, mi, mat, L0, peakRatio: 0, peakMode: '', mass, alpha: L0 / EA, broken: false, f: 0, acc: 0, ratio: 0, peakT: 0, peakC: 0,
        capT: mat.zug * CFG.strength, capC: mat.druck * CFG.strength * Math.min(1, (CFG.lRef / L0) ** 2),
        road: onRoad(lv, A.x, A.y) && onRoad(lv, B.x, B.y),
      });
    });
    this.failures = [];   // Reihenfolge des Versagens (für die Erklärung)
    this.reactions = this.nodes.slice(0, this.nA).map((n, i) => ({ i, x: n.x, y: n.y, rx: 0, ry: 0, peak: 0 }));
    this.roadMembers = this.members.filter(m => m.road);
    // Nutzlast (Turm)
    this.payloadNodes = [];
    if (lv.kind === 'tower') {
      this.payloadNodes = payloadNodeIdx(lv, design).filter(i => this.nodes[i].deg > 0 || this.nodes[i].fixed);
      const per = this.payloadNodes.length ? lv.payload / this.payloadNodes.length : 0;
      this.payloadNodes.forEach(i => { this.nodes[i].payload = per; });
    }
    // Fahrzeuge
    this.vehicles = [];
    if (lv.truck) {
      const sp = lv.truck.spec, m = lv.truck.t * 1000;
      this.vehicles.push({ kind: sp.kind, name: sp.name, mass: m, axles: sp.axles, length: sp.length, v0: lv.truck.kmh / 3.6, v: lv.truck.kmh / 3.6,
        s: lv.roadA.x - sp.length - 1.5, start: lv.quake ? 2.5 : 1.0, brake: lv.truck.brake ? 'pending' : null, holdT: 0, acc: 0,
        state: 'wait', ys: sp.axles.map(() => lv.roadA.y), fallT: 0, rot: 0, vy: 0, y: lv.roadA.y, endX: lv.roadB.x + 1.5 });
    }
    if (lv.walkers) {
      const w = lv.walkers;
      for (let k = 0; k < w.n; k++) this.vehicles.push({ kind: 'worker', name: 'Bauarbeiter', mass: w.kg, axles: [0], length: 0.5, v0: w.speed, v: w.speed,
        s: lv.roadA.x - 1 - k * 1.4, start: 1.0, brake: null, holdT: 0, acc: 0, state: 'wait', ys: [lv.roadA.y], fallT: 0, rot: 0, vy: 0, y: lv.roadA.y, endX: lv.roadB.x + 1 });
    }
    // Böen vorberechnen
    this.gusts = [];
    if (lv.wind) { let tt = CFG.loadStart + 1.5 + rand() * 1.5; while (tt < CFG.loadStart + lv.wind.dur) { this.gusts.push({ t: tt, d: 1.2 + rand() * 1.3 }); tt += 2.2 + rand() * 2.8; } }
    this.phase = rand() * 6.28;
    this.endTime = CFG.loadStart + Math.max(lv.quake ? lv.quake.dur : 0, lv.wind ? lv.wind.dur : 0) + 0.8;
    this.windNow = 0; this.quakeAcc = 0; this.quakeEnv = 0; this.brokenCount = 0;
  }
  quakeA(t) {
    const q = this.lv.quake; if (!q) return 0;
    const tt = t - CFG.loadStart; if (tt < 0 || tt > q.dur) return 0;
    const env = Math.min(1, tt / 1.0, (q.dur - tt) / 1.5);
    const w = 2 * Math.PI * q.f;
    const noise = 0.5 * Math.sin(2 * Math.PI * 3.7 * tt + 1 + this.phase) + 0.3 * Math.sin(2 * Math.PI * 5.3 * tt + 2) + 0.2 * Math.sin(2 * Math.PI * 0.6 * tt);
    this.quakeEnv = env;
    return q.pga * G / CFG.quakeQ * env * (Math.sin(w * tt) + 0.15 * noise);
  }
  windV(t) {
    const wd = this.lv.wind; if (!wd) return 0;
    const tt = t - CFG.loadStart; if (tt < 0 || tt > wd.dur) return 0;
    const env = Math.min(1, tt / 2, (wd.dur - tt) / 1.5);
    let gst = 0;
    for (const g of this.gusts) { const x = (t - g.t) / g.d; if (x > 0 && x < 1) gst = Math.max(gst, Math.sin(Math.PI * x) ** 2); }
    const turb = 0.04 * Math.sin(7.1 * tt + this.phase) + 0.03 * Math.sin(12.7 * tt);
    return env * (wd.v + (wd.gust - wd.v) * gst) * (1 + turb);
  }
  supportAt(x) {
    const lv = this.lv;
    if (x < lv.roadA.x || x > lv.roadB.x) return { ground: true, y: groundAt(lv, x) };
    for (const m of this.roadMembers) {
      if (m.broken) continue;
      const A = this.nodes[m.a], B = this.nodes[m.b];
      let xa = A.x, xb = B.x, ya = A.y, yb = B.y, ia = m.a, ib = m.b;
      if (xa > xb) { [xa, xb] = [xb, xa]; [ya, yb] = [yb, ya]; [ia, ib] = [ib, ia]; }
      if (x >= xa - 1e-9 && x <= xb + 1e-9) {
        const w = (x - xa) / ((xb - xa) || 1);
        return { ground: false, y: ya + (yb - ya) * w, ia, ib, w, m };
      }
    }
    return null;
  }
  step() {
    const lv = this.lv, N = CFG.substeps, h = CFG.dt / N, nodes = this.nodes;
    this.events.length = 0;
    for (const m of this.members) m.acc = 0;
    for (let s = 0; s < N; s++) {
      const t = this.t;
      for (const n of nodes) { n.extra = n.payload || 0; n.fx = 0; n.fy = 0; }
      // Fahrzeuge
      for (const v of this.vehicles) this.updVehicle(v, h, t);
      const gr = Math.min(1, t / CFG.gravRamp);
      const qa = this.quakeA(t); this.quakeAcc = qa;
      // Wind
      const W = this.windV(t); this.windNow = W;
      if (W > 0) {
        const q = 0.5 * 1.25 * W * W;
        const tower = lv.kind === 'tower';
        const depth = tower ? CFG.windDepthTower : CFG.windDepthBridge;
        const lift = tower ? 0 : (0.25 + 0.55 * Math.sin(2 * Math.PI * 0.45 * t + this.phase));
        for (const m of this.members) {
          if (m.broken) continue;
          const A = nodes[m.a], B = nodes[m.b];
          const fx = q * Math.abs(A.y - B.y) * depth * 0.5;
          const fy = q * Math.abs(A.x - B.x) * depth * 0.5 * lift;
          A.fx += fx; B.fx += fx; A.fy += fy; B.fy += fy;
        }
      }
      // Integration
      const damp = 1 - CFG.damping * h;
      for (const n of nodes) {
        if (n.fixed) continue;
        const m = n.m0 + n.extra;
        n.vx = (n.vx + h * (n.fx / m + qa)) * damp;
        n.vy = (n.vy + h * (n.fy / m - G * gr + 0.15 * qa * Math.sin(this.t * 9.3))) * damp;
        n.px = n.x; n.py = n.y;
        n.x += h * n.vx; n.y += h * n.vy;
      }
      // Stäbe
      const ih2 = 1 / (h * h);
      for (const m of this.members) {
        if (m.broken) continue;
        const A = nodes[m.a], B = nodes[m.b];
        let dx = B.x - A.x, dy = B.y - A.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1e-9;
        const C = d - m.L0;
        if (C < 0 && m.mat.cable) continue;
        const wa = A.fixed ? 0 : 1 / (A.m0 + A.extra), wb = B.fixed ? 0 : 1 / (B.m0 + B.extra);
        const at = m.alpha * ih2;
        const dl = -C / (wa + wb + at);
        dx /= d; dy /= d;
        A.x -= wa * dx * dl; A.y -= wa * dy * dl;
        B.x += wb * dx * dl; B.y += wb * dy * dl;
        m.acc += -dl * ih2;
      }
      // Boden
      for (const n of nodes) {
        if (n.fixed) continue;
        const gy = groundAt(lv, n.x);
        if (n.y < gy) { n.y = gy; n.x = n.px + (n.x - n.px) * 0.3; }
        n.vx = (n.x - n.px) / h; n.vy = (n.y - n.py) / h;
      }
      this.t += h;
    }
    // Kräfte auswerten
    for (const m of this.members) {
      if (m.broken) continue;
      const f = m.acc / N; m.f = f;
      if (f > m.peakT) m.peakT = f; if (-f > m.peakC) m.peakC = -f;
      m.ratio = f >= 0 ? (m.capT > 0 ? f / m.capT : 9) : (m.capC > 0 ? -f / m.capC : (m.mat.cable ? 0 : 9));
      if (m.ratio > m.peakRatio) { m.peakRatio = m.ratio; m.peakMode = f >= 0 ? 'zug' : 'druck'; m.peakF = f; }
      if (m.ratio > 1 && !this.unbreakable) this.breakMember(m, f >= 0 ? 'zug' : 'druck');
    }
    this.calcReactions();
    this.checkEnd();
    return this.events;
  }
  // Auflagerkräfte: Summe der Stabkräfte, die auf jeden Ankerpunkt wirken (mit umgekehrtem Vorzeichen)
  calcReactions() {
    for (const r of this.reactions) { r.rx = 0; r.ry = 0; }
    for (const m of this.members) {
      if (m.broken) continue;
      const A = this.nodes[m.a], B = this.nodes[m.b];
      if (!A.fixed && !B.fixed) continue;
      const dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy) || 1;
      // Zugkraft f zieht A Richtung B und B Richtung A
      if (A.fixed) { const r = this.reactions[m.a]; r.rx -= m.f * dx / d; r.ry -= m.f * dy / d; }
      if (B.fixed) { const r = this.reactions[m.b]; r.rx += m.f * dx / d; r.ry += m.f * dy / d; }
    }
    for (const r of this.reactions) { const v = Math.hypot(r.rx, r.ry); if (v > r.peak) r.peak = v; }
  }
  breakMember(m, mode) {
    m.broken = true; this.brokenCount++;
    const cap = mode === 'zug' ? m.capT : m.capC;
    this.failures.push({ id: m.id, mode, f: m.f, cap, capFull: mode === 'zug' ? m.capT : m.mat.druck * CFG.strength, buckled: mode === 'druck' && m.capC < m.mat.druck * CFG.strength - 1, L0: m.L0, mat: m.mat, t: this.t });
    const A = this.nodes[m.a], B = this.nodes[m.b];
    for (const n of [A, B]) { n.m0 = Math.max(CFG.jointMass, n.m0 - m.mass / 2); n.deg--; }
    this.events.push({ type: 'break', mode, ax: A.x, ay: A.y, bx: B.x, by: B.y, mat: m.mat, vx: (A.vx + B.vx) / 2, vy: (A.vy + B.vy) / 2 });
  }
  updVehicle(v, h, t) {
    const lv = this.lv;
    if (v.state === 'wait') { if (t >= v.start) v.state = 'drive'; else { v.ys = v.axles.map(() => groundAt(lv, v.s)); return; } }
    if (v.state === 'fall') {
      v.vy -= G * h; v.y += v.vy * h; v.s += v.v * h * 0.6; v.rot += h * (v.kind === 'worker' ? 4 : 0.9);
      v.fallT += h; if (v.y < lv.gapBottom + 0.5) { v.y = lv.gapBottom + 0.5; v.vy = 0; v.v = 0; }
      return;
    }
    if (v.state === 'done') return;
    // Bremsen
    let a = 0;
    if (v.brake) {
      const mid = (lv.roadA.x + lv.roadB.x) / 2, center = v.s + v.length / 2;
      if (v.brake === 'pending' && center >= mid - v.v * v.v / (2 * 0.5 * G)) v.brake = 'braking';
      if (v.brake === 'braking') { a = -0.5 * G; if (v.v + a * h <= 0) { v.v = 0; a = 0; v.brake = 'hold'; v.holdT = 0; } }
      else if (v.brake === 'hold') { v.holdT += h; if (v.holdT > 1.5) v.brake = 'go'; }
      else if (v.brake === 'go') { a = 0.25 * G; if (v.v + a * h >= v.v0) { a = 0; v.v = v.v0; v.brake = 'done'; } }
    }
    v.v += a * h; v.acc = a; v.s += v.v * h;
    if (v.s > v.endX) { v.state = 'done'; return; }
    const mAx = v.mass / v.axles.length;
    const ys = [];
    for (let k = 0; k < v.axles.length; k++) {
      const x = v.s + v.axles[k];
      const sp = this.supportAt(x);
      if (!sp) { this.fall(v, 'Die Fahrbahn ist gebrochen'); return; }
      if (!sp.ground && sp.y < roadY(lv, x) - lv.sagLimit) { this.fall(v, 'Die Fahrbahn hängt zu weit durch'); return; }
      ys.push(sp.y);
      if (!sp.ground) {
        const A = this.nodes[sp.ia], B = this.nodes[sp.ib];
        const fx = -mAx * a; // Bremskraft wirkt nach vorn auf die Fahrbahn
        const wA = 1 - sp.w, wB = sp.w;
        if (!A.fixed) { A.extra += mAx * wA; A.fx += fx * wA; }
        if (!B.fixed) { B.extra += mAx * wB; B.fx += fx * wB; }
        // Erdbeben wirkt über die Masse automatisch mit
      }
    }
    v.ys = ys; v.y = ys.reduce((p, c) => p + c, 0) / ys.length;
  }
  fall(v, why) { v.state = 'fall'; v.vy = 0; v.y = v.ys.length ? v.ys.reduce((p, c) => p + c, 0) / v.ys.length : v.y; if (!this.failReason) this.failReason = (v.kind === 'worker' ? 'Die Bauarbeiter sind abgestürzt! ' : 'Der ' + v.name + ' ist abgestürzt! ') + why + '.'; }
  checkEnd() {
    if (this.done) return;
    const lv = this.lv;
    const fallen = this.vehicles.find(v => v.state === 'fall');
    if (fallen && fallen.fallT > 1.4) return this.finish(false, this.failReason);
    if (lv.kind === 'tower') {
      const tol = Math.max(1, lv.H * 0.1);
      for (const i of this.payloadNodes) {
        const n = this.nodes[i];
        if (n.y < lv.H - tol * 2.5 || (n.deg <= 0 && !n.fixed)) return this.finish(false, this.lv.payload > 0 ? 'Der Turm ist eingestürzt, die Nutzlast ist abgestürzt!' : 'Der Turm ist eingestürzt!');
      }
      if (!this.payloadNodes.length) return this.finish(false, 'Der Turm erreicht die Zielhöhe nicht.');
      if (this.t >= this.endTime) {
        const low = this.payloadNodes.some(i => this.nodes[i].y < lv.H - tol);
        return this.finish(!low, low ? 'Der Turm hat sich zu stark verformt.' : '');
      }
    } else {
      const allDone = this.vehicles.every(v => v.state === 'done');
      if (allDone && this.t >= this.endTime) return this.finish(true, '');
    }
    if (this.t > CFG.maxTime) this.finish(false, 'Zeit abgelaufen.');
  }
  finish(win, reason) { this.done = true; this.result = { win, reason: reason || '' }; }
}


Object.assign(BB, { Sim, rng });
if (typeof module !== 'undefined' && module.exports) module.exports = BB;
})();
