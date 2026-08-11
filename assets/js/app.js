/* Letters from Lorina — view switching & interactions (vanilla JS) */
(function () {
  "use strict";

  const CACHE = "20260811t";
  const DATA_URL = `data/letters.json?v=${CACHE}`;

  const state = {
    data: null,
    personKey: null,
    person: null,
    opening: false,
    musicReady: false,
    wired: false,
    scratch: null,
  };

  function copy() {
    return (state.data && state.data.copy) || {};
  }

  const reduceMotion = () =>
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function bust(url) {
    if (!url) return "";
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}v=${CACHE}`;
  }

  function $(id) {
    return document.getElementById(id);
  }

  function norm(v) {
    return String(v || "")
      .trim()
      .toLowerCase();
  }

  /* ---------- Views ---------- */
  function showView(name) {
    const views = document.querySelectorAll(".view");
    views.forEach((v) => {
      const match = v.dataset.view === name;
      v.classList.toggle("is-active", match);
      v.hidden = !match;
      if (match) {
        v.classList.add("is-entering");
        setTimeout(() => v.classList.remove("is-entering"), reduceMotion() ? 320 : 450);
      }
    });
    if (name === "passkey") {
      clearPasskeyFields();
      // Beat stubborn browser autofill that lands after paint
      requestAnimationFrame(clearPasskeyFields);
      setTimeout(clearPasskeyFields, 50);
    }
    window.scrollTo(0, 0);
  }

  function openSeal() {
    if (state.opening) return;
    const stage = $("seal-stage");
    const veil = $("pink-veil");
    const sealView = $("view-seal");
    if (!stage) return;
    state.opening = true;
    stage.classList.add("is-opening");
    if (sealView) sealView.classList.add("is-opening");

    if (reduceMotion()) {
      if (veil) veil.classList.add("is-on");
      setTimeout(() => {
        if (veil) veil.classList.remove("is-on");
        showView("passkey");
        stage.classList.remove("is-opening");
        if (sealView) sealView.classList.remove("is-opening");
        state.opening = false;
      }, 300);
      return;
    }

    setTimeout(() => {
      if (veil) veil.classList.add("is-on");
    }, 400);

    setTimeout(() => {
      showView("passkey");
      if (veil) veil.classList.remove("is-on");
      stage.classList.remove("is-opening");
      if (sealView) sealView.classList.remove("is-opening");
      state.opening = false;
    }, 1500);
  }

  /* ---------- Data ---------- */
  async function loadData() {
    try {
      const res = await fetch(DATA_URL, { cache: "no-cache" });
      if (!res.ok) throw new Error("bad status");
      state.data = await res.json();
    } catch (err) {
      console.warn("letters.json failed to load", err);
      state.data = null;
    }
    return state.data;
  }

  function findPerson(name, passkey) {
    if (!state.data || !state.data.people) return null;
    const n = norm(name);
    const p = norm(passkey);
    const entries = Object.entries(state.data.people);
    for (const [key, person] of entries) {
      const names = [person.name, key]
        .concat(person.aliases || [])
        .map(norm);
      if (names.includes(n) && norm(person.passkey) === p) {
        return { key, person };
      }
    }
    return null;
  }

  /* ---------- Shared UI copy (from data.copy) ---------- */
  function applySharedCopy() {
    const c = copy();
    const opening = c.openingLine || state.data?.openingLine;
    if (opening && $("opening-line")) $("opening-line").textContent = opening;

    if (c.seal) {
      if (c.seal.hint && $("seal-hint")) $("seal-hint").textContent = c.seal.hint;
      if (c.seal.heartAria && $("heart-btn")) {
        $("heart-btn").setAttribute("aria-label", c.seal.heartAria);
      }
    }

    if (c.passkey) {
      if (c.passkey.titleHtml && $("passkey-title")) {
        $("passkey-title").innerHTML = c.passkey.titleHtml;
      }
      if (c.passkey.sub && $("passkey-sub")) $("passkey-sub").textContent = c.passkey.sub;
      if (c.passkey.submit && $("passkey-submit")) {
        $("passkey-submit").textContent = c.passkey.submit;
      }
      if (c.passkey.back && $("passkey-back")) $("passkey-back").textContent = c.passkey.back;
      if (c.passkey.namePlaceholder && $("input-name")) {
        $("input-name").placeholder = c.passkey.namePlaceholder;
      }
      if (c.passkey.passkeyPlaceholder && $("input-passkey")) {
        $("input-passkey").placeholder = c.passkey.passkeyPlaceholder;
      }
    }

    if (c.memories) {
      /* Only the hippocampus line is bilingual; other Page 3 copy is English-only */
      setBilingual(
        "memories-headline",
        "memories-headline-zh",
        c.memories.headline_en,
        c.memories.headline_zh
      );
      if (c.memories.forLabel && $("memories-for-label")) {
        $("memories-for-label").textContent = c.memories.forLabel;
      }
      if (c.memories.scratchCaption && $("scratch-caption")) {
        $("scratch-caption").textContent = c.memories.scratchCaption;
      }
      if (c.memories.revealAll && $("reveal-all")) {
        $("reveal-all").textContent = c.memories.revealAll;
      }
      if (c.memories.cta && $("memories-continue")) {
        $("memories-continue").textContent = c.memories.cta;
      }
    }

    if (c.letter) {
      if (c.letter.asideLabel && $("letter-aside-label")) {
        $("letter-aside-label").textContent = c.letter.asideLabel;
      }
      if (c.letter.another && $("letter-another")) {
        $("letter-another").textContent = c.letter.another;
      }
    }
  }

  /**
   * Optional EN + ZH pair. ZH renders only when present — no empty line.
   * Reusable later for any caption that gains caption_en / caption_zh in data.
   */
  function setBilingual(enId, zhId, en, zh) {
    const enEl = $(enId);
    const zhEl = $(zhId);
    if (enEl) enEl.textContent = en || "";
    if (!zhEl) return;
    if (zh) {
      zhEl.hidden = false;
      zhEl.textContent = zh;
    } else {
      zhEl.hidden = true;
      zhEl.textContent = "";
    }
  }

  function setOptionalCaption(el, en, zh) {
    if (!el) return;
    if (!en) {
      el.hidden = true;
      el.textContent = "";
      return;
    }
    el.hidden = false;
    if (zh) {
      el.replaceChildren();
      const enSpan = document.createElement("span");
      enSpan.className = "lang-en";
      enSpan.textContent = en;
      const zhSpan = document.createElement("span");
      zhSpan.className = "lang-zh";
      zhSpan.lang = "zh-Hans";
      zhSpan.textContent = zh;
      el.classList.add("bilingual-block");
      el.append(enSpan, zhSpan);
    } else {
      el.classList.remove("bilingual-block");
      el.textContent = en;
    }
  }

  /* ---------- Page 3 — per-person scratchboard ---------- */
  function destroyScratch() {
    if (state.scratch && typeof state.scratch.destroy === "function") {
      state.scratch.destroy();
    }
    state.scratch = null;
  }

  function showMemoriesCta() {
    const cta = $("memories-cta");
    if (!cta) return;
    cta.hidden = false;
    requestAnimationFrame(() => cta.classList.add("is-visible"));
  }

  /**
   * Builds Page 3 from person.scratchboard.
   * Drop-in shape (same for all 13):
   *   people.<id>.scratchboard = {
   *     image: "assets/img/<id>/scratchboard",  // base path, no extension
   *     alt, aspect, background,
   *     caption_en, caption_zh,           // optional board caption (ZH only if set)
   *     headline_en, headline_zh          // optional overrides of shared copy
   *   }
   * Set image to null until that person's board is ready.
   * Call only after the memories view is visible so the canvas can size.
   */
  function buildMemories(person) {
    const stage = $("scratch-stage");
    const picture = $("scratch-picture");
    const img = $("scratch-img");
    const webp = $("scratch-webp");
    const missing = $("scratch-missing");
    const canvas = $("scratch-canvas");
    const caption = $("scratch-caption");
    const photoCap = $("scratch-photo-caption");
    const reveal = $("reveal-all");
    const cta = $("memories-cta");
    const nameEl = $("memories-name");
    if (!stage || !person) return;

    destroyScratch();

    const memCopy = copy().memories || {};
    const board = person.scratchboard || {};

    /* Hippocampus line only — ZH optional via headline_zh */
    setBilingual(
      "memories-headline",
      "memories-headline-zh",
      board.headline_en || memCopy.headline_en,
      board.headline_zh || memCopy.headline_zh
    );

    const forLabel = $("memories-for-label");
    if (forLabel) forLabel.textContent = memCopy.forLabel || "for";
    if (nameEl) nameEl.textContent = person.name || "you";

    if (caption) {
      caption.textContent =
        memCopy.scratchCaption || "Scratch the board to reveal memories";
    }
    if (reveal) reveal.textContent = memCopy.revealAll || "Reveal all";
    if ($("memories-continue")) {
      $("memories-continue").textContent = memCopy.cta || "Open the letter";
    }

    /* Optional board caption — supports caption_en / caption_zh later without code change */
    setOptionalCaption(photoCap, board.caption_en, board.caption_zh);

    stage.style.setProperty("--stage-aspect", board.aspect || "4 / 5");
    stage.style.backgroundColor = board.background || "#222B24";
    stage.classList.remove("is-revealed", "prefers-reduced", "is-missing");
    if (canvas) {
      canvas.style.opacity = "1";
      canvas.style.pointerEvents = "auto";
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.classList.remove("is-fading");
    }
    if (caption) {
      caption.hidden = false;
      caption.classList.remove("is-hidden");
    }
    if (cta) {
      cta.hidden = true;
      cta.classList.remove("is-visible");
    }
    if (reveal) reveal.hidden = false;

    const base = board.image;
    const hasBoard = typeof base === "string" && base.length > 0;

    if (!hasBoard) {
      stage.classList.add("is-missing");
      if (picture) picture.hidden = true;
      if (missing) {
        missing.hidden = false;
        missing.textContent =
          memCopy.missingBoard ||
          "Memories for this letter aren’t on the board yet — the words are still yours to open.";
      }
      if (canvas) {
        canvas.style.opacity = "0";
        canvas.style.pointerEvents = "none";
      }
      if (caption) {
        caption.classList.add("is-hidden");
        caption.hidden = true;
      }
      if (reveal) reveal.hidden = true;
      showMemoriesCta();
      return;
    }

    if (missing) missing.hidden = true;
    if (picture) picture.hidden = false;
    if (webp) webp.srcset = bust(`${base}.webp`);
    if (img) {
      img.src = bust(`${base}.jpg`);
      img.alt = board.alt || `Memories for ${person.name || "you"}`;
    }

    if (!window.ScratchBoard || !canvas) {
      showMemoriesCta();
      return;
    }

    state.scratch = window.ScratchBoard.create({
      mount: stage,
      canvas,
      caption,
      cta,
      revealLink: reveal,
      threshold: 0.55,
      logicalW: 900,
      logicalH: 1125,
    });

    /* Ensure cover paints after layout (view may have just become visible) */
    requestAnimationFrame(() => {
      state.scratch && state.scratch.sync && state.scratch.sync();
      requestAnimationFrame(() => {
        state.scratch && state.scratch.sync && state.scratch.sync();
      });
    });
  }

  function openMemories(person) {
    showView("memories");
    /* Size canvas only after the view is laid out */
    requestAnimationFrame(() => buildMemories(person));
  }

  /* ---------- Letter ---------- */
  function buildLetter(person) {
    if (!person) return;
    const letter = person.letter || {};
    const panel = person.panel || {};

    $("letter-title").textContent = person.title || "A letter";
    $("letter-opener").textContent = letter.opener || "";
    $("letter-signoff").textContent = letter.signoff || "With love,";
    $("letter-signname").textContent = letter.signName || "Lorina";

    const body = $("letter-body");
    body.innerHTML = "";
    (letter.paragraphs || []).forEach((text) => {
      const p = document.createElement("p");
      p.textContent = text;
      body.appendChild(p);
    });

    const img = $("panel-img");
    const key = state.personKey;
    if (img && panel.image) {
      const src = panel.image.includes("/")
        ? panel.image
        : `assets/img/${key}/${panel.image}`;
      img.src = bust(src);
      img.alt = panel.caption || person.name || "";
    }
    $("panel-cap").textContent = panel.caption || "";
    $("panel-quote").textContent = panel.quote || "";

    const sw = $("panel-swatches");
    sw.innerHTML = "";
    (panel.swatches || ["blush", "rose", "lemon"]).forEach((name) => {
      const i = document.createElement("i");
      i.className = `sw sw-${name}`;
      sw.appendChild(i);
    });

    setupMusic(person);
  }

  /* ---------- Music ---------- */
  function setupMusic(person) {
    const audio = $("bg-music");
    const btn = $("music-btn");
    const label = $("music-label");
    if (!audio || !btn || !person || !person.song) return;

    const song = person.song;
    const playLabel = song.playLabel || "Play memory soundtrack";
    const pauseLabel = song.pauseLabel || "Pause soundtrack";

    audio.pause();
    audio.removeAttribute("src");
    audio.src = bust(song.file);
    audio.load();
    state.musicReady = true;

    btn.classList.remove("is-playing");
    btn.setAttribute("aria-pressed", "false");
    btn.setAttribute("aria-label", playLabel);
    label.textContent = playLabel;

    btn.onclick = async () => {
      if (!state.musicReady) return;
      if (audio.paused) {
        try {
          await audio.play();
          btn.classList.add("is-playing");
          btn.setAttribute("aria-pressed", "true");
          btn.setAttribute("aria-label", pauseLabel);
          label.textContent = pauseLabel;
        } catch (e) {
          console.warn("audio play failed", e);
        }
      } else {
        audio.pause();
        btn.classList.remove("is-playing");
        btn.setAttribute("aria-pressed", "false");
        btn.setAttribute("aria-label", playLabel);
        label.textContent = playLabel;
      }
    };
  }

  function stopMusic() {
    const audio = $("bg-music");
    const btn = $("music-btn");
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    if (btn) {
      btn.classList.remove("is-playing");
      btn.setAttribute("aria-pressed", "false");
    }
  }

  /* ---------- Page 2 open-letter fade-in (stage already reserved; no CLS) ---------- */
  function wireOpenLetter() {
    const view = $("view-passkey");
    const img = $("open-letter-img");
    if (!view || !img) return;

    const markReady = () => view.classList.add("is-icon-ready");

    if (img.complete && img.naturalWidth > 0) {
      markReady();
      return;
    }
    img.addEventListener("load", markReady, { once: true });
    img.addEventListener("error", markReady, { once: true });
  }

  /* ---------- Passkey field helpers ---------- */
  function clearPasskeyFields() {
    const name = $("input-name");
    const pass = $("input-passkey");
    const toggle = $("passkey-toggle");
    if (name) name.value = "";
    if (pass) {
      pass.value = "";
      pass.type = "password";
    }
    if (toggle) {
      toggle.classList.remove("is-revealed");
      toggle.setAttribute("aria-pressed", "false");
      toggle.setAttribute("aria-label", "Show passkey");
      toggle.title = "Show passkey";
    }
  }

  function wirePasskeyToggle() {
    const input = $("input-passkey");
    const btn = $("passkey-toggle");
    if (!input || !btn || btn.dataset.wired === "1") return;
    btn.dataset.wired = "1";

    btn.addEventListener("click", () => {
      const revealing = input.type === "password";
      const start = input.selectionStart;
      const end = input.selectionEnd;
      input.type = revealing ? "text" : "password";
      btn.classList.toggle("is-revealed", revealing);
      btn.setAttribute("aria-pressed", revealing ? "true" : "false");
      btn.setAttribute("aria-label", revealing ? "Hide passkey" : "Show passkey");
      btn.title = revealing ? "Hide passkey" : "Show passkey";
      try {
        if (typeof start === "number" && typeof end === "number") {
          input.setSelectionRange(start, end);
        }
      } catch (_) {
        /* some browsers block selection on type switch */
      }
      input.focus();
    });
  }

  /* ---------- Wire forms / nav ---------- */
  function wirePasskey() {
    const form = $("passkey-form");
    const back = $("passkey-back");
    const err = $("form-error");
    if (!form) return;

    clearPasskeyFields();
    wirePasskeyToggle();

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!state.data) await loadData();
      const name = $("input-name").value;
      const pass = $("input-passkey").value;
      const found = findPerson(name, pass);
      if (!found) {
        form.classList.remove("is-shake");
        void form.offsetWidth;
        form.classList.add("is-shake");
        if (err) {
          err.hidden = false;
          err.textContent =
            (copy().passkey && copy().passkey.error) ||
            "That name and passkey don’t match. Try again?";
        }
        return;
      }
      if (err) {
        err.hidden = true;
        err.textContent = "";
      }
      state.personKey = found.key;
      state.person = found.person;
      openMemories(found.person);
    });

    if (back) {
      back.addEventListener("click", () => {
        showView("seal");
      });
    }
  }

  function wireNav() {
    $("memories-continue")?.addEventListener("click", () => {
      if (!state.person) return;
      buildLetter(state.person);
      showView("letter");
    });

    $("letter-another")?.addEventListener("click", () => {
      stopMusic();
      state.personKey = null;
      state.person = null;
      destroyScratch();
      showView("passkey");
    });
  }

  function wireSeal() {
    const heart = $("heart-btn");
    if (!heart) return;
    // Prefer app.js handler; inline script defers to Lorina.openSeal when present
    heart.addEventListener("click", (e) => {
      e.preventDefault();
      openSeal();
    });
  }

  /** Deep-link from Page 3 experiments: ?person=adi&view=letter */
  async function handleDeepLink() {
    const params = new URLSearchParams(window.location.search);
    const personKey = norm(params.get("person"));
    const view = norm(params.get("view"));
    if (!personKey || !view) return false;
    if (!state.data) await loadData();
    const person = state.data?.people?.[personKey];
    if (!person) return false;
    state.personKey = personKey;
    state.person = person;
    if (view === "letter") {
      buildLetter(person);
      showView("letter");
      return true;
    }
    if (view === "memories") {
      openMemories(person);
      return true;
    }
    return false;
  }

  async function init() {
    if (!state.wired) {
      state.wired = true;
      wireSeal();
      wireOpenLetter();
      wirePasskey();
      wireNav();
    }

    if (state.data?.openingLine) {
      const line = $("opening-line");
      if (line) line.textContent = state.data.openingLine;
    }

    await loadData();
    applySharedCopy();
    await handleDeepLink();
  }

  window.Lorina = {
    init,
    openSeal,
    showView,
    clearPasskeyFields,
    state,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
