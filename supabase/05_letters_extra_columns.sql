-- Letters from Lorina -- add the columns Cursor's generator expects
--
-- 01_schema.sql defined a minimal letters table. Cursor's
-- generate_supabase_seed.py writes richer per-person structures pulled
-- straight out of data/letters.json (scratchboard config, memories, music,
-- and assorted UI extras).
--
-- Every statement is "if not exists", so this is safe to run repeatedly and
-- safe to run even if some columns already exist.
-- Extra unused columns are harmless: they sit empty.
--
-- Run BEFORE 03_seed_letters.sql.

alter table public.letters add column if not exists scratchboard jsonb;
alter table public.letters add column if not exists memories    jsonb;
alter table public.letters add column if not exists music       jsonb;
alter table public.letters add column if not exists soundtrack  jsonb;
alter table public.letters add column if not exists gallery     jsonb;
alter table public.letters add column if not exists copy        jsonb;
alter table public.letters add column if not exists cta         jsonb;
alter table public.letters add column if not exists extras      jsonb;

-- Bilingual / caption fields that may be written as plain text:
alter table public.letters add column if not exists title_zh    text;
alter table public.letters add column if not exists greeting_zh text;
alter table public.letters add column if not exists signoff_zh  text;

-- Friends table equivalents, in case the generator writes there too:
alter table public.friends add column if not exists display_name_zh text;
alter table public.friends add column if not exists avatar          text;

-- Show the resulting letters schema so you can compare against the generator:
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'letters'
order by ordinal_position;
