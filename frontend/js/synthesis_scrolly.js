/**
 * POLYGEN CHAPTER 3: SYNTHESIS & NEURAL VAULT
 * Final Fix: Footer Visibility & Scale-Through Logic + Particle Physics
 */

document.addEventListener('DOMContentLoaded', () => {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
    gsap.registerPlugin(ScrollTrigger);

    const section = document.querySelector('.synthesis-scrolly');
    if (!section) return;

    // --- 1. ELEMENT SELECTORS ---
    const pinWrapper = section.querySelector('.synth-pin-wrapper');
    const logicCore = section.querySelector('.synth-logic-core');
    const hexLeft = section.querySelector('.synth-hex-half--left');
    const hexRight = section.querySelector('.synth-hex-half--right');
    const hexShield = section.querySelector('.synth-hex-shield');
    const polyReveal = section.querySelector('.synth-polygen-reveal');
    const vaultCards = gsap.utils.toArray('.vault-card');
    const footerArea = section.querySelector('.synth-archive-panel');

    // --- 2. PARTICLE PHYSICS (Antigravity Config) ---
    if (document.getElementById('particles-jss') && typeof particlesJS !== 'undefined') {
        particlesJS('particles-jss', {
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

        // Antigravity Scroll Effect (Linked to local scroll)
        window.addEventListener('scroll', () => {
            const scrollPercent = window.scrollY / (document.documentElement.scrollHeight - window.innerHeight);
            if (window.pJSDom && window.pJSDom[0]) {
                const pJS = window.pJSDom[0].pJS;
                pJS.particles.move.speed = 1.5 + (scrollPercent * 9);
            }
        });
    }

    // --- 3. AMBIENT ROTATION (Stable) ---
    gsap.to(hexShield, { rotation: 360, duration: 10, repeat: -1, ease: "none" });

    // --- 4. INITIAL STATES ---
    gsap.set([hexLeft, hexRight], { x: 0, opacity: 0 });
    gsap.set(hexShield, { scale: 0.8, opacity: 0, rotation: -180 });
    gsap.set(polyReveal, { opacity: 0, scale: 0.6, letterSpacing: "0.8em" });
    gsap.set(vaultCards, { opacity: 0, y: 400, rotateX: -45, scale: 0.8 });

    gsap.set(footerArea, {
        opacity: 0,
        y: 100,
        display: "block",
        position: "absolute",
        zIndex: 100
    });

    // --- 5. MAIN SCROLLYTELLING TIMELINE ---
    const mainTl = gsap.timeline({
        scrollTrigger: {
            trigger: section,
            start: "top top",
            end: "+=250%",
            pin: pinWrapper,
            scrub: 1.5,
            anticipatePin: 1
        }
    });

    mainTl
        .addLabel('materialize')
        .to([hexLeft, hexRight], { opacity: 1, duration: 1.5 }, 'materialize')
        .to(hexShield, { opacity: 1, scale: 1, rotation: 0, duration: 1.5, ease: "back.out(1.4)" }, 'materialize')

        .addLabel('split', '+=0.5')
        .to(hexLeft, { x: -220, rotationY: -35, duration: 2 }, 'split')
        .to(hexRight, { x: 220, rotationY: 35, duration: 2 }, 'split')
        .to(polyReveal, { opacity: 1, scale: 1, letterSpacing: "0.26em", duration: 1.5 }, 'split+=0.4')

        .addLabel('compress', '+=0.8')
        .to(logicCore, { x: "-55vh", y: "0vh", scale: 0.65, duration: 2 }, 'compress')
        .addLabel('cards', '+=0.2')
        .to(vaultCards, {
            opacity: 1,
            y: (i) => (i * -15) + 50,
            rotateX: -17,
            scale: 1,
            stagger: 0.3,
            duration: 3
        }, 'cards')

        .addLabel('exit', '+=4')
        .to(vaultCards, { opacity: 0, y: -200, filter: "blur(20px)", duration: 1.5 }, 'exit')
        // Added particle fade-out on hyper-exit
        .to("#particles-jss", { opacity: 0, duration: 1 }, 'exit')
        .to(logicCore, {
            scale: 12,
            opacity: 0,
            y: "0vh",
            filter: "blur(50px)",
            duration: 4,
            ease: "power2.in"
        }, 'exit+=0.5')

        .addLabel('footer-reveal', '-=1.5')
        .to(footerArea, {
            opacity: 1,
            y: 0,
            duration: 2.5,
            pointerEvents: "auto",
            ease: "expo.out"
        }, 'footer-reveal');

    // --- 6. GLOBAL GRID DRIFT ---
    gsap.to(".synth-blueprint-grid-bg", {
        backgroundPosition: "0px -200px",
        ease: "none",
        scrollTrigger: {
            trigger: ".synthesis-scrolly",
            start: "top top",
            end: "bottom bottom",
            scrub: true
        }
    });

    gsap.to(".synth-blueprint-parallax-grid", {
        backgroundPosition: "0px -500px",
        ease: "none",
        scrollTrigger: {
            trigger: ".synthesis-scrolly",
            start: "top top",
            end: "bottom bottom",
            scrub: true
        }
    });

    window.addEventListener('load', () => ScrollTrigger.refresh());

    // Reset particles on resize
    window.addEventListener('resize', () => {
        if (window.pJSDom && window.pJSDom[0]) {
            window.pJSDom[0].pJS.fn.particlesRefresh();
        }
    });
});