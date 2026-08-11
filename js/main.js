/* ═══════════════════════════════════════════════════════════════════
   main.js — the test engine + app shell

   A small finite-state machine drives everything:

        IDLE ──first keystroke──▶ RUNNING ──timer hits 0──▶ DONE
          ▲                                                  │
          └───────────────── restart ────────────────────────┘

   Per-keystroke work is O(1): counters increment, and the per-key
   accuracy lives in a Map (hash map) keyed by the *expected* character —
   the key you SHOULD have hit is the one you're missing.
   ═══════════════════════════════════════════════════════════════════ */
"use strict";

(() => {
  /* ── elements ───────────────────────────────────────────────── */
  const zone      = document.getElementById("belt-zone");
  const hint      = document.getElementById("belt-hint");
  const configBar = document.getElementById("config-bar");
  const liveBox   = document.getElementById("live-stats");
  const elTimer   = document.getElementById("live-timer");
  const elWpm     = document.getElementById("live-wpm");
  const elAcc     = document.getElementById("live-acc");
  const progress  = document.getElementById("top-progress-fill");

  const views = {
    test:    document.getElementById("view-test"),
    results: document.getElementById("view-results"),
    profile: document.getElementById("view-profile"),
  };

  /* ── settings ───────────────────────────────────────────────── */
  const settings = Object.assign({ time: 30, punctuation: false }, Store.get("settings", {}));

  /* ── state ──────────────────────────────────────────────────── */
  const BATCH = 40;               // words generated per refill
  let state = "idle";             // idle | running | done
  let words = [];                 // target words (parallel to Belt's elements)
  let wordIndex = 0;
  let typed = "";                 // what's been typed for the current word
  let timeLeft = settings.time;
  let startedAt = 0;
  let timerId = null;

  // per-run counters
  let correctChars, wrongChars, missedChars, keystrokes;
  let missMap;                    // Map<expectedKey, {miss, hit}>
  let wpmSamples;                 // one reading per second → chart + consistency

  const liveKeyboard = Stats.buildKeyboard(document.getElementById("keyboard"));

  /* combo streak — consecutive correct keystrokes */
  const comboEl = document.getElementById("combo");
  let streak = 0, bestStreak = 0;
  function bumpCombo() {
    streak++;
    if (streak > bestStreak) bestStreak = streak;
    if (streak >= 5) {
      comboEl.textContent = `🔥 ${streak}`;
      comboEl.classList.add("is-on");
      comboEl.classList.remove("pulse");
      void comboEl.offsetWidth;            // restart the pulse animation
      comboEl.classList.add("pulse");
    }
  }
  function breakCombo() {
    if (streak >= 15) {                    // a streak worth mourning
      comboEl.textContent = "💥";
      setTimeout(() => comboEl.classList.remove("is-on"), 350);
    } else {
      comboEl.classList.remove("is-on");
    }
    streak = 0;
  }

  /* the hint should vanish the moment the zone is focused (click or tab),
     and come back if you click away before starting */
  function updateHint() {
    const show = state === "idle" && document.activeElement !== zone;
    hint.classList.toggle("is-hidden", !show);
  }
  zone.addEventListener("focus", updateHint);
  zone.addEventListener("blur", updateHint);

  /* ── lifecycle ──────────────────────────────────────────────── */
  function reset() {
    clearInterval(timerId);
    state = "idle";
    Words.resetSentence();
    words = Words.next(BATCH, settings);
    wordIndex = 0;
    typed = "";
    timeLeft = settings.time;
    startedAt = 0;
    correctChars = wrongChars = missedChars = keystrokes = 0;
    missMap = new Map();
    wpmSamples = [];

    Belt.load(words);
    Stats.paintHeat(liveKeyboard, missMap);
    elTimer.textContent = settings.time;
    elWpm.textContent = "0";
    elAcc.textContent = "100";
    liveBox.classList.remove("is-on");
    configBar.classList.remove("is-hidden");
    zone.classList.remove("is-typing");
    progress.style.width = "0%";
    progress.classList.remove("is-done");
    streak = 0; bestStreak = 0;
    comboEl.classList.remove("is-on");
    zone.classList.add("is-idle");
    showView("test");
    updateHint();
  }

  function start() {
    state = "running";
    startedAt = performance.now();
    liveBox.classList.add("is-on");
    configBar.classList.add("is-hidden");   // config melts away while typing
    hint.classList.add("is-hidden");
    zone.classList.remove("is-idle");
    timerId = setInterval(tick, 1000);
  }

  function tick() {
    timeLeft--;
    elTimer.textContent = timeLeft;

    const elapsed = settings.time - timeLeft;
    wpmSamples.push(Stats.wpm(correctChars, elapsed));
    elWpm.textContent = wpmSamples[wpmSamples.length - 1];
    elAcc.textContent = Stats.accuracy(correctChars, wrongChars + missedChars);

    // GitHub-style top bar fills as the run progresses
    progress.style.width = `${(elapsed / settings.time) * 100}%`;

    if (timeLeft <= 0) finish();
  }

  function finish() {
    clearInterval(timerId);
    state = "done";
    progress.style.width = "100%";
    progress.classList.add("is-done");
    Sound.play("finish");
    showResults();
  }

  /* ── keystroke handling ─────────────────────────────────────── */
  function recordKey(expected, hit) {
    // normalize: letters lowercased, space bucketed as "space"
    const k = expected === " " ? "space" : expected.toLowerCase();
    const rec = missMap.get(k) || { miss: 0, hit: 0 };
    hit ? rec.hit++ : rec.miss++;
    missMap.set(k, rec);
    if (!hit) Stats.paintHeat(liveKeyboard, missMap);   // live heat update
  }

  function flashKey(ch) {
    const k = ch === " " ? "space" : ch.toLowerCase();
    const el = liveKeyboard.get(k);
    if (!el) return;
    el.classList.add("is-pressed");
    setTimeout(() => el.classList.remove("is-pressed"), 90);
  }

  function onKeydown(e) {
    // Tab+Enter restart combo (Tab alone just arms it)
    if (e.key === "Tab") { e.preventDefault(); armRestart = true; return; }
    if (e.key === "Enter" && armRestart) { reset(); armRestart = false; return; }
    armRestart = false;

    if (state === "done") return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (views.test !== document.querySelector(".view--active")) return;

    const target = words[wordIndex];

    if (e.key === "Backspace") {
      e.preventDefault();
      if (typed.length > 0) {
        typed = typed.slice(0, -1);
        Belt.paintActive(target, typed);
      }
      return;
    }

    if (e.key === " ") {
      e.preventDefault();
      if (state !== "running" || typed.length === 0) return; // ignore leading spaces
      // chars the user never reached count as missed
      const skipped = Math.max(0, target.length - typed.length);
      missedChars += skipped;
      for (let i = typed.length; i < target.length; i++) recordKey(target[i], false);

      const perfect = typed === target;
      correctChars++;                    // the space itself counts as a correct char
      recordKey(" ", true);
      flashKey(" ");
      if (perfect) { FX.sparks(1 + Math.min(streak / 60, 1)); bumpCombo(); }
      else breakCombo();                 // skipped letters end the streak too
      Belt.advance(perfect);
      wordIndex++;
      typed = "";

      // stream more words in so the belt never runs dry
      if (Belt.remaining() < 15) {
        const more = Words.next(BATCH, settings);
        words.push(...more);
        Belt.append(more);
      }
      return;
    }

    if (e.key.length !== 1) return;      // ignore F-keys, arrows, etc.
    e.preventDefault();

    if (state === "idle") start();
    zone.classList.add("is-typing");
    keystrokes++;

    if (typed.length >= target.length + 8) return; // cap overtyping

    const pos = typed.length;
    typed += e.key;

    flashKey(e.key);                     // on-screen keyboard reacts to every press
    const expected = target[pos];
    if (expected !== undefined) {
      const hit = e.key === expected;
      hit ? correctChars++ : wrongChars++;
      recordKey(expected, hit);
      if (hit) { Sound.play("click"); bumpCombo(); }
      else     { Sound.play("error"); Belt.shake(); breakCombo(); }
    } else {
      wrongChars++;                      // extra chars beyond the word
      Sound.play("error");
      Belt.shake();
      breakCombo();
    }

    Belt.paintActive(target, typed);
  }
  let armRestart = false;

  /* ── results ────────────────────────────────────────────────── */
  /** Animate a number from 0 to target over ~700ms (ease-out). */
  function countUp(el, target, suffix = "") {
    const t0 = performance.now();
    (function step(now) {
      const p = Math.min((now - t0) / 700, 1);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))) + suffix;
      if (p < 1) requestAnimationFrame(step);
    })(t0);
  }

  const RANKS = [   // [min wpm, label] — first match from the top wins
    [130, "⚡ lightning hands"],
    [100, "🚀 blazing"],
    [80,  "🏎️ fast fingers"],
    [60,  "🏃 getting quick"],
    [40,  "🐢 steady climber"],
    [20,  "🌱 warming up"],
    [0,   "🐌 everyone starts somewhere"],
  ];
  const rankFor = (w) => RANKS.find(([min]) => w >= min)[1];

  function showResults() {
    const finalWpm = Stats.wpm(correctChars, settings.time);
    const raw      = Stats.wpm(keystrokes, settings.time);
    const acc      = Stats.accuracy(correctChars, wrongChars + missedChars);
    const cons     = Stats.consistency(wpmSamples);
    const mode     = `${settings.time}s ${settings.punctuation ? "punctuation" : "words"}`;

    countUp(document.getElementById("res-wpm"), finalWpm);
    countUp(document.getElementById("res-acc"), acc, "%");
    document.getElementById("res-rank").innerHTML =
      `<b>${rankFor(finalWpm)}</b> · 🔥 longest streak: ${bestStreak} keys`;
    document.getElementById("res-raw").textContent   = raw;
    document.getElementById("res-cons").textContent  = cons + "%";
    document.getElementById("res-chars").textContent = `${correctChars}/${wrongChars}/${missedChars}`;
    document.getElementById("res-mode").textContent  = mode;

    // ranked problem keys — worst first (sorted by miss count)
    const listEl = document.getElementById("res-missed-list");
    listEl.innerHTML = "";
    const worst = [...missMap.entries()]
      .filter(([, r]) => r.miss > 0)
      .sort((a, b) => b[1].miss - a[1].miss)
      .slice(0, 8);
    if (worst.length === 0) {
      listEl.innerHTML = `<span class="missed-list__empty">flawless — not a single missed key 🎯</span>`;
    } else {
      for (const [k, r] of worst) {
        const total = r.miss + r.hit;
        const chip = document.createElement("span");
        chip.className = "mkey";
        chip.innerHTML = `<b>${k === "space" ? "␣" : k}</b> ${r.miss}× missed · ${Math.round((r.miss / total) * 100)}% error`;
        listEl.appendChild(chip);
      }
    }

    Stats.drawLineChart(document.getElementById("res-chart"), wpmSamples, { label: "wpm over time" });

    // persist + personal-best fanfare
    const prevBest = Stats.bestWpm(Stats.loadUserData());
    Stats.saveRun({ at: Date.now(), mode, wpm: finalWpm, raw, acc, cons, streak: bestStreak }, missMap);
    const note = document.getElementById("res-save-note");
    if (finalWpm > prevBest && prevBest > 0) {
      Sound.play("levelup");
      FX.confetti();
      note.textContent = `🏆 new personal best! previous: ${prevBest} wpm`;
    } else {
      note.textContent = Auth.user()
        ? `saved to ${Auth.user()}'s history`
        : "playing as guest — runs are saved on this device; log in to keep a named history";
    }

    showView("results");
  }

  /* ── view switching ─────────────────────────────────────────── */
  function showView(name) {
    for (const [n, el] of Object.entries(views)) {
      el.classList.toggle("view--active", n === name);
    }
    document.getElementById("nav-test").classList.toggle("is-active", name === "test");
    document.getElementById("nav-profile").classList.toggle("is-active", name === "profile");
    if (name === "profile") Stats.renderProfile();
    if (name === "test") zone.focus();
  }

  /* ── wiring ─────────────────────────────────────────────────── */
  document.addEventListener("keydown", onKeydown);
  zone.addEventListener("click", () => zone.focus());

  document.getElementById("btn-restart").onclick = reset;
  document.getElementById("btn-again").onclick = reset;
  document.getElementById("btn-to-profile").onclick = () => showView("profile");
  document.getElementById("nav-test").onclick = () => { if (state === "done" || state === "idle") reset(); else showView("test"); };
  document.getElementById("nav-profile").onclick = () => showView("profile");
  document.getElementById("brand-home").onclick = reset;

  // sound toggle
  const soundBtn = document.getElementById("nav-sound");
  const paintSound = () => soundBtn.textContent = Sound.isEnabled() ? "🔊" : "🔇";
  soundBtn.onclick = () => { Sound.toggle(); paintSound(); };
  paintSound();

  // config chips: punctuation on/off
  document.getElementById("chip-words").onclick = () => setPunct(false);
  document.getElementById("chip-punct").onclick = () => setPunct(true);
  function setPunct(on) {
    settings.punctuation = on;
    document.getElementById("chip-words").classList.toggle("chip--active", !on);
    document.getElementById("chip-punct").classList.toggle("chip--active", on);
    persistSettings(); reset();
  }

  // config chips: duration
  document.querySelectorAll(".chip--time").forEach(chip => {
    chip.onclick = () => {
      settings.time = Number(chip.dataset.time);
      document.querySelectorAll(".chip--time").forEach(c => c.classList.toggle("chip--active", c === chip));
      persistSettings(); reset();
    };
  });
  // reflect persisted settings in the UI on boot
  document.querySelectorAll(".chip--time").forEach(c =>
    c.classList.toggle("chip--active", Number(c.dataset.time) === settings.time));
  document.getElementById("chip-words").classList.toggle("chip--active", !settings.punctuation);
  document.getElementById("chip-punct").classList.toggle("chip--active", settings.punctuation);

  const persistSettings = () => Store.set("settings", settings);

  // profile refreshes when auth state changes while it's open
  Auth.onChange(() => {
    if (views.profile.classList.contains("view--active")) Stats.renderProfile();
  });

  /* ── go ─────────────────────────────────────────────────────── */
  reset();
})();
