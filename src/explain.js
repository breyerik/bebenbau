/* Bebenbau – Erklärungen nach jedem Test (Grundlage für spätere Lernkapitel Technische Mechanik).
   Vorzeichen: Zug +, Druck −, Kräfte in kN. */
(function () {
'use strict';
const BB = globalThis.BB = globalThis.BB || {};
const kN = f => Math.round(f / 1000);
// Kraftbetrag für Text: unter 20 kN mit einer Nachkommastelle
const kNt = f => { const v = Math.abs(f) / 1000; return v < 20 ? String(Math.round(v * 10) / 10).replace('.', ',') : String(Math.round(v)); };
const fmtN = v => String(v).replace('.', ',');
function forceLabel(f) { const v = kN(f); return (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v) + ' kN'; }
function capText(mat, mode) {
  if (mode === 'zug') return mat.zug > 0 ? `${mat.name} hält nur ${kNt(mat.zug)} kN Zug` : `${mat.name} hält keinen Zug`;
  return mat.druck > 0 ? `${mat.name} hält nur ${kN(mat.druck)} kN Druck` : `${mat.name} kann keinen Druck aufnehmen`;
}
function tip(fail) {
  if (fail.mode === 'zug') {
    if (fail.mat.name === 'Mauerwerk' || fail.mat.name === 'Stahlbeton') return 'Mauerwerk und Beton reißen schon bei wenig Zug. Für gezogene Stäbe nimm Stahlseil oder Stahlprofil.';
    return 'Tipp: Zugstäbe aus Stahlseil sind günstig und stark. Oder verteile die Last mit einem zusätzlichen Dreieck.';
  }
  if (fail.buckled) return `Der Stab ist ${fmtN(Math.round(fail.L0 * 10) / 10)} m lang und ist ausgeknickt: Lange Druckstäbe tragen viel weniger (nur ${kN(fail.cap)} statt ${kN(fail.capFull)} kN). Mach ihn kürzer, z. B. mit einem Zwischenknoten.`;
  if (fail.mat.name === 'Stahlseil') return 'Ein Seil kann nur ziehen, nicht drücken.';
  return 'Tipp: Für Druckstäbe sind Mauerwerk und Stahlbeton günstig und stark, solange sie kurz sind.';
}
function explain(sim, stat) {
  const res = sim.result || { win: false, reason: '' };
  const out = { win: res.win, title: '', lines: [], memberId: null, mode: null };
  const f0 = sim.failures[0];
  if (f0) {
    const verb = f0.mode === 'zug' ? 'ist gerissen' : (f0.buckled ? 'ist ausgeknickt' : 'wurde zerdrückt');
    out.memberId = f0.id; out.mode = f0.mode;
    out.title = `Stab ${f0.id} ${verb}: ${kNt(f0.f)} kN ${f0.mode === 'zug' ? 'Zug' : 'Druck'}, ` +
      (f0.buckled ? `als ${fmtN(Math.round(f0.L0 * 10) / 10)}-m-Stab aus ${f0.mat.name} hält er nur ${kNt(f0.cap)} kN` : capText(f0.mat, f0.mode)) + '.';
    out.lines.push(tip(f0));
    if (sim.failures.length === 2) out.lines.push('Danach ist noch ein weiterer Stab gebrochen.');
    else if (sim.failures.length > 2) out.lines.push(`Danach sind noch ${sim.failures.length - 1} weitere Stäbe gebrochen.`);
    if (res.win) out.lines.unshift('Gehalten hat es trotzdem, weil andere Stäbe die Last übernommen haben.');
  } else {
    // Am stärksten ausgenutzter Stab
    let best = null; for (const m of sim.members) if (!best || m.peakRatio > best.peakRatio) best = m;
    if (best && best.peakRatio > 0) {
      out.memberId = best.id; out.mode = best.peakMode;
      const cap = best.peakMode === 'zug' ? best.capT : best.capC;
      out.title = `Am stärksten belastet: Stab ${best.id} (${best.mat.name}) mit ${kNt(best.peakF)} kN ${best.peakMode === 'zug' ? 'Zug' : 'Druck'} von ${kN(cap)} kN möglich, also ${Math.round(best.peakRatio * 100)} %.`;
    }
    if (!res.win && res.reason) out.lines.push(res.reason);
    else if (res.win && best && best.peakRatio < 0.5) out.lines.push('Da ist noch Luft: Du könntest leichter und billiger bauen.');
  }
  // Statische Ersatzrechnung (exakter Fachwerklöser) zum Vergleich
  out.static = null;
  if (stat && stat.ok) {
    out.static = stat;
    if (out.memberId && stat.byId[out.memberId] !== undefined) {
      out.lines.push(`Statisch nachgerechnet (${stat.cases.join(', ') || 'Eigengewicht'}): Stab ${out.memberId} = ${forceLabel(stat.byId[out.memberId])}` +
        (sim.lv.quake || sim.lv.wind || sim.lv.truck ? '. Der Rest kommt aus der Bewegung (Schwingen, Fahren).' : '.'));
    }
    const rs = stat.reactions.filter(r => Math.hypot(r.rx, r.ry) > 500).map(r => {
      const a = sim.lv.anchors[r.node];
      return `x = ${fmtN(a.x)} m: ${kN(r.ry) >= 0 ? '↑' : '↓'} ${Math.abs(kN(r.ry))} kN` + (Math.abs(kN(r.rx)) ? `, ${kN(r.rx) >= 0 ? '→' : '←'} ${Math.abs(kN(r.rx))} kN` : '');
    });
    if (rs.length) out.lines.push('Auflagerkräfte statisch: ' + rs.join(' · '));
  } else if (stat && stat.mechanism) {
    out.lines.push('Statik-Check: System ist beweglich. Dein Bauwerk klappt zusammen, weil eine Diagonale fehlt: Nur Dreiecke sind formstabil.');
  } else {
    const r = sim.reactions.filter(x => x.peak > 500).sort((a, b) => b.peak - a.peak)[0];
    if (r) out.lines.push(`Größte Auflagerkraft: ${kN(r.peak)} kN am Anker bei x = ${fmtN(r.x)} m.`);
  }
  return out;
}
BB.Explain = { explain, forceLabel, kN, capText };
BB.LESSONS = BB.LESSONS || [];  // Platz für spätere Lernkapitel (Technische Mechanik)
if (typeof module !== 'undefined' && module.exports) module.exports = BB;
})();
