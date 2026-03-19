/**
 * POLYGEN Landing Page JS
 * Handles Scrollytelling (GSAP + Lenis) and Logo Scramble effect
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Lenis Smooth Scroll
    const lenis = new Lenis({
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        direction: 'vertical',
        gestureDirection: 'vertical',
        smooth: true,
        mouseMultiplier: 1,
        smoothTouch: false,
        touchMultiplier: 2,
        infinite: false,
    });

    function raf(time) {
        lenis.raf(time);
        requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    // 2. POLYGEN Logo Scramble Animation (Sequential)
    const scrambleElement = document.getElementById('polygen-logo');
    const targetText = "POLYGEN";
    const scrambleChars = "{}><?$3#!*^01";

    async function scrambleSequential(container) {
        const spans = container.querySelectorAll('span');
        const targetLetters = targetText.split('');

        // Initial state: first letter starts scrambling, others hidden or random?
        // Let's make them all random first, then resolve one by one.
        spans.forEach(span => {
            span.innerText = scrambleChars[Math.floor(Math.random() * scrambleChars.length)];
        });

        for (let i = 0; i < spans.length; i++) {
            await scrambleSingleLetter(spans[i], targetLetters[i]);
        }
    }

    function scrambleSingleLetter(element, finalChar, duration = 100) {
        return new Promise(resolve => {
            let start = null;
            function animate(timestamp) {
                if (!start) start = timestamp;
                const progress = timestamp - start;

                if (progress < duration) {
                    element.innerText = scrambleChars[Math.floor(Math.random() * scrambleChars.length)];
                    requestAnimationFrame(animate);
                } else {
                    element.innerText = finalChar;
                    resolve();
                }
            }
            requestAnimationFrame(animate);
        });
    }

    // Trigger scramble on load and periodically
    if (scrambleElement) {
        scrambleSequential(scrambleElement);
        setInterval(() => scrambleSequential(scrambleElement), 4000);
    }

    // 3. GSAP Scrollytelling
    gsap.registerPlugin(ScrollTrigger);

    // Pin Hero Section
    gsap.to("#hero", {
        scrollTrigger: {
            trigger: "#hero",
            start: "top top",
            end: "+=100%",
            pin: true,
            pinSpacing: false,
            scrub: true,
        },
        opacity: 0,
        scale: 0.8,
        filter: "blur(20px)",
    });

    // Reveal chapters
    const chapters = gsap.utils.toArray('.chapter-section');
    chapters.forEach((chapter, i) => {
        const text = chapter.querySelector('.chapter-text');
        const media = chapter.querySelector('.chapter-media');

        gsap.from(text, {
            scrollTrigger: {
                trigger: chapter,
                start: "top 80%",
                toggleActions: "play none none reverse",
            },
            x: -100,
            opacity: 0,
            duration: 1,
            ease: "power4.out"
        });

        gsap.from(media, {
            scrollTrigger: {
                trigger: chapter,
                start: "top 80%",
                toggleActions: "play none none reverse",
            },
            x: 100,
            opacity: 0,
            duration: 1.2,
            ease: "power4.out"
        });
    });

    // Update Nav active state on scroll
    const navLinks = document.querySelectorAll('.neu-nav-links a');

    // Initial state: select Home (index 2 in the nav)
    // On the landing page, we want Home to stay selected unless the user navigates away.
    updateNav(2);

    function updateNav(index) {
        if (index === undefined || index === null) return;
        navLinks.forEach((link, i) => {
            if (i === index) link.classList.add('active');
            else link.classList.remove('active');
        });
    }

    // 4. Smooth Scroll to Top for Home Button
    const homeBtn = document.querySelector('.home-btn');
    if (homeBtn) {
        homeBtn.addEventListener('click', (e) => {
            const currentPath = window.location.pathname;
            if (currentPath.endsWith('index.html') || currentPath === '/' || currentPath === '') {
                e.preventDefault();
                lenis.scrollTo(0, { 
                    duration: 0.5, 
                    easing: (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t // Quadratic In-Out
                });
            }
        });
    }

    // 4. Antigravity Particles (particles.js)
    if (document.getElementById('particles-js')) {
        particlesJS('particles-js', {
            "particles": {
                "number": { "value": 110, "density": { "enable": true, "value_area": 800 } },
                "color": { "value": "#00f2ff" },
                "shape": { "type": "circle" },
                "opacity": {
                    "value": 0.93,
                    "random": true,
                    "anim": { "enable": true, "speed": 1, "opacity_min": 0.05, "sync": false }
                },
                "size": { "value": 4, "random": true },
                "line_linked": { "enable": true, "distance": 180, "color": "#00f2ff", "opacity": 0.1, "width": 1 },
                "move": {
                    "enable": true,
                    "speed": 1.5,
                    "direction": "top",
                    "random": true,
                    "straight": false,
                    "out_mode": "out",
                    "bounce": false,
                }
            },
            "interactivity": {
                "events": { "onhover": { "enable": true, "mode": "grab" }, "onclick": { "enable": false } },
                "modes": { "grab": { "distance": 220, "line_linked": { "opacity": 0.3 } } }
            },
            "retina_detect": true
        });

        // Antigravity Scroll Effect
        window.addEventListener('scroll', () => {
            const scrollPercent = window.scrollY / (document.documentElement.scrollHeight - window.innerHeight);
            if (window.pJSDom && window.pJSDom[0]) {
                const pJS = window.pJSDom[0].pJS;
                pJS.particles.move.speed = 1.5 + (scrollPercent * 9);
            }
        });
    }

    // 5. Scroll-Linked Blob Rotation (180deg Swap)
    // Locked to hero section for precision and to prevent 'square' rendering artifacts
    gsap.to(".hero-visuals", {
        scrollTrigger: {
            trigger: "#hero",
            start: "top top",
            end: "bottom top",
            scrub: 1,
        },
        rotation: 180,
        force3D: true, // Prevents square/clipping artifacts
        ease: "power1.inOut"
    });

    // Reset particles on window resize specifically for the hero container
    window.addEventListener('resize', () => {
        if (window.pJSDom && window.pJSDom[0]) {
            window.pJSDom[0].pJS.fn.particlesRefresh();
        }
    });


    // ── Chapter 2 Parallax Tilt (moved from Ch3) ──────────────────────────────
    (function initCh2Tilt() {
        const inner = document.querySelector('#generation .gen-frame-inner');
        if (!inner) return;

        const card = inner;
        const MAX = 12;

        card.addEventListener('mousemove', (e) => {
            if (!card.classList.contains('tilt-active')) return;
            const r = card.getBoundingClientRect();
            const x = (e.clientX - r.left) / r.width;
            const y = (e.clientY - r.top) / r.height;
            const ry = (x - 0.5) * 2 * MAX;
            const rx = -(y - 0.5) * 2 * MAX;
            card.style.transform = `perspective(900px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) scale(1.02)`;
        });

        card.addEventListener('mouseleave', () => {
            card.style.transform = '';
        });
    })();

});
