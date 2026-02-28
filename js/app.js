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
window.readFileAsBase64 = () => {
    return new Promise((resolve) => {
        // Poll briefly for the image to be ready (resize is async)
        let attempts = 0;
        const check = setInterval(() => {
            attempts++;
            if (window._lastFileBase64) {
                clearInterval(check);
                const result = window._lastFileBase64;
                window._lastFileBase64 = null;
                resolve(result);
            } else if (attempts > 40) { // 2 seconds timeout
                clearInterval(check);
                resolve(null);
            }
        }, 50);
    });
};
// ── Programmatically click a file input ───────────
window._lastFileBase64 = null;

window.triggerClick = (id) => {
    const el = document.getElementById(id);
    if (!el) return;

    // Attach onchange handler that reads immediately on mobile
    el.onchange = () => {
        if (!el.files || !el.files[0]) {
            window._lastFileBase64 = null;
            return;
        }
        const file = el.files[0];

        // Resize large images before storing (important for mobile camera photos)
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const MAX = 800; // max width or height in px
                let w = img.width;
                let h = img.height;

                if (w > MAX || h > MAX) {
                    if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
                    else       { w = Math.round(w * MAX / h); h = MAX; }
                }

                const canvas = document.createElement('canvas');
                canvas.width  = w;
                canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                window._lastFileBase64 = canvas.toDataURL('image/jpeg', 0.80);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    };

    el.value = ''; // reset so same file can be picked again
    el.click();
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