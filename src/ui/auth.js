/* ═══════════════════════════════════════════════════════════════════
   auth.js — sign in / sign up UI, profile chip + dropdown, onboarding

   With Supabase configured this is real auth (email+password, Google
   OAuth, secure provider sessions — no passwords ever touch our code
   or localStorage). Without configuration the same UI explains LOCAL
   MODE and the app keeps working on-device.
   ═══════════════════════════════════════════════════════════════════ */
import * as Cloud from "../cloud/cloud.js";
import { Store } from "../storage/store.js";
import { on } from "../bus.js";
import { play } from "../audio/sfx.js";
import { getProgress } from "../game/progression.js";
import { paintAvatar } from "./avatars.js";

const $ = (s) => document.querySelector(s);
let mode = "signin";

export function initAuth() {
  Cloud.initAuth();
  renderChip();

  $("#auth-tab-in").addEventListener("click", () => setMode("signin"));
  $("#auth-tab-up").addEventListener("click", () => setMode("signup"));
  $("#auth-close-x").addEventListener("click", closeAuth);
  $("#auth-google").addEventListener("click", async () => {
    try { await Cloud.signInWithGoogle(); }
    catch (e) { authError(e.message); }
  });

  $("#auth-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("#af-email").value.trim();
    const password = $("#af-pass").value;
    try {
      if (mode === "signup") {
        if (password !== $("#af-pass2").value) throw new Error("Passwords do not match");
        await Cloud.signUp({
          email, password,
          username: $("#af-user").value.trim(),
          displayName: $("#af-name").value.trim(),
        });
        authError("Account created — check your email if confirmation is enabled.", true);
      } else {
        await Cloud.signIn({ email, password });
        closeAuth();
      }
    } catch (err) { authError(err.message); }
  });

  on("tv:auth", ({ user }) => {
    renderChip();
    if (user) { closeAuth(); maybeOnboard(); }
  });

  // local-mode banner
  if (!Cloud.cloudConfigured) {
    $("#auth-local-note").hidden = false;
    $("#auth-form").querySelectorAll("input, button").forEach(el => (el.disabled = true));
    $("#auth-google").disabled = true;
  }

  document.addEventListener("click", (e) => {
    if (!e.target.closest("#profile-chip-wrap")) $("#profile-menu").classList.remove("open");
  });
}

function setMode(m) {
  mode = m;
  $("#auth-tab-in").classList.toggle("on", m === "signin");
  $("#auth-tab-up").classList.toggle("on", m === "signup");
  $("#auth-signup-fields").hidden = m !== "signup";
  $("#af-pass2-wrap").hidden = m !== "signup";
  $("#auth-submit").textContent = m === "signin" ? "SIGN IN" : "CREATE ACCOUNT";
  $("#auth-error").hidden = true;
  play("ui");
}

function authError(msg, ok = false) {
  const el = $("#auth-error");
  el.textContent = msg;
  el.hidden = false;
  el.classList.toggle("ok", ok);
}

export function openAuth() {
  $("#auth-overlay").classList.add("open");
  document.body.classList.add("menu-open");
  setMode("signin");
}
export function closeAuth() {
  $("#auth-overlay").classList.remove("open");
  document.body.classList.remove("menu-open");
}

/* ── profile chip (top-right) + dropdown ────────────────────────── */
export function renderChip() {
  const u = Cloud.user();
  const meta = u?.user_metadata || {};
  const name = u ? (meta.username || (u.email || "pilot").split("@")[0]) : "GUEST";
  const p = getProgress();
  paintAvatar($("#chip-avatar"));
  $("#chip-name").textContent = name.toUpperCase();
  $("#chip-level").textContent = "LV " + p.level;
  $("#pm-auth").textContent = u ? "SIGN OUT" : (Cloud.cloudConfigured ? "SIGN IN" : "SIGN IN (LOCAL MODE)");
}

export function initChipMenu({ onProfile, onSettings, onAdmin }) {
  $("#profile-chip").addEventListener("click", () => {
    $("#profile-menu").classList.toggle("open");
    play("ui");
  });
  $("#pm-profile").addEventListener("click", () => { menuClose(); onProfile(); });
  $("#pm-achievements").addEventListener("click", () => { menuClose(); onProfile("achievements"); });
  $("#pm-settings").addEventListener("click", () => { menuClose(); onSettings(); });
  $("#pm-admin").addEventListener("click", () => { menuClose(); onAdmin?.(); });
  $("#pm-auth").addEventListener("click", async () => {
    menuClose();
    if (Cloud.user()) { await Cloud.signOut(); renderChip(); }
    else openAuth();
  });
}
const menuClose = () => $("#profile-menu").classList.remove("open");

/* ── first-time onboarding ──────────────────────────────────────── */
export function maybeOnboard() {
  if (Store.get("onboarded", false)) return false;
  $("#onboard-overlay").classList.add("open");
  document.body.classList.add("menu-open");
  return true;
}
export function initOnboarding(onBegin) {
  const done = () => {
    Store.set("onboarded", true);
    $("#onboard-overlay").classList.remove("open");
    document.body.classList.remove("menu-open");
  };
  $("#onboard-begin").addEventListener("click", () => { done(); onBegin(); });
  $("#onboard-skip").addEventListener("click", done);
}
