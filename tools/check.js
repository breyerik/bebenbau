const BB = (require('../src/core.js'), require('../src/levels.js'), require('../src/sim.js'), require('../src/explain.js'));
const T = require('./designs.js');
const args = process.argv.slice(2);
const data = require('/workspace/spiel/lastfaelle.json');
const only = +(args[0] || 0);
if (process.env.CFG) Object.assign(BB.CFG, JSON.parse(process.env.CFG));
const mats = BB.prepMaterials(data.materialien);
const out = {};
data.levels.forEach((raw, i) => {
  const lv = BB.prepLevel(raw, i);
  if (only && lv.nr !== only) return;
  let best = null, tried = 0, wins = 0;
  for (const c of T.candidates(lv)) {
    if (!T.onSnap(lv, c.d) || BB.validate(lv, c.d)) continue;
    tried++;
    const d = T.optimize(lv, c.d, mats, +(process.env.SF || 1.3));
    const cost = BB.designCost(d, mats);
    if (best && cost >= best.cost) continue;
    const res = [1, 2, 3].map(seed => T.run(lv, d, mats, false, seed));
    if (!res.every(s => s.result.win)) continue;
    wins++;
    best = { tag: c.tag, d, cost };
  }
  if (!best) { console.log(`L${lv.nr} ${lv.name}: KEINE LÖSUNG (${tried} Varianten)`); return; }
  const use = {}; best.d.members.forEach(m => use[mats[m[2]].name] = (use[mats[m[2]].name] || 0) + 1);
  console.log(`L${lv.nr} ${lv.name.padEnd(28)} best ${best.cost}/${lv.budget} (${Math.round(best.cost / lv.budget * 100)}%) ★${BB.stars(best.cost, lv.budget)} [${best.tag}] ${JSON.stringify(use)} (${tried} Varianten)`);
  out[lv.nr] = best;
});
require('fs').writeFileSync(__dirname + '/solutions.json', JSON.stringify(out));
