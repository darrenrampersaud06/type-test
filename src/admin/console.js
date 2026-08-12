/* ═══════════════════════════════════════════════════════════════════
   console.js — the standalone owner console (admin.html)

   Nothing here is imported by the game. index.html has no reference to
   this page, no shortcut, no hidden key sequence: the only way in is
   the URL plus the access code in admin-config.js (and, if configured,
   being signed in as OWNER_EMAIL — a check Supabase enforces server
   side).

   SANDBOX: opening the console snapshots every JANGO save key. Changes
   are therefore always reversible with RESTORE MY SAVE, so previewing
   levels/themes never pollutes the save you actually play with.
   ═══════════════════════════════════════════════════════════════════ */
import { Store } from "../storage/store.js";
import { Settings, saveSettings, applyTheme, THEMES, Mission } from "../storage/prefs.js";
import { getProgress, xpForLevel, getDaily } from "../game/progression.js";
import { DEFS } from "../game/achievements.js";

const $ = (s) => document.querySelector(s);
const CFG = window.TV_ADMIN || {};

/* every key the game persists — the sandbox covers all of them */
const SAVE_KEYS = [
  "records", "progress", "achievements", "daily", "goals",
  "settings", "mission", "avatarId", "onboarded", "syncQueue", "sound",
];
const BACKUP_KEY = "tv.__ownerBackup";

/* ── crypto helpers ─────────────────────────────────────────────── */
async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}
const randomSalt = () =>
  [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, "0")).join("");

/* ── lock screen ────────────────────────────────────────────────── */
const configured = !!(CFG.SALT && CFG.HASH);
let attempts = 0, lockedUntil = 0;

function lockError(msg) {
  const el = $("#lock-error");
  el.textContent = msg;
  el.hidden = false;
}

if (!configured) {
  $("#lock-setup").hidden = false;
  $("#lock-pass").disabled = true;
  $("#lock-submit").disabled = true;
  $("#lock-gen-open")?.setAttribute("open", "");
}
if (CFG.OWNER_EMAIL) {
  $("#lock-owner-note").hidden = false;
  $("#lock-owner-note").innerHTML =
    `🔒 This console also requires being signed in as <b>${CFG.OWNER_EMAIL}</b> in JANGO.`;
}

$("#lock-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!configured) return;

  if (Date.now() < lockedUntil) {
    lockError(`Too many attempts — wait ${Math.ceil((lockedUntil - Date.now()) / 1000)}s.`);
    return;
  }

  const attempt = await sha256Hex(CFG.SALT + $("#lock-pass").value);
  if (attempt !== CFG.HASH) {
    attempts++;
    if (attempts >= 5) { lockedUntil = Date.now() + 30000; attempts = 0; }
    lockError("Access denied.");
    $("#lock-pass").value = "";
    return;
  }

  // optional second factor: a real, server-verified Supabase session
  if (CFG.OWNER_EMAIL) {
    const ok = await ownerSignedIn();
    if (!ok) {
      lockError(`Sign in to JANGO as ${CFG.OWNER_EMAIL} first, then return here.`);
      return;
    }
  }
  unlock();
});

async function ownerSignedIn() {
  const c = window.TV_CONFIG;
  if (!c?.SUPABASE_URL || !window.supabase) return false;
  try {
    const client = window.supabase.createClient(c.SUPABASE_URL, c.SUPABASE_ANON_KEY);
    const { data } = await client.auth.getUser();
    return data?.user?.email?.toLowerCase() === CFG.OWNER_EMAIL.toLowerCase();
  } catch { return false; }
}

/* ── hash generator (so the owner sets their own code) ──────────── */
$("#gen-btn").addEventListener("click", async () => {
  const pw = $("#gen-pass").value;
  if (pw.length < 6) { $("#gen-out").hidden = false; $("#gen-out").textContent = "choose at least 6 characters"; return; }
  const salt = randomSalt();
  const hash = await sha256Hex(salt + pw);
  $("#gen-out").hidden = false;
  $("#gen-out").textContent = `  SALT: "${salt}",\n  HASH: "${hash}",`;
});

/* ── unlock → build the console ─────────────────────────────────── */
function unlock() {
  $("#lock").hidden = true;
  $("#console").hidden = false;
  $("#con-who").textContent = CFG.OWNER_EMAIL
    ? `authenticated · owner lock: ${CFG.OWNER_EMAIL}`
    : "authenticated · local owner session";
  armSandbox();
  buildPanel();
  refreshReadout();
}

$("#btn-lock").addEventListener("click", () => location.reload());

/* ── sandbox: snapshot / restore the real save ──────────────────── */
function armSandbox() {
  if (localStorage.getItem(BACKUP_KEY)) { paintSandbox(); return; }   // already armed
  const snap = {};
  for (const k of SAVE_KEYS) {
    const raw = localStorage.getItem("tv." + k);
    if (raw !== null) snap[k] = raw;
  }
  localStorage.setItem(BACKUP_KEY, JSON.stringify({ at: Date.now(), snap }));
  paintSandbox();
}

function paintSandbox() {
  const raw = localStorage.getItem(BACKUP_KEY);
  const bar = $("#sandbox-bar");
  if (!raw) {
    bar.classList.add("clean");
    $("#sandbox-state").textContent = "SANDBOX CLEAR";
    $("#sandbox-desc").textContent = "no backup held — changes from here are permanent";
    return;
  }
  const { at } = JSON.parse(raw);
  bar.classList.remove("clean");
  $("#sandbox-state").textContent = "SANDBOX ARMED";
  $("#sandbox-desc").textContent =
    `real save backed up ${new Date(at).toLocaleTimeString()} — RESTORE rolls back everything you change here`;
}

$("#btn-restore").addEventListener("click", () => {
  const raw = localStorage.getItem(BACKUP_KEY);
  if (!raw) return;
  const { snap } = JSON.parse(raw);
  for (const k of SAVE_KEYS) {
    if (k in snap) localStorage.setItem("tv." + k, snap[k]);
    else localStorage.removeItem("tv." + k);
  }
  localStorage.removeItem(BACKUP_KEY);
  toast("Real save restored");
  armSandbox();
  refreshReadout();
});

$("#btn-keep").addEventListener("click", () => {
  localStorage.removeItem(BACKUP_KEY);
  toast("Changes kept — sandbox cleared");
  paintSandbox();
});

/* ── mutations ──────────────────────────────────────────────────── */
function setLevel(level) {
  const p = getProgress();
  p.level = Math.max(1, Math.min(99, Math.round(level)));
  p.xp = 0;
  Store.set("progress", p);
}
function addXp(amount) {
  const p = getProgress();
  p.xp += amount;
  while (p.xp >= xpForLevel(p.level)) { p.xp -= xpForLevel(p.level); p.level++; }
  Store.set("progress", p);
}
function unlockAllThemes() {
  const need = Math.max(...Object.values(THEMES).map(t => t.minLevel));
  if (getProgress().level < need) setLevel(need);
}
function setTheme(id) {
  Settings.theme = id;
  saveSettings();
  applyTheme();
}
function seedHistory(days) {
  const r = Store.get("records", {});
  const hist = [];
  let base = 55;
  for (let i = days; i >= 0; i--) {
    base += (Math.random() - 0.35) * 3;
    const wpm = Math.max(25, Math.round(base + (Math.random() - 0.5) * 12));
    const acc = Math.round((92 + Math.random() * 7.5) * 10) / 10;
    hist.push({
      at: Date.now() - i * 864e5 - Math.random() * 6e7,
      wpm, acc, raw: wpm + Math.round(Math.random() * 12),
      mode: ["30s normal", "50w hard", "60s normal", "100w expert"][i % 4],
    });
  }
  Object.assign(r, {
    history: hist, tests: hist.length,
    bestWpm: Math.max(...hist.map(h => h.wpm)),
    bestAcc: Math.max(...hist.map(h => h.acc)),
    bestCombo: 120, bestConsistency: 88,
    totalWords: hist.length * 62, totalChars: hist.length * 330,
    totalTime: hist.length * 42,
  });
  Store.set("records", r);
}

/** FULL wipe — progress, records, achievements, settings AND theme. */
function fullReset() {
  for (const k of SAVE_KEYS) localStorage.removeItem("tv." + k);
  // put the shared Settings object back to first-run values so the
  // theme (and everything else) really is default, not just on disk
  Settings.theme = "deep-space";
  Settings.quality = "auto";
  Settings.textSize = "m";
  Settings.highContrast = false;
  Settings.reducedMotion = false;
  Settings.master = 1; Settings.sfxVol = 0.5; Settings.musicVol = 0.35;
  Settings.sound = true; Settings.music = false;
  Settings.particles = true; Settings.shake = true; Settings.lasers = true;
  Settings.flow = true; Settings.haptics = true; Settings.radar = true;
  Settings.caret = "line";
  localStorage.removeItem("tv.settings");     // let defaults rebuild on next load
  applyTheme();
}

/* ── mission preview: hand a config to the game and open it ─────── */
function preview(patch) {
  const cfg = { ...Mission, ...patch };
  Store.set("mission", cfg);
  Store.set("adminPreview", { cfg, at: Date.now() });   // game auto-launches it
  window.open("index.html?preview=1", "_blank", "noopener");
}

/* ── panel ──────────────────────────────────────────────────────── */
function refreshReadout() {
  const p = getProgress();
  const have = new Set(Store.get("achievements", []));
  const r = Store.get("records", { tests: 0 });
  $("#admin-readout").innerHTML =
    `LEVEL <b>${p.level}</b> · XP <b>${p.xp}</b>/${xpForLevel(p.level)} · ` +
    `ACHIEVEMENTS <b>${have.size}/${DEFS.length}</b> · MISSIONS <b>${r.tests || 0}</b> · ` +
    `THEME <b>${Settings.theme}</b> · DAILY <b>${getDaily().doneToday ? "flown" : "open"}</b>`;
}

let toastTimer = null;
function toast(msg) {
  let el = $("#con-toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "con-toast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("on"), 2200);
}

function buildPanel() {
  const body = $("#admin-body");
  body.innerHTML = "";
  const after = (msg) => { refreshReadout(); paintSandbox(); if (msg) toast(msg); };

  section("PROGRESSION");
  row("Level", [
    btn("−5", () => { setLevel(getProgress().level - 5); after("Level set"); }),
    btn("+1", () => { setLevel(getProgress().level + 1); after("Level set"); }),
    btn("+5", () => { setLevel(getProgress().level + 5); after("Level set"); }),
    btn("MAX (20)", () => { setLevel(20); after("Level 20"); }),
    numBox("set", 1, 99, (n) => { setLevel(n); after("Level " + n); }),
  ]);
  row("XP", [
    btn("+500", () => { addXp(500); after("+500 XP"); }),
    btn("+5,000", () => { addXp(5000); after("+5,000 XP"); }),
  ]);

  section("UNLOCKS");
  row("Themes", [
    btn("UNLOCK ALL", () => { unlockAllThemes(); after("All themes unlocked"); }),
    ...Object.entries(THEMES).map(([id, t]) =>
      btn(t.label, () => { setTheme(id); after("Theme: " + t.label); })),
  ]);
  row("Achievements", [
    btn("UNLOCK ALL", () => { Store.set("achievements", DEFS.map(d => d.id)); after("All unlocked"); }),
    btn("CLEAR", () => { Store.set("achievements", []); after("Cleared"); }),
  ]);

  section("MISSION PREVIEW  (opens JANGO in a new tab)");
  row("Modes", [
    ["15s TIMED", { mode: "time", time: 15 }],
    ["60s TIMED", { mode: "time", time: 60 }],
    ["10 WORDS", { mode: "words", words: 10 }],
    ["25 WORDS", { mode: "words", words: 25 }],
    ["100 WORDS", { mode: "words", words: 100 }],
    ["500 WORDS", { mode: "words", words: 500 }],
    ["UNTIMED 50", { mode: "untimed", words: 50 }],
  ].map(([l, patch]) => btn(l, () => preview(patch))));
  row("Content", [
    ["WORDS", { content: "words" }],
    ["SENTENCES", { content: "sentences" }],
    ["QUOTES", { content: "quotes" }],
    ["CODE", { content: "code" }],
    ["NUMBERS", { content: "words", numbers: true }],
    ["PUNCTUATION", { content: "words", punctuation: true }],
    ["SYMBOLS", { content: "words", symbols: true }],
    ["CAPITALS", { content: "words", capitals: true }],
  ].map(([l, patch]) => btn(l, () => preview({ mode: "words", words: 25, ...patch }))));
  row("Difficulty", ["easy", "normal", "hard", "expert"].map(d =>
    btn(d.toUpperCase(), () => preview({ mode: "words", words: 25, difficulty: d }))));

  section("DATA");
  row("Test data", [
    btn("SEED 30-DAY HISTORY", () => { seedHistory(30); after("30 days seeded"); }),
    btn("SEED 90 DAYS", () => { seedHistory(90); after("90 days seeded"); }),
  ]);
  row("Danger", [
    btn("FULL RESET", () => {
      if (confirm("Wipe level, XP, records, achievements, daily streak, settings AND theme on this device?")) {
        fullReset();
        after("Everything reset to defaults");
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
    b.addEventListener("click", fn);
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
