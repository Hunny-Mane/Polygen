/**
 * GENERATION (CHAPTER 2) — WHITE NEUMORPHIC SCROLLY
 * Prompt Ingredients: tokens -> latent mix -> resolve -> upscale -> CTA
 */

document.addEventListener('DOMContentLoaded', () => {
  if (typeof gsap === 'undefined') return;
  const hasScrollTrigger = typeof ScrollTrigger !== 'undefined';
  if (hasScrollTrigger) gsap.registerPlugin(ScrollTrigger);

  // Primary: Chapter 2 scrolly section on `index.html`
  // Fallback: standalone Generation page can provide a host via [data-gen-reveal-host]
  const section = document.querySelector('.generation-neumo-scrolly') || document.querySelector('[data-gen-reveal-host]');
  if (!section) return;

  // ────────────────────────────────────────────────────────────────────────────
  // Performance heuristics (blob capping / "safety switch")
  // ────────────────────────────────────────────────────────────────────────────
  const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isProbablyMobile = () => {
    const ua = navigator.userAgent || '';
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    return coarse || /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  };

  const getPerfTier = () => {
    // Heuristic: conservative. We only need to choose 4 vs 8 blobs.
    const cores = Number(navigator.hardwareConcurrency || 0);
    const mem = Number(navigator.deviceMemory || 0); // Chromium only; may be undefined
    if (prefersReducedMotion) return 'low';
    if (isProbablyMobile()) return 'low';
    if (cores && cores <= 4) return 'low';
    if (mem && mem <= 4) return 'low';
    return 'default';
  };

  const perfTier = getPerfTier();
  const blobCount = perfTier === 'low' ? 6 : 12;

  const pinWrapper = section.querySelector('.gen-pin-wrapper');
  const copy = section.querySelector('.gen-copy');
  const tray = section.querySelector('.token-tray');
  const field = section.querySelector('.token-field');
  const tokens = gsap.utils.toArray(section.querySelectorAll('.token-pill'));
  const mixIndicator = section.querySelector('.mix-indicator');
  const mixRing = section.querySelector('.mix-indicator .ring');
  const trayTitle = section.querySelector('[data-tray-title]');
  const typedPrompt = section.querySelector('[data-typed-prompt]');
  const typedTextEl = section.querySelector('[data-typed-text]');
  const synthPanel = section.querySelector('[data-synth-panel]');
  const synthMarquee = section.querySelector('[data-synth-marquee]');
  const synthRows = gsap.utils.toArray(section.querySelectorAll('.synth-row'));
  const frame = section.querySelector('.gen-frame');
  const soup = section.querySelector('.latent-soup');
  const preview = section.querySelector('.gen-preview');
  const cta = section.querySelector('.gen-footer-cta');
  const bookFront = section.querySelector('[data-gen-page-front]');
  const bookBack = section.querySelector('[data-gen-page-back]');

  // Promote key panels to their own GPU layers before we animate.
  if (copy) copy.style.willChange = 'transform, opacity';
  if (tray) tray.style.willChange = 'transform, opacity';
  if (frame) frame.style.willChange = 'transform, opacity';

  // ────────────────────────────────────────────────────────────────────────────
  // Background: single fullscreen Canvas reveal blobs
  // ────────────────────────────────────────────────────────────────────────────
  const revealCanvas = section.querySelector('[data-gen-reveal-canvas]') || document.querySelector('[data-gen-reveal-canvas]');
  const revealCtx = revealCanvas ? revealCanvas.getContext('2d', { alpha: true, desynchronized: true }) : null;
  let gradientCanvas = null;
  let gradientCtx = null;
  let dpr = 1;
  let w = 0;
  let h = 0;

  const blobs = Array.from({ length: blobCount }).map((_, i) => ({
    // Normalized centers; animated by GSAP for minimal overhead.
    x: Math.random(),
    y: Math.random(),
    r: 0.12 + Math.random() * 0.12,
    phase: Math.random() * Math.PI * 2,
    speed: 0.35 + Math.random() * 0.55,
    drift: (i % 2 ? 1 : -1) * (0.05 + Math.random() * 0.09),
  }));

  const resizeReveal = () => {
    if (!revealCanvas || !revealCtx) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    // If canvas is fixed (viewport-locked), always render at viewport size.
    const isFixed = window.getComputedStyle && window.getComputedStyle(revealCanvas).position === 'fixed';
    if (isFixed) {
      w = Math.max(1, Math.floor(window.innerWidth));
      h = Math.max(1, Math.floor(window.innerHeight));
    } else {
      const rect = section === document.body ? null : section.getBoundingClientRect();
      w = Math.max(1, Math.floor(rect ? rect.width : window.innerWidth));
      h = Math.max(1, Math.floor(rect ? rect.height : window.innerHeight));
    }
    revealCanvas.width = Math.floor(w * dpr);
    revealCanvas.height = Math.floor(h * dpr);
    revealCanvas.style.width = `${w}px`;
    revealCanvas.style.height = `${h}px`;
    revealCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    gradientCanvas = document.createElement('canvas');
    gradientCanvas.width = Math.floor(w * dpr);
    gradientCanvas.height = Math.floor(h * dpr);
    gradientCtx = gradientCanvas.getContext('2d', { alpha: true });
    gradientCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Pre-render colorful "map" gradient once per resize.
    const g = gradientCtx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0.0, 'rgba(99, 102, 241, 0.55)');
    g.addColorStop(0.35, 'rgba(0, 242, 255, 0.42)');
    g.addColorStop(0.7, 'rgba(245, 158, 11, 0.24)');
    g.addColorStop(1.0, 'rgba(17, 24, 39, 0.06)');
    gradientCtx.clearRect(0, 0, w, h);
    gradientCtx.fillStyle = g;
    gradientCtx.fillRect(0, 0, w, h);

    // Add subtle noisy texture (cheap) to avoid banding.
    gradientCtx.globalAlpha = 0.06;
    gradientCtx.fillStyle = '#000';
    for (let i = 0; i < 450; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const s = 1 + Math.random() * 2;
      gradientCtx.fillRect(x, y, s, s);
    }
    gradientCtx.globalAlpha = 1;
  };

  const drawReveal = (t) => {
    if (!revealCtx || !gradientCanvas) return;
    revealCtx.clearRect(0, 0, w, h);

    // 1) Draw blob mask.
    revealCtx.globalCompositeOperation = 'source-over';
    revealCtx.fillStyle = '#000';
    revealCtx.globalAlpha = 1;

    for (const b of blobs) {
      // Oscillate in normalized space; convert to pixels.
      // GSAP ticker passes time in seconds.
      const tt = (t * b.speed) + b.phase;
      const nx = (b.x + Math.cos(tt) * b.drift);
      const ny = (b.y + Math.sin(tt * 1.15) * b.drift);
      const cx = (nx - Math.floor(nx)) * w;
      const cy = (ny - Math.floor(ny)) * h;
      const r = (b.r * Math.min(w, h)) * (0.85 + 0.25 * Math.sin(tt * 0.8));

      const grd = revealCtx.createRadialGradient(cx, cy, r * 0.25, cx, cy, r);
      grd.addColorStop(0, 'rgba(0,0,0,1)');
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      revealCtx.fillStyle = grd;
      revealCtx.beginPath();
      revealCtx.arc(cx, cy, r, 0, Math.PI * 2);
      revealCtx.fill();
    }

    // 2) Composite: keep gradient only where mask exists.
    revealCtx.globalCompositeOperation = 'source-in';
    revealCtx.globalAlpha = 1;
    revealCtx.drawImage(gradientCanvas, 0, 0, w, h);

    // 3) Blend gently into the section.
    revealCtx.globalCompositeOperation = 'source-over';
    revealCtx.globalAlpha = 0.10;
    revealCtx.fillStyle = '#ffffff';
    revealCtx.fillRect(0, 0, w, h);
    revealCtx.globalAlpha = 1;
  };

  let revealRunning = false;
  const startReveal = () => {
    if (!revealCanvas || !revealCtx || prefersReducedMotion) return;
    if (revealRunning) return;
    revealRunning = true;
    resizeReveal();
    revealCanvas.style.opacity = '';
    gsap.ticker.add(drawReveal);
    gsap.ticker.lagSmoothing(1000, 16);
  };

  const stopReveal = () => {
    if (!revealCanvas) return;
    if (!revealRunning) {
      revealCanvas.style.opacity = '0';
      return;
    }
    revealRunning = false;
    gsap.ticker.remove(drawReveal);
    revealCanvas.style.opacity = '0';
  };

  if (revealCanvas) {
    // Default hidden; we enable it only for Chapter 2 (or always on standalone generation page).
    revealCanvas.style.opacity = '0';
    window.addEventListener('resize', () => {
      if (revealRunning) resizeReveal();
    }, { passive: true });
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Click Event: "Vacuum" implosion + SVG expansion reveal (transform-only)
  // ────────────────────────────────────────────────────────────────────────────
  const ctaLink = cta ? cta.querySelector('a') : null;
  const obsidianSvg = section.querySelector('[data-gen-obsidian-reveal]');
  const obsidianCircle = section.querySelector('[data-gen-obsidian-circle]');

  const getViewportRadius = (cx, cy) => {
    const dx = Math.max(cx, window.innerWidth - cx);
    const dy = Math.max(cy, window.innerHeight - cy);
    return Math.ceil(Math.hypot(dx, dy));
  };

  if (ctaLink && obsidianSvg && obsidianCircle) {
    let locked = false;
    ctaLink.addEventListener('click', (e) => {
      // Let the link work normally if GSAP is unavailable.
      if (locked) {
        e.preventDefault();
        return;
      }
      locked = true;
      e.preventDefault();

      const href = ctaLink.getAttribute('href') || 'generation.html';
      const r = ctaLink.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;

      // Start state: clip circle at CTA center.
      obsidianSvg.style.opacity = '1';
      obsidianCircle.setAttribute('cx', String(cx));
      obsidianCircle.setAttribute('cy', String(cy));
      obsidianCircle.setAttribute('r', '0');

      const vacuumTl = gsap.timeline({
        defaults: { duration: 0.35, ease: 'expo.in' },
        onComplete: () => {
          window.location.href = href;
        },
      });

      // Vacuum target transforms (no layout).
      const targets = [copy, tray, frame].filter(Boolean);
      vacuumTl.to(targets, {
        x: (i, el) => {
          const br = el.getBoundingClientRect();
          const ex = br.left + br.width / 2;
          return (cx - ex) * 0.45;
        },
        y: (i, el) => {
          const br = el.getBoundingClientRect();
          const ey = br.top + br.height / 2;
          return (cy - ey) * 0.45;
        },
        scale: 0.88,
        opacity: 0.12,
        force3D: true,
        stagger: 0.02,
      }, 0);

      // Fade the reveal canvas gently with the vacuum.
      if (revealCanvas) {
        vacuumTl.to(revealCanvas, { opacity: 0.0 }, 0);
      }

      // Expand the obsidian reveal circle.
      vacuumTl.to({}, {
        duration: 0.38,
        ease: 'power2.out',
        onUpdate: function () {
          const p = this.progress();
          const rr = getViewportRadius(cx, cy) * p;
          obsidianCircle.setAttribute('r', rr.toFixed(2));
        },
      }, 0.02);
    }, { passive: false });
  }

  // Utility: spaced scatter targets (no clustering).
  const scatterTargets = () => {
    if (!field) return tokens.map(() => ({ xPercent: 0, yPercent: 0 }));
    const rect = field.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);

    // Fixed "slots" in the field for readability (scaled by container size).
    // Order matters: matches the token order in DOM.
    const slots = [
      { x: -0.30, y: -0.24 },
      { x:  0.30, y: -0.24 },
      { x: -0.34, y:  0.10 },
      { x:  0.34, y:  0.10 },
      { x:  0.00, y: -0.02 },
      { x:  0.00, y:  0.28 },
    ];

    return tokens.map((_, i) => {
      const s = slots[i % slots.length];
      return {
        x: s.x * w,
        y: s.y * h,
      };
    });
  };

  // Standalone generation page (no ScrollTrigger): run reveal continuously.
  if (!hasScrollTrigger) {
    startReveal();
    return;
  }

  // Desktop-only pinning. Mobile fallback is handled by CSS (non-pinned layout).
  ScrollTrigger.matchMedia({
    '(min-width: 981px)': () => {
      // Reset visuals to a known state (important if ScrollTrigger refreshes).
      gsap.set([copy, tray], { opacity: 0 });
      gsap.set(copy, { x: -40 });
      gsap.set(tray, { x: 40 });
      gsap.set(frame, { opacity: 0, scale: 0.965 });
      gsap.set(cta, { opacity: 0, y: 12, pointerEvents: 'none' });
      if (mixIndicator) gsap.set(mixIndicator, { opacity: 0, y: 8 });
      if (mixRing) mixRing.classList.remove('is-green');
      if (trayTitle) trayTitle.textContent = 'Prompt Ingredients';
      if (typedPrompt) gsap.set(typedPrompt, { opacity: 1, y: 0 });
      if (typedTextEl) typedTextEl.textContent = '';
      if (synthPanel) gsap.set(synthPanel, { opacity: 0, y: 8, pointerEvents: 'none' });
      if (synthRows.length) gsap.set(synthRows, { x: 0 });
      if (preview) {
        preview.classList.remove('active');
        gsap.set(preview, { opacity: 0, filter: 'grayscale(0.8) blur(18px) contrast(1.05)', scale: 1.06 });
      }
      if (soup) {
        soup.classList.remove('active');
        gsap.set(soup, { opacity: 0 });
      }
      if (frame) frame.classList.remove('is-upscaled');
      if (bookFront) gsap.set(bookFront, { rotateY: 0, transformOrigin: '0% 50%' });
      if (bookBack) gsap.set(bookBack, { rotateY: 180, transformOrigin: '0% 50%' });

      // Token initial placement: stacked, slightly offset, invisible.
      tokens.forEach((t, i) => {
        gsap.set(t, {
          opacity: 0,
          x: (i - (tokens.length - 1) / 2) * 8,
          y: 40 + i * 6,
          rotate: (i % 2 ? 3 : -3),
          scale: 0.92,
          transformOrigin: '50% 50%',
        });
      });

      // Seamless marquee loop (starts after resolve, repeats indefinitely)
      let marqueeTweens = [];
      const startMarquee = () => {
        if (!synthMarquee || synthRows.length === 0) return;

        // Duplicate each row's content once for seamless looping.
        synthRows.forEach((row) => {
          if (row.dataset.duplicated === '1') return;
          row.insertAdjacentHTML('beforeend', row.innerHTML);
          row.dataset.duplicated = '1';
        });

        // Kill old tweens if any
        marqueeTweens.forEach(t => t.kill && t.kill());
        marqueeTweens = [];

        // Use xPercent so it stays robust across widths. Each row is now 200% content.
        const duration = 13; // medium speed default
        synthRows.forEach((row, idx) => {
          const tween = gsap.fromTo(
            row,
            { xPercent: 0 },
            {
              xPercent: -50,
              duration: duration + (idx * 1.8),
              ease: 'none',
              repeat: -1,
            }
          );
          marqueeTweens.push(tween);
        });
      };

      const stopMarquee = () => {
        marqueeTweens.forEach(t => t.kill && t.kill());
        marqueeTweens = [];
        if (synthRows.length) gsap.set(synthRows, { xPercent: 0, x: 0 });
      };

      const mainTl = gsap.timeline({
        defaults: { ease: 'power2.out' },
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: '+=260%',
          pin: pinWrapper,
          scrub: prefersReducedMotion ? true : 1.4,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onEnter: () => startReveal(),
          onEnterBack: () => startReveal(),
          onLeave: () => stopReveal(),
          onLeaveBack: () => stopReveal(),
          onUpdate: (self) => {
            const inner = section.querySelector('.gen-frame-inner');
            if (!inner) return;
            // Enable tilt only in final phase (CTA region).
            inner.classList.toggle('tilt-active', self.progress >= 0.82);
          },
        },
      });

      // Phase 0: Entrance
      mainTl
        .to(copy, { opacity: 1, x: 0, duration: 0.8 }, 0)
        .to(tray, { opacity: 1, x: 0, duration: 0.9 }, 0.05)
        .to(frame, { opacity: 1, scale: 1, duration: 0.9, ease: 'power2.out' }, 0.1);

      // Phase A: Typed prompt appears (scroll-tied letter-by-letter)
      const fullPrompt = 'a red sportscar on road surrounded by buildings';
      const typeObj = { i: 0 };

      if (typedTextEl) typedTextEl.textContent = '';
      if (typedPrompt) gsap.set(typedPrompt, { opacity: 1, y: 0 });

      mainTl.to(typeObj, {
        i: fullPrompt.length,
        duration: 0.9,
        ease: 'none',
        onUpdate: () => {
          if (!typedTextEl) return;
          const n = Math.max(0, Math.min(fullPrompt.length, Math.floor(typeObj.i)));
          typedTextEl.textContent = fullPrompt.slice(0, n);
        },
      }, 0.35);

      // Phase A2: Typed prompt disappears, then capsules + mixing appear
      if (typedPrompt) {
        mainTl.to(typedPrompt, { opacity: 0, y: -10, duration: 0.35, ease: 'power2.inOut' }, 1.25);
      }

      mainTl.to(tokens, {
        opacity: 1,
        y: 0,
        rotate: 0,
        scale: 1,
        stagger: 0.08,
        duration: 0.6,
        ease: 'back.out(1.6)',
      }, 1.35);

      // Phase B: Scatter tokens into the tray field
      mainTl.addLabel('scatter', 1.95);
      mainTl.to(tokens, {
        x: (i) => scatterTargets()[i]?.x ?? 0,
        y: (i) => scatterTargets()[i]?.y ?? 0,
        rotate: (i) => (i % 2 ? 2 : -2),
        duration: 0.9,
        ease: 'power3.out',
      }, 'scatter');

      if (mixIndicator) {
        mainTl.to(mixIndicator, { opacity: 1, y: 0, duration: 0.5 }, 'scatter+=0.25');
      }
      if (mixRing) {
        mainTl.call(() => mixRing.classList.add('is-green'), null, 'scatter+=0.25');
      }

      // Phase C: Mix (tokens dissolve into latent soup)
      mainTl.addLabel('mix', 2.85);
      if (soup) {
        mainTl.call(() => soup.classList.add('active'), null, 'mix');
        mainTl.to(soup, { opacity: 1, duration: 0.4, ease: 'none' }, 'mix+=0.05');
        mainTl.to(soup, { rotation: -8, duration: 1.0, ease: 'none' }, 'mix+=0.1');
      }

      mainTl.to(tokens, {
        x: 0,
        y: 0,
        scale: 0.86,
        opacity: 0,
        filter: 'blur(10px)',
        stagger: 0.06,
        duration: 0.7,
        ease: 'power2.inOut',
      }, 'mix+=0.15');

      if (mixIndicator) {
        mainTl.to(mixIndicator, { opacity: 0, y: 6, duration: 0.3 }, 'mix+=0.55');
      }
      if (mixRing) {
        mainTl.call(() => mixRing.classList.remove('is-green'), null, 'mix+=0.55');
      }

      // Move the mixing moment toward the image (left) before resolve
      mainTl.to([mixIndicator, ...tokens], {
        x: -120,
        opacity: 0,
        duration: 0.35,
        ease: 'power2.in',
        stagger: { each: 0.01, from: 'end' },
      }, 'mix+=0.45');

      // Phase D: Resolve image (blur -> sharp, grayscale -> color)
      mainTl.addLabel('resolve', 3.85);
      if (preview) {
        mainTl.call(() => preview.classList.add('active'), null, 'resolve');
        mainTl.to(preview, {
          opacity: 0.92,
          filter: 'grayscale(0.10) blur(0px) contrast(1.12)',
          scale: 1.0,
          duration: 1.0,
          ease: 'power2.out',
        }, 'resolve+=0.05');
      }
      if (soup) {
        mainTl.to(soup, { opacity: 0.15, duration: 0.6, ease: 'power1.out' }, 'resolve+=0.2');
      }

      // After resolve: switch tray to Synthesized and start stacked filter pills loop
      mainTl.call(() => {
        if (trayTitle) trayTitle.textContent = 'Synthesized';
        if (synthPanel) {
          gsap.to(synthPanel, { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' });
        }
        startMarquee();
      }, null, 'resolve+=0.35');

      // Stop marquee when scrolling back above resolve
      mainTl.call(() => {
        stopMarquee();
        if (trayTitle) trayTitle.textContent = 'Prompt Ingredients';
        if (synthPanel) gsap.set(synthPanel, { opacity: 0, y: 8 });
      }, null, 'mix+=0.05');

      // Phase E: Upscale beat (frame lifts)
      mainTl.addLabel('upscale', 3.8);
      mainTl.call(() => frame && frame.classList.add('is-upscaled'), null, 'upscale');
      mainTl.to(frame, {
        scale: 1.025,
        duration: 0.55,
        ease: 'power2.out',
      }, 'upscale+=0.05')
        .to(frame, { scale: 1.0, duration: 0.35, ease: 'power2.inOut' }, 'upscale+=0.65');

      // Final: CTA reveal
      mainTl.addLabel('cta', 3.6);
      mainTl.to(cta, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }, 'cta')
        .set(cta, { pointerEvents: 'auto' }, 'cta+=0.05');

      // Final Phase: flip book + enable tilt once everything is revealed
      if (bookFront && bookBack) {
        mainTl.to(bookFront, {
          rotateY: -180,
          duration: 0.85,
          ease: 'power2.inOut',
        }, 'cta-=0.2');
        mainTl.to(bookBack, {
          rotateY: 0,
          duration: 0.85,
          ease: 'power2.inOut',
        }, 'cta-=0.2');
      }
      // Cleanup on refresh
      ScrollTrigger.addEventListener('refreshInit', () => {
        if (frame) frame.classList.remove('is-upscaled');
      });

      return () => {
        // matchMedia cleanup
        if (soup) soup.classList.remove('active');
        if (preview) preview.classList.remove('active');
        if (frame) frame.classList.remove('is-upscaled');
        if (mixRing) mixRing.classList.remove('is-green');
        stopMarquee();
      };
    },
  });
});

