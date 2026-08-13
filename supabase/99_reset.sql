-- Letters from Lorina — RESET / UNDO
--
-- ⚠️  DELETES ALL LETTER DATA IN THE DATABASE.
-- Does NOT touch Storage bucket files or this repo.
--
-- After running: 01_schema.sql → 02_seed.sql → 03_seed_letters.sql

drop function if exists public.get_letter_for(text, text);
drop function if exists public.hash_passkey(text);

drop table if exists public.letter_media cascade;
drop table if exists public.letters      cascade;
drop table if exists public.friends      cascade;
drop table if exists public.app_settings cascade;

drop function if exists public.touch_updated_at() cascade;

-- Confirm clean — should return 0 rows:
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('friends','letters','letter_media','app_settings');
