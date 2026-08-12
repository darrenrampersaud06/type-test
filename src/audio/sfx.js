/* ═══════════════════════════════════════════════════════════════════
   sfx.js — fully synthesized sound design (no audio files needed)

   Everything is generated with the Web Audio API: key ticks, laser
   sweeps, charge-ups, chimes and an optional generative ambient pad.
   Real audio files can replace any of these later by swapping the
   function bodies — the public API (play / music) stays the same.
   ═══════════════════════════════════════════════════════════════════ */
import { Settings } from "../storage/prefs.js";

let ctx = null, sfxGain = null, musicGain = null;

function ensureCtx() {
  if (ctx) return true;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    sfxGain = ctx.createGain(); sfxGain.connect(ctx.destination);
    musicGain = ctx.createGain(); musicGain.connect(ctx.destination);
    setVolumes();
    return true;
  } catch { return false; }
}
export function setVolumes() {
  if (!ctx) return;
  const master = Settings.master ?? 1;
  sfxGain.gain.value = Settings.sfxVol * master;
  musicGain.gain.value = Settings.musicVol * master;
}

/* ── primitive builders ─────────────────────────────────────────── */
function osc(type, freq, dur, peak, { to = freq, attack = 0.004, dest = sfxGain } = {}) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, ctx.currentTime);
  if (to !== freq) o.frequency.exponentialRampToValueAtTime(Math.max(to, 1), ctx.currentTime + dur);
  g.gain.setValueAtTime(0, ctx.currentTime);
  g.gain.linearRampToValueAtTime(peak, ctx.currentTime + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
  o.connect(g).connect(dest);
  o.start(); o.stop(ctx.currentTime + dur + 0.02);
}
function noise(dur, peak, { freq = 1200, q = 1, to = null } = {}) {
  const n = Math.ceil(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.Q.value = q;
  f.frequency.setValueAtTime(freq, ctx.currentTime);
  if (to) f.frequency.exponentialRampToValueAtTime(to, ctx.currentTime + dur);
  const g = ctx.createGain(); g.gain.value = peak;
  src.connect(f).connect(g).connect(sfxGain);
  src.start();
}

/* ── the sound set ──────────────────────────────────────────────── */
const SOUNDS = {
  key()      { osc("triangle", 940, 0.035, 0.06); },
  error()    { osc("sawtooth", 150, 0.10, 0.10, { to: 90 }); noise(0.05, 0.03, { freq: 300 }); },
  laser()    { osc("sawtooth", 880, 0.18, 0.12, { to: 160 }); noise(0.12, 0.05, { freq: 2400, to: 400 }); },
  bigLaser() { osc("sawtooth", 1200, 0.4, 0.16, { to: 90 }); osc("sine", 70, 0.4, 0.14, { to: 40 }); noise(0.3, 0.08, { freq: 3200, to: 300 }); },
  charge()   { osc("sine", 220, 0.3, 0.07, { to: 660 }); },
  combo()    { osc("sine", 660, 0.10, 0.07); setTimeout(() => ctx && osc("sine", 990, 0.12, 0.07), 70); },
  lock()     { osc("square", 1320, 0.05, 0.05); setTimeout(() => ctx && osc("square", 1320, 0.05, 0.05), 110); },
  start()    { noise(0.5, 0.06, { freq: 300, to: 2400, q: 2 }); osc("sine", 110, 0.5, 0.08, { to: 220 }); },
  complete() { [523, 659, 784].forEach((f, i) => setTimeout(() => ctx && osc("sine", f, 0.5, 0.09), i * 100)); },
  record()   { [523, 659, 784, 1046, 1318].forEach((f, i) => setTimeout(() => ctx && osc("sine", f, 0.45, 0.09), i * 80)); },
  ui()       { osc("sine", 1500, 0.03, 0.03); },
};

export function play(name) {
  if (!Settings.sound || !SOUNDS[name]) return;
  if (!ensureCtx()) return;
  if (ctx.state === "suspended") ctx.resume();
  try { SOUNDS[name](); } catch { /* audio hiccup — never break the game */ }
}

/* ── generative ambient music (optional, off by default) ────────── */
let musicNodes = null, chordTimer = null;
const CHORDS = [[110, 164.8, 220], [98, 146.8, 196], [87.3, 130.8, 174.6], [110, 146.8, 220]];

export function music(onOff) {
  if (!ensureCtx()) return;
  if (onOff && !musicNodes) {
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass"; filter.frequency.value = 600; filter.Q.value = 0.5;
    const lfo = ctx.createOscillator(), lfoG = ctx.createGain();
    lfo.frequency.value = 0.05; lfoG.gain.value = 250;
    lfo.connect(lfoG).connect(filter.frequency); lfo.start();
    filter.connect(musicGain);
    const oscs = [0, 1, 2].map(() => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sawtooth"; g.gain.value = 0.03;
      o.connect(g).connect(filter); o.start();
      return { o, g };
    });
    let ci = 0;
    const applyChord = () => {
      const chord = CHORDS[ci++ % CHORDS.length];
      oscs.forEach(({ o }, i) =>
        o.frequency.linearRampToValueAtTime(chord[i] * (1 + (i - 1) * 0.002), ctx.currentTime + 4));
    };
    applyChord();
    chordTimer = setInterval(applyChord, 9000);
    musicNodes = { filter, lfo, oscs };
  } else if (!onOff && musicNodes) {
    clearInterval(chordTimer);
    musicNodes.oscs.forEach(({ o }) => o.stop(ctx.currentTime + 0.3));
    musicNodes.lfo.stop(ctx.currentTime + 0.3);
    musicNodes = null;
  }
}
