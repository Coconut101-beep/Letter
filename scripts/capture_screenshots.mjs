#!/usr/bin/env node
/**
 * Capture README preview screenshots (Pages 1–4).
 * Usage: python3 -m http.server 8765 & node scripts/capture_screenshots.mjs
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "docs", "screenshots");
const BASE = process.env.SCREENSHOT_BASE || "http://127.0.0.1:8765/index.html";
const VIEWPORT = { width: 1280, height: 900 };
const PREVIEW_NAME = "Friend";

/** Sample scratchboard bundled in repo — no personal names in public previews. */
const PREVIEW_SCRATCHBOARD = {
  image: "assets/img/adi/scratchboard",
  aspect: "4 / 5",
  background: "#222B24",
  alt: "Memory collage preview",
};

const shots = [
  {
    file: "01-home.png",
    setup: async (page) => {
      await page.evaluate(() => window.Lorina?.showView("seal"));
    },
  },
  {
    file: "02-passkey.png",
    setup: async (page) => {
      await page.evaluate(() => {
        window.Lorina.showView("passkey");
        document.getElementById("view-passkey")?.classList.add("is-icon-ready");
      });
    },
  },
  {
    file: "03-memories.png",
    setup: async (page) => {
      await page.evaluate(
        ({ name, board }) => {
          window.Lorina.openMemories({
            name,
            scratchboard: board,
          });
        },
        { name: PREVIEW_NAME, board: PREVIEW_SCRATCHBOARD }
      );
      await page.waitForFunction(() => {
        const img = document.getElementById("scratch-img");
        return img && img.complete && img.naturalWidth > 0;
      });
    },
  },
  {
    file: "04-letter.png",
    setup: async (page) => {
      await page.evaluate(
        ({ name }) => {
          window.Lorina.showView("letter");
          const title = document.getElementById("letter-title");
          const body = document.getElementById("letter-body");
          const signoff = document.getElementById("letter-signoff");
          const signname = document.getElementById("letter-signname");
          if (title) title.textContent = `A letter for ${name}`;
          if (signoff) signoff.textContent = "With love,";
          if (signname) signname.textContent = "Lorina";
          if (body) {
            body.innerHTML =
              "<p>Well, I did plan to write this letter today as one of my Notion tasks, but I didn't really know when I opened my laptop and felt like the right time to write it.</p>" +
              "<p>And I don't know why I already started crying while typing. It's funny how the people you love most can do that to you — even when they're not in the room.</p>" +
              "<p>I hope the words can stay with you no matter how far we are.</p>";
          }
        },
        { name: PREVIEW_NAME }
      );
    },
  },
];

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ channel: "chrome" });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    colorScheme: "light",
  });
  const page = await context.newPage();

  for (const { file, setup } of shots) {
    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.waitForFunction(() => window.Lorina?.showView);
    if (setup) await setup(page);
    await page.waitForTimeout(600);
    const dest = path.join(OUT, file);
    await page.screenshot({ path: dest, fullPage: false });
    console.log("wrote", dest);
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
