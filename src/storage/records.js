import { Store } from "./store.js";

/* Personal bests + lifetime totals, all local. */
const defaults = {
  bestWpm: 0, bestAcc: 0, bestCombo: 0, bestConsistency: 0,
  tests: 0, totalWords: 0, totalChars: 0,
  history: [],              // last 50 runs for future graphs
};

export function getRecords() {
  return Object.assign({}, defaults, Store.get("records", {}));
}

/** Merge a finished run into the records; returns which records were broken. */
export function updateRecords(stats) {
  const r = getRecords();
  const broken = [];
  if (stats.wpm > r.bestWpm) { r.bestWpm = stats.wpm; broken.push("wpm"); }
  if (stats.acc > r.bestAcc) { r.bestAcc = stats.acc; broken.push("acc"); }
  if (stats.maxCombo > r.bestCombo) { r.bestCombo = stats.maxCombo; broken.push("combo"); }
  if (stats.consistency > r.bestConsistency) { r.bestConsistency = stats.consistency; broken.push("consistency"); }
  r.tests += 1;
  r.totalWords += stats.words;
  r.totalChars += stats.correct + stats.incorrect;
  r.totalTime = (r.totalTime || 0) + stats.elapsed;
  r.history.push({
    at: Date.now(), wpm: stats.wpm, acc: stats.acc, raw: stats.raw,
    mode: `${stats.cfg.mode === "time" ? Math.round(stats.cfg.time) + "s" : stats.words + "w"} ${stats.cfg.difficulty}`,
  });
  if (r.history.length > 200) r.history = r.history.slice(-200);
  Store.set("records", r);
  return { records: r, broken };
}
