# JANGO VELOCITY 🚀

**J.A.N.G.O.** — *Joint Artillery & Navigation Gunnery Operations* — is a
**3D space-combat typing simulator**: you pilot the JANGO's weapon system
from a futuristic cockpit, and your keyboard IS the trigger. The turret
tracks the current character, every correct keypress fires a laser at that
exact letter, streaks fire heavy blasts at target drones, and a full energy
meter overcharges the gun. Built from scratch with Three.js — every asset
(planets, asteroids, nebulae, ships, the weapon itself) is procedural. No
downloaded models, no build step.

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

**The combat loop** — `key → engine → gun → laser → letter impact`
- **The gun shoots every character you type.** The turret continuously
  tracks the current letter (targeting brackets + guide line + HUD readout),
  and each correct keypress fires a laser at that letter's exact screen
  position — impact particles, letter flash-apart, spring recoil with
  micro-vibration that scales with combo, optional haptic feedback
- Different weapons per character class: standard laser (letters), charged
  laser (capitals), energy bolt (numbers), precision beam (punctuation),
  plasma (symbols)
- Wrong key: no shot — red warning pulse, cockpit stutter, combo break;
  Backspace rewinds real typing history (across words) and the gun
  physically re-tracks backward while errors stay in your accuracy history
- 5-word streaks fire heavy lasers, 10-word streaks fire blasts, finishing
  triggers a final volley; combo tiers x5 → x50 SYSTEM OVERRIDE; full energy
  = **WEAPON OVERCHARGED**; target drones get **TARGET LOCK**ed and explode
- **Flow state**: at x30+ combo the HUD fades away and the environment
  intensifies — your skill visibly powers the ship

**Progression & accounts**
- XP + levels (cosmetic theme unlocks), daily mission with 🔥 streaks,
  daily goals, 13 achievements, sci-fi avatar picker
- Commander profile: analytics cards, WPM/accuracy trend graph with
  7/30/90-day ranges, sortable mission history, achievements grid
- **Real accounts (Supabase)**: email+password and Google sign-in, profiles,
  results, achievements and preferences in a real database with Row Level
  Security; offline-first with a sync queue. One-time setup in
  [README-CLOUD.md](README-CLOUD.md) — until then everything runs in
  LOCAL MODE on-device
- **Replaceable music**: drop `menu/gameplay/results/record.mp3` into
  `audio/music/` — states crossfade, missing files fall back to the
  generative pad (see the README there)

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
```
