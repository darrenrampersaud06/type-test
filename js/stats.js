/* ═══════════════════════════════════════════════════════════════════
   stats.js — metrics, missed-key analytics, keyboard heat-map, charts

   Data structures on purpose:
     • Map<string, {miss, hit}>  — per-key accuracy (hash map, O(1) update
       on every keystroke, which happens hundreds of times per test)
     • number[] wpmSamples       — one WPM reading per second, used for the
       consistency score and the results chart
   ═══════════════════════════════════════════════════════════════════ */
"use strict";

const Stats = (() => {

  /* ── keyboard heat-map ──────────────────────────────────────── */
  const LAYOUT = [
    ["q","w","e","r","t","y","u","i","o","p"],
    ["a","s","d","f","g","h","j","k","l",";"],
    ["z","x","c","v","b","n","m",",",".","'"],
    ["space"],
  ];

  /** Build the visual keyboard inside `container`; returns key → element map. */
  function buildKeyboard(container) {
    container.innerHTML = "";
    const els = new Map();
    for (const row of LAYOUT) {
      const rowEl = document.createElement("div");
      rowEl.className = "keyboard__row";
      for (const k of row) {
        const el = document.createElement("div");
        el.className = "key" + (k === "space" ? " key--wide" : "");
        el.textContent = k === "space" ? "␣ space" : k;
        el.dataset.key = k;
        rowEl.appendChild(el);
        els.set(k, el);
      }
      container.appendChild(rowEl);
    }
    return els;
  }

  /** Paint heat levels onto a built keyboard from a missMap. */
  function paintHeat(els, missMap) {
    let max = 0;
    for (const { miss } of missMap.values()) max = Math.max(max, miss);
    for (const [k, el] of els) {
      el.classList.remove("heat-1", "heat-2", "heat-3");
      el.querySelector(".key__count")?.remove();
      const rec = missMap.get(k);
      if (!rec || rec.miss === 0 || max === 0) continue;
      const ratio = rec.miss / max;                       // normalize to worst key
      el.classList.add(ratio > 0.66 ? "heat-3" : ratio > 0.33 ? "heat-2" : "heat-1");
      const badge = document.createElement("span");
      badge.className = "key__count";
      badge.textContent = rec.miss;
      el.appendChild(badge);
    }
  }

  /* ── math ───────────────────────────────────────────────────── */
  // Standard WPM definition: (correct chars / 5) / minutes.
  const wpm = (correctChars, seconds) =>
    seconds <= 0 ? 0 : Math.round((correctChars / 5) / (seconds / 60));

  const accuracy = (correct, incorrect) => {
    const total = correct + incorrect;
    return total === 0 ? 100 : Math.round((correct / total) * 100);
  };

  // Consistency = 100 − coefficient of variation of per-second WPM samples.
  function consistency(samples) {
    const s = samples.filter(v => v > 0);
    if (s.length < 2) return 100;
    const mean = s.reduce((a, b) => a + b, 0) / s.length;
    const variance = s.reduce((a, b) => a + (b - mean) ** 2, 0) / s.length;
    const cv = Math.sqrt(variance) / mean;
    return Math.max(0, Math.round((1 - cv) * 100));
  }

  /* ── per-user persistence ───────────────────────────────────── */
  const userKey = () => "data." + (Auth.user() || "guest");

  function loadUserData() {
    return Store.get(userKey(), { runs: [], missed: {} });
  }

  /** Persist one finished run; merges its missMap into the all-time tally. */
  function saveRun(run, missMap) {
    const data = loadUserData();
    data.runs.push(run);
    if (data.runs.length > 200) data.runs = data.runs.slice(-200); // cap history
    for (const [k, rec] of missMap) {
      const prev = data.missed[k] || { miss: 0, hit: 0 };
      data.missed[k] = { miss: prev.miss + rec.miss, hit: prev.hit + rec.hit };
    }
    Store.set(userKey(), data);
    return data;
  }

  const bestWpm = (data) => data.runs.reduce((m, r) => Math.max(m, r.wpm), 0);

  /* ── charts (plain canvas, no libraries) ────────────────────── */
  function drawLineChart(canvas, values, { label = "" } = {}) {
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    const PAD = 34;
    ctx.clearRect(0, 0, W, H);

    const css = getComputedStyle(document.documentElement);
    const cLine  = css.getPropertyValue("--accent-2").trim() || "#58a6ff";
    const cGrid  = css.getPropertyValue("--line").trim() || "#21262d";
    const cText  = css.getPropertyValue("--text-dim").trim() || "#7d8590";

    if (values.length < 2) {
      ctx.fillStyle = cText;
      ctx.font = "14px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("complete a couple of tests to see a chart here", W / 2, H / 2);
      return;
    }

    const max = Math.max(...values) * 1.15 || 1;
    const x = (i) => PAD + (i / (values.length - 1)) * (W - PAD * 2);
    const y = (v) => H - PAD - (v / max) * (H - PAD * 2);

    // grid + y labels
    ctx.strokeStyle = cGrid; ctx.fillStyle = cText;
    ctx.font = "11px 'JetBrains Mono', monospace"; ctx.textAlign = "right";
    for (let g = 0; g <= 4; g++) {
      const gy = PAD + (g / 4) * (H - PAD * 2);
      ctx.beginPath(); ctx.moveTo(PAD, gy); ctx.lineTo(W - PAD, gy); ctx.stroke();
      ctx.fillText(Math.round(max * (1 - g / 4)), PAD - 8, gy + 4);
    }

    // area fill under the line
    const grad = ctx.createLinearGradient(0, PAD, 0, H - PAD);
    grad.addColorStop(0, "rgba(88,166,255,.25)");
    grad.addColorStop(1, "rgba(88,166,255,0)");
    ctx.beginPath();
    ctx.moveTo(x(0), y(values[0]));
    values.forEach((v, i) => ctx.lineTo(x(i), y(v)));
    ctx.lineTo(x(values.length - 1), H - PAD);
    ctx.lineTo(x(0), H - PAD);
    ctx.closePath();
    ctx.fillStyle = grad; ctx.fill();

    // the line itself
    ctx.beginPath();
    ctx.moveTo(x(0), y(values[0]));
    values.forEach((v, i) => ctx.lineTo(x(i), y(v)));
    ctx.strokeStyle = cLine; ctx.lineWidth = 2.5; ctx.lineJoin = "round"; ctx.stroke();

    // dots
    ctx.fillStyle = cLine;
    values.forEach((v, i) => {
      ctx.beginPath(); ctx.arc(x(i), y(v), 3, 0, Math.PI * 2); ctx.fill();
    });

    if (label) {
      ctx.fillStyle = cText; ctx.textAlign = "left";
      ctx.font = "12px Inter, sans-serif";
      ctx.fillText(label, PAD, 18);
    }
  }

  /* ── profile view rendering ─────────────────────────────────── */
  function renderProfile() {
    const u = Auth.user();
    const data = loadUserData();

    document.getElementById("profile-avatar").textContent = u ? u[0] : "?";
    document.getElementById("profile-name").textContent = u || "guest";
    document.getElementById("profile-meta").textContent = u
      ? `member since ${new Date(Store.get("users", {})[u]?.createdAt || Date.now()).toLocaleDateString()}`
      : "log in to start tracking your progress — guest runs are kept on this device only";

    const runs = data.runs;
    const avg = (sel) => runs.length ? Math.round(runs.reduce((a, r) => a + sel(r), 0) / runs.length) : 0;
    document.getElementById("pf-tests").textContent = runs.length;
    document.getElementById("pf-best").textContent  = bestWpm(data);
    document.getElementById("pf-avg").textContent   = avg(r => r.wpm);
    document.getElementById("pf-acc").textContent   = avg(r => r.acc) + "%";

    drawLineChart(document.getElementById("pf-chart"), runs.map(r => r.wpm), { label: "wpm per test" });

    // all-time heat-map (stored as a plain object → rebuild the Map)
    const missMap = new Map(Object.entries(data.missed));
    const els = buildKeyboard(document.getElementById("pf-keyboard"));
    paintHeat(els, missMap);

    // recent runs table (last 12, newest first)
    const tbody = document.querySelector("#pf-table tbody");
    tbody.innerHTML = "";
    for (const r of runs.slice(-12).reverse()) {
      const tr = document.createElement("tr");
      tr.innerHTML =
        `<td>${new Date(r.at).toLocaleString()}</td><td>${r.mode}</td>` +
        `<td>${r.wpm}</td><td>${r.acc}%</td><td>${r.raw}</td>`;
      tbody.appendChild(tr);
    }
  }

  return {
    buildKeyboard, paintHeat,
    wpm, accuracy, consistency,
    loadUserData, saveRun, bestWpm,
    drawLineChart, renderProfile,
  };
})();
