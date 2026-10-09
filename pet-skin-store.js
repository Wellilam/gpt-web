function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('gpt-web:pet-skin', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('skins');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export async function readCustomSkin() {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
        const request = database.transaction('skins', 'readonly').objectStore('skins').get('custom');
        request.onsuccess = () => { database.close(); resolve(request.result); };
        request.onerror = () => { database.close(); reject(request.error); };
    });
}

export async function writeCustomSkin(file) {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction('skins', 'readwrite');
        transaction.objectStore('skins').put(file, 'custom');
        transaction.oncomplete = () => { database.close(); resolve(); };
        transaction.onabort = () => { database.close(); reject(transaction.error); };
    });
}
