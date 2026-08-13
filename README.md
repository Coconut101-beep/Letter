# Letters from Lorina

A vintage soft-editorial letter site — sealed, intimate, handwritten. Vanilla HTML/CSS/JS, no build step.

Design direction adapted from [beautiful-html-templates / soft-editorial](https://github.com/zarazhangrui/beautiful-html-templates/tree/main/templates/soft-editorial), pushed warmer and more romantic (cream paper `#FBEFD9`, warm ink, blush / deep rose / lemon).

## Flow

Single `index.html` with JS view switching:

1. **Sealed letter** — star-heart unlock over a vintage envelope
2. **Name + passkey** — cream card form
3. **Memories** — dark collage board (polaroids, film strip, ticket, stickers)
4. **Letter + music** — letter body, supporting panel, film-reel soundtrack toggle

## Content

Letter text, passkeys, and per-person media live in Supabase (not in this repo). Passkeys are stored as bcrypt hashes and shared privately with each recipient.

UI chrome strings for the pre-login pages are in `data/letters.json`. Drop media into private Supabase Storage (`letter-media` bucket).

## Local serve

```bash
python3 -m http.server 8765
```

Open [http://127.0.0.1:8765/index.html](http://127.0.0.1:8765/index.html)
