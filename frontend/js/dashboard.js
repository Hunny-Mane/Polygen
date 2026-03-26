/**
 * POLYGEN DASHBOARD CORE ENGINE - V8 (FULL SYNC)
 * Optimized for Neumorphic UI & Real-time Data Mapping
 */

const API_URL = "http://localhost:8000";
let activeModule = 'detection';
let allDetectionRecords = [];
let allGenerationRecords = [];
let logPage = 0;
const LOGS_PER_PAGE = 20;

// 1. CORE SYNC ENGINE
async function refreshAll() {
    try {
        const [detRes, genRes, statsRes] = await Promise.all([
            fetch(`${API_URL}/api/detection/records`),
            fetch(`${API_URL}/api/generation/records`),
            fetch(`${API_URL}/api/stats`)
        ]);

        allDetectionRecords = (await detRes.json()).records || [];
        allGenerationRecords = (await genRes.json()).records || [];
        const statsData = await statsRes.json();

        // Update UI Components
        renderStats(statsData);
        updateThroughputChart();
        renderActivityLog();
        renderDetectionGallery();
        renderGenerationGallery();

        // Trigger Database Summary Counters
        updateDatabaseStats(allDetectionRecords, allGenerationRecords);

    } catch (e) {
        console.error('PolyGen Sync Error:', e);
    }
}

// 2. DATABASE SUMMARY LOGIC (Neumorphic Counters)
/**
 * UPDATED: Robust Database Stats Logic
 * Fixes: Video detection counting and case-sensitivity
 */
/**
 * POLYGEN V8 - REPAIRED SUMMARY ENGINE
 * Fixes: Total count ignoring videos, Case-sensitivity, and Extension matching
 */
function updateDatabaseStats(detections, generations) {
    // --- 1. DETECTION MODULE STATS ---
    // Absolute count of all objects in array

    const detImages = detections.filter(item => {
        const type = (item.media_type || '').toLowerCase();
        const file = (item.filename || '').toLowerCase();
        return type === 'image' || file.match(/\.(jpg|jpeg|png|webp|gif)$/i);
    }).length;

    const detVideos = detections.filter(item => {
        const type = (item.media_type || '').toLowerCase();
        const file = (item.filename || '').toLowerCase();
        return type === 'video' || file.match(/\.(mp4|mov|avi|mkv|webm|ts)$/i);
    }).length;

    const detTotal = detections.length;

    // --- 2. GENERATION MODULE STATS ---
    const genTotal = generations.length; // Absolute count of all objects in array

    const genImages = generations.filter(item => {
        const type = (item.media_type || '').toLowerCase();
        const file = (item.filename || '').toLowerCase();
        return type === 'image' || file.match(/\.(jpg|jpeg|png|webp)$/i);
    }).length;

    const genVideos = generations.filter(item => {
        const type = (item.media_type || '').toLowerCase();
        const file = (item.filename || '').toLowerCase();
        return type === 'video' || file.match(/\.(mp4|mov|webm)$/i);
    }).length;

    // --- 3. UI SYNC (GSAP ANIMATION) ---
    // Update Detection Bars
    animateCounter("db-det-total", (detImages + detVideos));   // Now correctly counts Images + Videos
    animateCounter("db-det-images", detImages);
    animateCounter("db-det-videos", detVideos);

    // Update Generation Bars
    animateCounter("db-gen-total", genTotal);   // Now correctly counts Images + Videos
    animateCounter("db-gen-images", genImages);
    animateCounter("db-gen-videos", genVideos);

    // Debugging Log (Check console if numbers look weird)
    console.log(`[Sync] Det: ${detTotal} (IMG:${detImages} VID:${detVideos}) | Gen: ${genTotal} (IMG:${genImages} VID:${genVideos})`);
}

// 3. GSAP COUNTER ANIMATION
function animateCounter(id, targetValue) {
    const el = document.getElementById(id);
    if (!el) return;

    // Only animate if the value has actually changed to save resources
    const currentVal = parseInt(el.innerText) || 0;
    if (currentVal === targetValue) return;

    const obj = { value: currentVal };
    gsap.to(obj, {
        value: targetValue,
        duration: 1.5,
        ease: "power2.out",
        onUpdate: () => {
            el.innerText = Math.ceil(obj.value);
        }
    });
}

// 4. MODULE SWITCHER
window.setDashboardModule = function (module) {
    activeModule = module;
    document.getElementById('btn-det')?.classList.toggle('active-module', module === 'detection');
    document.getElementById('btn-gen')?.classList.toggle('active-module', module === 'generation');
    console.log("Module Context:", module);
    updateThroughputChart();
};

// 5. ACTIVITY LOG ENGINE (20-40-60 Pagination)
function renderActivityLog() {
    const tbody = document.querySelector('tbody');
    const startEl = document.getElementById('log-start');
    const endEl = document.getElementById('log-end');
    const totalEl = document.getElementById('log-total');
    const pageNumBtn = document.getElementById('active-page-num');

    if (!tbody) return;

    const merged = [...allDetectionRecords, ...allGenerationRecords]
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const totalLogs = merged.length;
    const startIdx = logPage * LOGS_PER_PAGE;
    const paginated = merged.slice(startIdx, startIdx + LOGS_PER_PAGE);

    if (startEl) startEl.textContent = totalLogs > 0 ? startIdx + 1 : 0;
    if (endEl) endEl.textContent = Math.min(startIdx + LOGS_PER_PAGE, totalLogs);
    if (totalEl) totalEl.textContent = totalLogs;
    if (pageNumBtn) pageNumBtn.textContent = logPage + 1;

    tbody.innerHTML = paginated.map(r => {
        const isGen = r.prompt !== undefined;
        const d = new Date(r.timestamp);
        const dateStr = d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });
        const timeStr = d.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit' });
        const hash = r.filename ? `0x${r.filename.slice(0, 4).toUpperCase()}` : `#${r.id}`;
        const opName = isGen ? 'AI_GENERATION' : 'FORENSIC_DET';
        let status = isGen ? 'STABLE' : (r.fake_prob > 0.8 ? 'CRITICAL' : 'VERIFIED');
        let badgeClass = isGen ? 'text-purple-400' : (r.fake_prob > 0.8 ? 'text-red-500' : 'text-cyan-500');

        return `
            <tr class="hover:bg-white/5 border-b border-white/5 transition-colors">
                <td class="px-8 py-4 text-[10px] font-mono">
                    <span class="text-primary mr-2">${dateStr}</span>
                    <span class="text-primary font-bold">${timeStr}</span>
                </td>
                <td class="px-8 py-4 text-[13px] font-mono text-slate-400">${hash}</td>
                <td class="px-8 py-4 text-[11px] font-bold tracking-widest">${opName}</td>
                <td class="px-8 py-4 text-right">
                    <span class="px-2 py-0.5 rounded text-[9px] border border-current ${badgeClass}">${status}</span>
                </td>
            </tr>`;
    }).join('');
}

// 6. GALLERY RENDERERS
function renderDetectionGallery() {
    const el = document.getElementById('detection-gallery');
    if (!el) return;
    if (allDetectionRecords.length === 0) {
        el.innerHTML = `<div class="empty-gallery"><span>🔍</span>No detections recorded.</div>`;
        return;
    }
    el.innerHTML = allDetectionRecords.map(r => `
        <div class="gallery-card" onclick="openDetails('detection', '${r.id}')">
            ${r.image_b64 ? `<img src="data:image/jpeg;base64,${r.image_b64}">` : '<div class="placeholder-icon">🎭</div>'}
            <div class="card-info">
                <span class="badge-small badge-detect">FAKE</span>
                <div class="prob">Prob: ${(r.fake_prob * 100).toFixed(1)}%</div>
            </div>
        </div>`).join('');
}

function renderGenerationGallery() {
    const el = document.getElementById('generation-gallery');
    if (!el) return;
    if (allGenerationRecords.length === 0) {
        el.innerHTML = `<div class="empty-gallery"><span>✨</span>No generations recorded.</div>`;
        return;
    }
    el.innerHTML = allGenerationRecords.map(r => `
        <div class="gallery-card" onclick="openDetails('generation', '${r.id}')">
            ${r.image_b64 ? `<img src="data:image/png;base64,${r.image_b64}">` : '<div class="placeholder-icon">🎨</div>'}
            <div class="card-info">
                <span class="badge-small badge-gen">AI GEN</span>
                <div class="prompt-text">${r.prompt || 'No Prompt'}</div>
            </div>
        </div>`).join('');
}

// 7. INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
    refreshAll();
    setInterval(refreshAll, 10000);

    // Pagination Listeners
    document.getElementById('log-next')?.addEventListener('click', () => {
        const total = allDetectionRecords.length + allGenerationRecords.length;
        if ((logPage + 1) * LOGS_PER_PAGE < total) { logPage++; renderActivityLog(); }
    });
    document.getElementById('log-prev')?.addEventListener('click', () => {
        if (logPage > 0) { logPage--; renderActivityLog(); }
    });

    initHomeButtonFlip();
});

/**
 * CHART & MODAL LOGIC (UNCHANGED)
 */
function updateThroughputChart() {
    const chartContainer = document.querySelector('.throughput-bars');
    if (!chartContainer) return;
    const records = activeModule === 'detection' ? allDetectionRecords : allGenerationRecords;
    const now = Date.now();
    const buckets = Array(12).fill(0);
    records.forEach(r => {
        const age = now - new Date(r.timestamp).getTime();
        const bucketIndex = Math.floor(age / (2 * 60 * 60 * 1000));
        if (bucketIndex >= 0 && bucketIndex < 12) buckets[11 - bucketIndex]++;
    });
    const maxVal = Math.max(...buckets, 5);
    const bars = chartContainer.querySelectorAll('.bar');
    bars.forEach((bar, i) => {
        bar.style.height = `${Math.max((buckets[i] / maxVal) * 100, 8)}%`;
    });
}

function renderStats(data) {
    const d = data.detection || { images: { total: 0, fake: 0 } };
    const g = data.generation || { images: { total: 0 }, videos: { total: 0 } };
    const set = (id, val) => { if (document.getElementById(id)) document.getElementById(id).textContent = val; };
    set('det-img-total', d.images.total);
    set('det-img-fake', d.images.fake);
    set('gen-total', (g.images.total || 0) + (g.videos.total || 0));
}

function initHomeButtonFlip() {
    const inner = document.querySelector('.flip-inner');
    if (!inner) return;
    gsap.timeline({ repeat: -1, repeatDelay: 10 })
        .to(inner, { rotateY: 180, duration: 0.6, ease: "back.out(1.7)" })
        .to({}, { duration: 1.5 })
        .to(inner, { rotateY: 0, duration: 0.6, ease: "back.inOut(1.7)" });
}

window.exportToCSV = function () {
    const merged = [...allDetectionRecords, ...allGenerationRecords].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    if (merged.length === 0) return alert("No data available.");
    const headers = ["Timestamp", "ID", "Type", "Content", "Status", "Probability"];
    const rows = merged.map(r => [
        `"${r.timestamp}"`, `"${r.id}"`, `"${r.prompt ? 'GEN' : 'DET'}"`,
        `"${(r.prompt || r.filename || 'N/A').replace(/"/g, '""')}"`,
        `"${r.prompt ? 'STABLE' : (r.fake_prob > 0.8 ? 'CRITICAL' : 'VERIFIED')}"`,
        `"${r.fake_prob ? (r.fake_prob * 100).toFixed(2) + '%' : 'N/A'}"`
    ]);
    const blob = new Blob([[headers.join(","), ...rows.map(e => e.join(","))].join("\n")], { type: 'text/csv' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `polygen_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
};

window.openDetails = function (type, id) {
    const modal = document.getElementById('history-modal');
    const records = type === 'detection' ? allDetectionRecords : allGenerationRecords;
    const data = records.find(r => r.id == id);
    if (!data || !modal) return;
    const modalImg = document.getElementById('history-image');
    if (data.image_b64) {
        modalImg.src = `data:image/${type === 'detection' ? 'jpeg' : 'png'};base64,${data.image_b64}`;
        modalImg.style.display = 'block';
    } else { modalImg.style.display = 'none'; }
    document.getElementById('history-prompt').textContent = data.prompt || data.filename || "N/A";
    document.getElementById('history-type').textContent = (data.media_type || "image").toUpperCase();
    document.getElementById('history-timestamp').textContent = new Date(data.timestamp).toLocaleString();
    const seedEl = document.getElementById('history-seed');
    if (type === 'detection') {
        seedEl.textContent = data.fake_prob ? `Fake Prob: ${(data.fake_prob * 100).toFixed(2)}%` : "N/A";
    } else { seedEl.textContent = data.seed || "Random"; }
    modal.classList.remove('hidden');
    gsap.fromTo(".history-modal-card", { scale: 0.8, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, ease: "back.out" });
};

document.getElementById('history-close')?.addEventListener('click', () => document.getElementById('history-modal').classList.add('hidden'));