/* ═══════════════════════════════════════════════════════════════════
   words.js — word bank + stream generator
   The belt asks this module for an endless stream of words. Punctuation
   mode decorates the stream with commas, periods, quotes, etc.
   ═══════════════════════════════════════════════════════════════════ */
"use strict";

const Words = (() => {

  // Top ~300 common English words (array = O(1) random access by index).
  const BANK = [
    "the","be","of","and","a","to","in","he","have","it","that","for","they","with","as","not","on","she","at","by",
    "this","we","you","do","but","from","or","which","one","would","all","will","there","say","who","make","when","can","more","if",
    "no","man","out","other","so","what","time","up","go","about","than","into","could","state","only","new","year","some","take","come",
    "these","know","see","use","get","like","then","first","any","work","now","may","such","give","over","think","most","even","find","day",
    "also","after","way","many","must","look","before","great","back","through","long","where","much","should","well","people","down","own","just","because",
    "good","each","those","feel","seem","how","high","too","place","little","world","very","still","nation","hand","old","life","tell","write","become",
    "here","show","house","both","between","need","mean","call","develop","under","last","right","move","thing","general","school","never","same","another","begin",
    "while","number","part","turn","real","leave","might","want","point","form","off","child","few","small","since","against","ask","late","home","interest",
    "large","person","end","open","public","follow","during","present","without","again","hold","govern","around","possible","head","consider","word","program","problem","however",
    "lead","system","set","order","eye","plan","run","keep","face","fact","group","play","stand","increase","early","course","change","help","line","city",
    "put","close","case","force","meet","once","water","upon","war","build","hear","light","unite","live","every","country","bring","center","let","side",
    "try","provide","continue","name","certain","power","pay","result","question","study","woman","member","until","far","night","always","service","away","report","something",
    "company","week","church","toward","start","social","room","figure","natural","kind","begin","story","idea","art","car","door","body","among","learn","true",
    "field","food","spring","air","strong","almost","hard","today","hour","better","across","short","stay","fall","cut","reach","local","clear","above","voice",
    "moment","team","game","free","music","type","screen","speed","key","press","space","enter","shift","code","logic","fast","flow","train","focus","zone"
  ];

  const PUNCT_ENDINGS  = [".", ",", "!", "?", ";", ":"];
  const PUNCT_WRAPPERS = [["\"", "\""], ["'", "'"], ["(", ")"]];

  // xorshift PRNG — deterministic-capable random (seedable for future
  // "race a friend on the same words" mode).
  let seed = Date.now() >>> 0;
  function rand() {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    return ((seed >>> 0) / 4294967296);
  }
  const randInt = (n) => Math.floor(rand() * n);

  let capitalizeNext = true; // punctuation mode starts sentences with capitals

  /** Return the next batch of `count` words for the given settings. */
  function next(count, { punctuation = false } = {}) {
    const out = new Array(count); // pre-sized array, filled in one pass
    let prev = "";
    for (let i = 0; i < count; i++) {
      let w = BANK[randInt(BANK.length)];
      while (w === prev) w = BANK[randInt(BANK.length)]; // no immediate repeats
      prev = w;

      if (punctuation) {
        if (capitalizeNext) { w = w[0].toUpperCase() + w.slice(1); capitalizeNext = false; }
        const roll = rand();
        if (roll < 0.14) {              // sentence-ending punctuation
          const p = PUNCT_ENDINGS[randInt(PUNCT_ENDINGS.length)];
          w += p;
          if (p === "." || p === "!" || p === "?") capitalizeNext = true;
        } else if (roll < 0.19) {       // wrapped word: "quotes" / (parens)
          const [l, r] = PUNCT_WRAPPERS[randInt(PUNCT_WRAPPERS.length)];
          w = l + w + r;
        } else if (roll < 0.23) {       // hyphenated pair
          w += "-" + BANK[randInt(BANK.length)];
        }
      }
      out[i] = w;
    }
    return out;
  }

  function resetSentence() { capitalizeNext = true; }

  return { next, resetSentence };
})();
