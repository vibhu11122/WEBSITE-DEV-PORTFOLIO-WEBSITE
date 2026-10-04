// Shared interactions for every page: navbar, mobile menu, scroll progress,
// scroll-reveal animations, card spotlight, and the contact form.
(function () {
    const navbar = document.getElementById('navbar');
    const progress = document.querySelector('.scroll-progress');

    function onScroll() {
        const y = window.scrollY;
        if (navbar) navbar.classList.toggle('scrolled', y > 40);
        if (progress) {
            const max = document.documentElement.scrollHeight - window.innerHeight;
            progress.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
        }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // Mobile menu
    const toggle = document.querySelector('.nav-toggle');
    const links = document.querySelector('.nav-links');
    if (toggle && links) {
        toggle.addEventListener('click', () => {
            const open = links.classList.toggle('open');
            toggle.setAttribute('aria-expanded', String(open));
        });
        links.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
            links.classList.remove('open');
            toggle.setAttribute('aria-expanded', 'false');
        }));
    }

    // Scroll reveal, staggered within each group
    const revealSelector = [
        '.section-label', '.section h2', '.section-intro',
        '.card', '.timeline-item', '.philosophy-item', '.metric-item',
        '.contact-info', '.contact-form', '.cta-band > *'
    ].join(',');
    const targets = document.querySelectorAll(revealSelector);

    if ('IntersectionObserver' in window) {
        targets.forEach(el => {
            const siblings = Array.from(el.parentElement.children).filter(c => c.matches(revealSelector));
            el.style.setProperty('--delay', `${Math.min(siblings.indexOf(el), 6) * 0.08}s`);
            el.classList.add('reveal');
        });
        const io = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('in-view');
                    io.unobserve(entry.target);
                }
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
        targets.forEach(el => io.observe(el));
    }

    // Cursor-following spotlight on cards
    document.querySelectorAll('.card').forEach(card => {
        card.addEventListener('pointermove', e => {
            const r = card.getBoundingClientRect();
            card.style.setProperty('--mx', `${e.clientX - r.left}px`);
            card.style.setProperty('--my', `${e.clientY - r.top}px`);
        });
    });

    // Typed role rotator in the home hero
    const typed = document.querySelector('.typed');
    if (typed) {
        const words = JSON.parse(typed.dataset.words || '[]');
        let w = 0, i = 0, deleting = false;
        (function tick() {
            const word = words[w] || '';
            i += deleting ? -1 : 1;
            typed.textContent = word.slice(0, i);
            let delay = deleting ? 45 : 90;
            if (!deleting && i === word.length) { deleting = true; delay = 1600; }
            else if (deleting && i === 0) { deleting = false; w = (w + 1) % words.length; delay = 300; }
            setTimeout(tick, delay);
        })();
    }

    // Contact form: no backend, so open the visitor's mail client pre-filled
    const form = document.querySelector('.contact-form');
    if (form) {
        form.addEventListener('submit', e => {
            e.preventDefault();
            const name = form.querySelector('#name').value.trim();
            const email = form.querySelector('#email').value.trim();
            const message = form.querySelector('#message').value.trim();
            const subject = encodeURIComponent(`Portfolio enquiry from ${name}`);
            const body = encodeURIComponent(`${message}\n\n— ${name} (${email})`);
            window.location.href = `mailto:vibhu3344432@gmail.com?subject=${subject}&body=${body}`;
        });
    }
})();
