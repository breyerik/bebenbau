// QA-Prüffälle für den statischen Löser (Toleranz 0,1 %).  node tests/statik_qa.test.js [ausgabe.md]
const BB = (require('../src/core.js'), require('../src/levels.js'), require('../src/statics.js'));
const { solve, MECH_MSG } = BB.Statics;
const rows = []; let fails = 0;
const kN = v => v / 1000;
function check(fall, groesse, soll, ist, einheit) {
  const ok = Math.abs(ist - soll) <= Math.max(1e-9, Math.abs(soll) * 0.001);
  if (!ok) fails++;
  rows.push({ fall, groesse, soll: soll.toFixed(3) + ' ' + einheit, ist: (Math.abs(ist) < 5e-10 ? 0 : ist).toFixed(3) + ' ' + einheit, ok });
}
function checkText(fall, groesse, soll, ist) { const ok = soll === ist; if (!ok) fails++; rows.push({ fall, groesse, soll, ist, ok }); }
const EA = 2.1e9, EI = 8.4e6;          // Stahlträger, Größenordnung HEB 200 (E·A ≈ 2,1e9 N, E·I ≈ 8,4e6 N·m²)
const beam = (a, b) => ({ a, b, EA, EI, type: 'beam' });
const bar = (a, b) => ({ a, b, EA, type: 'bar' });
// 1) Einfeldträger L = 4 m, F = 10 kN in Feldmitte (Balken auf Fest- und Rollenlager)
{
  const F = 10000, L = 4;
  const r = solve({ nodes: [[0, 0], [L / 2, 0], [L, 0]], members: [beam(0, 1), beam(1, 2)],
    supports: [{ node: 0, x: true, y: true }, { node: 2, y: true }], loads: [{ node: 1, fy: -F }] });
  check('1 Einfeldträger, F mittig', 'Auflager A = F/2', kN(F / 2), kN(r.reactions[0].ry), 'kN');
  check('1 Einfeldträger, F mittig', 'Auflager B = F/2', kN(F / 2), kN(r.reactions[1].ry), 'kN');
  check('1 Einfeldträger, F mittig', 'Feldmoment = F·L/4', kN(F * L / 4), kN(r.ends[0].M2), 'kNm');
  check('1 Einfeldträger, F mittig', 'Durchbiegung = F·L³/(48·EI)', F * L ** 3 / (48 * EI) * 1000, -r.u[3 * 1 + 1] * 1000, 'mm');
}
// 2) L = 6 m, F = 30 kN bei a = 2 m
{
  const F = 30000;
  const r = solve({ nodes: [[0, 0], [2, 0], [6, 0]], members: [beam(0, 1), beam(1, 2)],
    supports: [{ node: 0, x: true, y: true }, { node: 2, y: true }], loads: [{ node: 1, fy: -F }] });
  check('2 Einfeldträger, F bei a = 2 m', 'Auflager A = F·b/L', 20, kN(r.reactions[0].ry), 'kN');
  check('2 Einfeldträger, F bei a = 2 m', 'Auflager B = F·a/L', 10, kN(r.reactions[1].ry), 'kN');
  check('2 Einfeldträger, F bei a = 2 m', 'Moment unter Last = F·a·b/L', 40, kN(r.ends[0].M2), 'kNm');
}
// 3) Gleichseitiges Dreieck (Seite 4 m), F = 100 kN an der Spitze, Fest- + Rollenlager
{
  const F = 100000, s = 4, h = s * Math.sqrt(3) / 2;
  const r = solve({ nodes: [[0, 0], [s, 0], [s / 2, h]], members: [bar(0, 1), bar(0, 2), bar(1, 2)],
    supports: [{ node: 0, x: true, y: true }, { node: 1, y: true }], loads: [{ node: 2, fy: -F }] });
  check('3 Dreiecksfachwerk', 'Auflager A = F/2', 50, kN(r.reactions[0].ry), 'kN');
  check('3 Dreiecksfachwerk', 'Auflager B = F/2', 50, kN(r.reactions[1].ry), 'kN');
  check('3 Dreiecksfachwerk', 'Diagonale links = −F/√3 (Druck)', -100 / Math.sqrt(3), kN(r.forces[1]), 'kN');
  check('3 Dreiecksfachwerk', 'Diagonale rechts = −F/√3 (Druck)', -100 / Math.sqrt(3), kN(r.forces[2]), 'kN');
  check('3 Dreiecksfachwerk', 'Untergurt = +F/(2√3) (Zug)', 100 / (2 * Math.sqrt(3)), kN(r.forces[0]), 'kN');
}
// 4) Kragarm L = 3 m, Einspannung links, F = 10 kN am freien Ende
{
  const F = 10000, L = 3;
  const r = solve({ nodes: [[0, 0], [L, 0]], members: [beam(0, 1)], supports: [{ node: 0, x: true, y: true, r: true }], loads: [{ node: 1, fy: -F }] });
  check('4 Kragarm, Einspannung', 'Auflagerkraft vertikal = F', 10, kN(r.reactions[0].ry), 'kN');
  check('4 Kragarm, Einspannung', 'Einspannmoment = F·L', 30, kN(r.reactions[0].m), 'kNm');
  check('4 Kragarm, Einspannung', 'Auflagerkraft horizontal', 0, kN(r.reactions[0].rx), 'kN');
  check('4 Kragarm, Einspannung', 'Endverschiebung = F·L³/(3·EI)', F * L ** 3 / (3 * EI) * 1000, -r.u[4] * 1000, 'mm');
}
// 5) Kinematische Systeme
{
  const r1 = solve({ nodes: [[0, 0], [3, 0], [0, 3], [3, 3]], members: [bar(0, 2), bar(1, 3), bar(2, 3)],
    supports: [{ node: 0, x: true, y: true }, { node: 1, x: true, y: true }], loads: [{ node: 2, fx: 1000 }] });
  checkText('5 Rechteck ohne Diagonale', 'Ergebnis', MECH_MSG, r1.ok ? 'Zahlen geliefert: ' + r1.forces.map(f => kN(f).toFixed(1)).join('/') : r1.message);
  const r2 = solve({ nodes: [[0, 0], [2, 0], [4, 0]], members: [beam(0, 1), beam(1, 2)],
    supports: [{ node: 0, y: true }, { node: 2, y: true }], loads: [{ node: 1, fy: -10000 }] });
  checkText('5 Balken auf zwei Rollenlagern', 'Ergebnis', MECH_MSG, r2.ok ? 'Zahlen geliefert' : r2.message);
  checkText('5 Spiel-Hinweis', 'Meldung enthält „Diagonale“', 'ja', /Diagonale/.test(r1.hint || '') ? 'ja' : 'nein');
  // Gegenprobe: dasselbe Rechteck mit Diagonale ist stabil
  const r3 = solve({ nodes: [[0, 0], [3, 0], [0, 3], [3, 3]], members: [bar(0, 2), bar(1, 3), bar(2, 3), bar(0, 3)],
    supports: [{ node: 0, x: true, y: true }, { node: 1, x: true, y: true }], loads: [{ node: 2, fx: 1000 }] });
  checkText('5 Gegenprobe: Rechteck mit Diagonale', 'Ergebnis', 'stabil', r3.ok ? 'stabil' : r3.message);
  if (r3.ok) check('5 Gegenprobe: Rechteck mit Diagonale', 'Diagonale = +1 kN·√2 (Zug)', Math.SQRT2, kN(r3.forces[3]), 'kN');
}
const pass = rows.filter(r => r.ok).length;
const md = ['# Statik-Prüfung – Bebenbau', '',
  `Erstellt: ${new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })} (Berlin) · Löser: \`src/statics.js\` (Weggrößenverfahren, Stab- und Balkenelemente) · Toleranz 0,1 %`, '',
  '| Fall | Größe | Soll | Berechnet | Ergebnis |', '|---|---|---|---|---|',
  ...rows.map(r => `| ${r.fall} | ${r.groesse} | ${r.soll} | ${r.ist} | ${r.ok ? '✅ bestanden' : '❌ nicht bestanden'} |`), '',
  `**${pass} von ${rows.length} Prüfungen bestanden.**`, '',
  'Vorzeichen: Stabkräfte Zug +, Druck −. Auflagerkräfte nach oben +, Einspannmoment gegen den Uhrzeigersinn +, Feldmoment als Biegemoment (Unterseite gezogen +).',
  'Balken: EA = 2,1·10⁹ N, EI = 8,4·10⁶ N·m² (Durchbiegungen nur als Zusatzprobe).', ''].join('\n');
const outFile = process.argv[2];
if (outFile) require('fs').writeFileSync(outFile, md);
console.log(md);
process.exit(fails ? 1 : 0);
