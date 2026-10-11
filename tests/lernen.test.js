// Prüffälle des TM-Lernpakets (Kapitel 1 und 2) über BB.Statics:  node tests/lernen.test.js
const BB = (require('../src/core.js'), require('../src/statics.js'), require('../src/lessons.js'));
const C = BB.LessonCalc; let fails = 0;
const near = (name, got, want) => { const ok = Math.abs(got - want) < 1e-6; if (!ok) fails++; console.log(`${ok ? 'OK  ' : 'FEHL'} ${name.padEnd(52)} soll ${String(want).padStart(6)}  ist ${got.toFixed(6)}`); };
const r = C.resultant([[3, 0], [0, 4]]);
near('1.2 3/4/5-Dreieck: R [kN]', r.R, 5); near('1.2 R über Löser (Lagerkräfte) [kN]', r.statik.R, 5);
const w = C.seesaw(0.3, 2, 0.2, 3);
near('1.4 Wippe links 0,3 kN × 2 m [kNm]', w.ML, 0.6); near('1.4 Wippe rechts 0,2 kN × 3 m [kNm]', w.MR, 0.6); near('1.4 Kontroll-Loslager (Löser) [kNm]', w.statikNet, 0);
const e = C.beam({ L: 6, sup: [{ x: 0, t: 'fest' }, { x: 6, t: 'los' }], P: [{ x: 2, F: 30 }] }).R;
near('2.4 Einfeldträger A [kN]', e[0].V, 20); near('2.4 Einfeldträger B [kN]', e[1].V, 10); near('2.4 Einfeldträger A_x [kN]', e[0].H, 0);
const k = C.beam({ L: 3, sup: [{ x: 0, t: 'ein' }], P: [{ x: 3, F: 10 }] }).R[0];
near('2.5 Kragträger A [kN]', k.V, 10); near('2.5 Kragträger M_A [kNm]', Math.abs(k.M), 30);
const k6 = C.beam({ L: 6, sup: [{ x: 0, t: 'ein' }], P: [{ x: 6, F: 10 }] }).R[0];
near('2.4 Balkon doppelt so lang: M_A [kNm]', Math.abs(k6.M), 60);
const q = C.beam({ L: 4, sup: [{ x: 0, t: 'fest' }, { x: 4, t: 'los' }], q: 5 }).R;
near('2.6 Streckenlast A [kN]', q[0].V, 10); near('2.6 Streckenlast B [kN]', q[1].V, 10);
const cl = (s) => C.classify(s.map(([x, t]) => ({ x, t })), 6).kind;
[[[[0, 'los'], [6, 'los']], 'beweglich'], [[[0, 'los'], [3, 'los'], [6, 'los']], 'beweglich'], [[[0, 'fest'], [6, 'los']], 'bestimmt'], [[[0, 'ein']], 'bestimmt'],
 [[[0, 'fest'], [6, 'fest']], 'unbestimmt'], [[[0, 'ein'], [6, 'los']], 'unbestimmt'], [[[0, 'fest']], 'beweglich']].forEach(([s, want]) => {
  const got = cl(s), ok = got === want; if (!ok) fails++; console.log(`${ok ? 'OK  ' : 'FEHL'} 2.3 ${s.map(x => x[1]).join(' + ').padEnd(48)} soll ${want}  ist ${got}`); });
console.log(C.de(0.6) === '0,6' && C.de(8.66) === '8,66' ? 'OK   Dezimalkomma' : (fails++, 'FEHL Dezimalkomma'));
console.log(fails ? `\n${fails} Fehler` : '\nAlle Prüffälle OK'); process.exit(fails ? 1 : 0);
