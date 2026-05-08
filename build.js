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

// ── 工具函数 ──

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function getFileSize(filePath) {
    try {
        return fs.statSync(filePath).size;
    } catch {
        return 0;
    }
}

function getDirectorySize(dirPath) {
    let totalSize = 0;
    let fileCount = 0;
    try {
        for (const file of fs.readdirSync(dirPath)) {
            const filePath = path.join(dirPath, file);
            const stat = fs.statSync(filePath);
            if (stat.isFile()) {
                totalSize += stat.size;
                fileCount++;
            }
        }
    } catch {
        // 目录不存在
    }
    return { totalSize, fileCount };
}

// ── 前置校验 ──

const errors = [];

if (!fs.existsSync(path.join(DATA, 'vup.json'))) {
    errors.push('data/vup.json 不存在，请先运行 npm run prefetch');
} else {
    try {
        const vups = JSON.parse(fs.readFileSync(path.join(DATA, 'vup.json'), 'utf-8'));
        if (!Array.isArray(vups) || vups.length === 0) {
            errors.push('data/vup.json 为空或格式不正确');
        }
    } catch (e) {
        errors.push(`data/vup.json 解析失败: ${e.message}`);
    }
}

if (!fs.existsSync(path.join(SRC, 'index.html'))) {
    errors.push('src/index.html 不存在');
}
if (!fs.existsSync(path.join(SRC, 'script.js'))) {
    errors.push('src/script.js 不存在');
}
if (!fs.existsSync(path.join(SRC, 'style.css'))) {
    errors.push('src/style.css 不存在');
}

if (errors.length > 0) {
    console.error('构建前校验失败：\n');
    for (const err of errors) {
        console.error(`  ✘  ${err}`);
    }
    process.exit(1);
}

// ── 清理并重建 dist/ ──────────────────────────────────────
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(path.join(DIST, 'face_img'), { recursive: true });

// ── src/ 前端文件平铺到 dist/ ────────────────────────────
for (const file of fs.readdirSync(SRC)) {
    const srcFile = path.join(SRC, file);
    if (fs.statSync(srcFile).isFile()) {
        fs.copyFileSync(srcFile, path.join(DIST, file));
        console.log(`✔  ${file}`);
    }
}

// ── data/vup.json ────────────────────────────────────────
fs.copyFileSync(path.join(DATA, 'vup.json'), path.join(DIST, 'vup.json'));
console.log('✔  vup.json');

// ── face_img/ 头像复制 ───────────────────────────────────
if (fs.existsSync(FACE_IMG)) {
    let count = 0;
    for (const file of fs.readdirSync(FACE_IMG)) {
        const srcFile = path.join(FACE_IMG, file);
        if (fs.statSync(srcFile).isFile()) {
            fs.copyFileSync(srcFile, path.join(DIST, 'face_img', file));
            count++;
        }
    }
    console.log(`✔  face_img/ (${count} files)`);
} else {
    console.warn('⚠  face_img/ 不存在，头像将通过 B 站 CDN fallback 加载');
}

// ── 构建报告 ──
console.log('\n── 构建报告 ──');

const htmlSize = getFileSize(path.join(DIST, 'index.html'));
const cssSize = getFileSize(path.join(DIST, 'style.css'));
const jsSize = getFileSize(path.join(DIST, 'script.js'));
const jsonSize = getFileSize(path.join(DIST, 'vup.json'));
const imgInfo = getDirectorySize(path.join(DIST, 'face_img'));

console.log(`  index.html   ${formatBytes(htmlSize)}`);
console.log(`  style.css    ${formatBytes(cssSize)}`);
console.log(`  script.js    ${formatBytes(jsSize)}`);
console.log(`  vup.json     ${formatBytes(jsonSize)}`);
console.log(`  face_img/    ${imgInfo.fileCount} files, ${formatBytes(imgInfo.totalSize)}`);

const totalSize = htmlSize + cssSize + jsSize + jsonSize + imgInfo.totalSize;
console.log(`  ─────────────────────`);
console.log(`  总计          ${formatBytes(totalSize)}`);

console.log('\n构建完成 → dist/');
