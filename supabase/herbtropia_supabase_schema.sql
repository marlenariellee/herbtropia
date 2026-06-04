-- ============================================
-- HERBTROPIA — SUPABASE PHASE 1 SCHEMA
-- Sprint 5: Accounts foundation
-- Run this in Supabase SQL Editor.
-- ============================================

create extension if not exists pgcrypto;

-- Updated-at helper
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- --------------------------------------------
-- Profiles: one row per authenticated user
-- --------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  role text not null default 'user' check (role in ('user', 'practitioner', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles for select
to authenticated
using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id and role in ('user', 'practitioner'));

-- --------------------------------------------
-- Wellness Match Results: one current match per user
-- --------------------------------------------
create table if not exists public.wellness_match_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  condition text not null,
  support_type text,
  location_preference text,
  budget text,
  email text,
  completed_at timestamptz,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)
);

create trigger wellness_match_results_set_updated_at
before update on public.wellness_match_results
for each row execute function public.set_updated_at();

alter table public.wellness_match_results enable row level security;

drop policy if exists "wellness_match_select_own" on public.wellness_match_results;
create policy "wellness_match_select_own"
on public.wellness_match_results for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "wellness_match_insert_own" on public.wellness_match_results;
create policy "wellness_match_insert_own"
on public.wellness_match_results for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "wellness_match_update_own" on public.wellness_match_results;
create policy "wellness_match_update_own"
on public.wellness_match_results for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- --------------------------------------------
-- Favorites: saved practitioners, events, resources
-- --------------------------------------------
create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_key text not null,
  item_type text not null check (item_type in ('listing', 'event', 'education', 'resource', 'condition', 'seo', 'item')),
  title text,
  meta text,
  url text,
  saved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, item_key)
);

create trigger favorites_set_updated_at
before update on public.favorites
for each row execute function public.set_updated_at();

alter table public.favorites enable row level security;

drop policy if exists "favorites_select_own" on public.favorites;
create policy "favorites_select_own"
on public.favorites for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "favorites_insert_own" on public.favorites;
create policy "favorites_insert_own"
on public.favorites for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "favorites_update_own" on public.favorites;
create policy "favorites_update_own"
on public.favorites for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "favorites_delete_own" on public.favorites;
create policy "favorites_delete_own"
on public.favorites for delete
to authenticated
using (auth.uid() = user_id);

-- --------------------------------------------
-- Practitioner Profiles: database-backed provider drafts
-- This does not replace your current Google Sheets approval flow yet.
-- --------------------------------------------
create table if not exists public.practitioner_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'pending_review', 'approved', 'rejected')),
  listing_name text,
  contact_name text,
  email text,
  category text,
  service_format text,
  wellness_focus text,
  city text,
  state text,
  bio text,
  services text,
  booking_link text,
  website text,
  instagram text,
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)
);

create trigger practitioner_profiles_set_updated_at
before update on public.practitioner_profiles
for each row execute function public.set_updated_at();

alter table public.practitioner_profiles enable row level security;

drop policy if exists "practitioner_profiles_select_own" on public.practitioner_profiles;
create policy "practitioner_profiles_select_own"
on public.practitioner_profiles for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "practitioner_profiles_select_approved_public" on public.practitioner_profiles;
create policy "practitioner_profiles_select_approved_public"
on public.practitioner_profiles for select
to anon, authenticated
using (status = 'approved');

drop policy if exists "practitioner_profiles_insert_own" on public.practitioner_profiles;
create policy "practitioner_profiles_insert_own"
on public.practitioner_profiles for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "practitioner_profiles_update_own" on public.practitioner_profiles;
create policy "practitioner_profiles_update_own"
on public.practitioner_profiles for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id and status in ('draft', 'pending_review'));

-- --------------------------------------------
-- Profile Views: future analytics for practitioner dashboards
-- --------------------------------------------
create table if not exists public.profile_views (
  id uuid primary key default gen_random_uuid(),
  listing_id text,
  practitioner_profile_id uuid references public.practitioner_profiles(id) on delete set null,
  viewer_user_id uuid references auth.users(id) on delete set null,
  source_path text,
  referrer text,
  viewed_at timestamptz not null default now()
);

alter table public.profile_views enable row level security;

drop policy if exists "profile_views_insert_public" on public.profile_views;
create policy "profile_views_insert_public"
on public.profile_views for insert
to anon, authenticated
with check (true);

drop policy if exists "profile_views_select_own_practitioner" on public.profile_views;
create policy "profile_views_select_own_practitioner"
on public.profile_views for select
to authenticated
using (
  exists (
    select 1 from public.practitioner_profiles pp
    where pp.id = profile_views.practitioner_profile_id
      and pp.user_id = auth.uid()
  )
);

-- Helpful indexes
create index if not exists idx_favorites_user_type on public.favorites(user_id, item_type);
create index if not exists idx_wellness_match_user on public.wellness_match_results(user_id);
create index if not exists idx_practitioner_profiles_user on public.practitioner_profiles(user_id);
create index if not exists idx_practitioner_profiles_status on public.practitioner_profiles(status);
create index if not exists idx_profile_views_practitioner on public.profile_views(practitioner_profile_id, viewed_at desc);
