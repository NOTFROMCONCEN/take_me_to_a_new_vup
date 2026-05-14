/**
 * Bilibili API 公共工具库
 * 封装 HTTP 请求、重试逻辑、B站公开卡片接口调用
 */

const https = require('https');

const DEFAULT_UA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
    'AppleWebKit/537.36 (KHTML, like Gecko) ' +
    'Chrome/124.0.0.0 Safari/537.36';

const API_HEADERS = {
    'User-Agent': DEFAULT_UA,
    Referer: 'https://www.bilibili.com',
    Origin: 'https://www.bilibili.com'
};

const IMAGE_HEADERS = {
    'User-Agent': DEFAULT_UA,
    Referer: 'https://space.bilibili.com'
};

/**
 * 发起 HTTPS GET 请求，支持自动重试
 * @param {string} url 请求地址
 * @param {Object} [options] 请求选项
 * @param {number} [options.retries=3] 最大重试次数
 * @param {number} [options.retryDelay=2000] 重试间隔(ms)
 * @param {number} [options.timeout=15000] 超时时间(ms)
 * @param {Object} [options.headers] 自定义请求头
 * @returns {Promise<{status:number,body:string}>}
 */
function get(url, options = {}) {
    const { retries = 3, retryDelay = 2000, timeout = 15000, headers = API_HEADERS } = options;

    return new Promise((resolve, reject) => {
        const attempt = (remaining) => {
            const req = https.get(url, { headers }, (res) => {
                let data = '';
                res.on('data', (chunk) => (data += chunk));
                res.on('end', () => resolve({ status: res.statusCode, body: data }));
            });
            req.on('error', (err) => {
                if (remaining > 0) {
                    console.warn(`   请求失败 (${err.message})，剩余重试 ${remaining} 次...`);
                    setTimeout(() => attempt(remaining - 1), retryDelay);
                } else {
                    reject(err);
                }
            });
            req.setTimeout(timeout, () => {
                req.destroy();
                if (remaining > 0) {
                    console.warn(`   请求超时，剩余重试 ${remaining} 次...`);
                    setTimeout(() => attempt(remaining - 1), retryDelay);
                } else {
                    reject(new Error('timeout after retries'));
                }
            });
        };
        attempt(retries);
    });
}

/**
 * 获取 B站用户卡片信息
 * @param {string} uid 用户 UID
 * @param {Object} [options] 传递给 get() 的选项
 * @returns {Promise<Object|null>} 解析后的用户数据，失败返回 null
 */
async function fetchUserCard(uid, options = {}) {
    const url = `https://api.bilibili.com/x/web-interface/card?mid=${uid}&photo=true`;
    const res = await get(url, options);

    if (res.status !== 200) {
        throw new Error(`HTTP ${res.status}`);
    }

    const data = JSON.parse(res.body);
    if (data.code !== 0 || !data.data?.card) {
        throw new Error(`API 错误: ${data.message || data.code}`);
    }

    return data.data.card;
}

/**
 * 下载图片到指定路径，支持重定向和重试
 * @param {string} url 图片 URL
 * @param {string} destPath 目标路径
 * @param {Object} [options] 请求选项
 * @param {number} [options.retries=3] 最大重试次数
 * @param {number} [options.retryDelay=2000] 重试间隔(ms)
 * @returns {Promise<void>}
 */
function downloadImage(url, destPath, options = {}) {
    const fs = require('fs');
    const { retries = 3, retryDelay = 2000 } = options;

    // 自动升级 http 到 https
    const safeUrl = url.replace(/^http:\/\//, 'https://');

    return new Promise((resolve, reject) => {
        const attempt = (remaining) => {
            const file = fs.createWriteStream(destPath);
            const req = https.get(
                safeUrl,
                {
                    headers: IMAGE_HEADERS
                },
                (res) => {
                    if (res.statusCode === 302 || res.statusCode === 301) {
                        file.close();
                        fs.unlink(destPath, () => {});
                        const location = (res.headers.location || '').replace(/^http:\/\//, 'https://');
                        downloadImage(location, destPath, { retries: remaining, retryDelay })
                            .then(resolve)
                            .catch(reject);
                        return;
                    }
                    res.pipe(file);
                    file.on('finish', () => {
                        file.close();
                        resolve();
                    });
                }
            );
            req.on('error', (err) => {
                file.close();
                fs.unlink(destPath, () => {});
                if (remaining > 0) {
                    console.warn(`   头像下载失败 (${err.message})，剩余重试 ${remaining} 次...`);
                    setTimeout(() => attempt(remaining - 1), retryDelay);
                } else {
                    reject(err);
                }
            });
        };
        attempt(retries);
    });
}

/**
 * 安全处理头像 URL
 * @param {string} url
 * @returns {string}
 */
function safeAvatarUrl(url) {
    return String(url || '')
        .replace(/^http:\/\//, 'https://')
        .replace(/@.*$/, '');
}

/**
 * 从空间 URL 提取 UID
 * @param {string} spaceUrl
 * @returns {string|null}
 */
function uidFromUrl(spaceUrl) {
    const matched = String(spaceUrl || '').match(/space\.bilibili\.com\/(\d+)/);
    return matched ? matched[1] : null;
}

/**
 * 构建空间 URL
 * @param {string} uid
 * @returns {string}
 */
function buildSpaceUrl(uid) {
    return `https://space.bilibili.com/${uid}`;
}

module.exports = {
    get,
    fetchUserCard,
    downloadImage,
    safeAvatarUrl,
    uidFromUrl,
    buildSpaceUrl,
    API_HEADERS,
    IMAGE_HEADERS,
    DEFAULT_UA
};
