# jango_ ⌨

A fast, dark, **conveyor-belt** typing speed test. Words stream across the
screen from the right, get typed at the golden marker, and fade away off the
left edge — no static wall of text.

## Features

- **Moving word belt** — words ride right→left; typed words blur and vanish
  off the left edge, upcoming words stream in endlessly from the right
- **Missed-key analytics** — a live on-screen keyboard heats up (red) on the
  keys you fumble, plus a ranked "problem keys" list after every run and an
  all-time heat-map on your profile
- **GitHub-style progress bar** — a thin green bar across the top of the page
  fills as your run progresses
- **Modes** — words-only or punctuation (capitals, `.,!?;:` endings, quotes,
  parens, hyphenated pairs), over 15 / 30 / 60 / 120 seconds
- **Accounts** — sign up / log in (salted **SHA-256** password hashing via the
  Web Crypto API, stored locally); per-user history, best/avg WPM, accuracy,
  WPM chart, recent-runs table. Guest runs are kept on-device too
- **Live + final stats** — WPM, raw WPM, accuracy, consistency (coefficient of
  variation over per-second WPM samples), char breakdown, WPM-over-time chart
  drawn on a raw `<canvas>` — zero dependencies
- **Sound hooks** — synthesized fallback blips out of the box; drop real files
  into `assets/sounds/` to replace them (see the README there)
- **Keyboard-first** — `tab` + `enter` restarts; click the belt and type

## Running it

It's a static site — no build step, no server:

```bash
# any static server works, e.g.
python3 -m http.server 8000
# then open http://localhost:8000
```

or just open `index.html` in a browser. Deploys as-is to GitHub Pages.

## Project layout

```
index.html          app shell (test / results / profile views + auth modal)
css/style.css       dark theme, belt animation, keyboard heat-map styles
js/words.js         word bank + punctuation-aware stream generator (xorshift PRNG)
js/storage.js       namespaced localStorage wrapper
js/sound.js         sound effects with placeholder auto-discovery + synth fallback
js/auth.js          salted SHA-256 local accounts + auth UI
js/stats.js         WPM math, Map-based per-key accuracy, heat-map, canvas charts
js/belt.js          belt rendering & conveyor motion
js/main.js          test engine (idle → running → done state machine) + wiring
assets/sounds/      sound placeholders (see README inside)
assets/images/      image placeholders (see README inside)
```

## Under the hood (the CS bits)

- **Hash map** (`Map`) for per-key hit/miss tallies — O(1) per keystroke
- **Salted SHA-256 hashing** for passwords (Web Crypto), FNV-1a fallback
- **Arrays** everywhere: pre-sized word batches, WPM sample series, ranked
  problem keys via `sort` on the entries
- **Finite-state machine** (`idle → running → done`) driving the test engine
- **xorshift PRNG** — seedable, so a future "race on identical words" mode
  is one line away
- **Standard WPM formula**: `(correct chars ÷ 5) ÷ minutes`; consistency is
  `100 − coefficient of variation` of per-second WPM samples

> ⚠️ Auth is client-side only (this is a static site) — fine for a personal
> tool or demo; a real multi-device deployment would move it behind a server
> with bcrypt/argon2.
