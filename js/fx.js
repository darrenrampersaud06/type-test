/* ═══════════════════════════════════════════════════════════════════
   fx.js — particle effects (zero dependencies)

   Two canvases:
     • #fx-belt   — overlays the belt zone; gold sparks burst at the
       marker every time a word is completed cleanly
     • #fx-screen — fixed over the whole page; confetti rains on a new
       personal best

   One shared requestAnimationFrame loop that only runs while particles
   are alive, so idle cost is zero.
   ═══════════════════════════════════════════════════════════════════ */
"use strict";

const FX = (() => {
  const zone   = document.getElementById("belt-zone");
  const beltC  = document.getElementById("fx-belt");
  const screenC = document.getElementById("fx-screen");
  const beltCtx = beltC.getContext("2d");
  const screenCtx = screenC.getContext("2d");

  const sparksArr = [];   // belt-local particles
  const confArr   = [];   // full-screen confetti
  let running = false;

  function resize() {
    beltC.width = zone.clientWidth;
    beltC.height = zone.clientHeight;
    screenC.width = window.innerWidth;
    screenC.height = window.innerHeight;
  }
  window.addEventListener("resize", resize);
  resize();

  /** Gold burst at the marker line when a word lands perfectly. */
  function sparks(intensity = 1) {
    const x = beltC.width * 0.30;
    const y = beltC.height / 2;
    const n = Math.round(10 * intensity);
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;   // mostly upward
      const sp = 1.5 + Math.random() * 3.5 * intensity;
      sparksArr.push({
        x, y,
        vx: Math.cos(a) * sp - 0.8,          // slight leftward drift, like the belt
        vy: Math.sin(a) * sp,
        life: 1,
        decay: 0.025 + Math.random() * 0.03,
        size: 1.5 + Math.random() * 2,
        color: Math.random() < 0.75 ? "#f7b955" : "#ffe9c2",
      });
    }
    kick();
  }

  /** Full-screen confetti for a new personal best. */
  function confetti() {
    const colors = ["#f7b955", "#58a6ff", "#3fb950", "#f85149", "#bc8cff", "#ffe9c2"];
    for (let i = 0; i < 160; i++) {
      confArr.push({
        x: Math.random() * screenC.width,
        y: -20 - Math.random() * screenC.height * 0.4,
        vx: (Math.random() - 0.5) * 1.4,
        vy: 1.6 + Math.random() * 2.6,
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 0.25,
        sway: Math.random() * Math.PI * 2,
        w: 5 + Math.random() * 5,
        h: 3 + Math.random() * 4,
        color: colors[i % colors.length],
      });
    }
    kick();
  }

  function kick() {
    if (!running) { running = true; requestAnimationFrame(loop); }
  }

  function loop() {
    // sparks
    beltCtx.clearRect(0, 0, beltC.width, beltC.height);
    for (let i = sparksArr.length - 1; i >= 0; i--) {
      const p = sparksArr[i];
      p.x += p.vx; p.y += p.vy;
      p.vy += 0.12;                          // gravity
      p.life -= p.decay;
      if (p.life <= 0) { sparksArr.splice(i, 1); continue; }
      beltCtx.globalAlpha = p.life;
      beltCtx.fillStyle = p.color;
      beltCtx.beginPath();
      beltCtx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      beltCtx.fill();
    }
    beltCtx.globalAlpha = 1;

    // confetti
    screenCtx.clearRect(0, 0, screenC.width, screenC.height);
    for (let i = confArr.length - 1; i >= 0; i--) {
      const p = confArr[i];
      p.sway += 0.06;
      p.x += p.vx + Math.sin(p.sway) * 0.8;
      p.y += p.vy;
      p.rot += p.vrot;
      if (p.y > screenC.height + 20) { confArr.splice(i, 1); continue; }
      screenCtx.save();
      screenCtx.translate(p.x, p.y);
      screenCtx.rotate(p.rot);
      screenCtx.fillStyle = p.color;
      screenCtx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      screenCtx.restore();
    }

    if (sparksArr.length || confArr.length) requestAnimationFrame(loop);
    else {
      running = false;
      beltCtx.clearRect(0, 0, beltC.width, beltC.height);
      screenCtx.clearRect(0, 0, screenC.width, screenC.height);
    }
  }

  return { sparks, confetti };
})();
