import { Store } from "./store.js";

/* User settings — a mutable singleton; call saveSettings() after edits. */
const defaults = {
  quality: "auto",          // auto | low | medium | high | ultra
  particles: true,
  shake: true,
  lasers: true,
  sound: true,
  music: false,
  sfxVol: 0.5,
  musicVol: 0.35,
  reducedMotion: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
  keyboard: !("ontouchstart" in window),   // virtual keyboard off on touch devices
  radar: true,
  caret: "line",            // line | block | underline
};

export const Settings = Object.assign({}, defaults, Store.get("settings", {}));
export const saveSettings = () => Store.set("settings", Settings);

/* Mission configuration — what the next test looks like. */
const cfgDefaults = {
  mode: "words",            // time | words | untimed
  time: 30,
  words: 25,
  content: "words",         // words | sentences | quotes | code
  numbers: false,
  punctuation: false,
  symbols: false,
  capitals: false,
  difficulty: "normal",     // easy | normal | hard | expert
};
export const Mission = Object.assign({}, cfgDefaults, Store.get("mission", {}));
export const saveMission = () => Store.set("mission", Mission);
