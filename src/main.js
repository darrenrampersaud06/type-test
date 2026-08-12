/* ═══════════════════════════════════════════════════════════════════
   main.js — application orchestrator

   The defining loop (every single keypress):

     KEY → ENGINE VALIDATES → CHAR UPDATES → GUN (already tracking the
     char) FIRES AT ITS EXACT SCREEN POSITION → IMPACT PARTICLES →
     RECOIL → SOUND → HAPTIC → COMBO → ENERGY → HUD → NEXT CHAR

   Wrong key: error state → warning → sound → haptic → combo break.
   Backspace: history rewinds → char reverts → gun physically
   re-tracks backward → user corrects and continues.
   ═══════════════════════════════════════════════════════════════════ */
import { on, emit } from "./bus.js";
import { Store } from "./storage/store.js";
import { Settings, Mission, applyTheme, themeAccent } from "./storage/prefs.js";
import { getRecords } from "./storage/records.js";
import { play, setVolumes } from "./audio/sfx.js";
import { setMusicState, stopAll as stopMusic, applyMusicVolume } from "./audio/musicManager.js";
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
import * as Progress from "./game/progression.js";
import * as Cloud from "./cloud/cloud.js";
import * as Auth from "./ui/auth.js";
import { initProfile, renderProfile } from "./ui/profile.js";

const $ = (s) => document.querySelector(s);

/* ── theme first, so the 3D palette reads the right accent ──────── */
applyTheme();
document.body.dataset.textsize = Settings.textSize;
document.body.classList.toggle("hicontrast", Settings.highContrast);

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
    const I = space.getIntensity();
    env.stars.update(dt * (1 + I * 1.6));      // skill powers the ship
    env.nebula.update(dt); env.planets.update(dt);
    env.asteroids.update(dt); env.ships.update(dt);
    craft.update(dt, t);
    if (Settings.particles) particles.update(dt);
    lasers.update(dt, t);

    // continuous weapon tracking of the CURRENT character
    const inMission = Screens.currentScreen() === "game";
    const rect = inMission ? TypingView.targetRect() : null;
    if (rect) {
      const world = space.screenToWorld(rect.x, rect.y, 34);
      craft.aimAt(world);
      lasers.updateGuide(world, Settings.lasers && engine.state === "running");
    } else {
      lasers.updateGuide(null, false);
    }
  });
} else {
  document.body.classList.add("no-webgl");
}

/* ── character weapon categories (spec: different weapons per type) */
function weaponFor(ch) {
  if (/[0-9]/.test(ch)) return { color: 0xffd166, width: 0.02, burst: 6 };            // energy bolt
  if (/[A-Z]/.test(ch)) return { color: 0x9fe4ff, width: 0.026, burst: 8, life: 0.12 }; // charged laser
  if (/[a-z ]/.test(ch)) return { color: themeAccent(), width: 0.014, burst: 5 };     // standard laser
  if (/[.,!?;:'"()\[\]{}\-]/.test(ch)) return { color: 0x8a7dff, width: 0.011, burst: 4 }; // precision beam
  return { color: 0x59ff9d, width: 0.022, burst: 7 };                                 // plasma (symbols)
}

/* ── haptics (feature-detected, optional) ───────────────────────── */
const canVibrate = "vibrate" in navigator;
function haptic(pattern) {
  if (canVibrate && Settings.haptics) { try { navigator.vibrate(pattern); } catch { /* noop */ } }
}

/* ── engine + energy ────────────────────────────────────────────── */
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
initProfile();
Auth.initAuth();
Auth.initChipMenu({
  onProfile: (anchor) => {
    renderProfile();
    go("profile");
    if (anchor === "achievements") $("#pf-ach-anchor").scrollIntoView({ block: "start" });
  },
  onSettings: () => Screens.overlay("settings-overlay", true),
});
Auth.initOnboarding(() => go("config"));
$("#pf-back").addEventListener("click", () => go("config"));
paintLandingPB();
Screens.runLoadingSequence(() => { setMusicState("menu"); consumeOwnerPreview(); });

/* The owner console (admin.html) can queue a mission to inspect; it is
   consumed once and only when ?preview=1 is present, so a normal
   visitor's session is never affected by it. */
function consumeOwnerPreview() {
  if (!new URLSearchParams(location.search).has("preview")) return;
  const queued = Store.get("adminPreview", null);
  if (!queued?.cfg) return;
  Store.set("adminPreview", null);
  emit("tv:launch", queued.cfg);
}

function paintLandingPB() {
  const r = getRecords();
  const p = Progress.getProgress();
  $("#landing-pb").innerHTML = r.bestWpm
    ? `LEVEL ${p.level} · PERSONAL BEST <b>${r.bestWpm} WPM</b> · ${r.tests} MISSIONS FLOWN`
    : "NO FLIGHT RECORDS YET — FIRST MISSION AWAITS";
}

/** screen switch + music state in one place */
function go(name) {
  Screens.show(name);
  setMusicState(name === "game" ? "gameplay" : name === "results" ? "results" : "menu");
  if (name === "config") renderDailyAndGoals();
}

/* ── daily mission + goals card ─────────────────────────────────── */
let activeDaily = false;
function renderDailyAndGoals() {
  const d = Progress.getDaily();
  $("#daily-streak").textContent = d.streak > 0 ? `🔥 ${d.streak} DAY${d.streak > 1 ? "S" : ""}` : "";
  $("#daily-desc").textContent =
    `${d.words} WORDS · ${d.difficulty.toUpperCase()} · ${d.content.toUpperCase()}` +
    (d.punctuation ? " · PUNCTUATION" : "") + (d.numbers ? " · NUMBERS" : "");
  $("#btn-daily").disabled = d.doneToday;
  $("#btn-daily").innerHTML = d.doneToday ? "✓ FLOWN TODAY" : "▸ FLY DAILY <b>+500 XP</b>";
  $("#goals-list").innerHTML = Progress.getGoals().map(g => {
    const pct = Math.round((g.value / g.target) * 100);
    return `<div class="goal ${g.done ? "done" : ""}"><span>${g.done ? "✓ " : ""}${g.label}</span>
      <div class="goal-track"><i style="width:${pct}%"></i></div></div>`;
  }).join("");
}
$("#btn-daily").addEventListener("click", () => {
  const d = Progress.getDaily();
  activeDaily = true;
  emit("tv:launch", {
    ...Mission, mode: "words", words: d.words, difficulty: d.difficulty,
    content: d.content, punctuation: d.punctuation, numbers: d.numbers,
  });
});

/* ── mission lifecycle ──────────────────────────────────────────── */
let comboTierAt = 0;
let lastShotRect = null;      // captured just before the engine advances

on("tv:launch", (cfg) => {
  window.__missionCfg = cfg;
  engine.load(cfg);
  TypingView.render(engine);
  setEnergy(20);
  comboTierAt = 0;
  Hud.setFlow(false);
  $("#hud-mission").textContent = activeDaily
    ? "DAILY MISSION"
    : $("#mission-num").textContent + " — " + $("#mission-name").textContent;
  $("#hud-inf").hidden = cfg.mode !== "untimed";
  go("game");
  Hud.flashMsg(cfg.mode === "untimed" ? "MISSION TIME ∞ — JANGO AT YOUR COMMAND" : "JANGO WEAPONS FREE — BEGIN TYPING");
  Hud.updateTargetReadout(engine.metrics().nextChar, 0);
  emit("tv:progress", engine.metrics());
  focusMobileInput();
});

on("tv:start", () => { document.body.classList.add("typing"); haptic(15); });

on("tv:char", ({ correct, expected, typed, combo }) => {
  Hud.flashKey(correct ? typed : expected, correct);
  if (correct) {
    // ── THE SHOT: laser hits the character the player just destroyed ──
    if (Settings.lasers && lasers && lastShotRect) {
      const world = space.screenToWorld(lastShotRect.x, lastShotRect.y, 34);
      lasers.fireAt(world, weaponFor(expected));
    }
    const power = Math.min(0.25 + combo / 120, 1);
    craft?.recoil(power * 0.5);
    play("key");
    space.typeKick();
    haptic(8);
    setEnergy(energy + 0.55);
    Hud.comboDisplay(combo);

    const tier = [5, 10, 20, 30, 50].filter(t => combo >= t).pop() || 0;
    if (tier > comboTierAt) {
      play("combo");
      comboTierAt = tier;
      haptic([12, 24, 12]);
      if (tier === 50) { space.pulseFov(4); Hud.flashMsg("SYSTEM OVERRIDE"); }
    }
    if (Settings.flow) Hud.setFlow(combo >= 30);
    if (energy >= 100) overcharge();
  } else {
    play("error");
    Screens.cursorError();
    comboTierAt = 0;
    setEnergy(energy - 2.5);
    Hud.warn();
    Hud.setFlow(false);
    space.shake(0.05);
    craft?.recoil(0.12);          // stutter, not a shot
    haptic([25, 40, 25]);
    particles && craft && particles.spawn(craft.muzzleWorld(), { count: 6, speed: 2, color: 0xff4d5e, lifeSec: 0.4 });
  }
  // env reacts to performance heat
  const m = engine.metrics();
  space.setIntensity(Math.min(1, m.combo / 80 + m.wpm / 250));
  craft?.setIntensity(space.getIntensity());
  Hud.updateTargetReadout(m.nextChar, m.index);
});

on("tv:back", () => {
  // gun re-tracks backward automatically (aim follows the current char)
  Hud.updateTargetReadout(engine.metrics().nextChar, engine.index);
});

on("tv:word", ({ perfect, streak }) => {
  if (!perfect) return;
  if (streak >= 3 && lasers && !lasers.isLocked()) { lasers.tryLock(); if (lasers.isLocked()) play("lock"); }
  if (streak > 0 && streak % 10 === 0) { fire(3); space.shake(0.09); }
  else if (streak > 0 && streak % 5 === 0) { fire(2); space.shake(0.05); }
});

const fire = (power) => { if (Settings.lasers && lasers) { lasers.fire(power); play(power >= 3 ? "bigLaser" : "laser"); } };

function overcharge() {
  Hud.setEnergy(100, true);
  Hud.flashMsg("WEAPON OVERCHARGED");
  fire(3);
  space.shake(0.12);
  haptic([20, 30, 20, 30, 40]);
  setTimeout(() => setEnergy(35), 500);
}

on("tv:finish", (stats) => {
  document.body.classList.remove("typing");
  Hud.setFlow(false);
  play("complete");
  haptic([30, 50, 30, 50, 80]);
  [0, 160, 320, 480].forEach((d, i) => setTimeout(() => fire(i === 3 ? 4 : 2), d));
  space.shake(0.12);

  // progression + persistence
  const gained = Progress.xpFor(stats);
  Progress.addXp(gained, "mission");
  Progress.recordGoalProgress(stats);
  let bonus = 0;
  if (activeDaily) { bonus = Progress.completeDaily(); activeDaily = false; }
  Cloud.saveResult(stats);
  const p = Progress.getProgress();
  Cloud.upsertProfile({ level: p.level, xp: p.xp }).catch(() => {});

  setTimeout(() => {
    showResults(stats);
    $("#r-xp").textContent = `+${gained + bonus} XP` + (bonus ? ` (daily +${bonus})` : "");
    checkAchievements(stats, getRecords());
    paintLandingPB();
    Auth.renderChip();
    go("results");
  }, 900);
});

on("tv:record", () => {
  play("record");
  setMusicState("record");
  document.body.classList.add("flash");
  setTimeout(() => document.body.classList.remove("flash"), 900);
  space.flare();
  [0, 200, 400].forEach(d => setTimeout(() => fire(4), d));
});

on("tv:levelup", ({ level }) => {
  play("record");
  haptic([15, 30, 15, 30, 60]);
  fire(4);
  const host = $("#ach-toasts");
  const el = document.createElement("div");
  el.className = "ach-toast levelup";
  el.innerHTML = `<em>RANK UP</em><b>LEVEL ${level}</b><span>new systems may be unlocked in settings</span>`;
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add("in"));
  setTimeout(() => { el.classList.remove("in"); setTimeout(() => el.remove(), 500); }, 4200);
});

on("tv:achievement", (d) => Cloud.saveAchievement(d.id));

/* ── keyboard routing ───────────────────────────────────────────── */
const mobileInput = $("#mobile-input");

document.addEventListener("keydown", (e) => {
  if (e.target === mobileInput) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;   // never swallow shortcuts
  const scr = Screens.currentScreen();
  const overlayUp = document.querySelector(".overlay.open");

  if (e.key === "Escape") {
    if (Screens.overlayOpen("settings-overlay")) { Screens.overlay("settings-overlay", false); return; }
    if (Screens.overlayOpen("auth-overlay")) { Auth.closeAuth(); return; }
    if (scr === "game") togglePause();
    else if (scr === "profile") go("config");
    return;
  }
  if (overlayUp) return;
  if (e.target.matches("input, select, textarea")) {
    // typing into a form field — only Enter-to-launch passes through
    if (e.key === "Enter" && scr === "config") launch();
    return;
  }

  if (e.key === "Tab" && (scr === "game" || scr === "results")) {
    e.preventDefault();
    restart();
    return;
  }
  if (e.key === "Enter") {
    if (scr === "landing") startFromLanding();
    else if (scr === "config") launch();
    else if (scr === "results") { play("ui"); go("config"); }
    return;
  }

  if (scr !== "game") return;
  if (e.key === "Backspace") {
    e.preventDefault();
    engine.backspace();
    TypingView.update(engine);
    return;
  }
  if (e.key.length === 1) {
    e.preventDefault();
    lastShotRect = TypingView.targetRect();     // aim point of THIS char
    engine.type(e.key);
    TypingView.update(engine, { zap: true });
  }
});

document.addEventListener("paste", (e) => {
  if (Screens.currentScreen() === "game") e.preventDefault();
});

function focusMobileInput() {
  if ("ontouchstart" in window) { mobileInput.value = ""; mobileInput.focus(); }
}
$("#type-panel").addEventListener("click", focusMobileInput);
mobileInput.addEventListener("beforeinput", (e) => {
  e.preventDefault();
  if (e.inputType === "deleteContentBackward") { engine.backspace(); TypingView.update(engine); }
  else if (e.inputType === "insertText" && e.data) {
    for (const ch of e.data) { lastShotRect = TypingView.targetRect(); engine.type(ch); }
    TypingView.update(engine, { zap: true });
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden && engine.state === "running") togglePause(true);
});

/* ── pause menu ─────────────────────────────────────────────────── */
function togglePause(force) {
  const open = Screens.overlayOpen("pause-overlay");
  if (open && force) return;
  if (!open && engine.state !== "running" && !force) { go("config"); return; }
  if (open) { engine.resume(); Screens.overlay("pause-overlay", false); }
  else { engine.pause(); Screens.overlay("pause-overlay", true); }
}

function restart() {
  Screens.overlay("pause-overlay", false);
  document.body.classList.remove("typing");
  play("ui");
  emit("tv:launch", window.__missionCfg ? { ...window.__missionCfg } : { ...Mission });
}

function startFromLanding() {
  play("ui");
  if (!Auth.maybeOnboard()) go("config");
}

$("#btn-resume").addEventListener("click", () => togglePause());
$("#btn-restart").addEventListener("click", restart);
$("#btn-exit").addEventListener("click", () => {
  Screens.overlay("pause-overlay", false);
  document.body.classList.remove("typing");
  engine.stopTick();
  go("config");
});
$("#btn-pause-settings").addEventListener("click", () => Screens.overlay("settings-overlay", true));
$("#btn-start").addEventListener("click", startFromLanding);
$("#btn-retry").addEventListener("click", restart);
$("#btn-new-mission").addEventListener("click", () => { play("ui"); go("config"); });
$("#btn-settings").addEventListener("click", () => { play("ui"); Screens.overlay("settings-overlay", true); });
$("#btn-close-settings").addEventListener("click", () => Screens.overlay("settings-overlay", false));

/* ── live settings reactions ────────────────────────────────────── */
on("tv:settings", ({ key, value }) => {
  if (key === "keyboard") Hud.applyKeyboardVisibility();
  if (key === "reducedMotion") document.body.classList.toggle("reduced", value);
  if (key === "highContrast") document.body.classList.toggle("hicontrast", value);
  if (key === "textSize") { document.body.dataset.textsize = value; TypingView.update(engine); }
  if (key === "theme") applyTheme();
  if (key === "caret") { const c = document.getElementById("caret"); if (c) c.dataset.style = value; TypingView.update(engine); }
  if (["music", "master", "musicVol"].includes(key)) {
    applyMusicVolume(); setVolumes();
    if (key === "music") value
      ? setMusicState(Screens.currentScreen() === "game" ? "gameplay" : "menu")
      : stopMusic();
  }
});
document.body.classList.toggle("reduced", Settings.reducedMotion);
on("tv:auth", () => { Auth.renderChip(); paintLandingPB(); });

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
