document.addEventListener('DOMContentLoaded', () => {

    /* --- Mobile Nav Toggle --- */
    const toggle = document.querySelector('.navbar__toggle');
    const navLinks = document.querySelector('.navbar__links');

    if (toggle && navLinks) {
        toggle.addEventListener('click', () => {
            navLinks.classList.toggle('navbar__links--open');
        });

        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                navLinks.classList.remove('navbar__links--open');
            });
        });
    }

    /* --- Scroll Reveal --- */
    const itemsToReveal = [
        '.features__header', '.features__grid',
        '.download__header', '.download__platforms',
        '.concept__header', '.concept__body', '.concept__tags',
        '.oss__content', '.trusted',
    ];

    if ('IntersectionObserver' in window) {
        itemsToReveal.forEach(sel => {
            document.querySelectorAll(sel).forEach(el => el.classList.add('reveal'));
        });

        document.querySelectorAll('.feature-card').forEach((card, i) => {
            card.classList.add('reveal');
            card.style.transitionDelay = `${i * 0.05}s`;
        });

        document.querySelectorAll('.platform-card').forEach((card, i) => {
            card.classList.add('reveal');
            card.style.transitionDelay = `${i * 0.08}s`;
        });

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('reveal--visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

        document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
    } else {
        document.querySelectorAll('.reveal').forEach(el => el.classList.add('reveal--visible'));
    }

    /* --- Smooth scroll for anchor links --- */
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', (e) => {
            const href = anchor.getAttribute('href');
            if (href === '#') return;
            const target = document.querySelector(href);
            if (target) {
                e.preventDefault();
                const top = target.getBoundingClientRect().top + window.scrollY - 64;
                window.scrollTo({ top, behavior: 'smooth' });
            }
        });
    });
});
