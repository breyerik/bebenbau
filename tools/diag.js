const BB=(require('../src/core.js'),require('../src/levels.js'),require('../src/sim.js'),require('../src/explain.js'));
const T=require('./designs.js');
if (process.env.CFG) Object.assign(BB.CFG, JSON.parse(process.env.CFG));
const data=require('/workspace/spiel/lastfaelle.json'); const mats=BB.prepMaterials(data.materialien);
const nr=+process.argv[2], tag=process.argv[3];
const lv=BB.prepLevel(data.levels.find(l=>l.nr===nr), nr-1);
for (const c of T.candidates(lv)) { if (tag && !c.tag.includes(tag)) continue;
  const d=T.optimize(lv,c.d,mats,+(process.env.SF||1.15)); const s=T.run(lv,d,mats,false,1); const u=T.run(lv,d,mats,true,1);
  const top=u.members.slice().sort((a,b)=>b.peakRatio-a.peakRatio).slice(0,3).map(m=>`#${m.id} ${m.mat.name} ${m.peakMode} ${(m.peakRatio*100|0)}% L${m.L0.toFixed(1)}`);
  console.log(c.tag, BB.designCost(d,mats), s.result.win?'WIN':'FAIL', s.t.toFixed(1), JSON.stringify(BB.Explain.explain(s).title), top.join(' ; '));
}
