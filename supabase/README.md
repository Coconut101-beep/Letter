# Supabase — Letters from Lorina

SQL scripts for the private letter backend. Run in **Supabase → SQL Editor** in order.

| File | Purpose |
|------|---------|
| `00_preflight.sql` | Read-only check — see if tables already exist |
| `01_schema.sql` | Tables, RLS, `hash_passkey()`, `get_letter_for()` |
| `02_seed.sql` | 13 friends, letter shells, Adi media rows |
| `03_seed_letters.sql` | Letter bodies + app settings (generated) |
| `99_reset.sql` | Drop everything and start over |

## First-time setup

1. **Preflight** — run `00_preflight.sql`. If `friends` / `letters` exist with wrong columns, run `99_reset.sql` first.
2. **Schema** — run `01_schema.sql`.
3. **Seed friends** — run `02_seed.sql`.
4. **Seed letter copy** — regenerate then run `03_seed_letters.sql`:

```bash
python3 scripts/generate_supabase_seed.py
```

5. **Storage** — create a private bucket `letter-media` and upload paths referenced in `02_seed.sql` (Adi photos, scratchboard, shared soundtrack).
6. **Verify** (SQL Editor):

```sql
select * from public.get_letter_for('adi', 'ExamplePasskey123');
```

## Schema overview

- **`friends`** — username, bcrypt passkey hash, seal monogram, aliases
- **`letters`** — title, opener, paragraphs (jsonb), scratchboard config, lock flags
- **`letter_media`** — private storage paths for images / video / audio
- **`app_settings`** — global UI copy + soundtrack metadata (`meta`, `copy`, `soundtrack`)

RLS is enabled with **no policies** for `anon` / `authenticated`. Only the Edge Function (`service_role`) can read/write.

## Updating letter text

Edit `data/letters.json`, then:

```bash
python3 scripts/generate_supabase_seed.py
```

Re-run `03_seed_letters.sql` in Supabase. Friend passkeys / media rows are unchanged.

## Security notes

- Plaintext passkeys live only in `02_seed.sql` during initial seeding.
- After first deploy, rotate passkeys in Supabase and remove plaintext from git if desired.
- Never expose `service_role` key in the static site.
