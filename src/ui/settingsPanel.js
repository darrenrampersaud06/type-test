/* ═══════════════════════════════════════════════════════════════════
   settingsPanel.js — schema-driven settings overlay
   Every control is generated from SCHEMA, writes into Settings, saves
   to localStorage and emits "tv:settings" so live systems can react.
   ═══════════════════════════════════════════════════════════════════ */
import { Settings, saveSettings, THEMES } from "../storage/prefs.js";
import { emit } from "../bus.js";
import { play, setVolumes, music } from "../audio/sfx.js";
import { getProgress } from "../game/progression.js";

const SCHEMA = [
  { section: "GRAPHICS" },
  { key: "quality", label: "Quality", type: "select", options: ["auto", "low", "medium", "high", "ultra"], note: "applies on next reload" },
  { key: "theme", label: "Theme", type: "theme" },
  { key: "particles", label: "Particles", type: "toggle" },
  { key: "shake", label: "Screen shake", type: "toggle" },
  { key: "lasers", label: "Laser effects", type: "toggle" },
  { section: "AUDIO" },
  { key: "master", label: "Master volume", type: "range" },
  { key: "sound", label: "Sound effects", type: "toggle" },
  { key: "sfxVol", label: "SFX volume", type: "range" },
  { key: "music", label: "Music", type: "toggle", note: "drop your tracks in audio/music/ — see the README there" },
  { key: "musicVol", label: "Music volume", type: "range" },
  { section: "GAMEPLAY" },
  { key: "flow", label: "Flow state (HUD fades at high combo)", type: "toggle" },
  { key: "haptics", label: "Haptic feedback (supported devices)", type: "toggle" },
  { key: "keyboard", label: "Virtual keyboard", type: "toggle" },
  { key: "caret", label: "Caret style", type: "select", options: ["line", "block", "underline"] },
  { section: "ACCESSIBILITY" },
  { key: "reducedMotion", label: "Reduced motion", type: "toggle" },
  { key: "highContrast", label: "High contrast", type: "toggle" },
  { key: "textSize", label: "Typing text size", type: "select", options: ["s", "m", "l"] },
  { key: "radar", label: "Radar display", type: "toggle" },
];

export function initSettings() {
  const host = document.getElementById("settings-body");
  host.innerHTML = "";
  for (const item of SCHEMA) {
    if (item.section) {
      const h = document.createElement("h4");
      h.textContent = item.section;
      host.appendChild(h);
      continue;
    }
    const row = document.createElement("div");
    row.className = "set-row";
    const lab = document.createElement("span");
    lab.textContent = item.label;
    row.appendChild(lab);

    if (item.type === "toggle") {
      const l = document.createElement("label");
      l.className = "tv-toggle";
      const c = document.createElement("input");
      c.type = "checkbox";
      c.checked = !!Settings[item.key];
      c.addEventListener("change", () => apply(item.key, c.checked));
      l.append(c, Object.assign(document.createElement("i"), {}));
      row.appendChild(l);
    } else if (item.type === "theme") {
      const s = document.createElement("select");
      const lvl = getProgress().level;
      for (const [id, t] of Object.entries(THEMES)) {
        const locked = lvl < t.minLevel;
        const o = new Option(locked ? `🔒 ${t.label} (LV ${t.minLevel})` : t.label, id);
        o.disabled = locked;
        s.add(o);
      }
      s.value = Settings.theme;
      s.addEventListener("change", () => apply("theme", s.value));
      row.appendChild(s);
    } else if (item.type === "select") {
      const s = document.createElement("select");
      for (const o of item.options) s.add(new Option(o.toUpperCase(), o));
      s.value = Settings[item.key];
      s.addEventListener("change", () => apply(item.key, s.value));
      row.appendChild(s);
    } else if (item.type === "range") {
      const r = document.createElement("input");
      r.type = "range"; r.min = 0; r.max = 1; r.step = 0.05;
      r.value = Settings[item.key];
      r.addEventListener("input", () => apply(item.key, Number(r.value)));
      row.appendChild(r);
    }
    if (item.note) {
      const n = document.createElement("small");
      n.textContent = item.note;
      row.appendChild(n);
    }
    host.appendChild(row);
  }

  const keys = document.createElement("p");
  keys.className = "set-keys";
  keys.innerHTML = "<b>SHORTCUTS</b> — <kbd>Enter</kbd> start · <kbd>Tab</kbd> restart · <kbd>Esc</kbd> pause";
  host.appendChild(keys);
}

function apply(key, value) {
  Settings[key] = value;
  saveSettings();
  play("ui");
  if (["sfxVol", "musicVol", "master"].includes(key)) setVolumes();
  emit("tv:settings", { key, value });   // main reacts (music state, theme, …)
}
