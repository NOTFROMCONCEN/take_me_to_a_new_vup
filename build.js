/**
 * 纯静态构建脚本
 * 将 Node 工作流下的源码组装为可直接部署到 EdgeOne Pages 的 dist/ 目录。
 *
 * 构建产物结构：
 *   dist/
 *     index.html
 *     style.css
 *     script.js
 *     vup.json
 *     face_img/
 */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');
const SRC = path.join(ROOT, 'src');
const DATA = path.join(ROOT, 'data');
const FACE_IMG = path.join(ROOT, 'face_img');

// ── 清理并重建 dist/ ──────────────────────────────────────
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(path.join(DIST, 'face_img'), { recursive: true });

// ── src/ 前端文件平铺到 dist/ ────────────────────────────
for (const file of fs.readdirSync(SRC)) {
    fs.copyFileSync(path.join(SRC, file), path.join(DIST, file));
    console.log(`✔  ${file}`);
}

// ── data/vup.json ────────────────────────────────────────
fs.copyFileSync(path.join(DATA, 'vup.json'), path.join(DIST, 'vup.json'));
console.log('✔  vup.json');

// ── face_img/ 头像复制 ───────────────────────────────────
if (fs.existsSync(FACE_IMG)) {
    let count = 0;
    for (const file of fs.readdirSync(FACE_IMG)) {
        fs.copyFileSync(
            path.join(FACE_IMG, file),
            path.join(DIST, 'face_img', file)
        );
        count++;
    }
    console.log(`✔  face_img/ (${count} files)`);
} else {
    console.warn('⚠  face_img/ 不存在，头像将通过 B 站 CDN fallback 加载');
}

console.log('\n构建完成 → dist/');
