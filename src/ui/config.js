/* ═══════════════════════════════════════════════════════════════════
   config.js — MISSION CONFIGURATION screen

   Chip groups for mode / duration / word count / content / difficulty,
   independent content toggles, custom numeric inputs, and a live
   mission-preview panel. Emits "tv:launch" with the final config.
   ═══════════════════════════════════════════════════════════════════ */
import { Mission, saveMission } from "../storage/prefs.js";
import { emit } from "../bus.js";
import { play } from "../audio/sfx.js";
import { getRecords } from "../storage/records.js";

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const MISSION_NAMES = ["CALIBRATION", "DEEP PATROL", "ASTEROID RUN", "SILENT ORBIT", "NEBULA DIVE", "OUTER RIM SWEEP", "RELAY DEFENSE", "VOID CROSSING"];

export function initConfig() {
  /* mode chips */
  bindChips("#cfg-mode .chip", () => Mission.mode, (v) => {
    Mission.mode = v;
    refresh();
  });
  /* duration + custom */
  bindChips("#cfg-time .chip[data-v]", () => String(Mission.time), (v) => {
    Mission.time = Number(v);
    $("#cfg-time-custom").value = "";
    refresh();
  });
  numInput("#cfg-time-custom", 5, 3600, (n) => { Mission.time = n; refresh(); });

  /* word count + custom */
  bindChips("#cfg-words .chip[data-v]", () => String(Mission.words), (v) => {
    Mission.words = Number(v);
    $("#cfg-words-custom").value = "";
    refresh();
  });
  numInput("#cfg-words-custom", 1, 5000, (n) => { Mission.words = n; refresh(); });

  /* content type */
  bindChips("#cfg-content .chip", () => Mission.content, (v) => { Mission.content = v; refresh(); });

  /* content toggles */
  for (const key of ["numbers", "punctuation", "symbols", "capitals"]) {
    const el = $(`#tgl-${key}`);
    el.checked = Mission[key];
    el.addEventListener("change", () => { Mission[key] = el.checked; play("ui"); refresh(); });
  }

  /* difficulty */
  bindChips("#cfg-diff .chip", () => Mission.difficulty, (v) => { Mission.difficulty = v; refresh(); });

  $("#btn-launch").addEventListener("click", launch);
  refresh();
}

export function launch() {
  saveMission();
  play("start");
  emit("tv:launch", { ...Mission });
}

/* ── helpers ────────────────────────────────────────────────────── */
function bindChips(selector, getter, setter) {
  const chips = $$(selector);
  const paint = () => chips.forEach(c => c.classList.toggle("on", (c.dataset.v ?? c.dataset.mode) === getter()));
  chips.forEach(c => c.addEventListener("click", () => {
    setter(c.dataset.v ?? c.dataset.mode);
    play("ui");
    paint();
  }));
  paint();
}

function numInput(sel, min, max, apply) {
  const el = $(sel);
  // apply live on every keystroke so "type 75, hit Enter to launch" uses 75
  const commit = () => {
    const n = Math.round(Number(el.value));
    if (!Number.isFinite(n) || n < min) return;
    apply(Math.min(n, max));
    // clear sibling chip highlight — custom value is now active
    el.closest(".cfg-row").querySelectorAll(".chip").forEach(c => c.classList.remove("on"));
  };
  el.addEventListener("input", commit);
  el.addEventListener("change", commit);
}

/** Live mission preview + show/hide rows per mode. */
function refresh() {
  const timed = Mission.mode === "time";
  $("#row-time").hidden = !timed;
  $("#row-words").hidden = timed;

  const r = getRecords();
  const n = (r.tests % MISSION_NAMES.length);
  const expert = Mission.difficulty === "expert";
  const extras = ["numbers", "punctuation", "symbols", "capitals"]
    .filter(k => Mission[k] || expert).map(k => k.toUpperCase());

  $("#mission-num").textContent = `MISSION ${String(r.tests + 1).padStart(2, "0")}`;
  $("#mission-name").textContent = MISSION_NAMES[n];
  $("#mission-brief").innerHTML = [
    timed ? `${Mission.time}s TIMED` : `${Mission.words} WORDS`,
    Mission.mode === "untimed" ? "∞ UNTIMED" : null,
    Mission.content.toUpperCase(),
    Mission.difficulty.toUpperCase(),
    extras.length ? extras.join(" · ") : null,
  ].filter(Boolean).join('<span class="sep">◆</span>');
  $("#mission-inf").hidden = Mission.mode !== "untimed";
}
