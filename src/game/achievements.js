/* ═══════════════════════════════════════════════════════════════════
   achievements.js — unlock checks + cinematic toast notifications
   ═══════════════════════════════════════════════════════════════════ */
import { Store } from "../storage/store.js";
import { play } from "../audio/sfx.js";

const DEFS = [
  { id: "first",    name: "FIRST CONTACT",  desc: "Complete your first mission",     test: (s, t) => t.tests >= 1 },
  { id: "sharp",    name: "SHARPSHOOTER",   desc: "98%+ accuracy",                   test: (s) => s.acc >= 98 },
  { id: "speed",    name: "SPEED DEMON",    desc: "100+ WPM",                        test: (s) => s.wpm >= 100 },
  { id: "overdrive",name: "OVERDRIVE",      desc: "50+ keystroke combo",             test: (s) => s.maxCombo >= 50 },
  { id: "clean",    name: "UNTOUCHABLE",    desc: "Zero errors",                     test: (s) => s.errors === 0 && s.chars > 20 },
  { id: "haul",     name: "LONG HAUL",      desc: "Complete a 500-word mission",     test: (s) => s.cfg.mode !== "time" && s.words >= 500 },
  { id: "symbols",  name: "SYMBOL MASTER",  desc: "Finish a symbol-heavy mission",   test: (s) => (s.cfg.symbols || s.cfg.difficulty === "expert") && s.words >= 25 },
  { id: "code",     name: "CODE WARRIOR",   desc: "Complete a code mission",         test: (s) => s.cfg.content === "code" && s.words >= 25 },
];

export function checkAchievements(stats, totals) {
  const unlocked = new Set(Store.get("achievements", []));
  const fresh = [];
  for (const d of DEFS) {
    if (!unlocked.has(d.id) && d.test(stats, totals)) {
      unlocked.add(d.id);
      fresh.push(d);
    }
  }
  if (fresh.length) {
    Store.set("achievements", [...unlocked]);
    queueToasts(fresh);
  }
  return fresh;
}

function queueToasts(defs) {
  const host = document.getElementById("ach-toasts");
  defs.forEach((d, i) => {
    setTimeout(() => {
      play("combo");
      const el = document.createElement("div");
      el.className = "ach-toast";
      el.innerHTML = `<em>ACHIEVEMENT UNLOCKED</em><b>${d.name}</b><span>${d.desc}</span>`;
      host.appendChild(el);
      requestAnimationFrame(() => el.classList.add("in"));
      setTimeout(() => { el.classList.remove("in"); setTimeout(() => el.remove(), 500); }, 4200);
    }, 600 + i * 1200);
  });
}
