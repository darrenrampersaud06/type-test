/* ═══════════════════════════════════════════════════════════════════
   TYPING VELOCITY — cloud configuration

   To enable real accounts + cloud sync, create a free Supabase project
   (see README-CLOUD.md for the 5-minute setup), then paste your values
   here. These are PUBLIC client credentials (the anon key is designed
   to be shipped to browsers — security comes from Row Level Security,
   which schema.sql sets up). Never put the service_role key here.

   Leave both empty to run in LOCAL MODE (everything stored on-device).
   ═══════════════════════════════════════════════════════════════════ */
window.TV_CONFIG = {
  SUPABASE_URL: "",        // e.g. "https://abcdefgh.supabase.co"
  SUPABASE_ANON_KEY: "",   // Settings → API → anon public key
};
