/**
 * DETECTION SCROLLYTELLING
 * Logic for the forensic analysis sequence
 */

document.addEventListener('DOMContentLoaded', () => {
    gsap.registerPlugin(ScrollTrigger);

    const container = document.querySelector('.detection-scrolly-container');
    const pinSection = document.querySelector('#detection-pin-section');
    const mainImg = document.querySelector('#detection-main-image');
    const laser = document.querySelector('.scan-laser');
    const cards = gsap.utils.toArray('.glass-card');
    const statusLines = gsap.utils.toArray('.status-line');
    const connections = gsap.utils.toArray('.pulse-line');
    const circuitBg = document.querySelector('.circuit-bg');

    // Scramble character set
    const scrambleChars = "&%#$@*{}[]";

    // Master Timeline
    const tl = gsap.timeline({
        scrollTrigger: {
            trigger: container,
            start: "top top",
            end: "+=400%", // 4 phases, 100% each roughly
            pin: true,
            scrub: 2,
            onUpdate: (self) => {
                // Update nav blur if needed
                const nav = document.querySelector('.nav-wrapper');
                if (self.progress > 0.01) {
                    nav.classList.add('scrolled');
                } else {
                    nav.classList.remove('scrolled');
                }
            }
        }
    });

    // Phase 1: The Input (0 - 25%)
    tl.to(mainImg, {
        opacity: 1,
        scale: 1,
        filter: "blur(0px) brightness(1)",
        duration: 1,
        ease: "power2.out"
    }, 0);

    tl.to('.glitch-flash', {
        opacity: 0.3,
        duration: 0.1,
        repeat: 3,
        yoyo: true,
        ease: "none"
    }, 0.1);

    tl.to(statusLines[0], {
        className: "+=status-line active",
        duration: 0.2
    }, 0);

    // Phase 2: Neural Selection (25 - 50%)
    tl.to(cards, {
        x: 0,
        opacity: 1,
        stagger: 0.2,
        duration: 1,
        onStart: () => circuitBg.classList.add('glow'),
        onReverseComplete: () => circuitBg.classList.remove('glow')
    }, 1);

    tl.to(statusLines[0], { className: "status-line", duration: 0.2 }, 1);
    tl.to(statusLines[1], { className: "+=status-line active", duration: 0.2 }, 1);

    // SVG Pulse connection (simplified)
    tl.to(connections, {
        strokeDashoffset: 0,
        opacity: 1,
        stagger: 0.1,
        duration: 1
    }, 1.2);

    // Phase 3: The Active Scan (50 - 80%)
    tl.to(laser, {
        opacity: 1,
        top: "100%",
        duration: 2,
        ease: "none",
        onUpdate: function() {
            const progress = this.progress(); 
            // Trigger bounding boxes at specific progress levels
            if (progress > 0.3 && progress < 0.35) showBox(0);
            if (progress > 0.6 && progress < 0.65) showBox(1);
        }
    }, 2);

    function showBox(index) {
        const boxes = document.querySelectorAll('.detection-box');
        if (boxes[index]) {
            boxes[index].style.opacity = '1';
            const label = boxes[index].querySelector('.box-label');
            if (label && !label.dataset.scrambled) {
                scrambleText(label, label.innerText);
                label.dataset.scrambled = "true";
            }
        }
    }

    function scrambleText(element, final) {
        let count = 0;
        const interval = setInterval(() => {
            element.innerText = scrambleChars[Math.floor(Math.random() * scrambleChars.length)].repeat(final.length);
            if (count++ > 10) {
                clearInterval(interval);
                element.innerText = final;
            }
        }, 50);
    }

    // Phase 4: Diagnostic Output (80 - 100%)
    tl.to('.diagnostic-overlay', {
        opacity: 1,
        duration: 0.5
    }, 4);

    tl.to('.pinned-bottom-text', {
        opacity: 1,
        bottom: "60px",
        duration: 0.5
    }, 4.2);

    // Binary log background scrolling
    const binaryLog = document.querySelector('.binary-log');
    if (binaryLog) {
        let binaryStr = "";
        for(let i=0; i<500; i++) binaryStr += Math.round(Math.random()) + " ";
        binaryLog.innerText = binaryStr;
        
        gsap.to(binaryLog, {
            scrollTop: binaryLog.scrollHeight,
            duration: 10,
            repeat: -1,
            ease: "none"
        });
    }
});
