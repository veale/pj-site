// Hero gallery: pinned, full-bleed, pixel-dissolve transitions, with a
// title-mask "live composite" effect on the masthead.
//
// Source content: a Ghost Page with slug "home-hero" rendered server-side
// into `.hero-gallery__source` (Image / Gallery cards). We extract <img>
// elements, pre-render heavily pixelated tiles for the looping background
// and a medium-pixel version for transition-time fg, and the original for
// the settled fg.

const BG_PIXEL_W = 28;       // very chunky pixels for background
const FG_PIXEL_W = 110;      // medium pixels for the transitioning foreground
const COMMIT_THRESHOLD = 0.30; // 30% of viewport height
const SETTLE_MS = 380;
const WHEEL_PROGRESS_FACTOR = 1 / 600; // 600px wheel ≈ 1 slide

export default function heroGallery() {
    const root = document.querySelector('[data-hero-gallery]');
    if (!root) return;

    const source = root.querySelector('.hero-gallery__source');
    const stage = root.querySelector('[data-hero-stage]');
    const hint = root.querySelector('[data-hero-hint]');
    if (!source || !stage) return;

    const sourceImgs = Array.from(source.querySelectorAll('img'));
    if (sourceImgs.length === 0) {
        root.style.display = 'none';
        return;
    }

    // Mirror layer for the title mask
    const mirror = document.querySelector('.title-mask-layer');
    let mirrorStage = null;
    if (mirror) {
        mirrorStage = document.createElement('div');
        mirrorStage.className = 'title-mask-stage';
        mirror.appendChild(mirrorStage);
    }

    measureHeader();
    window.addEventListener('resize', measureHeader);
    window.addEventListener('load', measureHeader);

    // Build slides as soon as we can; pre-render pixelated tiles asynchronously.
    const slides = [];
    sourceImgs.forEach((img, i) => {
        const slide = buildSlide(img.src, img.alt || '', i);
        slides.push(slide);
        stage.appendChild(slide.el);
        if (mirrorStage) mirrorStage.appendChild(slide.mirrorEl);
    });

    // Build title mask once fonts are ready.
    if (mirror) {
        buildTitleMask(mirror);
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(() => buildTitleMask(mirror));
        }
        window.addEventListener('resize', () => buildTitleMask(mirror));
    }

    // State
    let current = 0;          // index of the slide currently visible
    let progress = 0;         // 0..1, drag progress toward (current+1)
    let dragging = false;
    let dragStartY = 0;
    let dragLastY = 0;
    let animFrame = null;

    setSlideRoles();

    // ----- Input handling -----

    root.addEventListener('wheel', onWheel, { passive: false });
    root.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    // Keyboard
    root.tabIndex = 0;
    root.addEventListener('keydown', onKey);

    function onWheel(e) {
        if (current >= slides.length - 1) return; // last slide: let page scroll
        e.preventDefault();
        const delta = e.deltaY;
        const next = clamp(progress + delta * WHEEL_PROGRESS_FACTOR, 0, 1);
        setProgress(next);
        if (progress >= 0.999) commitForward();
        else if (progress <= 0.001) progress = 0;
        // Auto-commit on big wheel pushes
        scheduleSettle();
    }

    let settleTimer = null;
    function scheduleSettle() {
        if (settleTimer) clearTimeout(settleTimer);
        settleTimer = setTimeout(() => {
            if (dragging) return;
            if (progress >= COMMIT_THRESHOLD) commitForward();
            else snapBack();
        }, 140);
    }

    function onPointerDown(e) {
        if (current >= slides.length - 1) return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        dragging = true;
        dragStartY = e.clientY;
        dragLastY = e.clientY;
        try { root.setPointerCapture(e.pointerId); } catch (_) {}
    }

    function onPointerMove(e) {
        if (!dragging) return;
        dragLastY = e.clientY;
        const dy = dragStartY - dragLastY; // positive when dragging up
        const h = root.clientHeight || window.innerHeight;
        setProgress(clamp(dy / h, 0, 1));
    }

    function onPointerUp() {
        if (!dragging) return;
        dragging = false;
        if (progress >= COMMIT_THRESHOLD) commitForward();
        else snapBack();
    }

    function onKey(e) {
        if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
            if (current < slides.length - 1) { e.preventDefault(); commitForward(); }
        } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
            if (current > 0) { e.preventDefault(); commitBackward(); }
        }
    }

    // ----- Transitions -----

    function setProgress(p) {
        progress = p;
        root.style.setProperty('--hero-progress', String(p));
        if (mirror) mirror.style.setProperty('--hero-progress', String(p));
        // Whichever slide is "current" is no longer settled while progress > 0
        const prev = slides[current];
        if (prev) prev.setSettled(p === 0);
    }

    function commitForward() {
        if (current >= slides.length - 1) return;
        animateProgressTo(1, () => {
            current += 1;
            setProgress(0);
            setSlideRoles();
            if (current >= slides.length - 1) {
                root.classList.add('is-last');
            }
        });
    }

    function commitBackward() {
        if (current <= 0) return;
        // Reverse: progress goes from 0 back to "the previous slide is current"
        // Trick: temporarily set roles so currentslide is `next` coming in.
        const nextEls = slides[current];
        const prevEls = slides[current - 1];
        prevEls.setRole('prev');
        nextEls.setRole('next');
        // Simulate progress going from 1 → 0 = prev appears
        setProgress(1);
        requestAnimationFrame(() => {
            animateProgressTo(0, () => {
                current -= 1;
                setProgress(0);
                setSlideRoles();
                root.classList.remove('is-last');
            });
        });
    }

    function snapBack() {
        animateProgressTo(0, () => {
            const prev = slides[current];
            if (prev) prev.setSettled(true);
        });
    }

    function animateProgressTo(target, done) {
        if (animFrame) cancelAnimationFrame(animFrame);
        const start = progress;
        const t0 = performance.now();
        const dur = SETTLE_MS;
        const tick = (now) => {
            const t = Math.min(1, (now - t0) / dur);
            const eased = easeOutCubic(t);
            setProgress(start + (target - start) * eased);
            if (t < 1) animFrame = requestAnimationFrame(tick);
            else { animFrame = null; done && done(); }
        };
        animFrame = requestAnimationFrame(tick);
    }

    function setSlideRoles() {
        slides.forEach((s, i) => {
            if (i === current) s.setRole('prev');
            else if (i === current + 1) s.setRole('next');
            else s.setRole('idle');
            s.setSettled(i === current && progress === 0);
        });
    }

    // ----- Slide construction -----

    function buildSlide(src, alt, idx) {
        const make = () => {
            const el = document.createElement('div');
            el.className = 'hero-slide hero-slide--idle';
            el.dataset.slideIndex = String(idx);
            el.innerHTML = `
                <div class="hero-slide__bg">
                    <div class="hero-slide__bg-track">
                        <img class="hero-slide__bg-tile" alt="" aria-hidden="true">
                        <img class="hero-slide__bg-tile" alt="" aria-hidden="true">
                    </div>
                </div>
                <div class="hero-slide__fg">
                    <img class="hero-slide__fg-pixel" alt="" aria-hidden="true">
                    <img class="hero-slide__fg-sharp" alt="${escapeAttr(alt)}">
                </div>`;
            return el;
        };
        const el = make();
        const mirrorEl = make();

        // Originals
        setBoth('.hero-slide__fg-sharp', el, mirrorEl, (n) => { n.src = src; });

        // Pre-render pixelated versions when the original loads.
        const probe = new Image();
        probe.crossOrigin = 'anonymous';
        probe.onload = () => {
            const bgUrl = pixelateToDataURL(probe, BG_PIXEL_W);
            const fgUrl = pixelateToDataURL(probe, FG_PIXEL_W);
            if (bgUrl) {
                el.querySelectorAll('.hero-slide__bg-tile').forEach((n) => n.src = bgUrl);
                mirrorEl.querySelectorAll('.hero-slide__bg-tile').forEach((n) => n.src = bgUrl);
            }
            if (fgUrl) {
                el.querySelector('.hero-slide__fg-pixel').src = fgUrl;
                mirrorEl.querySelector('.hero-slide__fg-pixel').src = fgUrl;
            }
        };
        probe.onerror = () => {
            // Cross-origin canvas taint: fall back to using the original everywhere.
            el.querySelectorAll('.hero-slide__bg-tile').forEach((n) => n.src = src);
            mirrorEl.querySelectorAll('.hero-slide__bg-tile').forEach((n) => n.src = src);
            el.querySelector('.hero-slide__fg-pixel').src = src;
            mirrorEl.querySelector('.hero-slide__fg-pixel').src = src;
        };
        probe.src = src;

        return {
            el, mirrorEl,
            setRole(role) {
                el.classList.remove('hero-slide--prev','hero-slide--next','hero-slide--idle');
                mirrorEl.classList.remove('hero-slide--prev','hero-slide--next','hero-slide--idle');
                el.classList.add(`hero-slide--${role}`);
                mirrorEl.classList.add(`hero-slide--${role}`);
            },
            setSettled(settled) {
                el.classList.toggle('is-settled', settled);
                mirrorEl.classList.toggle('is-settled', settled);
            },
        };
    }
}

// ----- Helpers -----

function pixelateToDataURL(img, targetW) {
    try {
        const ratio = (img.naturalHeight || img.height) / (img.naturalWidth || img.width);
        const w = Math.max(1, Math.round(targetW));
        const h = Math.max(1, Math.round(w * ratio));
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 0, 0, w, h);
        return c.toDataURL('image/png');
    } catch (e) {
        return null;
    }
}

function buildTitleMask(layer) {
    const titleSvg = document.querySelector('.gh-head-title-svg');
    if (!titleSvg) return;
    const r = titleSvg.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;

    // Clone the title's <text> shape into a fresh white-on-transparent SVG sized
    // to the title's screen rect.
    const text = titleSvg.querySelector('text');
    if (!text) return;
    const cs = window.getComputedStyle(text);
    const fontFamily = cs.fontFamily || 'sans-serif';
    const fontWeight = cs.fontWeight || '400';

    // Use the same viewBox as the live title so the rendered glyphs match.
    const vb = titleSvg.getAttribute('viewBox') || `0 0 ${r.width} ${r.height}`;
    const content = text.textContent.replace(/&/g, '&amp;').replace(/</g, '&lt;');

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" preserveAspectRatio="xMidYMid meet">` +
        `<text x="${text.getAttribute('x') || 0}" y="${text.getAttribute('y') || 0}" ` +
        `dominant-baseline="${text.getAttribute('dominant-baseline') || 'auto'}" ` +
        `text-anchor="${text.getAttribute('text-anchor') || 'start'}" ` +
        `font-family='${fontFamily}' font-weight="${fontWeight}" font-size="${parseFloat(cs.fontSize) || 160}" ` +
        `fill="white" stroke="none">${content}</text></svg>`;

    const url = `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
    layer.style.setProperty('--title-mask', url);
    layer.style.setProperty('--title-mask-pos', `${r.left}px ${r.top}px`);
    layer.style.setProperty('--title-mask-size', `${r.width}px ${r.height}px`);
    layer.setAttribute('data-ready', '1');
}

function measureHeader() {
    const h = document.getElementById('gh-head');
    if (!h) return;
    const px = h.getBoundingClientRect().height;
    document.documentElement.style.setProperty('--gh-head-h', `${Math.round(px)}px`);
}

function setBoth(selector, a, b, fn) {
    fn(a.querySelector(selector));
    fn(b.querySelector(selector));
}
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
function escapeAttr(s) {
    return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
}
