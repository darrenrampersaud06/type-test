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
    "WAKING THE JANGO",
    "LOADING STARFIELD",
    "CALIBRATING GUNNERY SERVOS",
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

/* ── overlays (pause / settings / auth) ─────────────────────────── */
/* While any overlay menu is open the SYSTEM cursor takes over (the
   custom reticle hides) so menus are always precisely clickable. */
export function overlay(id, onOff) {
  $("#" + id).classList.toggle("open", onOff);
  const anyOpen = !!document.querySelector(".overlay.open");
  document.body.classList.toggle("menu-open", anyOpen);
}
export const overlayOpen = (id) => $("#" + id).classList.contains("open");

/* ── custom targeting-reticle cursor ──────────────────────────────
   The DOT is 1:1 with the physical mouse — its transform is written
   synchronously in pointermove, zero interpolation, GPU-composited.
   Only the decorative RING trails behind on its own rAF loop.       */
export function initCursor() {
  if ("ontouchstart" in window) return;
  const cur = $("#cursor");
  const dot = $("#cursor-dot");
  const ring = $("#cursor-ring");
  let x = innerWidth / 2, y = innerHeight / 2;   // ring position (lags)
  let tx = x, ty = y, raf = null;

  document.addEventListener("pointermove", (e) => {
    tx = e.clientX; ty = e.clientY;
    dot.style.transform = `translate(${tx}px, ${ty}px)`;   // instant
    cur.classList.add("on");
    if (!raf) raf = requestAnimationFrame(step);
  }, { passive: true });

  function step() {
    x += (tx - x) * 0.4; y += (ty - y) * 0.4;
    ring.style.transform = `translate(${x}px, ${y}px)`;
    raf = (Math.abs(tx - x) > 0.25 || Math.abs(ty - y) > 0.25)
      ? requestAnimationFrame(step) : null;
  }

  document.addEventListener("pointerover", (e) => {
    const hot = e.target.closest("button, a, .chip, input, select, label.tv-toggle, .avatar-opt, th[data-k]");
    cur.classList.toggle("hover", !!hot);
    if (hot && Settings.sound) play("ui");
  });
  document.addEventListener("pointerdown", () => {
    cur.classList.add("lock");
    setTimeout(() => cur.classList.remove("lock"), 130);
  });
}

/** brief red flash on the reticle (wrong key) */
export function cursorError() {
  const cur = $("#cursor");
  cur.classList.remove("err"); void cur.offsetWidth; cur.classList.add("err");
}
