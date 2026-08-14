/* Letters from Lorina — view switching & interactions (vanilla JS) */
(function () {
  "use strict";

  const CACHE = "20260812c";
  const DATA_URL = `data/letters.json?v=${CACHE}`;
  /** Set to your Supabase project URL and anon key (public; safe in front-end). */
  const SUPABASE_URL = "https://ytcpqzxcwmvasnswenys.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_jJu3rG1Wf_M3-H0PKyco0w_Ps8GUhqC";
  const LOCKED_MSG =
    "Your letter isn't ready yet — but it will be waiting for you when the time comes.";
  const UNAVAILABLE_MSG =
    "The letter box is having a quiet moment — please try again in a little while.";
  const SHARED_SONG = {
    file: "assets/audio/Tides_in_the_Parlor.mp3",
    playLabel: "Play memory soundtrack",
    pauseLabel: "Pause soundtrack",
  };
  const MUSIC_MAX_LOOPS = 100;
  const LETTER_IDLE_MS = 60000;

  const state = {
    data: null,
    personKey: null,
    person: null,
    opening: false,
    musicReady: false,
    musicLoops: 0,
    musicEndedHandler: null,
    wired: false,
    scratch: null,
    letterIdleTimer: null,
    letterWaveClear: null,
    letterIdleWired: false,
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
    /* Tear down Page 3 scratch immediately when leaving memories.
       A live window.resize → getBoundingClientRect path interrupts iOS
       momentum scrolling on Page 4 (address-bar collapse fires resize). */
    if (name !== "memories") destroyScratch();
    if (name === "letter") startLetterIdleWave();
    else stopLetterIdleWave();
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

  function supabaseConfigured() {
    return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
  }

  async function fetchLetterFromApi(name, passkey) {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/get-letter`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ name, passkey }),
    });
    let data = null;
    try {
      data = await res.json();
    } catch (_) {
      /* non-JSON body */
    }
    return { status: res.status, data };
  }

  function mergeApiSettings(settings) {
    if (!settings || typeof settings !== "object") return;
    state.data = state.data || { people: {}, copy: {} };
    if (settings.meta && typeof settings.meta === "object") {
      Object.assign(state.data, settings.meta);
    }
    if (settings.copy) {
      state.data.copy = { ...(state.data.copy || {}), ...settings.copy };
    }
    if (settings.soundtrack) {
      state.data.soundtrack = settings.soundtrack;
    }
    applySharedCopy();
  }

  function mediaSignedUrl(media, opts) {
    const items = Array.isArray(media) ? media : [];
    if (opts.mediaKey) {
      const hit = items.find((m) => m.media_key === opts.mediaKey);
      return hit?.signed_url || null;
    }
    const hit = items.find((m) => m.metadata?.role === opts.role);
    return hit?.signed_url || null;
  }

  function personFromApi(payload) {
    const { friend, letter, media } = payload;
    const scratchMeta = (letter && letter.scratchboard) || {};
    const webpUrl = mediaSignedUrl(media, { mediaKey: "board-webp" });
    const jpgUrl = mediaSignedUrl(media, { mediaKey: "board-jpg" });
    const songUrl = mediaSignedUrl(media, { mediaKey: "song" });

    if (songUrl) {
      state.data = state.data || {};
      state.data.soundtrack = {
        ...(state.data.soundtrack || SHARED_SONG),
        file: songUrl,
      };
    }

    return {
      key: friend.username,
      person: {
        name: friend.display_name,
        title: letter.title,
        greeting: letter.greeting,
        seal: friend.seal,
        letter: {
          opener: letter.opener,
          paragraphs: letter.paragraphs,
          signoff: letter.signoff,
          signName: letter.sign_name,
        },
        scratchboard: {
          ...scratchMeta,
          imageWebp: webpUrl,
          imageJpg: jpgUrl || webpUrl,
          image: scratchMeta.image || null,
        },
      },
    };
  }

  function lockedMessage(unlockDate) {
    let msg = LOCKED_MSG;
    if (!unlockDate) return msg;
    const d = new Date(unlockDate);
    if (!Number.isNaN(d.getTime())) {
      msg += ` Check back after ${d.toLocaleDateString(undefined, { dateStyle: "long" })}.`;
    }
    return msg;
  }

  function showPasskeyError(form, errEl, message, { shake = true, locked = false } = {}) {
    if (form) {
      form.classList.remove("is-shake");
      if (shake) {
        void form.offsetWidth;
        form.classList.add("is-shake");
      }
    }
    if (errEl) {
      errEl.hidden = false;
      errEl.textContent = message;
      errEl.classList.toggle("is-locked", locked);
    }
  }

  function clearPasskeyError(errEl) {
    if (!errEl) return;
    errEl.hidden = true;
    errEl.textContent = "";
    errEl.classList.remove("is-locked");
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

    if (c.letter && c.letter.another && $("letter-another")) {
      $("letter-another").textContent = c.letter.another;
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
    const webpUrl = board.imageWebp;
    const jpgUrl = board.imageJpg;
    const hasBoard =
      (typeof webpUrl === "string" && webpUrl.length > 0) ||
      (typeof jpgUrl === "string" && jpgUrl.length > 0) ||
      (typeof base === "string" && base.length > 0);

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
    if (webpUrl || jpgUrl) {
      if (webp) webp.srcset = webpUrl || "";
      if (img) {
        img.src = jpgUrl || webpUrl || "";
        img.alt = board.alt || `Memories for ${person.name || "you"}`;
      }
    } else {
      if (webp) webp.srcset = bust(`${base}.webp`);
      if (img) {
        img.src = bust(`${base}.jpg`);
        img.alt = board.alt || `Memories for ${person.name || "you"}`;
      }
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
  function letterParagraphs(letter) {
    const paras = Array.isArray(letter.paragraphs) ? letter.paragraphs.slice() : [];
    const opener = (letter.opener || "").trim();
    if (opener && (!paras.length || paras[0] !== opener)) {
      paras.unshift(opener);
    }
    return paras;
  }

  function buildLetter(person) {
    if (!person) return;
    const letter = person.letter || {};

    $("letter-title").textContent = person.title || "A letter";
    $("letter-signoff").textContent = letter.signoff || "With love,";
    $("letter-signname").textContent = letter.signName || "Lorina";

    const body = $("letter-body");
    body.innerHTML = "";
    letterParagraphs(letter).forEach((text) => {
      const p = document.createElement("p");
      p.textContent = text;
      body.appendChild(p);
    });

    setupMusic();
  }

  /* ---------- Music (one shared track, capped replay) ---------- */
  function musicCopy() {
    const song = (state.data && state.data.soundtrack) || SHARED_SONG;
    return {
      file: song.file || SHARED_SONG.file,
      playLabel: song.playLabel || SHARED_SONG.playLabel,
      pauseLabel: song.pauseLabel || SHARED_SONG.pauseLabel,
    };
  }

  function setMusicUi(playing) {
    const btn = $("music-btn");
    const label = $("music-label");
    if (!btn) return;
    const { playLabel, pauseLabel } = musicCopy();
    btn.classList.toggle("is-playing", playing);
    btn.setAttribute("aria-pressed", playing ? "true" : "false");
    btn.setAttribute("aria-label", playing ? pauseLabel : playLabel);
    if (label) label.textContent = playing ? pauseLabel : playLabel;
  }

  function setupMusic() {
    const audio = $("bg-music");
    const btn = $("music-btn");
    if (!audio || !btn) return;

    const { file, playLabel } = musicCopy();

    if (state.musicEndedHandler) {
      audio.removeEventListener("ended", state.musicEndedHandler);
      state.musicEndedHandler = null;
    }

    audio.pause();
    audio.loop = false;
    audio.removeAttribute("src");
    audio.src = bust(file);
    audio.load();
    state.musicReady = true;
    state.musicLoops = 0;
    setMusicUi(false);

    state.musicEndedHandler = () => {
      state.musicLoops += 1;
      if (state.musicLoops >= MUSIC_MAX_LOOPS) {
        audio.pause();
        audio.currentTime = 0;
        setMusicUi(false);
        return;
      }
      audio.currentTime = 0;
      audio.play().catch((e) => console.warn("audio replay failed", e));
    };
    audio.addEventListener("ended", state.musicEndedHandler);

    btn.onclick = async () => {
      if (!state.musicReady) return;
      if (audio.paused) {
        /* Manual restart (from start / after end) resets the loop counter */
        if (audio.ended || audio.currentTime === 0) {
          state.musicLoops = 0;
        }
        try {
          await audio.play();
          setMusicUi(true);
        } catch (e) {
          console.warn("audio play failed", e);
        }
      } else {
        audio.pause();
        setMusicUi(false);
      }
    };

    /* Ensure paused label is correct even if copy loads later */
    if (!btn.classList.contains("is-playing")) {
      btn.setAttribute("aria-label", playLabel);
      const label = $("music-label");
      if (label) label.textContent = playLabel;
    }
  }

  function stopMusic() {
    const audio = $("bg-music");
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    state.musicLoops = 0;
    setMusicUi(false);
  }

  /* ---------- Page 4 idle reading-focus wave ---------- */
  function clearLetterWaveClass() {
    const view = $("view-letter");
    if (view) view.classList.remove("is-text-waving");
    if (state.letterWaveClear) {
      clearTimeout(state.letterWaveClear);
      state.letterWaveClear = null;
    }
  }

  function pokeLetterIdle() {
    if (!$("view-letter")?.classList.contains("is-active")) return;
    if (reduceMotion()) return;
    if (document.hidden) return;
    if (state.letterIdleTimer) clearTimeout(state.letterIdleTimer);
    state.letterIdleTimer = setTimeout(fireLetterWave, LETTER_IDLE_MS);
  }

  function fireLetterWave() {
    const view = $("view-letter");
    if (!view || !view.classList.contains("is-active") || document.hidden || reduceMotion()) {
      pokeLetterIdle();
      return;
    }
    clearLetterWaveClass();
    /* Avoid synchronous layout (offsetWidth) — it can kill mobile momentum scroll */
    requestAnimationFrame(() => {
      if (!view.classList.contains("is-active") || document.hidden) {
        pokeLetterIdle();
        return;
      }
      view.classList.add("is-text-waving");
      state.letterWaveClear = setTimeout(() => {
        view.classList.remove("is-text-waving");
        state.letterWaveClear = null;
        pokeLetterIdle();
      }, 1200);
    });
  }

  function startLetterIdleWave() {
    wireLetterIdleOnce();
    clearLetterWaveClass();
    pokeLetterIdle();
  }

  function stopLetterIdleWave() {
    if (state.letterIdleTimer) {
      clearTimeout(state.letterIdleTimer);
      state.letterIdleTimer = null;
    }
    clearLetterWaveClass();
  }

  function wireLetterIdleOnce() {
    if (state.letterIdleWired) return;
    state.letterIdleWired = true;
    const reset = () => pokeLetterIdle();
    window.addEventListener("scroll", reset, { passive: true });
    window.addEventListener("pointerdown", reset, { passive: true });
    window.addEventListener("keydown", reset);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        if (state.letterIdleTimer) {
          clearTimeout(state.letterIdleTimer);
          state.letterIdleTimer = null;
        }
        clearLetterWaveClass();
      } else if ($("view-letter")?.classList.contains("is-active")) {
        pokeLetterIdle();
      }
    });
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
      const name = $("input-name").value;
      const pass = $("input-passkey").value;

      if (!supabaseConfigured()) {
        showPasskeyError(form, err, UNAVAILABLE_MSG, { shake: false });
        return;
      }

      try {
        const { status, data } = await fetchLetterFromApi(name, pass);

        if (data?.ok === true) {
          mergeApiSettings(data.settings);
          const mapped = personFromApi(data);
          clearPasskeyError(err);
          state.personKey = mapped.key;
          state.person = mapped.person;
          openMemories(mapped.person);
          return;
        }

        if (data?.ok === false && data.reason === "locked") {
          showPasskeyError(form, err, lockedMessage(data.unlock_date), {
            shake: false,
            locked: true,
          });
          return;
        }

        if (status === 401 || (data?.ok === false && data.error)) {
          showPasskeyError(
            form,
            err,
            (copy().passkey && copy().passkey.error) ||
              "That name and passkey don’t match. Try again?"
          );
          return;
        }

        if (data?.error) {
          showPasskeyError(form, err, data.error, { shake: false });
          return;
        }

        showPasskeyError(form, err, UNAVAILABLE_MSG, { shake: false });
      } catch (apiErr) {
        console.warn("get-letter failed", apiErr);
        showPasskeyError(form, err, UNAVAILABLE_MSG, { shake: false });
      }
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
      destroyScratch();
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
