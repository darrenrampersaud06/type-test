/* ═══════════════════════════════════════════════════════════════════
   engine.js — the typing engine

   State machine:  idle → running ⇄ paused → done

   Character states: untyped | current | correct | incorrect | corrected
   Errors are committed permanently the moment they happen — backspacing
   and fixing marks the char "corrected" but never erases the mistake
   from accuracy history.

   Emits on the bus:
     tv:start   — first keystroke
     tv:char    {correct, expected, typed}
     tv:word    {perfect, index, streak}    streak = consecutive perfect words
     tv:progress{...metrics}
     tv:finish  {...full stats}
   ═══════════════════════════════════════════════════════════════════ */
import { emit } from "../bus.js";
import { generate } from "./textGenerator.js";

export class Engine {
  constructor() {
    this.state = "idle";
    this.tickId = null;
  }

  /** Build a fresh test from a mission config. */
  load(cfg) {
    this.stopTick();
    this.cfg = cfg;
    this.state = "idle";
    const wordCount = cfg.mode === "time"
      ? Math.max(80, Math.ceil((cfg.time / 60) * 300))   // enough for ~300wpm
      : cfg.words;
    this.words = generate(cfg, wordCount);
    // flat char stream: word chars + a single space between words
    this.chars = [];
    this.words.forEach((w, wi) => {
      [...w].forEach((ch, ci) => this.chars.push({ ch, wi, ci, state: "untyped" }));
      if (wi < this.words.length - 1) this.chars.push({ ch: " ", wi, ci: w.length, state: "untyped", isSpace: true });
    });
    this.index = 0;
    this.startStamp = 0;
    this.pausedAccum = 0;
    this.pauseStamp = 0;

    this.correct = 0; this.incorrect = 0; this.corrected = 0; this.keystrokes = 0;
    this.combo = 0; this.maxCombo = 0;
    this.wordStreak = 0;
    this.wordsDone = 0;
    this.wordHadError = false;
    this.samples = [];
    this.missMap = new Map();      // expected char → miss count (per-key analytics)
  }

  /* ── time helpers (pause-aware) ─────────────────────────────── */
  elapsed() {
    if (!this.startStamp) return 0;
    const until = this.state === "paused" ? this.pauseStamp : performance.now();
    return (until - this.startStamp - this.pausedAccum) / 1000;
  }
  remaining() {
    return this.cfg.mode === "time" ? Math.max(0, this.cfg.time - this.elapsed()) : null;
  }

  start() {
    this.state = "running";
    this.startStamp = performance.now();
    emit("tv:start", { cfg: this.cfg });
    this.tickId = setInterval(() => this.tick(), 250);
  }
  pause() {
    if (this.state !== "running") return;
    this.state = "paused";
    this.pauseStamp = performance.now();
  }
  resume() {
    if (this.state !== "paused") return;
    this.pausedAccum += performance.now() - this.pauseStamp;
    this.state = "running";
  }
  stopTick() { clearInterval(this.tickId); this.tickId = null; }

  tick() {
    if (this.state !== "running") return;
    const m = this.metrics();
    // one sample per second for the results graph
    if (!this.lastSampleAt || m.elapsed - this.lastSampleAt >= 1) {
      this.lastSampleAt = Math.floor(m.elapsed);
      this.samples.push({ t: this.lastSampleAt, wpm: m.wpm, acc: m.acc });
    }
    emit("tv:progress", m);
    if (this.cfg.mode === "time" && m.remaining <= 0) this.finish();
  }

  /* ── input ──────────────────────────────────────────────────── */
  /** Feed one printable character. */
  type(ch) {
    if (this.state === "done" || this.state === "paused") return;
    if (this.state === "idle") this.start();

    const cur = this.chars[this.index];
    if (!cur) return;
    this.keystrokes++;

    const hit = ch === cur.ch;
    if (hit) {
      cur.state = cur.wasWrong ? "corrected" : "correct";
      this.correct++;
      if (cur.wasWrong) this.corrected++;
      this.combo++;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;
    } else {
      cur.state = "incorrect";
      cur.wasWrong = true;
      this.incorrect++;
      this.combo = 0;
      this.wordHadError = true;
      this.missMap.set(cur.ch, (this.missMap.get(cur.ch) || 0) + 1);
    }
    this.index++;
    emit("tv:char", { correct: hit, expected: cur.ch, typed: ch, combo: this.combo });

    // word boundary: we just consumed a space, or the whole text is done
    if (cur.isSpace || this.index >= this.chars.length) {
      const wi = cur.wi;
      const perfect = !this.wordHadError;
      this.wordsDone++;
      this.wordStreak = perfect ? this.wordStreak + 1 : 0;
      this.wordHadError = false;
      emit("tv:word", { perfect, index: wi, streak: this.wordStreak });
    }

    emit("tv:progress", this.metrics());

    if (this.index >= this.chars.length) this.finish();
  }

  /** Backspace — only within the current word (can't cross the last space). */
  backspace() {
    if (this.state !== "running") return;
    const prev = this.chars[this.index - 1];
    if (!prev || prev.isSpace) return;
    this.index--;
    prev.state = "untyped";
    emit("tv:progress", this.metrics());
  }

  /* ── metrics ────────────────────────────────────────────────── */
  metrics() {
    const el = Math.max(this.elapsed(), 0.001);
    const minutes = el / 60;
    const wpm = Math.round((this.correct / 5) / minutes);
    const raw = Math.round((this.keystrokes / 5) / minutes);
    const total = this.correct + this.incorrect;
    const acc = total === 0 ? 100 : Math.round((this.correct / total) * 1000) / 10;
    return {
      wpm, raw, acc,
      cpm: Math.round(this.correct / minutes),
      errors: this.incorrect,
      correct: this.correct, incorrect: this.incorrect, corrected: this.corrected,
      elapsed: el, remaining: this.remaining(),
      wordsDone: this.wordsDone, totalWords: this.words.length,
      combo: this.combo, maxCombo: this.maxCombo, streak: this.wordStreak,
      nextChar: this.chars[this.index]?.ch ?? null,
      index: this.index,
    };
  }

  consistency() {
    const s = this.samples.map(x => x.wpm).filter(v => v > 0);
    if (s.length < 3) return 100;
    const mean = s.reduce((a, b) => a + b, 0) / s.length;
    const sd = Math.sqrt(s.reduce((a, b) => a + (b - mean) ** 2, 0) / s.length);
    return Math.max(0, Math.round((1 - sd / mean) * 100));
  }

  finish() {
    if (this.state === "done") return;
    this.state = "done";
    this.stopTick();
    const m = this.metrics();
    const stats = {
      ...m,
      consistency: this.consistency(),
      samples: this.samples,
      words: this.wordsDone,
      chars: this.correct + this.incorrect,
      missMap: this.missMap,
      cfg: this.cfg,
    };
    emit("tv:finish", stats);
  }
}
