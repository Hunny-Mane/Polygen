/**
 * POLYGEN DASHBOARD CORE ENGINE - V8 (FULL SYNC)
 */

const API_URL = "http://localhost:8000";
let activeModule = 'detection';
let allDetectionRecords = [];
let allGenerationRecords = [];
let logPage = 0;
const LOGS_PER_PAGE = 20;

// 1. Core Data Fetch
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

        // Update UI components
        renderStats(statsData);
        updateThroughputChart();
        renderActivityLog();

        // Database Gallery Updates
        renderDetectionGallery();
        renderGenerationGallery();

    } catch (e) {
        console.error('Data Sync Error:', e);
    }
}

// 2. Module Switcher (Fixes the Generation Button)
window.setDashboardModule = function (module) {
    activeModule = module;

    // Toggle CSS classes for the buttons
    document.getElementById('btn-det')?.classList.toggle('active-module', module === 'detection');
    document.getElementById('btn-gen')?.classList.toggle('active-module', module === 'generation');

    console.log("Switched to:", module);
    updateThroughputChart(); // Refresh chart immediately
};

// 3. Activity Logs (Fixes 20-40-60 Increments and Page Numbers)
function renderActivityLog() {
    const tbody = document.querySelector('tbody');
    const startEl = document.getElementById('log-start');
    const endEl = document.getElementById('log-end');
    const totalEl = document.getElementById('log-total');
    const pageNumBtn = document.getElementById('active-page-num');

    if (!tbody) return;

    // Merge and Sort
    const merged = [...allDetectionRecords, ...allGenerationRecords]
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const totalLogs = merged.length;
    const startIdx = logPage * LOGS_PER_PAGE;
    const paginated = merged.slice(startIdx, startIdx + LOGS_PER_PAGE);

    // Update Counter Numbers (Increments of 20)
    if (startEl) startEl.textContent = totalLogs > 0 ? startIdx + 1 : 0;
    if (endEl) endEl.textContent = Math.min(startIdx + LOGS_PER_PAGE, totalLogs);
    if (totalEl) totalEl.textContent = totalLogs;

    // Update the middle button to show Current Page (1, 2, 3...)
    if (pageNumBtn) pageNumBtn.textContent = logPage + 1;

    // Render Table Rows
    tbody.innerHTML = paginated.map(r => {
        const isGen = r.prompt !== undefined;
        const d = new Date(r.timestamp);
        const dateStr = d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });
        const timeStr = d.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

        const hash = r.filename ? `0x${r.filename.slice(0, 4).toUpperCase()}` : `#${r.id}`;
        const opName = isGen ? 'AI_GENERATION' : 'FORENSIC_DET';
        let status = isGen ? 'STABLE' : (r.fake_prob > 0.8 ? 'CRITICAL' : 'VERIFIED');
        let badgeClass = isGen ? 'text-purple-400' : (r.fake_prob > 0.8 ? 'text-red-500' : 'text-cyan-500');

        return `
            <tr class="hover:bg-white/5 border-b border-white/5">
                <td class="px-8 py-4 text-[10px] font-mono">
                    <span class="text-primary mr-2 text-[11px]">${dateStr}</span>
                    <span class="text-primary font-bold text-[11px]">${timeStr}</span>
                </td>
                <td class="px-8 py-4 text-[13px] font-mono text-slate-400">${hash}</td>
                <td class="px-8 py-4 text-[11px] font-bold tracking-widest">${opName}</td>
                <td class="px-8 py-4 text-right">
                    <span class="px-2 py-0.5 rounded text-[9px] border border-current ${badgeClass}">${status}</span>
                </td>
            </tr>`;
    }).join('');
}

// 4. Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    refreshAll();
    setInterval(refreshAll, 10000);

    // Chevron Next
    document.getElementById('log-next')?.addEventListener('click', () => {
        const total = allDetectionRecords.length + allGenerationRecords.length;
        if ((logPage + 1) * LOGS_PER_PAGE < total) {
            logPage++;
            renderActivityLog();
        }
    });

    // Chevron Back
    document.getElementById('log-prev')?.addEventListener('click', () => {
        if (logPage > 0) {
            logPage--;
            renderActivityLog();
        }
    });
});

// Helper for Stats and Chart
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

    const flipTl = gsap.timeline({
        repeat: -1,         // Infinite loop
        repeatDelay: 10     // Wait 10 seconds before starting the next flip
    });

    flipTl
        // 1. Flip to Logo
        .to(inner, {
            rotateY: 180,
            duration: 0.6,
            ease: "back.out(1.7)"
        })
        // 2. Hold Logo for 2 seconds
        .to({}, { duration: 1.5 })
        // 3. Flip back to Home Icon
        .to(inner, {
            rotateY: 0,
            duration: 0.6,
            ease: "back.inOut(1.7)"
        });
}

/**
 * EXPORT ENGINE: CSV GENERATOR
 */
window.exportToCSV = function () {
    // 1. Merge all records for a full history export
    const merged = [...allDetectionRecords, ...allGenerationRecords]
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    if (merged.length === 0) {
        alert("No data available to export.");
        return;
    }

    // 2. Define CSV Headers
    const headers = ["Timestamp", "ID", "Type", "Filename/Prompt", "Status", "Fake Probability"];

    // 3. Map data to rows
    const rows = merged.map(r => {
        const isGen = r.prompt !== undefined;
        const type = isGen ? "GENERATION" : "DETECTION";
        const content = isGen ? r.prompt : (r.filename || "N/A");
        const status = isGen ? "STABLE" : (r.fake_prob > 0.8 ? "CRITICAL" : "VERIFIED");
        const prob = r.fake_prob !== undefined ? (r.fake_prob * 100).toFixed(2) + "%" : "N/A";

        return [
            `"${r.timestamp}"`,
            `"${r.id}"`,
            `"${type}"`,
            `"${content.replace(/"/g, '""')}"`, // Escape quotes for CSV safety
            `"${status}"`,
            `"${prob}"`
        ];
    });

    // 4. Construct CSV String
    const csvContent = [
        headers.join(","),
        ...rows.map(e => e.join(","))
    ].join("\n");

    // 5. Trigger Browser Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");

    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        const dateTag = new Date().toISOString().split('T')[0];

        link.setAttribute("href", url);
        link.setAttribute("download", `polygen_export_${dateTag}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
};

// ─────────────────────────────────────────────────────────────
// DATABASE GALLERY RENDERERS (V8 COMPATIBLE)
// ─────────────────────────────────────────────────────────────
function renderDetectionGallery() {
    const el = document.getElementById('detection-gallery');
    if (!el) return;

    if (allDetectionRecords.length === 0) {
        el.innerHTML = `<div class="empty-gallery"><span>🔍</span>No detections saved yet.</div>`;
        return;
    }

    el.innerHTML = allDetectionRecords.map(r => {
        const imgSrc = r.image_b64 ? `data:image/jpeg;base64,${r.image_b64}` : '';
        const ts = new Date(r.timestamp).toLocaleString();
        const prob = r.fake_prob !== undefined ? (r.fake_prob * 100).toFixed(1) + '%' : '—';

        // Added onclick="openDetails('detection', '${r.id}')"
        return `
        <div class="gallery-card" onclick="openDetails('detection', '${r.id}')" style="cursor:pointer;">
            ${imgSrc ? `<img src="${imgSrc}" alt="Detection">` : '<div class="placeholder-icon">🎭</div>'}
            <div class="card-info">
                <span class="badge-small badge-detect">FAKE</span>
                <span class="badge-small ${r.media_type === 'video' ? 'badge-video' : 'badge-image'}">${r.media_type.toUpperCase()}</span>
                <div class="prob">Fake Prob: ${prob}</div>
                <div class="meta">📅 ${ts}</div>
            </div>
        </div>`;
    }).join('');
}

function renderGenerationGallery() {
    const el = document.getElementById('generation-gallery');
    if (!el) return;

    if (allGenerationRecords.length === 0) {
        el.innerHTML = `<div class="empty-gallery"><span>✨</span>No generated media saved yet.</div>`;
        return;
    }

    el.innerHTML = allGenerationRecords.map(r => {
        const imgSrc = r.image_b64 ? `data:image/png;base64,${r.image_b64}` : '';
        const ts = new Date(r.timestamp).toLocaleString();

        // Added onclick="openDetails('generation', '${r.id}')"
        return `
        <div class="gallery-card" onclick="openDetails('generation', '${r.id}')" style="cursor:pointer;">
            ${imgSrc ? `<img src="${imgSrc}" alt="Generated">` : '<div class="placeholder-icon">🎨</div>'}
            <div class="card-info">
                <span class="badge-small badge-gen">AI GEN</span>
                <span class="badge-small ${r.media_type === 'video' ? 'badge-video' : 'badge-image'}">${r.media_type.toUpperCase()}</span>
                <div class="prompt-text">💬 ${r.prompt || 'No Prompt'}</div>
                <div class="meta">📅 ${ts}</div>
            </div>
        </div>`;
    }).join('');
}

/**
 * MODAL ENGINE: DETAILS POPUP
 */
window.openDetails = function (type, id) {
    const modal = document.getElementById('history-modal');
    const records = type === 'detection' ? allDetectionRecords : allGenerationRecords;
    const data = records.find(r => r.id == id);

    if (!data || !modal) return;

    // Fill Image
    const modalImg = document.getElementById('history-image');
    if (data.image_b64) {
        modalImg.src = `data:image/${type === 'detection' ? 'jpeg' : 'png'};base64,${data.image_b64}`;
        modalImg.style.display = 'block';
    } else {
        modalImg.style.display = 'none';
    }

    // Fill Text Data
    document.getElementById('history-prompt').textContent = data.prompt || data.filename || "N/A";
    document.getElementById('history-type').textContent = (data.media_type || "image").toUpperCase();
    document.getElementById('history-timestamp').textContent = new Date(data.timestamp).toLocaleString();

    // Detection Specifics vs Generation Specifics
    const seedEl = document.getElementById('history-seed');
    if (type === 'detection') {
        document.querySelector('p strong').textContent = "Filename:";
        seedEl.textContent = data.fake_prob ? `Fake Probability: ${(data.fake_prob * 100).toFixed(2)}%` : "N/A";
    } else {
        document.querySelector('p strong').textContent = "Prompt:";
        seedEl.textContent = data.seed || "Random";
    }

    // Show Modal
    modal.classList.remove('hidden');
    gsap.fromTo(".history-modal-card", { scale: 0.8, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, ease: "back.out(1.7)" });
};

// Close Modal Event
document.getElementById('history-close')?.addEventListener('click', () => {
    const modal = document.getElementById('history-modal');
    modal.classList.add('hidden');
});

// Close on background click
window.addEventListener('click', (e) => {
    const modal = document.getElementById('history-modal');
    if (e.target === modal) modal.classList.add('hidden');
});