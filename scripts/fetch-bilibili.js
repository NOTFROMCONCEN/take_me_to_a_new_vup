/**
 * 构建前数据预取脚本
 *
 * 从 data/vup.json 读取所有 VUP 条目，
 * 根据 uid 字段调用 B 站公开卡片接口，
 * 自动更新头像（avatar）、签名（intro），
 * 并将头像下载到 face_img/（文件名为 {uid}.jpg）。
 *
 * 用法：
 *   node scripts/fetch-bilibili.js          # 更新全部
 *   node scripts/fetch-bilibili.js --force  # 强制覆盖已有数据
 *
 * B 站卡片接口（公开，无需鉴权）：
 *   https://api.bilibili.com/x/web-interface/card?mid={uid}&photo=true
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const VUP_JSON = path.join(ROOT, 'data', 'vup.json');
const FACE_IMG = path.join(ROOT, 'face_img');
const FORCE = process.argv.includes('--force');
const DELAY_MS = 800; // 两次请求间隔，避免触发风控
const MAX_RETRIES = 3; // 最大重试次数
const RETRY_DELAY_MS = 2000; // 重试间隔

// ── 工具函数 ─────────────────────────────────────────────

function get(url, retries = MAX_RETRIES) {
    return new Promise((resolve, reject) => {
        const attempt = (remaining) => {
            const req = https.get(
                url,
                {
                    headers: {
                        'User-Agent':
                            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
                            'AppleWebKit/537.36 (KHTML, like Gecko) ' +
                            'Chrome/124.0.0.0 Safari/537.36',
                        Referer: 'https://www.bilibili.com',
                        Origin: 'https://www.bilibili.com'
                    }
                },
                (res) => {
                    let data = '';
                    res.on('data', (chunk) => (data += chunk));
                    res.on('end', () => resolve({ status: res.statusCode, body: data }));
                }
            );
            req.on('error', (err) => {
                if (remaining > 0) {
                    console.warn(`   请求失败 (${err.message})，剩余重试 ${remaining} 次...`);
                    setTimeout(() => attempt(remaining - 1), RETRY_DELAY_MS);
                } else {
                    reject(err);
                }
            });
            req.setTimeout(15000, () => {
                req.destroy();
                if (remaining > 0) {
                    console.warn(`   请求超时，剩余重试 ${remaining} 次...`);
                    setTimeout(() => attempt(remaining - 1), RETRY_DELAY_MS);
                } else {
                    reject(new Error('timeout after retries'));
                }
            });
        };
        attempt(retries);
    });
}

function downloadImage(url, destPath, retries = MAX_RETRIES) {
    // B 站部分旧头像 URL 是 http://，自动升级为 https://
    const safeUrl = url.replace(/^http:\/\//, 'https://');
    return new Promise((resolve, reject) => {
        const attempt = (remaining) => {
            const file = fs.createWriteStream(destPath);
            const req = https.get(
                safeUrl,
                {
                    headers: {
                        'User-Agent':
                            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
                            'AppleWebKit/537.36 (KHTML, like Gecko) ' +
                            'Chrome/124.0.0.0 Safari/537.36',
                        Referer: 'https://space.bilibili.com'
                    }
                },
                (res) => {
                    if (res.statusCode === 302 || res.statusCode === 301) {
                        file.close();
                        fs.unlink(destPath, () => {});
                        // 跟随重定向，同样升级为 https
                        const location = (res.headers.location || '').replace(/^http:\/\//, 'https://');
                        downloadImage(location, destPath, remaining).then(resolve).catch(reject);
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
                    setTimeout(() => attempt(remaining - 1), RETRY_DELAY_MS);
                } else {
                    reject(err);
                }
            });
            req.setTimeout(20000, () => {
                req.destroy();
                file.close();
                fs.unlink(destPath, () => {});
                if (remaining > 0) {
                    console.warn(`   头像下载超时，剩余重试 ${remaining} 次...`);
                    setTimeout(() => attempt(remaining - 1), RETRY_DELAY_MS);
                } else {
                    reject(new Error('image download timeout after retries'));
                }
            });
        };
        attempt(retries);
    });
}

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

function uidFromUrl(spaceUrl) {
    const m = spaceUrl.match(/space\.bilibili\.com\/(\d+)/);
    return m ? m[1] : null;
}

// ── 主流程 ───────────────────────────────────────────────

async function main() {
    if (!fs.existsSync(FACE_IMG)) {
        fs.mkdirSync(FACE_IMG, { recursive: true });
    }

    const vups = JSON.parse(fs.readFileSync(VUP_JSON, 'utf-8'));
    let updated = 0;
    let skipped = 0;
    let failed = 0;

    for (const vup of vups) {
        const uid = uidFromUrl(vup.url || '');
        if (!uid) {
            console.warn(`⚠  ${vup.name}：无法从 URL 提取 UID，跳过`);
            skipped++;
            continue;
        }

        const localAvatar = path.join(FACE_IMG, `${vup.name}.jpg`);
        const hasAvatar = vup.avatar && fs.existsSync(localAvatar);
        const hasIntro = vup.intro && vup.intro.trim().length > 0;

        if (!FORCE && hasAvatar && hasIntro) {
            console.log(`✔  ${vup.name}（已完整，跳过）`);
            skipped++;
            continue;
        }

        console.log(`→  正在获取 ${vup.name}（UID: ${uid}）...`);

        try {
            const { status, body } = await get(`https://api.bilibili.com/x/web-interface/card?mid=${uid}&photo=true`);

            if (status !== 200) {
                console.warn(`   HTTP ${status}，跳过`);
                failed++;
                continue;
            }

            const json = JSON.parse(body);
            if (json.code !== 0) {
                console.warn(`   B 站接口返回错误 ${json.code}: ${json.message}，跳过`);
                failed++;
                continue;
            }

            const card = json.data?.card;
            if (!card) {
                console.warn('   card 字段为空，跳过');
                failed++;
                continue;
            }

            // 注意：name 字段由用户维护，作为展示名 & face_img 文件名 key，不从 B 站覆盖

            // 签名 / 简介
            if (card.sign !== undefined) {
                vup.intro = card.sign.trim() || vup.intro;
            }

            // 头像（去掉 B 站 CDN 尺寸参数，取原图）
            if (card.face) {
                const faceUrl = card.face.replace(/@.*$/, '');
                vup.avatar = faceUrl;

                if (FORCE || !fs.existsSync(localAvatar)) {
                    try {
                        await downloadImage(faceUrl, localAvatar);
                        console.log(`   头像已保存 → face_img/${vup.name}.jpg`);
                    } catch (e) {
                        console.warn(`   头像下载失败: ${e.message}`);
                    }
                }
            }

            console.log(`   ✔  名字: ${vup.name}`);
            console.log(`   ✔  签名: ${(vup.intro || '').slice(0, 60)}`);
            updated++;
        } catch (e) {
            console.error(`   错误: ${e.message}`);
            failed++;
        }

        await sleep(DELAY_MS);
    }

    fs.writeFileSync(VUP_JSON, JSON.stringify(vups, null, 4), 'utf-8');
    console.log(`\n完成：更新 ${updated} 个，跳过 ${skipped} 个，失败 ${failed} 个 → data/vup.json`);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
