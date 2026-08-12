/* Namespaced localStorage wrapper — survives storage being unavailable
   (private mode, blocked cookies) by degrading to in-memory. */
const NS = "tv.";
const mem = new Map();
let usable = true;
try { localStorage.setItem(NS + "__t", "1"); localStorage.removeItem(NS + "__t"); }
catch { usable = false; }

export const Store = {
  get(key, fallback = null) {
    try {
      const raw = usable ? localStorage.getItem(NS + key) : mem.get(NS + key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch { return fallback; }
  },
  set(key, value) {
    const raw = JSON.stringify(value);
    try { usable ? localStorage.setItem(NS + key, raw) : mem.set(NS + key, raw); }
    catch { /* full — keep running unsaved */ }
  },
};
