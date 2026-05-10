// Header behaviour: fit the SVG title to its natural text proportions, and
// detect overflow on the primary nav so the right-side scroll arrow appears.
export default function menuOpen() {
    fitTitle();
    wireNavOverflow();
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
        buildHeadMask();
    };

    measureAndMask();
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(measureAndMask);
    }
    window.addEventListener('load', measureAndMask);
    window.addEventListener('resize', measureAndMask);
    window.addEventListener('scroll', buildHeadMask, { passive: true });
}

function buildHeadMask() {
    const head = document.getElementById('gh-head');
    if (!head) return;
    const titleSvg = document.querySelector('.gh-head-title-svg');
    if (!titleSvg) return;
    const text = titleSvg.querySelector('text');
    if (!text || !titleSvg.getAttribute('viewBox')) return;

    const hr = head.getBoundingClientRect();
    const tr = titleSvg.getBoundingClientRect();
    if (!hr.width || !tr.width) return;

    // Clone the visible title SVG so the mask uses identical glyph metrics
    // and viewBox positioning. Strip the <title>, set fill black + remove
    // stroke, and bake the computed font-* into attributes since the
    // serialized SVG won't see the stylesheet.
    const cs = window.getComputedStyle(text);
    const clone = titleSvg.cloneNode(true);
    clone.removeAttribute('class');
    clone.removeAttribute('role');
    Array.from(clone.querySelectorAll('title')).forEach((t) => t.remove());
    const t2 = clone.querySelector('text');
    t2.removeAttribute('class');
    t2.setAttribute('fill', 'black');
    t2.setAttribute('stroke', 'none');
    t2.removeAttribute('vector-effect');
    t2.setAttribute('font-family', (cs.fontFamily || 'sans-serif').replace(/"/g, "'"));
    t2.setAttribute('font-weight', cs.fontWeight || '400');
    t2.setAttribute('font-size', String(parseFloat(cs.fontSize) || 160));

    // Position the clone at the live title's screen coordinates within the header.
    const innerX = Math.round(tr.left - hr.left);
    const innerY = Math.round(tr.top - hr.top);
    let innerStr = new XMLSerializer().serializeToString(clone);
    if (!/\sxmlns=/.test(innerStr)) {
        innerStr = innerStr.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    innerStr = innerStr.replace(
        /^<svg/,
        `<svg x="${innerX}" y="${innerY}" width="${tr.width}" height="${tr.height}"`
    );

    const W = Math.round(hr.width);
    const H = Math.round(hr.height);

    // Use an SVG <mask> so the resulting image has true alpha=0 in text shape
    // and alpha=1 elsewhere — works under either CSS mask-mode (alpha or
    // luminance), so we don't depend on browser defaults.
    const outer =
        `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
        `<defs><mask id="hm" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}">` +
        `<rect width="100%" height="100%" fill="white"/>${innerStr}</mask></defs>` +
        `<rect width="100%" height="100%" fill="white" mask="url(#hm)"/></svg>`;

    const url = `url("data:image/svg+xml;utf8,${encodeURIComponent(outer)}")`;
    head.style.setProperty('--head-mask', url);
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
