-- Knowfeed: database setup for Supabase.
-- Paste all of this into Supabase → SQL Editor → New query, then press Run. It's safe to run again.
-- Every table has row-level security: people can only ever read and write their own rows.

-- Your answers from onboarding, in columns so the admin page can count them
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text,
  city text,
  timezone text,
  occupation_uri text,
  job_title_raw text,
  edition_times jsonb,
  quiet_hours jsonb,
  daily_goal_min int,
  daily_limit_min int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Everything else the app remembers (likes, saves, follows, learning progress…), as one document per person.
-- Each part carries its own time, so two phones merge cleanly.
create table if not exists public.user_state (
  user_id uuid primary key references auth.users on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Usage events, with no third-party trackers
create table if not exists public.events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  props jsonb,
  at timestamptz not null default now()
);
create index if not exists events_user_at on public.events (user_id, at desc);
create index if not exists events_name_at on public.events (name, at desc);

-- "Something wrong?" notes
create table if not exists public.feedback (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  item_id text,
  title text,
  text text not null check (char_length(text) <= 2000),
  at timestamptz not null default now()
);

-- Tester invites (used later): email addresses allowed into the beta. No one can read this from the app.
create table if not exists public.invites (
  email text primary key,
  note text,
  created_at timestamptz not null default now()
);

-- Web push: one row per phone that turned notifications on. The edition times, quiet hours and time zone are
-- copied here from the app, so the sender (GitHub Actions, every 15 minutes) knows when to send without reading
-- anything else. "sent" records today's pushes, so there are never more than 3 a day or 2 for one edition.
create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references auth.users on delete cascade,
  p256dh text not null,
  auth text not null,
  timezone text not null default 'Europe/London',
  editions jsonb not null default '{}'::jsonb,
  quiet jsonb not null default '{}'::jsonb,
  sent jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists push_user on public.push_subscriptions (user_id);

alter table public.profiles   enable row level security;
alter table public.user_state enable row level security;
alter table public.events     enable row level security;
alter table public.feedback   enable row level security;
alter table public.invites    enable row level security;
alter table public.push_subscriptions enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles for all to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy if exists "own state" on public.user_state;
create policy "own state" on public.user_state for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "add own events" on public.events;
create policy "add own events" on public.events for insert to authenticated
  with check ((select auth.uid()) = user_id);
drop policy if exists "read own events" on public.events;
create policy "read own events" on public.events for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists "delete own events" on public.events;
create policy "delete own events" on public.events for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "add own feedback" on public.feedback;
create policy "add own feedback" on public.feedback for insert to authenticated
  with check ((select auth.uid()) = user_id);
drop policy if exists "read own feedback" on public.feedback;
create policy "read own feedback" on public.feedback for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists "delete own feedback" on public.feedback;
create policy "delete own feedback" on public.feedback for delete to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists "own push" on public.push_subscriptions;
create policy "own push" on public.push_subscriptions for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
-- invites: no policies, so only the service role (GitHub Actions, the admin page later) can touch it

-- "Delete my account" in the app: removes the person and, through the cascades above, all their rows
create or replace function public.delete_me() returns void
language sql security definer set search_path = '' as $$
  delete from auth.users where id = auth.uid();
$$;
revoke all on function public.delete_me() from public, anon;
grant execute on function public.delete_me() to authenticated;
