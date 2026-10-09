/* Bebenbau – Zeichnen (Canvas 2D): Himmel, Gelände, Bauwerk, Fahrzeuge, Bauarbeiter, Trümmer, Kraftanzeige */
(function () {
'use strict';
const BB = globalThis.BB = globalThis.BB || {};
const TAU = Math.PI * 2;

function lerp(a, b, t) { return a + (b - a) * t; }
function stressColor(r) {
  r = Math.max(0, Math.min(1.2, r));
  let c;
  if (r < 0.6) { const t = r / 0.6; c = [lerp(60, 245, t), lerp(185, 205, t), lerp(80, 40, t)]; }
  else { const t = Math.min(1, (r - 0.6) / 0.4); c = [lerp(245, 225, t), lerp(205, 40, t), lerp(40, 30, t)]; }
  return `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
}

class Camera {
  constructor() { this.s = 30; this.ox = 0; this.oy = 0; this.shx = 0; this.shy = 0; }
  X(x) { return this.ox + x * this.s + this.shx; }
  Y(y) { return this.oy - y * this.s + this.shy; }
  toWorld(px, py) { return { x: (px - this.ox) / this.s, y: (this.oy - py) / this.s }; }
  fit(b, rect) {
    const bw = b.x1 - b.x0, bh = b.y1 - b.y0;
    this.s = Math.min(rect.w / bw, rect.h / bh);
    this.ox = rect.x + rect.w / 2 - (b.x0 + bw / 2) * this.s;
    this.oy = rect.y + rect.h / 2 + (b.y0 + bh / 2) * this.s;
    this.fitS = this.s;
  }
}
function levelBounds(lv) {
  if (lv.kind === 'tower') return { x0: lv.bx0 - 3, x1: lv.bx1 + 3, y0: -1.5, y1: lv.by1 + Math.max(2.5, lv.H * 0.08) };
  return { x0: lv.bx0 - 2.5, x1: lv.bx1 + 2.5, y0: lv.gapBottom - 0.5, y1: lv.by1 + 1.2 };
}

// ---------- Hintergrund ----------
function sky(ctx, W, H, t, storm) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  if (storm > 0.05) { g.addColorStop(0, `rgb(${lerp(120, 70, storm)|0},${lerp(180, 90, storm)|0},${lerp(230, 110, storm)|0})`); g.addColorStop(1, `rgb(${lerp(215, 140, storm)|0},${lerp(235, 150, storm)|0},${lerp(245, 160, storm)|0})`); }
  else { g.addColorStop(0, '#6fb6ec'); g.addColorStop(0.7, '#cfe9f7'); g.addColorStop(1, '#eaf5fb'); }
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  if (storm < 0.5) { ctx.fillStyle = 'rgba(255,236,140,0.9)'; ctx.beginPath(); ctx.arc(W * 0.12, H * 0.12, 26, 0, TAU); ctx.fill(); }
  ctx.fillStyle = storm > 0.05 ? 'rgba(90,100,115,0.55)' : 'rgba(255,255,255,0.85)';
  for (let i = 0; i < 5; i++) {
    const x = ((i * 157 + t * (8 + i * 3) * (1 + storm * 6)) % (W + 200)) - 100, y = 50 + (i * 71) % (H * 0.3);
    cloud(ctx, x, y, 0.7 + (i % 3) * 0.25);
  }
}
function cloud(ctx, x, y, s) {
  ctx.beginPath(); ctx.arc(x, y, 18 * s, 0, TAU); ctx.arc(x + 20 * s, y - 8 * s, 22 * s, 0, TAU); ctx.arc(x + 44 * s, y, 17 * s, 0, TAU); ctx.rect(x, y, 44 * s, 14 * s); ctx.fill();
}
function skyline(ctx, W, gy) {
  ctx.fillStyle = 'rgba(80,110,140,0.25)';
  const hs = [40, 70, 55, 95, 50, 80, 60, 120, 45, 65, 85, 50];
  let x = -10;
  for (let i = 0; x < W; i++) { const w = 28 + (i * 13) % 22, h = hs[i % hs.length]; ctx.fillRect(x, gy - h, w, h); x += w + 4; }
  // Michel-Turm
  ctx.beginPath(); const mx = W * 0.62; ctx.moveTo(mx - 9, gy); ctx.lineTo(mx - 9, gy - 110); ctx.lineTo(mx, gy - 150); ctx.lineTo(mx + 9, gy - 110); ctx.lineTo(mx + 9, gy); ctx.fill();
}
function crane(ctx, x, gy, h, t, s) {
  s = s || 1;
  ctx.save(); ctx.strokeStyle = '#e8a317'; ctx.lineWidth = 2 * s; ctx.globalAlpha = 0.85;
  const w = 10 * s;
  ctx.beginPath();
  for (let y = 0; y < h; y += w) { ctx.moveTo(x, gy - y); ctx.lineTo(x + w, gy - y - w); ctx.moveTo(x + w, gy - y); ctx.lineTo(x, gy - y - w); }
  ctx.moveTo(x, gy); ctx.lineTo(x, gy - h); ctx.moveTo(x + w, gy); ctx.lineTo(x + w, gy - h); ctx.stroke();
  const jl = 150 * s, ang = Math.sin(t * 0.2) * 0.04;
  ctx.translate(x + w / 2, gy - h); ctx.rotate(ang);
  ctx.beginPath(); ctx.moveTo(-50 * s, 0); ctx.lineTo(jl, 0); ctx.moveTo(-50 * s, -8 * s); ctx.lineTo(jl * 0.9, -8 * s);
  for (let k = -50 * s; k < jl * 0.9; k += 12 * s) { ctx.moveTo(k, 0); ctx.lineTo(k + 6 * s, -8 * s); ctx.lineTo(k + 12 * s, 0); }
  ctx.moveTo(0, -8 * s); ctx.lineTo(0, -26 * s); ctx.lineTo(jl * 0.7, -8 * s); ctx.moveTo(0, -26 * s); ctx.lineTo(-45 * s, -8 * s); ctx.stroke();
  ctx.fillStyle = '#666'; ctx.fillRect(-48 * s, 0, 20 * s, 10 * s);
  ctx.fillStyle = '#e8a317'; ctx.fillRect(-6 * s, 2 * s, 14 * s, 10 * s);
  const hx = jl * 0.6 + Math.sin(t * 0.5) * 20 * s, hy = 60 * s + Math.sin(t * 0.7) * 6 * s;
  ctx.strokeStyle = '#333'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(hx, 0); ctx.lineTo(hx, hy); ctx.stroke();
  ctx.fillStyle = '#b4783a'; ctx.fillRect(hx - 12 * s, hy, 24 * s, 6 * s);
  ctx.restore();
}

// ---------- Gelände ----------
function isWater(lv) { return /alster|elbe|fluss|hafen/i.test(lv.name + ' ' + lv.beschreibung); }
function terrain(ctx, cam, lv, W, H, t) {
  const X = x => cam.X(x), Y = y => cam.Y(y);
  const bottom = H + 400;
  if (lv.kind === 'tower') {
    const gy = Y(0);
    ctx.fillStyle = '#7a5a3a'; ctx.fillRect(-400, gy, W + 800, bottom);
    ctx.fillStyle = '#5c9e3c'; ctx.fillRect(-400, gy, W + 800, Math.max(3, cam.s * 0.25));
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    for (let i = 0; i < 30; i++) ctx.fillRect(((i * 97) % (W + 40)) - 20, gy + 12 + (i * 37) % 120, 6, 3);
    for (const a of lv.anchors) { ctx.fillStyle = '#9b9b95'; ctx.fillRect(X(a.x - 0.6), Y(a.y), cam.s * 1.2, cam.s * 0.6); }
    return;
  }
  const A = lv.roadA, B = lv.roadB, gb = lv.gapBottom;
  // Rückwand des Grabens
  const gwTop = Math.min(A.y, B.y);
  const gw = ctx.createLinearGradient(0, Y(gwTop), 0, Y(gb));
  gw.addColorStop(0, 'rgba(120,92,62,0.15)'); gw.addColorStop(1, 'rgba(90,68,46,0.55)');
  ctx.fillStyle = gw; ctx.fillRect(X(A.x), Y(gwTop), X(B.x) - X(A.x), Y(gb) - Y(gwTop));
  // Grabensohle
  if (isWater(lv)) {
    ctx.fillStyle = '#2e6fa3'; ctx.fillRect(X(A.x), Y(gb + 1.0), X(B.x) - X(A.x), bottom);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2; ctx.beginPath();
    for (let x = A.x; x < B.x; x += 0.5) { const yy = Y(gb + 1.0 + 0.08 * Math.sin(x * 2 + t * 2)); if (x === A.x) ctx.moveTo(X(x), yy); else ctx.lineTo(X(x), yy); }
    ctx.stroke();
    ctx.fillStyle = '#5a4a3a'; ctx.fillRect(X(A.x), Y(gb), X(B.x) - X(A.x), bottom);
    ctx.fillStyle = 'rgba(46,111,163,0.85)'; ctx.fillRect(X(A.x), Y(gb + 1.0), X(B.x) - X(A.x), Y(gb) - Y(gb + 1.0) + 1);
  } else {
    ctx.fillStyle = '#6e5236'; ctx.fillRect(X(A.x), Y(gb), X(B.x) - X(A.x), bottom);
    if (/verwerfung/i.test(lv.name)) { ctx.strokeStyle = '#2b1d10'; ctx.lineWidth = 3; ctx.beginPath(); const mx = (A.x + B.x) / 2; ctx.moveTo(X(mx - 1), Y(gb)); ctx.lineTo(X(mx), Y(gb - 1)); ctx.lineTo(X(mx - 0.4), Y(gb - 2)); ctx.lineTo(X(mx + 0.5), Y(gb - 4)); ctx.stroke(); }
  }
  // Plateaus
  const plat = (x0, x1, y, flip) => {
    ctx.fillStyle = '#8a6844'; ctx.fillRect(X(x0), Y(y), X(x1) - X(x0), bottom);
    ctx.fillStyle = '#5c9e3c'; ctx.fillRect(X(x0), Y(y) - 2, X(x1) - X(x0), Math.max(4, cam.s * 0.2));
    ctx.fillStyle = '#4a4a4f'; ctx.fillRect(X(x0), Y(y) - 2, X(x1) - X(x0), Math.max(3, cam.s * 0.12));
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    for (let i = 0; i < 12; i++) { const xx = x0 + ((i * 1.7) % (x1 - x0)); ctx.fillRect(X(xx), Y(y - 1 - (i % 4) * 0.8), 6, 3); }
  };
  plat(A.x - 60, A.x, A.y); plat(B.x, B.x + 60, B.y);
  // Pfeiler und Pylone für Zusatzanker
  for (const a of lv.anchors) {
    if (BB.onRoad(lv, a.x, a.y)) continue;
    const base = (a.x <= A.x + 1e-6 || a.x >= B.x - 1e-6) ? (a.x <= A.x + 1e-6 ? A.y : B.y) : gb;
    const w = 1.1;
    if (a.y < base) continue;
    ctx.fillStyle = a.y > (A.y + B.y) / 2 ? '#a9a9a3' : '#7d746a';
    ctx.fillRect(X(a.x - w / 2), Y(a.y), w * cam.s, Y(base) - Y(a.y) + 2);
    ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(X(a.x + w / 4), Y(a.y), w * cam.s / 4, Y(base) - Y(a.y));
  }
  // Rampe / Tiefgarage
  if (Math.abs(A.y - B.y) > 0.5) {
    ctx.fillStyle = '#3d3d42'; ctx.fillRect(X(B.x + 1), Y(B.y + 2.6), cam.s * 4, cam.s * 2.6);
    ctx.fillStyle = '#ffd34d'; ctx.font = `bold ${Math.max(9, cam.s * 0.5)}px sans-serif`; ctx.fillText('P', X(B.x + 1.3), Y(B.y + 1.9));
  }
}

// ---------- Bauwerk ----------
function memberPath(ctx, x1, y1, x2, y2) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); }
function drawMember(ctx, cam, p, q, mat, opts) {
  const x1 = cam.X(p[0]), y1 = cam.Y(p[1]), x2 = cam.X(q[0]), y2 = cam.Y(q[1]);
  const w = Math.max(mat.cable ? 2 : 4, Math.min(mat.cable ? 4 : 13, mat.width * cam.s));
  ctx.lineCap = 'round';
  if (opts.highlight) { ctx.strokeStyle = `rgba(255,40,200,${0.45 + 0.35 * Math.sin(opts.t * 8)})`; ctx.lineWidth = w + 12; memberPath(ctx, x1, y1, x2, y2); ctx.stroke(); }
  ctx.strokeStyle = opts.ghost ? 'rgba(0,0,0,0.25)' : mat.dark; ctx.lineWidth = w + 2; memberPath(ctx, x1, y1, x2, y2); ctx.stroke();
  ctx.strokeStyle = opts.stress != null ? stressColor(opts.stress) : mat.color; ctx.lineWidth = w; memberPath(ctx, x1, y1, x2, y2); ctx.stroke();
  if (opts.stress == null && !mat.cable) {
    const len = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / len, uy = (y2 - y1) / len;
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1;
    if (mat.icon === 'mauer') { for (let d = 6; d < len - 4; d += 8) { ctx.beginPath(); ctx.moveTo(x1 + ux * d - uy * w / 2, y1 + uy * d + ux * w / 2); ctx.lineTo(x1 + ux * d + uy * w / 2, y1 + uy * d - ux * w / 2); ctx.stroke(); } }
    else if (mat.icon === 'stahl') { ctx.strokeStyle = 'rgba(255,255,255,0.35)'; memberPath(ctx, x1, y1, x2, y2); ctx.stroke(); }
    else if (mat.icon === 'holz') { ctx.strokeStyle = 'rgba(80,40,10,0.35)'; ctx.beginPath(); ctx.moveTo(x1 - uy * w * 0.2, y1 + ux * w * 0.2); ctx.lineTo(x2 - uy * w * 0.2, y2 + ux * w * 0.2); ctx.stroke(); }
    else if (mat.icon === 'beton') { ctx.fillStyle = 'rgba(0,0,0,0.2)'; for (let d = 5; d < len - 3; d += 11) ctx.fillRect(x1 + ux * d - 1, y1 + uy * d - 1, 2, 2); }
  }
}
function drawJoint(ctx, cam, x, y, anchor, r) {
  const X = cam.X(x), Y = cam.Y(y);
  r = r || Math.max(4, Math.min(8, cam.s * 0.18));
  if (anchor) {
    ctx.fillStyle = '#d9480f'; ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(X - r * 1.4, Y + r * 2); ctx.lineTo(X + r * 1.4, Y + r * 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(X, Y, r * 0.9, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#d9480f'; ctx.lineWidth = 3; ctx.stroke();
  } else {
    ctx.fillStyle = '#f6f6f2'; ctx.beginPath(); ctx.arc(X, Y, r * 0.75, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#333'; ctx.lineWidth = 1.5; ctx.stroke();
  }
}
function arrow(ctx, x1, y1, x2, y2, color, w) {
  const a = Math.atan2(y2 - y1, x2 - x1), hl = 7 + w;
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2 - Math.cos(a) * hl * 0.8, y2 - Math.sin(a) * hl * 0.8); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x2 - Math.cos(a - 0.45) * hl, y2 - Math.sin(a - 0.45) * hl); ctx.lineTo(x2 - Math.cos(a + 0.45) * hl, y2 - Math.sin(a + 0.45) * hl); ctx.closePath(); ctx.fill();
}
function pill(ctx, x, y, text, bg, fg, size) {
  ctx.font = `bold ${size || 10}px -apple-system, system-ui, sans-serif`;
  const w = ctx.measureText(text).width + 6, h = (size || 10) + 4;
  ctx.fillStyle = bg; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x - w / 2, y - h / 2, w, h, 4); else ctx.rect(x - w / 2, y - h / 2, w, h); ctx.fill();
  ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y + 0.5); ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
}
// Kraftanzeige: Stabkräfte (Zug + blau, Druck − rot) und Auflagerpfeile
function forceOverlay(ctx, cam, pos, members, reactions, anchors) {
  const many = members.length > 40;
  for (const m of members) {
    if (m.broken || Math.abs(m.f) < 500) continue;
    const p = pos(m.a), q = pos(m.b);
    if (many && Math.abs(m.ratio || 0) < 0.35) continue;
    const kn = Math.round(m.f / 1000);
    pill(ctx, cam.X((p[0] + q[0]) / 2), cam.Y((p[1] + q[1]) / 2), (kn > 0 ? '+' : '−') + Math.abs(kn), m.f > 0 ? 'rgba(30,90,200,0.88)' : 'rgba(200,40,40,0.88)', '#fff', 10);
  }
  for (const r of reactions) {
    const mag = Math.hypot(r.rx, r.ry); if (mag < 500) continue;
    const a = anchors[r.node !== undefined ? r.node : r.i];
    const L = Math.min(70, 18 + Math.log10(1 + mag / 1000) * 28);
    const ux = r.rx / mag, uy = r.ry / mag;
    const X = cam.X(a.x), Y = cam.Y(a.y) + 6;
    arrow(ctx, X - ux * L, Y + uy * L, X, Y, 'rgba(20,140,60,0.95)', 3);
    pill(ctx, X - ux * (L + 12), Y + uy * (L + 12), Math.round(mag / 1000) + ' kN', 'rgba(20,140,60,0.95)', '#fff', 10);
  }
}

// ---------- Figuren & Fahrzeuge ----------
function worker(ctx, x, y, s, pose, t, seed) {
  // x,y = Fußpunkt in Pixeln, s = Größe (px pro "Figur-Meter", Figur ca. 1,8 m)
  ctx.save(); ctx.translate(x, y);
  const ph = t * 8 + seed * 2;
  let bob = 0, armL = 0.6, armR = 0.6, legA = 0;
  if (pose === 'walk') { legA = Math.sin(ph) * 0.5; bob = Math.abs(Math.sin(ph)) * 0.05; armL = 0.3 + Math.sin(ph) * 0.4; armR = 0.3 - Math.sin(ph) * 0.4; }
  if (pose === 'cheer') { bob = Math.abs(Math.sin(ph * 0.8)) * 0.35; armL = 2.6 + Math.sin(ph) * 0.2; armR = 2.6 - Math.sin(ph) * 0.2; }
  if (pose === 'panic') { bob = Math.abs(Math.sin(ph * 1.5)) * 0.1; armL = 2.9; armR = 2.9; ctx.translate(Math.sin(ph * 2) * s * 0.06, 0); }
  if (pose === 'watch') { armL = 0.2; armR = 2.0 + Math.sin(ph * 0.3) * 0.1; }
  const u = s;
  ctx.translate(0, -bob * u);
  ctx.lineCap = 'round'; ctx.strokeStyle = '#2b3a55'; ctx.lineWidth = Math.max(2, u * 0.16);
  ctx.beginPath(); ctx.moveTo(0, -0.8 * u); ctx.lineTo(Math.sin(legA) * 0.45 * u, 0); ctx.moveTo(0, -0.8 * u); ctx.lineTo(-Math.sin(legA) * 0.45 * u, 0); ctx.stroke();
  ctx.fillStyle = '#f57c00'; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(-0.22 * u, -1.45 * u, 0.44 * u, 0.7 * u, 0.1 * u); else ctx.rect(-0.22 * u, -1.45 * u, 0.44 * u, 0.7 * u); ctx.fill();
  ctx.fillStyle = '#e8f04a'; ctx.fillRect(-0.22 * u, -1.15 * u, 0.44 * u, 0.06 * u);
  ctx.strokeStyle = '#f2c094'; ctx.lineWidth = Math.max(1.5, u * 0.12);
  ctx.beginPath(); ctx.moveTo(-0.18 * u, -1.35 * u); ctx.lineTo(-0.18 * u - Math.sin(armL) * 0.5 * u, -1.35 * u + Math.cos(armL) * 0.5 * u);
  ctx.moveTo(0.18 * u, -1.35 * u); ctx.lineTo(0.18 * u + Math.sin(armR) * 0.5 * u, -1.35 * u + Math.cos(armR) * 0.5 * u); ctx.stroke();
  ctx.fillStyle = '#f2c094'; ctx.beginPath(); ctx.arc(0, -1.65 * u, 0.22 * u, 0, TAU); ctx.fill();
  ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(0.07 * u, -1.67 * u, 0.035 * u, 0, TAU); ctx.arc(-0.07 * u, -1.67 * u, 0.035 * u, 0, TAU); ctx.fill();
  if (pose === 'panic') { ctx.beginPath(); ctx.arc(0, -1.55 * u, 0.06 * u, 0, TAU); ctx.fill(); }
  else { ctx.strokeStyle = '#222'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, -1.6 * u, 0.08 * u, 0.2, Math.PI - 0.2); ctx.stroke(); }
  ctx.fillStyle = '#ffd400'; ctx.beginPath(); ctx.arc(0, -1.72 * u, 0.25 * u, Math.PI, 0); ctx.fill(); ctx.fillRect(-0.32 * u, -1.74 * u, 0.64 * u, 0.06 * u);
  ctx.restore();
}
function bubble(ctx, x, y, text) {
  ctx.font = 'bold 13px -apple-system, system-ui, sans-serif';
  const w = ctx.measureText(text).width + 16, h = 24;
  const bx = Math.max(4, Math.min(ctx.canvas.width / (window.devicePixelRatio || 1) - w - 4, x - w / 2)), by = y - h - 10;
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#333'; ctx.lineWidth = 1.5;
  ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(bx, by, w, h, 10); else ctx.rect(bx, by, w, h); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 5, by + h); ctx.lineTo(x, by + h + 8); ctx.lineTo(x + 5, by + h); ctx.fill();
  ctx.fillStyle = '#222'; ctx.fillText(text, bx + 8, by + 16.5);
}
function wheel(ctx, x, y, r, t) {
  ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.fillStyle = '#bbb'; ctx.beginPath(); ctx.arc(x, y, r * 0.45, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#555'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + Math.cos(t) * r * 0.4, y + Math.sin(t) * r * 0.4); ctx.lineTo(x - Math.cos(t) * r * 0.4, y - Math.sin(t) * r * 0.4); ctx.stroke();
}
function vehicle(ctx, cam, v, t) {
  if (v.kind === 'worker') {
    const x = cam.X(v.s), y = cam.Y(v.y);
    ctx.save(); ctx.translate(x, y); ctx.rotate(v.rot); worker(ctx, 0, 0, cam.s * 0.95, v.state === 'fall' ? 'panic' : 'walk', t, v.s); ctx.restore();
    return;
  }
  const L = v.length, s = cam.s;
  const ang = v.ys.length > 1 ? Math.atan2(v.ys[v.ys.length - 1] - v.ys[0], v.axles[v.axles.length - 1] - v.axles[0]) : 0;
  ctx.save();
  ctx.translate(cam.X(v.s), cam.Y(v.state === 'fall' ? v.y : v.ys[0]));
  ctx.rotate(-ang - (v.state === 'fall' ? v.rot : 0));
  const r = v.kind === 'pkw' ? 0.33 : 0.5, roll = v.s / r;
  const wy = -r;
  if (v.kind === 'pkw') {
    ctx.fillStyle = '#d62f2f'; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(0, -1.25 * s, L * s, 0.75 * s, 0.2 * s); else ctx.rect(0, -1.25 * s, L * s, 0.75 * s); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0.9 * s, -1.2 * s); ctx.lineTo(1.4 * s, -1.75 * s); ctx.lineTo(3.0 * s, -1.75 * s); ctx.lineTo(3.6 * s, -1.2 * s); ctx.fill();
    ctx.fillStyle = '#bfe3f5'; ctx.beginPath(); ctx.moveTo(1.15 * s, -1.25 * s); ctx.lineTo(1.5 * s, -1.65 * s); ctx.lineTo(2.2 * s, -1.65 * s); ctx.lineTo(2.2 * s, -1.25 * s); ctx.fill();
    ctx.beginPath(); ctx.moveTo(2.35 * s, -1.25 * s); ctx.lineTo(2.35 * s, -1.65 * s); ctx.lineTo(2.95 * s, -1.65 * s); ctx.lineTo(3.35 * s, -1.25 * s); ctx.fill();
    ctx.fillStyle = '#ffe680'; ctx.fillRect(L * s - 0.2 * s, -1.05 * s, 0.2 * s, 0.18 * s);
  } else {
    const cab = v.kind === 'lkw' ? 2.2 : 2.0;
    ctx.fillStyle = '#333'; ctx.fillRect(0, -1.3 * s, L * s, 0.35 * s);
    ctx.fillStyle = v.kind === 'lkw' ? '#1f6fbf' : '#f0b400';
    ctx.fillRect((L - cab) * s, -3.0 * s, cab * s, 1.8 * s);
    ctx.fillStyle = '#bfe3f5'; ctx.fillRect((L - cab + 0.9) * s, -2.8 * s, (cab - 1.1) * s, 0.8 * s);
    if (v.kind === 'mischer') {
      ctx.save(); ctx.translate((L - cab) * s / 2, -2.4 * s); ctx.rotate(-0.12);
      ctx.fillStyle = '#e6e6e6'; ctx.beginPath(); ctx.ellipse(0, 0, (L - cab) * s / 2 * 0.95, 1.15 * s, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#f08c00'; ctx.lineWidth = Math.max(2, 0.25 * s);
      for (let k = 0; k < 4; k++) { const ph = (t * 2 + k * 1.6) % 6.4 - 3.2; ctx.beginPath(); ctx.moveTo(ph * s * 0.8, -1.1 * s); ctx.lineTo(ph * s * 0.8 + 0.8 * s, 1.1 * s); ctx.stroke(); }
      ctx.restore();
    } else {
      ctx.fillStyle = '#eceae4'; ctx.fillRect(0.1 * s, -3.3 * s, (L - cab - 0.3) * s, 2.1 * s);
      ctx.fillStyle = '#d9480f'; ctx.font = `bold ${Math.max(8, 0.75 * s)}px sans-serif`; ctx.fillText('BEBENBAU', 0.5 * s, -2.0 * s);
    }
  }
  for (const a of v.axles) wheel(ctx, a * s, wy * s, r * s, roll);
  ctx.restore();
}
function payload(ctx, cam, pts, kg, t) {
  if (!pts.length) return;
  let x0 = Infinity, x1 = -Infinity, ys = 0;
  for (const p of pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); ys += p[1]; }
  const yc = ys / pts.length;
  const left = pts.reduce((a, b) => a[0] < b[0] ? a : b), right = pts.reduce((a, b) => a[0] > b[0] ? a : b);
  const ang = right[0] - left[0] > 0.1 ? Math.atan2(right[1] - left[1], right[0] - left[0]) : 0;
  const w = Math.max(2.5, x1 - x0 + 0.6), h = kg > 0 ? Math.min(3, 1.2 + kg / 8000) : 0;
  ctx.save(); ctx.translate(cam.X((x0 + x1) / 2), cam.Y(yc)); ctx.rotate(-ang);
  if (kg > 0) {
    ctx.fillStyle = '#2a7d8c'; ctx.fillRect(-w / 2 * cam.s, -h * cam.s, w * cam.s, h * cam.s);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1;
    for (let k = 1; k < 8; k++) { const xx = -w / 2 * cam.s + k * w * cam.s / 8; ctx.beginPath(); ctx.moveTo(xx, -h * cam.s); ctx.lineTo(xx, 0); ctx.stroke(); }
    pill(ctx, 0, -h * cam.s / 2, Math.round(kg / 100) / 10 + ' t', '#fff', '#1d4f57', Math.max(10, Math.min(16, cam.s * 0.5)));
  } else {
    ctx.strokeStyle = '#555'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -2.5 * cam.s); ctx.stroke();
    ctx.fillStyle = '#d9480f'; ctx.beginPath(); ctx.moveTo(0, -2.5 * cam.s); ctx.lineTo((1 + 0.1 * Math.sin(t * 9)) * cam.s, -2.2 * cam.s); ctx.lineTo(0, -1.9 * cam.s); ctx.fill();
  }
  ctx.restore();
}

BB.Render = { Camera, levelBounds, sky, skyline, crane, terrain, drawMember, drawJoint, forceOverlay, worker, bubble, vehicle, payload, stressColor, pill, arrow, isWater };
})();
