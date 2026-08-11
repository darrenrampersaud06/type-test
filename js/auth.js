/* ═══════════════════════════════════════════════════════════════════
   auth.js — local accounts with salted SHA-256 password hashing

   This is a front-end-only app, so accounts live in the browser's
   localStorage. Passwords are never stored in plain text: each user gets
   a random salt, and we keep only SHA-256(salt + password) — the same
   pattern a real backend would use (with bcrypt/argon2 server-side).

   Data layout in localStorage:
     jango.users   → { [username]: { salt, hash, createdAt } }
     jango.session → username currently logged in (or absent)
     jango.data.<username> → owned by stats.js (test history, missed keys)
   ═══════════════════════════════════════════════════════════════════ */
"use strict";

const Auth = (() => {
  let currentUser = Store.get("session", null);
  const listeners = [];   // subscribers notified on login/logout

  /* ── hashing ────────────────────────────────────────────────── */
  async function sha256Hex(text) {
    if (crypto?.subtle) {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
      // byte array → hex string
      return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, "0")).join("");
    }
    // Non-secure-context fallback (e.g. plain http on a LAN): FNV-1a.
    // Weaker than SHA-256 — fine for a demo, flagged for honesty.
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return "fnv_" + (h >>> 0).toString(16);
  }

  function makeSalt() {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
  }

  /* ── account operations ─────────────────────────────────────── */
  async function signup(username, password) {
    username = username.trim().toLowerCase();
    if (!/^[a-z0-9_]{2,20}$/.test(username)) {
      throw new Error("username: 2–20 chars, letters/numbers/underscores only");
    }
    const users = Store.get("users", {});
    if (users[username]) throw new Error("that username is taken");

    const salt = makeSalt();
    users[username] = {
      salt,
      hash: await sha256Hex(salt + password),
      createdAt: Date.now(),
    };
    Store.set("users", users);
    setSession(username);
  }

  async function login(username, password) {
    username = username.trim().toLowerCase();
    const rec = Store.get("users", {})[username];
    if (!rec) throw new Error("no such user — sign up first?");
    const attempt = await sha256Hex(rec.salt + password);
    if (attempt !== rec.hash) throw new Error("wrong password");
    setSession(username);
  }

  function logout() { setSession(null); }

  function setSession(username) {
    currentUser = username;
    if (username) Store.set("session", username);
    else Store.remove("session");
    listeners.forEach(fn => fn(currentUser));
  }

  const user = () => currentUser;
  const onChange = (fn) => listeners.push(fn);

  return { signup, login, logout, user, onChange };
})();

/* ─────────────────────────────────────────────────────────────────
   Auth UI wiring: header buttons + modal
   ───────────────────────────────────────────────────────────────── */
(() => {
  const area    = document.getElementById("auth-area");
  const modal   = document.getElementById("auth-modal");
  const form    = document.getElementById("auth-form");
  const title   = document.getElementById("auth-modal-title");
  const sub     = document.getElementById("auth-modal-sub");
  const errEl   = document.getElementById("auth-error");
  const submit  = document.getElementById("auth-submit");
  const switchB = document.getElementById("auth-switch");
  const switchL = document.getElementById("auth-switch-label");

  let mode = "login"; // or "signup"

  function renderHeader() {
    const u = Auth.user();
    area.innerHTML = "";
    if (u) {
      const name = document.createElement("span");
      name.className = "header__user";
      name.textContent = u;
      const out = document.createElement("button");
      out.className = "nav-btn";
      out.textContent = "logout";
      out.onclick = () => Auth.logout();
      area.append(name, out);
    } else {
      const inBtn = document.createElement("button");
      inBtn.className = "nav-btn";
      inBtn.textContent = "login";
      inBtn.onclick = () => open("login");
      const upBtn = document.createElement("button");
      upBtn.className = "nav-btn";
      upBtn.textContent = "sign up";
      upBtn.onclick = () => open("signup");
      area.append(inBtn, upBtn);
    }
  }

  function open(m) {
    mode = m;
    title.textContent  = m === "login" ? "welcome back" : "create account";
    sub.textContent    = m === "login" ? "log in to keep your streaks and stats"
                                       : "stats & missed-key history, saved to this browser";
    submit.textContent = m === "login" ? "log in" : "sign up";
    switchL.textContent = m === "login" ? "no account?" : "already have one?";
    switchB.textContent = m === "login" ? "sign up" : "log in";
    errEl.hidden = true;
    modal.hidden = false;
    document.getElementById("auth-user").focus();
  }
  const close = () => { modal.hidden = true; form.reset(); };

  switchB.onclick = () => open(mode === "login" ? "signup" : "login");
  document.getElementById("auth-close").onclick = close;
  modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.hidden) close(); });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const u = document.getElementById("auth-user").value;
    const p = document.getElementById("auth-pass").value;
    try {
      if (mode === "login") await Auth.login(u, p);
      else await Auth.signup(u, p);
      close();
      Sound.play("levelup");
    } catch (err) {
      errEl.textContent = err.message;
      errEl.hidden = false;
    }
  });

  Auth.onChange(renderHeader);
  renderHeader();
})();
