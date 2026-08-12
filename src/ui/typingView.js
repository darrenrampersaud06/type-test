/* ═══════════════════════════════════════════════════════════════════
   typingView.js — character-level rendering + pixel-perfect caret

   The caret is an absolutely-positioned element placed from the CURRENT
   CHARACTER'S REAL RENDERED RECT (getBoundingClientRect), so it can
   never drift: it survives wraps, punctuation, zoom, font-size changes
   and window resizes. The view also exports the current character's
   viewport position so the weapon system can aim at the actual letter.

   Correct characters "get shot": a brief zap animation plays, then the
   glyph settles into its lit state — effects never hide the text.
   ═══════════════════════════════════════════════════════════════════ */
import { Settings } from "../storage/prefs.js";

const holder = () => document.getElementById("type-text");
const windowEl = () => document.querySelector(".type-window");

let charEls = [];
let caret = null;
let scrollY = 0;
let resizeObs = null;
let lastEngine = null;

export function render(engine) {
  lastEngine = engine;
  const h = holder();
  h.innerHTML = "";
  charEls = [];
  scrollY = 0;
  h.style.transform = "translateY(0)";

  caret = document.createElement("div");
  caret.id = "caret";
  caret.dataset.style = Settings.caret;
  windowEl().appendChild(caret);        // sibling of the text, absolute in the window

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

  resizeObs?.disconnect();
  resizeObs = new ResizeObserver(() => lastEngine && update(lastEngine));
  resizeObs.observe(windowEl());

  update(engine);
}

/** Repaint char states around the caret and reposition it from real rects. */
export function update(engine, { zap = false } = {}) {
  if (!engine?.chars || !charEls.length || !caret) return;   // nothing rendered yet
  lastEngine = engine;
  const from = Math.max(0, engine.index - 60);
  const to = Math.min(charEls.length, engine.index + 2);
  for (let i = from; i < to; i++) {
    const c = engine.chars[i];
    const el = charEls[i];
    const base = "tchar " + c.state + (c.isSpace ? " tspace" : "");
    if (i === engine.index) { el.className = base + " current"; continue; }
    if (el.className !== base) el.className = base;
  }

  // the just-hit character flashes apart, then settles into its lit state
  if (zap && engine.index > 0) {
    const el = charEls[engine.index - 1];
    el.classList.remove("zap");
    void el.offsetWidth;
    el.classList.add("zap");
  }

  positionCaret(engine.index);
}

/** Absolute caret placement from the current char's LAYOUT position.
    offsetLeft/offsetTop are transform-independent (unaffected by the
    window's scroll transition), so the caret cannot drift — ever. */
function positionCaret(index) {
  const el = charEls[Math.min(index, charEls.length - 1)];
  if (!el) { caret.style.opacity = "0"; return; }
  const atEnd = index >= charEls.length;

  // layout coords relative to .type-window (chars' offsetParent)
  const x = el.offsetLeft + (atEnd ? el.offsetWidth : 0);
  const yRaw = el.offsetTop;
  const lineH = el.offsetHeight || 48;

  // keep the caret's line as the middle visible line of the window
  const targetScroll = Math.max(0, yRaw - lineH);
  if (Math.abs(targetScroll - scrollY) > 1) {
    scrollY = targetScroll;
    holder().style.transform = `translateY(${-scrollY}px)`;
  }

  caret.style.opacity = "1";
  caret.style.transform = `translate(${x}px, ${yRaw - scrollY}px)`;
  caret.style.height = lineH + "px";
  if (caret.dataset.style !== "line") caret.style.width = Math.max(el.offsetWidth, 6) + "px";
}

/** Viewport-space center of the current character — the weapon's target. */
export function targetRect() {
  if (!lastEngine) return null;
  const el = charEls[lastEngine.index];
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const win = windowEl().getBoundingClientRect();
  // ignore targets scrolled out of the visible 3-line window
  if (r.bottom < win.top || r.top > win.bottom) return null;
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
}
