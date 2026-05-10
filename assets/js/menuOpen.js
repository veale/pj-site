// Header behaviour: fit the SVG title to its natural text proportions, build
// the title-window mask + image mirror, and detect overflow on the primary
// nav so the right-side scroll arrow appears.
export default function menuOpen() {
    fitTitle();
    wireNavOverflow();
    imageMirror();
}

function fitTitle() {
    const svg = document.querySelector('.gh-head-title-svg');
    if (!svg) return;
    const text = svg.querySelector('text');
    if (!text) return;

    const measureAndMask = () => {
        try {
            const bbox = text.getBBox();
            if (bbox.width > 0 && bbox.height > 0) {
                svg.setAttribute('viewBox', `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`);
            }
        } catch (e) { /* ignore */ }
        buildTitleMask();
    };

    measureAndMask();
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(measureAndMask);
    }
    window.addEventListener('load', measureAndMask);
    window.addEventListener('resize', measureAndMask);
}

let _displayFontPromise = null;

function findFontUrl(familyNeedle) {
    const needle = familyNeedle.toLowerCase();
    for (const sheet of document.styleSheets) {
        let rules;
        try { rules = sheet.cssRules; } catch (e) { continue; }
        if (!rules) continue;
        for (const rule of rules) {
            if (!(rule instanceof CSSFontFaceRule)) continue;
            const f = (rule.style.getPropertyValue('font-family') || '')
                .replace(/['"]/g, '').trim().toLowerCase();
            if (f !== needle) continue;
            const src = rule.style.getPropertyValue('src') || '';
            const m = src.match(/url\(\s*["']?([^)"']+)["']?\s*\)/);
            if (m) {
                try { return new URL(m[1], sheet.href || document.baseURI).href; }
                catch (e) { return m[1]; }
            }
        }
    }
    return null;
}

function loadDisplayFontDataUrl() {
    if (_displayFontPromise) return _displayFontPromise;
    _displayFontPromise = (async () => {
        const url = findFontUrl('NaNHoloGigawide Ultra');
        if (!url) return null;
        try {
            const r = await fetch(url);
            if (!r.ok) return null;
            const blob = await r.blob();
            return await new Promise((resolve, reject) => {
                const fr = new FileReader();
                fr.onload = () => resolve(fr.result);
                fr.onerror = reject;
                fr.readAsDataURL(blob);
            });
        } catch (e) {
            return null;
        }
    })();
    return _displayFontPromise;
}

async function buildTitleMask() {
    const layer = document.querySelector('.title-mask-layer');
    if (!layer) return;
    const titleSvg = document.querySelector('.gh-head-title-svg');
    if (!titleSvg) return;
    const text = titleSvg.querySelector('text');
    if (!text || !titleSvg.getAttribute('viewBox')) return;

    const tr = titleSvg.getBoundingClientRect();
    if (!tr.width || !tr.height) return;

    const fontDataUrl = await loadDisplayFontDataUrl();

    // Clone the live title SVG so glyph metrics match. Bake font-* attrs
    // because the serialized SVG won't see the page's stylesheet. The mask
    // is a simple white-text-on-transparent — the visible outline is drawn
    // on top by the title-outline-layer (a higher z-index sibling), so the
    // mask doesn't need to be eroded.
    const cs = window.getComputedStyle(text);
    const clone = titleSvg.cloneNode(true);
    clone.removeAttribute('class');
    clone.removeAttribute('role');
    Array.from(clone.querySelectorAll('title')).forEach((t) => t.remove());
    const t2 = clone.querySelector('text');
    t2.removeAttribute('class');
    t2.setAttribute('fill', 'white');
    t2.setAttribute('stroke', 'none');
    t2.removeAttribute('vector-effect');
    t2.setAttribute('font-family', (cs.fontFamily || 'sans-serif').replace(/"/g, "'"));
    t2.setAttribute('font-weight', cs.fontWeight || '400');
    t2.setAttribute('font-size', String(parseFloat(cs.fontSize) || 160));
    clone.setAttribute('width', tr.width);
    clone.setAttribute('height', tr.height);
    if (!clone.getAttribute('xmlns')) {
        clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    }

    const fontStyle = fontDataUrl
        ? `<style>@font-face{font-family:'NaNHoloGigawide Ultra';src:url('${fontDataUrl}') format('woff2');font-weight:400;font-style:normal;}</style>`
        : '';

    let innerStr = new XMLSerializer().serializeToString(clone);
    if (fontStyle) {
        innerStr = innerStr.replace(/<svg([^>]*)>/, `<svg$1><defs>${fontStyle}</defs>`);
    }

    // Mask image: white text on transparent background. Mask alpha is
    // 1 inside glyphs, 0 elsewhere — so the mirror layer is visible only
    // through the title's letter shapes.
    const url = `url("data:image/svg+xml;utf8,${encodeURIComponent(innerStr)}")`;
    layer.style.setProperty('--title-mask', url);
    layer.style.setProperty('--title-mask-pos', `${tr.left}px ${tr.top}px`);
    layer.style.setProperty('--title-mask-size', `${tr.width}px ${tr.height}px`);
    layer.setAttribute('data-ready', '1');
}

// Image mirror: clone every <img> on the page (gallery, post body, etc.) into
// the title-mask-layer and continually align each clone to its source image's
// viewport rect. Only images are cloned, so text never appears in the mask.
function imageMirror() {
    const layer = document.querySelector('.title-mask-layer');
    if (!layer) return;
    const titleSvg = document.querySelector('.gh-head-title-svg');
    const outlineLayer = document.querySelector('.title-outline-layer');
    let outlineSvg = null;

    function ensureOutlineClone() {
        if (!outlineLayer || !titleSvg) return;
        if (outlineSvg && outlineSvg.isConnected) {
            // Keep viewBox in sync if the source's was refit
            const vb = titleSvg.getAttribute('viewBox');
            if (vb && vb !== outlineSvg.getAttribute('viewBox')) {
                outlineSvg.setAttribute('viewBox', vb);
            }
            return;
        }
        const fresh = titleSvg.cloneNode(true);
        fresh.removeAttribute('id');
        fresh.setAttribute('aria-hidden', 'true');
        // Keep the same class so .gh-head-title-text styling (stroke etc.) applies.
        outlineLayer.replaceChildren(fresh);
        outlineSvg = fresh;
    }
    ensureOutlineClone();
    document.addEventListener('hero-gallery:ready', ensureOutlineClone);
    window.addEventListener('load', ensureOutlineClone);
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(ensureOutlineClone);
    }

    const pairs = []; // { src, clone }
    const seen = new WeakSet();

    function shouldMirror(img) {
        if (seen.has(img)) return false;
        if (img.closest('.title-mask-layer')) return false;
        // Only large content images
        const r = img.getBoundingClientRect();
        const w = r.width || img.naturalWidth || 0;
        if (w < 80) return false;
        return true;
    }

    function addClone(img) {
        seen.add(img);
        const c = img.cloneNode(false);
        c.removeAttribute('id');
        c.setAttribute('aria-hidden', 'true');
        c.style.position = 'absolute';
        c.style.top = '0';
        c.style.left = '0';
        c.style.transformOrigin = '0 0';
        c.style.opacity = '1';
        c.style.visibility = 'visible';
        c.style.transform = 'translate(-99999px,-99999px)';
        layer.appendChild(c);
        pairs.push({ src: img, clone: c });
    }

    function rescan() {
        const imgs = document.querySelectorAll(
            '.gh-main img, .hero-gallery img, .gh-content img, .gh-canvas img'
        );
        imgs.forEach((img) => { if (shouldMirror(img)) addClone(img); });
    }

    let raf = false;
    function tick() {
        // Re-read the title's current screen rect every frame and push to
        // CSS variables. iOS Safari's rubber-band settle and URL-bar
        // show/hide shift fixed-position layers ~20px after a scroll ends
        // without firing resize, so we need to track on every frame.
        if (titleSvg) {
            const tr = titleSvg.getBoundingClientRect();
            if (tr.width > 0) {
                layer.style.setProperty('--title-mask-pos', `${tr.left}px ${tr.top}px`);
                layer.style.setProperty('--title-mask-size', `${tr.width}px ${tr.height}px`);
                if (outlineSvg) {
                    outlineSvg.style.width = `${tr.width}px`;
                    outlineSvg.style.height = `${tr.height}px`;
                    outlineSvg.style.transform = `translate3d(${tr.left}px, ${tr.top}px, 0)`;
                }
            }
        }
        for (const { src, clone } of pairs) {
            if (!src.isConnected) {
                clone.style.transform = 'translate3d(-99999px,-99999px,0)';
                continue;
            }
            const r = src.getBoundingClientRect();
            clone.style.width = `${r.width}px`;
            clone.style.height = `${r.height}px`;
            clone.style.transform = `translate3d(${r.left}px, ${r.top}px, 0)`;
        }
        raf = false;
    }
    function schedule() {
        if (!raf) {
            raf = true;
            requestAnimationFrame(tick);
        }
    }

    rescan();
    schedule();

    // Late-loading content (hero gallery, lazy images, etc.)
    document.addEventListener('hero-gallery:ready', () => { rescan(); schedule(); });
    window.addEventListener('load', () => { rescan(); schedule(); });

    // iOS Safari rubber-band/URL-bar settle: scroll events stop firing while
    // the viewport is still shifting. Run a short trailing burst after the
    // last scroll event to catch the final position.
    let settleTimer = null;
    const burstAfterScroll = () => {
        if (settleTimer) clearTimeout(settleTimer);
        settleTimer = setTimeout(() => {
            schedule();
            requestAnimationFrame(schedule);
            setTimeout(schedule, 250);
            setTimeout(schedule, 600);
        }, 50);
    };
    window.addEventListener('scroll', () => { schedule(); burstAfterScroll(); }, { passive: true });
    window.addEventListener('resize', schedule);

    // Keep clone src up-to-date if the source image's src changes after load.
    const mo = new MutationObserver(() => { rescan(); schedule(); });
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
}

function wireNavOverflow() {
    const nav = document.querySelector('.gh-head-nav');
    if (!nav) return;
    const scroller = nav.querySelector('.gh-head-nav-scroll');
    const arrow = nav.querySelector('.gh-head-nav-arrow');
    if (!scroller || !arrow) return;

    const update = () => {
        const overflowing = scroller.scrollWidth - scroller.clientWidth > 1;
        nav.classList.toggle('is-overflowing', overflowing);
    };

    arrow.addEventListener('click', () => {
        scroller.scrollBy({ left: scroller.clientWidth * 0.6, behavior: 'smooth' });
    });

    window.addEventListener('resize', update);
    scroller.addEventListener('scroll', update);
    window.addEventListener('load', update);
    update();
}
