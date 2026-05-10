// Detect when the primary nav overflows horizontally (desktop) and
// expose a scroll arrow. On mobile the nav wraps so this is a no-op.
export default function menuOpen() {
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
    update();
    // Re-check after fonts/images settle
    window.addEventListener('load', update);
}
