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
    const titleSvg = document.querySelector('.gh-head-title-svg');
    if (!head || !titleSvg) return;
    const text = titleSvg.querySelector('text');
    if (!text) return;
    const innerVB = titleSvg.getAttribute('viewBox');
    if (!innerVB) return;

    const hr = head.getBoundingClientRect();
    const tr = text.getBoundingClientRect();
    if (hr.width === 0 || tr.width === 0) return;

    const cs = window.getComputedStyle(text);
    const family = (cs.fontFamily || 'sans-serif').replace(/"/g, "'");
    const weight = cs.fontWeight || '400';
    const size = parseFloat(cs.fontSize) || 160;
    const content = (text.textContent || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // Outer mask SVG sized to the header. White background = navbar visible.
    // Nested inner SVG re-renders the live title (same viewBox + glyphs) in
    // black so luminance masking turns the text region transparent.
    const innerX = tr.left - hr.left;
    const innerY = tr.top - hr.top;
    const inner = `<svg x="${innerX}" y="${innerY}" width="${tr.width}" height="${tr.height}" viewBox="${innerVB}" preserveAspectRatio="xMidYMid meet">` +
        `<text x="0" y="0" dominant-baseline="text-before-edge" ` +
        `font-family="${family}" font-weight="${weight}" font-size="${size}" ` +
        `fill="black">${content}</text></svg>`;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${hr.width}" height="${hr.height}" viewBox="0 0 ${hr.width} ${hr.height}">` +
        `<rect width="100%" height="100%" fill="white"/>${inner}</svg>`;

    const url = `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
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
