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
