const API_URL = ""; // Use relative paths for same-origin robustness

// ── File input drop zones ──────────────────────────────────────────────────
document.querySelectorAll('.upload-area').forEach(area => {
    const input = area.querySelector('input');
    area.addEventListener('click', () => input.click());
    input.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            area.querySelector('p').innerText = `Selected: ${e.target.files[0].name}`;
        }
    });
});

// ── Stats helper ───────────────────────────────────────────────────────────
async function trackStat(module, mediaType, label = '') {
    try {
        await fetch(`${API_URL}/api/stats/increment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ module, media_type: mediaType, label })
        });
    } catch (e) {
        console.warn('Stat tracking failed:', e);
    }
}

// ── Image Detection ────────────────────────────────────────────────────────
let lastPrediction = null; // Store last prediction for feedback

async function analyzeImage() {
    const input = document.getElementById('image-input');
    if (!input.files[0]) return alert("Please upload an image");

    const formData = new FormData();
    formData.append('file', input.files[0]);

    document.getElementById('img-loader').style.display = 'block';
    document.getElementById('img-result').style.display = 'none';

    // Reset feedback UI
    const feedbackSection = document.getElementById('feedback-section');
    const feedbackResult = document.getElementById('feedback-result');
    const btnYes = document.getElementById('btn-feedback-yes');
    const btnNo = document.getElementById('btn-feedback-no');
    if (feedbackSection) feedbackSection.style.display = '';
    if (feedbackResult) feedbackResult.style.display = 'none';
    if (btnYes) { btnYes.style.display = ''; btnYes.disabled = false; }
    if (btnNo) { btnNo.style.display = ''; btnNo.disabled = false; }

    const modelType = document.getElementById('img-model-select').value;
    
    try {
        const res = await fetch(`${API_URL}/api/detection/predict/image?model_type=${modelType}`, {
            method: 'POST',
            body: formData
        });
        const data = await res.json();

        // Store prediction data for feedback
        lastPrediction = {
            label: data.label,
            probability: data.fake_probability,
            confidence: data.confidence,
            file: input.files[0]
        };

        // Preview original
        const reader = new FileReader();
        reader.onload = (e) => document.getElementById('preview-img').src = e.target.result;
        reader.readAsDataURL(input.files[0]);

        // Grad-CAM heatmap
        const gradcamBox = document.getElementById('gradcam-box');
        const gradcamImg = document.getElementById('gradcam-img');
        if (data.heatmap) {
            gradcamImg.src = `data:image/jpeg;base64,${data.heatmap}`;
            if (gradcamBox) gradcamBox.style.display = '';
        } else {
            gradcamImg.src = '';
            if (gradcamBox) gradcamBox.style.display = 'none';
        }

        const labelSpan = document.getElementById('img-with-pred');
        labelSpan.innerText = data.label;
        labelSpan.className = data.label === 'Real' ? 'label-real' : 'label-fake';

        document.getElementById('img-confidence').innerText = (data.confidence * 100).toFixed(2) + '%';
        document.getElementById('img-fake-prob').innerText = 'Fake Probability: ' + (data.fake_probability * 100).toFixed(2) + '%';
        
        // Render Breakdown
        console.log("Analysis Breakdown Data:", data.breakdown);
        const breakdown = data.breakdown || {};
        const breakdownArea = document.getElementById('analysis-breakdown');
        if (breakdownArea) {
            breakdownArea.style.display = 'block';
            
            const setBar = (id, val, show = true) => {
                const item = document.getElementById('bar-' + id)?.closest('.breakdown-item');
                if (!item) return;

                if (!show) {
                    item.style.display = 'none';
                    return;
                }
                item.style.display = 'flex';

                const bar = document.getElementById('bar-' + id);
                const text = document.getElementById('val-' + id);
                const status = document.getElementById('status-' + id);
                
                if (bar) bar.style.width = (val * 100) + '%';
                if (text) text.innerText = (val * 100).toFixed(1) + '%';
                
                if (status) {
                    const isFake = val >= 0.5;
                    status.innerText = isFake ? 'Fake' : 'Real';
                    status.className = 'status-label ' + (isFake ? 'status-fake' : 'status-real');
                }

                // Color coding
                if (bar) {
                    if (val > 0.6) bar.style.backgroundColor = 'var(--accent-red)';
                    else if (val > 0.4) bar.style.backgroundColor = 'var(--accent-yellow)';
                    else bar.style.backgroundColor = 'var(--accent-green)';
                }
            };
            
            setBar('b4', breakdown.neural_b4 || 0, modelType === 'ensemble' || modelType === 'efficientnet_b4');
            setBar('xc', breakdown.neural_xc || 0, modelType === 'ensemble' || modelType === 'xception');
            setBar('fft', breakdown.fft_score || 0);
            setBar('prnu', breakdown.prnu_score || 0);
        }

        document.getElementById('img-result').style.display = 'flex';

        // Track stats
        await trackStat('detection', 'image', data.label.toLowerCase());

    } catch (e) {
        alert("Error analyzing image");
        console.error(e);
    } finally {
        document.getElementById('img-loader').style.display = 'none';
    }
}

// ── User Feedback ──────────────────────────────────────────────────────────
async function submitFeedback(isCorrect) {
    if (!lastPrediction) return;

    const btnYes = document.getElementById('btn-feedback-yes');
    const btnNo = document.getElementById('btn-feedback-no');
    btnYes.disabled = true;
    btnNo.disabled = true;

    // Determine the true label based on user feedback
    const predictedLabel = lastPrediction.label;
    const trueLabel = isCorrect ? predictedLabel : (predictedLabel === 'Real' ? 'Fake' : 'Real');

    const formData = new FormData();
    formData.append('file', lastPrediction.file);
    formData.append('predicted_label', predictedLabel);
    formData.append('true_label', trueLabel);
    formData.append('fake_prob', lastPrediction.probability);
    formData.append('confidence', lastPrediction.confidence);

    try {
        const res = await fetch(`${API_URL}/api/detection/feedback`, {
            method: 'POST',
            body: formData
        });
        const data = await res.json();

        // Show result message
        const feedbackResult = document.getElementById('feedback-result');
        const feedbackMessage = document.getElementById('feedback-message');
        
        if (isCorrect) {
            feedbackMessage.innerHTML = '✅ Thanks! Your feedback confirms the model is working well.';
            feedbackMessage.className = 'feedback-success';
        } else {
            feedbackMessage.innerHTML = `✗ Got it — you indicated the image is actually <strong>${trueLabel}</strong>. This feedback will help improve future predictions.`;
            feedbackMessage.className = 'feedback-correction';
        }
        
        feedbackResult.style.display = 'block';
        btnYes.style.display = 'none';
        btnNo.style.display = 'none';

    } catch (e) {
        console.error("Feedback submission error:", e);
        alert("Failed to submit feedback. Please try again.");
        btnYes.disabled = false;
        btnNo.disabled = false;
    }
}


// ── Video Detection ────────────────────────────────────────────────────────
async function analyzeVideo() {
    const input = document.getElementById('video-input');
    if (!input.files[0]) return alert("Please upload a video");

    const formData = new FormData();
    formData.append('file', input.files[0]);

    document.getElementById('vid-loader').style.display = 'block';
    document.getElementById('vid-result').style.display = 'none';

    const modelType = document.getElementById('vid-model-select').value;

    try {
        const res = await fetch(`${API_URL}/api/detection/predict/video?model_type=${modelType}`, {
            method: 'POST',
            body: formData
        });
        const data = await res.json();

        const labelSpan = document.getElementById('vid-pred');
        labelSpan.innerText = data.label;
        labelSpan.className = data.label === 'Real' ? 'label-real' : 'label-fake';

        document.getElementById('vid-prob').innerText = (data.probability * 100).toFixed(2) + '% Fake Probability';
        
        // Render Video Breakdown
        const breakdown = data.breakdown || {};
        const breakdownArea = document.getElementById('video-analysis-breakdown');
        if (breakdownArea) {
            breakdownArea.style.display = 'block';
            const setBar = (id, val, show = true) => {
                const item = document.getElementById('v-bar-' + id)?.closest('.breakdown-item');
                if (!item) return;

                if (!show) {
                    item.style.display = 'none';
                    return;
                }
                item.style.display = 'flex';

                const bar = document.getElementById('v-bar-' + id);
                const text = document.getElementById('v-val-' + id);
                const status = document.getElementById('v-status-' + id);

                if (bar) bar.style.width = (val * 100) + '%';
                if (text) text.innerText = (val * 100).toFixed(1) + '%';
                
                if (status) {
                    const isFake = val >= 0.5;
                    status.innerText = isFake ? 'Fake' : 'Real';
                    status.className = 'status-label ' + (isFake ? 'status-fake' : 'status-real');
                }

                if (bar) {
                    if (val > 0.6) bar.style.backgroundColor = 'var(--accent-red)';
                    else if (val > 0.4) bar.style.backgroundColor = 'var(--accent-yellow)';
                    else bar.style.backgroundColor = 'var(--accent-green)';
                }
            };
            setBar('b4', breakdown.neural_b4 || 0, modelType === 'ensemble' || modelType === 'efficientnet_b4');
            setBar('xc', breakdown.neural_xc || 0, modelType === 'ensemble' || modelType === 'xception');
            setBar('fft', breakdown.fft_score || 0);
            setBar('prnu', breakdown.prnu_score || 0);
        }

        document.getElementById('vid-result').style.display = 'flex';

        // Track stats
        await trackStat('detection', 'video', data.label.toLowerCase());

    } catch (e) {
        alert("Error analyzing video");
        console.error(e);
    } finally {
        document.getElementById('vid-loader').style.display = 'none';
    }
}

// ── Image Generation ───────────────────────────────────────────────────────
let timerInterval = null;
let startTime = 0;
let lastT2ISeeds = [];
let lastI2ISeeds = [];

function startTimer() {
    const timerEl = document.getElementById('gen-timer');
    if (timerEl) {
        timerEl.style.display = 'inline';
        startTime = performance.now();
        timerInterval = setInterval(() => {
            const elapsed = (performance.now() - startTime) / 1000;
            timerEl.innerText = elapsed.toFixed(1) + 's';
        }, 100);
    }
}

function stopTimer() {
    if (timerInterval) clearInterval(timerInterval);
    const timerEl = document.getElementById('gen-timer');
    if (timerEl) {
        timerEl.classList.add('finished');
    }
}

async function stopGeneration() {
    const btnStop = document.getElementById('btn-stop');
    if (btnStop) {
        btnStop.innerText = 'Stopping...';
        btnStop.disabled = true;
    }
    try {
        await fetch(`${API_URL}/api/generation/stop`, { method: 'POST' });
        // The generateImage fetch promise will resolve with "interrupted"
    } catch (e) {
        console.error("Failed to call stop generation API:", e);
    }
}

async function populateModels() {
    console.log("Populating models...");
    const select = document.getElementById('model-select');
    if (!select) return;

    try {
        const res = await fetch(`${API_URL}/api/generation/models`);
        const models = await res.json();
        console.log("Fetched models:", models);
        select.innerHTML = '';
        for (const [key, info] of Object.entries(models)) {
            const opt = document.createElement('option');
            opt.value = key;
            opt.innerText = info.label;
            if (key === 'quality') opt.selected = true;
            select.appendChild(opt);
        }
    } catch (e) {
        console.error('Failed to load models:', e);
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Content Loaded - Initializing...");
    populateModels();
});

async function generateImage() {
    const prompt = document.getElementById('prompt-input').value;
    if (!prompt) return alert("Enter a prompt");

    const modelKey = document.getElementById('model-select')?.value || 'quality';

    const multiGen = document.getElementById('t2i-multi-gen')?.checked || false;
    const upscale = document.getElementById('t2i-upscale')?.checked || false;
    const enhancePrompt = document.getElementById('t2i-enhance')?.checked || false;
    const seedInput = document.getElementById('t2i-seed');
    const negativePromptInput = document.getElementById('negative-prompt');
    const seed = seedInput?.value ? parseInt(seedInput.value) : null;
    const negativePrompt = negativePromptInput?.value || "";

    const formData = new FormData(); // Initialize formData
    formData.append('prompt', prompt);
    formData.append('model_key', modelKey);
    formData.append('multi_gen', multiGen);
    formData.append('upscale', upscale);
    formData.append('enhance_prompt', enhancePrompt);
    if (seed !== null) formData.append('seed', seed);
    if (negativePrompt) formData.append('negative_prompt', negativePrompt);

    const loader = document.getElementById('gen-loader');
    const resultBox = document.getElementById('gen-result');
    const container = document.getElementById('gen-images-container');
    const btnGen = document.getElementById('btn-generate');
    const btnStop = document.getElementById('btn-stop');
    const stepCounter = document.getElementById('step-counter');

    if (loader) loader.style.display = 'block';
    if (resultBox) resultBox.style.display = 'none';
    if (container) {
        container.innerHTML = ''; // Clear old results
        // Create persistent slots if multi-gen
        const count = multiGen ? 3 : 1;
        for (let i = 0; i < count; i++) {
            const box = document.createElement('div');
            box.className = (modelKey === 'quality') ? 'preview-box-container' : 'preview-box';
            box.id = `preview-slot-${i}`;
            
            if (modelKey === 'quality') {
                const base = document.createElement('canvas');
                base.className = 'preview-canvas base-layer';
                base.id = `base-canvas-${i}`;
                base.width = 512; base.height = 512; // Standard SD 1.5 size
                
                const mask = document.createElement('canvas');
                mask.className = 'preview-canvas mask-overlay';
                mask.id = `mask-canvas-${i}`;
                mask.width = 512; mask.height = 512;
                
                const interaction = document.createElement('canvas');
                interaction.className = 'preview-canvas interaction-layer';
                interaction.id = `interaction-canvas-${i}`;
                interaction.width = 512; interaction.height = 512;
                
                box.appendChild(base);
                box.appendChild(mask);
                box.appendChild(interaction);
                
                inpaintManager.attachToCanvas(box);
            } else {
                const img = document.createElement('img');
                img.id = `img-preview-${i}`;
                box.appendChild(img);
            }
            container.appendChild(box);
        }
    }
    if (btnGen) btnGen.style.display = 'none';
    if (btnStop) btnStop.style.display = 'inline-block';
    if (stepCounter) { stepCounter.style.display = 'block'; stepCounter.innerText = 'Initializing...'; }
    
    startTimer();

    try {
        const response = await fetch(`${API_URL}/api/generation/generate/image`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) throw new Error("Server responded with " + response.status);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop(); // Keep the last incomplete line

            for (const line of lines) {
                if (!line.trim()) continue;
                try {
                    const event = JSON.parse(line);
                    const idx = event.index !== undefined ? event.index : 0;
                    const total = event.total || (multiGen ? 3 : 1);

                    if (event.type === 'image_start') {
                        if (stepCounter) stepCounter.innerText = `Generating Image ${idx + 1}/${total}...`;
                        if (resultBox) resultBox.style.display = 'flex';
                    } else if (event.type === 'preview_step' || event.type === 'image_complete') {
                        const { step, total_steps, preview } = event.data || {};
                        const b64 = event.type === 'image_complete' ? event.image : preview;
                        
                        if (stepCounter && event.type === 'preview_step') {
                            stepCounter.innerText = `Generating Image ${idx + 1}/${total} — Step ${step}/${total_steps}`;
                        }
                        
                        if (b64) {
                            if (modelKey === 'quality') {
                                const canvas = document.getElementById(`base-canvas-${idx}`);
                                if (canvas) {
                                    const ctx = canvas.getContext('2d');
                                    const img = new Image();
                                    img.onload = () => {
                                        ctx.clearRect(0, 0, canvas.width, canvas.height);
                                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                                        // Once first image is complete, show the toolbar if SD 1.5
                                        if (event.type === 'image_complete' && idx === 0) {
                                            inpaintManager.showToolbar();
                                        }
                                    };
                                    img.src = `data:image/png;base64,${b64}`;
                                }
                            } else {
                                const img = document.getElementById(`img-preview-${idx}`);
                                if (img) img.src = `data:image/png;base64,${b64}`;
                            }
                        }
                    } else if (event.type === 'upscale_progress') {
                        // Final summary
                        lastT2ISeeds = event.seeds || [];
                        if (lastT2ISeeds.length > 0 && seedInput) {
                            seedInput.value = lastT2ISeeds[0];
                        }
                        // Images are already updated via image_complete events
                    } else if (event.type === 'error') {
                        throw new Error(event.message);
                    } else if (event.type === 'interrupted') {
                        alert("Generation stopped.");
                        return;
                    }
                } catch (pe) {
                    console.warn("Failed to parse event line:", line, pe);
                }
            }
        }

        // Track stats
        await trackStat('generation', 'image');

    } catch (e) {
        alert("Error generating image: " + e.message);
    } finally {
        stopTimer();
        if (loader) loader.style.display = 'none';
        if (btnGen) btnGen.style.display = 'inline-block';
        if (stepCounter) stepCounter.style.display = 'none';
        if (btnStop) {
            btnStop.style.display = 'none';
            btnStop.innerText = 'Stop'; // Reset text for next time
            btnStop.disabled = false;
        }
    }
}

// ── Seed Control Helpers ───────────────────────────────────────────────────
function regenerateSameSeed() {
    // Current seed in input will be used
    generateImage();
}

function variationGeneration() {
    const seedInput = document.getElementById('t2i-seed');
    if (seedInput && seedInput.value) {
        const currentSeed = parseInt(seedInput.value);
        const offset = Math.floor(Math.random() * 10000) + 1;
        seedInput.value = currentSeed + offset;
    }
    generateImage();
}

// ── Image-to-Image (ControlNet) ────────────────────────────────────────────

let i2iTimerInterval = null;

function selectStyle(card) {
    // Deselect all, then mark clicked
    document.querySelectorAll('.i2i-style-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');

    const prompt = card.getAttribute('data-prompt');
    document.getElementById('i2i-prompt').value = prompt;
    
    // Update default strength based on selected style
    const strength = card.getAttribute('data-strength');
    if (strength) {
        document.getElementById('i2i-strength').value = strength;
        document.getElementById('i2i-strength-val').innerText = parseFloat(strength).toFixed(2);
    }

    const display = document.getElementById('i2i-selected-prompt');
    // Hide the prompt text as requested by the user, only keep it in the hidden input
    display.style.display = 'none';
}

async function stopI2IGeneration() {
    const btnStop = document.getElementById('btn-i2i-stop');
    if (btnStop) {
        btnStop.innerText = 'Stopping…';
        btnStop.disabled = true;
    }
    try {
        await fetch(`${API_URL}/api/generation/stop`, { method: 'POST' });
    } catch (e) {
        console.error('Failed to call stop API:', e);
    }
}

async function generateImageFromImage() {
    const fileInput = document.getElementById('i2i-image-input');
    const prompt    = document.getElementById('i2i-prompt').value;
    const strength  = parseFloat(document.getElementById('i2i-strength').value);

    if (!fileInput.files[0]) return alert('Please upload an image first.');
    if (!prompt)             return alert('Please select a style card first.');

    const multiGen = document.getElementById('i2i-multi-gen')?.checked || false;
    const upscale = document.getElementById('i2i-upscale')?.checked || false;
    const enhancePrompt = document.getElementById('i2i-enhance')?.checked || false;
    const seedInput = document.getElementById('i2i-seed');
    const seed = seedInput?.value ? parseInt(seedInput.value) : null;

    const formData = new FormData(); // Initialize formData
    formData.append('image',    fileInput.files[0]);
    formData.append('prompt',   prompt);
    formData.append('strength', strength);
    formData.append('multi_gen', multiGen);
    formData.append('upscale', upscale);
    formData.append('enhance_prompt', enhancePrompt);
    if (seed !== null) formData.append('seed', seed);

    const loader   = document.getElementById('i2i-loader');
    const result   = document.getElementById('i2i-result');
    const container = document.getElementById('i2i-images-container');
    const btnGen   = document.getElementById('btn-i2i-generate');
    const btnStop  = document.getElementById('btn-i2i-stop');
    const timerEl  = document.getElementById('i2i-timer');

    // UI: loading state
    if (loader)  loader.style.display  = 'block';
    if (result)  result.style.display  = 'none';
    if (container) {
        container.innerHTML = '';
        const count = multiGen ? 3 : 1;
        for (let i = 0; i < count; i++) {
            const box = document.createElement('div');
            box.className = 'preview-box';
            box.id = `i2i-preview-slot-${i}`;
            const img = document.createElement('img');
            img.id = `i2i-img-preview-${i}`;
            box.appendChild(img);
            container.appendChild(box);
        }
    }
    if (btnGen)  btnGen.style.display  = 'none';
    if (btnStop) { btnStop.style.display = 'inline-block'; btnStop.innerText = 'Stop'; btnStop.disabled = false; }
    
    const i2iStepCounter = document.getElementById('i2i-step-counter');
    if (i2iStepCounter) { i2iStepCounter.style.display = 'block'; i2iStepCounter.innerText = 'Initializing...'; }

    if (timerEl) {
        timerEl.style.display = 'inline';
        timerEl.classList.remove('finished');
        const t0 = performance.now();
        i2iTimerInterval = setInterval(() => {
            timerEl.innerText = ((performance.now() - t0) / 1000).toFixed(1) + 's';
        }, 100);
    }

    try {
        const response = await fetch(`${API_URL}/api/generation/img2img`, { method: 'POST', body: formData });
        if (!response.ok) throw new Error("Server responded with " + response.status);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();

            for (const line of lines) {
                if (!line.trim()) continue;
                try {
                    const event = JSON.parse(line);
                    const idx = event.index !== undefined ? event.index : 0;
                    const total = event.total || (multiGen ? 3 : 1);

                    if (event.type === 'image_start') {
                        if (i2iStepCounter) i2iStepCounter.innerText = `Generating Image ${idx + 1}/${total}...`;
                        if (result) result.style.display = 'flex';
                    } else if (event.type === 'preview_step' || event.type === 'image_complete') {
                        const { step, total_steps, preview } = event.data || {};
                        const b64 = event.type === 'image_complete' ? event.image : preview;
                        
                        if (i2iStepCounter && event.type === 'preview_step') {
                            i2iStepCounter.innerText = `Generating Image ${idx + 1}/${total} — Step ${step}/${total_steps}`;
                        }
                        
                        if (b64) {
                            // I2I currently uses simple IMG tags in all cases for simplicity,
                            // but if high-quality SD 1.5 is selected we might want layered canvases too?
                            // The user said "in image to image it should appear immediately"
                            // For now let's assume I2I results stay images unless they need inpainting too.
                            // If they need inpainting, they should be in the T2I area or we should unify.
                            const img = document.getElementById(`i2i-img-preview-${idx}`);
                            if (img) img.src = `data:image/png;base64,${b64}`;
                        }
                    } else if (event.type === 'upscale_progress') {
                        lastI2ISeeds = event.seeds || [];
                        if (lastI2ISeeds.length > 0 && seedInput) {
                            seedInput.value = lastI2ISeeds[0];
                        }
                    } else if (event.type === 'error') {
                        throw new Error(event.message);
                    } else if (event.type === 'interrupted') {
                        alert("Generation stopped.");
                        return;
                    }
                } catch (pe) {
                    console.warn("Failed to parse event line:", line, pe);
                }
            }
        }

        await trackStat('generation', 'image');

    } catch (e) {
        alert('Error generating image: ' + e.message);
        console.error(e);
    } finally {
        clearInterval(i2iTimerInterval);
        if (timerEl) timerEl.classList.add('finished');
        if (loader)  loader.style.display  = 'none';
        if (btnGen)  btnGen.style.display  = 'inline-block';
        if (i2iStepCounter) i2iStepCounter.style.display = 'none';
        if (btnStop) { btnStop.style.display = 'none'; btnStop.innerText = 'Stop'; btnStop.disabled = false; }
    }
}
function regenerateSameSeedI2I() {
    generateImageFromImage();
}

function variationGenerationI2I() {
    const seedInput = document.getElementById('i2i-seed');
    if (seedInput && seedInput.value) {
        const currentSeed = parseInt(seedInput.value);
        const offset = Math.floor(Math.random() * 10000) + 1;
        seedInput.value = currentSeed + offset;
    }
    generateImageFromImage();
}

// ── Video Filter / Generation ──────────────────────────────────────────────
async function applyFilter() {
    const input = document.getElementById('filter-video-input');
    const type = document.getElementById('filter-type').value;
    if (!input.files[0]) return alert("Please upload a video");

    const formData = new FormData();
    formData.append('file', input.files[0]);
    formData.append('filter_type', type);

    document.getElementById('filter-loader').style.display = 'block';
    document.getElementById('filter-result').style.display = 'none';

    try {
        const res = await fetch(`${API_URL}/api/generation/filter/video`, {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        const link = document.getElementById('filter-download');
        link.href = `${API_URL}${data.video_url}`;

        const video = document.getElementById('filter-video-preview');
        video.src = `${API_URL}${data.video_url}`;
        video.style.display = 'block';

        document.getElementById('filter-result').style.display = 'flex';

        // Track stats
        await trackStat('generation', 'video');

    } catch (e) {
        alert("Error processing video: " + e.message);
    } finally {
        document.getElementById('filter-loader').style.display = 'none';
    }
}

// ── Generation History Modal ────────────────────────────────────────────────
// ── Inpainting Manager ──────────────────────────────────────────────────────
class InpaintingManager {
    constructor() {
        this.active = false;
        this.toolbar = document.getElementById('inpainting-toolbar');
        this.promptPanel = document.getElementById('inpaint-prompt-panel');
        this.currentTool = 'hand';
        this.isDraggingToolbar = false;
        this.isDrawing = false;
        this.startPos = { x: 0, y: 0 };
        this.endPos = { x: 0, y: 0 };
        this.toolbarPos = { x: 50, y: 100 };
        
        // Active canvas context
        this.activeMaskCtx = null;
        this.activeInteractionCtx = null;
        this.activeBaseCanvas = null;

        this.init();
    }

    init() {
        const header = document.getElementById('toolbar-drag-handle');
        header.addEventListener('mousedown', (e) => {
            if (e.target.id === 'toolbar-close') return;
            this.isDraggingToolbar = true;
            this.dragStart = { x: e.clientX, y: e.clientY };
            document.body.style.userSelect = 'none';
        });

        window.addEventListener('mousemove', (e) => {
            if (this.isDraggingToolbar) {
                const dx = e.clientX - this.dragStart.x;
                const dy = e.clientY - this.dragStart.y;
                this.dragStart = { x: e.clientX, y: e.clientY };
                const rect = this.toolbar.getBoundingClientRect();
                this.toolbar.style.right = (window.innerWidth - rect.right - dx) + 'px';
                this.toolbar.style.top = (rect.top + dy) + 'px';
            }
        });

        window.addEventListener('mouseup', () => {
            this.isDraggingToolbar = false;
            document.body.style.userSelect = '';
        });

        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentTool = btn.id.replace('tool-', '');
                this.updateInteractionCursor();
            });
        });

        document.getElementById('toolbar-close').addEventListener('click', () => this.hideToolbar());

        const modelSelect = document.getElementById('model-select');
        if (modelSelect) {
            modelSelect.addEventListener('change', () => {
                if (modelSelect.value !== 'quality') {
                    this.hideToolbar();
                    document.getElementById('i2i-upload-container').style.display = 'none';
                }
            });
        }

        const i2iInput = document.getElementById('i2i-image-input');
        if (i2iInput) {
            i2iInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                
                const model = modelSelect?.value;
                const container = document.getElementById('i2i-upload-preview');
                const outer = document.getElementById('i2i-upload-container');
                
                if (model === 'quality') {
                    outer.style.display = 'block';
                    container.innerHTML = '';
                    
                    const base = document.createElement('canvas');
                    base.className = 'preview-canvas base-layer';
                    base.width = 512; base.height = 512;
                    
                    const mask = document.createElement('canvas');
                    mask.className = 'preview-canvas mask-overlay';
                    mask.width = 512; mask.height = 512;
                    
                    const it = document.createElement('canvas');
                    it.className = 'preview-canvas interaction-layer';
                    it.width = 512; it.height = 512;
                    
                    container.appendChild(base); container.appendChild(mask); container.appendChild(it);
                    
                    const ctx = base.getContext('2d');
                    const img = new Image();
                    img.onload = () => {
                        ctx.clearRect(0, 0, 512, 512);
                        ctx.drawImage(img, 0, 0, 512, 512);
                        this.showToolbar();
                    };
                    img.src = URL.createObjectURL(file);
                    this.attachToCanvas(container);
                } else {
                    outer.style.display = 'none';
                }
            });
        }
    }

    showToolbar() {
        this.active = true;
        this.toolbar.classList.remove('hidden');
    }

    hideToolbar() {
        this.active = false;
        this.toolbar.classList.add('hidden');
        this.promptPanel.classList.add('collapsed');
        this.clearAllMasks();
    }

    updateInteractionCursor() {
        document.querySelectorAll('.interaction-layer').forEach(l => {
            l.style.cursor = this.currentTool === 'hand' ? 'grab' : 'crosshair';
        });
    }

    attachToCanvas(container) {
        const interactionLayer = container.querySelector('.interaction-layer');
        const maskCanvas = container.querySelector('.mask-overlay');
        const baseCanvas = container.querySelector('.base-layer');
        const maskCtx = maskCanvas.getContext('2d');
        const itCtx = interactionLayer.getContext('2d');

        const getCoords = (e) => {
            const rect = interactionLayer.getBoundingClientRect();
            return {
                x: (e.clientX - rect.left) * (interactionLayer.width / rect.width),
                y: (e.clientY - rect.top) * (interactionLayer.height / rect.height)
            };
        };

        interactionLayer.addEventListener('mousedown', (e) => {
            if (!this.active) return;
            const rect = interactionLayer.getBoundingClientRect();
            const coords = getCoords(e);
            
            if (this.currentTool === 'hand') {
                this.isPanning = true;
                this.dragStart = { x: e.clientX, y: e.clientY };
                this.initialTransform = this.getTransform(container);
                return;
            }

            this.isDrawing = true;
            this.startPos = coords;
            this.endPos = coords;
            itCtx.clearRect(0, 0, interactionLayer.width, interactionLayer.height);
            if (this.currentTool === 'free') { itCtx.beginPath(); itCtx.moveTo(coords.x, coords.y); }
            this.activeMaskCtx = maskCtx;
            this.activeInteractionCtx = itCtx;
            this.activeBaseCanvas = baseCanvas;
        });

        interactionLayer.addEventListener('mousemove', (e) => {
            if (this.isPanning) {
                const dx = e.clientX - this.dragStart.x;
                const dy = e.clientY - this.dragStart.y;
                container.style.transform = `translate(${this.initialTransform.x + dx}px, ${this.initialTransform.y + dy}px)`;
                return;
            }

            if (!this.isDrawing) return;
            const coords = getCoords(e);
            this.endPos = coords;
            itCtx.clearRect(0, 0, interactionLayer.width, interactionLayer.height);
            itCtx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            itCtx.setLineDash([5, 5]);
            itCtx.lineWidth = 2;

            if (this.currentTool === 'rect') {
                itCtx.strokeRect(this.startPos.x, this.startPos.y, coords.x - this.startPos.x, coords.y - this.startPos.y);
            } else if (this.currentTool === 'circle' || this.currentTool === 'ellipse') {
                const rx = Math.abs(coords.x - this.startPos.x);
                const ry = this.currentTool === 'circle' ? rx : Math.abs(coords.y - this.startPos.y);
                itCtx.beginPath(); itCtx.ellipse(this.startPos.x, this.startPos.y, rx, ry, 0, 0, Math.PI * 2); itCtx.stroke();
            } else if (this.currentTool === 'free') {
                itCtx.setLineDash([]); itCtx.lineTo(coords.x, coords.y); itCtx.stroke();
            }
        });

        window.addEventListener('mouseup', () => {
            if (this.isPanning) {
                this.isPanning = false;
            }
            if (this.isDrawing) {
                this.isDrawing = false;
                this.applySelectionToMask(this.endPos);
                this.promptPanel.classList.remove('collapsed');
            }
        });
    }

    getTransform(el) {
        const style = window.getComputedStyle(el);
        const transform = style.transform || style.webkitTransform;
        if (!transform || transform === 'none') return { x: 0, y: 0 };
        const matrix = transform.match(/matrix.*\((.+)\)/);
        if (matrix) {
            const values = matrix[1].split(', ');
            return { x: parseFloat(values[4]), y: parseFloat(values[5]) };
        }
        return { x: 0, y: 0 };
    }

    applySelectionToMask(endPos) {
        if (!this.activeMaskCtx) return;
        const ctx = this.activeMaskCtx;
        ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
        if (this.currentTool === 'rect') {
            ctx.fillRect(this.startPos.x, this.startPos.y, endPos.x - this.startPos.x, endPos.y - this.startPos.y);
        } else if (this.currentTool === 'circle' || this.currentTool === 'ellipse') {
            const rx = Math.abs(endPos.x - this.startPos.x);
            const ry = this.currentTool === 'circle' ? rx : Math.abs(endPos.y - this.startPos.y);
            ctx.beginPath(); ctx.ellipse(this.startPos.x, this.startPos.y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
        } else if (this.currentTool === 'free') {
            ctx.drawImage(this.activeInteractionCtx.canvas, 0, 0);
        }
        this.activeInteractionCtx.clearRect(0, 0, this.activeInteractionCtx.canvas.width, this.activeInteractionCtx.canvas.height);
    }

    clearAllMasks() {
        document.querySelectorAll('.mask-overlay').forEach(c => c.getContext('2d').clearRect(0, 0, c.width, c.height));
    }

    getMaskData() {
        if (!this.activeMaskCtx) return null;
        const canvas = this.activeMaskCtx.canvas;
        const offscreen = document.createElement('canvas');
        offscreen.width = canvas.width; offscreen.height = canvas.height;
        const osCtx = offscreen.getContext('2d');
        osCtx.fillStyle = 'black'; osCtx.fillRect(0, 0, offscreen.width, offscreen.height);
        const imgData = this.activeMaskCtx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;
        for(let i=0; i<data.length; i+=4) {
            if(data[i+3] > 0) { data[i]=255; data[i+1]=255; data[i+2]=255; data[i+3]=255; }
            else { data[i]=0; data[i+1]=0; data[i+2]=0; data[i+3]=255; }
        }
        osCtx.putImageData(imgData, 0, 0);
        return offscreen.toDataURL('image/png');
    }

    getBaseImageData() {
        if (!this.activeBaseCanvas) return null;
        return this.activeBaseCanvas.toDataURL('image/png');
    }
}

const inpaintManager = new InpaintingManager();

async function sendInpaintRequest() {
    const prompt = document.getElementById('inpaint-prompt').value;
    if (!prompt) return alert("Please enter a prompt for inpainting.");
    const baseImage = inpaintManager.getBaseImageData();
    const maskImage = inpaintManager.getMaskData();
    if (!baseImage || !maskImage) return alert("Please select a region first.");

    const seedInput = document.getElementById('t2i-seed');
    const blur = parseInt(document.getElementById('inpaint-blur').value);
    const strength = parseFloat(document.getElementById('inpaint-strength').value);
    const seed = seedInput?.value ? parseInt(seedInput.value) : null;

    const formData = new FormData();
    formData.append('image', await (await fetch(baseImage)).blob(), 'image.png');
    formData.append('mask', await (await fetch(maskImage)).blob(), 'mask.png');
    formData.append('prompt', prompt);
    formData.append('steps', 30);
    formData.append('guidance_scale', 7.5);
    formData.append('mask_blur', blur);
    if (seed !== null) formData.append('seed', seed);

    const loader = document.getElementById('gen-loader');
    const btnInpaint = document.getElementById('btn-inpaint-send');
    if (loader) loader.style.display = 'block';
    if (btnInpaint) btnInpaint.disabled = true;

    try {
        const res = await fetch(`${API_URL}/api/generation/inpaint`, { method: 'POST', body: formData });
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();
            for (const line of lines) {
                if (!line.trim()) continue;
                const event = JSON.parse(line);
                if (event.type === 'image_complete' || event.type === 'preview_step') {
                    const b64 = event.image || event.data?.preview;
                    if (b64) {
                        const img = new Image();
                        img.onload = () => inpaintManager.activeBaseCanvas.getContext('2d').drawImage(img, 0, 0, inpaintManager.activeBaseCanvas.width, inpaintManager.activeBaseCanvas.height);
                        img.src = `data:image/png;base64,${b64}`;
                    }
                }
            }
        }
    } catch (e) { alert("Inpainting error: " + e.message); }
    finally {
        if (loader) loader.style.display = 'none';
        if (btnInpaint) btnInpaint.disabled = false;
        inpaintManager.promptPanel.classList.add('collapsed');
        inpaintManager.clearAllMasks();
    }
}

// ── Generation History Modal ────────────────────────────────────────────────
function openHistoryModal(data) {
    const modal = document.getElementById("history-modal");
    if (!modal) return;
    modal.classList.remove("hidden");
    document.getElementById("history-prompt").textContent = data.prompt || "—";
    document.getElementById("history-type").textContent = data.media_type || data.type || "N/A";
    document.getElementById("history-time").textContent = data.generation_time ? parseFloat(data.generation_time).toFixed(2) + 's' : "N/A";
    document.getElementById("history-timestamp").textContent = data.timestamp ? new Date(data.timestamp).toLocaleString() : "N/A";
    document.getElementById("history-seed").textContent = data.seed || "Random";
    const imgEl = document.getElementById("history-image");
    if (data.image_b64) imgEl.src = `data:image/png;base64,${data.image_b64}`;
    else if (data.image) imgEl.src = data.image;
    else imgEl.src = '';
    imgEl.style.display = imgEl.src ? 'block' : 'none';
}

document.addEventListener('DOMContentLoaded', () => {
    const closeBtn = document.getElementById("history-close");
    if (closeBtn) closeBtn.onclick = () => document.getElementById("history-modal").classList.add("hidden");
    const modal = document.getElementById("history-modal");
    if (modal) modal.onclick = (e) => { if (e.target === modal) modal.classList.add("hidden"); };
});
