/* ═══════════════════════════════════════════════════════════════════
   sound.js — sound-effect layer (placeholder-friendly)

   Real sound files ship in assets/sounds/ (generated in-house). To use
   your own, replace the files — same names — and nothing else changes.
   If a file is missing or fails to load, play() falls back to a tiny
   synthesized blip via the Web Audio API.

       assets/sounds/click.wav    → every correct keypress
       assets/sounds/error.wav    → wrong keypress
       assets/sounds/finish.wav   → test complete
       assets/sounds/levelup.wav  → new personal best
   ═══════════════════════════════════════════════════════════════════ */
"use strict";

const Sound = (() => {
  const FILES = {
    click:   "assets/sounds/click.wav",
    error:   "assets/sounds/error.wav",
    finish:  "assets/sounds/finish.wav",
    levelup: "assets/sounds/levelup.wav",
  };

  // synth fallback parameters: [frequency Hz, duration s, gain]
  const SYNTH = {
    click:   [520, 0.03, 0.05],
    error:   [140, 0.08, 0.09],
    finish:  [880, 0.25, 0.08],
    levelup: [660, 0.35, 0.08],
  };

  let enabled = Store.get("sound", true);   // on by default — toggle in header
  let ctx = null;                       // AudioContext, created lazily on first use
  const cache = new Map();              // name → HTMLAudioElement | "missing"

  function play(name) {
    if (!enabled) return;

    const cached = cache.get(name);
    if (cached instanceof Audio) {      // real file previously loaded
      cached.currentTime = 0;
      cached.play().catch(() => {});
      return;
    }
    if (cached === "missing") return synth(name);

    // First request for this sound: try the placeholder path once.
    const a = new Audio(FILES[name]);
    a.addEventListener("canplaythrough", () => cache.set(name, a), { once: true });
    a.addEventListener("error", () => cache.set(name, "missing"), { once: true });
    a.play().then(() => cache.set(name, a)).catch(() => synth(name));
  }

  function synth(name) {
    const [freq, dur, gain] = SYNTH[name] || SYNTH.click;
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      g.gain.setValueAtTime(gain, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
      osc.connect(g).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + dur);
    } catch { /* audio unavailable — stay silent */ }
  }

  function toggle() {
    enabled = !enabled;
    Store.set("sound", enabled);
    if (enabled) play("click");
    return enabled;
  }

  const isEnabled = () => enabled;

  return { play, toggle, isEnabled };
})();
