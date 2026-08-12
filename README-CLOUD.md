# Enabling accounts + cloud sync (5 minutes)

Typing Velocity works fully offline in **LOCAL MODE** (everything saved
on-device). To get real accounts, cross-device sync and Google sign-in:

## 1. Create a Supabase project (free)
- Go to https://supabase.com → New project.

## 2. Run the schema
- In your project: **SQL Editor** → paste the contents of
  [`supabase/schema.sql`](supabase/schema.sql) → **Run**.

## 3. Paste your keys into `config.js`
- **Settings → API** → copy *Project URL* and *anon public* key into
  [`config.js`](config.js):

```js
window.TV_CONFIG = {
  SUPABASE_URL: "https://YOURPROJECT.supabase.co",
  SUPABASE_ANON_KEY: "eyJ...",
};
```

The anon key is a public client credential by design — safe to commit.
Security comes from the Row Level Security policies in the schema.
**Never** put your `service_role` key anywhere in this repo.

## 4. (Optional) Google sign-in
- **Authentication → Providers → Google** → enable, and follow Supabase's
  guide to add your Google OAuth client ID/secret.
- Add your site URL (e.g. `https://you.github.io/type-test/`) under
  **Authentication → URL Configuration → Redirect URLs**.

## 5. Done
Reload the site — the SIGN IN button now creates real accounts, results
are written to `test_results`, profiles/XP/achievements sync across
devices, and tests finished offline are queued and uploaded when the
network returns.

See `.env.example` for the same values in env-var form if you later move
to a bundler/deployment that injects environment variables.
