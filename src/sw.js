/**
 * Service Worker
 * 缓存静态资源和 VUP 数据，支持离线访问
 * 
 * 策略：
 *   - 静态资源（HTML/CSS/JS）：Stale-While-Revalidate
 *   - 数据文件（vup.json）：Network First，失败回退缓存
 *   - 图片资源：Cache First，后台更新
 */

const CACHE_NAME = 'vup-random-v2';
const DATA_CACHE = 'vup-data-v1';
const IMG_CACHE = 'vup-img-v1';

const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/script.js'
];

const DATA_ASSETS = ['/vup.json'];

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
                    .filter((name) => name !== CACHE_NAME && name !== DATA_CACHE && name !== IMG_CACHE)
                    .map((name) => caches.delete(name))
            );
        })
    );
    self.clients.claim();
});

// 拦截请求
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    
    // 跳过跨域请求
    if (url.origin !== self.location.origin) {
        return;
    }

    // 数据文件：Network First
    if (DATA_ASSETS.some(asset => url.pathname.endsWith(asset))) {
        event.respondWith(networkFirst(event.request, DATA_CACHE));
        return;
    }

    // 图片资源：Cache First
    if (url.pathname.startsWith('/face_img/')) {
        event.respondWith(cacheFirst(event.request, IMG_CACHE));
        return;
    }

    // 静态资源：Stale-While-Revalidate
    event.respondWith(staleWhileRevalidate(event.request, CACHE_NAME));
});

/**
 * Stale-While-Revalidate：先返回缓存，后台更新
 */
function staleWhileRevalidate(request, cacheName) {
    return caches.open(cacheName).then((cache) => {
        return cache.match(request).then((cached) => {
            const fetchPromise = fetch(request).then((response) => {
                if (response.status === 200) {
                    cache.put(request, response.clone());
                }
                return response;
            }).catch(() => cached);

            return cached || fetchPromise;
        });
    });
}

/**
 * Network First：优先网络，失败回退缓存
 */
function networkFirst(request, cacheName) {
    return fetch(request).then((response) => {
        if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(cacheName).then((cache) => {
                cache.put(request, responseClone);
            });
        }
        return response;
    }).catch(() => {
        return caches.match(request);
    });
}

/**
 * Cache First：优先缓存，未命中再请求网络
 */
function cacheFirst(request, cacheName) {
    return caches.open(cacheName).then((cache) => {
        return cache.match(request).then((cached) => {
            if (cached) return cached;
            return fetch(request).then((response) => {
                if (response.status === 200) {
                    const responseClone = response.clone();
                    cache.put(request, responseClone);
                }
                return response;
            });
        });
    });
}
