/* ═══════════════════════════════════════════════════════════════════
   cloud.js — Supabase auth + persistence (offline-first)

   The database is the source of truth for signed-in users; localStorage
   is the always-available cache and the offline queue. Every write goes
   local-first, then to the cloud; failed cloud writes are queued and
   flushed when connectivity returns.

   Runs happily with no configuration at all (LOCAL MODE): every export
   degrades to a no-op / null and the rest of the app never crashes.
   ═══════════════════════════════════════════════════════════════════ */
import { Store } from "../storage/store.js";
import { emit } from "../bus.js";

const cfg = window.TV_CONFIG || {};
export const cloudConfigured = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY);

let client = null;
export function getClient() {
  if (!cloudConfigured || !window.supabase) return null;
  if (!client) {
    client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  }
  return client;
}

let currentUser = null;
export const user = () => currentUser;

/* ── auth ───────────────────────────────────────────────────────── */
export async function signUp({ email, password, username, displayName }) {
  const c = getClient();
  if (!c) throw new Error("Cloud not configured — see config.js");
  if (!/^[a-z0-9_]{3,20}$/i.test(username)) throw new Error("Username: 3–20 letters, numbers, underscores");
  const { data, error } = await c.auth.signUp({
    email, password,
    options: { data: { username: username.toLowerCase(), display_name: displayName || username } },
  });
  if (error) throw error;
  return data;
}

export async function signIn({ email, password }) {
  const c = getClient();
  if (!c) throw new Error("Cloud not configured — see config.js");
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signInWithGoogle() {
  const c = getClient();
  if (!c) throw new Error("Cloud not configured — see config.js");
  const { error } = await c.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin + window.location.pathname },
  });
  if (error) throw error;
}

export async function signOut() {
  const c = getClient();
  if (c) await c.auth.signOut();      // provider clears its own secure session
  currentUser = null;
  emit("tv:auth", { user: null });
}

/** Start listening for auth state; resolves initial session too. */
export function initAuth() {
  const c = getClient();
  if (!c) return;
  c.auth.onAuthStateChange(async (_event, session) => {
    currentUser = session?.user ?? null;
    if (currentUser) await pullEverything();
    emit("tv:auth", { user: currentUser });
  });
}

/* ── profile ────────────────────────────────────────────────────── */
export async function fetchProfile() {
  const c = getClient();
  if (!c || !currentUser) return null;
  const { data } = await c.from("profiles").select("*").eq("id", currentUser.id).maybeSingle();
  return data;
}

export async function upsertProfile(patch) {
  const c = getClient();
  if (!c || !currentUser) return;
  const meta = currentUser.user_metadata || {};
  await c.from("profiles").upsert({
    id: currentUser.id,
    username: meta.username || (currentUser.email || "pilot").split("@")[0],
    display_name: meta.display_name || meta.full_name || meta.username || "Pilot",
    ...patch,
  });
}

/* ── results (offline queue) ────────────────────────────────────── */
function resultRow(stats) {
  return {
    mode: stats.cfg.mode,
    duration: Math.round(stats.elapsed),
    word_count: stats.words,
    wpm: stats.wpm, raw_wpm: stats.raw,
    accuracy: stats.acc, errors: stats.errors, corrections: stats.corrected,
    consistency: stats.consistency, max_combo: stats.maxCombo,
    difficulty: stats.cfg.difficulty, content_type: stats.cfg.content,
  };
}

export async function saveResult(stats) {
  if (!currentUser) return;
  const row = { ...resultRow(stats), user_id: currentUser.id };
  const c = getClient();
  try {
    const { error } = await c.from("test_results").insert(row);
    if (error) throw error;
    await flushQueue();
  } catch {
    // network hiccup — never lose a finished test
    const q = Store.get("syncQueue", []);
    q.push(row);
    Store.set("syncQueue", q.slice(-100));
  }
}

export async function flushQueue() {
  const c = getClient();
  if (!c || !currentUser) return;
  const q = Store.get("syncQueue", []);
  if (!q.length) return;
  const { error } = await c.from("test_results").insert(q);
  if (!error) Store.set("syncQueue", []);
}
window.addEventListener("online", () => flushQueue().catch(() => {}));

/* ── achievements & preferences ─────────────────────────────────── */
export async function saveAchievement(id) {
  const c = getClient();
  if (!c || !currentUser) return;
  await c.from("achievements").upsert({ user_id: currentUser.id, achievement_id: id });
}
export async function savePreferences(data) {
  const c = getClient();
  if (!c || !currentUser) return;
  await c.from("preferences").upsert({ user_id: currentUser.id, data });
}

/* ── login sync: cloud → local caches (cloud is source of truth) ── */
async function pullEverything() {
  const c = getClient();
  try {
    await upsertProfile({});                       // ensure profile row exists
    const [profile, resultsRes, achRes] = await Promise.all([
      fetchProfile(),
      c.from("test_results").select("*").eq("user_id", currentUser.id)
        .order("created_at", { ascending: false }).limit(300),
      c.from("achievements").select("achievement_id").eq("user_id", currentUser.id),
    ]);
    const results = resultsRes.data || [];

    // rebuild local records from cloud history
    const records = {
      bestWpm: 0, bestAcc: 0, bestCombo: 0, bestConsistency: 0,
      tests: results.length, totalWords: 0, totalChars: 0, history: [],
    };
    for (const r of results) {
      records.bestWpm = Math.max(records.bestWpm, r.wpm);
      records.bestAcc = Math.max(records.bestAcc, Number(r.accuracy));
      records.bestCombo = Math.max(records.bestCombo, r.max_combo || 0);
      records.bestConsistency = Math.max(records.bestConsistency, r.consistency || 0);
      records.totalWords += r.word_count || 0;
    }
    records.history = results.slice(0, 200).reverse().map(r => ({
      at: new Date(r.created_at).getTime(),
      wpm: r.wpm, acc: Number(r.accuracy), raw: r.raw_wpm,
      mode: `${r.mode === "time" ? r.duration + "s" : r.word_count + "w"} ${r.difficulty}`,
    }));
    Store.set("records", records);

    if (profile?.level) Store.set("progress", { level: profile.level, xp: profile.xp || 0 });
    if (achRes.data) {
      const local = new Set(Store.get("achievements", []));
      achRes.data.forEach(a => local.add(a.achievement_id));
      Store.set("achievements", [...local]);
    }
    await flushQueue();
  } catch { /* offline login — cached local data remains in charge */ }
}
