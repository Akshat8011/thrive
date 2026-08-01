/* ============================================================
   THRIVE — IndexedDB Engine v2 (db.js)
   Local-First data persistence for all modules.
   Extended: reminders, calendar, goal tiers, settings
   ============================================================ */

const ThriveDB = (() => {
    const DB_NAME = 'ThriveLifeOS';
    const DB_VERSION = 6;
    let _db = null;

    const STORES = [
        {
            name: 'activities',
            keyPath: 'id',
            indexes: [
                { name: 'by_date', keyPath: 'date', options: { unique: false } },
                { name: 'by_type', keyPath: 'type', options: { unique: false } }
            ]
        },
        {
            name: 'milestones',
            keyPath: 'id',
            indexes: [
                { name: 'by_targetDate', keyPath: 'targetDate', options: { unique: false } }
            ]
        },
        {
            name: 'goals',
            keyPath: 'id',
            indexes: [
                { name: 'by_tier', keyPath: 'tier', options: { unique: false } },
                { name: 'by_completed', keyPath: 'completed', options: { unique: false } }
            ]
        },
        {
            name: 'goalLogs',
            keyPath: 'id',
            indexes: [
                { name: 'by_goalId', keyPath: 'goalId', options: { unique: false } },
                { name: 'by_date', keyPath: 'date', options: { unique: false } }
            ]
        },
        {
            name: 'ideas',
            keyPath: 'id',
            indexes: [
                { name: 'by_type', keyPath: 'type', options: { unique: false } },
                { name: 'by_created', keyPath: 'createdAt', options: { unique: false } }
            ]
        },
        {
            name: 'journals',
            keyPath: 'id',
            indexes: [
                { name: 'by_date', keyPath: 'date', options: { unique: false } }
            ]
        },
        {
            name: 'expenses',
            keyPath: 'id',
            indexes: [
                { name: 'by_date', keyPath: 'date', options: { unique: false } },
                { name: 'by_category', keyPath: 'category', options: { unique: false } },
                { name: 'by_month', keyPath: 'month', options: { unique: false } }
            ]
        },
        {
            name: 'income',
            keyPath: 'id',
            indexes: [
                { name: 'by_date', keyPath: 'date', options: { unique: false } },
                { name: 'by_month', keyPath: 'month', options: { unique: false } }
            ]
        },
        {
            name: 'budgets',
            keyPath: 'id',
            indexes: [
                { name: 'by_month', keyPath: 'month', options: { unique: false } }
            ]
        },
        {
            name: 'debts',
            keyPath: 'id',
            indexes: [
                { name: 'by_type', keyPath: 'debtType', options: { unique: false } },
                { name: 'by_settled', keyPath: 'settled', options: { unique: false } }
            ]
        },
        {
            name: 'pomodoro',
            keyPath: 'id',
            indexes: [
                { name: 'by_date', keyPath: 'date', options: { unique: false } }
            ]
        },
        {
            name: 'pomodoroConfig',
            keyPath: 'id',
            indexes: []
        },
        {
            name: 'checklist',
            keyPath: 'id',
            indexes: [
                { name: 'by_listType', keyPath: 'listType', options: { unique: false } }
            ]
        },
        {
            name: 'todos',
            keyPath: 'id',
            indexes: [
                { name: 'by_date', keyPath: 'date', options: { unique: false } }
            ]
        },
        {
            name: 'purchases',
            keyPath: 'id',
            indexes: [
                { name: 'by_date', keyPath: 'date', options: { unique: false } }
            ]
        },
        {
            name: 'reminders',
            keyPath: 'id',
            indexes: [
                { name: 'by_datetime', keyPath: 'datetime', options: { unique: false } },
                { name: 'by_date', keyPath: 'date', options: { unique: false } },
                { name: 'by_done', keyPath: 'done', options: { unique: false } }
            ]
        },
        {
            name: 'appState',
            keyPath: 'key',
            indexes: []
        },
        {
            name: 'dailyLog',
            keyPath: 'date',
            indexes: []
        },
        {
            name: 'studySessions',
            keyPath: 'id',
            indexes: [
                { name: 'by_date', keyPath: 'date', options: { unique: false } },
                { name: 'by_subject', keyPath: 'subject', options: { unique: false } }
            ]
        },
        {
            name: 'studyHabits',
            keyPath: 'id',
            indexes: [
                { name: 'by_date', keyPath: 'date', options: { unique: false } }
            ]
        },
        {
            name: 'focusGarden',
            keyPath: 'id',
            indexes: [
                { name: 'by_date', keyPath: 'date', options: { unique: false } }
            ]
        },
        {
            name: 'focusMusic',
            keyPath: 'id',
            indexes: []
        },
        {
            name: 'buyDecisions',
            keyPath: 'id',
            indexes: [
                { name: 'by_date', keyPath: 'date', options: { unique: false } },
                { name: 'by_band', keyPath: 'band', options: { unique: false } }
            ]
        }
    ];

    function open() {
        if (_db) return Promise.resolve(_db);
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                STORES.forEach(storeDef => {
                    let store;
                    if (!db.objectStoreNames.contains(storeDef.name)) {
                        store = db.createObjectStore(storeDef.name, { keyPath: storeDef.keyPath });
                    } else {
                        store = e.currentTarget.transaction.objectStore(storeDef.name);
                    }
                    storeDef.indexes.forEach(idx => {
                        if (!store.indexNames.contains(idx.name)) {
                            store.createIndex(idx.name, idx.keyPath, idx.options);
                        }
                    });
                });
            };
            req.onsuccess = (e) => {
                _db = e.target.result;
                _db.onversionchange = () => { _db.close(); _db = null; };
                resolve(_db);
            };
            req.onerror = (e) => {
                console.error('[ThriveDB] Open failed:', e.target.error);
                reject(e.target.error);
            };
        });
    }

    async function put(storeName, data) {
        const db = await open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            tx.objectStore(storeName).put(data);
            tx.oncomplete = () => resolve(data);
            tx.onerror = (e) => reject(e.target.error);
        });
    }

    async function get(storeName, key) {
        const db = await open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const req = tx.objectStore(storeName).get(key);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = (e) => reject(e.target.error);
        });
    }

    async function getAll(storeName, indexName, value) {
        const db = await open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            let req;
            if (indexName && value !== undefined) {
                req = store.index(indexName).getAll(value);
            } else {
                req = store.getAll();
            }
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = (e) => reject(e.target.error);
        });
    }

    async function remove(storeName, key) {
        const db = await open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            tx.objectStore(storeName).delete(key);
            tx.oncomplete = () => resolve();
            tx.onerror = (e) => reject(e.target.error);
        });
    }

    async function clear(storeName) {
        const db = await open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            tx.objectStore(storeName).clear();
            tx.oncomplete = () => resolve();
            tx.onerror = (e) => reject(e.target.error);
        });
    }

    async function count(storeName, indexName, value) {
        const db = await open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            let req;
            if (indexName && value !== undefined) {
                req = store.index(indexName).count(value);
            } else {
                req = store.count();
            }
            req.onsuccess = () => resolve(req.result);
            req.onerror = (e) => reject(e.target.error);
        });
    }

    async function getRange(storeName, indexName, from, to) {
        const db = await open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const range = IDBKeyRange.bound(from, to);
            const req = tx.objectStore(storeName).index(indexName).getAll(range);
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = (e) => reject(e.target.error);
        });
    }

    async function putBatch(storeName, items) {
        const db = await open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            items.forEach(item => store.put(item));
            tx.oncomplete = () => resolve();
            tx.onerror = (e) => reject(e.target.error);
        });
    }

    async function syncToCloud() {
        // Local backup to browser storage & automatic download
        const backup = {
            timestamp: new Date().toISOString(),
            version: DB_VERSION,
            data: {}
        };

        for (const def of STORES) {
            backup.data[def.name] = await getAll(def.name);
        }

        try {
            // Save to localStorage
            localStorage.setItem('thrive_backup_latest', JSON.stringify(backup));
            
            // Create downloadable file
            const backupJsonStr = JSON.stringify(backup, null, 2);
            const blob = new Blob([backupJsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `thrive_backup_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            Utils.toast('✓ Backup saved! File downloaded.', 'success');
            console.log('[Thrive] Backup created:', backup.timestamp);
        } catch (e) {
            console.error('Backup failed:', e);
            Utils.toast('Backup failed - check console', 'danger');
        }
    }

    async function pullFromCloud() {
        // Show file picker to restore from backup
        try {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = async (event) => {
                    try {
                        const backup = JSON.parse(event.target.result);
                        
                        if (!backup.data || typeof backup.data !== 'object') {
                            throw new Error('Invalid backup file format');
                        }

                        // Restore all data
                        for (const storeName of Object.keys(backup.data)) {
                            await clear(storeName); 
                            if (backup.data[storeName] && backup.data[storeName].length > 0) {
                                await putBatch(storeName, backup.data[storeName]);
                            }
                        }

                        localStorage.setItem('thrive_backup_latest', JSON.stringify(backup));
                        Utils.toast('✓ Data restored from backup!', 'success');
                        setTimeout(() => window.location.reload(), 1500);
                    } catch (err) {
                        console.error('Restore error:', err);
                        Utils.toast('Invalid backup file', 'danger');
                    }
                };
                reader.readAsText(file);
            };
            input.click();
        } catch (e) {
            console.error('Restore failed:', e);
            Utils.toast('Restore failed', 'danger');
        }
    }

    return { open, put, get, getAll, remove, clear, count, getRange, putBatch, syncToCloud, pullFromCloud };
})();
