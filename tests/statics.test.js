// Handrechen-Vergleich für den statischen Fachwerklöser:  node tests/statics.test.js
const BB = (require('../src/core.js'), require('../src/levels.js'), require('../src/statics.js'));
const { solve } = BB.Statics;
let fails = 0, n = 0;
function near(name, got, want) {
  n++;
  const ok = Math.abs(got - want) <= Math.max(1e-6, Math.abs(want) * 0.001);
  if (!ok) fails++;
  console.log(`${ok ? 'OK  ' : 'FEHL'} ${name.padEnd(46)} soll ${want.toFixed(4).padStart(10)}  ist ${got.toFixed(4).padStart(10)}`);
}
const EA = 2e8;
const M = (a, b) => ({ a, b, EA });
// 1) Einfeldträger als Fachwerk, Einzellast in Feldmitte: A(0,0) Festlager, B(4,0) Rollenlager, C(2,0), D(2,1), P = 10 kN an C
{
  console.log('\n1) Einfeldträger-Fachwerk, P = 10 kN in Feldmitte');
  const r = solve({ nodes: [[0, 0], [4, 0], [2, 0], [2, 1]], members: [M(0, 2), M(2, 1), M(0, 3), M(3, 1), M(2, 3)],
    supports: [{ node: 0, x: true, y: true }, { node: 1, y: true }], loads: [{ node: 2, fy: -10000 }] });
  near('Auflager A vertikal [N]', r.reactions[0].ry, 5000);
  near('Auflager B vertikal [N]', r.reactions[1].ry, 5000);
  near('Auflager A horizontal [N]', r.reactions[0].rx, 0);
  near('Untergurt A–C (Zug, P·L/(4h)) [N]', r.forces[0], 10000);
  near('Untergurt C–B [N]', r.forces[1], 10000);
  near('Strebe A–D (Druck, −5·√5 kN) [N]', r.forces[2], -5000 * Math.sqrt(5));
  near('Strebe D–B [N]', r.forces[3], -5000 * Math.sqrt(5));
  near('Pfosten C–D (Zug = P) [N]', r.forces[4], 10000);
}
// 2) Außermittige Last: 4 Felder à 1 m, Höhe 1 m, P = 12 kN am Knoten x = 1
{
  console.log('\n2) Fachwerkträger 4 m, P = 12 kN außermittig bei x = 1 m');
  const nodes = [[0, 0], [4, 0], [1, 0], [2, 0], [3, 0], [1, 1], [2, 1], [3, 1]];
  const members = [M(0, 2), M(2, 3), M(3, 4), M(4, 1), M(5, 6), M(6, 7), M(0, 5), M(7, 1), M(2, 5), M(3, 6), M(4, 7), M(5, 3), M(7, 3)];
  const r = solve({ nodes, members, supports: [{ node: 0, x: true, y: true }, { node: 1, y: true }], loads: [{ node: 2, fy: -12000 }] });
  near('Auflager A = P·3/4 [N]', r.reactions[0].ry, 9000);
  near('Auflager B = P·1/4 [N]', r.reactions[1].ry, 3000);
  near('Enddiagonale B–(3,1) = −B·√2 [N]', r.forces[7], -3000 * Math.SQRT2);
  near('Untergurt (3,0)–B = +B [N]', r.forces[3], 3000);
  near('Enddiagonale A–(1,1) = −A·√2 [N]', r.forces[6], -9000 * Math.SQRT2);
  near('Untergurt A–(1,0) = +A [N]', r.forces[0], 9000);
  // Ritterschnitt zwischen x = 2 und 3: Diagonale (3,1)–(2,0) und Untergurt treffen sich in (2,0): Obergurt = −B·2 m / 1 m
  near('Obergurt (2,1)–(3,1), Ritterschnitt [N]', r.forces[5], -6000);
  near('Diagonale (3,1)–(2,0), Ritterschnitt ΣV [N]', r.forces[12], 3000 * Math.SQRT2);
}
// 3) Dreieck: A(0,0) Festlager, B(4,0) Rollenlager, C(2,2), 10 kN nach unten + 4 kN nach rechts an C
{
  console.log('\n3) Dreiecksfachwerk mit schräger Last (10 kN ↓, 4 kN →)');
  const r = solve({ nodes: [[0, 0], [4, 0], [2, 2]], members: [M(0, 1), M(0, 2), M(1, 2)],
    supports: [{ node: 0, x: true, y: true }, { node: 1, y: true }], loads: [{ node: 2, fx: 4000, fy: -10000 }] });
  near('Auflager A horizontal [N]', r.reactions[0].rx, -4000);
  near('Auflager A vertikal [N]', r.reactions[0].ry, 3000);
  near('Auflager B vertikal [N]', r.reactions[1].ry, 7000);
  near('Zugband A–B [N]', r.forces[0], 7000);
  near('Stab A–C [N]', r.forces[1], -3000 * Math.SQRT2);
  near('Stab B–C [N]', r.forces[2], -7000 * Math.SQRT2);
}
// 4) Kinematische Kette wird erkannt
{
  console.log('\n4) Bewegliches Viereck ohne Diagonale');
  const r = solve({ nodes: [[0, 0], [2, 0], [0, 2], [2, 2]], members: [M(0, 2), M(1, 3), M(2, 3)],
    supports: [{ node: 0, x: true, y: true }, { node: 1, x: true, y: true }], loads: [{ node: 2, fx: 1000 }] });
  n++; if (r.ok || !r.mechanism) fails++; console.log(`${!r.ok && r.mechanism ? 'OK  ' : 'FEHL'} Mechanismus erkannt`);
}
console.log(`\n${n - fails}/${n} Prüfungen bestanden`);
process.exit(fails ? 1 : 0);
