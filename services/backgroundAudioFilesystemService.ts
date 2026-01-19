/**
 * Background Audio Filesystem Storage Service
 *
 * Two-tier storage system for background audio files:
 * 1. Browser Cache API (first tier - fast access)
 * 2. Local Filesystem via Node.js (second tier - persistent storage)
 *
 * All processing happens on the client's machine.
 */

const SERVER_URL = 'http://localhost:3001';
const CACHE_NAME = 'ataraxia-background-audio-v1';

export interface FilesystemBackgroundAudio {
    filename: string;
    path: string;
    size: number;
    modified: number;
    created: number;
    inCache: boolean; // Whether it's currently in browser cache
    onDisk: boolean;  // Whether it's on local filesystem
}

class BackgroundAudioFilesystemService {
    private currentDirectory: string | null = null;
    private cache: Cache | null = null;

    constructor() {
        this.initializeCache();
    }

    /**
     * Initialize the Cache API
     */
    private async initializeCache(): Promise<void> {
        if ('caches' in window) {
            try {
                this.cache = await caches.open(CACHE_NAME);
                console.log('✓ Background audio cache initialized');
            } catch (error) {
                console.warn('Failed to initialize cache:', error);
            }
        } else {
            console.warn('Cache API not available in this browser');
        }
    }

    /**
     * Check if Node.js server is available
     */
    async isServerAvailable(): Promise<boolean> {
        try {
            const response = await fetch(`${SERVER_URL}/health`, { method: 'GET' });
            return response.ok;
        } catch {
            return false;
        }
    }

    /**
     * Get the current background audio directory from the server
     */
    async getDirectory(): Promise<string | null> {
        try {
            const response = await fetch(`${SERVER_URL}/background-audio/directory`);
            if (!response.ok) return null;

            const data = await response.json();
            this.currentDirectory = data.absolutePath;
            return data.absolutePath;
        } catch (error) {
            console.error('Failed to get directory:', error);
            return null;
        }
    }

    /**
     * Set a custom directory for background audio storage
     */
    async setDirectory(directory: string): Promise<{ success: boolean; path?: string; error?: string }> {
        try {
            const response = await fetch(`${SERVER_URL}/background-audio/directory`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ directory })
            });

            const data = await response.json();

            if (data.success) {
                this.currentDirectory = data.directory;
                return { success: true, path: data.directory };
            } else {
                return { success: false, error: data.error || 'Failed to set directory' };
            }
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }

    /**
     * List all background audio files from local filesystem
     * Also checks which files are in cache
     */
    async listFiles(customDirectory?: string): Promise<FilesystemBackgroundAudio[]> {
        try {
            const url = new URL(`${SERVER_URL}/background-audio/list`);
            if (customDirectory) {
                url.searchParams.append('directory', customDirectory);
            }

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('Failed to list files');
            }

            const data = await response.json();

            if (!data.files || data.files.length === 0) {
                return [];
            }

            // Check which files are in cache
            const filesWithCache = await Promise.all(
                data.files.map(async (file: any) => {
                    const inCache = await this.isInCache(file.name);
                    return {
                        filename: file.name,
                        path: file.path,
                        size: file.size,
                        modified: file.modified,
                        created: file.created,
                        inCache,
                        onDisk: true
                    };
                })
            );

            return filesWithCache;

        } catch (error) {
            console.error('Failed to list files:', error);
            return [];
        }
    }

    /**
     * Check if a file is in the browser cache
     */
    private async isInCache(filename: string): Promise<boolean> {
        if (!this.cache) return false;

        try {
            const cacheKey = this.getCacheKey(filename);
            const cachedResponse = await this.cache.match(cacheKey);
            return !!cachedResponse;
        } catch {
            return false;
        }
    }

    /**
     * Generate cache key for a filename
     */
    private getCacheKey(filename: string): string {
        return `bg-audio://${filename}`;
    }

    /**
     * Save background audio to local filesystem
     * Automatically adds to cache for fast access
     */
    async saveToFilesystem(blob: Blob, filename: string, customDirectory?: string): Promise<{
        success: boolean;
        path?: string;
        size?: number;
        error?: string;
    }> {
        try {
            const formData = new FormData();
            formData.append('audio', blob, filename);
            formData.append('filename', filename);

            if (customDirectory) {
                formData.append('customDirectory', customDirectory);
            }

            const response = await fetch(`${SERVER_URL}/background-audio/save`, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (data.success) {
                // Add to cache for fast future access
                await this.addToCache(filename, blob);

                return {
                    success: true,
                    path: data.path,
                    size: data.size
                };
            } else {
                return {
                    success: false,
                    error: data.error || 'Failed to save file'
                };
            }
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Load background audio from filesystem
     * Uses cache if available, otherwise loads from disk and caches
     */
    async loadFromFilesystem(filename: string, audioContext: AudioContext, customDirectory?: string): Promise<{
        success: boolean;
        audioBuffer?: AudioBuffer;
        fromCache?: boolean;
        error?: string;
    }> {
        try {
            // Try cache first (fastest)
            const cachedBuffer = await this.loadFromCache(filename, audioContext);
            if (cachedBuffer) {
                console.log(`✓ Loaded "${filename}" from cache (fast)`);
                return {
                    success: true,
                    audioBuffer: cachedBuffer,
                    fromCache: true
                };
            }

            // Load from filesystem
            const url = new URL(`${SERVER_URL}/background-audio/load/${encodeURIComponent(filename)}`);
            if (customDirectory) {
                url.searchParams.append('directory', customDirectory);
            }

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('File not found on disk');
            }

            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

            // Add to cache for future fast access
            const blob = new Blob([arrayBuffer], { type: 'audio/wav' });
            await this.addToCache(filename, blob);

            console.log(`✓ Loaded "${filename}" from disk and cached`);

            return {
                success: true,
                audioBuffer,
                fromCache: false
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Add file to browser cache
     */
    private async addToCache(filename: string, blob: Blob): Promise<void> {
        if (!this.cache) {
            console.warn('Cache not available, skipping cache storage');
            return;
        }

        try {
            const cacheKey = this.getCacheKey(filename);
            const response = new Response(blob, {
                headers: {
                    'Content-Type': 'audio/wav',
                    'Cache-Control': 'max-age=31536000' // 1 year
                }
            });

            await this.cache.put(cacheKey, response);
            console.log(`✓ Cached "${filename}" in browser`);
        } catch (error) {
            console.warn('Failed to cache file:', error);
        }
    }

    /**
     * Load file from browser cache
     */
    private async loadFromCache(filename: string, audioContext: AudioContext): Promise<AudioBuffer | null> {
        if (!this.cache) return null;

        try {
            const cacheKey = this.getCacheKey(filename);
            const cachedResponse = await this.cache.match(cacheKey);

            if (!cachedResponse) return null;

            const arrayBuffer = await cachedResponse.arrayBuffer();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

            return audioBuffer;
        } catch (error) {
            console.warn('Failed to load from cache:', error);
            return null;
        }
    }

    /**
     * Delete file from both cache and filesystem
     */
    async deleteFile(filename: string, customDirectory?: string): Promise<{
        success: boolean;
        error?: string;
    }> {
        try {
            // Delete from cache first
            if (this.cache) {
                const cacheKey = this.getCacheKey(filename);
                await this.cache.delete(cacheKey);
            }

            // Delete from filesystem
            const url = new URL(`${SERVER_URL}/background-audio/delete/${encodeURIComponent(filename)}`);
            if (customDirectory) {
                url.searchParams.append('directory', customDirectory);
            }

            const response = await fetch(url, { method: 'DELETE' });
            const data = await response.json();

            if (data.success) {
                console.log(`✓ Deleted "${filename}" from cache and disk`);
                return { success: true };
            } else {
                return { success: false, error: data.error };
            }
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Preload files into cache for faster access
     */
    async preloadToCache(filenames: string[], audioContext: AudioContext): Promise<void> {
        console.log(`Preloading ${filenames.length} files to cache...`);

        for (const filename of filenames) {
            const inCache = await this.isInCache(filename);
            if (!inCache) {
                await this.loadFromFilesystem(filename, audioContext);
            }
        }

        console.log('✓ Preload complete');
    }

    /**
     * Clear all cached background audio
     */
    async clearCache(): Promise<void> {
        if (!this.cache) return;

        try {
            const keys = await this.cache.keys();
            const bgAudioKeys = keys.filter(request =>
                request.url.startsWith('bg-audio://')
            );

            await Promise.all(
                bgAudioKeys.map(request => this.cache!.delete(request))
            );

            console.log(`✓ Cleared ${bgAudioKeys.length} files from cache`);
        } catch (error) {
            console.error('Failed to clear cache:', error);
        }
    }

    /**
     * Get cache statistics
     */
    async getCacheStats(): Promise<{
        totalFiles: number;
        totalSize: number;
        files: string[];
    }> {
        if (!this.cache) {
            return { totalFiles: 0, totalSize: 0, files: [] };
        }

        try {
            const keys = await this.cache.keys();
            const bgAudioKeys = keys.filter(request =>
                request.url.startsWith('bg-audio://')
            );

            let totalSize = 0;
            const files: string[] = [];

            for (const request of bgAudioKeys) {
                const response = await this.cache.match(request);
                if (response) {
                    const blob = await response.blob();
                    totalSize += blob.size;
                    // Extract filename from cache key
                    const filename = request.url.replace('bg-audio://', '');
                    files.push(filename);
                }
            }

            return {
                totalFiles: bgAudioKeys.length,
                totalSize,
                files
            };
        } catch (error) {
            console.error('Failed to get cache stats:', error);
            return { totalFiles: 0, totalSize: 0, files: [] };
        }
    }
}

export default new BackgroundAudioFilesystemService();
