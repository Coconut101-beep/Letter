-- Demo letter: Vincent van Gogh → Theo (Letter 705, 16 Oct 1888, Arles)
-- Public-domain excerpt for visitors to try the full interactive flow.
-- Login: name `demo` · passkey `DEMO2026`

-- Fixed UUIDs (stable across re-runs)
-- friend:  11111111-1111-4111-8111-111111111101
-- letter:  11111111-1111-4111-8111-111111111102

-- ---------------------------------------------------------------------------
-- 1. Flag column — demo rows can be filtered out of real-user/admin queries
-- ---------------------------------------------------------------------------
alter table public.friends
  add column if not exists is_demo boolean not null default false;

alter table public.letters
  add column if not exists is_demo boolean not null default false;

-- ---------------------------------------------------------------------------
-- 2. Demo friend — same passkey storage as production (bcrypt via hash_passkey)
-- ---------------------------------------------------------------------------
insert into public.friends (
  id,
  username,
  display_name,
  passkey_hash,
  seal,
  aliases,
  is_active,
  is_demo
)
values (
  '11111111-1111-4111-8111-111111111101'::uuid,
  'demo',
  'Demo — Vincent to Theo',
  public.hash_passkey('DEMO2026'),
  'V&T',
  array['demo', 'vincent', 'theo'],
  true,
  true
)
on conflict (id) do update set
  username      = excluded.username,
  display_name  = excluded.display_name,
  passkey_hash  = excluded.passkey_hash,
  seal          = excluded.seal,
  aliases       = excluded.aliases,
  is_active     = excluded.is_active,
  is_demo       = excluded.is_demo,
  updated_at    = now();

-- ---------------------------------------------------------------------------
-- 3. Demo letter — fixed UUID; scratchboard.image holds public Wikimedia URL
-- ---------------------------------------------------------------------------
insert into public.letters (
  id,
  friend_id,
  slug,
  title,
  greeting,
  opener,
  paragraphs,
  scratchboard,
  signoff,
  sign_name,
  is_locked,
  is_demo
)
values (
  '11111111-1111-4111-8111-111111111102'::uuid,
  '11111111-1111-4111-8111-111111111101'::uuid,
  'demo-vincent-theo-1888',
  'The Bedroom',
  'My dear Theo —',
  'At last I''m sending you a little croquis to give you at least an idea of the direction the work is taking. Because today I''ve gone back to it.',
  $paragraphs$[
    "My eyes are still tired, but anyway I had a new idea in mind, and here's the croquis of it. No. 30 canvas once again.",
    "This time it's simply my bedroom, but the colour has to do the job here, and through its being simplified by giving a grander style to things, to be suggestive here of rest or of sleep in general. In short, looking at the painting should rest the mind, or rather, the imagination.",
    "The walls are of a pale violet. The floor — is of red tiles.",
    "The bedstead and the chairs are fresh butter yellow.",
    "The sheet and the pillows very bright lemon green.",
    "The blanket scarlet red.",
    "The window green.",
    "The dressing table orange, the basin blue.",
    "The doors lilac.",
    "And that's all — nothing in this bedroom, with its shutters closed.",
    "The solidity of the furniture should also now express unshakeable repose. Portraits on the wall, and a mirror and a hand-towel and some clothes.",
    "[…]",
    "I'll work on it again all day tomorrow, but you can see how simple the idea is. The shadows and cast shadows are removed; it's coloured in flat, plain tints like Japanese prints.",
    "[…]",
    "Source: Vincent van Gogh to Theo van Gogh, Arles, Tuesday 16 October 1888 (Letter 705 / CL 554). Van Gogh Museum, Amsterdam. https://vangoghletters.org/vg/letters/let705/letter.html"
  ]$paragraphs$::jsonb,
  jsonb_build_object(
    'image', 'https://upload.wikimedia.org/wikipedia/commons/7/76/Vincent_van_Gogh_-_De_slaapkamer_-_Google_Art_Project.jpg',
    'alt', 'Vincent van Gogh, Bedroom in Arles (1888)',
    'aspect', '5 / 4',
    'background', '#222B24',
    'caption_en', 'The painting he describes in this letter — Bedroom in Arles (1888).',
    'image_source_url', 'https://commons.wikimedia.org/wiki/File:Vincent_van_Gogh_-_De_slaapkamer_-_Google_Art_Project.jpg',
    'image_attribution', 'Vincent van Gogh, Bedroom in Arles (1888), Van Gogh Museum, Amsterdam — Wikimedia Commons (public domain).'
  ),
  'Ever yours,',
  'Vincent',
  false,
  true
)
on conflict (id) do update set
  friend_id    = excluded.friend_id,
  slug         = excluded.slug,
  title        = excluded.title,
  greeting     = excluded.greeting,
  opener       = excluded.opener,
  paragraphs   = excluded.paragraphs,
  scratchboard = excluded.scratchboard,
  signoff      = excluded.signoff,
  sign_name    = excluded.sign_name,
  is_locked    = excluded.is_locked,
  is_demo      = excluded.is_demo,
  updated_at   = now();

-- ---------------------------------------------------------------------------
-- 4. RLS — anon may read demo rows only (all private letters stay blocked)
--    The live site login path still uses get-letter → get_letter_for (service_role).
--    These policies allow direct anon SELECT on is_demo = true rows only, e.g.
--    for a future public preview API or Supabase client read of demo metadata.
-- ---------------------------------------------------------------------------
drop policy if exists "anon_select_demo_friends" on public.friends;
create policy "anon_select_demo_friends"
  on public.friends
  for select
  to anon
  using (is_demo is true);

drop policy if exists "anon_select_demo_letters" on public.letters;
create policy "anon_select_demo_letters"
  on public.letters
  for select
  to anon
  using (is_demo is true);

-- Exclude demo from real-user/admin queries, e.g.:
--   select * from public.friends where not is_demo;
--   select * from public.letters where not is_demo;

-- ---------------------------------------------------------------------------
-- 5. Smoke test (service role / SQL editor)
-- ---------------------------------------------------------------------------
-- select public.get_letter_for('demo', 'DEMO2026');
