-- Letters from Lorina — PRE-FLIGHT CHECK
-- Read-only. Changes nothing. Run this FIRST in Supabase → SQL Editor.
-- Purpose: find out whether your project already has conflicting tables.

-- 1. What tables already exist?
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;

-- EXPECTED on a clean project: 0 rows.
-- If you see friends / letters / letter_media here, run query 2 before doing anything else.


-- 2. If those tables exist, what columns do they have?
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name in ('friends','letters','letter_media')
order by table_name, ordinal_position;

-- If the columns match my schema → fine, 01_schema.sql will skip them harmlessly.
-- If the columns are DIFFERENT → stop. Run 99_reset.sql first, or tell me what you see.


-- 3. Is there any data in them already?
-- (Only run this if the tables exist. It errors otherwise — that error is harmless.)
-- select 'friends' as t, count(*) from public.friends
-- union all select 'letters', count(*) from public.letters
-- union all select 'letter_media', count(*) from public.letter_media;
