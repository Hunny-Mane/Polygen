/**
 * DETECTION BLUEPRINT ARCHITECTURE SCROLLY
 * Blueprint Layout with Angular Strands & Liquid Nodes
 */

document.addEventListener('DOMContentLoaded', () => {
    gsap.registerPlugin(ScrollTrigger);

    const container = document.querySelector('.detection-blueprint-container');
    const centerpiece = document.querySelector('.centerpiece-area');
    const liquid = document.querySelector('.liquid-fill');
    const nodes = gsap.utils.toArray('.node');
    const cards = gsap.utils.toArray('.flank-card');
    const labels = gsap.utils.toArray('.model-label');
    const footer = document.querySelector('.blueprint-footer');

    // Master Timeline
    const mainTl = gsap.timeline({
        scrollTrigger: {
            trigger: container,
            start: "top top",
            end: "+=300%",
            pin: true,
            scrub: true
        }
    });

    // Phase 1: Centerpiece Entrance & Binary
    mainTl.to(centerpiece, {
        opacity: 1,
        scale: 1,
        duration: 1,
        ease: "power2.out"
    }, 0);

    // Phase 2: Left Flank (Timeline & Cards)
    mainTl.to(liquid, {
        height: "100%",
        duration: 1.5,
        ease: "none",
        onUpdate: function () {
            const h = parseFloat(liquid.style.height);
            if (h > 5) nodes[0].classList.add('active');
            if (h > 95) nodes[1].classList.add('active');
        }
    }, 0.5);

    mainTl.to(cards, {
        opacity: 1,
        x: 0,
        stagger: 0.3,
        duration: 1,
        ease: "back.out(1.5)"
    }, 0.8);

    // Phase 3: Neural Strands Drawing (Timed with labels)
    const strands = gsap.utils.toArray('.circuit-trace');

    mainTl.to(strands, {
        strokeDashoffset: 0,
        opacity: 1,
        stagger: 0.1,
        duration: 2,
        ease: "power2.inOut"
    }, 1.2);

    const labelWrappers = gsap.utils.toArray('.label-with-terminal');

    mainTl.to(labelWrappers, {
        opacity: 1,
        x: 0,
        stagger: 0.1,
        duration: 0.5,
        onComplete: () => {
            labels.forEach(l => l.classList.add('active'));
        }
    }, 2.5);

    // Phase 4: Footer Action
    mainTl.to(footer, {
        opacity: 1,
        bottom: "60px",
        duration: 0.5
    }, 2.8);

    // --- REFINE: Try Detection Button & Laser Transition ---
    const tryBtn = document.querySelector('.try-detection-btn');
    const instantLaser = document.querySelector('.instant-laser');

    if (tryBtn) {
        tryBtn.addEventListener('click', () => {
            const tl = gsap.timeline();

            // 1. Instant Laser Sweep Up and Down (Slower)
            tl.to(instantLaser, {
                opacity: 1,
                bottom: "100%",
                duration: 0.6,
                ease: "power2.inOut"
            })
                .to(instantLaser, {
                    bottom: "-10px",
                    duration: 0.5,
                    ease: "power2.inOut"
                });

            // 2. White Flash & Redirect
            gsap.to(container, {
                backgroundColor: "#ffffff",
                duration: 0.1
            });

            setTimeout(() => {
                window.location.href = "detection.html";
            }, 1200);
        });
    }

    // --- REFINE: Mouse-Responsive & Bottom-Originating Dust ---
    const createDust = () => {
        for (let i = 0; i < 40; i++) {
            const dust = document.createElement('div');
            dust.className = 'blueprint-dust';
            const size = Math.random() * 4 + 2;

            // Start from random positions or bottom
            Object.assign(dust.style, {
                width: `${size}px`,
                height: `${size}px`,
                background: 'rgba(0, 242, 255, 0.6)',
                borderRadius: '50%',
                left: `${Math.random() * 100}%`,
                top: `${90 + Math.random() * 10}%`, // Start even lower
                opacity: "0",
                position: 'absolute'
            });
            container.appendChild(dust);

            // Floating upward movement
            gsap.to(dust, {
                y: `-${Math.random() * 800 + 400}`, // Float higher
                x: `random(-100, 100)`,
                opacity: 1,
                duration: Math.random() * 12 + 8,
                repeat: -1,
                ease: "sine.inOut",
                delay: Math.random() * 10
            });

            // Random blinking
            gsap.to(dust, {
                opacity: 0.2,
                duration: Math.random() * 3 + 1,
                repeat: -1,
                yoyo: true,
                ease: "power1.inOut"
            });
        }
    };
    createDust();

    // Parallax Dust (Mouse Reactivity)
    window.addEventListener('mousemove', (e) => {
        const xPercent = (e.clientX / window.innerWidth - 0.5);
        const yPercent = (e.clientY / window.innerHeight - 0.5);

        gsap.to('.blueprint-dust', {
            x: (i, target) => `+=${xPercent * 50}`,
            y: (i, target) => `+=${yPercent * 50}`,
            duration: 2,
            ease: "power2.out",
            overwrite: "auto"
        });
    });
});
