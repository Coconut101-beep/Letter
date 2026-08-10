/* Letters from Lorina — view switching & interactions (vanilla JS) */
(function () {
  "use strict";

  const CACHE = "20260811c";
  const DATA_URL = `data/letters.json?v=${CACHE}`;

  const state = {
    data: null,
    personKey: null,
    person: null,
    opening: false,
    musicReady: false,
  };

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

  /* ---------- Memories collage ---------- */
  function mediaEl(src, alt, kind) {
    const url = bust(src);
    if (kind === "video" || /\.(mp4|webm|mov)(\?|$)/i.test(src)) {
      const v = document.createElement("video");
      v.src = url;
      v.muted = true;
      v.playsInline = true;
      v.loop = true;
      v.autoplay = true;
      v.setAttribute("playsinline", "");
      v.setAttribute("muted", "");
      v.preload = "metadata";
      v.setAttribute("aria-label", alt || "Memory clip");
      v.addEventListener("loadeddata", () => {
        v.play().catch(() => {});
      });
      return v;
    }
    const img = document.createElement("img");
    img.src = url;
    img.alt = alt || "";
    img.loading = "lazy";
    img.decoding = "async";
    return img;
  }

  function buildMemories(person) {
    const board = $("collage-board");
    const headline = $("memories-headline");
    const sub = $("memories-sub");
    const nameEl = $("memories-name");
    if (!board || !person) return;

    const mem = person.memories || { items: [] };
    if (headline) headline.textContent = mem.headline || "kept close";
    if (sub) sub.textContent = mem.sub || "";
    if (nameEl) nameEl.textContent = person.name || "you";
    if (mem.background) board.style.backgroundColor = mem.background;

    board.innerHTML = "";
    (mem.items || []).forEach((item) => {
      const wrap = document.createElement("div");
      wrap.className = "collage-item";
      wrap.dataset.kind = item.kind;
      wrap.style.setProperty("--x", `${item.x ?? 0}%`);
      wrap.style.setProperty("--y", `${item.y ?? 0}%`);
      wrap.style.setProperty("--w", `${item.w ?? 24}%`);
      wrap.style.setProperty("--r", `${item.rotate ?? 0}deg`);
      wrap.style.setProperty("--z", String(item.z ?? 1));

      if (item.kind === "photo" || item.kind === "video") {
        wrap.classList.add("polaroid");
        if (item.aspect) wrap.style.setProperty("--aspect", item.aspect);
        const media = document.createElement("div");
        media.className = "media";
        media.style.aspectRatio = item.aspect || "4/5";
        media.appendChild(mediaEl(item.src, item.alt || item.caption, item.kind));
        wrap.appendChild(media);
        if (item.caption) {
          const cap = document.createElement("p");
          cap.className = "cap hand";
          cap.textContent = item.caption;
          wrap.appendChild(cap);
        }
      } else if (item.kind === "filmstrip") {
        wrap.classList.add("filmstrip");
        (item.frames || []).forEach((src) => {
          const frame = document.createElement("div");
          frame.className = "frame";
          frame.appendChild(mediaEl(src, item.caption || "Film frame", "photo"));
          wrap.appendChild(frame);
        });
        if (item.caption) {
          const cap = document.createElement("p");
          cap.className = "cap";
          cap.textContent = item.caption;
          wrap.appendChild(cap);
        }
      } else if (item.kind === "ticket") {
        wrap.classList.add("ticket");
        if (item.color) wrap.classList.add(`color-${item.color}`);
        wrap.textContent = item.caption || "";
      } else if (item.kind === "sticker") {
        wrap.classList.add("sticker");
        wrap.textContent = item.caption || "";
      } else if (item.kind === "doodle") {
        const d = document.createElement("span");
        d.className = item.shape === "sparkle" ? "doodle-sparkle" : "doodle-star";
        d.setAttribute("aria-hidden", "true");
        wrap.appendChild(d);
      }

      board.appendChild(wrap);
    });
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

  /* ---------- Wire forms / nav ---------- */
  function wirePasskey() {
    const form = $("passkey-form");
    const back = $("passkey-back");
    const err = $("form-error");
    if (!form) return;

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
          err.textContent = "That name and passkey don’t match. Try again?";
        }
        return;
      }
      if (err) {
        err.hidden = true;
        err.textContent = "";
      }
      state.personKey = found.key;
      state.person = found.person;
      buildMemories(found.person);
      showView("memories");
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
      const board = $("collage-board");
      if (board) board.innerHTML = "";
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
    wireSeal();
    wirePasskey();
    wireNav();

    if (state.data?.openingLine) {
      const line = $("opening-line");
      if (line) line.textContent = state.data.openingLine;
    }

    await loadData();
    if (state.data?.openingLine) {
      const line = $("opening-line");
      if (line) line.textContent = state.data.openingLine;
    }
    if (state.data?.cacheBust) {
      // keep for future; CACHE constant already set
    }
  }

  window.Lorina = {
    init,
    openSeal,
    showView,
    state,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
