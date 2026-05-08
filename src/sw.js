/**
 * Service Worker
 * 缓存静态资源和 VUP 数据，支持离线访问
 */

const CACHE_NAME = 'vup-random-v1';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/script.js',
    '/vup.json'
];

// 安装时缓存静态资源
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

// 激活时清理旧缓存
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            );
        })
    );
    self.clients.claim();
});

// 拦截请求，优先使用缓存
self.addEventListener('fetch', (event) => {
    // 跳过跨域请求（如 B 站头像）
    if (!event.request.url.startsWith(self.location.origin)) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cached) => {
            if (cached) {
                // 缓存命中，后台更新
                fetchAndCache(event.request);
                return cached;
            }
            // 缓存未命中，网络请求并缓存
            return fetchAndCache(event.request);
        })
    );
});

function fetchAndCache(request) {
    return fetch(request).then((response) => {
        // 只缓存成功的响应
        if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseClone);
            });
        }
        return response;
    }).catch(() => {
        // 网络失败，尝试返回缓存（即使过期）
        return caches.match(request);
    });
}
