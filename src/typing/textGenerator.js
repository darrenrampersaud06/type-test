/* ═══════════════════════════════════════════════════════════════════
   textGenerator.js — local, seedable text generation
   Word banks per difficulty + sentence templates + quotes + code, with
   independent decorators for numbers / punctuation / symbols / capitals.
   ═══════════════════════════════════════════════════════════════════ */

const EASY = ("the be to of and a in that have it for not on with he as you do at this but his by from they we say her she or an will my one all would there their what so up out if about who get which go me when make can like time no just him know take into year your good some could them see other than then now look only come its over think also back after use two how our work first well way even new want any these give day most us man old too key run set end far sun sea red big top hot let car dog cat map arm leg egg cup box kid win yes fun row mix fix job".split(" "));

const NORMAL = ("people history course change interest develop between important children question government company number different problem service around program however country example school student group world state family point million small large every public follow become present without again member water money story young month right study book word business issue side kind head house friend father power hour game line member city community name team minute idea body information back parent face others level office door health person art war party result open morning reason research girl guy moment air teacher force education foot boy age policy process music market sense nation plan college include often together final light speed screen focus train zone signal orbit launch rocket engine".split(" "));

const HARD = ("phenomenon algorithm hypothesis synthesis paradigm quantum trajectory equilibrium infrastructure prolific ubiquitous meticulous ephemeral resilient ambiguous arbitrary cognitive empirical intrinsic pragmatic aesthetic anomaly catalyst dichotomy epiphany juxtapose kinetic labyrinth momentum nebulous oscillate peripheral quintessential rhetorical spontaneous tangential unprecedented velocity wavelength zealous benevolent cacophony deliberate eloquent formidable gregarious hierarchy immaculate jurisdiction luminous magnitude nostalgia obsolete perpetual reciprocal sovereignty threshold vulnerability juxtaposition symmetry entropy chromatic frequency amplitude resonance propulsion azimuth perihelion magnetosphere".split(" "));

const QUOTES = [
  "The only way to do great work is to love what you do.",
  "In the middle of difficulty lies opportunity.",
  "Simplicity is the ultimate sophistication.",
  "The universe is under no obligation to make sense to you.",
  "Somewhere, something incredible is waiting to be known.",
  "That's one small step for man, one giant leap for mankind.",
  "The cosmos is within us. We are made of star stuff.",
  "Across the sea of space, the stars are other suns.",
  "Imagination will often carry us to worlds that never were, but without it we go nowhere.",
  "Any sufficiently advanced technology is indistinguishable from magic.",
  "To confine our attention to terrestrial matters would be to limit the human spirit.",
  "The sky is not the limit, it is only the beginning.",
];

const CODE = [
  'function launch(ship) { return ship.engines.map(e => e.ignite()); }',
  'const stars = new Array(1000).fill(0).map(() => Math.random());',
  'if (energy >= 100) { fireLaser(target); energy = 30; }',
  'for (let i = 0; i < fleet.length; i++) { fleet[i].update(dt); }',
  'const wpm = Math.round((correct / 5) / (seconds / 60));',
  'try { await dock(station); } catch (err) { abort(err); }',
  'export default class Weapon { charge(n) { this.power += n; } }',
  'let combo = hits.filter(h => h.ok).reduce((a, b) => a + 1, 0);',
];

const SYMBOLS = ["@", "#", "$", "%", "&", "*", "+", "=", "<", ">", "/", "\\", "|", "~", "^", "_"];
const ENDINGS = [".", ",", "!", "?", ";", ":"];
const WRAPPERS = [['"', '"'], ["'", "'"], ["(", ")"], ["[", "]"], ["{", "}"]];

/* seedable xorshift so future "race on the same seed" mode is trivial */
let seed = Date.now() >>> 0;
export function reseed(s = Date.now()) { seed = s >>> 0; }
function rand() { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; }
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const randInt = (max) => Math.floor(rand() * max);

function bank(difficulty) {
  if (difficulty === "easy") return EASY;
  if (difficulty === "hard") return HARD.concat(NORMAL.slice(0, 60));
  if (difficulty === "expert") return HARD;
  return NORMAL.concat(EASY.slice(0, 80));
}

function numberWord() {
  const forms = [
    () => String(randInt(100)),
    () => String(1900 + randInt(200)),
    () => (randInt(100) + rand()).toFixed(2),
    () => String(randInt(10000)),
    () => String(randInt(100)) + "%",
  ];
  return pick(forms)();
}

/** Sentence assembled from templates — grammatical enough to read naturally. */
function sentence(words) {
  const adj = ["distant", "silent", "ancient", "bright", "cold", "vast", "rapid", "hidden", "final", "steady"];
  const noun = ["station", "signal", "planet", "engine", "pilot", "orbit", "system", "beacon", "vessel", "horizon"];
  const verb = ["drifted", "burned", "pulsed", "returned", "vanished", "accelerated", "aligned", "descended", "answered", "endured"];
  const tail = ["beyond the outer rim", "against the dark", "without warning", "in perfect silence", "past the last relay", "through the debris field", "under alien stars"];
  const t = randInt(3);
  let s;
  if (t === 0) s = `The ${pick(adj)} ${pick(noun)} ${pick(verb)} ${pick(tail)}.`;
  else if (t === 1) s = `${cap(pick(noun))}s ${pick(verb)} while the ${pick(noun)} ${pick(verb)}.`;
  else s = `Every ${pick(noun)} we tracked ${pick(verb)} ${pick(tail)}.`;
  return s.split(" ");
}
const cap = (w) => w[0].toUpperCase() + w.slice(1);

let capitalizeNext = true;

/** Generate `count` words for the given mission config. */
export function generate(cfg, count) {
  // Guardrail, not a straitjacket: supports very long tests.
  count = Math.max(1, Math.min(count, 5000));
  const expert = cfg.difficulty === "expert";
  const useNumbers = cfg.numbers || expert;
  const usePunct = cfg.punctuation || expert;
  const useSymbols = cfg.symbols || expert;
  const useCaps = cfg.capitals || expert;

  const out = [];

  if (cfg.content === "quotes") {
    while (out.length < count) out.push(...pick(QUOTES).split(" "));
    return out.slice(0, count);
  }
  if (cfg.content === "code") {
    while (out.length < count) out.push(...pick(CODE).split(" "));
    return out.slice(0, count);
  }
  if (cfg.content === "sentences") {
    while (out.length < count) out.push(...sentence());
    return out.slice(0, count);
  }

  // words mode with independent decorators
  const B = bank(cfg.difficulty);
  let prev = "";
  while (out.length < count) {
    let w = pick(B);
    if (w === prev) continue;
    prev = w;

    const roll = rand();
    if (useNumbers && roll < 0.10) { out.push(numberWord()); continue; }
    if (useSymbols && roll >= 0.10 && roll < 0.17) {
      w = rand() < 0.5 ? pick(SYMBOLS) + w : w + pick(SYMBOLS);
    }
    if (useCaps && (capitalizeNext || rand() < 0.15)) { w = cap(w); capitalizeNext = false; }
    if (usePunct) {
      const r2 = rand();
      if (r2 < 0.14) {
        const p = pick(ENDINGS);
        w += p;
        if (useCaps && ".!?".includes(p)) capitalizeNext = true;
      } else if (r2 < 0.19) {
        const [l, r] = pick(WRAPPERS);
        w = l + w + r;
      }
    }
    out.push(w);
  }
  return out.slice(0, count);
}
