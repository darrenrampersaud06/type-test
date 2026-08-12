/* ═══════════════════════════════════════════════════════════════════
   admin.js — COMMAND OVERRIDE (owner/dev console)

   A local, client-side console for inspecting the whole game without
   grinding for it: unlock every theme, jump to any level, unlock or
   clear achievements, preview any mode instantly, seed history so the
   graphs have data, and reset everything.

   ACCESS (any one of these):
     • type   jango          on the landing screen
     • click  the JANGO logo 5× on the landing screen
     • press  Ctrl + Alt + J  (Ctrl+Shift+J also works where the browser
                               doesn't reserve it for DevTools)
     • add    ?admin=1        to the URL (&admin=1 if it already has a ?)

   Once opened it stays enabled on this device (Store "admin"), which
   also reveals an ADMIN entry in the profile menu. It is deliberately
   local-only: it edits this browser's data, never anyone else's, and
   Row Level Security means it cannot touch another account's rows.
   ═══════════════════════════════════════════════════════════════════ */
import { Store } from "../storage/store.js";
import { emit } from "../bus.js";
import { Settings, saveSettings, applyTheme, THEMES, Mission, saveMission } from "../storage/prefs.js";
import { getProgress, xpForLevel, getDaily } from "./progression.js";
import { DEFS } from "./achievements.js";
import { play } from "../audio/sfx.js";

const $ = (s) => document.querySelector(s);

export const isAdmin = () => Store.get("admin", false) || new URLSearchParams(location.search).has("admin");
export function enableAdmin() {
  Store.set("admin", true);
  document.body.classList.add("is-admin");
  emit("tv:admin", { enabled: true });
}

/* ── unlock helpers ─────────────────────────────────────────────── */
export function setLevel(level) {
  const p = getProgress();
  p.level = Math.max(1, Math.min(99, Math.round(level)));
  p.xp = 0;
  Store.set("progress", p);
  emit("tv:xp", { amount: 0, ...p, need: xpForLevel(p.level) });
  return p;
}
export function unlockAllAchievements() {
  Store.set("achievements", DEFS.map(d => d.id));
}
export function clearAchievements() { Store.set("achievements", []); }

export function unlockAllThemes() {
  // themes gate on level; lifting to the highest requirement unlocks all
  const need = Math.max(...Object.values(THEMES).map(t => t.minLevel));
  const p = getProgress();
  if (p.level < need) setLevel(need);
}

/** Fill history with plausible runs so trends/graphs have something. */
export function seedHistory(days = 30) {
  const r = Store.get("records", {});
  const hist = [];
  let base = 55;
  for (let i = days; i >= 0; i--) {
    base += (Math.random() - 0.35) * 3;                 // gentle upward drift
    const wpm = Math.max(25, Math.round(base + (Math.random() - 0.5) * 12));
    const acc = Math.round((92 + Math.random() * 7.5) * 10) / 10;
    hist.push({
      at: Date.now() - i * 864e5 - Math.random() * 6e7,
      wpm, acc, raw: wpm + Math.round(Math.random() * 12),
      mode: ["30s normal", "50w hard", "60s normal", "100w expert"][i % 4],
    });
  }
  Object.assign(r, {
    history: hist,
    tests: hist.length,
    bestWpm: Math.max(...hist.map(h => h.wpm)),
    bestAcc: Math.max(...hist.map(h => h.acc)),
    bestCombo: 120, bestConsistency: 88,
    totalWords: hist.length * 62, totalChars: hist.length * 330,
    totalTime: hist.length * 42,
  });
  Store.set("records", r);
}

export function resetEverything() {
  ["records", "progress", "achievements", "daily", "goals", "onboarded", "syncQueue"]
    .forEach(k => Store.set(k, null));
  localStorage.removeItem("tv.records"); localStorage.removeItem("tv.progress");
  localStorage.removeItem("tv.achievements"); localStorage.removeItem("tv.daily");
  localStorage.removeItem("tv.goals"); localStorage.removeItem("tv.onboarded");
}

/* ── the panel ──────────────────────────────────────────────────── */
export function initAdmin({ onLaunch, onRefresh }) {
  if (isAdmin()) document.body.classList.add("is-admin");

  /* ── access routes ──────────────────────────────────────────────
     Several, because embedded previews (VS Code Live Preview) and
     browsers reserve some shortcuts: Ctrl+Shift+J is Chrome DevTools,
     so Ctrl+Alt+J is the primary chord and there are pointer routes. */
  document.addEventListener("keydown", (e) => {
    const j = e.key === "J" || e.key === "j";
    if (j && e.ctrlKey && (e.altKey || e.shiftKey)) {
      e.preventDefault();
      enableAdmin();
      toggle(true);
    }
  });

  let typed = "";
  document.addEventListener("keydown", (e) => {
    if (document.body.dataset.screen !== "landing" || e.key.length !== 1) return;
    typed = (typed + e.key.toLowerCase()).slice(-5);
    if (typed === "jango") { typed = ""; enableAdmin(); toggle(true); }
  });

  // five taps on the landing logo — works on touch and in embedded views
  let taps = 0, tapTimer = null;
  document.querySelector(".landing__title")?.addEventListener("click", () => {
    taps++;
    clearTimeout(tapTimer);
    tapTimer = setTimeout(() => { taps = 0; }, 1200);
    if (taps >= 5) { taps = 0; enableAdmin(); toggle(true); }
  });

  $("#admin-close").addEventListener("click", () => toggle(false));
  $("#admin-overlay").addEventListener("click", (e) => {
    if (e.target.id === "admin-overlay") toggle(false);
  });

  build({ onLaunch, onRefresh });
  if (new URLSearchParams(location.search).has("admin")) enableAdmin();
}

export function toggle(open) {
  const el = $("#admin-overlay");
  const isOpen = open ?? !el.classList.contains("open");
  el.classList.toggle("open", isOpen);
  document.body.classList.toggle("menu-open", !!document.querySelector(".overlay.open"));
  if (isOpen) { play("lock"); refreshReadout(); }
}

function refreshReadout() {
  const p = getProgress();
  const have = new Set(Store.get("achievements", []));
  const r = Store.get("records", { tests: 0 });
  $("#admin-readout").innerHTML =
    `LEVEL <b>${p.level}</b> · XP <b>${p.xp}</b>/${xpForLevel(p.level)} · ` +
    `ACHIEVEMENTS <b>${have.size}/${DEFS.length}</b> · MISSIONS <b>${r.tests || 0}</b> · ` +
    `THEME <b>${Settings.theme}</b> · DAILY <b>${getDaily().doneToday ? "flown" : "open"}</b>`;
}

function build({ onLaunch, onRefresh }) {
  const body = $("#admin-body");
  body.innerHTML = "";

  const after = () => { refreshReadout(); onRefresh?.(); };

  section("PROGRESSION");
  row("Level", [
    btn("−5", () => { setLevel(getProgress().level - 5); after(); }),
    btn("+1", () => { setLevel(getProgress().level + 1); after(); }),
    btn("+5", () => { setLevel(getProgress().level + 5); after(); }),
    btn("MAX (20)", () => { setLevel(20); after(); }),
    numBox("set", 1, 99, (n) => { setLevel(n); after(); }),
  ]);
  row("XP", [
    btn("+500", () => { addXpDirect(500); after(); }),
    btn("+5,000", () => { addXpDirect(5000); after(); }),
  ]);

  section("UNLOCKS");
  row("Themes", [
    btn("UNLOCK ALL", () => { unlockAllThemes(); after(); }),
    ...Object.entries(THEMES).map(([id, t]) =>
      btn(t.label, () => { Settings.theme = id; saveSettings(); applyTheme(); after(); })),
  ]);
  row("Achievements", [
    btn("UNLOCK ALL", () => { unlockAllAchievements(); after(); }),
    btn("CLEAR", () => { clearAchievements(); after(); }),
  ]);

  section("MISSION PREVIEW");
  const previews = [
    ["15s TIMED", { mode: "time", time: 15 }],
    ["60s TIMED", { mode: "time", time: 60 }],
    ["10 WORDS", { mode: "words", words: 10 }],
    ["25 WORDS", { mode: "words", words: 25 }],
    ["100 WORDS", { mode: "words", words: 100 }],
    ["500 WORDS", { mode: "words", words: 500 }],
    ["UNTIMED 50", { mode: "untimed", words: 50 }],
  ];
  row("Modes", previews.map(([label, patch]) =>
    btn(label, () => { toggle(false); onLaunch({ ...Mission, ...patch }); })));

  const contents = [
    ["WORDS", { content: "words" }],
    ["SENTENCES", { content: "sentences" }],
    ["QUOTES", { content: "quotes" }],
    ["CODE", { content: "code" }],
    ["NUMBERS", { content: "words", numbers: true }],
    ["PUNCTUATION", { content: "words", punctuation: true }],
    ["SYMBOLS", { content: "words", symbols: true }],
    ["CAPITALS", { content: "words", capitals: true }],
  ];
  row("Content", contents.map(([label, patch]) =>
    btn(label, () => { toggle(false); onLaunch({ ...Mission, mode: "words", words: 25, ...patch }); })));

  row("Difficulty", ["easy", "normal", "hard", "expert"].map(d =>
    btn(d.toUpperCase(), () => { toggle(false); onLaunch({ ...Mission, mode: "words", words: 25, difficulty: d }); })));

  section("DATA");
  row("Test data", [
    btn("SEED 30-DAY HISTORY", () => { seedHistory(30); after(); }),
    btn("SEED 90 DAYS", () => { seedHistory(90); after(); }),
  ]);
  row("Danger", [
    btn("RESET ALL PROGRESS", () => {
      if (confirm("Wipe level, XP, records, achievements and daily streak on this device?")) {
        resetEverything(); after();
      }
    }, "danger"),
  ]);

  function section(title) {
    const h = document.createElement("h4");
    h.textContent = title;
    body.appendChild(h);
  }
  function row(label, controls) {
    const r = document.createElement("div");
    r.className = "admin-row";
    const l = document.createElement("span");
    l.textContent = label;
    const wrap = document.createElement("div");
    wrap.className = "admin-btns";
    controls.forEach(c => wrap.appendChild(c));
    r.append(l, wrap);
    body.appendChild(r);
  }
  function btn(label, fn, cls = "") {
    const b = document.createElement("button");
    b.className = "admin-btn " + cls;
    b.textContent = label;
    b.addEventListener("click", () => { play("ui"); fn(); });
    return b;
  }
  function numBox(placeholder, min, max, fn) {
    const i = document.createElement("input");
    i.type = "number"; i.min = min; i.max = max; i.placeholder = placeholder;
    i.className = "admin-num";
    i.addEventListener("change", () => {
      const n = Number(i.value);
      if (Number.isFinite(n)) fn(Math.max(min, Math.min(max, n)));
    });
    return i;
  }
}

function addXpDirect(amount) {
  const p = getProgress();
  p.xp += amount;
  while (p.xp >= xpForLevel(p.level)) { p.xp -= xpForLevel(p.level); p.level++; }
  Store.set("progress", p);
}
