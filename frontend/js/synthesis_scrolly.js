/**
 * POLYGEN CHAPTER 3: SYNTHESIS & NEURAL VAULT
 * Final Fix: Footer Visibility & Scale-Through Logic
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

    // --- 2. AMBIENT ROTATION (Stable) ---
    gsap.to(hexShield, { rotation: 360, duration: 15, repeat: -1, ease: "none" });

    // --- 3. INITIAL STATES ---
    gsap.set([hexLeft, hexRight], { x: 0, opacity: 0 });
    gsap.set(hexShield, { scale: 0.8, opacity: 0, rotation: -180 });
    gsap.set(polyReveal, { opacity: 0, scale: 0.6, letterSpacing: "0.8em" });
    gsap.set(vaultCards, { opacity: 0, y: 400, rotateX: -45, scale: 0.8 });
    
    // FOOTER FIX: Ensure it is technically "visible" to the browser but hidden by opacity
    gsap.set(footerArea, { 
        opacity: 0, 
        y: 100, 
        display: "block", // Force it to exist in the layout
        position: "absolute",
        zIndex: 100 
    });

    // --- 4. MAIN SCROLLYTELLING TIMELINE ---
    const mainTl = gsap.timeline({
        scrollTrigger: {
            trigger: section,
            start: "top top",
            end: "+=250%", // Long scroll to prevent jumping
            pin: pinWrapper,
            scrub: 1.5,
            anticipatePin: 1
        }
    });

    mainTl
        // PHASE 1: STABLE REVEAL
        .addLabel('materialize')
        .to([hexLeft, hexRight], { opacity: 1, duration: 1.5 }, 'materialize')
        .to(hexShield, { opacity: 1, scale: 1, rotation: 0, duration: 1.5, ease: "back.out(1.4)" }, 'materialize')
        
        // PHASE 2: THE SPLIT
        .addLabel('split', '+=0.5')
        .to(hexLeft, { x: -220, rotationY: -35, duration: 2 }, 'split')
        .to(hexRight, { x: 220, rotationY: 35, duration: 2 }, 'split')
        .to(polyReveal, { opacity: 1, scale: 1, letterSpacing: "0.26em", duration: 1.5 }, 'split+=0.4')

        // PHASE 3: CARD STACK
        .addLabel('compress', '+=0.8')
        .to(logicCore, { y: "-45vh", scale: 0.65, duration: 2 }, 'compress')
        .addLabel('cards', '+=0.2')
        .to(vaultCards, {
            opacity: 1,
            y: (i) => (i * -35) + 50,
            rotateX: -10,
            scale: 1,
            stagger: 0.3,
            duration: 3
        }, 'cards')
        
        // PHASE 4: THE HYPER-EXIT (DISSOLVE CARDS & ZOOM CORE)
        .addLabel('exit', '+=4')
        .to(vaultCards, { opacity: 0, y: -200, filter: "blur(20px)", duration: 1.5 }, 'exit')
        .to(logicCore, { 
            scale: 12, // Extreme zoom
            opacity: 0, 
            y: "0vh",
            filter: "blur(50px)",
            duration: 4,
            ease: "power2.in" 
        }, 'exit+=0.5')

        // PHASE 5: REVEAL FOOTER (The Final Anchor)
        // PHASE 5: REVEAL FOOTER
.addLabel('footer-reveal', '-=1.5')
.to(footerArea, { 
    opacity: 1, 
    y: 0, 
    duration: 2.5,
    pointerEvents: "auto", // Make links clickable now
    ease: "expo.out"
}, 'footer-reveal');

// Add this at the end of your DOMContentLoaded listener

// 1. Slow Drift for the base grid
gsap.to(".synth-blueprint-grid-bg", {
    backgroundPosition: "0px -200px", // Moves up
    ease: "none",
    scrollTrigger: {
        trigger: ".synthesis-scrolly",
        start: "top top",
        end: "bottom bottom",
        scrub: true
    }
});

// 2. Faster Drift for the parallax grid
gsap.to(".synth-blueprint-parallax-grid", {
    backgroundPosition: "0px -500px", // Moves up faster
    ease: "none",
    scrollTrigger: {
        trigger: ".synthesis-scrolly",
        start: "top top",
        end: "bottom bottom",
        scrub: true
    }
});

    // Refresh ScrollTrigger to ensure height is calculated correctly
    window.addEventListener('load', () => ScrollTrigger.refresh());
});