# Owner console (`admin.html`)

A private control panel for **you**: jump levels, unlock themes and
achievements, preview every mode, seed test data, and reset the save —
without grinding for any of it.

The game itself has **no link, button, shortcut or key sequence** that
reaches it. The only route is the URL plus your access code.

```
https://your-site/admin.html
```

## 1. Set your access code (required — it's sealed until you do)

1. Open `admin.html`. It will say no access code is set.
2. Expand **“generate a hash for a new access code”**, type the password
   you want, press **GENERATE**.
3. Copy the two printed lines into [`admin-config.js`](admin-config.js):

```js
window.TV_ADMIN = {
  SALT: "…",
  HASH: "…",
  OWNER_EMAIL: "",
};
```

4. Reload. Your password is never written anywhere — only the salted
   SHA-256 hash is, and the password can't be recovered from it.

Five wrong attempts triggers a 30-second lockout.

## 2. Optional but much stronger: lock it to your account

If you've set up Supabase ([README-CLOUD.md](README-CLOUD.md)), put your
email in `OWNER_EMAIL`. The console then also requires you to be signed
in to JANGO as that account — a check **Supabase verifies on its
servers**, so it can't be faked by editing the page.

## How safe is this really?

Straight answer: a password check that runs in the browser is **obscurity,
not security**. `admin-config.js` is downloaded by anyone who visits your
site, so someone determined who reads the source can work around a
password-only gate. What it does do is keep ordinary visitors out —
nobody stumbles into it.

If you want it genuinely locked down, pick one:

- **Strongest / simplest — don't publish it.** Keep `admin.html`,
  `admin-config.js`, `src/admin/` and `styles/admin.css` off the live
  site and run them locally (VS Code Live Preview, `python3 -m
  http.server`). You get the full console; the public site simply doesn't
  contain it. To do that, delete those four paths from the deployed copy,
  or list them in a `.gitignore` on a deploy branch.
- **Set `OWNER_EMAIL`** so a real, server-verified login is required.

Worth knowing either way: the console only edits **the save in the
browser you're using**. It cannot reach other players' devices — their
progress, themes and levels live in their own browsers (or, with
Supabase, behind Row Level Security that only lets an account touch its
own rows).

## Sandbox — your real save is protected

Opening the console snapshots every JANGO save key first.

- **↺ RESTORE MY SAVE** — undo everything you changed in the session and
  put your real progress, theme and records back exactly as they were.
- **✓ KEEP CHANGES** — drop the backup and keep what you did.

So you can set yourself to level 20, flip through all five themes,
preview a 500-word expert run, then hit RESTORE and be back to your real
profile untouched.

## What's in it

| Section | Controls |
|---|---|
| Progression | level −5 / +1 / +5 / MAX / set exact · XP +500 / +5,000 |
| Unlocks | unlock all themes · apply any theme · unlock or clear all achievements |
| Mission preview | any duration, word count, untimed, content type, difficulty — opens JANGO in a new tab and launches it immediately |
| Data | seed 30 or 90 days of history so graphs/trends have data |
| Danger | **FULL RESET** — wipes progress, records, achievements, daily streak, settings **and the theme** back to first-run defaults |
