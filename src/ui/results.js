/* ═══════════════════════════════════════════════════════════════════
   results.js — MISSION COMPLETE screen

   Cinematic stat reveal: count-ups, performance bars, WPM+accuracy
   graph on canvas, personal-best handling with NEW RECORD banner.
   ═══════════════════════════════════════════════════════════════════ */
import { updateRecords, getRecords } from "../storage/records.js";
import { emit } from "../bus.js";

const $ = (s) => document.querySelector(s);

function countUp(el, target, { suffix = "", decimals = 0, ms = 900 } = {}) {
  const t0 = performance.now();
  (function step(now) {
    const p = Math.min((now - t0) / ms, 1);
    const v = target * (1 - Math.pow(1 - p, 3));
    el.textContent = v.toFixed(decimals) + suffix;
    if (p < 1) requestAnimationFrame(step);
  })(t0);
}

export function showResults(stats) {
  const { records, broken } = updateRecords(stats);

  countUp($("#r-wpm"), stats.wpm);
  countUp($("#r-acc"), stats.acc, { suffix: "%", decimals: 1 });
  $("#r-combo").textContent = "x" + stats.maxCombo;
  $("#r-chars").textContent = stats.chars.toLocaleString();
  $("#r-errors").textContent = stats.errors;
  $("#r-raw").textContent = stats.raw;
  $("#r-cons").textContent = stats.consistency + "%";
  $("#r-corrected").textContent = stats.corrected;
  $("#r-time").textContent = stats.elapsed.toFixed(1) + "s";

  const cfg = stats.cfg;
  $("#r-mode").textContent = (cfg.mode === "time" ? `${cfg.time}S TIMED`
    : cfg.mode === "untimed" ? `${cfg.words} WORDS · ∞`
    : `${cfg.words} WORDS`) + ` · ${cfg.difficulty.toUpperCase()}`;

  // performance bars (speed normalized to 150wpm)
  setBar("#bar-speed", Math.min(stats.wpm / 150, 1));
  setBar("#bar-acc", stats.acc / 100);
  setBar("#bar-cons", stats.consistency / 100);

  // personal best banner
  const pb = $("#r-pb");
  if (broken.includes("wpm")) {
    pb.innerHTML = `<b>NEW RECORD</b><span>${stats.wpm} WPM</span><i>SYSTEM OVERDRIVE</i>`;
    pb.className = "pb record";
    emit("tv:record", { wpm: stats.wpm });
  } else {
    pb.innerHTML = `PERSONAL BEST <b>${records.bestWpm} WPM</b>`;
    pb.className = "pb";
  }

  drawGraph(stats.samples);
}

function setBar(sel, k) {
  const el = $(sel);
  el.style.setProperty("--k", Math.max(0.02, Math.min(k, 1)));
  el.classList.remove("go"); void el.offsetWidth; el.classList.add("go");
}

/* WPM (cyan) + accuracy (violet) over the run */
function drawGraph(samples) {
  const cv = $("#r-graph");
  const ctx = cv.getContext("2d");
  const W = cv.width, H = cv.height, P = 30;
  ctx.clearRect(0, 0, W, H);

  if (!samples || samples.length < 2) {
    ctx.fillStyle = "rgba(140,170,210,.6)";
    ctx.font = "13px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("run too short for telemetry", W / 2, H / 2);
    return;
  }
  const maxW = Math.max(...samples.map(s => s.wpm)) * 1.15 || 1;
  const x = (i) => P + (i / (samples.length - 1)) * (W - P * 2);
  const yW = (v) => H - P - (v / maxW) * (H - P * 2);
  const yA = (v) => H - P - (v / 100) * (H - P * 2);

  ctx.strokeStyle = "rgba(56,182,255,.12)";
  ctx.fillStyle = "rgba(140,170,210,.55)";
  ctx.font = "10px monospace";
  ctx.textAlign = "right";
  for (let g = 0; g <= 4; g++) {
    const gy = P + (g / 4) * (H - P * 2);
    ctx.beginPath(); ctx.moveTo(P, gy); ctx.lineTo(W - P, gy); ctx.stroke();
    ctx.fillText(String(Math.round(maxW * (1 - g / 4))), P - 6, gy + 3);
  }

  line(samples.map((s, i) => [x(i), yW(s.wpm)]), "#38b6ff", true);
  line(samples.map((s, i) => [x(i), yA(s.acc)]), "#8a7dff", false);

  ctx.textAlign = "left";
  ctx.fillStyle = "#38b6ff"; ctx.fillText("WPM", P, 14);
  ctx.fillStyle = "#8a7dff"; ctx.fillText("ACC%", P + 40, 14);

  function line(pts, color, fill) {
    if (fill) {
      const grad = ctx.createLinearGradient(0, P, 0, H - P);
      grad.addColorStop(0, "rgba(56,182,255,.22)");
      grad.addColorStop(1, "rgba(56,182,255,0)");
      ctx.beginPath();
      pts.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py));
      ctx.lineTo(pts[pts.length - 1][0], H - P);
      ctx.lineTo(pts[0][0], H - P);
      ctx.closePath();
      ctx.fillStyle = grad; ctx.fill();
    }
    ctx.beginPath();
    pts.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py));
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineJoin = "round"; ctx.stroke();
  }
}
