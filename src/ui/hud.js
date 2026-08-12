/* ═══════════════════════════════════════════════════════════════════
   hud.js — cockpit heads-up display

   Stats panel, energy meter, combo tiers, mission progress, radar,
   virtual keyboard with next-key highlight, warning hologram, target
   lock indicator. All driven by bus events — no polling of the engine.
   ═══════════════════════════════════════════════════════════════════ */
import { Settings } from "../storage/prefs.js";
import { on } from "../bus.js";

const $ = (s) => document.querySelector(s);

export const COMBO_TIERS = [
  [50, "SYSTEM OVERRIDE"],
  [30, "CRITICAL STRIKE"],
  [20, "OVERCHARGE"],
  [10, "LASER READY"],
  [5,  "ENERGY CHARGE"],
];
export const tierFor = (combo) => COMBO_TIERS.find(([min]) => combo >= min)?.[1] ?? "";

export function initHud() {
  buildKeyboard();
  initRadar();

  on("tv:progress", (m) => {
    $("#hud-wpm").textContent = m.wpm;
    $("#hud-acc").textContent = m.acc.toFixed(1) + "%";
    $("#hud-combo").textContent = "x" + m.combo;
    paintProgress(m);
    highlightNext(m.nextChar);
  });

  on("tv:lock", ({ locked }) => {
    $("#hud-lock").classList.toggle("on", locked);
  });
  on("tv:targetDown", () => {
    flashMsg("TARGET DESTROYED");
  });
}

/* ── energy ─────────────────────────────────────────────────────── */
export function setEnergy(v, overcharged = false) {
  $("#energy-fill").style.width = Math.round(v) + "%";
  $("#energy-pct").textContent = Math.round(v) + "%";
  $("#energy-bar").classList.toggle("hot", v > 80);
  $("#hud-over").classList.toggle("on", overcharged);
}

/* ── combo display (center) ─────────────────────────────────────── */
let comboTimer = null;
export function comboDisplay(combo) {
  const el = $("#combo-pop");
  if (combo < 5) { el.classList.remove("on"); return; }
  el.querySelector("b").textContent = "x" + combo;
  el.querySelector("i").textContent = tierFor(combo);
  el.dataset.tier = String(COMBO_TIERS.findIndex(([min]) => combo >= min));
  el.classList.add("on");
  el.classList.remove("pulse");
  void el.offsetWidth;
  el.classList.add("pulse");
  clearTimeout(comboTimer);
  comboTimer = setTimeout(() => el.classList.remove("on"), 1800);
}

/* ── progress (words / time / untimed) ──────────────────────────── */
function paintProgress(m) {
  const cfg = m.cfg || window.__missionCfg || {};
  const mode = window.__missionCfg?.mode ?? "words";
  let label, pct;
  if (mode === "time") {
    const rem = Math.ceil(m.remaining ?? 0);
    label = `${String(Math.floor(rem / 60)).padStart(2, "0")}:${String(rem % 60).padStart(2, "0")}`;
    pct = 100 - (rem / (window.__missionCfg.time || 1)) * 100;
  } else {
    label = `${m.wordsDone} / ${m.totalWords}` + (mode === "untimed" ? "  ∞" : "");
    pct = (m.wordsDone / m.totalWords) * 100;
  }
  $("#prog-label").textContent = label;
  $("#prog-fill").style.width = pct + "%";
}

/* ── warning hologram (throttled) ───────────────────────────────── */
let warnAt = 0;
export function warn() {
  const now = performance.now();
  if (now - warnAt < 450) return;         // don't strobe on rapid errors
  warnAt = now;
  const el = $("#hud-warn");
  el.classList.remove("on");
  void el.offsetWidth;
  el.classList.add("on");
}

let msgTimer = null;
export function flashMsg(text) {
  const el = $("#hud-msg");
  el.textContent = text;
  el.classList.add("on");
  clearTimeout(msgTimer);
  msgTimer = setTimeout(() => el.classList.remove("on"), 1600);
}

/* ── virtual keyboard ───────────────────────────────────────────── */
const ROWS = [
  ["q","w","e","r","t","y","u","i","o","p"],
  ["a","s","d","f","g","h","j","k","l",";"],
  ["z","x","c","v","b","n","m",",",".","'"],
  [" "],
];
const keyEls = new Map();

function buildKeyboard() {
  const kb = $("#vkeyboard");
  kb.innerHTML = "";
  for (const row of ROWS) {
    const r = document.createElement("div");
    r.className = "vk-row";
    for (const k of row) {
      const el = document.createElement("div");
      el.className = "vk-key" + (k === " " ? " vk-space" : "");
      el.textContent = k === " " ? "SPACE" : k.toUpperCase();
      r.appendChild(el);
      keyEls.set(k, el);
    }
    kb.appendChild(r);
  }
  applyKeyboardVisibility();
}
export function applyKeyboardVisibility() {
  $("#vkeyboard").hidden = !Settings.keyboard;
}

function highlightNext(ch) {
  keyEls.forEach(el => el.classList.remove("next"));
  if (!ch) return;
  keyEls.get(ch.toLowerCase())?.classList.add("next");
}

export function flashKey(ch, ok) {
  const el = keyEls.get((ch || "").toLowerCase());
  if (!el) return;
  const cls = ok ? "hit" : "miss";
  el.classList.remove("hit", "miss");
  void el.offsetWidth;
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), 140);
}

/* ── radar: decorative but believable ───────────────────────────── */
function initRadar() {
  const cv = $("#radar");
  const ctx = cv.getContext("2d");
  const blips = Array.from({ length: 7 }, () => ({
    a: Math.random() * Math.PI * 2, r: 0.25 + Math.random() * 0.68,
    drift: (Math.random() - 0.5) * 0.1, ship: Math.random() < 0.3,
  }));
  let sweep = 0;
  setInterval(() => {
    if (!Settings.radar || document.body.dataset.screen !== "game") return;
    const S = cv.width, C = S / 2;
    ctx.clearRect(0, 0, S, S);
    ctx.strokeStyle = "rgba(56,182,255,.35)";
    ctx.lineWidth = 1;
    for (const rr of [0.33, 0.66, 0.99]) {
      ctx.beginPath(); ctx.arc(C, C, C * rr * 0.95, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(C, 2); ctx.lineTo(C, S - 2); ctx.moveTo(2, C); ctx.lineTo(S - 2, C); ctx.stroke();
    // sweep wedge
    sweep += 0.045;
    const grad = ctx.createConicGradient ? null : null;
    ctx.fillStyle = "rgba(56,182,255,.14)";
    ctx.beginPath();
    ctx.moveTo(C, C);
    ctx.arc(C, C, C * 0.94, sweep - 0.5, sweep);
    ctx.closePath(); ctx.fill();
    // blips light up as the sweep passes
    for (const b of blips) {
      b.a += b.drift * 0.02;
      const dx = Math.cos(b.a) * b.r * C * 0.9, dy = Math.sin(b.a) * b.r * C * 0.9;
      const da = ((b.a - sweep) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      const glow = Math.max(0, 1 - da / 1.6);
      ctx.fillStyle = b.ship ? `rgba(255,77,94,${0.25 + glow * 0.75})` : `rgba(120,220,255,${0.2 + glow * 0.7})`;
      ctx.beginPath(); ctx.arc(C + dx, C + dy, b.ship ? 2.5 : 1.8, 0, Math.PI * 2); ctx.fill();
    }
    // player
    ctx.fillStyle = "#dff3ff";
    ctx.beginPath(); ctx.arc(C, C, 2.4, 0, Math.PI * 2); ctx.fill();
  }, 50);
}
