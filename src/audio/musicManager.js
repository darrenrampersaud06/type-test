/* ═══════════════════════════════════════════════════════════════════
   musicManager.js — replaceable music with state crossfades

   DROP YOUR OWN MUSIC IN — no JavaScript changes needed:

       audio/music/menu.mp3       (landing / config / results-idle)
       audio/music/gameplay.mp3   (during a mission)
       audio/music/results.mp3    (mission complete)
       audio/music/record.mp3     (personal-record stinger, plays once)

   All paths live in the TRACKS map below and nowhere else. Missing
   files are detected per-track; the manager then falls back to the
   generative ambient pad from sfx.js so music never hard-fails.
   ═══════════════════════════════════════════════════════════════════ */
import { Settings } from "../storage/prefs.js";
import { music as generativePad } from "./sfx.js";

const TRACKS = {
  menu:     "audio/music/menu.mp3",
  gameplay: "audio/music/gameplay.mp3",
  results:  "audio/music/results.mp3",
  record:   "audio/music/record.mp3",
};

const FADE_MS = 1400;
const players = new Map();     // state → { audio, ok }
let current = null;            // currently audible state
let padOn = false;
let fadeTimer = null;

function getPlayer(state) {
  if (players.has(state)) return players.get(state);
  const audio = new Audio(TRACKS[state]);
  audio.loop = state !== "record";
  audio.preload = "auto";
  audio.volume = 0;
  const rec = { audio, ok: null };
  audio.addEventListener("canplaythrough", () => { rec.ok = true; }, { once: true });
  audio.addEventListener("error", () => { rec.ok = false; }, { once: true });
  players.set(state, rec);
  return rec;
}

function fadeTo(state) {
  clearInterval(fadeTimer);
  const from = current ? players.get(current) : null;
  const to = state ? players.get(state) : null;
  const vol = () => Settings.musicVol * (Settings.master ?? 1);
  if (to?.ok) { to.audio.volume = 0; to.audio.play().catch(() => {}); }
  const t0 = performance.now();
  fadeTimer = setInterval(() => {
    const k = Math.min((performance.now() - t0) / FADE_MS, 1);
    if (from?.ok) from.audio.volume = Math.max(0, vol() * (1 - k));
    if (to?.ok) to.audio.volume = vol() * k;
    if (k >= 1) {
      clearInterval(fadeTimer);
      if (from?.ok && from !== to) from.audio.pause();
    }
  }, 50);
  current = state;
}

/** Switch music state: "menu" | "gameplay" | "results" | "record" | null */
export function setMusicState(state) {
  if (!Settings.music) { stopAll(); return; }
  if (state === current) return;

  const rec = state ? getPlayer(state) : null;
  if (!rec) { fadeTo(null); setPad(false); return; }

  if (rec.ok === null) {
    // still probing the file — decide when we know
    const decide = () => (Settings.music && (rec.ok ? switchToFile(state) : setPad(true)));
    rec.audio.addEventListener("canplaythrough", decide, { once: true });
    rec.audio.addEventListener("error", decide, { once: true });
    rec.audio.load();
  } else if (rec.ok) switchToFile(state);
  else setPad(true);
}

function switchToFile(state) {
  setPad(false);
  fadeTo(state);
}

function setPad(on) {
  if (on === padOn) return;
  padOn = on;
  generativePad(on);
  if (on && current) fadeTo(null);
}

export function stopAll() {
  clearInterval(fadeTimer);
  for (const { audio } of players.values()) { audio.pause(); audio.volume = 0; }
  current = null;
  setPad(false);
}

/** Live volume changes from the settings panel. */
export function applyMusicVolume() {
  const rec = current && players.get(current);
  if (rec?.ok) rec.audio.volume = Settings.musicVol * (Settings.master ?? 1);
}
