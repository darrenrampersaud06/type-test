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
  master: 1,                // master volume multiplier
  haptics: true,            // navigator.vibrate where supported
  flow: true,               // flow-state mode: HUD fades at high combo
  textSize: "m",            // s | m | l typing text size
  highContrast: false,
  theme: "deep-space",
};

/* ── themes (cosmetic unlockables — minLevel gates them) ────────── */
export const THEMES = {
  "deep-space": { label: "DEEP SPACE", minLevel: 1,  accent: 0x38b6ff,
    vars: { "--cyan": "#38b6ff", "--cyan-hi": "#7fd8ff", "--violet": "#8a7dff" } },
  "mars":       { label: "MARS",       minLevel: 4,  accent: 0xff8a3d,
    vars: { "--cyan": "#ff8a3d", "--cyan-hi": "#ffc08a", "--violet": "#ff5e4d" } },
  "void":       { label: "VOID",       minLevel: 8,  accent: 0xdfe8ff,
    vars: { "--cyan": "#c9d6ea", "--cyan-hi": "#ffffff", "--violet": "#8ea0c0" } },
  "neon-city":  { label: "NEON CITY",  minLevel: 12, accent: 0xc84dff,
    vars: { "--cyan": "#c84dff", "--cyan-hi": "#ff7ae0", "--violet": "#5d5dff" } },
  "military":   { label: "MILITARY",   minLevel: 16, accent: 0x9dc148,
    vars: { "--cyan": "#9dc148", "--cyan-hi": "#d6e8a0", "--violet": "#e8b23d" } },
};

export function applyTheme() {
  const t = THEMES[Settings.theme] || THEMES["deep-space"];
  for (const [k, v] of Object.entries(t.vars)) document.documentElement.style.setProperty(k, v);
  document.body.dataset.theme = Settings.theme;
  return t;
}
export const themeAccent = () => (THEMES[Settings.theme] || THEMES["deep-space"]).accent;

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
