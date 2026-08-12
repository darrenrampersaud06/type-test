-- ═══════════════════════════════════════════════════════════════════
-- TYPING VELOCITY — Supabase schema + Row Level Security
-- Run this once in your project's SQL editor (see README-CLOUD.md).
-- ═══════════════════════════════════════════════════════════════════

-- ── profiles ─────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique not null,
  display_name text,
  avatar text default '🧑‍🚀',
  level int default 1,
  xp int default 0,
  created_at timestamptz default now()
);

-- ── test results ─────────────────────────────────────────────────
create table if not exists public.test_results (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz default now(),
  mode text, duration int, word_count int,
  wpm int, raw_wpm int,
  accuracy numeric(5,2), errors int, corrections int,
  consistency int, max_combo int,
  difficulty text, content_type text
);
create index if not exists test_results_user_idx on public.test_results (user_id, created_at desc);

-- ── achievements ─────────────────────────────────────────────────
create table if not exists public.achievements (
  user_id uuid not null references auth.users (id) on delete cascade,
  achievement_id text not null,
  unlocked_at timestamptz default now(),
  primary key (user_id, achievement_id)
);

-- ── preferences ──────────────────────────────────────────────────
create table if not exists public.preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb default '{}'::jsonb,
  updated_at timestamptz default now()
);

-- ── Row Level Security: users touch ONLY their own rows ──────────
alter table public.profiles enable row level security;
alter table public.test_results enable row level security;
alter table public.achievements enable row level security;
alter table public.preferences enable row level security;

create policy "own profile read"   on public.profiles     for select using (auth.uid() = id);
create policy "own profile insert" on public.profiles     for insert with check (auth.uid() = id);
create policy "own profile update" on public.profiles     for update using (auth.uid() = id);

create policy "own results read"   on public.test_results for select using (auth.uid() = user_id);
create policy "own results insert" on public.test_results for insert with check (auth.uid() = user_id);

create policy "own achievements read"   on public.achievements for select using (auth.uid() = user_id);
create policy "own achievements insert" on public.achievements for insert with check (auth.uid() = user_id);
create policy "own achievements update" on public.achievements for update using (auth.uid() = user_id);

create policy "own prefs read"   on public.preferences for select using (auth.uid() = user_id);
create policy "own prefs insert" on public.preferences for insert with check (auth.uid() = user_id);
create policy "own prefs update" on public.preferences for update using (auth.uid() = user_id);

-- ── leaderboard-ready public view (usernames only, never emails) ─
-- Future leaderboards read from this view; RLS on the base tables
-- still protects private history.
create or replace view public.leaderboard as
  select p.username, p.avatar, p.level, max(t.wpm) as best_wpm,
         max(t.accuracy) as best_accuracy
  from public.profiles p
  join public.test_results t on t.user_id = p.id
  group by p.username, p.avatar, p.level;
grant select on public.leaderboard to anon, authenticated;
