/* ═══════════════════════════════════════════════════════════════════
   main.js — application orchestrator

   Boot → loading → landing → config → game → results.
   Wires the typing engine to the 3D scene through the event bus:

        typing → energy → weapon → laser → impact

   Keyboard: Enter advances screens, Tab restarts, Esc pauses.
   ═══════════════════════════════════════════════════════════════════ */
import { on, emit } from "./bus.js";
import { Settings, Mission } from "./storage/prefs.js";
import { getRecords } from "./storage/records.js";
import { play, music } from "./audio/sfx.js";
import { Engine } from "./typing/engine.js";
import { createSpace } from "./three/scene.js";
import * as ENV from "./three/environment.js";
import { createSpacecraft } from "./three/spacecraft.js";
import { createParticles } from "./three/particles.js";
import { createLasers } from "./three/lasers.js";
import * as Screens from "./ui/screens.js";
import { initConfig, launch } from "./ui/config.js";
import * as TypingView from "./ui/typingView.js";
import * as Hud from "./ui/hud.js";
import { showResults } from "./ui/results.js";
import { initSettings } from "./ui/settingsPanel.js";
import { checkAchievements } from "./game/achievements.js";

const $ = (s) => document.querySelector(s);

/* ── 3D world ───────────────────────────────────────────────────── */
const space = createSpace(document.getElementById("space"));
let craft = null, lasers = null, particles = null, env = {};

if (space.is3D) {
  const Q = space.quality;
  env.stars = ENV.createStarfield(space.scene, Q.stars);
  env.nebula = ENV.createNebula(space.scene, Q.nebula);
  env.planets = ENV.createPlanets(space.scene);
  env.asteroids = ENV.createAsteroids(space.scene, Q.asteroids);
  env.ships = ENV.createShips(space.scene);
  craft = createSpacecraft(space.camera);
  particles = createParticles(space.scene, Q.particles);
  lasers = createLasers(space.scene, craft, particles);

  space.onFrame((dt, t) => {
    env.stars.update(dt); env.nebula.update(dt); env.planets.update(dt);
    env.asteroids.update(dt); env.ships.update(dt);
    craft.update(dt, t);
    if (Settings.particles) particles.update(dt);
    lasers.update(dt, t);
  });
} else {
  document.body.classList.add("no-webgl");
}

const fire = (power) => { if (Settings.lasers && lasers) { lasers.fire(power); play(power >= 3 ? "bigLaser" : "laser"); } };

/* ── engine + energy state ──────────────────────────────────────── */
const engine = new Engine();
let energy = 20;
const setEnergy = (v) => {
  energy = Math.max(0, Math.min(100, v));
  Hud.setEnergy(energy, false);
  craft?.setCharge(energy / 100);
};

/* ── UI init ────────────────────────────────────────────────────── */
initConfig();
initSettings();
Hud.initHud();
Screens.initCursor();
if (Settings.music) music(true);
paintLandingPB();
Screens.runLoadingSequence();

function paintLandingPB() {
  const r = getRecords();
  $("#landing-pb").innerHTML = r.bestWpm
    ? `PERSONAL BEST <b>${r.bestWpm} WPM</b> · ${r.tests} MISSIONS FLOWN`
    : "NO FLIGHT RECORDS YET — FIRST MISSION AWAITS";
}

/* ── mission lifecycle ──────────────────────────────────────────── */
let comboTierAt = 0;

on("tv:launch", (cfg) => {
  window.__missionCfg = cfg;
  engine.load(cfg);
  TypingView.render(engine);
  setEnergy(20);
  comboTierAt = 0;
  $("#hud-mission").textContent = $("#mission-num").textContent + " — " + $("#mission-name").textContent;
  $("#hud-inf").hidden = cfg.mode !== "untimed";
  Screens.show("game");
  Hud.flashMsg(cfg.mode === "untimed" ? "MISSION TIME ∞ — TYPE AT WILL" : "WEAPONS FREE — BEGIN TYPING");
  emit("tv:progress", engine.metrics());
  focusMobileInput();
});

on("tv:start", () => { document.body.classList.add("typing"); });

on("tv:char", ({ correct, expected, typed, combo }) => {
  Hud.flashKey(correct ? typed : expected, correct);
  if (correct) {
    play("key");
    space.typeKick?.();
    setEnergy(energy + 0.55);
    Hud.comboDisplay(combo);
    // tier chime exactly when crossing a tier boundary
    const tier = [5, 10, 20, 30, 50].filter(t => combo >= t).pop() || 0;
    if (tier > comboTierAt) { play("combo"); comboTierAt = tier; }
    if (combo > 0 && tier >= 10 && combo === tier) space.shake(0.02);
    if (energy >= 100) overcharge();
  } else {
    play("error");
    comboTierAt = 0;
    setEnergy(energy - 2.5);
    Hud.warn();
    space.shake(0.05);
    particles && craft && particles.spawn(craft.muzzleWorld(), { count: 6, speed: 2, color: 0xff4d5e, lifeSec: 0.4 });
  }
});

on("tv:word", ({ perfect, streak }) => {
  if (!perfect) return;
  if (streak >= 3 && lasers && !lasers.isLocked()) { lasers.tryLock(); if (lasers.isLocked()) play("lock"); }
  if (streak > 0 && streak % 10 === 0) { fire(3); space.shake(0.09); }
  else if (streak > 0 && streak % 5 === 0) { fire(2); space.shake(0.05); }
  else fire(1);
});

function overcharge() {
  Hud.setEnergy(100, true);
  Hud.flashMsg("WEAPON OVERCHARGED");
  fire(3);
  space.shake(0.12);
  setTimeout(() => setEnergy(35), 500);
}

on("tv:finish", (stats) => {
  document.body.classList.remove("typing");
  play("complete");
  // final volley — the mission-complete attack
  [0, 160, 320, 480].forEach((d, i) => setTimeout(() => fire(i === 3 ? 4 : 2), d));
  space.shake(0.12);
  setTimeout(() => {
    showResults(stats);
    checkAchievements(stats, getRecords());
    paintLandingPB();
    Screens.show("results");
  }, 900);
});

on("tv:record", () => {
  play("record");
  [0, 200, 400].forEach(d => setTimeout(() => fire(4), d));
});

/* ── keyboard routing ───────────────────────────────────────────── */
const mobileInput = $("#mobile-input");

document.addEventListener("keydown", (e) => {
  if (e.target === mobileInput) return;            // mobile path handles itself
  const scr = Screens.currentScreen();

  // never swallow browser shortcuts
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  if (e.key === "Escape") {
    if (Screens.overlayOpen("settings-overlay")) { Screens.overlay("settings-overlay", false); return; }
    if (scr === "game") togglePause();
    return;
  }

  if (Screens.overlayOpen("pause-overlay") || Screens.overlayOpen("settings-overlay")) return;

  if (e.key === "Tab" && (scr === "game" || scr === "results")) {
    e.preventDefault();
    restart();
    return;
  }
  if (e.key === "Enter") {
    if (scr === "landing") { play("ui"); Screens.show("config"); }
    else if (scr === "config") launch();
    else if (scr === "results") { play("ui"); Screens.show("config"); }
    return;
  }

  if (scr !== "game") return;
  if (e.key === "Backspace") { e.preventDefault(); engine.backspace(); TypingView.update(engine); return; }
  if (e.key.length === 1) {
    e.preventDefault();
    engine.type(e.key);
    TypingView.update(engine);
  }
});

/* paste is never valid input during a test */
document.addEventListener("paste", (e) => {
  if (Screens.currentScreen() === "game") e.preventDefault();
});

/* mobile: hidden input summons the soft keyboard; route its events */
function focusMobileInput() {
  if ("ontouchstart" in window) { mobileInput.value = ""; mobileInput.focus(); }
}
$("#type-panel").addEventListener("click", focusMobileInput);
mobileInput.addEventListener("beforeinput", (e) => {
  e.preventDefault();
  if (e.inputType === "deleteContentBackward") { engine.backspace(); TypingView.update(engine); }
  else if (e.inputType === "insertText" && e.data) {
    for (const ch of e.data) engine.type(ch);
    TypingView.update(engine);
  }
});

/* tab-away auto-pauses a running mission */
document.addEventListener("visibilitychange", () => {
  if (document.hidden && engine.state === "running") togglePause(true);
});

/* ── pause menu ─────────────────────────────────────────────────── */
function togglePause(force) {
  const open = Screens.overlayOpen("pause-overlay");
  if (open && force) return;
  if (!open && engine.state !== "running" && !force) {
    // ESC before starting = back to config
    Screens.show("config");
    return;
  }
  if (open) { engine.resume(); Screens.overlay("pause-overlay", false); }
  else { engine.pause(); Screens.overlay("pause-overlay", true); }
}

function restart() {
  Screens.overlay("pause-overlay", false);
  document.body.classList.remove("typing");
  play("ui");
  emit("tv:launch", { ...Mission });
}

$("#btn-resume").addEventListener("click", () => togglePause());
$("#btn-restart").addEventListener("click", restart);
$("#btn-exit").addEventListener("click", () => {
  Screens.overlay("pause-overlay", false);
  document.body.classList.remove("typing");
  engine.stopTick();
  Screens.show("config");
});
$("#btn-pause-settings").addEventListener("click", () => Screens.overlay("settings-overlay", true));

/* buttons elsewhere */
$("#btn-start").addEventListener("click", () => { play("ui"); Screens.show("config"); });
$("#btn-retry").addEventListener("click", restart);
$("#btn-new-mission").addEventListener("click", () => { play("ui"); Screens.show("config"); });
$("#btn-settings").addEventListener("click", () => { play("ui"); Screens.overlay("settings-overlay", true); });
$("#btn-close-settings").addEventListener("click", () => Screens.overlay("settings-overlay", false));

/* settings that need live application */
on("tv:settings", ({ key }) => {
  if (key === "keyboard") Hud.applyKeyboardVisibility();
  if (key === "reducedMotion") document.body.classList.toggle("reduced", Settings.reducedMotion);
});
document.body.classList.toggle("reduced", Settings.reducedMotion);

/* ── ambient random events (infrequent, decorative) ─────────────── */
setInterval(() => {
  if (Screens.currentScreen() !== "game" || engine.state !== "running") return;
  if (Settings.reducedMotion || Math.random() < 0.5) return;
  const roll = Math.random();
  if (roll < 0.3 && env.ships) env.ships.flyby();
  else if (roll < 0.55 && env.asteroids) env.asteroids.pass();
  else if (roll < 0.75) space.flare();
  else Hud.flashMsg("RADAR PING — SECTOR CLEAR");
}, 24000);
