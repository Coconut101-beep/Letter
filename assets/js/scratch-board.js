/* Shared scratch-to-reveal board — canvas destination-out masking */
(function (global) {
  "use strict";

  const DEFAULTS = {
    threshold: 0.55,
    sampleEveryMs: 180,
    pointerThrottleMs: 28,
    brushRadius: 28,
    logicalW: 900,
    logicalH: 1125,
  };

  function reduceMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function paintCover(ctx, w, h) {
    /* Fully opaque base first — never leave transparent holes for sampling */
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "#3A463C");
    g.addColorStop(0.45, "#2A342C");
    g.addColorStop(1, "#1A211C");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    const r = ctx.createRadialGradient(w * 0.3, h * 0.25, 0, w * 0.3, h * 0.25, w * 0.55);
    r.addColorStop(0, "rgba(233, 167, 180, 0.28)");
    r.addColorStop(1, "rgba(233, 167, 180, 0)");
    ctx.fillStyle = r;
    ctx.fillRect(0, 0, w, h);

    const r2 = ctx.createRadialGradient(w * 0.75, h * 0.7, 0, w * 0.75, h * 0.7, w * 0.5);
    r2.addColorStop(0, "rgba(242, 208, 107, 0.16)");
    r2.addColorStop(1, "rgba(242, 208, 107, 0)");
    ctx.fillStyle = r2;
    ctx.fillRect(0, 0, w, h);

    for (let i = 0; i < 1400; i++) {
      const x = (i * 97) % w;
      const y = (i * 53 + (i % 17) * 11) % h;
      const a = 0.04 + ((i * 13) % 10) / 120;
      ctx.fillStyle = i % 5 === 0 ? `rgba(251,239,217,${a})` : `rgba(58,50,43,${a * 0.8})`;
      ctx.fillRect(x, y, 1 + (i % 2), 1 + (i % 3));
    }

    ctx.globalAlpha = 0.08;
    ctx.strokeStyle = "#FBEFD9";
    ctx.lineWidth = 1;
    for (let y = 0; y < h; y += 6) {
      ctx.beginPath();
      ctx.moveTo(0, y + ((y * 3) % 3));
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    const v = ctx.createRadialGradient(w / 2, h / 2, w * 0.35, w / 2, h / 2, w * 0.72);
    v.addColorStop(0, "rgba(26, 33, 28, 0)");
    v.addColorStop(1, "rgba(26, 33, 28, 0.45)");
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  function createScratchBoard(opts) {
    const cfg = Object.assign({}, DEFAULTS, opts || {});
    const canvas = cfg.canvas;
    const mount = cfg.mount;
    if (!canvas || !mount) throw new Error("scratch-board: mount + canvas required");

    const display = canvas.getContext("2d", { alpha: true });
    const mask = document.createElement("canvas");
    mask.width = cfg.logicalW;
    mask.height = cfg.logicalH;
    const maskCtx = mask.getContext("2d", { willReadFrequently: true });
    paintCover(maskCtx, mask.width, mask.height);

    let scratching = false;
    let hasScratched = false;
    let lastPt = null;
    let lastPointerAt = 0;
    let sampleTimer = null;
    let revealed = false;
    let dpr = 1;
    let cssW = 0;
    let cssH = 0;
    let destroyed = false;

    function blit() {
      if (!cssW || !cssH) return;
      display.setTransform(dpr, 0, 0, dpr, 0, 0);
      display.clearRect(0, 0, cssW, cssH);
      display.imageSmoothingEnabled = true;
      display.drawImage(mask, 0, 0, cssW, cssH);
    }

    function syncDisplaySize() {
      if (destroyed || revealed) return;
      const rect = mount.getBoundingClientRect();
      const nextW = Math.round(rect.width);
      const nextH = Math.round(rect.height);
      /* View may still be hidden — wait for a real box before sizing */
      if (nextW < 8 || nextH < 8) return;

      cssW = nextW;
      cssH = nextH;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const bw = Math.round(cssW * dpr);
      const bh = Math.round(cssH * dpr);
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw;
        canvas.height = bh;
      }
      /* Fill the stage via CSS inset/100% — do not pin to 1px inline sizes */
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.style.opacity = "1";
      canvas.style.pointerEvents = "auto";
      blit();
    }

    function toLogical(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return { x: 0, y: 0 };
      return {
        x: ((clientX - rect.left) / rect.width) * mask.width,
        y: ((clientY - rect.top) / rect.height) * mask.height,
      };
    }

    function softBrush(x, y) {
      const r = cfg.brushRadius;
      const g = maskCtx.createRadialGradient(x, y, r * 0.15, x, y, r);
      g.addColorStop(0, "rgba(0,0,0,0.95)");
      g.addColorStop(0.45, "rgba(0,0,0,0.55)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      maskCtx.globalCompositeOperation = "destination-out";
      maskCtx.fillStyle = g;
      maskCtx.beginPath();
      maskCtx.arc(x, y, r, 0, Math.PI * 2);
      maskCtx.fill();
      maskCtx.globalCompositeOperation = "source-over";
    }

    function strokeTo(x, y) {
      hasScratched = true;
      if (!lastPt) {
        softBrush(x, y);
        lastPt = { x, y };
        blit();
        return;
      }
      const dx = x - lastPt.x;
      const dy = y - lastPt.y;
      const dist = Math.hypot(dx, dy);
      const step = Math.max(4, cfg.brushRadius * 0.35);
      const n = Math.max(1, Math.ceil(dist / step));
      for (let i = 1; i <= n; i++) {
        softBrush(lastPt.x + (dx * i) / n, lastPt.y + (dy * i) / n);
      }
      lastPt = { x, y };
      blit();
    }

    function sampleCleared() {
      if (revealed) return 1;
      if (!hasScratched) return 0;
      const data = maskCtx.getImageData(0, 0, mask.width, mask.height).data;
      let cleared = 0;
      let total = 0;
      for (let i = 3; i < data.length; i += 32) {
        total++;
        if (data[i] < 40) cleared++;
      }
      return total ? cleared / total : 0;
    }

    function finishReveal() {
      if (revealed) return;
      revealed = true;
      scratching = false;
      if (sampleTimer) {
        clearInterval(sampleTimer);
        sampleTimer = null;
      }
      canvas.classList.add("is-fading");
      mount.classList.add("is-revealed");
      if (cfg.caption) cfg.caption.classList.add("is-hidden");
      const fadeMs = reduceMotion() ? 120 : 700;
      setTimeout(() => {
        if (destroyed) return;
        canvas.style.opacity = "0";
        canvas.style.pointerEvents = "none";
        if (cfg.cta) {
          cfg.cta.hidden = false;
          requestAnimationFrame(() => cfg.cta.classList.add("is-visible"));
        }
        if (typeof cfg.onRevealed === "function") cfg.onRevealed();
      }, fadeMs);
    }

    function checkProgress() {
      /* Never auto-reveal before the reader has made a stroke */
      if (!hasScratched || revealed) return;
      if (sampleCleared() >= cfg.threshold) finishReveal();
    }

    function startSampling() {
      if (sampleTimer || revealed) return;
      sampleTimer = setInterval(checkProgress, cfg.sampleEveryMs);
    }

    function onPointerDown(e) {
      if (revealed || destroyed) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (!cssW || !cssH) syncDisplaySize();
      scratching = true;
      lastPt = null;
      try {
        canvas.setPointerCapture?.(e.pointerId);
      } catch (_) {}
      const p = toLogical(e.clientX, e.clientY);
      strokeTo(p.x, p.y);
      startSampling();
      e.preventDefault();
    }

    function onPointerMove(e) {
      if (!scratching || revealed || destroyed) return;
      const now = performance.now();
      if (now - lastPointerAt < cfg.pointerThrottleMs) return;
      lastPointerAt = now;
      const p = toLogical(e.clientX, e.clientY);
      strokeTo(p.x, p.y);
      e.preventDefault();
    }

    function onPointerUp(e) {
      if (!scratching) return;
      scratching = false;
      lastPt = null;
      try {
        canvas.releasePointerCapture?.(e.pointerId);
      } catch (_) {}
      checkProgress();
    }

    function onTouchMove(e) {
      if (scratching || e.target === canvas) e.preventDefault();
    }

    function revealAll(e) {
      if (e) e.preventDefault();
      if (revealed || destroyed) return;
      hasScratched = true;
      maskCtx.globalCompositeOperation = "destination-out";
      maskCtx.fillStyle = "#000";
      maskCtx.fillRect(0, 0, mask.width, mask.height);
      maskCtx.globalCompositeOperation = "source-over";
      blit();
      finishReveal();
    }

    function onRevealKey(e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        revealAll(e);
      }
    }

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("lostpointercapture", onPointerUp);
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });

    if (cfg.revealLink) {
      cfg.revealLink.addEventListener("click", revealAll);
      cfg.revealLink.addEventListener("keydown", onRevealKey);
    }

    if (reduceMotion()) {
      mount.classList.add("prefers-reduced");
      if (cfg.revealLink) cfg.revealLink.classList.add("is-emphasized");
    }

    let resizeRaf = 0;
    const onResize = () => {
      cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(syncDisplaySize);
    };
    window.addEventListener("resize", onResize);

    let ro = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => onResize());
      ro.observe(mount);
    }

    /* Size now if visible; otherwise ResizeObserver / later sync will paint */
    syncDisplaySize();
    requestAnimationFrame(() => {
      syncDisplaySize();
      requestAnimationFrame(syncDisplaySize);
    });

    return {
      revealAll,
      sync: syncDisplaySize,
      destroy() {
        destroyed = true;
        window.removeEventListener("resize", onResize);
        if (ro) ro.disconnect();
        if (sampleTimer) clearInterval(sampleTimer);
        canvas.removeEventListener("pointerdown", onPointerDown);
        canvas.removeEventListener("pointermove", onPointerMove);
        canvas.removeEventListener("pointerup", onPointerUp);
        canvas.removeEventListener("pointercancel", onPointerUp);
        canvas.removeEventListener("lostpointercapture", onPointerUp);
        canvas.removeEventListener("touchmove", onTouchMove);
        if (cfg.revealLink) {
          cfg.revealLink.removeEventListener("click", revealAll);
          cfg.revealLink.removeEventListener("keydown", onRevealKey);
        }
      },
      getClearedPercent: sampleCleared,
    };
  }

  global.ScratchBoard = { create: createScratchBoard };
})(window);
