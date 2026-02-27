
const API_URL = "http://localhost:8000";

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
async function analyzeImage() {
    const input = document.getElementById('image-input');
    if (!input.files[0]) return alert("Please upload an image");

    const formData = new FormData();
    formData.append('file', input.files[0]);

    document.getElementById('img-loader').style.display = 'block';
    document.getElementById('img-result').style.display = 'none';

    try {
        const res = await fetch(`${API_URL}/api/detection/predict/image`, {
            method: 'POST',
            body: formData
        });
        const data = await res.json();

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

// ── Video Detection ────────────────────────────────────────────────────────
async function analyzeVideo() {
    const input = document.getElementById('video-input');
    if (!input.files[0]) return alert("Please upload a video");

    const formData = new FormData();
    formData.append('file', input.files[0]);

    document.getElementById('vid-loader').style.display = 'block';
    document.getElementById('vid-result').style.display = 'none';

    try {
        const res = await fetch(`${API_URL}/api/detection/predict/video`, {
            method: 'POST',
            body: formData
        });
        const data = await res.json();

        const labelSpan = document.getElementById('vid-pred');
        labelSpan.innerText = data.label;
        labelSpan.className = data.label === 'Real' ? 'label-real' : 'label-fake';

        document.getElementById('vid-prob').innerText = (data.probability * 100).toFixed(2) + '% Fake Probability';
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
async function generateImage() {
    const prompt = document.getElementById('prompt-input').value;
    if (!prompt) return alert("Enter a prompt");

    const formData = new FormData();
    formData.append('prompt', prompt);

    document.getElementById('gen-loader').style.display = 'block';
    document.getElementById('gen-result').style.display = 'none';

    try {
        const res = await fetch(`${API_URL}/api/generation/generate/image`, {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        document.getElementById('generated-img').src = `data:image/png;base64,${data.image}`;
        document.getElementById('gen-result').style.display = 'flex';

        // Track stats
        await trackStat('generation', 'image');

    } catch (e) {
        alert("Error generating image: " + e.message);
    } finally {
        document.getElementById('gen-loader').style.display = 'none';
    }
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
