/* Bebenbau – Spielablauf, Bedienung (Touch zuerst), Bildschirme, Speicherstand */
(function () {
'use strict';
const BB = window.BB, R = BB.Render, SND = BB.Audio;
const DATA = window.LEVELDATA || { materialien: [], levels: [] };
const mats = BB.prepMaterials(DATA.materialien);
const levels = (DATA.levels || []).map((r, i) => ({ r, i })).sort((a, b) => BB.num(a.r.nr, a.i + 1) - BB.num(b.r.nr, b.i + 1)).map((o, i) => BB.prepLevel(o.r, i));
const $ = id => document.getElementById(id);
const cv = $('c'), ctx = cv.getContext('2d');
const KEY = 'bebenbau.v1';
let prog = { stars: {}, designs: {}, muted: false, unlockAll: false, seen: {} };
try { Object.assign(prog, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* leer */ }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(prog)); } catch (e) { /* voll */ } };
SND.setMuted(!!prog.muted);
const fmt = BB.fmt, kN = v => Math.round(v / 1000);
const defMat = Math.max(0, mats.findIndex(m => m.name === 'Holz'));

const S = {
  screen: 'title', lv: null, li: -1, design: null, undo: [], sel: defMat, del: false, showForces: false,
  sim: null, speed: 1, acc: 0, cam: new R.Camera(), t: 0, particles: [], debris: [], shake: 0, mood: 'idle',
  bubbles: [], highlight: null, stat: null, statView: null, resultShown: false, doneT: 0, drag: null, preview: null, seed: 1, W: 0, H: 0, dpr: 1,
};

// ---------------- Bildschirmgröße ----------------
function resize() {
  S.dpr = Math.min(3, window.devicePixelRatio || 1);
  S.W = window.innerWidth; S.H = window.innerHeight;
  cv.width = Math.round(S.W * S.dpr); cv.height = Math.round(S.H * S.dpr);
  cv.style.width = S.W + 'px'; cv.style.height = S.H + 'px';
  if (S.lv) fitCam();
}
function viewRect() {
  const top = ($('hud').classList.contains('hidden') ? 0 : $('hud').getBoundingClientRect().bottom) + 8;
  const barEl = S.screen === 'test' ? $('testbar') : $('tools');
  const bot = (barEl.classList.contains('hidden') ? S.H : barEl.getBoundingClientRect().top) - 8;
  return { x: 10, y: top, w: S.W - 20, h: Math.max(100, bot - top) };
}
function fitCam() { S.cam.fit(R.levelBounds(S.lv), viewRect()); }

// ---------------- Bildschirme ----------------
function show(id, on) { $(id).classList.toggle('hidden', !on); }
function goTitle() { S.screen = 'title'; S.lv = null; ['levels', 'hud', 'tools', 'testbar', 'modal'].forEach(i => show(i, false)); show('title', true); SND.stopLoops(); }
function unlocked(i) { if (prog.unlockAll || i === 0) return true; const prev = levels[i - 1]; return !!(prog.stars[prev.nr] > 0); }
function loadBadges(lv) {
  const b = [];
  if (lv.quake) b.push(['beben', 'Beben']);
  if (lv.wind) b.push(['sturm', 'Sturm']);
  if (lv.truck) b.push(['lkw', lv.truck.spec.name]);
  if (lv.kind === 'tower') b.push(['turm', 'Turm ' + fmt(lv.H) + ' m']);
  if (lv.walkers) b.push(['steg', 'Fußgänger']);
  return b;
}
function goLevels() {
  S.screen = 'levels'; S.lv = null; ['title', 'hud', 'tools', 'testbar', 'modal'].forEach(i => show(i, false)); show('levels', true); SND.stopLoops();
  const g = $('levelgrid'); g.innerHTML = '';
  let total = 0;
  levels.forEach((lv, i) => {
    const st = prog.stars[lv.nr] || 0; total += st;
    const ok = unlocked(i);
    const el = document.createElement('button');
    el.className = 'lvl' + (ok ? '' : ' locked') + (lv.quake ? ' quake' : '');
    el.innerHTML = `<div class="lnr">${lv.nr}</div><div class="lname">${esc(lv.name)}</div>
      <div class="badges">${loadBadges(lv).map(b => `<span class="badge ${b[0]}">${esc(b[1])}</span>`).join('')}</div>
      <div class="lstars">${ok ? stars(st) : 'gesperrt'}</div>`;
    el.onclick = () => { SND.init(); if (!ok) { toast('Schaff erst Level ' + levels[i - 1].nr + '.'); return; } SND.click(); startLevel(i); };
    g.appendChild(el);
  });
  $('startotal').textContent = `${total} / ${levels.length * 3} ★`;
  $('unlockall').textContent = prog.unlockAll ? 'Alle Level offen (Testmodus an)' : 'Alle Level freischalten (Testmodus)';
}
function stars(n) { return '<span class="st on">' + '★'.repeat(n) + '</span><span class="st off">' + '★'.repeat(3 - n) + '</span>'; }
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]); }

function freshDesign(lv) { return { nodes: lv.anchors.map(a => [a.x, a.y]), members: [] }; }
function validDesign(lv, d) {
  if (!d || !Array.isArray(d.nodes) || !Array.isArray(d.members)) return false;
  return lv.anchors.every((a, i) => d.nodes[i] && Math.abs(d.nodes[i][0] - a.x) < 1e-6 && Math.abs(d.nodes[i][1] - a.y) < 1e-6) && d.members.every(m => d.nodes[m[0]] && d.nodes[m[1]] && mats[m[2]]);
}
function startLevel(i) {
  S.li = i; S.lv = levels[i]; S.undo = []; S.del = false; S.sim = null; S.highlight = null; S.debris = []; S.particles = []; S.mood = 'idle'; S.bubbles = [];
  const saved = prog.designs[S.lv.nr];
  S.design = validDesign(S.lv, saved) ? JSON.parse(JSON.stringify(saved)) : freshDesign(S.lv);
  S.screen = 'build';
  ['title', 'levels', 'testbar', 'modal'].forEach(id => show(id, false)); show('hud', true); show('tools', true);
  buildToolbar(); changed(true); fitCam(); showIntro();
}
function loadText(lv) {
  const t = [];
  if (lv.truck) t.push(`${lv.truck.spec.name}, ${fmt(lv.truck.t)} t, ${fmt(lv.truck.kmh)} km/h${lv.truck.brake ? ', bremst mitten auf der Rampe' : ''}`);
  if (lv.walkers) t.push(`${lv.walkers.n} Bauarbeiter laufen rüber`);
  if (lv.wind) t.push(`Sturm ${Math.round(lv.wind.v * 3.6)} km/h, Böen bis ${Math.round(lv.wind.gust * 3.6)} km/h, ${fmt(lv.wind.dur)} s`);
  if (lv.quake) t.push(`Erdbeben ${fmt(lv.quake.pga)} g, ${fmt(lv.quake.f)} Hz, ${fmt(lv.quake.dur)} s`);
  if (lv.kind === 'tower') t.push(lv.payload > 0 ? `Nutzlast ${fmt(lv.payload / 1000)} t in ${fmt(lv.H)} m Höhe` : `Zielhöhe ${fmt(lv.H)} m`);
  return t;
}
function showIntro() {
  const lv = S.lv;
  const first = S.li === 0 && !prog.seen.tut;
  const tut = first || !prog.seen['k' + lv.kind] ? (lv.kind === 'tower'
    ? '<ul class="tut"><li>Bau den Turm bis zur <b>grünen Ziellinie</b>. Dort kommt die Nutzlast drauf.</li><li>Nur <b>Dreiecke</b> sind steif. Ein Viereck ohne Diagonale klappt um.</li><li>Seile halten nur Zug: Über Kreuz gespannt steifen sie gut aus.</li></ul>'
    : '<ul class="tut"><li>Zieh mit dem Finger von einem <b>roten Ankerpunkt</b> zu einem Rasterpunkt: Das wird ein Stab.</li><li>Die <b>gestrichelte Fahrbahn</b> muss durchgehend gebaut sein.</li><li>Tipp auf einen Stab, um ihm das gewählte Material zu geben. Zwei Finger zum Zoomen.</li><li>Dann <b>Test</b> drücken und zittern.</li></ul>') : '';
  const b = lv.budget;
  modal(`<div class="ihead"><span class="inr">Level ${lv.nr}</span><h2>${esc(lv.name)}</h2></div>
    <p class="idesc">${esc(lv.beschreibung)}</p>
    <div class="chips">${loadText(lv).map(x => `<span class="chip">${esc(x)}</span>`).join('')}</div>
    <p class="ibudget">Budget <b>${b} €</b> · ★★★ bis ${Math.floor(b * 0.7)} € · ★★ bis ${Math.floor(b * 0.85)} €</p>${tut}
    <div class="btns"><button class="big" id="go">Los geht's</button></div>
    <div class="btns small"><button id="reset">Neu anfangen</button><button id="tolevels">Levelauswahl</button></div>`);
  $('go').onclick = () => { SND.init(); SND.click(); prog.seen.tut = true; prog.seen['k' + lv.kind] = true; save(); show('modal', false); };
  $('reset').onclick = () => { pushUndo(); S.design = freshDesign(lv); changed(); show('modal', false); };
  $('tolevels').onclick = goLevels;
}
function modal(html) { $('card').innerHTML = html; $('card').scrollTop = 0; show('modal', true); }
let toastT = 0;
function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2400); }

// ---------------- Werkzeugleiste ----------------
function buildToolbar() {
  const row = $('mats'); row.innerHTML = '';
  mats.forEach((m, i) => {
    const b = document.createElement('button'); b.className = 'mat' + (i === S.sel ? ' sel' : '');
    b.innerHTML = `<span class="sw ${m.icon}" style="background:${m.color}"></span><span class="mn">${esc(m.name)}</span><span class="mc">${m.cost} €/m</span>`;
    b.onclick = () => { S.sel = i; S.del = false; SND.click(); buildToolbar(); updateHUD(); };
    row.appendChild(b);
  });
  const m = mats[S.sel];
  $('matinfo').innerHTML = `<b>${esc(m.name)}</b>: Zug ${kN(m.zug)} kN · Druck ${m.druck > 0 ? kN(m.druck) + ' kN' : '—'} · ${m.kgpm} kg/m${m.cable ? ' · nur Zug' : m.zug < 0.2 * m.druck ? ' · fast nur Druck' : ''}`;
  $('bdel').classList.toggle('on', S.del);
  $('bstat').classList.toggle('on', S.showForces);
}
function updateHUD() {
  const lv = S.lv; if (!lv) return;
  const cost = BB.designCost(S.design, mats);
  $('ltitle').textContent = `${lv.nr} · ${lv.name}`;
  const bp = $('budget'); bp.textContent = `${cost} / ${lv.budget} €`; bp.classList.toggle('over', cost > lv.budget);
  const pct = Math.min(100, cost / lv.budget * 100);
  $('budgetbar').style.width = pct + '%'; $('budgetbar').className = cost > lv.budget ? 'over' : cost <= lv.budget * 0.7 ? 'g3' : cost <= lv.budget * 0.85 ? 'g2' : 'g1';
  $('loadchip').textContent = loadText(lv).join(' · ');
  const w = $('warn');
  const mech = S.stat && !S.stat.ok && S.design.members.length >= 2;
  w.textContent = mech ? 'Achtung: beweglich – da fehlt eine Diagonale' : '';
  w.classList.toggle('on', !!mech && S.screen === 'build');
  $('bundo').disabled = !S.undo.length;
  $('bsound').classList.toggle('off', SND.muted); $('tsound') && $('tsound').classList.toggle('off', SND.muted);
}

// ---------------- Entwurf bearbeiten ----------------
function pushUndo() { S.undo.push(JSON.stringify(S.design)); if (S.undo.length > 100) S.undo.shift(); }
function changed(noSave) {
  if (!noSave) { prog.designs[S.lv.nr] = S.design; save(); }
  // statische Ersatzrechnung (exakter Fachwerklöser) für Kraftanzeige und Beweglichkeitswarnung
  try { S.stat = S.design.members.length ? BB.Statics.analyzeDesign(S.lv, S.design, mats) : null; } catch (e) { S.stat = null; }
  S.statView = null;
  if (S.stat && S.stat.ok) {
    S.statView = S.stat.members.map((m, k) => {
      const f = S.stat.forces[k], buck = Math.min(1, (BB.CFG.lRef / m.L) ** 2);
      const capT = m.mat.zug * BB.CFG.strength, capC = m.mat.druck * BB.CFG.strength * buck;
      return { a: m.a, b: m.b, f, ratio: f >= 0 ? (capT > 0 ? f / capT : 9) : (capC > 0 ? -f / capC : (m.mat.cable ? 0 : 9)), id: m.id };
    });
  }
  updateHUD();
}
function nodeAt(x, y) { return S.design.nodes.findIndex(p => Math.abs(p[0] - x) < 1e-6 && Math.abs(p[1] - y) < 1e-6); }
function cleanup() {
  const d = S.design, nA = S.lv.anchors.length, used = new Set();
  d.members.forEach(m => { used.add(m[0]); used.add(m[1]); });
  const map = []; const nodes = [];
  d.nodes.forEach((p, i) => { if (i < nA || used.has(i)) { map[i] = nodes.length; nodes.push(p); } });
  d.members = d.members.map(m => [map[m[0]], map[m[1]], m[2]]); d.nodes = nodes;
}
function addMember(ia, q) {
  const d = S.design, p = d.nodes[ia];
  const L = Math.hypot(q.x - p[0], q.y - p[1]);
  if (L < 1e-6) return;
  if (L > S.lv.maxLen + 1e-6) { toast(`Zu lang: maximal ${fmt(S.lv.maxLen)} m pro Stab.`); SND.remove(); return; }
  let ib = nodeAt(q.x, q.y);
  const dup = ib >= 0 ? d.members.findIndex(m => (m[0] === ia && m[1] === ib) || (m[0] === ib && m[1] === ia)) : -1;
  pushUndo();
  if (dup >= 0) { d.members[dup][2] = S.sel; }
  else {
    if (ib < 0) { d.nodes.push([q.x, q.y]); ib = d.nodes.length - 1; }
    d.members.push([ia, ib, S.sel]);
  }
  SND.place(mats[S.sel].name); changed();
}
function hitNode(px, py, r) {
  let best = -1, bd = r * r;
  S.design.nodes.forEach((p, i) => { const dx = S.cam.X(p[0]) - px, dy = S.cam.Y(p[1]) - py, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = i; } });
  return best;
}
function hitMember(px, py, r) {
  let best = -1, bd = r;
  S.design.members.forEach((m, k) => {
    const a = S.design.nodes[m[0]], b = S.design.nodes[m[1]];
    const x1 = S.cam.X(a[0]), y1 = S.cam.Y(a[1]), x2 = S.cam.X(b[0]), y2 = S.cam.Y(b[1]);
    const dx = x2 - x1, dy = y2 - y1, L2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / L2));
    const d = Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
    if (d < bd) { bd = d; best = k; }
  });
  return best;
}
function snapAt(px, py) {
  let best = null, bd = Math.max(26, S.cam.s * S.lv.grid * 0.6) ** 2;
  for (const s of S.lv.snaps) { const dx = S.cam.X(s.x) - px, dy = S.cam.Y(s.y) - py, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = s; } }
  return best;
}

// ---------------- Touch / Maus ----------------
const ptrs = new Map();
let gesture = null;
function pos(e) { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
cv.addEventListener('pointerdown', e => {
  if (!S.lv || !$('modal').classList.contains('hidden')) return;
  SND.init();
  cv.setPointerCapture(e.pointerId);
  const p = pos(e); ptrs.set(e.pointerId, p);
  if (ptrs.size === 2) {
    const [a, b] = [...ptrs.values()];
    gesture = { type: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, s0: S.cam.s, ox: S.cam.ox, oy: S.cam.oy };
    S.preview = null; return;
  }
  if (ptrs.size > 2) return;
  const g = { type: 'pan', sx: p.x, sy: p.y, ox: S.cam.ox, oy: S.cam.oy, moved: false };
  if (S.screen === 'build') {
    const ni = hitNode(p.x, p.y, 26);
    if (ni >= 0 && !S.del) { g.type = 'draw'; g.from = ni; S.preview = { from: ni, to: null }; }
    else { g.tapNode = ni; g.tapMember = ni >= 0 ? -1 : hitMember(p.x, p.y, 16); }
  }
  gesture = g;
});
cv.addEventListener('pointermove', e => {
  if (!ptrs.has(e.pointerId)) return;
  const p = pos(e); ptrs.set(e.pointerId, p);
  const g = gesture; if (!g) return;
  if (g.type === 'pinch' && ptrs.size >= 2) {
    const [a, b] = [...ptrs.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const s = Math.max(S.cam.fitS * 0.5, Math.min(Math.max(S.cam.fitS * 4, 140), g.s0 * d / g.d0));
    const wx = (g.mx - g.ox) / g.s0, wy = (g.oy - g.my) / g.s0;
    S.cam.s = s; S.cam.ox = mx - wx * s; S.cam.oy = my + wy * s;
    return;
  }
  if (Math.hypot(p.x - g.sx, p.y - g.sy) > 8) g.moved = true;
  if (g.type === 'draw') { S.preview.to = snapAt(p.x, p.y); S.preview.px = p; }
  else if (g.type === 'pan' && g.moved) { S.cam.ox = g.ox + p.x - g.sx; S.cam.oy = g.oy + p.y - g.sy; }
});
function endPtr(e) {
  if (!ptrs.has(e.pointerId)) return;
  ptrs.delete(e.pointerId);
  const g = gesture; if (!g) return;
  if (g.type === 'pinch') { if (ptrs.size === 0) gesture = null; return; }
  gesture = null;
  if (g.type === 'draw') {
    const to = S.preview && S.preview.to; S.preview = null;
    if (to && g.moved) addMember(g.from, to);
    return;
  }
  if (S.screen !== 'build' || g.moved) return;
  if (g.tapNode >= S.lv.anchors.length && S.del) {
    pushUndo(); S.design.members = S.design.members.filter(m => m[0] !== g.tapNode && m[1] !== g.tapNode); cleanup(); SND.remove(); changed();
  } else if (g.tapMember >= 0) {
    pushUndo();
    if (S.del) { S.design.members.splice(g.tapMember, 1); cleanup(); SND.remove(); }
    else { S.design.members[g.tapMember][2] = S.sel; SND.place(mats[S.sel].name); }
    changed();
  }
}
cv.addEventListener('pointerup', endPtr); cv.addEventListener('pointercancel', endPtr);
cv.addEventListener('wheel', e => { if (!S.lv) return; e.preventDefault(); const p = pos(e); const k = Math.exp(-e.deltaY * 0.0015); const s = Math.max(S.cam.fitS * 0.5, Math.min(Math.max(S.cam.fitS * 4, 140), S.cam.s * k)); const wx = (p.x - S.cam.ox) / S.cam.s, wy = (S.cam.oy - p.y) / S.cam.s; S.cam.s = s; S.cam.ox = p.x - wx * s; S.cam.oy = p.y + wy * s; }, { passive: false });
document.addEventListener('gesturestart', e => e.preventDefault());

// ---------------- Test ----------------
function startTest(sameSeed) {
  const err = BB.validate(S.lv, S.design);
  if (err) { toast(err); SND.remove(); return; }
  SND.init();
  if (!sameSeed) S.seed = 1 + Math.floor(Math.random() * 9999);
  S.sim = new BB.Sim(S.lv, S.design, mats, { seed: S.seed });
  S.screen = 'test'; S.acc = 0; S.doneT = 0; S.resultShown = false; S.highlight = null; S.debris = []; S.particles = []; S.mood = 'watch'; S.bubbles = [];
  show('tools', false); show('testbar', true); show('modal', false); $('warn').classList.remove('on');
  $('bspeed').textContent = '×' + S.speed;
  $('tforces').classList.toggle('on', S.showForces);
  fitCam();
  if (S.lv.quake) say(S.lv.quake.pga >= 0.3 ? 'Festhalten, das wird heftig!' : 'Gleich wackelt es …', 0.6);
  else if (S.lv.wind) say('Helm festhalten!', 0.6);
  else say('Na dann, Gas geben!', 0.3);
  SND.click();
}
function backToBuild() {
  S.screen = 'build'; S.sim = null; S.highlight = null; S.mood = 'idle'; S.debris = []; S.particles = [];
  show('testbar', false); show('tools', true); show('modal', false); SND.stopLoops(); updateHUD(); fitCam();
}
function say(text, delay) { S.bubbles = S.bubbles.filter(b => b.t0 > S.t + (delay || 0)); S.bubbles.push({ text, t0: S.t + (delay || 0), dur: 2.2 }); }
function stepSim() {
  const sim = S.sim;
  if (sim.done) { S.doneT += 1 / 60; if (S.doneT > 4) return; }
  const fallenBefore = sim.vehicles.filter(v => v.state === 'fall').length;
  const ev = sim.step();
  for (const e of ev) if (e.type === 'break') onBreak(e);
  if (sim.vehicles.filter(v => v.state === 'fall').length > fallenBefore) { SND.thud(); vib([60, 40, 60]); S.shake += 6; S.mood = 'panic'; say(sim.vehicles.some(v => v.state === 'fall' && v.kind === 'worker') ? 'Kollege, halt dich fest!' : 'Ach du Schande!'); }
  if (sim.done && !S.resultShown && S.doneT > (sim.result.win ? 0.6 : 1.4)) showResult();
}
function vib(p) { try { if (!SND.muted && navigator.vibrate) navigator.vibrate(p); } catch (e) { /* nicht unterstützt */ } }
function onBreak(e) {
  const heavy = /beton|mauer|stahlprofil/i.test(e.mat.name);
  SND.crack(heavy); vib(25); S.shake = Math.min(14, S.shake + (heavy ? 6 : 3));
  if (S.mood !== 'panic') { S.mood = 'panic'; say(['Da kracht was!', 'Oha!', 'Wer hat das gerechnet?!'][Math.floor(Math.random() * 3)]); }
  const mx = (e.ax + e.bx) / 2, my = (e.ay + e.by) / 2;
  for (const half of [[e.ax, e.ay, mx, my], [mx, my, e.bx, e.by]]) {
    const cx = (half[0] + half[2]) / 2, cy = (half[1] + half[3]) / 2;
    S.debris.push({ x: cx, y: cy, len: Math.hypot(half[2] - half[0], half[3] - half[1]), ang: Math.atan2(half[3] - half[1], half[2] - half[0]),
      vx: e.vx * 0.5 + (Math.random() - 0.5) * 3, vy: e.vy * 0.5 + Math.random() * 3, va: (Math.random() - 0.5) * 6, mat: e.mat, life: 6 });
  }
  for (let k = 0; k < 14; k++) S.particles.push({ x: mx, y: my, vx: (Math.random() - 0.5) * 6, vy: Math.random() * 5, life: 0.6 + Math.random() * 0.6, c: e.mat.color, r: 1 + Math.random() * 3 });
}
function showResult() {
  S.resultShown = true;
  const sim = S.sim, lv = S.lv, res = sim.result;
  const cost = BB.designCost(S.design, mats), over = cost > lv.budget;
  const st = res.win && !over ? BB.stars(cost, lv.budget) : 0;
  if (st > (prog.stars[lv.nr] || 0)) { prog.stars[lv.nr] = st; save(); }
  S.mood = res.win ? 'cheer' : 'panic';
  if (res.win) { SND.win(); say(over ? 'Hält, aber der Chef flucht über die Rechnung.' : ['Hält!', 'Statik passt!', 'Feierabend!', 'Läuft, Chef!'][Math.floor(Math.random() * 4)]); vib(40); }
  else { SND.fail(); vib([100, 50, 100]); }
  SND.stopLoops();
  const ex = BB.Explain.explain(sim, S.stat);
  S.highlight = ex.memberId;
  const next = S.li + 1 < levels.length ? S.li + 1 : -1;
  const head = res.win ? (over ? 'Hält – aber zu teuer!' : 'Hält!') : 'Eingestürzt!';
  const sub = res.win ? (over ? `Kosten ${cost} €, Budget ${lv.budget} €. Spar noch ${cost - lv.budget} € ein.` : `Kosten ${cost} von ${lv.budget} €`) : esc(res.reason || 'Das Bauwerk hat nicht gehalten.');
  modal(`<div class="rhead ${res.win ? 'win' : 'fail'}"><h2>${head}</h2>${res.win && !over ? `<div class="bigstars">${stars(st)}</div>` : ''}<p>${sub}</p></div>
    <div class="explain">${ex.memberId ? `<span class="hl">Stab ${ex.memberId}</span> ` : ''}<p class="et">${esc(ex.title || '')}</p>${ex.lines.map(l => `<p>${esc(l)}</p>`).join('')}</div>
    <label class="tog"><input type="checkbox" id="cforces" ${S.showForces ? 'checked' : ''}> Kräfte und Auflagerkräfte anzeigen</label>
    <div class="btns">${res.win && !over && next >= 0 ? '<button class="big" id="rnext">Weiter</button>' : ''}<button class="${res.win && !over ? '' : 'big'}" id="rbuild">${res.win ? 'Verbessern' : 'Nachbessern'}</button></div>
    <div class="btns small"><button id="rreplay">Nochmal ansehen</button><button id="rlevels">Levelauswahl</button></div>`);
  $('card').classList.add('bottom');
  requestAnimationFrame(() => { // Kamera so setzen, dass das Bauwerk über der Karte sichtbar bleibt
    const top = $('hud').getBoundingClientRect().bottom + 6, bot = $('card').getBoundingClientRect().top - 6;
    if (bot - top > 90) S.cam.fit(R.levelBounds(lv), { x: 10, y: top, w: S.W - 20, h: bot - top });
  });
  $('cforces').onchange = e => { S.showForces = e.target.checked; $('tforces').classList.toggle('on', S.showForces); };
  if ($('rnext')) $('rnext').onclick = () => { $('card').classList.remove('bottom'); startLevel(next); };
  $('rbuild').onclick = () => { $('card').classList.remove('bottom'); backToBuild(); };
  $('rreplay').onclick = () => { $('card').classList.remove('bottom'); startTest(true); };
  $('rlevels').onclick = () => { $('card').classList.remove('bottom'); goLevels(); };
}

// ---------------- Zeichnen ----------------
function updateFx(dt) {
  for (const d of S.debris) {
    d.vy -= 9.81 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.ang += d.va * dt; d.life -= dt;
    const gy = BB.groundAt(S.lv, d.x) + 0.1;
    if (d.y < gy) { d.y = gy; d.vy *= -0.3; d.vx *= 0.6; d.va *= 0.5; }
  }
  S.debris = S.debris.filter(d => d.life > 0);
  for (const p of S.particles) { p.vy -= 6 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
  S.particles = S.particles.filter(p => p.life > 0);
  S.shake *= Math.pow(0.02, dt);
  S.bubbles = S.bubbles.filter(b => S.t < b.t0 + b.dur);
}
function bystanders() {
  const lv = S.lv;
  if (lv.kind === 'tower') return [[lv.bx0 - 1.2, 0], [lv.bx0 - 2.3, 0]];
  return [[lv.roadB.x + 1.2, lv.roadB.y], [lv.roadB.x + 2.2, lv.roadB.y]];
}
function draw() {
  const W = S.W, H = S.H;
  ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
  if (!S.lv) return drawTitle(W, H);
  const lv = S.lv, sim = S.screen === 'test' ? S.sim : null, cam = S.cam;
  const storm = sim ? Math.min(1, sim.windNow / 35) : (lv.wind ? 0.25 : 0);
  R.sky(ctx, W, H, S.t, storm);
  // Erschütterung
  const qa = sim ? sim.quakeAcc : 0;
  const qs = sim && lv.quake ? Math.min(12, Math.abs(qa) * 1.6) : 0;
  cam.shx = (Math.random() - 0.5) * S.shake + Math.sin(S.t * 2 * Math.PI * (lv.quake ? lv.quake.f : 1)) * qs;
  cam.shy = (Math.random() - 0.5) * S.shake * 0.6 + (Math.random() - 0.5) * qs * 0.3;
  const groundY = cam.Y(lv.kind === 'tower' ? 0 : lv.roadA.y);
  R.skyline(ctx, W, groundY + 2);
  R.crane(ctx, Math.min(W - 60, cam.X(lv.bx1 + 2.5)), groundY, Math.min(groundY - 120, 260), S.t, 0.9);
  R.terrain(ctx, cam, lv, W, H, S.t);
  // Raster, Fahrbahn, Ziel
  if (S.screen === 'build') {
    ctx.fillStyle = 'rgba(30,40,60,0.28)';
    const rr = Math.max(1.2, Math.min(2.5, cam.s * 0.05));
    for (const s of lv.snaps) { ctx.beginPath(); ctx.arc(cam.X(s.x), cam.Y(s.y), s.road ? rr * 1.6 : rr, 0, 6.283); ctx.fill(); }
  }
  if (lv.roadA && (S.screen === 'build')) {
    ctx.setLineDash([8, 6]); ctx.strokeStyle = 'rgba(40,40,40,0.55)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cam.X(lv.roadA.x), cam.Y(lv.roadA.y)); ctx.lineTo(cam.X(lv.roadB.x), cam.Y(lv.roadB.y)); ctx.stroke(); ctx.setLineDash([]);
  }
  if (lv.kind === 'tower') {
    ctx.setLineDash([10, 6]); ctx.strokeStyle = 'rgba(30,160,70,0.9)'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(cam.X(lv.bx0 - 1), cam.Y(lv.H)); ctx.lineTo(cam.X(lv.bx1 + 1), cam.Y(lv.H)); ctx.stroke(); ctx.setLineDash([]);
    R.pill(ctx, cam.X(lv.bx0 - 1) + 30, cam.Y(lv.H) - 12, `Ziel ${fmt(lv.H)} m`, 'rgba(30,160,70,0.95)', '#fff', 11);
  }
  // Bauwerk
  let P;
  if (sim) {
    P = i => [sim.nodes[i].x, sim.nodes[i].y];
    for (const m of sim.members) if (!m.broken) R.drawMember(ctx, cam, P(m.a), P(m.b), m.mat, { stress: m.ratio, highlight: S.highlight === m.id, t: S.t });
    const hl = S.highlight && sim.members.find(m => m.id === S.highlight && m.broken);
    if (hl) { // gebrochenen Stab als Geisterlinie markieren
      ctx.setLineDash([6, 5]); R.drawMember(ctx, cam, P(hl.a), P(hl.b), hl.mat, { ghost: true, highlight: true, t: S.t }); ctx.setLineDash([]);
    }
  } else {
    const d = S.design; P = i => d.nodes[i];
    const sv = S.showForces && S.statView;
    d.members.forEach((m, k) => R.drawMember(ctx, cam, d.nodes[m[0]], d.nodes[m[1]], mats[m[2]], { stress: sv ? sv[k] && sv[k].ratio : null, highlight: S.highlight === k + 1, t: S.t }));
    if (S.preview && S.preview.to) {
      const a = d.nodes[S.preview.from], b = S.preview.to, L = Math.hypot(b.x - a[0], b.y - a[1]), ok = L <= lv.maxLen + 1e-6;
      ctx.globalAlpha = 0.75; R.drawMember(ctx, cam, a, [b.x, b.y], mats[S.sel], {}); ctx.globalAlpha = 1;
      ctx.strokeStyle = ok ? '#1b7f3b' : '#d00'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(cam.X(b.x), cam.Y(b.y), 12, 0, 6.283); ctx.stroke();
      R.pill(ctx, cam.X(b.x), cam.Y(b.y) - 26, `${fmt(L)} m · ${Math.round(L * mats[S.sel].cost)} €${ok ? '' : ' · zu lang'}`, ok ? 'rgba(20,20,20,0.8)' : '#d00', '#fff', 12);
    }
  }
  // Knoten
  const nn = sim ? sim.nodes.length : S.design.nodes.length, nA = lv.anchors.length;
  for (let i = 0; i < nn; i++) {
    if (sim && i >= nA && sim.nodes[i].deg <= 0) continue;
    const p = P(i); R.drawJoint(ctx, cam, p[0], p[1], i < nA);
  }
  if (S.preview && S.preview.from >= 0 && !sim) { const p = S.design.nodes[S.preview.from]; ctx.strokeStyle = '#ffb703'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cam.X(p[0]), cam.Y(p[1]), 14, 0, 6.283); ctx.stroke(); }
  // Nutzlast
  if (lv.kind === 'tower') {
    const idx = sim ? sim.payloadNodes : BB.payloadNodeIdx(lv, S.design).filter(i => i < nA || S.design.members.some(m => m[0] === i || m[1] === i));
    R.payload(ctx, cam, idx.map(P), lv.payload, S.t);
  }
  // Fahrzeuge
  if (sim) for (const v of sim.vehicles) R.vehicle(ctx, cam, v, S.t);
  else if (lv.truck) R.vehicle(ctx, cam, { kind: lv.truck.spec.kind, length: lv.truck.spec.length, axles: lv.truck.spec.axles, s: lv.roadA.x - lv.truck.spec.length - 1.5, ys: lv.truck.spec.axles.map(() => lv.roadA.y), state: 'wait', rot: 0, y: lv.roadA.y }, 0);
  // Zuschauer
  const by = bystanders();
  by.forEach((b, k) => R.worker(ctx, cam.X(b[0]), cam.Y(b[1]), Math.max(9, Math.min(24, cam.s * 0.9)), S.mood, S.t, k * 1.7));
  // Trümmer & Staub
  for (const d of S.debris) {
    ctx.save(); ctx.globalAlpha = Math.min(1, d.life); ctx.translate(cam.X(d.x), cam.Y(d.y)); ctx.rotate(-d.ang);
    ctx.strokeStyle = d.mat.color; ctx.lineWidth = Math.max(2, Math.min(12, d.mat.width * cam.s)); ctx.lineCap = 'butt';
    ctx.beginPath(); ctx.moveTo(-d.len / 2 * cam.s, 0); ctx.lineTo(d.len / 2 * cam.s, 0); ctx.stroke(); ctx.restore();
  }
  for (const p of S.particles) { ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 2)); ctx.fillStyle = p.c; ctx.fillRect(cam.X(p.x), cam.Y(p.y), p.r, p.r); }
  ctx.globalAlpha = 1;
  // Kräfte
  if (S.showForces) {
    if (sim) R.forceOverlay(ctx, cam, P, sim.members, sim.reactions, sim.nodes.map(n => ({ x: n.x, y: n.y })));
    else if (S.statView) R.forceOverlay(ctx, cam, P, S.statView, S.stat.reactions, lv.anchors);
  }
  // Wind/Regen
  if (storm > 0.15) {
    ctx.strokeStyle = `rgba(255,255,255,${0.25 + storm * 0.3})`; ctx.lineWidth = 1;
    const n = Math.floor(30 + storm * 60);
    ctx.beginPath();
    for (let i = 0; i < n; i++) { const x = ((i * 89 + S.t * (300 + storm * 900)) % (W + 100)) - 50, y = (i * 53 + S.t * 220) % H; ctx.moveTo(x, y); ctx.lineTo(x + 18 + storm * 30, y + 6); }
    ctx.stroke();
  }
  // Sprechblasen
  const b0 = by[0];
  const vis = S.bubbles.filter(b => S.t >= b.t0).slice(-1);
  for (const b of vis) R.bubble(ctx, cam.X(b0[0]), cam.Y(b0[1]) - Math.max(9, Math.min(24, cam.s * 0.9)) * 2.1, b.text);
  // Test-Status
  if (sim) updateTestbar(sim);
}
function updateTestbar(sim) {
  const lv = S.lv; let txt = '';
  const tt = sim.t - BB.CFG.loadStart;
  if (lv.quake && tt > 0 && tt < lv.quake.dur) txt = `Beben ${fmt(Math.abs(sim.quakeAcc / 9.81))} g · noch ${Math.ceil(lv.quake.dur - tt)} s`;
  else if (lv.wind && tt > 0 && tt < lv.wind.dur) txt = `Wind ${Math.round(sim.windNow * 3.6)} km/h · noch ${Math.ceil(lv.wind.dur - tt)} s`;
  else if (sim.vehicles.some(v => v.state === 'drive')) txt = sim.vehicles[0].kind === 'worker' ? 'Bauarbeiter unterwegs' : `${sim.vehicles[0].name} fährt`;
  if (sim.done) txt = sim.result.win ? 'Geschafft!' : 'Eingestürzt';
  if (sim.brokenCount && !sim.done) txt += ` · ${sim.brokenCount} ${sim.brokenCount > 1 ? 'Stäbe' : 'Stab'} gebrochen`;
  $('tstatus').textContent = txt;
  // Geräusche
  if (!sim.done) {
    SND.rumble(lv.quake ? Math.min(1, Math.abs(sim.quakeEnv) * lv.quake.pga * 2.2) : 0);
    SND.wind(lv.wind ? Math.min(1, sim.windNow / 45) : 0);
    const drv = sim.vehicles.find(v => v.state === 'drive' && v.kind !== 'worker');
    SND.engine(drv ? 1 : 0, drv ? drv.v : 0);
  }
}
// Titelbild
function drawTitle(W, H) {
  R.sky(ctx, W, H, S.t, 0);
  const gy = H * 0.78;
  R.skyline(ctx, W, gy);
  R.crane(ctx, W * 0.72, gy, H * 0.45, S.t, 1);
  ctx.fillStyle = '#8a6844'; ctx.fillRect(0, gy, W, H - gy); ctx.fillStyle = '#5c9e3c'; ctx.fillRect(0, gy, W, 6);
  // wackelndes Fachwerkhaus
  const cam = { X: x => W * 0.3 + x * 26 + Math.sin(S.t * 9) * 3 * Math.max(0, Math.sin(S.t * 0.8)), Y: y => gy - y * 26, s: 26 };
  const sway = Math.sin(S.t * 6) * 0.25 * Math.max(0, Math.sin(S.t * 0.8));
  const n = (x, y) => [x + sway * y / 6, y];
  const mt = mats.length ? mats : [{ color: '#b4783a', dark: '#7a4a1e', width: 0.22, icon: 'holz' }];
  const m0 = mt[0], m1 = mt[Math.min(1, mt.length - 1)];
  for (let k = 0; k < 3; k++) {
    R.drawMember(ctx, cam, n(-2, k * 2), n(-2, k * 2 + 2), m0, {}); R.drawMember(ctx, cam, n(2, k * 2), n(2, k * 2 + 2), m0, {});
    R.drawMember(ctx, cam, n(-2, k * 2 + 2), n(2, k * 2 + 2), m0, {});
    R.drawMember(ctx, cam, n(-2, k * 2), n(2, k * 2 + 2), m1, {}); R.drawMember(ctx, cam, n(2, k * 2), n(-2, k * 2 + 2), m1, {});
  }
  ctx.fillStyle = '#2a7d8c'; const tp = n(0, 6); ctx.fillRect(cam.X(tp[0]) - 60, cam.Y(6) - 34, 120, 34);
  R.worker(ctx, W * 0.12, gy, 22, Math.sin(S.t * 0.8) > 0.3 ? 'panic' : 'cheer', S.t, 0);
  R.worker(ctx, W * 0.55, gy, 22, 'watch', S.t, 2);
  R.worker(ctx, W * 0.9, gy, 20, Math.sin(S.t * 0.8) > 0.3 ? 'panic' : 'idle', S.t, 4);
}
let last = performance.now();
function frame(ts) {
  const dt = Math.min(0.05, Math.max(0, (ts - last) / 1000)); last = ts; S.t += dt;
  if (S.screen === 'test' && S.sim) {
    S.acc += dt * S.speed; let n = 0;
    while (S.acc >= BB.CFG.dt && n < 8) { stepSim(); S.acc -= BB.CFG.dt; n++; }
    if (n >= 8) S.acc = 0;
  }
  if (S.lv) updateFx(dt);
  draw();
  requestAnimationFrame(frame);
}

// ---------------- Knöpfe ----------------
function soundToggle() { SND.init(); prog.muted = !SND.muted; SND.setMuted(prog.muted); save(); updateHUD(); $('titlesound').textContent = prog.muted ? 'Ton aus' : 'Ton an'; if (!prog.muted) SND.click(); }
$('play').onclick = () => { SND.init(); SND.click(); goLevels(); };
$('titlesound').onclick = soundToggle; $('titlesound').textContent = prog.muted ? 'Ton aus' : 'Ton an';
$('lback').onclick = goTitle;
$('unlockall').onclick = () => { prog.unlockAll = !prog.unlockAll; save(); goLevels(); };
$('bback').onclick = () => { if (S.screen === 'test') backToBuild(); goLevels(); };
$('bsound').onclick = soundToggle;
$('binfo').onclick = showIntro;
$('bundo').onclick = () => { if (!S.undo.length) return; S.design = JSON.parse(S.undo.pop()); SND.remove(); changed(); };
$('bdel').onclick = () => { S.del = !S.del; SND.click(); buildToolbar(); if (S.del) toast('Löschen: Tipp auf einen Stab oder Knoten.'); };
$('bstat').onclick = () => { S.showForces = !S.showForces; SND.click(); buildToolbar(); if (S.showForces) toast(S.stat && S.stat.ok ? 'Statik: Stabkräfte in kN (+ Zug, − Druck), grüne Pfeile = Auflagerkräfte' : 'Statik geht erst, wenn das Bauwerk unbeweglich ist.'); };
$('bfit').onclick = () => { fitCam(); SND.click(); };
$('btest').onclick = () => startTest(false);
$('bstop').onclick = backToBuild;
$('bspeed').onclick = () => { S.speed = S.speed === 1 ? 3 : 1; $('bspeed').textContent = '×' + S.speed; SND.click(); };
$('tforces').onclick = () => { S.showForces = !S.showForces; $('tforces').classList.toggle('on', S.showForces); };
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));
document.addEventListener('visibilitychange', () => { if (document.hidden) SND.stopLoops(); });
resize(); requestAnimationFrame(frame);
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});

// Testschnittstelle (für automatische Tests)
window.__bb = { S, levels, mats, startLevel, startTest, backToBuild, goLevels, goTitle, stepSim, showResult, changed,
  setDesign(d) { S.design = JSON.parse(JSON.stringify(d)); changed(); }, fitCam };
})();
