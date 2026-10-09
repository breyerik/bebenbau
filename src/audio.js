/* Bebenbau – Geräusche, komplett mit WebAudio erzeugt (keine Dateien) */
(function () {
'use strict';
const BB = globalThis.BB = globalThis.BB || {};
let ac = null, master = null, noiseBuf = null, muted = false;
const loops = {};
function init() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  ac = new AC(); master = ac.createGain(); master.gain.value = muted ? 0 : 0.7; master.connect(ac.destination);
  noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}
function setMuted(m) { muted = m; if (master) master.gain.setTargetAtTime(m ? 0 : 0.7, ac.currentTime, 0.02); }
function tone(f, dur, type, vol, slide) {
  if (!ac) return; const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
  o.type = type || 'square'; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  g.gain.setValueAtTime(vol || 0.15, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, freq, q, vol, delay) {
  if (!ac) return; const t = ac.currentTime + (delay || 0), s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = noiseBuf; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q || 1;
  g.gain.setValueAtTime(vol || 0.3, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random()); s.stop(t + dur + 0.05);
}
function loop(name, freq, type) {
  if (!ac) return null;
  if (loops[name]) return loops[name];
  const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = noiseBuf; s.loop = true; f.type = type || 'lowpass'; f.frequency.value = freq; g.gain.value = 0;
  s.connect(f); f.connect(g); g.connect(master); s.start();
  return (loops[name] = { s, f, g });
}
function setLoop(name, v, freq, type) { const l = loop(name, freq, type); if (l) l.g.gain.setTargetAtTime(Math.max(0, Math.min(1, v)), ac.currentTime, 0.08); }
let eng = null;
function setEngine(v, pitch) {
  if (!ac) return;
  if (!eng) { const o = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain(); o.type = 'sawtooth'; f.type = 'lowpass'; f.frequency.value = 300; g.gain.value = 0; o.connect(f); f.connect(g); g.connect(master); o.start(); eng = { o, g }; }
  eng.g.gain.setTargetAtTime(v * 0.08, ac.currentTime, 0.1); eng.o.frequency.setTargetAtTime(40 + (pitch || 0) * 6, ac.currentTime, 0.1);
}
const S = {
  init, setMuted, get muted() { return muted; },
  click() { tone(660, 0.05, 'square', 0.06); },
  place(mat) { tone(mat === 'Stahlseil' ? 900 : mat === 'Holz' ? 300 : 500, 0.08, 'triangle', 0.18, 200); noise(0.06, 2000, 2, 0.08); },
  remove() { tone(400, 0.12, 'sawtooth', 0.07, 120); },
  crack(heavy) { noise(0.25, heavy ? 500 : 1800, 0.8, 0.5); tone(heavy ? 80 : 160, 0.3, 'sine', 0.35, 40); },
  thud() { tone(70, 0.4, 'sine', 0.4, 30); noise(0.3, 200, 0.7, 0.25); },
  win() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'square', 0.1), i * 110)); },
  fail() { [392, 370, 349, 262].forEach((f, i) => setTimeout(() => tone(f, i === 3 ? 0.6 : 0.25, 'sawtooth', 0.08), i * 230)); },
  rumble(v) { setLoop('rumble', v * 0.9, 120, 'lowpass'); },
  wind(v) { setLoop('wind', v * 0.5, 700, 'bandpass'); },
  engine: setEngine,
  stopLoops() { if (!ac) return; for (const k in loops) loops[k].g.gain.setTargetAtTime(0, ac.currentTime, 0.05); if (eng) eng.g.gain.setTargetAtTime(0, ac.currentTime, 0.05); },
};
BB.Audio = S;
})();
