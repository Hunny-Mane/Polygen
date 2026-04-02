const API_URL = ""; 

// Error reporting for easier debugging
window.onerror = function(msg, url, line, col, error) {
   console.error("Global Error Caught:", msg, "at", url, ":", line, ":", col, error);
   alert("JavaScript Error: " + msg + "\nLine: " + line);
   return false;
};

// ── File input drop zones (REFINED for Redesign) ───────────────────────────
document.querySelectorAll('.upload-area').forEach(area => {
    const input = area.querySelector('input');
    if (!area || !input) return;
    area.addEventListener('click', () => input.click());
    input.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            const file = e.target.files[0];
            const isVideo = file.type.startsWith('video/');
            const statusEl = document.getElementById('upload-status');
            if (statusEl) statusEl.innerText = file.name;

            // Redesign Sync: If video, enable video filter logic
            const btnGen = document.getElementById('btn-generate');
            if (btnGen) {
                btnGen.innerText = isVideo ? 'APPLY VIDEO FILTER' : 'GENERATE';
            }

            // Sync hidden inputs if any
            if (isVideo) {
                const vidInput = document.getElementById('filter-video-input');
                if (vidInput) {
                    const dt = new DataTransfer();
                    dt.items.add(file);
                    vidInput.files = dt.files;
                }
            }
        }
    });
});

// Dropdown UI Interaction: Add 'active-selection' on change
document.querySelectorAll('.model-select').forEach(sel => {
    sel.addEventListener('change', () => {
        sel.classList.add('active-selection');

        // Update description text
        const descId = sel.id === 'img-model-select' ? 'img-model-desc' : 'vid-model-desc';
        const descElem = document.getElementById(descId);
        if (descElem) {
            if (sel.value === 'ensemble') descElem.innerText = "Voting-based system: Best overall reliability";
            else if (sel.value === 'efficientnet_b4') descElem.innerText = "High feature extraction precision";
            else if (sel.value === 'xception') descElem.innerText = "Focus on detail-oriented deepfake detection";
        }

        setTimeout(() => sel.classList.remove('active-selection'), 1500); // Visual feedback pulse
    });
});


// ── Inpainting Manager (Moved to top to prevent ReferenceError) ──────────────
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
        if (header) {
            header.addEventListener('mousedown', (e) => {
                if (e.target.id === 'toolbar-close') return;
                this.isDraggingToolbar = true;
                this.dragStart = { x: e.clientX, y: e.clientY };
                document.body.style.userSelect = 'none';
            });
        }

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

        const tbClose = document.getElementById('toolbar-close');
        if (tbClose) tbClose.addEventListener('click', () => this.hideToolbar());

        const modelSelect = document.getElementById('model-select');
        if (modelSelect) {
            modelSelect.addEventListener('change', () => {
                if (modelSelect.value !== 'quality') {
                    this.hideToolbar();
                    const i2iOuter = document.getElementById('i2i-upload-container');
                    if (i2iOuter) i2iOuter.style.display = 'none';
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

                if (model === 'quality' && container && outer) {
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
                } else if (outer) {
                    outer.style.display = 'none';
                }
            });
        }
    }

    showToolbar() {
        if (!this.toolbar) return;
        this.active = true;
        this.toolbar.classList.remove('hidden');
    }

    hideToolbar() {
        if (!this.toolbar) return;
        this.active = false;
        this.toolbar.classList.add('hidden');
        if (this.promptPanel) this.promptPanel.classList.add('collapsed');
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
        if (!interactionLayer || !maskCanvas) return;
        
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

        const handleMouseUp = () => {
            if (this.isPanning) {
                this.isPanning = false;
            }
            if (this.isDrawing) {
                this.isDrawing = false;
                this.applySelectionToMask(this.endPos);
                if (this.promptPanel) this.promptPanel.classList.remove('collapsed');
            }
        };
        window.removeEventListener('mouseup', handleMouseUp);
        window.addEventListener('mouseup', handleMouseUp);
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
        document.querySelectorAll('.mask-overlay').forEach(c => {
            const ctx = c.getContext('2d');
            if (ctx) ctx.clearRect(0, 0, c.width, c.height);
        });
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
        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] > 0) { data[i] = 255; data[i + 1] = 255; data[i + 2] = 255; data[i + 3] = 255; }
            else { data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 255; }
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

// ── Timer helpers ──────────────────────────────────────────────────────────
let startTime = null;
let timerInterval = null;

function startTimer() {
    const timerEl = document.getElementById('gen-timer') || document.getElementById('i2i-timer');
    if (!timerEl) return;
    startTime = performance.now();
    timerEl.style.display = 'inline';
    timerEl.classList.remove('finished');
    timerInterval = setInterval(() => {
        timerEl.innerText = ((performance.now() - startTime) / 1000).toFixed(1) + 's';
    }, 100);
}

function stopTimer() {
    if (timerInterval) clearInterval(timerInterval);
    const timerEl = document.getElementById('gen-timer') || document.getElementById('i2i-timer');
    if (timerEl) timerEl.classList.add('finished');
}

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
let lastPrediction = null;

async function analyzeImage() {
    const input = document.getElementById('image-input');
    if (!input.files[0]) return alert("Please upload an image");

    const formData = new FormData();
    formData.append('file', input.files[0]);
    const modelType = document.getElementById('img-model-select').value;

    document.getElementById('img-loader').style.display = 'block';
    document.getElementById('img-result').style.display = 'none';

    try {
        const res = await fetch(`${API_URL}/api/detection/predict/image?model_type=${modelType}`, {
            method: 'POST',
            body: formData
        });
        const data = await res.json();

        // SYNCED: Using 'fake_prob' to match dashboard expectations
        lastPrediction = {
            label: data.label,
            fake_prob: data.fake_probability || data.fake_prob,
            confidence: data.confidence,
            file: input.files[0],
            type: 'image',
            heatmap: data.heatmap
        };

        // Preview original
        const reader = new FileReader();
        reader.onload = (e) => document.getElementById('preview-img').src = e.target.result;
        reader.readAsDataURL(input.files[0]);

        // Restore Grad-CAM heatmap
        const gradcamImg = document.getElementById('gradcam-img');
        if (data.heatmap && data.heatmap.length > 0) {
            console.log("Analysis: Grad-CAM heatmap received (B64 length: " + data.heatmap.length + ")");
            gradcamImg.src = `data:image/jpeg;base64,${data.heatmap}`;
            document.getElementById('gradcam-box').style.display = 'flex';
        } else {
            console.warn("Analysis: No Grad-CAM heatmap data in response.");
            document.getElementById('gradcam-box').style.display = 'none';
        }

        document.getElementById('img-with-pred').innerText = data.label;
        document.getElementById('img-with-pred').className = data.label === 'Real' ? 'label-real' : 'label-fake';
        document.getElementById('img-confidence').innerText = (data.confidence * 100).toFixed(2) + '%';
        document.getElementById('img-fake-prob').innerText = 'Fake Probability: ' + ((data.fake_probability || data.fake_prob) * 100).toFixed(2) + '%';

        // Render Bars
        renderForensicBars('img', data.breakdown || {}, modelType);

        document.getElementById('img-result').style.display = 'flex';
        document.getElementById('analysis-breakdown').style.display = 'block';
        await trackStat('detection', 'image', data.label.toLowerCase());

    } catch (e) {
        console.error("Forensic Error:", e);
    } finally {
        document.getElementById('img-loader').style.display = 'none';
    }
}

function renderForensicBars(prefix, breakdown, modelType) {
    // Prefix is 'img' for images, or anything else for video (video uses 'v-' prefix IDs)
    const p = (prefix === 'img') ? '' : 'v-';

    const setBar = (id, val, show = true) => {
        const barElem = document.getElementById(p + 'bar-' + id);
        const item = barElem?.closest('.breakdown-item');
        if (!item) return;

        // Use 'grid' to match style.css layout expectations
        item.style.display = show ? 'grid' : 'none';

        const text = document.getElementById(p + 'val-' + id);
        const status = document.getElementById(p + 'status-' + id);

        if (barElem) barElem.style.width = (val * 100) + '%';
        if (text) text.innerText = (val * 100).toFixed(1) + '%';

        if (status) {
            const isFake = val >= 0.5;
            status.innerText = isFake ? 'Fake' : 'Real';
            status.className = 'status-label ' + (isFake ? 'status-fake' : 'status-real');
        }

        // Apply forensic color coding
        if (barElem) {
            if (val > 0.6) barElem.style.backgroundColor = 'var(--accent-red)';
            else if (val > 0.4) barElem.style.backgroundColor = 'var(--accent-yellow)';
            else barElem.style.backgroundColor = 'var(--accent-green)';
        }
    };

    // Selection Logic:
    // Ensemble -> Show B4 & XC
    // EfficientNet -> Show Ensemble & XC
    // Xception -> Show Ensemble & B4
    if (modelType === 'ensemble') {
        setBar('ens', breakdown.neural_ensemble || 0, false);
        setBar('b4', breakdown.neural_b4 || 0, true);
        setBar('xc', breakdown.neural_xc || 0, true);
    } else if (modelType === 'efficientnet_b4') {
        setBar('ens', breakdown.neural_ensemble || 0, true);
        setBar('b4', breakdown.neural_b4 || 0, false);
        setBar('xc', breakdown.neural_xc || 0, true);
    } else if (modelType === 'xception') {
        setBar('ens', breakdown.neural_ensemble || 0, true);
        setBar('b4', breakdown.neural_b4 || 0, true);
        setBar('xc', breakdown.neural_xc || 0, false);
    }

    // Always show FFT and PRNU (Video only usually)
    if (prefix !== 'img') {
        setBar('fft', breakdown.fft_score || 0, true);
        setBar('prnu', breakdown.prnu_score || 0, true);
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

    // UI Feedback: Show loader, hide previous results
    document.getElementById('vid-loader').style.display = 'block';
    document.getElementById('vid-result').style.display = 'none';

    // Reset feedback UI for video section
    const vidFeedbackSection = document.getElementById('vid-feedback-section');
    const vidFeedbackResult = document.getElementById('vid-feedback-result');
    if (vidFeedbackSection) vidFeedbackSection.style.display = '';
    if (vidFeedbackResult) vidFeedbackResult.style.display = 'none';

    const modelType = document.getElementById('vid-model-select').value;

    try {
        const res = await fetch(`${API_URL}/api/detection/predict/video?model_type=${modelType}`, {
            method: 'POST',
            body: formData
        });
        const data = await res.json();

        // 1. Store prediction data for feedback tracking
        lastPrediction = {
            label: data.label,
            probability: data.probability,
            confidence: data.confidence || data.probability, // Fallback if confidence isn't explicit
            file: input.files[0],
            type: 'video'
        };

        // 2. Video Preview (Equivalent to original image preview)
        const videoPreview = document.getElementById('preview-vid');
        if (videoPreview) {
            videoPreview.src = URL.createObjectURL(input.files[0]);
            videoPreview.style.display = 'block';
        }

        // 3. Primary Results (Label and Confidence)
        const labelSpan = document.getElementById('vid-pred');
        labelSpan.innerText = data.label;
        labelSpan.className = data.label === 'Real' ? 'label-real' : 'label-fake';

        // Display Probability/Confidence
        const probDisplay = document.getElementById('vid-prob');
        if (probDisplay) {
            probDisplay.innerText = 'Fake Probability: ' + (data.probability * 100).toFixed(2) + '%';
        }

        const confDisplay = document.getElementById('vid-confidence');
        if (confDisplay && data.confidence) {
            confDisplay.innerText = (data.confidence * 100).toFixed(2) + '% Confidence';
        }

        // 4. Render Video Analysis Breakdown (Progress Bars)
        const breakdown = data.breakdown || {};
        const breakdownArea = document.getElementById('video-analysis-breakdown');

        if (breakdownArea) {
            breakdownArea.style.display = 'block';
            renderForensicBars('video', breakdown, modelType);
        }

        // Show the result container
        document.getElementById('vid-result').style.display = 'flex';

        // 5. Track stats globally
        await trackStat('detection', 'video', data.label.toLowerCase());

    } catch (e) {
        alert("Error analyzing video forensic data");
        console.error("Video Analysis Error:", e);
    } finally {
        document.getElementById('vid-loader').style.display = 'none';
    }
}

let multiGenResults = [null, null, null];
let currentViewIndex = 0;
let isMultiGenActive = false;
let currentSelectedStylePrompt = null; // Store style keywords internally
let lastT2ISeeds = [];
let lastI2ISeeds = [];

function changeSelectedGen(delta) {
    if (!isMultiGenActive) return;
    const newIdx = currentViewIndex + delta;
    if (newIdx >= 0 && newIdx < 3 && multiGenResults[newIdx] !== null) {
        currentViewIndex = newIdx;
        updateMultiGenUI();
    }
}

function updateMultiGenUI() {
    const mainImg = document.getElementById('generated-img');
    const counter = document.getElementById('gen-multi-counter');
    const btnPrev = document.getElementById('btn-prev-gen');
    const btnNext = document.getElementById('btn-next-gen');

    if (mainImg && multiGenResults[currentViewIndex]) {
        mainImg.src = multiGenResults[currentViewIndex];
    }

    if (isMultiGenActive) {
        if (counter) {
            counter.innerText = `${currentViewIndex + 1} / 3`;
            counter.style.display = 'block';
        }
        if (btnPrev) btnPrev.style.display = currentViewIndex > 0 ? 'flex' : 'none';
        if (btnNext) btnNext.style.display = (currentViewIndex < 2 && multiGenResults[currentViewIndex + 1] !== null) ? 'flex' : 'none';
    } else {
        if (counter) counter.style.display = 'none';
        if (btnPrev) btnPrev.style.display = 'none';
        if (btnNext) btnNext.style.display = 'none';
    }
}

function generateThreeImages() {
    handleGenerateClick(true);
}

async function stopGeneration() {
    const btnGen = document.getElementById('btn-generate');
    if (btnGen) {
        btnGen.innerHTML = '<span class="neu-loader" style="width:1rem;height:1rem;border-width:2px;display:inline-block;vertical-align:middle;"></span> STOPPING...';
        btnGen.disabled = true;
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
// ── Update Generation Status ──────────────────────────────────────────────
function updateGenStatus(text) {
    const stepCounter = document.getElementById('step-counter');
    if (stepCounter) stepCounter.innerText = text;
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Content Loaded - Initializing...");
    populateModels();

    // Asset Management: Listen for generation completions
    window.addEventListener('generation_complete', (e) => {
        addAssetToSidebar(e.detail);
    });

    // Real-time slider updates
    const syncSliderValue = (sliderId, valId, isFloat = true) => {
        const slider = document.getElementById(sliderId);
        const valDisplay = document.getElementById(valId);
        if (slider && valDisplay) {
            slider.addEventListener('input', (e) => {
                valDisplay.innerText = isFloat ? parseFloat(e.target.value).toFixed(2) : e.target.value;
            });
        }
    };

    syncSliderValue('i2i-strength', 'i2i-strength-val', true);
    syncSliderValue('inpaint-strength', 'inpaint-strength-val', true);
    syncSliderValue('inpaint-blur', 'inpaint-blur-val', false);

    // Model-based steps update
    const modelSelect = document.getElementById('model-select');
    const stepsInput = document.getElementById('t2i-steps');
    if (modelSelect && stepsInput) {
        modelSelect.addEventListener('change', () => {
            const model = modelSelect.value;
            if (model === 'quality') stepsInput.value = 25;
            else if (model === 'balanced') stepsInput.value = 17;
            else if (model === 'fast') stepsInput.value = 13;
        });
    }
});

function addAssetToSidebar(asset) {
    const grid = document.getElementById('assets-grid');
    if (!grid) return;

    const item = document.createElement('div');
    item.className = 'asset-item';

    if (asset.type === 'video') {
        const vid = document.createElement('video');
        vid.src = asset.url;
        vid.muted = true;
        vid.loop = true;
        item.appendChild(vid);
        item.onmouseenter = () => vid.play();
        item.onmouseleave = () => vid.pause();
    } else {
        const img = document.createElement('img');
        img.src = asset.url;
        item.appendChild(img);
    }

    item.onclick = () => {
        // Promote to stage
        if (asset.type === 'video') {
            document.getElementById('gen-result').style.display = 'none';
            const res = document.getElementById('filter-result');
            res.style.display = 'flex';
            document.getElementById('filter-video-preview').src = asset.url;
        } else {
            document.getElementById('filter-result').style.display = 'none';
            document.getElementById('gen-result').style.display = 'flex';
            document.getElementById('generated-img').src = asset.url;

            // If it's an image and model is quality, we might want to enable inpainting
            const modelSelect = document.getElementById('model-select');
            if (modelSelect.value === 'quality') {
                // Logic to swap canvas content...
            }
        }
    };

    grid.prepend(item);
}

// Unified Generate Wrapper
async function handleGenerateClick(forceMultiGen = false) {
    const btnGen = document.getElementById('btn-generate');
    // If already generating, act as a stop button
    if (btnGen && btnGen.classList.contains('btn-stop-active')) {
        return stopGeneration();
    }

    const input = document.getElementById('i2i-image-input');
    const file = input.files[0];
    if (!file) {
        // Fallback to text-to-image
        return generateImage(forceMultiGen);
    }

    if (file.type.startsWith('video/')) {
        document.getElementById('video-filter-group').style.display = 'block';
        return applyFilter();
    } else {
        document.getElementById('video-filter-group').style.display = 'none';
        return generateImageFromImage(forceMultiGen);
    }
}

// Update HTML button to use this if needed, but for now we'll just refine generateImage

async function generateImage(forceMultiGen = false) {
    const promptEl = document.getElementById('prompt-input');
    const prompt = promptEl ? promptEl.value : "";
    
    const modelSelect = document.getElementById('model-select');
    const modelKey = modelSelect ? modelSelect.value : 'quality';
    
    const multiGen = forceMultiGen;  // Driven by button, not a toggle
    
    const upscaleEl = document.getElementById('t2i-upscale');
    const upscale = upscaleEl ? upscaleEl.checked : false;
    
    const stepsEl = document.getElementById('t2i-steps');
    const steps = stepsEl ? parseInt(stepsEl.value) : 25;
    
    const enhanceEl = document.getElementById('t2i-enhance');
    const enhancePrompt = enhanceEl ? enhanceEl.checked : false;
    
    const seedInput = document.getElementById('t2i-seed');
    const seed = (seedInput && seedInput.value) ? parseInt(seedInput.value) : null;
    
    const negInput = document.getElementById('negative-prompt');
    const negative_prompt = negInput ? negInput.value : "";
    
    // NEW: Strength control for T2I (maps to CFG/Guidance)
    const strengthEl = document.getElementById('i2i-strength');
    const strength = strengthEl ? strengthEl.value : 0.75;

    if (!prompt) return alert("Please enter a prompt.");

    // Invisible style appending (Backend only)
    let finalPrompt = prompt;
    if (currentSelectedStylePrompt) {
        if (!finalPrompt.toLowerCase().includes(currentSelectedStylePrompt.toLowerCase())) {
            if (finalPrompt && !finalPrompt.endsWith(',')) finalPrompt += ', ';
            else if (finalPrompt) finalPrompt += ' ';
            finalPrompt += currentSelectedStylePrompt;
        }
    }

    const loader = document.getElementById('gen-loader');
    const resultBox = document.getElementById('gen-result');
    const container = document.getElementById('gen-images-container');
    const btnGen = document.getElementById('btn-generate');
    const btnStop = document.getElementById('btn-stop');
    const stagePh = document.getElementById('stage-placeholder');
    const stepCounter = document.getElementById('step-counter');
    const debugOverlay = document.getElementById('gen-debug-overlay');
    
    const statusContainer = document.getElementById('gen-status-container');
    const statusBarFill = document.getElementById('gen-status-bar-fill');
    const statusLabel = document.getElementById('gen-status-label');
    const statusSteps = document.getElementById('gen-status-steps');
    const filterRes = document.getElementById('filter-result');

    if (filterRes) filterRes.style.display = 'none';
    if (loader) loader.style.display = 'block';
    if (btnGen) {
        btnGen.innerHTML = '<span class="material-symbols-outlined" style="font-size: 1.1rem; vertical-align: middle;">stop</span>';
        btnGen.classList.add('btn-stop-active');
    }
    if (btnStop) { btnStop.style.display = 'inline-block'; btnStop.disabled = false; }
    if (debugOverlay) debugOverlay.innerText = "DEBUG: Requesting...";

    try {
        const formData = new FormData();
        formData.append('prompt', finalPrompt);
        formData.append('model_key', modelKey);
        formData.append('multi_gen', multiGen);
        formData.append('upscale', upscale);
        formData.append('enhance_prompt', enhancePrompt);
        formData.append('negative_prompt', negative_prompt);
        formData.append('strength', strength);
        formData.append('steps', steps);
        if (seed !== null) formData.append('seed', seed);

        startTimer();

        // Multi-gen state reset
        isMultiGenActive = multiGen;
        multiGenResults = [null, null, null];
        currentViewIndex = 0;
        updateMultiGenUI();

        const response = await fetch(`${API_URL}/api/generation/generate/image`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) throw new Error("Server error: " + response.status);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const p_lines = buffer.split('\n');
            buffer = p_lines.pop();

            for (const line of p_lines) {
                if (!line.trim()) continue;
                try {
                    const event = JSON.parse(line);
                    const idx = event.index !== undefined ? event.index : 0;
                    const total = event.total || (multiGen ? 3 : 1);

                    if (debugOverlay) debugOverlay.innerText = `DEBUG: Event ${event.type} [${idx}]`;

                    if (event.type === 'image_start') {
                        if (statusContainer) statusContainer.style.display = 'flex';
                        if (statusLabel) statusLabel.innerText = 'Generating';
                        if (statusBarFill) statusBarFill.style.width = '0%';
                        if (resultBox) resultBox.style.display = 'flex';
                        if (stagePh) stagePh.style.display = 'none';
                        // Always use the single-gen-box as the carousel (handles both single & multi)
                        const singleBox = document.getElementById('single-gen-box');
                        if (singleBox) singleBox.style.display = 'flex';
                        // Reset progress bar for new image in sequence
                        if (statusBarFill) statusBarFill.style.width = '0%';
                        if (statusSteps) statusSteps.innerText = multiGen ? `Image ${idx + 1} of ${total}` : '';
                        // When a new image starts generating in multi-gen, auto-advance view to it
                        if (multiGen) {
                            currentViewIndex = idx;
                            updateMultiGenUI();
                        }
                    } else if (event.type === 'preview_step' || event.type === 'image_complete') {
                        const { step, total_steps, preview } = event.data || {};
                        const b64 = (event.type === 'image_complete') ? event.image : preview;

                        if (debugOverlay) debugOverlay.innerText = `DEBUG: Received ${event.type} step=${step} size=${b64?.length || 0}`;

                        if (loader) loader.style.display = 'none';
                        if (event.type === 'preview_step' && statusSteps) {
                            statusSteps.innerText = `${step}/${total_steps}`;
                            if (statusBarFill) statusBarFill.style.width = `${(step/total_steps)*100}%`;
                        }

                        if (b64) {
                            // Previews are JPEG (from backend), Final is often PNG
                            const mime = (event.type === 'preview_step') ? 'image/jpeg' : 'image/png';
                            const dataUrl = `data:${mime};base64,${b64}`;
                            
                            // Store in results for carousel
                            multiGenResults[idx] = dataUrl;

                            const imgId = 'generated-img';
                            const imgTag = document.getElementById(imgId);
                            
                            if (imgTag && (currentViewIndex === idx || !multiGen)) {
                                imgTag.src = dataUrl;
                                imgTag.style.display = 'block';
                            }
                            
                            // Update UI if we just got a new image or final result
                            if (multiGen) {
                                if (event.type === 'image_complete' && currentViewIndex < idx) {
                                     // Optionally auto-advance if user hasn't moved? 
                                     // For now, just ensure UI buttons are updated
                                }
                                updateMultiGenUI();
                            }

                            if (modelKey === 'quality') {
                                const canvas = document.getElementById(`base-canvas-${idx}`);
                                if (canvas) {
                                    const ctx = canvas.getContext('2d');
                                    const imgLoader = new Image();
                                    imgLoader.onload = () => {
                                        ctx.clearRect(0, 0, canvas.width, canvas.height);
                                        ctx.drawImage(imgLoader, 0, 0, canvas.width, canvas.height);
                                        if (event.type === 'image_complete' && idx === 0) inpaintManager.showToolbar();
                                    };
                                    imgLoader.src = dataUrl;
                                }
                            }
                        }
                    } else if (event.type === 'upscale_progress') {
                        const { tile, total_tiles, label } = event.data || {};
                        if (statusLabel) statusLabel.innerText = label || 'Upscaling';
                        if (statusSteps) statusSteps.innerText = `Tile ${tile}/${total_tiles}`;
                        if (statusBarFill) {
                            const pct = total_tiles > 0 ? (tile / total_tiles) * 100 : 0;
                            statusBarFill.style.width = `${pct}%`;
                        }
                    } else if (event.type === 'error') {
                        throw new Error(event.message);
                    }
                } catch (pe) {
                    console.warn("JSON Parse Error:", pe);
                }
            }
        }

        await trackStat('generation', 'image');

        // Mirror to asset sidebar
        let finalSrc = document.getElementById('generated-img')?.src;
        if (multiGen) finalSrc = document.getElementById('img-preview-0')?.src;
        
        if (finalSrc && finalSrc.startsWith('data:')) {
            window.dispatchEvent(new CustomEvent('generation_complete', {
                detail: { url: finalSrc, type: 'image' }
            }));
        }

    } catch (e) {
        console.error("Generation Error:", e);
        alert("Generation Error: " + e.message);
    } finally {
        stopTimer();
        if (loader) loader.style.display = 'none';
        if (btnGen) {
            btnGen.innerHTML = 'GENERATE';
            btnGen.classList.remove('btn-stop-active');
            btnGen.disabled = false;
        }
        if (btnStop) btnStop.style.display = 'none';
        if (statusContainer) statusContainer.style.display = 'none';
    }
}

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
    const stylePrompt = card.getAttribute('data-prompt');
    const styleStrength = card.getAttribute('data-strength') || 0.75;
    
    // Toggle Logic: If already active, deselect it
    if (card.classList.contains('active')) {
        card.classList.remove('selected', 'active');
        currentSelectedStylePrompt = null;
        console.log(`[STYLE] Deselected style.`);
        return;
    }

    // Visual feedback: Deselect others, select this one
    document.querySelectorAll('.i2i-style-card, .style-chip').forEach(c => {
        c.classList.remove('selected', 'active');
    });
    card.classList.add('selected', 'active');
    currentSelectedStylePrompt = stylePrompt;

    // Update Strength Slider automatically (optional, but keep for usability)
    const strengthSlider = document.getElementById('i2i-strength');
    if (strengthSlider) {
        strengthSlider.value = styleStrength;
        const strengthVal = document.getElementById('i2i-strength-val');
        if (strengthVal) {
            strengthVal.innerText = parseFloat(styleStrength).toFixed(2);
        }
    }
    
    console.log(`[STYLE] Stored style: ${stylePrompt}, for backend-only appending.`);
}

async function stopI2IGeneration() {
    const btnGen = document.getElementById('btn-generate');
    if (btnGen) {
        btnGen.innerHTML = '<span class="neu-loader" style="width:1rem;height:1rem;border-width:2px;display:inline-block;vertical-align:middle;"></span> STOPPING...';
        btnGen.disabled = true;
    }
    try {
        await fetch(`${API_URL}/api/generation/stop`, { method: 'POST' });
    } catch (e) {
        console.error('Failed to call stop API:', e);
    }
}

async function generateImageFromImage(forceMultiGen = false) {
    const fileInput = document.getElementById('i2i-image-input');
    const promptEl = document.getElementById('prompt-input');
    const prompt = promptEl ? promptEl.value : "";
    const strengthEl = document.getElementById('i2i-strength');
    const strength = strengthEl ? parseFloat(strengthEl.value) : 0.75;

    if (!fileInput.files[0]) return alert('Please upload an image first.');
    if (!prompt && !currentSelectedStylePrompt) return alert('Please enter a prompt or select a style.');

    const multiGen = forceMultiGen;
    const upscaleEl = document.getElementById('t2i-upscale');
    const upscale = upscaleEl ? upscaleEl.checked : false;
    const enhancePromptEl = document.getElementById('t2i-enhance');
    const enhancePrompt = enhancePromptEl ? enhancePromptEl.checked : false;
    const stepsEl = document.getElementById('t2i-steps');
    const steps = stepsEl ? parseInt(stepsEl.value) : 25;
    const seedInput = document.getElementById('t2i-seed');
    const seed = seedInput?.value ? parseInt(seedInput.value) : null;

    // Invisible style appending (Backend only)
    let finalPrompt = prompt;
    if (currentSelectedStylePrompt) {
        if (!finalPrompt.toLowerCase().includes(currentSelectedStylePrompt.toLowerCase())) {
            if (finalPrompt && !finalPrompt.endsWith(',')) finalPrompt += ', ';
            else if (finalPrompt) finalPrompt += ' ';
            finalPrompt += currentSelectedStylePrompt;
        }
    }

    const formData = new FormData(); // Initialize formData
    formData.append('image', fileInput.files[0]);
    formData.append('prompt', finalPrompt);
    formData.append('strength', strength);
    formData.append('steps', steps);
    formData.append('multi_gen', multiGen);
    formData.append('upscale', upscale);
    formData.append('enhance_prompt', enhancePrompt);
    const negInput = document.getElementById('negative-prompt');
    const negative_prompt = negInput ? negInput.value : "";
    formData.append('negative_prompt', negative_prompt);
    if (seed !== null) formData.append('seed', seed);

    const loader = document.getElementById('gen-loader');
    const resultBox = document.getElementById('gen-result');
    const container = document.getElementById('gen-images-container');
    const btnGen = document.getElementById('btn-generate');
    const btnStop = document.getElementById('btn-stop');
    const timerEl = document.getElementById('i2i-timer');
    const stagePh = document.getElementById('stage-placeholder');
    const stepCounter = document.getElementById('step-counter');
    const statusContainer = document.getElementById('gen-status-container');
    const statusBarFill = document.getElementById('gen-status-bar-fill');
    const statusLabel = document.getElementById('gen-status-label');
    const statusSteps = document.getElementById('gen-status-steps');
    const filterRes = document.getElementById('filter-result');

    // UI: Show loader and prepare result box
    if (filterRes) filterRes.style.display = 'none';
    if (loader) loader.style.display = 'block';
    
    // T2I wait until 'image_start' event to show single-gen-box and hide stagePh.
    // Doing the same here prevents layout overlapping before generation starts.
    if (stepCounter) {
        stepCounter.style.display = 'block';
        stepCounter.innerText = 'Initializing...';
    }

    // Multi-gen state reset
    isMultiGenActive = multiGen;
    multiGenResults = [null, null, null];
    currentViewIndex = 0;
    updateMultiGenUI();

    const count = multiGen ? 3 : 1;
    
    if (btnGen) {
        btnGen.innerHTML = '<span class="material-symbols-outlined" style="font-size: 1.1rem; vertical-align: middle;">stop</span>';
        btnGen.classList.add('btn-stop-active');
    }
    if (btnStop) { btnStop.style.display = 'inline-block'; btnStop.innerText = 'Stop'; btnStop.disabled = false; }


    const i2iStepCounter = document.getElementById('i2i-step-counter');
    if (i2iStepCounter) { i2iStepCounter.style.display = 'block'; i2iStepCounter.innerText = 'Initializing...'; }

    startTimer();

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
                        if (statusContainer) statusContainer.style.display = 'flex';
                        if (statusLabel) statusLabel.innerText = 'Generating';
                        if (statusBarFill) statusBarFill.style.width = '0%';
                        if (stepCounter) stepCounter.innerText = `Generating Image ${idx + 1}/${total}...`;
                        if (resultBox) resultBox.style.display = 'flex';
                        if (stagePh) stagePh.style.display = 'none';

                        // Ensure single-box is visible for carousel
                        if (container) container.style.display = 'none';
                        const singleBox = document.getElementById('single-gen-box');
                        if (singleBox) singleBox.style.display = 'flex';

                    } else if (event.type === 'preview_step' || event.type === 'image_complete') {
                        const { step, total_steps, preview } = event.data || {};
                        const b64 = event.type === 'image_complete' ? event.image : preview;

                        // Update status bar for generation steps
                        if (statusContainer) statusContainer.style.display = 'flex';
                        if (event.type === 'preview_step' && statusSteps) {
                            if (statusLabel) statusLabel.innerText = 'Generating';
                            statusSteps.innerText = `${step}/${total_steps}`;
                            if (statusBarFill) statusBarFill.style.width = `${(step/total_steps)*100}%`;
                        }
                        if (i2iStepCounter && event.type === 'preview_step') {
                            i2iStepCounter.innerText = `Generating Image ${idx + 1}/${total} — Step ${step}/${total_steps}`;
                        }

                        if (b64) {
                            const mime = (event.type === 'preview_step') ? 'image/jpeg' : 'image/png';
                            const dataUrl = `data:${mime};base64,${b64}`;
                            
                            // Store in results for carousel
                            multiGenResults[idx] = dataUrl;

                            const imgId = 'generated-img';
                            const imgTag = document.getElementById(imgId);
                            
                            // Update if it's the current view
                            if (imgTag && (currentViewIndex === idx || !multiGen)) {
                                imgTag.src = dataUrl;
                                imgTag.style.display = 'block';
                            }

                            // Update UI if we just got a new image or final result
                            if (multiGen) {
                                updateMultiGenUI();
                            }
                        }
                    } else if (event.type === 'upscale_progress') {
                        const { tile, total_tiles, label } = event.data || {};
                        if (statusLabel) statusLabel.innerText = label || 'Upscaling';
                        if (statusSteps) statusSteps.innerText = `Tile ${tile}/${total_tiles}`;
                        if (statusBarFill) {
                            const pct = total_tiles > 0 ? (tile / total_tiles) * 100 : 0;
                            statusBarFill.style.width = `${pct}%`;
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

        // Mirror to asset sidebar
        const finalImg = document.getElementById('i2i-img-preview-0')?.src || document.getElementById('generated-img')?.src;
        if (finalImg) {
            window.dispatchEvent(new CustomEvent('generation_complete', {
                detail: { url: finalImg, type: 'image' }
            }));
        }
    } catch (e) {
        alert('Error generating image: ' + e.message);
        console.error(e);
    } finally {
        stopTimer();
        if (loader) loader.style.display = 'none';
        if (btnGen) {
            btnGen.innerHTML = 'GENERATE';
            btnGen.classList.remove('btn-stop-active');
            btnGen.disabled = false;
        }
        if (i2iStepCounter) i2iStepCounter.style.display = 'none';
        if (btnStop) { btnStop.style.display = 'none'; btnStop.innerText = 'Stop'; btnStop.disabled = false; }
        if (statusContainer) statusContainer.style.display = 'none';
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

    const btnGen = document.getElementById('btn-generate');
    if (btnGen) {
        btnGen.innerHTML = '<span class="material-symbols-outlined" style="font-size: 1.1rem; vertical-align: middle;">stop</span>';
        btnGen.classList.add('btn-stop-active');
    }

    document.getElementById('filter-loader').style.display = 'block';
    document.getElementById('filter-result').style.display = 'none';
    const stagePh = document.getElementById('stage-placeholder');
    if (stagePh) stagePh.style.display = 'none';
    const genResult = document.getElementById('gen-result');
    if (genResult) genResult.style.display = 'none';


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

        // Mirror to asset sidebar
        window.dispatchEvent(new CustomEvent('generation_complete', {
            detail: { url: `${API_URL}${data.video_url}`, type: 'video' }
        }));

    } catch (e) {
        alert("Error processing video: " + e.message);
    } finally {
        document.getElementById('filter-loader').style.display = 'none';
        const btnGen = document.getElementById('btn-generate');
        if (btnGen) {
            btnGen.innerHTML = 'GENERATE';
            btnGen.classList.remove('btn-stop-active');
        }
    }

}

// ── Generation History Modal ────────────────────────────────────────────────

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

// Navigation Home Button Flip (Synced with landing page)
function initHomeButtonFlip() {
    const inner = document.querySelector('.flip-inner');
    if (!inner || !window.gsap) return;

    gsap.timeline({
        repeat: -1,         
        repeatDelay: 10     
    
    })
    .to(inner, { rotateY: 180, duration: 0.6, ease: 'back.out(1.7)'  })
    .to({ }, { duration: 1.5  })
    .to(inner, { rotateY: 0, duration: 0.6, ease: 'back.inOut(1.7)'  });

}
document.addEventListener('DOMContentLoaded', initHomeButtonFlip);


