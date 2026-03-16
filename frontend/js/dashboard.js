
const API_URL = "http://localhost:8000";

// ─────────────────────────────────────────────────────────────
// Stats fetch & render
// ─────────────────────────────────────────────────────────────
async function fetchStats() {
    try {
        const res = await fetch(`${API_URL}/api/stats`);
        const data = await res.json();
        const d = data.detection;
        const g = data.generation;

        // Detection
        const totalFake = (d.images.fake || 0) + (d.videos.fake || 0);

        setText('det-img-total',  d.images.total ?? 0);
        setText('det-img-real',   d.images.real  ?? 0);
        setText('det-img-fake',   d.images.fake  ?? 0);
        setText('det-vid-total',  d.videos.total ?? 0);
        setText('det-vid-real',   d.videos.real  ?? 0);
        setText('det-vid-fake',   d.videos.fake  ?? 0);
        setText('det-total-fake', totalFake);

        // Generation
        const totalGen = (g.images.total || 0) + (g.videos.total || 0);
        setText('gen-img-total', g.images.total ?? 0);
        setText('gen-vid-total', g.videos.total ?? 0);
        setText('gen-total',     totalGen);
    } catch (e) {
        console.warn('Stats fetch failed:', e);
    }
}

// ─────────────────────────────────────────────────────────────
// Detection records
// ─────────────────────────────────────────────────────────────
async function fetchDetectionRecords() {
    try {
        const res  = await fetch(`${API_URL}/api/detection/records`);
        const data = await res.json();
        const records = data.records || [];

        // Summary counts
        const images = records.filter(r => r.media_type === 'image').length;
        const videos = records.filter(r => r.media_type === 'video').length;
        setAll('db-det-total',  records.length);
        setAll('db-det-images', images);
        setAll('db-det-videos', videos);

        renderDetectionGallery(records);
        renderActivityLog(records);
    } catch (e) {
        console.warn('Detection records fetch failed:', e);
    }
}

function renderDetectionGallery(records) {
    const el = document.getElementById('detection-gallery');
    if (!el) return;
    if (records.length === 0) {
        el.innerHTML = `<div class="empty-gallery"><span>🔍</span>No fake detections saved yet.<br>Analyze an image or video to auto-save here.</div>`;
        return;
    }
    el.innerHTML = records.map(r => {
        const imgSrc = r.image_b64 ? `data:image/jpeg;base64,${r.image_b64}` : '';
        const ts = r.timestamp ? new Date(r.timestamp).toLocaleString() : '—';
        const prob = r.fake_prob !== undefined ? (r.fake_prob * 100).toFixed(1) + '%' : '—';
        const conf = r.confidence !== undefined ? (r.confidence * 100).toFixed(1) + '%' : '—';
        return `
        <div class="gallery-card">
            ${imgSrc ? `<img src="${imgSrc}" alt="Fake detection #${r.id}" loading="lazy">` : '<div style="height:160px;background:rgba(239,68,68,0.08);display:flex;align-items:center;justify-content:center;font-size:2rem;">🎭</div>'}
            <div class="card-info">
                <span class="badge-small badge-detect">FAKE</span>
                <span class="badge-small ${r.media_type === 'video' ? 'badge-video' : 'badge-image'}">${r.media_type.toUpperCase()}</span>
                <div class="prob">Fake Prob: ${prob}</div>
                <div class="meta">Confidence: ${conf}</div>
                <div class="meta">📅 ${ts}</div>
                <div class="meta" style="margin-top:0.3rem; font-size:0.72rem; color:rgba(255,255,255,0.3);">${r.filename}</div>
            </div>
        </div>`;
    }).join('');
}

function renderActivityLog(records) {
    const tbody = document.getElementById('log-body');
    if (!tbody) return;
    if (records.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="empty-log">No activity yet.</td></tr>`;
        return;
    }
    tbody.innerHTML = records.slice(0, 20).map(r => {
        const ts = r.timestamp ? new Date(r.timestamp).toLocaleString() : '—';
        const prob = r.fake_prob !== undefined ? (r.fake_prob * 100).toFixed(1) + '%' : '—';
        const conf = r.confidence !== undefined ? (r.confidence * 100).toFixed(1) + '%' : '—';
        return `<tr>
            <td>${r.id}</td>
            <td><span class="badge badge-fake">FAKE</span></td>
            <td><span class="badge ${r.media_type === 'video' ? '' : 'badge-gen'}" style="background:rgba(59,130,246,0.12);color:#60a5fa;padding:0.2rem 0.6rem;border-radius:12px;font-size:0.75rem;">${r.media_type}</span></td>
            <td>${prob}</td>
            <td>${conf}</td>
            <td>${ts}</td>
        </tr>`;
    }).join('');
}

// ─────────────────────────────────────────────────────────────
// Generation records
// ─────────────────────────────────────────────────────────────
async function fetchGenerationRecords() {
    try {
        const res  = await fetch(`${API_URL}/api/generation/records`);
        const data = await res.json();
        const records = data.records || [];

        const images = records.filter(r => r.media_type === 'image').length;
        const videos = records.filter(r => r.media_type === 'video').length;
        setAll('db-gen-total',  records.length);
        setAll('db-gen-images', images);
        setAll('db-gen-videos', videos);

        renderGenerationGallery(records);
    } catch (e) {
        console.warn('Generation records fetch failed:', e);
    }
}


let currentGenerationRecords = [];

function renderGenerationGallery(records) {
    currentGenerationRecords = records;
    const el = document.getElementById('generation-gallery');
    if (!el) return;
    if (records.length === 0) {
        el.innerHTML = `<div class="empty-gallery"><span>✨</span>No generated media saved yet.<br>Generate an image or apply a filter to auto-save here.</div>`;
        return;
    }
    el.innerHTML = records.map((r, idx) => {
        const imgSrc = r.image_b64 ? `data:image/png;base64,${r.image_b64}` : '';
        const ts = r.timestamp ? new Date(r.timestamp).toLocaleString() : '—';
        const prompt = r.prompt || '—';
        return `
        <div class="gallery-card history-item" onclick="openHistoryModalById(${idx})">
            ${imgSrc ? `<img src="${imgSrc}" alt="Generated media #${r.id}" loading="lazy">` : '<div style="height:160px;background:rgba(139,92,246,0.08);display:flex;align-items:center;justify-content:center;font-size:2rem;">' + (r.media_type === 'video' ? '🎬' : '🎨') + '</div>'}
            <div class="card-info">
                <span class="badge-small badge-gen">AI GEN</span>
                <span class="badge-small ${r.media_type === 'video' ? 'badge-video' : 'badge-image'}">${r.media_type.toUpperCase()}</span>
                <div class="prompt-text" title="${prompt}">💬 ${prompt}</div>
                <div class="meta">📅 ${ts}</div>
                <div class="meta" style="margin-top:0.3rem; font-size:0.72rem; color:rgba(255,255,255,0.3);">${r.filename}</div>
            </div>
        </div>`;
    }).join('');
}

// ── Generation History Modal ────────────────────────────────────────────────
function openHistoryModalById(idx) {
    const data = currentGenerationRecords[idx];
    if (!data) return;
    openHistoryModal(data);
}

function openHistoryModal(data) {
    const modal = document.getElementById("history-modal");
    if (!modal) return;

    modal.classList.remove("hidden");

    document.getElementById("history-prompt").textContent = data.prompt || "—";
    document.getElementById("history-type").textContent = data.media_type || data.type || "N/A";
    document.getElementById("history-time").textContent = data.generation_time ? parseFloat(data.generation_time).toFixed(2) + 's' : "N/A";
    
    const ts = data.timestamp ? new Date(data.timestamp).toLocaleString() : "N/A";
    document.getElementById("history-timestamp").textContent = ts;
    document.getElementById("history-seed").textContent = data.seed || "Random";

    const imgEl = document.getElementById("history-image");
    if (data.image_b64) {
        imgEl.src = `data:image/png;base64,${data.image_b64}`;
        imgEl.style.display = 'block';
    } else if (data.image) {
        imgEl.src = data.image;
        imgEl.style.display = 'block';
    } else {
        imgEl.style.display = 'none';
        imgEl.src = '';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const closeBtn = document.getElementById("history-close");
    if (closeBtn) {
        closeBtn.onclick = () => {
            document.getElementById("history-modal").classList.add("hidden");
        };
    }

    // Close on background click
    const modal = document.getElementById("history-modal");
    if (modal) {
        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.classList.add("hidden");
            }
        };
    }
});

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

function setAll(id, val) {
    document.querySelectorAll(`#${id}`).forEach(el => { el.textContent = val; });
}

// ─────────────────────────────────────────────────────────────
// Init + auto-refresh
// ─────────────────────────────────────────────────────────────
function refreshAll() {
    fetchStats();
    fetchDetectionRecords();
    fetchGenerationRecords();
}

refreshAll();
setInterval(refreshAll, 5000);
