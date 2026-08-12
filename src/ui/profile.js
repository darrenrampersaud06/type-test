/* ═══════════════════════════════════════════════════════════════════
   profile.js — COMMANDER PROFILE screen

   Avatar picker, level/XP, analytics cards, WPM/accuracy trend graph
   with 7/30/90-day/all-time ranges, sortable mission history, and the
   full achievements grid. Reads whatever the storage layer holds —
   which cloud.js overwrites with database truth on login.
   ═══════════════════════════════════════════════════════════════════ */
import { Store } from "../storage/store.js";
import { getRecords } from "../storage/records.js";
import { getProgress, xpForLevel } from "../game/progression.js";
import { DEFS, unlockedIds } from "../game/achievements.js";
import * as Cloud from "../cloud/cloud.js";
import { play } from "../audio/sfx.js";
import { renderChip } from "./auth.js";

const $ = (s) => document.querySelector(s);
const AVATARS = ["🧑‍🚀", "🤖", "👨‍✈️", "👽", "🦾", "🛰️"];

let range = "all";   // 7 | 30 | 90 | all
let sortKey = "at";

export function initProfile() {
  // avatar picker
  const row = $("#pf-avatars");
  AVATARS.forEach(a => {
    const b = document.createElement("button");
    b.className = "avatar-opt";
    b.textContent = a;
    b.addEventListener("click", () => {
      Store.set("avatar", a);
      Cloud.upsertProfile({ avatar: a }).catch(() => {});
      renderChip();
      renderProfile();
      play("ui");
    });
    row.appendChild(b);
  });
  // graph range chips
  document.querySelectorAll("#pf-ranges .chip").forEach(c =>
    c.addEventListener("click", () => {
      range = c.dataset.v;
      document.querySelectorAll("#pf-ranges .chip").forEach(x => x.classList.toggle("on", x === c));
      renderProfile();
      play("ui");
    }));
  // sortable history
  document.querySelectorAll("#pf-table th[data-k]").forEach(th =>
    th.addEventListener("click", () => { sortKey = th.dataset.k; renderProfile(); }));
}

export function renderProfile() {
  const r = getRecords();
  const p = getProgress();
  const u = Cloud.user();
  const meta = u?.user_metadata || {};

  $("#pf-avatar-big").textContent = Store.get("avatar", "🧑‍🚀");
  document.querySelectorAll(".avatar-opt").forEach(b =>
    b.classList.toggle("on", b.textContent === Store.get("avatar", "🧑‍🚀")));
  $("#pf-name").textContent = (meta.display_name || meta.username || "GUEST PILOT").toUpperCase();
  $("#pf-sub").textContent = u
    ? `@${meta.username || (u.email || "").split("@")[0]} · enlisted ${new Date(u.created_at).toLocaleDateString()}`
    : "local mode — sign in to sync across devices";

  // level + xp
  const need = xpForLevel(p.level);
  $("#pf-level").textContent = "LEVEL " + p.level;
  $("#pf-xp-label").textContent = `${p.xp.toLocaleString()} / ${need.toLocaleString()} XP`;
  $("#pf-xp-fill").style.width = Math.min(100, (p.xp / need) * 100) + "%";

  // analytics cards
  const hist = r.history || [];
  const avg = (sel) => hist.length ? Math.round(hist.reduce((a, h) => a + sel(h), 0) / hist.length) : 0;
  const cards = [
    ["AVG WPM", avg(h => h.wpm)], ["BEST WPM", r.bestWpm],
    ["AVG ACC", avg(h => h.acc) + "%"], ["BEST ACC", r.bestAcc + "%"],
    ["BEST COMBO", "x" + r.bestCombo], ["CONSISTENCY", r.bestConsistency + "%"],
    ["MISSIONS", r.tests], ["WORDS", (r.totalWords || 0).toLocaleString()],
    ["CHARACTERS", (r.totalChars || 0).toLocaleString()],
    ["TIME FLOWN", Math.round((r.totalTime || 0) / 60) + "m"],
  ];
  $("#pf-cards").innerHTML = cards.map(([k, v]) =>
    `<div><span>${k}</span><b>${v}</b></div>`).join("");

  drawTrend(filtered(hist));
  renderHistoryTable(hist);
  renderAchievements();
}

function filtered(hist) {
  if (range === "all") return hist;
  const cutoff = Date.now() - Number(range) * 864e5;
  return hist.filter(h => h.at >= cutoff);
}

function drawTrend(hist) {
  const cv = $("#pf-graph");
  const ctx = cv.getContext("2d");
  const W = cv.width, H = cv.height, P = 30;
  ctx.clearRect(0, 0, W, H);
  if (hist.length < 2) {
    ctx.fillStyle = "rgba(140,170,210,.55)";
    ctx.font = "13px system-ui"; ctx.textAlign = "center";
    ctx.fillText("fly more missions in this range to see your trend", W / 2, H / 2);
    return;
  }
  const maxW = Math.max(...hist.map(h => h.wpm)) * 1.15 || 1;
  const x = (i) => P + (i / (hist.length - 1)) * (W - P * 2);
  ctx.strokeStyle = "rgba(56,182,255,.12)";
  ctx.fillStyle = "rgba(140,170,210,.5)"; ctx.font = "10px monospace"; ctx.textAlign = "right";
  for (let g = 0; g <= 4; g++) {
    const gy = P + (g / 4) * (H - P * 2);
    ctx.beginPath(); ctx.moveTo(P, gy); ctx.lineTo(W - P, gy); ctx.stroke();
    ctx.fillText(String(Math.round(maxW * (1 - g / 4))), P - 6, gy + 3);
  }
  const line = (pts, color) => {
    ctx.beginPath();
    pts.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py));
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineJoin = "round"; ctx.stroke();
  };
  line(hist.map((h, i) => [x(i), H - P - (h.wpm / maxW) * (H - P * 2)]), getComputedStyle(document.documentElement).getPropertyValue("--cyan").trim());
  line(hist.map((h, i) => [x(i), H - P - (h.acc / 100) * (H - P * 2)]), getComputedStyle(document.documentElement).getPropertyValue("--violet").trim());
  ctx.textAlign = "left";
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--cyan").trim();
  ctx.fillText("WPM", P, 14);
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--violet").trim();
  ctx.fillText("ACC%", P + 40, 14);
}

function renderHistoryTable(hist) {
  const rows = [...hist].sort((a, b) =>
    sortKey === "at" ? b.at - a.at : (b[sortKey] ?? 0) - (a[sortKey] ?? 0)).slice(0, 15);
  $("#pf-table tbody").innerHTML = rows.map(h =>
    `<tr><td>${new Date(h.at).toLocaleString()}</td><td>${h.mode || "—"}</td>` +
    `<td>${h.wpm}</td><td>${h.acc}%</td><td>${h.raw ?? "—"}</td></tr>`).join("") ||
    `<tr><td colspan="5" style="color:var(--faint)">no missions yet</td></tr>`;
}

function renderAchievements() {
  const have = unlockedIds();
  $("#pf-ach").innerHTML = DEFS.map(d => `
    <div class="ach ${have.has(d.id) ? "got" : ""}">
      <b>${have.has(d.id) ? "★" : "🔒"} ${d.name}</b><span>${d.desc}</span>
    </div>`).join("");
}
