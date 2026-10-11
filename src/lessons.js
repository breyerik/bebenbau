/* Bebenbau – Lernen: Technische Mechanik, Kapitel 1 (Kräfte und Gleichgewicht) und 2 (Auflager).
   Inhalte: Vegapunk (TM-Lernpaket, geprüft von Whitebeard, abgenommen von Erik). Ohne Materialien, nur starre Körper und Kräfte.
   Achsen: x nach rechts, z nach oben (positiv). Einheiten kN / kNm. Alle Auflagerrechnungen laufen über BB.Statics.solve. */
(function () {
'use strict';
const BB = globalThis.BB = globalThis.BB || {};

// ---------------- Rechenkern (auch in Node testbar) ----------------
const VAL = { los: 1, fest: 2, ein: 3 };
const NAME = { los: 'Loslager', fest: 'Festlager', ein: 'Einspannung' };
/* Träger auf Lagern. cfg: { L, sup:[{x, t:'los'|'fest'|'ein'}], P:[{x, F}] (kN, nach unten +), q (kN/m über 0..L) }
   Rückgabe { ok, R:[{x, t, V (kN, nach oben +), H (kN, nach rechts +), M (kNm, gegen Uhrzeiger +)}] } oder { ok:false, mechanism:true } */
function beam(cfg) {
  const L = cfg.L, xs = new Set([0, L]);
  (cfg.sup || []).forEach(s => xs.add(+s.x)); (cfg.P || []).forEach(p => xs.add(+p.x));
  if (cfg.q) for (let i = 1; i < 40; i++) xs.add(L * i / 40);
  const X = [...xs].map(v => Math.round(v * 1e6) / 1e6).filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b);
  const idx = x => X.indexOf(Math.round(x * 1e6) / 1e6);
  const nodes = X.map(x => [x, 0]);
  const members = []; for (let i = 0; i + 1 < X.length; i++) members.push({ a: i, b: i + 1, EA: 1e10, EI: 1e8, type: 'beam' });
  const loads = [];
  (cfg.P || []).forEach(p => loads.push({ node: idx(p.x), fy: -p.F * 1000 }));
  if (cfg.q) for (let i = 0; i + 1 < X.length; i++) { const h = cfg.q * (X[i + 1] - X[i]) / 2 * 1000; loads.push({ node: i, fy: -h }); loads.push({ node: i + 1, fy: -h }); }
  const supports = (cfg.sup || []).map(s => ({ node: idx(s.x), y: true, x: s.t !== 'los', r: s.t === 'ein' }));
  const r = BB.Statics.solve({ nodes, members, supports, loads });
  if (!r.ok) return { ok: false, mechanism: true };
  return { ok: true, R: cfg.sup.map((s, k) => ({ x: s.x, t: s.t, V: r.reactions[k].ry / 1000, H: r.reactions[k].rx / 1000, M: r.reactions[k].m / 1000 })) };
}
/* statisch bestimmt / unbestimmt / beweglich (Abschnitt 2.3): Beweglichkeit prüft der Löser (singuläres System), dann Wertigkeit = 3 oder > 3 */
function classify(sup, L) {
  const val = sup.reduce((s, x) => s + VAL[x.t], 0);
  const r = sup.length ? beam({ L, sup, P: [{ x: L / 2, F: 1 }] }) : { ok: false };
  const kind = !r.ok ? 'beweglich' : val === 3 ? 'bestimmt' : 'unbestimmt';
  return { val, kind };
}
/* Resultierende mehrerer Kräfte an einem Punkt (kN), gegengerechnet über den Löser: Ring an zwei Stäben, die Lagerkräfte heben die Resultierende auf */
function resultant(forces) {
  const Rx = forces.reduce((s, f) => s + f[0], 0), Rz = forces.reduce((s, f) => s + f[1], 0);
  const r = BB.Statics.solve({ nodes: [[0, 0], [1, 0], [0, 1]], members: [{ a: 0, b: 1, EA: 1e9 }, { a: 0, b: 2, EA: 1e9 }],
    supports: [{ node: 1, x: true, y: true }, { node: 2, x: true, y: true }], loads: [{ node: 0, fx: Rx * 1000, fy: Rz * 1000 }] });
  const sx = -(r.reactions[0].rx + r.reactions[1].rx) / 1000, sz = -(r.reactions[0].ry + r.reactions[1].ry) / 1000;
  return { Rx, Rz, R: Math.hypot(Rx, Rz), statik: { Rx: sx, Rz: sz, R: Math.hypot(sx, sz) } };
}
/* Wippe: Drehpunkt (Festlager) in der Mitte, Gewichte G1 links im Abstand a1, G2 rechts im Abstand a2 (kN, m).
   Zur Kontrolle hängt ein Loslager am rechten Ende (3,5 m): bei Gleichgewicht ist seine Kraft null. */
function seesaw(G1, a1, G2, a2) {
  const r = beam({ L: 7, sup: [{ x: 3.5, t: 'fest' }, { x: 7, t: 'los' }], P: [{ x: 3.5 - a1, F: G1 }, { x: 3.5 + a2, F: G2 }] });
  const ML = G1 * a1, MR = G2 * a2, B = r.R[1].V;
  return { ML, MR, net: ML - MR, statikNet: B * 3.5, balanced: Math.abs(B) < 1e-6 };
}
function ramp(G, deg) { const a = deg * Math.PI / 180; return { down: G * Math.sin(a), normal: G * Math.cos(a) }; }
BB.LessonCalc = { beam, classify, resultant, seesaw, ramp, VAL, NAME };

const de = (v, d = 2) => { const f = 10 ** d; let r = Math.round(v * f) / f; if (Object.is(r, -0)) r = 0; return r.toLocaleString('de-DE', { maximumFractionDigits: d }); };
BB.LessonCalc.de = de;

// ---------------- Inhalte (Texte aus dem Lernpaket, wörtlich) ----------------
const CHAPTERS = [
  { nr: 1, title: 'Kräfte und Gleichgewicht',
    note: '<b>Vereinfachungshinweis Kapitel 1:</b> Alle Körper sind im Spiel starr, sie verformen sich nicht. In Wirklichkeit verformt sich alles ein wenig; das kommt später in der Festigkeitslehre.' },
  { nr: 2, title: 'Auflager',
    note: '<b>Vereinfachungshinweis Kapitel 2:</b> Die Auflager im Spiel sind ideal (reibungsfrei, starr). Echte Lager haben Reibung und geben etwas nach. Im Bauwesen werden Auflager nach Eurocode bemessen; das Spiel zeigt nur das Prinzip.' },
];
const LESSONS = [];
BB.LESSONS = LESSONS; BB.LESSON_CHAPTERS = CHAPTERS;

// ---------------- SVG-Bausteine (Bildschirm: y nach unten; Kräfte: z nach oben) ----------------
const RED = '#d62828', GRN = '#1f8a3b', BLU = '#3a6ea5', DK = '#1e2430';
function arr(x1, y1, x2, y2, c = RED, lab = '', w = 3) {
  const L = Math.hypot(x2 - x1, y2 - y1); if (L < 2) return '';
  const ux = (x2 - x1) / L, uy = (y2 - y1) / L, h = Math.min(11, L * 0.6), bx = x2 - ux * h, by = y2 - uy * h, px = -uy * h * 0.5, py = ux * h * 0.5;
  return `<line x1="${x1}" y1="${y1}" x2="${bx}" y2="${by}" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/><polygon points="${x2},${y2} ${bx + px},${by + py} ${bx - px},${by - py}" fill="${c}"/>` +
    (lab ? txt(x2 + ux * 14 + (Math.abs(uy) > 0.9 ? 18 : 0), y2 + uy * 12 + 4, lab, c) : '');
}
// Kraftpfeil: Fußpunkt (x, y) in px, Kraft (fx, fz) in kN, k px je kN
const farr = (x, y, fx, fz, k, c, lab) => arr(x, y, x + fx * k, y - fz * k, c, lab);
const farrTo = (x, y, fx, fz, k, c, lab) => arr(x - fx * k, y + fz * k, x, y, c, lab);  // Pfeil endet im Angriffspunkt (drückt)
function txt(x, y, s, c = DK, size = 13, anchor = 'middle') {
  return `<text x="${x}" y="${y}" fill="${c}" font-size="${size}" font-weight="800" text-anchor="${anchor}" stroke="#fffdf6" stroke-width="3.5" paint-order="stroke">${s}</text>`;
}
function axes(x, y) {
  return `<g opacity="0.8">${arr(x, y, x + 30, y, '#444', '', 1.6)}${arr(x, y, x, y - 30, '#444', '', 1.6)}${txt(x + 37, y + 4, 'x', '#444', 12)}${txt(x, y - 36, 'z', '#444', 12)}</g>`;
}
function hatch(x1, x2, y, down = true) {
  let s = `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${DK}" stroke-width="2"/>`;
  for (let x = x1 + 2; x < x2; x += 6) s += `<line x1="${x}" y1="${y}" x2="${x - 5}" y2="${y + (down ? 6 : -6)}" stroke="${DK}" stroke-width="1.2"/>`;
  return s;
}
function supFest(x, y) { return `<polygon points="${x},${y} ${x - 11},${y + 17} ${x + 11},${y + 17}" fill="#fff" stroke="${DK}" stroke-width="2"/><circle cx="${x}" cy="${y}" r="2.5" fill="${DK}"/>` + hatch(x - 16, x + 16, y + 17); }
function supLos(x, y) { return `<polygon points="${x},${y} ${x - 11},${y + 14} ${x + 11},${y + 14}" fill="#fff" stroke="${DK}" stroke-width="2"/><circle cx="${x}" cy="${y}" r="2.5" fill="${DK}"/><circle cx="${x - 6}" cy="${y + 17.5}" r="3" fill="#fff" stroke="${DK}" stroke-width="1.6"/><circle cx="${x + 6}" cy="${y + 17.5}" r="3" fill="#fff" stroke="${DK}" stroke-width="1.6"/>` + hatch(x - 16, x + 16, y + 21); }
function supEin(x, y, side = -1) {
  let s = `<line x1="${x}" y1="${y - 24}" x2="${x}" y2="${y + 24}" stroke="${DK}" stroke-width="2.5"/>`;
  for (let yy = y - 22; yy <= y + 24; yy += 6) s += `<line x1="${x}" y1="${yy}" x2="${x + side * 7}" y2="${yy - 5}" stroke="${DK}" stroke-width="1.2"/>`;
  return s;
}
function sup(t, x, y, side) { return t === 'los' ? supLos(x, y) : t === 'fest' ? supFest(x, y) : t === 'ein' ? supEin(x, y, side) : ''; }
function bar(x1, x2, y, c = '#b4783a') { return `<rect x="${x1}" y="${y - 4}" width="${x2 - x1}" height="8" rx="2" fill="${c}" stroke="${DK}" stroke-width="1.5"/>`; }
function qload(x1, x2, y, h, lab) {
  let s = `<rect x="${x1}" y="${y - h}" width="${x2 - x1}" height="${h}" fill="rgba(214,40,40,0.12)" stroke="${RED}" stroke-width="1.5"/>`;
  const n = Math.max(2, Math.round((x2 - x1) / 20));
  for (let i = 0; i <= n; i++) { const x = x1 + (x2 - x1) * i / n; s += arr(x, y - h, x, y - 1, RED, '', 1.6); }
  return s + (lab ? txt((x1 + x2) / 2, y - h - 6, lab, RED) : '');
}
function boxAt(x, y, w = 44, h = 34) { return `<rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" rx="3" fill="#d9a066" stroke="#7a4a1e" stroke-width="2"/><path d="M${x - w / 2} ${y - h / 2}L${x + w / 2} ${y + h / 2}M${x + w / 2} ${y - h / 2}L${x - w / 2} ${y + h / 2}" stroke="#7a4a1e" stroke-width="1.2" opacity="0.5"/>`; }
function dim(x1, x2, y, lab) { return `<path d="M${x1} ${y - 4}v8M${x2} ${y - 4}v8M${x1} ${y}H${x2}" stroke="#666" stroke-width="1.2" fill="none"/>` + txt((x1 + x2) / 2, y + 15, lab, '#555', 12); }
const svg = (inner, h = 230, id = '') => `<svg ${id ? `id="${id}"` : ''} class="lg" viewBox="0 0 340 ${h}" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
function kid(x, y, c, lab) { return `<circle cx="${x}" cy="${y - 30}" r="8" fill="${c}"/><rect x="${x - 8}" y="${y - 22}" width="16" height="20" rx="5" fill="${c}"/>` + txt(x, y - 44, lab, DK, 12); }

// Abstraktionen für Träger: Bild 340 px breit, Träger zwischen 40 und 300 px
const BX0 = 40, BX1 = 300;
const bxp = (x, L) => BX0 + (BX1 - BX0) * x / L;
function beamPic(o) {
  // o: { L, y, sup:[{x,t}], P:[{x,F}], q, R:[{x,V,H,M}], dims:[[x1,x2,lab]], k }
  const y = o.y || 120, L = o.L, k = o.k || 2.2;
  let s = axes(22, 214 - 4);
  if (o.q) s += qload(bxp(0, L), bxp(L, L), y - 5, 14 + o.q * 4, o.qlab || `q = ${de(o.q)} kN/m`);
  s += bar(bxp(0, L), bxp(L, L), y);
  (o.sup || []).forEach(p => { s += sup(p.t, bxp(p.x, L) + (p.t === 'ein' ? (p.x === 0 ? -1 : 1) * 0 : 0), y + (p.t === 'ein' ? 0 : 4), p.x === 0 ? -1 : 1); });
  (o.P || []).forEach(p => { s += farrTo(bxp(p.x, L), y - 5, 0, -p.F, k, RED, `${de(p.F)} kN`); });
  (o.R || []).forEach(r => {
    const X = bxp(r.x, L);
    if (Math.abs(r.V) > 1e-6 && r.V > 0) {
      const right = r.x > L / 2, ax = X + (r.t === 'ein' ? 30 : right ? -24 : 24), kk = Math.min(k, 40 / Math.max(1, Math.abs(r.V)));
      s += farrTo(ax, y + 34, 0, r.V, kk, GRN, '') + txt(ax + (right ? -8 : 8), y + 34 + r.V * kk - 6, `${de(r.V)} kN`, GRN, 13, right ? 'end' : 'start');
    }
    if (Math.abs(r.M) > 1e-6) s += `<path d="M${X + 22} ${y - 22} A 26 26 0 0 1 ${X + 22} ${y + 22}" fill="none" stroke="${GRN}" stroke-width="2.6"/>` + txt(X + 50, y - 26, `${de(Math.abs(r.M))} kNm`, GRN);
  });
  (o.labels || []).forEach(([x, lab]) => { s += txt(bxp(x, L), y + 52, lab, DK, 13); });
  (o.dims || []).forEach(([a, b, lab]) => { s += dim(bxp(a, L), bxp(b, L), (o.dy || 182), lab); });
  return svg(s, 230, o.id);
}

// ---------------- Lektionen ----------------
const near = (a, b, t) => Math.abs(a - b) <= t;
const snap = (v, st = 0.5) => Math.round(v / st) * st;
const slider = (id, lab, min, max, step, val, unit) => `<label class="lsl"><span>${lab}</span><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}"><b id="${id}v">${de(val)} ${unit}</b></label>`;

// 1.1 Pfeil-Puzzle
LESSONS.push({ id: '1.1', ch: 1, name: 'Pfeil-Puzzle', sec: 'Was ist eine Kraft?',
  intro: ['Eine Kraft hat drei Eigenschaften: <b>Betrag</b> (wie groß, in N oder kN), <b>Richtung</b> und <b>Angriffspunkt</b>. Darum zeichnen wir sie als Pfeil.', 'Merksatz: 1 kN ≈ das Gewicht von 100 kg.<br><small>„gerechnet mit g ≈ 10 m/s², genau 9,81 m/s²“</small>'],
  introPic: () => svg(axes(30, 200) + boxAt(170, 120) + farr(192, 120, 3, 0, 22, RED, '3 kN') + txt(250, 160, 'Betrag · Richtung', '#555', 12) + txt(250, 176, 'Angriffspunkt', '#555', 12) + `<circle cx="192" cy="120" r="4" fill="${RED}"/>`),
  task: 'Ziehe deinen blauen Pfeil (Betrag und Richtung), bis die Kiste stillsteht.',
  init: () => ({ P: [1, 1] }),
  F: [[-3, 0], [0, -2]], O: [170, 115], K: 22, drag: 'P',
  draw(st) {
    const [ox, oy] = this.O, K = this.K, sx = this.F[0][0] + this.F[1][0] + st.P[0], sz = this.F[0][1] + this.F[1][1] + st.P[1];
    const dx = Math.max(-30, Math.min(30, sx * 6)), dz = Math.max(-30, Math.min(30, sz * 6));
    let s = axes(26, 214) + `<g transform="translate(${dx} ${-dz})">` + boxAt(ox, oy) + '</g>';
    s += farr(ox - 22, oy, -3, 0, K, RED, '3 kN') + farr(ox, oy + 17, 0, -2, K, RED, '2 kN');
    s += farr(ox, oy, st.P[0], st.P[1], K, BLU, `${de(Math.hypot(...st.P))} kN`) + `<circle cx="${ox + st.P[0] * K}" cy="${oy - st.P[1] * K}" r="11" fill="${BLU}" opacity="0.25"/>`;
    return svg(s, 230, 'tsvg');
  },
  status(st) { const sx = st.P[0] - 3, sz = st.P[1] - 2; return `Σ F<sub>x</sub> = ${de(sx)} kN · Σ F<sub>z</sub> = ${de(sz)} kN` + (near(sx, 0, 1e-9) && near(sz, 0, 1e-9) ? ' · <b class="okc">Kiste steht still</b>' : ''); },
  check(st) { const ok = near(st.P[0], 3, 1e-9) && near(st.P[1], 2, 1e-9); return { ok, msg: ok ? '' : 'Die Kiste bewegt sich noch: Die Summe der Kräfte ist nicht null.' }; },
  explain: () => ({ text: '„Die Kiste bewegt sich nicht, weil sich alle Kräfte gegenseitig aufheben.“', formula: 'Σ F<sub>x</sub> = −3 kN + 3 kN = 0<br>Σ F<sub>z</sub> = −2 kN + 2 kN = 0',
    pic: svg(axes(26, 214) + boxAt(170, 115) + farr(148, 115, -3, 0, 22, RED, '3 kN') + farr(170, 132, 0, -2, 22, RED, '2 kN') + farr(170, 115, 3, 2, 22, BLU, `${de(Math.hypot(3, 2))} kN`)) }),
});

// 1.2 Seilziehen (Prüffall 3/4/5-Dreieck)
LESSONS.push({ id: '1.2', ch: 1, name: 'Seilziehen', sec: 'Kräfte zusammensetzen – die Resultierende',
  intro: ['Mehrere Kräfte an einem Punkt lassen sich zu <b>einer</b> Ersatzkraft zusammenfassen, der Resultierenden R.',
    '• Gleiche Wirkungslinie: einfach addieren (Richtung beachten).<br>• Unter einem Winkel: Kräfteparallelogramm oder Krafteck (Pfeile aneinanderhängen).',
    'Achsen im Spiel: x nach rechts, z nach oben (positiv), mit Achsenkreuz in jedem Bild. Hinweis: In vielen TM-Vorlesungen zeigt z nach unten; dann drehen sich nur die Vorzeichen, die Ergebnisse bleiben gleich.',
    'Rechnerisch über Komponenten:<br><span class="fm">R<sub>x</sub> = Σ F<sub>i</sub>·cos α<sub>i</sub>, R<sub>z</sub> = Σ F<sub>i</sub>·sin α<sub>i</sub>, R = √(R<sub>x</sub>² + R<sub>z</sub>²)</span>',
    'Beispiel: 3 kN nach rechts und 4 kN nach oben ergeben R = 5 kN.'],
  introPic: () => { const o = [120, 170], K = 22; return svg(axes(26, 214) + `<path d="M${o[0] + 66} ${o[1]}L${o[0] + 66} ${o[1] - 88}L${o[0]} ${o[1] - 88}" stroke="#999" stroke-dasharray="4 4" fill="none"/>` + farr(o[0], o[1], 3, 0, K, RED, '3 kN') + farr(o[0], o[1], 0, 4, K, RED, '4 kN') + farr(o[0], o[1], 3, 4, K, BLU, 'R = 5 kN')); },
  task: 'Zwei Seile ziehen am Ring. Setze das dritte Seil (blau) so, dass der Ring ruht.',
  init: () => ({ P: [2, -1] }), O: [170, 125], K: 18, drag: 'P',
  draw(st) {
    const [ox, oy] = this.O, K = this.K;
    let s = axes(26, 214) + farr(ox, oy, 3, 0, K, RED, '3 kN') + farr(ox, oy, 0, 4, K, RED, '4 kN') + farr(ox, oy, st.P[0], st.P[1], K, BLU, `${de(Math.hypot(...st.P))} kN`);
    s += `<circle cx="${ox}" cy="${oy}" r="9" fill="none" stroke="${DK}" stroke-width="3.5"/><circle cx="${ox + st.P[0] * K}" cy="${oy - st.P[1] * K}" r="11" fill="${BLU}" opacity="0.25"/>`;
    return svg(s, 230, 'tsvg');
  },
  status(st) { const r = resultant([[3, 0], [0, 4], st.P]); return `R aller drei Seile: R<sub>x</sub> = ${de(r.Rx)} kN, R<sub>z</sub> = ${de(r.Rz)} kN, R = ${de(r.R)} kN`; },
  check(st) { const r = resultant([[3, 0], [0, 4], st.P]); const ok = r.R < 1e-9; return { ok, msg: ok ? '' : `Der Ring wird noch mit ${de(r.R)} kN weggezogen.` }; },
  explain: () => { const r = resultant([[3, 0], [0, 4]]); return { text: '„Dein drittes Seil muss genau die Resultierende der anderen beiden aufheben: gleich groß, entgegengesetzt.“',
    formula: `R = √(3² + 4²) kN = ${de(r.R)} kN<br>drittes Seil: 5 kN, Richtung (−3 | −4)`,
    pic: svg(axes(26, 214) + farr(170, 125, 3, 0, 18, RED, '3 kN') + farr(170, 125, 0, 4, 18, RED, '4 kN') + farr(170, 125, 3, 4, 18, '#888', 'R') + farr(170, 125, -3, -4, 18, BLU, '5 kN')) }; },
});

// 1.3 Rampe (schiefe Ebene)
function rampPic(deg, G, comps, est) {
  const a = deg * Math.PI / 180, x0 = 30, y0 = 190, len = 280, x1 = x0 + len * Math.cos(a), y1 = y0 - len * Math.sin(a);
  const t = 0.55, px = x0 + (x1 - x0) * t, py = y0 + (y1 - y0) * t, nx = -Math.sin(a), ny = -Math.cos(a);  // Normale (Bildschirm)
  const cx = px + nx * 18, cy = py + ny * 18, K = 9;
  let s = axes(26, 222) + `<polygon points="${x0},${y0} ${x1},${y0} ${x1},${y1}" fill="#e7e2d3" stroke="${DK}" stroke-width="2"/>`;
  s += `<path d="M${x0 + 40} ${y0} A 40 40 0 0 0 ${x0 + 40 * Math.cos(a)} ${y0 - 40 * Math.sin(a)}" fill="none" stroke="#555"/>` + txt(x0 + 56, y0 - 8, `α = ${deg}°`, '#555', 12);
  s += `<g transform="rotate(${-deg} ${cx} ${cy})">${boxAt(cx, cy, 40, 30)}</g>`;
  s += farr(cx, cy, 0, -G, K, RED, `G = ${de(G)} kN`);
  if (comps) {
    const d = comps.down, n = comps.normal, ux = -Math.cos(a), uz = -Math.sin(a), wx = Math.sin(a), wz = -Math.cos(a);
    s += farr(cx, cy, ux * d, uz * d, K, BLU, `${de(d, 1)} kN`) + farr(cx, cy, wx * n, wz * n, K, GRN, `${de(n, 1)} kN`);
  }
  return svg(s, 230, est ? 'tsvg' : '');
}
LESSONS.push({ id: '1.3', ch: 1, name: 'Rampe', sec: 'Zerlegen einer Kraft',
  intro: ['Eine schräge Kraft lässt sich in zwei Komponenten zerlegen: <span class="fm">F<sub>x</sub> = F·cos α, F<sub>z</sub> = F·sin α</span>.'],
  introPic: () => svg(axes(26, 214) + farr(120, 170, 4 * Math.cos(Math.PI / 6), 4 * Math.sin(Math.PI / 6), 30, RED, 'F') + farr(120, 170, 4 * Math.cos(Math.PI / 6), 0, 30, BLU, 'F·cos α') + farr(120 + 4 * Math.cos(Math.PI / 6) * 30, 170, 0, 2, 30, BLU, 'F·sin α')),
  task: 'Kiste auf schiefer Ebene, G = 10 kN, α = 30°. Welcher Anteil drückt in die Rampe, welcher zieht sie herunter? Schätze beide.',
  init: () => ({ d: 2, n: 6 }),
  controls: st => slider('s_d', 'hangabwärts', 0, 10, 0.5, st.d, 'kN') + slider('s_n', 'in die Rampe', 0, 10, 0.5, st.n, 'kN'),
  bind: (st, r) => { onIn('s_d', v => { st.d = v; r(); }, 'kN'); onIn('s_n', v => { st.n = v; r(); }, 'kN'); },
  draw: st => rampPic(30, 10, { down: st.d, normal: st.n }, true),
  status: () => 'Blau: hangabwärts · Grün: senkrecht zur Rampe',
  check(st) { const c = ramp(10, 30), ok = near(st.d, c.down, 0.5) && near(st.n, c.normal, 0.5);
    return { ok, msg: ok ? '' : 'Noch nicht. Tipp: Bei kleinem Winkel drückt fast alles in die Rampe, bei steilem zieht fast alles herunter.' }; },
  explain: () => { const c = ramp(10, 30); return { text: 'Gewicht G zerfällt in G·cos α (senkrecht zur Rampe) und G·sin α (hangabwärts).',
    formula: `G·sin α = 10 kN · sin 30° = ${de(c.down)} kN<br>G·cos α = 10 kN · cos 30° = ${de(c.normal)} kN`, pic: rampPic(30, 10, c) }; },
});

// 1.4 Wippe (Prüffall 0,3 kN × 2 m = 0,2 kN × 3 m = 0,6 kNm)
function seesawPic(a1, a2, id) {
  const m = seesaw(0.3, a1, 0.2, a2), ang = Math.max(-14, Math.min(14, m.net * 12)), cx = 170, cy = 140, k = 40;
  let s = axes(26, 214) + `<polygon points="${cx},${cy} ${cx - 14},${cy + 40} ${cx + 14},${cy + 40}" fill="#8d99ae" stroke="${DK}" stroke-width="2"/>` + hatch(cx - 30, cx + 30, cy + 40);
  s += `<g transform="rotate(${-ang} ${cx} ${cy})">${bar(cx - 3.5 * k, cx + 3.5 * k, cy - 4)}${kid(cx - a1 * k, cy - 8, '#e76f51', '30 kg')}${kid(cx + a2 * k, cy - 8, '#2a9d8f', '20 kg')}` +
    farr(cx - a1 * k, cy - 8, 0, -0.3, 80, RED, '') + farr(cx + a2 * k, cy - 8, 0, -0.2, 80, RED, '') + '</g>';
  s += txt(cx - 95, 40, `${de(0.3, 1)} kN × ${de(a1, 1)} m`, RED, 12) + txt(cx + 95, 40, `${de(0.2, 1)} kN × ${de(a2, 1)} m`, RED, 12);
  s += txt(cx - 95, 56, `= ${de(m.ML)} kNm`, RED, 12) + txt(cx + 95, 56, `= ${de(m.MR)} kNm`, RED, 12);
  return svg(s, 230, id);
}
LESSONS.push({ id: '1.4', ch: 1, name: 'Wippe', sec: 'Das Moment',
  intro: ['Eine Kraft, die nicht durch den Drehpunkt geht, will drehen. Das <b>Moment</b> ist <span class="fm">M = F · a</span> (Kraft mal Hebelarm, senkrechter Abstand der Wirkungslinie zum Drehpunkt), Einheit kNm.'],
  introPic: () => svg(axes(26, 214) + `<circle cx="80" cy="130" r="5" fill="${DK}"/>` + bar(80, 260, 130) + farr(240, 126, 0, -2, 25, RED, 'F') + dim(80, 240, 165, 'a') + `<path d="M120 100 A 50 50 0 0 1 130 160" fill="none" stroke="${BLU}" stroke-width="2.5"/>` + txt(140, 96, 'M = F · a', BLU)),
  task: 'Zwei Kinder auf einer Wippe (30 kg ≙ 0,3 kN und 20 kg ≙ 0,2 kN, gerechnet mit g ≈ 10 m/s², genau 9,81 m/s²). Verschiebe sie, bis die Wippe waagerecht steht.',
  init: () => ({ a1: 3, a2: 1 }),
  controls: st => slider('s_a1', 'Kind links (30 kg)', 0.5, 3.5, 0.5, st.a1, 'm') + slider('s_a2', 'Kind rechts (20 kg)', 0.5, 3.5, 0.5, st.a2, 'm'),
  bind: (st, r) => { onIn('s_a1', v => { st.a1 = v; r(); }, 'm'); onIn('s_a2', v => { st.a2 = v; r(); }, 'm'); },
  draw: st => seesawPic(st.a1, st.a2, 'tsvg'),
  status(st) { const m = seesaw(0.3, st.a1, 0.2, st.a2); return m.balanced ? '<b class="okc">Die Wippe steht waagerecht.</b>' : `Die Wippe kippt nach ${m.net > 0 ? 'links' : 'rechts'}: ${de(Math.abs(m.net))} kNm Unterschied`; },
  check(st) { const ok = seesaw(0.3, st.a1, 0.2, st.a2).balanced; return { ok, msg: ok ? '' : 'Die Wippe kippt noch. Vergleiche die beiden Momente links und rechts.' }; },
  explain: () => ({ text: '„Links 0,3 kN × 2 m = 0,6 kNm, rechts 0,2 kN × 3 m = 0,6 kNm. Gleiche Momente, also Gleichgewicht.“ (Kinder mit 30 kg und 20 kg; gerechnet wird mit ihrem Gewicht, nicht der Masse. Ein Moment hat immer die Einheit Kraft × Länge.)<br><small>30 kg → 0,3 kN, 20 kg → 0,2 kN: gerechnet mit g ≈ 10 m/s², genau 9,81 m/s².</small>',
    formula: 'M = F · a<br>0,3 kN · 2 m = 0,2 kN · 3 m = 0,6 kNm', pic: seesawPic(2, 3) }),
});

// 1.5 Balanceakt
const BAL = { L: 6, loads: [[1, 6], [4, 3]], H0: 2 };
function balSums(st) { const Fz = st.S - 9, Fx = BAL.H0 + st.H, M = st.S * st.xs - (6 * 1 + 3 * 4); return { Fx, Fz, M }; }
function balPic(st, id) {
  const L = BAL.L, y = 120, X = x => bxp(x, L), z = balSums(st), ang = Math.max(-8, Math.min(8, z.M * 0.6));
  let s = axes(26, 214) + `<g transform="rotate(${-ang} ${X(st.xs)} ${y})">` + bar(X(0), X(L), y);
  BAL.loads.forEach(([x, F]) => { s += farrTo(X(x), y - 5, 0, -F, 7, RED, `${de(F)} kN`); });
  s += farrTo(X(0) - 2, y, BAL.H0, 0, 9, RED, '') + txt(X(0) - 4, y - 12, '2 kN', RED, 12);
  if (st.H) s += farrTo(X(L) + (st.H < 0 ? 2 : 0), y, st.H, 0, 9, BLU, `${de(Math.abs(st.H))} kN`);
  s += '</g>' + `<rect x="${X(st.xs) - 6}" y="${y + 5}" width="12" height="${200 - y - 5}" fill="#8d99ae" stroke="${DK}" stroke-width="1.5"/>` + hatch(X(st.xs) - 18, X(st.xs) + 18, 200);
  s += farrTo(X(st.xs) + 16, y + 6, 0, st.S, 4, BLU, `${de(st.S)} kN`);
  s += dim(X(0), X(st.xs), 215, `${de(st.xs)} m`);
  return svg(s, 230, id);
}
const lamp = (lab, v, u) => `<span class="lamp ${Math.abs(v) < 1e-9 ? 'g' : 'r'}">${lab} = ${de(v)} ${u}</span>`;
LESSONS.push({ id: '1.5', ch: 1, name: 'Balanceakt', sec: 'Die drei Gleichgewichtsbedingungen (Ebene)',
  intro: ['Ein Körper ruht nur, wenn gilt:<br><span class="fm">Σ F<sub>x</sub> = 0, Σ F<sub>z</sub> = 0, Σ M = 0 (um einen beliebigen Punkt)</span>', 'Das ist das wichtigste Werkzeug der ganzen Statik.'],
  introPic: () => svg(axes(26, 214) + boxAt(170, 120) + farr(192, 120, 2, 0, 20, RED, '') + farr(148, 120, -2, 0, 20, RED, '') + farr(170, 103, 0, 2, 20, RED, '') + farr(170, 137, 0, -2, 20, RED, '') + txt(170, 40, 'Σ F_x = 0 · Σ F_z = 0 · Σ M = 0', DK, 12)),
  task: 'Brett mit mehreren Lasten. Setze die Stütze (Lage und Kraft) und eine waagerechte Kraft so, dass alle drei Ampeln grün sind.',
  init: () => ({ xs: 4, S: 6, H: 0 }),
  controls: st => slider('s_xs', 'Stütze bei x', 0, 6, 0.5, st.xs, 'm') + slider('s_S', 'Stützkraft ↑', 0, 15, 0.5, st.S, 'kN') + slider('s_H', 'Kraft rechts (+ →)', -5, 5, 0.5, st.H, 'kN'),
  bind: (st, r) => { onIn('s_xs', v => { st.xs = v; r(); }, 'm'); onIn('s_S', v => { st.S = v; r(); }, 'kN'); onIn('s_H', v => { st.H = v; r(); }, 'kN'); },
  draw: st => balPic(st, 'tsvg'),
  status(st) { const z = balSums(st); return lamp('ΣF<sub>x</sub>', z.Fx, 'kN') + lamp('ΣF<sub>z</sub>', z.Fz, 'kN') + lamp('ΣM', z.M, 'kNm') + '<div class="mini">ΣM um das linke Brettende, gegen den Uhrzeiger positiv</div>'; },
  check(st) {
    const z = balSums(st), ok = [z.Fx, z.Fz, z.M].every(v => Math.abs(v) < 1e-9);
    let msg = '';
    if (Math.abs(z.Fx) > 1e-9) msg = `ΣF_x ist nicht null, dein Brett rutscht mit ${de(Math.abs(z.Fx))} kN nach ${z.Fx > 0 ? 'rechts' : 'links'}.`;
    else if (Math.abs(z.Fz) > 1e-9) msg = `ΣF_z ist nicht null, dein Brett bewegt sich mit ${de(Math.abs(z.Fz))} kN nach ${z.Fz > 0 ? 'oben' : 'unten'}.`;
    else if (Math.abs(z.M) > 1e-9) msg = `ΣM ist nicht null, dein Brett dreht sich um ${de(Math.abs(z.M))} kNm nach ${z.M > 0 ? 'links' : 'rechts'}.`;
    return { ok, msg };
  },
  explain: () => ({ text: 'Alle drei Ampeln sind grün: Das Brett ruht.', formula: 'Σ F<sub>x</sub> = 2 kN − 2 kN = 0<br>Σ F<sub>z</sub> = 9 kN − 6 kN − 3 kN = 0<br>Σ M = 9 kN · 2 m − 6 kN · 1 m − 3 kN · 4 m = 0',
    pic: balPic({ xs: 2, S: 9, H: -2 }) }),
});

// 2.1 Welches Lager?
const TYPES = ['', 'los', 'fest', 'ein'];
const tName = t => t ? NAME[t] : 'kein Lager';
const BRIDGES = [
  { name: 'Brücke 1', L: 6, slots: [0, 6], fixed: {} },
  { name: 'Brücke 2 (Balkon an der Wand)', L: 3, slots: [0], fixed: {} },
  { name: 'Brücke 3', L: 6, slots: [0, 6], fixed: { 0: 'fest' } },
];
function supsOf(br, sel) { return br.slots.map((x, i) => ({ x, t: br.fixed[i] || sel[i] })).filter(s => s.t); }
function bridgePic(br, sel, id) {
  const sp = supsOf(br, sel), c = classify(sp, br.L);
  let s = beamPic({ L: br.L, sup: sp, y: 100, labels: [] }).replace(/^<svg[^>]*>|<\/svg>$/g, '');
  br.slots.forEach((x, i) => { if (!br.fixed[i] && !sel[i]) s += `<rect x="${bxp(x, br.L) - 16}" y="106" width="32" height="24" rx="5" fill="none" stroke="${BLU}" stroke-dasharray="4 3" stroke-width="2"/>` + txt(bxp(x, br.L), 123, '?', BLU); });
  s += txt(170, 30, br.name, DK, 14) + txt(170, 175, c.kind === 'bestimmt' ? 'statisch bestimmt ✓' : c.kind === 'unbestimmt' ? 'statisch unbestimmt' : 'beweglich', c.kind === 'bestimmt' ? GRN : RED, 13);
  return svg(s, 190, id);
}
LESSONS.push({ id: '2.1', ch: 2, name: 'Welches Lager?', sec: 'Wozu Auflager? · Die drei Grundtypen',
  intro: ['Auflager verbinden ein Bauteil mit der Umgebung und leiten die Lasten weiter. Jedes Auflager kann bestimmte Kräfte aufnehmen, die <b>Auflagerkräfte</b> (Lagerreaktionen).',
    '<table class="lt"><tr><th>Auflager</th><th>Symbol im Spiel</th><th>nimmt auf</th><th>Wertigkeit</th></tr><tr><td>Loslager (verschieblich)</td><td>Dreieck auf Rollen</td><td>1 Kraft senkrecht zur Bahn</td><td>1</td></tr><tr><td>Festlager (gelenkig)</td><td>Dreieck</td><td>2 Kräfte (horizontal + vertikal)</td><td>2</td></tr><tr><td>Einspannung</td><td>schraffierte Wand</td><td>2 Kräfte + 1 Moment</td><td>3</td></tr></table>'],
  introPic: () => svg(axes(22, 214) + supLos(60, 90) + txt(60, 140, 'Loslager', DK, 12) + farrTo(84, 104, 0, 1, 26, GRN, '') +
    supFest(170, 90) + txt(170, 140, 'Festlager', DK, 12) + farrTo(194, 104, 0, 1, 26, GRN, '') + farrTo(150, 120, 1, 0, 22, GRN, '') +
    bar(282, 320, 90) + supEin(282, 90, -1) + txt(290, 140, 'Einspannung', DK, 12) + farrTo(292, 105, 0, 1, 22, GRN, '') + `<path d="M300 72 A 18 18 0 0 1 300 108" fill="none" stroke="${GRN}" stroke-width="2.4"/>`),
  task: 'Drei Brücken: Tippe auf die Lagerplätze und wähle passende Lager, bis jede Brücke statisch bestimmt gelagert ist.',
  init: () => ({ sel: BRIDGES.map(() => ({})) }),
  draw(st) { return `<div id="tsvg">${BRIDGES.map((b, i) => `<div class="brw" data-b="${i}">${bridgePic(b, st.sel[i])}<div class="slots">${b.slots.map((x, j) => b.fixed[j] ? `<span class="slot fix">${b.slots.length > 1 ? (j ? 'rechts' : 'links') + ': ' : ''}${NAME[b.fixed[j]]}</span>` : `<button class="slot" data-b="${i}" data-s="${j}">${b.slots.length > 1 ? (j ? 'rechts' : 'links') + ': ' : ''}${tName(st.sel[i][j])}</button>`).join('')}</div></div>`).join('')}</div>`; },
  after_draw(st, r) { document.querySelectorAll('#tsvg button.slot').forEach(b => { b.onclick = () => { const i = +b.dataset.b, j = +b.dataset.s, cur = st.sel[i][j] || ''; st.sel[i][j] = TYPES[(TYPES.indexOf(cur) + 1) % TYPES.length]; r(); }; }); },
  status: () => 'Jeder Tipp wechselt: kein Lager → Loslager → Festlager → Einspannung',
  check(st) {
    const res = BRIDGES.map((b, i) => ({ b, sp: supsOf(b, st.sel[i]), c: classify(supsOf(b, st.sel[i]), b.L) }));
    const bad = res.find(r => r.c.kind !== 'bestimmt');
    if (!bad) return { ok: true };
    const twoFest = bad.sp.length === 2 && bad.sp.every(s => s.t === 'fest');
    return { ok: false, msg: `${bad.b.name}: ${bad.c.kind === 'beweglich' ? 'beweglich' : 'statisch unbestimmt'} (Wertigkeit ${bad.c.val}).` + (twoFest ? ' Zwei Festlager verhindern, dass die Brücke länger wird. Dabei entstehen Zwangskräfte.' : '') };
  },
  explain: () => ({ text: '„Ein Loslager lässt die Brücke bei Wärme wachsen. Zwei Festlager verhindern, dass die Brücke länger wird. Dabei entstehen Zwangskräfte.“',
    formula: 'Festlager (2) + Loslager (1) = 3<br>Einspannung allein = 3', pic: beamPic({ L: 6, sup: [{ x: 0, t: 'fest' }, { x: 6, t: 'los' }], y: 100 }) }),
});

// 2.2 Kippt es?
const KSLOTS = [0, 3, 6];
function kippPic(st, id) {
  const sp = KSLOTS.map((x, i) => ({ x, t: st.t[i] })).filter(s => s.t), c = classify(sp, 6);
  let s = beamPic({ L: 6, sup: sp, y: 100 }).replace(/^<svg[^>]*>|<\/svg>$/g, '');
  KSLOTS.forEach((x, i) => { if (!st.t[i]) s += `<rect x="${bxp(x, 6) - 16}" y="106" width="32" height="24" rx="5" fill="none" stroke="${BLU}" stroke-dasharray="4 3" stroke-width="2"/>`; });
  s += txt(170, 175, `Wertigkeit ${c.val} → ${c.kind === 'beweglich' ? 'beweglich' : 'statisch ' + c.kind}`, c.kind === 'bestimmt' ? GRN : c.kind === 'unbestimmt' ? '#b5651d' : RED, 14);
  return svg(s, 190, id);
}
LESSONS.push({ id: '2.2', ch: 2, name: 'Kippt es?', sec: 'Statisch bestimmt, unbestimmt, beweglich',
  intro: ['In der Ebene gibt es 3 Gleichgewichtsbedingungen. Ein einzelner Körper braucht Auflager mit der Summe der Wertigkeiten 3:',
    '• weniger als 3: <b>beweglich</b> (kinematisch), das System kippt oder rutscht weg,<br>• genau 3 (und richtig angeordnet): <b>statisch bestimmt</b>, mit den drei Gleichgewichtsbedingungen lösbar,<br>• mehr als 3: <b>statisch unbestimmt</b>, braucht zusätzlich Verformungen (kommt später).',
    'Achtung: Auch 3 Wertigkeiten können beweglich sein, z. B. drei Loslager, deren Wirkungslinien sich in einem Punkt schneiden oder alle parallel sind.'],
  introPic: () => svg(axes(22, 214) + bar(40, 300, 100) + supLos(40, 104) + supLos(170, 104) + supLos(300, 104) + arr(170, 70, 230, 70, RED, '') + txt(170, 160, '3 Loslager, alle parallel: beweglich', RED, 13)),
  task: 'Baue Systeme aus bis zu drei Lagern. Finde jeden der drei Fälle einmal: beweglich, bestimmt und unbestimmt.',
  init: () => ({ t: ['los', '', 'los'], found: {} }),
  draw(st) { return `<div id="tsvg">${kippPic(st)}<div class="slots">${KSLOTS.map((x, i) => `<button class="slot" data-s="${i}">x = ${de(x)} m: ${tName(st.t[i])}</button>`).join('')}</div></div>`; },
  after_draw(st, r) { document.querySelectorAll('#tsvg button.slot').forEach(b => { b.onclick = () => { const i = +b.dataset.s; st.t[i] = TYPES[(TYPES.indexOf(st.t[i] || '') + 1) % TYPES.length]; r(); }; }); },
  status(st) {
    const sp = KSLOTS.map((x, i) => ({ x, t: st.t[i] })).filter(s => s.t), c = classify(sp, 6); st.found[c.kind] = true;
    const tl = ['beweglich', 'bestimmt', 'unbestimmt'].map(k => `<span class="lamp ${st.found[k] ? 'g' : 'o'}">${st.found[k] ? '✓' : '○'} ${k}</span>`).join('');
    const hint = c.kind === 'beweglich' && sp.length === 2 && sp.every(s => s.t === 'los') ? '<div class="mini">„Zwei Loslager können keine horizontale Kraft aufnehmen, dein Träger rutscht weg.“</div>' : '';
    return tl + hint;
  },
  check(st) { const ok = ['beweglich', 'bestimmt', 'unbestimmt'].every(k => st.found[k]); return { ok, msg: ok ? '' : 'Es fehlen noch Fälle: ' + ['beweglich', 'bestimmt', 'unbestimmt'].filter(k => !st.found[k]).join(', ') + '.' }; },
  explain: () => ({ text: 'Erklärung bei „beweglich“: „Zwei Loslager können keine horizontale Kraft aufnehmen, dein Träger rutscht weg.“',
    formula: 'Wertigkeit &lt; 3: beweglich<br>= 3 (richtig angeordnet): statisch bestimmt<br>&gt; 3: statisch unbestimmt', pic: beamPic({ L: 6, sup: [{ x: 0, t: 'los' }, { x: 6, t: 'los' }], y: 100 }).replace('</svg>', arr(170, 70, 230, 70, RED, '') + txt(170, 170, 'beweglich: rutscht weg', RED) + '</svg>') }),
});

// 2.3 Schätz mal (Prüffall Einfeldträger A = 20 kN, B = 10 kN)
const EF = { L: 6, a: 2, F: 30 };
const efSup = [{ x: 0, t: 'fest' }, { x: 6, t: 'los' }];
LESSONS.push({ id: '2.3', ch: 2, name: 'Schätz mal', sec: 'Auflagerkräfte berechnen – Einfeldträger',
  intro: ['Träger auf Festlager A und Loslager B, Länge L, Einzellast F im Abstand a von A:',
    '<span class="fm">Σ M<sub>A</sub> = 0: B·L − F·a = 0, also B = F·a / L<br>Σ F<sub>z</sub> = 0: A + B − F = 0, also A = F·(L−a) / L<br>Σ F<sub>x</sub> = 0: A<sub>x</sub> = 0 (keine Horizontallast)</span>'],
  introPic: () => beamPic({ L: 6, sup: efSup, P: [{ x: 2, F: 30 }], labels: [[0, 'A'], [6, 'B']], dims: [[0, 2, 'a'], [0, 6, 'L']], dy: 196, k: 1.6 }),
  task: 'L = 6 m, a = 2 m, F = 30 kN. Schätze A und B mit den Schiebereglern. Dann fährt die Last drüber und das Spiel zeigt die echten Werte.',
  init: () => ({ A: 15, B: 15, x: 2, shown: false }),
  controls: st => slider('s_A', 'A', 0, 30, 1, st.A, 'kN') + slider('s_B', 'B', 0, 30, 1, st.B, 'kN'),
  bind: (st, r) => { onIn('s_A', v => { st.A = v; r(); }, 'kN'); onIn('s_B', v => { st.B = v; r(); }, 'kN'); },
  draw(st) { const res = beam({ L: 6, sup: efSup, P: [{ x: st.x, F: 30 }] }); return beamPic({ id: 'tsvg', L: 6, sup: efSup, P: [{ x: st.x, F: 30 }], R: st.shown ? res.R : [], labels: [[0, st.shown ? 'A' : `A ≈ ${de(st.A)} kN?`], [6, st.shown ? 'B' : `B ≈ ${de(st.B)} kN?`]], dims: [[0, st.x, `a = ${de(st.x, 1)} m`]], dy: 196, k: 1.6 }); },
  status(st) { return st.shown ? (() => { const r = beam({ L: 6, sup: efSup, P: [{ x: st.x, F: 30 }] }).R; return `A = ${de(r[0].V, 1)} kN · B = ${de(r[1].V, 1)} kN`; })() : `Deine Schätzung: A + B = ${de(st.A + st.B)} kN`; },
  run(st, r, done) {  // Last fährt von links nach rechts und zurück auf a = 2 m
    st.shown = true; const path = []; for (let i = 0; i <= 30; i++) path.push(6 * i / 30); for (let i = 30; i >= 10; i--) path.push(6 * i / 30);
    let k = 0; const step = () => { st.x = Math.round(path[k] * 100) / 100; r(); k++; if (k < path.length) setTimeout(step, 45); else done(); }; step();
  },
  check(st) { const r = beam({ L: 6, sup: efSup, P: [{ x: 2, F: 30 }] }).R, ok = near(st.A, r[0].V, 1) && near(st.B, r[1].V, 1);
    return { ok, msg: ok ? '' : `Deine Schätzung: A = ${de(st.A)} kN, B = ${de(st.B)} kN. Echt: A = ${de(r[0].V)} kN, B = ${de(r[1].V)} kN.` }; },
  explain: () => { const r = beam({ L: 6, sup: efSup, P: [{ x: 2, F: 30 }] }).R; return { text: `Beispiel: L = 6 m, a = 2 m, F = 30 kN ergibt A = ${de(r[0].V)} kN, B = ${de(r[1].V)} kN. Das Lager näher an der Last trägt mehr.`,
    formula: 'B = F·a / L = 30 kN · 2 m / 6 m = 10 kN<br>A = F·(L−a) / L = 30 kN · 4 m / 6 m = 20 kN', pic: beamPic({ L: 6, sup: efSup, P: [{ x: 2, F: 30 }], R: r, k: 1.6 }) }; },
});

// 2.4 Balkon (Prüffall Kragträger A = 10 kN, M_A = 30 kNm)
const kragSup = [{ x: 0, t: 'ein' }];
const kragPic = (L, id, show) => { const r = beam({ L, sup: kragSup, P: [{ x: L, F: 10 }] }); return beamPic({ id, L: 4, sup: kragSup, P: [{ x: L, F: 10 }], R: show ? r.R : [], dims: [[0, L, `L = ${de(L, 1)} m`]], k: 3 }).replace(`width="${BX1 - BX0}"`, `width="${(BX1 - BX0) * L / 4}"`); };
LESSONS.push({ id: '2.4', ch: 2, name: 'Balkon', sec: 'Kragträger (Einspannung)',
  intro: ['Länge L, Last F am freien Ende: <span class="fm">Auflagerkraft A = F, Einspannmoment M<sub>A</sub> = F·L</span>.'],
  introPic: () => kragPic(3, '', true),
  task: 'Ein Balkon (L = 3 m) muss eine Person tragen, F = 10 kN am freien Ende. Schätze das Einspannmoment an der Wand.',
  init: () => ({ M: 10, L: 3, shown: false }),
  controls: st => st.shown ? slider('s_L', 'Balkonlänge L', 1, 4, 0.5, st.L, 'm') : slider('s_M', 'M<sub>A</sub>', 0, 60, 5, st.M, 'kNm'),
  bind: (st, r) => { onIn('s_M', v => { st.M = v; r(); }, 'kNm'); onIn('s_L', v => { st.L = v; r(); }, 'm'); },
  draw: st => kragPic(st.L, 'tsvg', st.shown),
  status(st) { if (!st.shown) return `Deine Schätzung: M<sub>A</sub> = ${de(st.M)} kNm`; const r = beam({ L: st.L, sup: kragSup, P: [{ x: st.L, F: 10 }] }).R[0]; return `A = ${de(r.V)} kN · M<sub>A</sub> = ${de(Math.abs(r.M))} kNm – zieh an der Länge!`; },
  check(st) { const r = beam({ L: 3, sup: kragSup, P: [{ x: 3, F: 10 }] }).R[0], ok = near(st.M, Math.abs(r.M), 2.5);
    return { ok, msg: ok ? '' : `Deine Schätzung: ${de(st.M)} kNm. Echt: M_A = ${de(Math.abs(r.M))} kNm.` }; },
  run(st, r, done) { st.shown = true; st.L = 3; r(); done(); },
  explain: () => { const r = beam({ L: 3, sup: kragSup, P: [{ x: 3, F: 10 }] }).R[0]; return { text: '„Doppelt so lang heißt doppeltes Moment an der Wand, darum sind lange Balkone so aufwendig.“',
    formula: `Beispiel: L = 3 m, F = 10 kN ergibt A = ${de(r.V)} kN, M<sub>A</sub> = ${de(Math.abs(r.M))} kNm.<br>M<sub>A</sub> = F·L`, pic: kragPic(3, '', true) }; },
});

// 2.5 Schnee aufs Dach (Prüffall q = 5 kN/m, L = 4 m: A = B = 10 kN)
const snowSup = [{ x: 0, t: 'fest' }, { x: 4, t: 'los' }];
LESSONS.push({ id: '2.5', ch: 2, name: 'Schnee aufs Dach', sec: 'Streckenlast',
  intro: ['Eine gleichmäßig verteilte Last q (kN/m) ersetzt man für die Auflagerkräfte durch ihre Resultierende <span class="fm">Q = q·L</span> in der Mitte der Belastungslänge.', 'Einfeldträger mit q über die ganze Länge: <span class="fm">A = B = q·L/2</span>.'],
  introPic: () => beamPic({ L: 4, sup: snowSup, q: 3, qlab: 'q', y: 130, labels: [[0, 'A'], [4, 'B']], dims: [[0, 4, 'L']], dy: 200 }).replace('</svg>', farrTo(170, 80, 0, -2, 14, '#888', 'Q = q·L') + '</svg>'),
  task: 'Schnee fällt auf einen Träger, L = 4 m, bis q = 5 kN/m. Schätze vorher, wie groß A dann wird.',
  init: () => ({ A: 4, q: 0, shown: false }),
  controls: st => slider('s_A', 'A bei q = 5 kN/m', 0, 20, 1, st.A, 'kN'),
  bind: (st, r) => onIn('s_A', v => { st.A = v; r(); }, 'kN'),
  draw(st) { const res = st.q ? beam({ L: 4, sup: snowSup, q: st.q }) : null; return beamPic({ id: 'tsvg', L: 4, sup: snowSup, q: st.q, y: 130, R: res ? res.R : [], labels: [[0, 'A'], [4, 'B']], dims: [[0, 4, 'L = 4 m']], dy: 200, k: 3 }); },
  status(st) { if (!st.shown) return `Deine Schätzung: A = ${de(st.A)} kN`; const r = beam({ L: 4, sup: snowSup, q: st.q }).R; return `q = ${de(st.q, 1)} kN/m · A = ${de(r[0].V, 1)} kN · B = ${de(r[1].V, 1)} kN`; },
  run(st, r, done) { st.shown = true; let k = 0; const step = () => { k++; st.q = Math.min(5, k * 0.25); r(); if (st.q < 5) setTimeout(step, 60); else done(); }; step(); },
  check(st) { const r = beam({ L: 4, sup: snowSup, q: 5 }).R, ok = near(st.A, r[0].V, 1); return { ok, msg: ok ? '' : `Deine Schätzung: ${de(st.A)} kN. Echt: A = ${de(r[0].V)} kN.` }; },
  explain: () => { const r = beam({ L: 4, sup: snowSup, q: 5 }).R; return { text: 'Die Streckenlast wirkt für die Auflagerkräfte wie ihre Resultierende Q = q·L in der Mitte.',
    formula: `Q = 5 kN/m · 4 m = 20 kN<br>A = B = q·L/2 = ${de(r[0].V)} kN`, pic: beamPic({ L: 4, sup: snowSup, q: 5, y: 130, R: r, k: 3 }) }; },
});

if (typeof module !== 'undefined' && module.exports) module.exports = BB;
if (typeof document === 'undefined') return;

// ---------------- Oberfläche ----------------
const $ = id => document.getElementById(id);
const KEY = 'bebenbau.lernen.v1';
let prog = { done: {} };
try { Object.assign(prog, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* leer */ }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(prog)); } catch (e) { /* voll */ } };
const root = () => $('lernen');
const click = () => { try { BB.Audio.init(); BB.Audio.click(); } catch (e) { /* ohne Ton */ } };
function onIn(id, fn, unit) { const el = $(id); if (!el) return; el.oninput = () => { const v = +el.value; $(id + 'v').textContent = `${de(v)} ${unit}`; fn(v); }; }
function head(title, back) { return `<div class="lhead"><button id="lnback" class="icon" aria-label="Zurück"><svg viewBox="0 0 24 24"><path d="M15 4 7 12l8 8" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></button><h2>${title}</h2></div>`; }
function open() { $('title').classList.add('hidden'); root().classList.remove('hidden'); list(); }
function close() { root().classList.add('hidden'); $('title').classList.remove('hidden'); }
function list() {
  const r = root();
  r.innerHTML = head('Lernen') + '<p class="lsub">Technische Mechanik ohne Materialien: nur starre Körper und Kräfte.</p>' + CHAPTERS.map(c => {
    const ls = LESSONS.filter(l => l.ch === c.nr), n = ls.filter(l => prog.done[l.id]).length;
    return `<div class="chap"><div class="chead"><span class="cnr">Kapitel ${c.nr}</span><b>${c.title}</b><span class="cprog">${n}/${ls.length}</span></div>` +
      ls.map(l => `<button class="les${prog.done[l.id] ? ' done' : ''}" data-id="${l.id}"><span class="lnr2">${l.id.replace('.', ',')}</span><span class="lnm">${l.name}<small>${l.sec}</small></span><span class="lck">${prog.done[l.id] ? '✓' : '›'}</span></button>`).join('') +
      (n === ls.length ? `<div class="note">${c.note}</div>` : '') + '</div>';
  }).join('');
  r.scrollTop = 0;
  $('lnback').onclick = () => { click(); close(); };
  r.querySelectorAll('.les').forEach(b => { b.onclick = () => { click(); intro(LESSONS.find(l => l.id === b.dataset.id)); }; });
}
function intro(l) {
  const r = root();
  r.innerHTML = head(`${l.id.replace('.', ',')} ${l.name}`) + `<div class="lcard"><p class="lsec">${l.sec}</p>${l.introPic()}${l.intro.map(p => `<p>${p}</p>`).join('')}</div><div class="btns"><button id="lgo" class="big">Los geht's</button></div>`;
  r.scrollTop = 0;
  $('lnback').onclick = () => { click(); list(); };
  $('lgo').onclick = () => { click(); task(l); };
}
function task(l) {
  const r = root(), st = l.init();
  let busy = false;
  r.innerHTML = head(`${l.id.replace('.', ',')} ${l.name}`) + `<div class="lcard"><p class="ltask">${l.task}</p><div id="lpic"></div><div id="lstat"></div><div id="lctl"></div><div id="lmsg"></div></div><div class="btns"><button id="lcheck" class="big">Prüfen</button></div>`;
  r.scrollTop = 0;
  const redraw = () => { $('lpic').innerHTML = l.draw(st); $('lstat').innerHTML = l.status ? l.status(st) : ''; if (l.after_draw) l.after_draw(st, redraw); bindDrag(); };
  const ctl = () => { $('lctl').innerHTML = l.controls ? l.controls(st) : ''; if (l.bind) l.bind(st, redraw); };
  function bindDrag() {
    if (!l.drag) return; const el = $('tsvg'); if (!el) return;
    const set = e => { const m = el.getScreenCTM(); if (!m) return; const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
      st[l.drag] = [snap((p.x - l.O[0]) / l.K), snap(-(p.y - l.O[1]) / l.K)].map(v => Math.max(-6, Math.min(6, v)));
      $('lstat').innerHTML = l.status(st); const ns = l.draw(st); el.innerHTML = ns.replace(/^<svg[^>]*>|<\/svg>$/g, ''); };
    el.style.touchAction = 'none';
    el.onpointerdown = e => { if (busy) return; el.setPointerCapture(e.pointerId); el._d = true; set(e); };
    el.onpointermove = e => { if (el._d) set(e); };
    el.onpointerup = el.onpointercancel = () => { el._d = false; };
  }
  ctl(); redraw();
  $('lnback').onclick = () => { click(); list(); };
  $('lcheck').onclick = () => {
    if (busy) return; click();
    const fin = () => {
      busy = false; const res = l.check(st);
      if (res.ok) { prog.done[l.id] = true; save(); try { BB.Audio.win && BB.Audio.win(); } catch (e) { /* */ } explainCard(l, st); }
      else { $('lmsg').innerHTML = `<div class="lbad">${res.msg}</div>`; $('lcheck').textContent = l.run ? 'Nochmal' : 'Prüfen';
        if (l.run) { $('lcheck').onclick = () => { click(); task(l); }; ctl(); } }
    };
    if (l.run && !st.shown) { busy = true; $('lctl').innerHTML = ''; l.run(st, redraw, fin); } else fin();
  };
}
function explainCard(l, st) {
  const e = l.explain(st), r = root(), ls = LESSONS.filter(x => x.ch === l.ch), last = ls[ls.length - 1] === l, nxt = LESSONS[LESSONS.indexOf(l) + 1];
  const ch = CHAPTERS.find(c => c.nr === l.ch);
  const live = $('lpic') ? $('lpic').innerHTML : '';
  r.innerHTML = head(`${l.id.replace('.', ',')} ${l.name}`) + (l.keepLive && live ? `<div class="lcard">${live}</div>` : '') +
    `<div class="lcard ex"><p class="okh">Geschafft!</p><p class="et">${e.text}</p><div class="fm fbox">${e.formula}</div>${e.pic}</div>` +
    (l.id === '2.4' ? `<div class="lcard"><p class="ltask">Probier es aus: Wie wächst das Einspannmoment mit der Länge?</p><div id="lpic">${kragPic(st.L || 3, 'tsvg', true)}</div><div id="lstat"></div>${slider('s_L', 'Balkonlänge L', 1, 4, 0.5, st.L || 3, 'm')}</div>` : '') +
    (last ? `<div class="note">${ch.note}</div>` : '') +
    `<div class="btns"><button id="lagain">Nochmal</button><button id="lnext" class="big">${last ? 'Zur Übersicht' : 'Weiter'}</button></div>`;
  r.scrollTop = 0;
  if (l.id === '2.4') { const rd = () => { $('lpic').innerHTML = kragPic(st.L, 'tsvg', true); $('lstat').innerHTML = l.status(st); }; st.L = st.L || 3; rd(); onIn('s_L', v => { st.L = v; rd(); }, 'm'); }
  $('lnback').onclick = () => { click(); list(); };
  $('lagain').onclick = () => { click(); task(l); };
  $('lnext').onclick = () => { click(); if (last || !nxt) list(); else intro(nxt); };
}
BB.Lessons = { open, close, list, intro, task, prog: () => prog, LESSONS, CHAPTERS };
const btn = $('learn'); if (btn) btn.onclick = () => { click(); open(); };
})();
