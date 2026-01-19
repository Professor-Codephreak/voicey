/**
 * Book Service - Async chapter loading from separate .md files
 * Manages fetching and caching of book content from public/chapters/
 */

export interface ChapterInfo {
    id: number;
    title: string;
    file: string;
}

export interface BookManifest {
    title: string;
    subtitle: string;
    author: string;
    chapters: ChapterInfo[];
}

export interface Chapter {
    title: string;
    content: string;
}

// Cache for loaded content
let manifestCache: BookManifest | null = null;
const chapterContentCache = new Map<number, string>();

// Base path for chapter files
const CHAPTERS_BASE_PATH = '/chapters';

/**
 * Load and cache the book manifest
 */
export async function loadBookManifest(): Promise<BookManifest> {
    if (manifestCache) {
        return manifestCache;
    }

    const response = await fetch(`${CHAPTERS_BASE_PATH}/manifest.json`);
    if (!response.ok) {
        throw new Error(`Failed to load book manifest: ${response.status} ${response.statusText}`);
    }

    manifestCache = await response.json();
    return manifestCache!;
}

/**
 * Load content for a specific chapter by index (0-based)
 */
export async function loadChapterContent(index: number): Promise<string> {
    // Check cache first
    if (chapterContentCache.has(index)) {
        return chapterContentCache.get(index)!;
    }

    const manifest = await loadBookManifest();

    if (index < 0 || index >= manifest.chapters.length) {
        throw new Error(`Chapter index ${index} out of range (0-${manifest.chapters.length - 1})`);
    }

    const chapterInfo = manifest.chapters[index];
    const response = await fetch(`${CHAPTERS_BASE_PATH}/${chapterInfo.file}`);

    if (!response.ok) {
        throw new Error(`Failed to load chapter ${index + 1}: ${response.status} ${response.statusText}`);
    }

    const content = await response.text();
    chapterContentCache.set(index, content);
    return content;
}

/**
 * Get a complete chapter (title + content) by index (0-based)
 */
export async function getChapter(index: number): Promise<Chapter> {
    const manifest = await loadBookManifest();

    if (index < 0 || index >= manifest.chapters.length) {
        throw new Error(`Chapter index ${index} out of range`);
    }

    const content = await loadChapterContent(index);

    return {
        title: manifest.chapters[index].title,
        content
    };
}

/**
 * Preload multiple chapters starting from a given index
 * Useful for prefetching upcoming chapters
 */
export async function preloadChapters(startIndex: number, count: number): Promise<void> {
    const manifest = await loadBookManifest();
    const maxIndex = Math.min(startIndex + count, manifest.chapters.length);

    const promises: Promise<string>[] = [];
    for (let i = startIndex; i < maxIndex; i++) {
        if (!chapterContentCache.has(i)) {
            promises.push(loadChapterContent(i));
        }
    }

    await Promise.all(promises);
}

/**
 * Get book metadata (title, subtitle, author, chapter count)
 */
export async function getBookMetadata(): Promise<{
    title: string;
    subtitle: string;
    author: string;
    chapterCount: number;
}> {
    const manifest = await loadBookManifest();
    return {
        title: manifest.title,
        subtitle: manifest.subtitle,
        author: manifest.author,
        chapterCount: manifest.chapters.length
    };
}

/**
 * Get array of all chapter titles
 */
export async function getChapterTitles(): Promise<string[]> {
    const manifest = await loadBookManifest();
    return manifest.chapters.map(ch => ch.title);
}

/**
 * Get chapter count
 */
export async function getChapterCount(): Promise<number> {
    const manifest = await loadBookManifest();
    return manifest.chapters.length;
}

/**
 * Clear all caches (useful for testing or reloading)
 */
export function clearBookCache(): void {
    manifestCache = null;
    chapterContentCache.clear();
}

/**
 * Check if a chapter is already cached
 */
export function isChapterCached(index: number): boolean {
    return chapterContentCache.has(index);
}

// Default export for convenience
const bookService = {
    loadBookManifest,
    loadChapterContent,
    getChapter,
    preloadChapters,
    getBookMetadata,
    getChapterTitles,
    getChapterCount,
    clearBookCache,
    isChapterCached
};

export default bookService;
