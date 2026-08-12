/* ═══════════════════════════════════════════════════════════════════
   screens.js — view flow + loading sequence + custom cursor

   Flow: loading → landing → config → game → results (pause overlays).
   Screens are sections with .screen; .active fades them in via CSS.
   ═══════════════════════════════════════════════════════════════════ */
import { Settings } from "../storage/prefs.js";
import { play } from "../audio/sfx.js";

const $ = (sel) => document.querySelector(sel);
let current = "loading";

export function show(name) {
  if (name === current) return;
  document.querySelectorAll(".screen").forEach(s =>
    s.classList.toggle("active", s.id === `screen-${name}`));
  document.body.dataset.screen = name;
  current = name;
}
export const currentScreen = () => current;

/** Boot checklist — short, cinematic, honest (it really is loading). */
export function runLoadingSequence(done) {
  const lines = [
    "LOADING STARFIELD",
    "CALIBRATING WEAPONS",
    "INITIALIZING TYPING CORE",
    "SYNCING HUD",
  ];
  const list = $("#boot-list");
  list.innerHTML = "";
  lines.forEach((txt, i) => {
    const li = document.createElement("li");
    li.innerHTML = `<span>${txt}</span><b>…</b>`;
    list.appendChild(li);
    setTimeout(() => { li.querySelector("b").textContent = "✓"; li.classList.add("ok"); }, 260 + i * 300);
  });
  setTimeout(() => {
    $("#boot-ready").classList.add("on");
    setTimeout(() => { show("landing"); done?.(); }, 550);
  }, 260 + lines.length * 300);
}

/* ── overlays (pause / settings) ────────────────────────────────── */
export function overlay(id, onOff) {
  $("#" + id).classList.toggle("open", onOff);
}
export const overlayOpen = (id) => $("#" + id).classList.contains("open");

/* ── custom targeting-reticle cursor ────────────────────────────── */
export function initCursor() {
  if ("ontouchstart" in window) return;
  const cur = $("#cursor");
  let x = innerWidth / 2, y = innerHeight / 2, tx = x, ty = y, raf = null;

  document.addEventListener("pointermove", (e) => {
    tx = e.clientX; ty = e.clientY;
    cur.classList.add("on");
    if (!raf) raf = requestAnimationFrame(step);
  });
  function step() {
    x += (tx - x) * 0.35; y += (ty - y) * 0.35;
    cur.style.transform = `translate(${x}px, ${y}px)`;
    raf = (Math.abs(tx - x) > 0.3 || Math.abs(ty - y) > 0.3) ? requestAnimationFrame(step) : null;
  }
  // reticle expands over interactive elements + soft hover blip
  document.addEventListener("pointerover", (e) => {
    const hot = e.target.closest("button, a, .chip, input, select, label.tv-toggle");
    cur.classList.toggle("hover", !!hot);
    if (hot && Settings.sound) play("ui");
  });
  // hide while actually typing (screen=game & running handled via CSS class)
}
