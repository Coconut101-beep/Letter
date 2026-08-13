-- Letters from Lorina — seed data (friends + letter shells + media)
-- Run AFTER 01_schema.sql, in Supabase → SQL Editor.
-- Then run 03_seed_letters.sql (generated from data/letters.json).
--
-- Passkeys: real plaintext values were removed after the initial seed.
-- See your password manager. Re-seeding passkeys requires the live values
-- substituted back into hash_passkey('...') before running this script.

-- ============================================================
-- friends (13 recipients)
-- ============================================================
insert into public.friends (username, display_name, passkey_hash, seal, aliases)
values
  ('adi',     'Adi',     public.hash_passkey('REDACTED_SEE_PASSWORD_MANAGER'),       'L&M', array['adi']),
  ('stacy',   'Stacy',   public.hash_passkey('REDACTED_SEE_PASSWORD_MANAGER'),              'S&L', array['stacy']),
  ('bunzel',  'Bunzel',  public.hash_passkey('REDACTED_SEE_PASSWORD_MANAGER'),            'B&L', array['bunzel']),
  ('sylvia',  'Sylvia',  public.hash_passkey('REDACTED_SEE_PASSWORD_MANAGER'),             'S&L', array['sylvia']),
  ('lucy',    'Lucy',    public.hash_passkey('REDACTED_SEE_PASSWORD_MANAGER'),        'L&L', array['lucy']),
  ('josie',   'Josie',   public.hash_passkey('REDACTED_SEE_PASSWORD_MANAGER'),     'J&L', array['josie']),
  ('anson',   'Anson',   public.hash_passkey('REDACTED_SEE_PASSWORD_MANAGER'),  'A&L', array['anson']),
  ('david',   'David',   public.hash_passkey('REDACTED_SEE_PASSWORD_MANAGER'), 'D&L', array['david']),
  ('pardis',  'Pardis',  public.hash_passkey('REDACTED_SEE_PASSWORD_MANAGER'),              'P&L', array['pardis']),
  ('hon',     'Hon',     public.hash_passkey('REDACTED_SEE_PASSWORD_MANAGER'),     'H&L', array['hon']),
  ('amy',     'Amy',     public.hash_passkey('REDACTED_SEE_PASSWORD_MANAGER'),           'A&L', array['amy']),
  ('momdad',  'Mom&Dad', public.hash_passkey('REDACTED_SEE_PASSWORD_MANAGER'),            'M&D', array['mom','mum','mama','dad','妈妈','爸爸']),
  ('yangran', '杨冉',     public.hash_passkey('REDACTED_SEE_PASSWORD_MANAGER'),    'Y&L', array['yangran','杨冉'])
on conflict (username) do update
  set display_name  = excluded.display_name,
      passkey_hash  = excluded.passkey_hash,
      seal          = excluded.seal,
      aliases       = excluded.aliases,
      is_active     = true;

-- Aunt — uncomment and set a passkey before enabling:
-- insert into public.friends (username, display_name, passkey_hash, seal, aliases)
-- values ('aunt', 'Aunt', public.hash_passkey('REDACTED_SEE_PASSWORD_MANAGER'), 'A&L', array['aunt'])
-- on conflict (username) do update
--   set display_name = excluded.display_name,
--       passkey_hash = excluded.passkey_hash,
--       seal = excluded.seal,
--       aliases = excluded.aliases;

-- ============================================================
-- letter shells — one row per friend
-- Adi body below; other copy in 03_seed_letters.sql when ready.
-- ============================================================
insert into public.letters (friend_id, slug, title, greeting, is_locked)
select f.id,
       f.username || '-2026',
       case f.username
         when 'adi' then 'A letter for Adi'
         else 'A letter for ' || f.display_name
       end,
       'For ' || f.display_name,
       f.username <> 'adi'
from public.friends f
on conflict (slug) do update
  set title    = excluded.title,
      greeting = excluded.greeting;

-- ============================================================
-- Adi — full letter body (verbatim from data/letters.json)
-- ============================================================
update public.letters l
set
  opener = 'Today is July 5th; it’s a very random Sunday. The weather outside is very gloomy, with a sea salt breeze I really love. It’s 26 degrees temperature-wise. And I am listening to Taylor Swift’s “Champagne Problems” on repeat. But no worries, I am not drinking champagne here without you; instead, I am having a lactose-free coffee from early this morning. So everything is cozy.',
  paragraphs = '["Well, I did plan to write this letter today as one of my Notion tasks, but I didn’t really know when I opened my laptop and felt like the right time to write it. And I don’t know why I already started crying while typing. It’s funny cause I haven’t really started. But now, excuse me, I have to go and close the window cause it’s making the door make the clicking sound.", "Ok, I am back.", "This is going to be very messy writing since I am not really using AI. So do bear with me not having the optimized words or logic. Because I think the feelings we have can’t really be quantified or optimised. It is meant to be messy.", "Well, where should I start? Dating back to the time that we first kissed, that should be on May 6th; now it’s been 2 months already, which is one-sixth of a year. But if we dug back a little longer, it’s already been 3 years that we have been friends, which is one-seventh of my life so far. I think you know me quite a lot now, but I still walk you through my life in the past 4 days because words sometimes communicate better than conversations in ways that you don’t know.", "University is a very space for me, so many things have happened in the past years. I have been traveling, dating, studying, working, and exploring in my own ways that I have never imagined before. But it’s now all gradually becoming a reality that I am living in right now. So I assume I am on the right track in life.", "If you remember, the first time we started having a conversation with each other was at Little Sydney. You said that you liked me right after you talked to me.", "But I was actually at a very vulnerable place in life at that stage of my life. I was right after the stage where I confessed my feelings to Lukas, but it led nowhere, and meanwhile, I lost a good friend, Saduddee. Most importantly, I was desperately trying to prove my self-worth, and that came out in a format of over-obsession with my grades and over-attention to other people’s, which turned into frustration cause I compare too much. So I carried this messiness to Chicago with the initial aim to improve my R programming skills and make my resume look better. But somehow it led me to Costa Rica, where I would consider my earliest pivot point of life. I was no good with words at that time, but I think that’s the first time in life that I started to love nature-the wilderness and, of course, the voidness of the ocean. I have never felt so refreshed like a newborn, and it’s the first time I know why. Because I never allow myself to slow down, flow, nor vibing. That’s the epiphany where I know the power of “slow” in life-a space where you can sit with your feelings and show your truest human nature.", "The summer I came back, I met Ethan, who is a very special person. Not only because he is the person that I am brave enough to say “I love you” to for the first time, but also because he made me realize lots of things about myself and partly shaped me into who I am today. So I want to be very honest with you about my feelings for him. But no worries, the sex isn’t that good, since now that I have someone better to compare with :D.", "I met Ethan at the most peaceful stage of my life. It was right after Costa Rica; I came back fresh with this energy within me that attracts people easily who share this energy with you. The first date that we had was a coffee chat; that summer he also went on solo trips to East Asia. The first date that we had, from trio to the grass, was so immersive because we were so alike. We both love space, technology, traveling, and most importantly, the timing is systemic. So it felt like we were perfect together, which we were; we would spend days in the libraries, creating memories that just belong to both of us. If you wonder why such a rational person would start this relationship, I guess it is because it felt so good; I guess you just wanna drown in it. So even though we had hundreds of conversations about it, despite how our future together is tiny. We both follow the philosophy of “live in the present”.", "I remembered that time when I took him back to my parents. I had a fever 2 days before my flight to Sydney; I was actually thinking about not going. My dad and I had a conversation on the hospital chair, and the conversation went “ 我觉得这个男孩子挺好，你们现在是…? 我不知道，走一步是一步吧…就当我们是好朋友吧…好，也挺好的在悉尼有人能照顾你…嗯” My dad really likes him because polite and seems promising, so does my family, but my mom never thinks it would work. That breakup before heading out to a new city was worsened by the fever, which made me reflect on what we actually had. Because I slowly get to realize the complexity of reality and the weight of it.", "Things went well at the beginning in Sydney; I met his family, we went on a Valentine’s date, and I spent the night over at this house. Everything for me is new; for him is old. I was being a very considerate girlfriend (at least I think so) when he mentioned that he’s going to be busy following his morning 7, night 10 rules, so he can only spend one night at my place. I said, sure, I can explore the city with my friends; when he said, I wish you could join my family dinner every Friday, I said I will definitely if I don’t have trip plans (even though I really don’t enjoy the conversations); when he said I am probably not going out this Saturday case I have got a coffee chat to have, I said sure I will just be working in your room with you; when he said I feel bad I am being a responsible boyfriend, I said that I understand you are looking for internship you must be busy. I thought, following my love philosophy, like the one that I read in the books-love sometimes means that you need to sacrifice; I could save this broken ship. So I chose to mute some of the words he said, I don’t think you like my culture (when her aunts offered me to go to a charity together). I felt like a victim waiting for him to decide whether I pass the family test (by the standards he creates).", "I am an outsider, standing outside the door of a castle he built, begging him to open the door for me. I want him to accept me and love me. Not really caring whether it’s drowning me or not. I want it so bad. Why? Because losing him means I have to go through Sydney with the breakup as the background noise; it means that I am not the same type of person as him (which initially, in my eyes, represents some good qualities like persistence, kindness…); it most importantly means that I will be forced to enter chaos where I am highly emotionally unstable and that could potentially fked up my grades and future…..It’s too much of a risk, so I was scared to leave it.", "Almost 6 months of this relationship, I can’t keep lying to myself that I am doing well. So I cut him off, and you know the story afterwards. It was one of the darkest moments of my life, but I am so grateful for that journey; I came out as a better human.", "So that all brings me here today to you, Adi. You always said that you sometimes feel like you don’t deserve it because it may seem like, from the outside, I am glamorous. But that’s never the whole me. The real me is very messy and unpredictable. The night when we shared a conversation and I cried so hard for losing a good friend- that’s the me; the wasted night at the ins-that’s me; the days where I didn’t finish my plan and blamed myself the next day- that’s also me, and so many more. Those moments shaped me, and luckily you were there most of the time.", "Now that we are in a very early stage of our relationship, we are going to face so many bumps along the way. We are going to have fights; we are going to start getting bored with each other; we are going to change on our own path, which means we might not be on the same page; we are going to have the thought of giving up; we are going to blame each other for not being considerate…All of those are the reasons why I don’t want to label this relationship at first, but I think responsibility doesn’t need old age to carry.", "I love you. That came to you so easily, but that used to be a sentence I planned to say with the perfect timing,", "I wonder a lot what I really need in a relationship. And I don’t think I still know it yet. But I want you to be the one who can explore with me together. Realistically, we all want to spend the rest of our lives somewhere else in this world. So logically, we can build a future together. I am not the best girlfriend in the world; I have a confusing temper sometimes, and I may expect you to do something even though that might not be your thing to do…long distance may magnify some of the others too. But I want us to keep open conversation all the time, and try not to hide any secrets from each other.", "And don’t pressure yourself and worry too much about having to make it to London. Remember life is unpredictable, so go with the flow, but do try your best for things you want in life instead of watching them pass by you. I love you so much, and I can’t wait to explore more of life with you!"]'::jsonb,
  signoff = 'With love,',
  sign_name = 'Lorina',
  is_locked = false
from public.friends f
where l.friend_id = f.id and f.username = 'adi';

-- ============================================================
-- letter_media — Adi (upload matching paths to private letter-media bucket)
-- ============================================================
insert into public.letter_media (letter_id, media_key, type, storage_path, filename, caption, sort_order, metadata)
select l.id, v.media_key, v.type, v.storage_path, v.filename, v.caption, v.sort_order, v.metadata::jsonb
from public.letters l
join (values
  ('01',         'image', 'adi/photos/01.jpg',                    '01.jpg',                  'One of my favourite memories', 1,   '{}'),
  ('02',         'image', 'adi/photos/02.jpg',                    '02.jpg',                  null,                           2,   '{}'),
  ('03',         'image', 'adi/photos/03.jpg',                    '03.jpg',                  null,                           3,   '{}'),
  ('clip',       'video', 'adi/video/clip.mp4',                   'clip.mp4',                null,                           20,  '{}'),
  ('board-webp', 'image', 'adi/board/scratchboard.webp',          'scratchboard.webp',       'Scratchboard primary',         90,  '{"role":"scratchboard"}'),
  ('board-jpg',  'image', 'adi/board/scratchboard.jpg',           'scratchboard.jpg',        'Scratchboard fallback',        91,  '{"role":"scratchboard","aspect":"1314 / 1666"}'),
  ('song',       'audio', 'shared/audio/Tides_in_the_Parlor.mp3', 'Tides_in_the_Parlor.mp3', 'Tides in the Parlor',          100, '{"role":"soundtrack","playLabel":"Play memory soundtrack","pauseLabel":"Pause soundtrack"}')
) as v(media_key, type, storage_path, filename, caption, sort_order, metadata)
  on true
where l.slug = 'adi-2026'
on conflict (letter_id, media_key) do update
  set type         = excluded.type,
      storage_path = excluded.storage_path,
      filename     = excluded.filename,
      caption      = excluded.caption,
      sort_order   = excluded.sort_order,
      metadata     = excluded.metadata;

-- ============================================================
-- checks
-- ============================================================
-- select username, display_name from public.friends order by username;
-- select f.username, l.slug, l.is_locked from public.letters l join public.friends f on f.id = l.friend_id;
-- select * from public.get_letter_for('adi', 'YOUR_PASSKEY');
