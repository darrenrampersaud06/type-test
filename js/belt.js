/* ═══════════════════════════════════════════════════════════════════
   belt.js — the moving word belt

   Words ride a horizontal conveyor. A fixed golden marker sits at 30%
   of the zone width; the belt slides LEFT under it as you type, so the
   character you're about to hit is always at the marker. Finished words
   fade and blur as they drift off the left edge, upcoming words stream
   in from the right. This module owns rendering + motion only — the
   test engine (main.js) tells it what happened.
   ═══════════════════════════════════════════════════════════════════ */
"use strict";

const Belt = (() => {
  const beltEl = document.getElementById("belt");

  let wordEls = [];        // one <span.word> per word, parallel to engine's word array
  let activeIndex = 0;

  /** Wipe the belt and render a fresh word list. */
  function load(words) {
    beltEl.innerHTML = "";
    beltEl.style.transform = "translate(0px, -50%)";
    wordEls = words.map(renderWord);
    wordEls.forEach(el => beltEl.appendChild(el));
    activeIndex = 0;
    setActive(0);
  }

  /** Append more words as the generator streams them in. */
  function append(words) {
    for (const w of words) {
      const el = renderWord(w);
      wordEls.push(el);
      beltEl.appendChild(el);
    }
  }

  function renderWord(word) {
    const el = document.createElement("span");
    el.className = "word";
    for (const ch of word) {
      const l = document.createElement("span");
      l.className = "letter letter--pending";
      l.textContent = ch;
      el.appendChild(l);
    }
    return el;
  }

  /* ── caret ──────────────────────────────────────────────────── */
  const caret = document.createElement("span");
  caret.className = "caret";

  function placeCaret(wordEl, letterIndex) {
    const letters = wordEl.querySelectorAll(".letter");
    if (letterIndex < letters.length) wordEl.insertBefore(caret, letters[letterIndex]);
    else wordEl.appendChild(caret);
  }

  /* ── typing feedback ────────────────────────────────────────── */
  /** Repaint the active word from the engine's typed string. */
  function paintActive(target, typed) {
    const el = wordEls[activeIndex];
    if (!el) return;

    // remove previously-added extra letters
    el.querySelectorAll(".letter--extra").forEach(n => n.remove());

    const letters = el.querySelectorAll(".letter");
    letters.forEach((l, i) => {
      l.className = "letter " + (
        i >= typed.length ? "letter--pending" :
        typed[i] === target[i] ? "letter--ok" : "letter--bad"
      );
    });

    // overtyped characters render as dim red extras after the word
    for (let i = target.length; i < typed.length; i++) {
      const extra = document.createElement("span");
      extra.className = "letter letter--extra";
      extra.textContent = typed[i];
      el.appendChild(extra);
    }

    placeCaret(el, Math.min(typed.length, letters.length + (typed.length - target.length)));
    slideToCaret();
  }

  /** Advance to the next word; mark the old one done so it fades away. */
  function advance(wasPerfect) {
    const done = wordEls[activeIndex];
    if (done) {
      done.classList.add("word--done");
      done.classList.add(wasPerfect ? "word--perfect" : "word--flawed");
      // fully hide once it has drifted well past the left edge
      setTimeout(() => done.classList.add("word--gone"), 900);
    }
    activeIndex++;
    setActive(activeIndex);
  }

  function setActive(i) {
    const el = wordEls[i];
    if (!el) return;
    el.classList.add("word--active");
    placeCaret(el, 0);
    slideToCaret();
  }

  /* ── motion ─────────────────────────────────────────────────── */
  /** Slide the belt so the caret sits exactly on the marker line. */
  function slideToCaret() {
    // The belt is the caret's offsetParent (nearest positioned ancestor),
    // so caret.offsetLeft is measured from the belt's left edge. Shifting
    // the belt by exactly -offsetLeft pins the caret to the marker, and
    // the CSS transition on .belt turns each shift into conveyor motion.
    beltEl.style.transform = `translate(${-caret.offsetLeft}px, -50%)`;
  }

  /** Quick error shake. */
  function shake() {
    beltEl.classList.remove("is-error");
    void beltEl.offsetWidth;           // restart the animation
    beltEl.classList.add("is-error");
  }

  const remaining = () => wordEls.length - activeIndex;

  return { load, append, paintActive, advance, shake, remaining };
})();
