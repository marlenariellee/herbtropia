
-- Herbtropia Sprint Patch — Provider credential and verification fields
-- Run this in Supabase SQL Editor before testing /practitioner-onboarding/.

alter table public.practitioner_profiles
  add column if not exists credential_types text[] default '{}',
  add column if not exists license_title text,
  add column if not exists license_number text,
  add column if not exists license_state text,
  add column if not exists licensing_board text,
  add column if not exists license_verification_url text,
  add column if not exists certification_title text,
  add column if not exists certification_issuer text,
  add column if not exists certification_id text,
  add column if not exists certification_verification_url text,
  add column if not exists credential_notes text,
  add column if not exists verification_requested boolean default false,
  add column if not exists verification_consent boolean default false,
  add column if not exists verification_status text default 'not_requested',
  add column if not exists updated_at timestamptz default now();

create unique index if not exists practitioner_profiles_user_id_unique
  on public.practitioner_profiles(user_id);

-- Optional helper comment for your future admin workflow:
comment on column public.practitioner_profiles.verification_status is
  'not_requested, requested, reviewing, verified, needs_info, declined';
