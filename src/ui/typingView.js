/* ═══════════════════════════════════════════════════════════════════
   typingView.js — character-level rendering of the test text

   Every character is its own span with a state class; the view keeps
   the active line vertically centered in a 3-line window and moves a
   glowing caret to the current character. Completed words lock (dim);
   the current word is emphasized.
   ═══════════════════════════════════════════════════════════════════ */
import { Settings } from "../storage/prefs.js";

const holder = () => document.getElementById("type-text");

let charEls = [];        // parallel to engine.chars
let caret = null;
let lineHeight = 0;

export function render(engine) {
  const h = holder();
  h.innerHTML = "";
  charEls = [];
  caret = document.createElement("span");
  caret.id = "caret";
  caret.dataset.style = Settings.caret;

  let wi = -1, wordEl = null;
  for (const c of engine.chars) {
    if (c.wi !== wi) {
      wi = c.wi;
      wordEl = document.createElement("span");
      wordEl.className = "tword";
      h.appendChild(wordEl);
    }
    const el = document.createElement("span");
    el.className = "tchar untyped" + (c.isSpace ? " tspace" : "");
    el.textContent = c.isSpace ? " " : c.ch;
    (c.isSpace ? h : wordEl).appendChild(el);
    charEls.push(el);
  }
  lineHeight = 0;
  update(engine);
}

/** Repaint states around the caret (cheap — only touches a small window). */
export function update(engine) {
  const from = Math.max(0, engine.index - 40);
  const to = Math.min(charEls.length, engine.index + 2);
  for (let i = from; i < to; i++) {
    const c = engine.chars[i];
    const el = charEls[i];
    el.className = "tchar " + c.state + (c.isSpace ? " tspace" : "");
  }
  placeCaret(engine.index);
  scrollToLine();
  markCurrentWord(engine);
}

function markCurrentWord(engine) {
  const cur = engine.chars[engine.index];
  const h = holder();
  h.querySelector(".tword.now")?.classList.remove("now");
  if (!cur) return;
  const el = charEls[engine.index];
  const w = el.closest(".tword");
  if (w) w.classList.add("now");
}

function placeCaret(index) {
  const el = charEls[index];
  if (!el) { caret.remove(); return; }
  el.parentNode.insertBefore(caret, el);
}

/** Keep the caret's line vertically centered in the 3-line window. */
function scrollToLine() {
  const h = holder();
  if (!caret.isConnected) return;
  if (!lineHeight) {
    const cs = getComputedStyle(h);
    lineHeight = parseFloat(cs.lineHeight) || 48;
  }
  const y = caret.offsetTop;
  const target = Math.max(0, y - lineHeight);
  h.style.transform = `translateY(${-target}px)`;
}
