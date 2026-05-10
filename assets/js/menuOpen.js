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

    const measure = () => {
        try {
            const bbox = text.getBBox();
            if (bbox.width > 0 && bbox.height > 0) {
                svg.setAttribute('viewBox', `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`);
            }
        } catch (e) { /* ignore */ }
    };

    measure();
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(measure);
    }
    window.addEventListener('load', measure);
    window.addEventListener('resize', measure);
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
