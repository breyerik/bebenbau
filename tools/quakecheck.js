const BB=(require('../src/core.js'),require('../src/levels.js'),require('../src/sim.js'));
const T=require('./designs.js');
if (process.env.CFG) Object.assign(BB.CFG, JSON.parse(process.env.CFG));
const data=require('/workspace/spiel/lastfaelle.json'); const mats=BB.prepMaterials(data.materialien);
const sol=require('./solutions.json');
for (const nr of Object.keys(sol)) { const raw=data.levels.find(l=>l.nr==nr); const lv=BB.prepLevel(raw,nr-1);
  const d=sol[nr].d; const pk=s=>Math.max(...s.members.map(m=>m.peakRatio)).toFixed(2);
  const a=T.run(lv,d,mats,true,1); const q=lv.quake, w=lv.wind; if(q) q.pga=0; if(w){w.v=0.01;w.gust=0.01;}
  const b=T.run(lv,d,mats,true,1); console.log(nr, 'mit Last', pk(a), 'ohne Beben/Wind', pk(b)); }
