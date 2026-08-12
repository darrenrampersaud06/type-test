/* ═══════════════════════════════════════════════════════════════════
   JANGO — owner console credentials

   The console at admin.html is LOCKED until you set a password hash
   here. Open admin.html and use the "generate a hash" tool at the
   bottom of the lock screen: type the password you want, copy the two
   lines it prints, and paste them below. Your password itself is never
   stored anywhere — only a salted SHA-256 hash of it.

   OWNER_EMAIL (optional but stronger): if you've set up Supabase, put
   your account's email here. The console will then ALSO require you to
   be signed in as that account — a check the server enforces, not the
   browser.

   ⚠ Honest security note: this file ships to the browser, so a
   determined person who reads the source can bypass a password-only
   gate. It stops casual visitors, not attackers. For a real lock:
   either don't deploy admin.html at all (see README-ADMIN.md), or set
   OWNER_EMAIL so a genuine signed-in session is required.
   ═══════════════════════════════════════════════════════════════════ */
window.TV_ADMIN = {
  SALT: "",         // paste from the generator
  HASH: "",         // paste from the generator
  OWNER_EMAIL: "",  // e.g. "you@example.com" (requires Supabase setup)
};
