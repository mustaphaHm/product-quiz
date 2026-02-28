// ── IndexedDB wrapper ─────────────────────────────
window.db = (() => {
    const DB_NAME    = 'ProductManagerDB';
    const DB_VERSION = 1;
    const STORE      = 'products';
    let _db = null;

    function open() {
        return new Promise((resolve, reject) => {
            if (_db) { resolve(_db); return; }
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = e => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE)) {
                    db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
                }
            };
            req.onsuccess = e => { _db = e.target.result; resolve(_db); };
            req.onerror   = e => reject(e.target.error);
        });
    }

    function store(mode) {
        return _db.transaction(STORE, mode).objectStore(STORE);
    }

    return {
        async getAll() {
            await open();
            return new Promise((resolve, reject) => {
                const req = store('readonly').getAll();
                req.onsuccess = e => resolve(JSON.stringify(e.target.result));
                req.onerror   = e => reject(e.target.error);
            });
        },

        async add(json) {
            await open();
            const obj = JSON.parse(json);
            delete obj.id;
            return new Promise((resolve, reject) => {
                const req = store('readwrite').add(obj);
                req.onsuccess = e => resolve(e.target.result); // new id
                req.onerror   = e => reject(e.target.error);
            });
        },

        async update(json) {
            await open();
            const obj = JSON.parse(json);
            return new Promise((resolve, reject) => {
                const req = store('readwrite').put(obj);
                req.onsuccess = () => resolve(true);
                req.onerror   = e => reject(e.target.error);
            });
        },

        async delete(id) {
            await open();
            return new Promise((resolve, reject) => {
                const req = store('readwrite').delete(id);
                req.onsuccess = () => resolve(true);
                req.onerror   = e => reject(e.target.error);
            });
        },

        async clear() {
            await open();
            return new Promise((resolve, reject) => {
                const req = store('readwrite').clear();
                req.onsuccess = () => resolve(true);
                req.onerror   = e => reject(e.target.error);
            });
        }
    };
})();

// ── Read file input as base64 data URL ────────────
window.readFileAsBase64 = (inputId) => {
    return new Promise((resolve) => {
        const input = document.getElementById(inputId);
        if (!input || !input.files || !input.files[0]) { resolve(null); return; }
        const reader = new FileReader();
        reader.onload  = e => resolve(e.target.result); // "data:image/jpeg;base64,..."
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(input.files[0]);
    });
};

// ── Programmatically click a file input ───────────
window.triggerClick = (id) => {
    const el = document.getElementById(id);
    if (el) el.click();
};

// ── Excel parser (SheetJS) ────────────────────────
window.parseExcel = function(base64) {
    const binary = atob(base64);
    const bytes  = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const wb   = XLSX.read(bytes, { type: 'array' });
    const ws   = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
    return JSON.stringify(rows.map(r => {
        const out = {};
        for (const k in r) out[String(k)] = String(r[k]);
        return out;
    }));
};

// ── Add this block to your existing app.js ──────────────────────────────────

window.cameraHelper = {
    _stream: null,

    // Start camera stream into a <video> element
    async start(videoId) {
        const video = document.getElementById(videoId);
        if (!video) throw new Error('Video element not found: ' + videoId);

        this._stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 960 } },
            audio: false
        });
        video.srcObject = this._stream;
        await video.play();
    },

    // Stop all camera tracks
    stop() {
        if (this._stream) {
            this._stream.getTracks().forEach(t => t.stop());
            this._stream = null;
        }
    },

    // Capture current video frame → base64 JPEG data URI
    capture(videoId, canvasId) {
        const video  = document.getElementById(videoId);
        const canvas = document.getElementById(canvasId);
        if (!video || !canvas) return null;

        canvas.width  = video.videoWidth  || 640;
        canvas.height = video.videoHeight || 480;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Return as JPEG at 85% quality to keep size reasonable
        return canvas.toDataURL('image/jpeg', 0.85);
    },

    // Read a file input → base64 data URI
    readFile(inputId) {
        return new Promise((resolve, reject) => {
            const input = document.getElementById(inputId);
            if (!input || !input.files || input.files.length === 0) {
                resolve(null);
                return;
            }
            const reader = new FileReader();
            reader.onload  = e => resolve(e.target.result);
            reader.onerror = () => reject(new Error('File read failed'));
            reader.readAsDataURL(input.files[0]);
        });
    }
};

// ── Add this to your existing wwwroot/js/app.js ─────────────────────────────

window.exportToExcel = function (rows, sheetName) {
    // rows: array of arrays, first row is headers
    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Column widths
    ws['!cols'] = [
        { wch: 30 }, // الاسم
        { wch: 16 }, // سعر القطعة
        { wch: 16 }, // سعر الزينة
        { wch: 16 }, // سعر الكرتون
        { wch: 14 }, // قطع/كرتون
        { wch: 14 }, // زينات/كرتون
        { wch: 14 }, // قطع/زينة
        { wch: 10 }, // لديه زينة
        { wch: 10 }, // مفضلة
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName || 'Sheet1');

    const date     = new Date();
    const dateStr  = `${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}`;
    const fileName = `المنتجات_${dateStr}.xlsx`;

    XLSX.writeFile(wb, fileName);
};