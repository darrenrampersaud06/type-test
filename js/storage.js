/* ═══════════════════════════════════════════════════════════════════
   storage.js — thin, namespaced wrapper over localStorage
   Everything Jango persists goes through here, under the "jango." prefix,
   so it never collides with other apps and is trivial to wipe or migrate.
   ═══════════════════════════════════════════════════════════════════ */
"use strict";

const Store = (() => {
  const NS = "jango.";

  function get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(NS + key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback; // corrupted entry — behave as if absent
    }
  }

  function set(key, value) {
    try {
      localStorage.setItem(NS + key, JSON.stringify(value));
      return true;
    } catch {
      return false; // storage full / privacy mode — app keeps working, just unsaved
    }
  }

  function remove(key) { localStorage.removeItem(NS + key); }

  return { get, set, remove };
})();
