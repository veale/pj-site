// Hero gallery: pulls <img> elements out of the server-rendered Ghost page
// content (slug "home-hero") and re-mounts them as a vertical stack. The
// VFX-JS shaders are wired in index.hbs after this builds the DOM.

export default function heroGallery() {
    const root = document.querySelector('[data-hero-gallery]');
    if (!root) return;

    const source = root.querySelector('.hero-gallery__source');
    const stage = root.querySelector('[data-hero-stage]');
    if (!source || !stage) return;

    const sourceImgs = Array.from(source.querySelectorAll('img'));
    if (sourceImgs.length === 0) {
        root.style.display = 'none';
        return;
    }

    sourceImgs.forEach((srcImg) => {
        const wrap = document.createElement('div');
        wrap.className = 'hero-gallery__item';
        const img = document.createElement('img');
        img.src = srcImg.src;
        img.alt = srcImg.alt || '';
        img.crossOrigin = 'anonymous';
        img.decoding = 'async';
        img.loading = 'lazy';
        wrap.appendChild(img);
        stage.appendChild(wrap);
    });

    // Signal that the gallery is ready so the VFX bootstrap (index.hbs)
    // can attach shaders.
    root.dispatchEvent(new CustomEvent('hero-gallery:ready', { bubbles: true }));
    document.documentElement.classList.add('hero-gallery-ready');
}
