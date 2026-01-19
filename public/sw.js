// Service Worker for offline playback capability
const CACHE_NAME = 'ataraxia-v1';
const AUDIO_CACHE = 'ataraxia-audio-v1';

const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/favicon.ico',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME && name !== AUDIO_CACHE)
                    .map((name) => caches.delete(name))
            );
        })
    );
    self.clients.claim();
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
    const { request } = event;

    // Handle audio API requests differently
    if (request.url.includes('elevenlabs.io') || request.url.includes('googleapis.com')) {
        event.respondWith(
            caches.open(AUDIO_CACHE).then((cache) => {
                return cache.match(request).then((cached) => {
                    if (cached) {
                        return cached;
                    }

                    return fetch(request).then((response) => {
                        // Cache successful audio responses
                        if (response.ok && response.headers.get('content-type')?.includes('audio')) {
                            cache.put(request, response.clone());
                        }
                        return response;
                    });
                });
            })
        );
        return;
    }

    // For other requests, try cache first, then network
    event.respondWith(
        caches.match(request).then((cached) => {
            return cached || fetch(request).then((response) => {
                // Cache successful responses
                if (response.ok) {
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, response.clone());
                    });
                }
                return response;
            });
        }).catch(() => {
            // Return offline page if available
            if (request.mode === 'navigate') {
                return caches.match('/index.html');
            }
        })
    );
});

// Message event - handle cache management from main thread
self.addEventListener('message', (event) => {
    if (event.data.type === 'CACHE_AUDIO') {
        const { url, data } = event.data;
        caches.open(AUDIO_CACHE).then((cache) => {
            const response = new Response(data);
            cache.put(url, response);
        });
    } else if (event.data.type === 'CLEAR_CACHE') {
        caches.delete(AUDIO_CACHE);
    }
});
