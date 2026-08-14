-- Letters from Lorina -- app_settings table
--
-- Cursor's generate_supabase_seed.py writes UI copy and soundtrack config
-- into public.app_settings, but 01_schema.sql never created that table.
-- Run this BEFORE 03_seed_letters.sql.
--
-- Safe to run more than once.

create table if not exists public.app_settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);

drop trigger if exists app_settings_touch on public.app_settings;
create trigger app_settings_touch before update on public.app_settings
  for each row execute function public.touch_updated_at();

-- Same posture as the other tables: RLS on, zero policies.
-- Only the Edge Function (service role) can read it.
alter table public.app_settings enable row level security;

revoke all on public.app_settings from anon, authenticated;

-- Confirm it exists (expect one row):
select table_name
from information_schema.tables
where table_schema = 'public' and table_name = 'app_settings';
