import { BackgroundAudioSettings } from './backgroundAudioService';

const DB_NAME = 'AtaraxiaAudiobookDB';
const DB_VERSION = 1;

// Store names
const BACKGROUND_AUDIO_STORE = 'backgroundAudio';
const CHAPTER_METADATA_STORE = 'chapterMetadata';
const CACHED_AUDIO_STORE = 'cachedAudio';

interface ChapterMetadata {
    chapterIndex: number;
    voiceEngine: string;
    voiceId: string;
    backgroundAudioId?: string;
    generatedAt: number;
    duration: number;
    fileSize?: number;
}

interface BackgroundAudioRecord {
    id: string;
    name: string;
    data: ArrayBuffer;
    duration: number;
    settings: BackgroundAudioSettings;
    uploadedAt: number;
}

interface CachedAudioRecord {
    cacheKey: string;
    data: ArrayBuffer;
    metadata: ChapterMetadata;
    cachedAt: number;
}

class StorageService {
    private db: IDBDatabase | null = null;

    async initialize(): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;

                // Background audio store
                if (!db.objectStoreNames.contains(BACKGROUND_AUDIO_STORE)) {
                    const bgStore = db.createObjectStore(BACKGROUND_AUDIO_STORE, { keyPath: 'id' });
                    bgStore.createIndex('uploadedAt', 'uploadedAt', { unique: false });
                }

                // Chapter metadata store
                if (!db.objectStoreNames.contains(CHAPTER_METADATA_STORE)) {
                    const chapterStore = db.createObjectStore(CHAPTER_METADATA_STORE, { keyPath: 'chapterIndex' });
                    chapterStore.createIndex('voiceEngine', 'voiceEngine', { unique: false });
                    chapterStore.createIndex('generatedAt', 'generatedAt', { unique: false });
                }

                // Cached audio store
                if (!db.objectStoreNames.contains(CACHED_AUDIO_STORE)) {
                    const cacheStore = db.createObjectStore(CACHED_AUDIO_STORE, { keyPath: 'cacheKey' });
                    cacheStore.createIndex('cachedAt', 'cachedAt', { unique: false });
                }
            };
        });
    }

    private ensureDB(): IDBDatabase {
        if (!this.db) {
            throw new Error('Database not initialized. Call initialize() first.');
        }
        return this.db;
    }

    // ===== Background Audio Methods =====

    async saveBackgroundAudio(
        id: string,
        name: string,
        audioData: ArrayBuffer,
        duration: number,
        settings: BackgroundAudioSettings
    ): Promise<void> {
        const db = this.ensureDB();
        const record: BackgroundAudioRecord = {
            id,
            name,
            data: audioData,
            duration,
            settings,
            uploadedAt: Date.now(),
        };

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([BACKGROUND_AUDIO_STORE], 'readwrite');
            const store = transaction.objectStore(BACKGROUND_AUDIO_STORE);
            const request = store.put(record);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async getBackgroundAudio(id: string): Promise<BackgroundAudioRecord | null> {
        const db = this.ensureDB();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([BACKGROUND_AUDIO_STORE], 'readonly');
            const store = transaction.objectStore(BACKGROUND_AUDIO_STORE);
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    }

    async getAllBackgroundAudio(): Promise<BackgroundAudioRecord[]> {
        const db = this.ensureDB();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([BACKGROUND_AUDIO_STORE], 'readonly');
            const store = transaction.objectStore(BACKGROUND_AUDIO_STORE);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    async deleteBackgroundAudio(id: string): Promise<void> {
        const db = this.ensureDB();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([BACKGROUND_AUDIO_STORE], 'readwrite');
            const store = transaction.objectStore(BACKGROUND_AUDIO_STORE);
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // ===== Chapter Metadata Methods =====

    async saveChapterMetadata(metadata: ChapterMetadata): Promise<void> {
        const db = this.ensureDB();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([CHAPTER_METADATA_STORE], 'readwrite');
            const store = transaction.objectStore(CHAPTER_METADATA_STORE);
            const request = store.put(metadata);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async getChapterMetadata(chapterIndex: number): Promise<ChapterMetadata | null> {
        const db = this.ensureDB();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([CHAPTER_METADATA_STORE], 'readonly');
            const store = transaction.objectStore(CHAPTER_METADATA_STORE);
            const request = store.get(chapterIndex);

            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    }

    async getAllChapterMetadata(): Promise<ChapterMetadata[]> {
        const db = this.ensureDB();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([CHAPTER_METADATA_STORE], 'readonly');
            const store = transaction.objectStore(CHAPTER_METADATA_STORE);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    async deleteChapterMetadata(chapterIndex: number): Promise<void> {
        const db = this.ensureDB();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([CHAPTER_METADATA_STORE], 'readwrite');
            const store = transaction.objectStore(CHAPTER_METADATA_STORE);
            const request = store.delete(chapterIndex);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async clearAllChapterMetadata(): Promise<void> {
        const db = this.ensureDB();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([CHAPTER_METADATA_STORE], 'readwrite');
            const store = transaction.objectStore(CHAPTER_METADATA_STORE);
            const request = store.clear();

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // ===== Cached Audio Methods =====

    async saveCachedAudio(cacheKey: string, audioData: ArrayBuffer, metadata: ChapterMetadata): Promise<void> {
        const db = this.ensureDB();
        const record: CachedAudioRecord = {
            cacheKey,
            data: audioData,
            metadata,
            cachedAt: Date.now(),
        };

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([CACHED_AUDIO_STORE], 'readwrite');
            const store = transaction.objectStore(CACHED_AUDIO_STORE);
            const request = store.put(record);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async getCachedAudio(cacheKey: string): Promise<CachedAudioRecord | null> {
        const db = this.ensureDB();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([CACHED_AUDIO_STORE], 'readonly');
            const store = transaction.objectStore(CACHED_AUDIO_STORE);
            const request = store.get(cacheKey);

            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    }

    async deleteCachedAudio(cacheKey: string): Promise<void> {
        const db = this.ensureDB();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([CACHED_AUDIO_STORE], 'readwrite');
            const store = transaction.objectStore(CACHED_AUDIO_STORE);
            const request = store.delete(cacheKey);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async clearAllCachedAudio(): Promise<void> {
        const db = this.ensureDB();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([CACHED_AUDIO_STORE], 'readwrite');
            const store = transaction.objectStore(CACHED_AUDIO_STORE);
            const request = store.clear();

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // ===== Storage Stats =====

    async getStorageStats(): Promise<{
        backgroundAudioCount: number;
        chapterMetadataCount: number;
        cachedAudioCount: number;
        estimatedSize?: number;
    }> {
        const db = this.ensureDB();

        const bgCount = await new Promise<number>((resolve, reject) => {
            const transaction = db.transaction([BACKGROUND_AUDIO_STORE], 'readonly');
            const store = transaction.objectStore(BACKGROUND_AUDIO_STORE);
            const request = store.count();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });

        const chapterCount = await new Promise<number>((resolve, reject) => {
            const transaction = db.transaction([CHAPTER_METADATA_STORE], 'readonly');
            const store = transaction.objectStore(CHAPTER_METADATA_STORE);
            const request = store.count();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });

        const cacheCount = await new Promise<number>((resolve, reject) => {
            const transaction = db.transaction([CACHED_AUDIO_STORE], 'readonly');
            const store = transaction.objectStore(CACHED_AUDIO_STORE);
            const request = store.count();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });

        // Try to get storage estimate
        let estimatedSize: number | undefined;
        if ('storage' in navigator && 'estimate' in navigator.storage) {
            try {
                const estimate = await navigator.storage.estimate();
                estimatedSize = estimate.usage;
            } catch (e) {
                console.warn('Could not estimate storage usage:', e);
            }
        }

        return {
            backgroundAudioCount: bgCount,
            chapterMetadataCount: chapterCount,
            cachedAudioCount: cacheCount,
            estimatedSize,
        };
    }

    async clearAllData(): Promise<void> {
        await this.clearAllCachedAudio();
        await this.clearAllChapterMetadata();
        // Note: We don't clear background audio automatically
    }
}

const storageService = new StorageService();
export default storageService;
export type { ChapterMetadata, BackgroundAudioRecord, CachedAudioRecord };
