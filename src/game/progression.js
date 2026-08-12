/* ═══════════════════════════════════════════════════════════════════
   progression.js — XP / levels, daily mission, daily goals & streaks

   Three separate streak systems (never conflated):
     • typing combo        — per-keystroke, lives in the engine
     • word streak         — per-word, lives in the engine
     • daily streak        — consecutive days the daily mission was flown
   ═══════════════════════════════════════════════════════════════════ */
import { Store } from "../storage/store.js";
import { emit } from "../bus.js";

/* ── XP / levels ────────────────────────────────────────────────── */
export const xpForLevel = (n) => Math.round(120 * Math.pow(n, 1.6));

export function getProgress() {
  return Object.assign({ level: 1, xp: 0 }, Store.get("progress", {}));
}

/** XP from a finished run: volume × speed × accuracy × difficulty. */
export function xpFor(stats) {
  const diffMult = { easy: 0.8, normal: 1, hard: 1.3, expert: 1.6 }[stats.cfg.difficulty] || 1;
  const accMult = stats.acc >= 98 ? 1.3 : stats.acc >= 95 ? 1.1 : 1;
  return Math.max(5, Math.round((stats.words * 2 + stats.wpm * 0.6) * diffMult * accMult));
}

/** Add XP; emits tv:xp and tv:levelup. Returns the new progress. */
export function addXp(amount, reason = "") {
  const p = getProgress();
  p.xp += amount;
  let leveled = false;
  while (p.xp >= xpForLevel(p.level)) {
    p.xp -= xpForLevel(p.level);
    p.level++;
    leveled = true;
  }
  Store.set("progress", p);
  emit("tv:xp", { amount, reason, ...p, need: xpForLevel(p.level) });
  if (leveled) emit("tv:levelup", { level: p.level });
  return p;
}

/* ── daily mission (deterministic from the date) ────────────────── */
const dayKey = (d = new Date()) => d.toISOString().slice(0, 10);

export function getDaily() {
  // simple date hash → stable mission for everyone, all day
  let h = 0;
  for (const ch of dayKey()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const diffs = ["normal", "normal", "hard", "hard", "expert"];
  const contents = ["words", "words", "sentences", "quotes"];
  const daily = {
    words: [50, 75, 100][h % 3],
    difficulty: diffs[h % diffs.length],
    content: contents[(h >> 3) % contents.length],
    punctuation: h % 2 === 0,
    numbers: h % 5 === 0,
    reward: 500,
  };
  const state = Store.get("daily", { lastDone: null, streak: 0 });
  daily.doneToday = state.lastDone === dayKey();
  daily.streak = state.streak;
  return daily;
}

/** Call when a daily-flagged mission finishes. Returns reward or 0. */
export function completeDaily() {
  const state = Store.get("daily", { lastDone: null, streak: 0 });
  const today = dayKey();
  if (state.lastDone === today) return 0;                 // already claimed
  const yesterday = dayKey(new Date(Date.now() - 864e5));
  state.streak = state.lastDone === yesterday ? state.streak + 1 : 1;
  state.lastDone = today;
  Store.set("daily", state);
  addXp(500, "daily mission");
  emit("tv:daily", { streak: state.streak });
  return 500;
}

/* ── daily goals ────────────────────────────────────────────────── */
const GOALS = [
  { id: "words", label: "TYPE 1,000 WORDS", target: 1000, pick: (s) => s.words },
  { id: "tests", label: "COMPLETE 3 MISSIONS", target: 3, pick: () => 1 },
  { id: "wpm",   label: "HIT 80 WPM ONCE", target: 1, pick: (s) => (s.wpm >= 80 ? 1 : 0) },
];

function goalState() {
  const st = Store.get("goals", { day: null, progress: {} });
  if (st.day !== dayKey()) { st.day = dayKey(); st.progress = {}; Store.set("goals", st); }
  return st;
}

export function recordGoalProgress(stats) {
  const st = goalState();
  for (const g of GOALS) {
    const cur = st.progress[g.id] || 0;
    if (cur >= g.target) continue;
    const next = Math.min(g.target, cur + g.pick(stats));
    st.progress[g.id] = next;
    if (next >= g.target && cur < g.target) addXp(150, "goal: " + g.label);
  }
  Store.set("goals", st);
}

export function getGoals() {
  const st = goalState();
  return GOALS.map(g => ({ ...g, done: (st.progress[g.id] || 0) >= g.target, value: st.progress[g.id] || 0 }));
}
