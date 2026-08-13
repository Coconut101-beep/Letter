-- Letters from Lorina — Supabase schema
-- Run ONCE in Supabase → SQL Editor (after 00_preflight.sql on a new project).
-- Safe to re-run: tables/functions use IF NOT EXISTS / OR REPLACE guards.

create extension if not exists pgcrypto with schema extensions;

-- ============================================================
-- 1. friends
-- ============================================================
create table if not exists public.friends (
  id            uuid primary key default gen_random_uuid(),
  username      text not null unique,
  display_name  text not null,
  passkey_hash  text not null,
  seal          text,
  aliases       text[] default '{}',
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index if not exists friends_username_lower_idx
  on public.friends (lower(username));

-- ============================================================
-- 2. letters
-- ============================================================
create table if not exists public.letters (
  id           uuid primary key default gen_random_uuid(),
  friend_id    uuid not null references public.friends(id) on delete cascade,
  slug         text not null unique,
  title        text not null,
  greeting     text,
  opener       text,
  paragraphs   jsonb,           -- ["para one", "para two"]
  blocks       jsonb,           -- future rich blocks [{type,...}]
  scratchboard jsonb,           -- {image, alt, aspect, background, caption_en, caption_zh}
  signoff      text default 'With love,',
  sign_name    text default 'Lorina',
  is_locked    boolean not null default false,
  unlock_date  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists letters_friend_id_idx on public.letters (friend_id);

-- add scratchboard column when upgrading an older install
alter table public.letters
  add column if not exists scratchboard jsonb;

-- ============================================================
-- 3. letter_media  (private bucket paths — not public URLs)
-- ============================================================
create table if not exists public.letter_media (
  id            uuid primary key default gen_random_uuid(),
  letter_id     uuid not null references public.letters(id) on delete cascade,
  media_key     text not null,
  type          text not null check (type in ('image','video','audio')),
  storage_path  text not null,
  filename      text,
  caption       text,
  sort_order    int default 0,
  metadata      jsonb default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  unique (letter_id, media_key)
);

create index if not exists letter_media_letter_id_idx on public.letter_media (letter_id);

-- ============================================================
-- 4. app_settings  (global UI copy, soundtrack metadata)
-- ============================================================
create table if not exists public.app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 5. updated_at triggers
-- ============================================================
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists friends_touch on public.friends;
create trigger friends_touch before update on public.friends
  for each row execute function public.touch_updated_at();

drop trigger if exists letters_touch on public.letters;
create trigger letters_touch before update on public.letters
  for each row execute function public.touch_updated_at();

drop trigger if exists app_settings_touch on public.app_settings;
create trigger app_settings_touch before update on public.app_settings
  for each row execute function public.touch_updated_at();

-- ============================================================
-- 6. RLS — lock everything down (Edge Function uses service_role)
-- ============================================================
alter table public.friends      enable row level security;
alter table public.letters      enable row level security;
alter table public.letter_media enable row level security;
alter table public.app_settings   enable row level security;

revoke all on public.friends      from anon, authenticated;
revoke all on public.letters      from anon, authenticated;
revoke all on public.letter_media from anon, authenticated;
revoke all on public.app_settings from anon, authenticated;

-- ============================================================
-- 7. hash_passkey — bcrypt via pgcrypto (extensions schema)
--   select public.hash_passkey('ExamplePasskey123');
-- ============================================================
create or replace function public.hash_passkey(plain text)
returns text
language sql
security definer
set search_path = public, extensions
as $func$
  select crypt(plain, gen_salt('bf', 10));
$func$;

revoke all on function public.hash_passkey(text) from anon, authenticated;

-- ============================================================
-- 8. get_letter_for — verify login + return letter payload
--    Called by Edge Function only (service_role).
-- ============================================================
create or replace function public.get_letter_for(p_name text, p_passkey text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $func$
declare
  v_friend public.friends%rowtype;
  v_letter public.letters%rowtype;
  v_media  jsonb;
  v_settings jsonb;
begin
  select * into v_friend
  from public.friends
  where (lower(username) = lower(trim(p_name))
         or lower(trim(p_name)) = any (select lower(a) from unnest(aliases) a))
    and is_active
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_match');
  end if;

  if v_friend.passkey_hash is null
     or crypt(p_passkey, v_friend.passkey_hash) <> v_friend.passkey_hash then
    return jsonb_build_object('ok', false, 'reason', 'no_match');
  end if;

  select * into v_letter
  from public.letters
  where friend_id = v_friend.id
  order by created_at desc
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_letter');
  end if;

  if v_letter.is_locked
     or (v_letter.unlock_date is not null and v_letter.unlock_date > now()) then
    return jsonb_build_object('ok', false, 'reason', 'locked',
                              'unlock_date', v_letter.unlock_date);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'media_key', m.media_key,
           'type', m.type,
           'storage_path', m.storage_path,
           'caption', m.caption,
           'sort_order', m.sort_order,
           'metadata', m.metadata
         ) order by m.sort_order), '[]'::jsonb)
    into v_media
  from public.letter_media m
  where m.letter_id = v_letter.id;

  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
    into v_settings
  from public.app_settings;

  return jsonb_build_object(
    'ok', true,
    'friend', jsonb_build_object(
      'username', v_friend.username,
      'display_name', v_friend.display_name,
      'seal', v_friend.seal
    ),
    'letter', jsonb_build_object(
      'title', v_letter.title,
      'greeting', v_letter.greeting,
      'opener', v_letter.opener,
      'paragraphs', coalesce(v_letter.paragraphs, '[]'::jsonb),
      'blocks', v_letter.blocks,
      'scratchboard', v_letter.scratchboard,
      'signoff', v_letter.signoff,
      'sign_name', v_letter.sign_name
    ),
    'media', v_media,
    'settings', v_settings
  );
end
$func$;

revoke all on function public.get_letter_for(text, text) from anon, authenticated;
