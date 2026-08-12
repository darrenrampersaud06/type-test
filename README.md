# TYPING VELOCITY 🚀

A **3D space-combat typing simulator**: you sit in a futuristic weapons-training
cockpit, and your typing charges and fires the ship's laser system. Correct
streaks fire beams at target drones, mistakes destabilize the weapon, a full
energy meter overcharges it. Built from scratch with Three.js — every asset
(planets, asteroids, nebulae, ships, the weapon itself) is procedural. No
downloaded models, no build step.

**Also included:** [`classic/`](classic/) — *jango*, the original 2D
conveyor-belt typing test. The two link to each other.

## Running it

Static site — any server works:

```bash
python3 -m http.server 8000     # → http://localhost:8000
```

Deploys as-is to GitHub Pages. (Modules + import map, so it needs a server or
Pages — not `file://`.)

## Features

**Missions, your way (never timer-forced)**
- **TIME** — 15 / 30 / 60 / 120s or any custom duration
- **WORDS** — 10 → 500 presets or custom up to 5,000 words
- **UNTIMED ∞** — no countdown at all; type until the word count is done
- Content: words / sentences / quotes / code · independent toggles for
  numbers, punctuation, symbols, capitals · four difficulty tiers (expert
  mixes everything in)

**A real typing engine**
- Character-level rendering (untyped / current / correct / incorrect /
  corrected) with a glowing caret (line / block / underline styles)
- WPM = (correct chars ÷ 5) ÷ minutes, plus raw WPM, CPM, accuracy,
  consistency (per-second sampling), corrected-character tracking — errors
  stay in your history even after backspacing
- Anti-cheat: paste blocked during tests; tab-away auto-pauses

**The combat loop** — `typing → energy → weapon → laser`
- Perfect words fire pulses; 5-word streaks fire lasers; 10-word streaks fire
  heavy blasts; finishing triggers a final volley
- Combo tiers: x5 ENERGY CHARGE → x10 LASER READY → x20 OVERCHARGE →
  x30 CRITICAL STRIKE → x50 SYSTEM OVERRIDE
- Weapon energy meter: typing charges it, mistakes drain it, 100% =
  **WEAPON OVERCHARGED** mega-shot
- Target drones spawn, get **TARGET LOCK**ed during streaks, and explode with
  particles + shockwaves

**The world** — procedural starfield (up to 6k stars), layered nebulae,
two planets (one ringed) with atmospheres, tumbling asteroid belt, distant
ships, plus infrequent random events (flybys, near-miss asteroids, solar
flares, radar pings)

**Cockpit HUD** — glass panels with scanning lines, animated radar, virtual
keyboard with next-key highlight, GitHub-style mission progress bar, warning
holograms, custom targeting-reticle cursor

**Meta** — cinematic loading → landing → mission config → results flow;
performance graph (WPM + accuracy over time); personal bests, lifetime
totals and 8 achievements in localStorage; fully synthesized sound design +
optional generative ambient music (no audio files, replaceable later)

**Practical** — adaptive quality (auto-detects weak/mobile devices, FPS
watchdog), reduced-motion mode, 2D canvas fallback when WebGL is missing,
settings panel for everything, keyboard shortcuts (`Enter` start · `Tab`
restart · `Esc` pause), mobile soft-keyboard support

## Project layout

```
index.html                  all screens (loading/landing/config/game/results)
styles/{main,hud}.css       sci-fi UI + cockpit HUD
vendor/three.*.min.js       Three.js, self-hosted
src/
  main.js                   orchestrator: wires typing events → 3D effects
  bus.js                    event bus (modules never import each other's guts)
  typing/engine.js          state machine, char states, metrics, sampling
  typing/textGenerator.js   word banks × difficulty, sentences, quotes, code
  three/scene.js            renderer, cockpit camera, quality tiers, 2D fallback
  three/environment.js      stars, nebulae, planets, asteroids, distant ships
  three/spacecraft.js       the weapon — pure primitives + emissive materials
  three/particles.js        single pooled GPU particle system
  three/lasers.js           beam pool, target drones, impacts, shockwaves
  ui/                       screens, config, typing view, HUD, results, settings
  game/achievements.js      unlock rules + toasts
  storage/                  namespaced localStorage: prefs, records
  audio/sfx.js              synthesized SFX + generative ambient pad
classic/                    jango — the original 2D belt typing test
```
