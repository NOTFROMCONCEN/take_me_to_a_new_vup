/**
 * 纯静态构建脚本
 * 将 Node 工作流下的源码组装为可直接部署到 EdgeOne Pages 的 dist/ 目录。
 *
 * 构建产物结构：
 *   dist/
 *     index.html              (内联关键 CSS，引用带哈希的 JS/CSS)
 *     style.{hash}.css        (压缩后的 CSS)
 *     script.{hash}.js        (压缩后的 JS)
 *     vup.json
 *     face_img/
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { minify: terserMinify } = require('terser');
const csso = require('csso');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');
const SRC = path.join(ROOT, 'src');
const DATA = path.join(ROOT, 'data');
const FACE_IMG = path.join(ROOT, 'face_img');

// ── 工具函数 ──

function formatBytes(bytes) {
    if (bytes === 0) {
        return '0 B';
    }
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

function hashContent(content) {
    return crypto.createHash('md5').update(content).digest('hex').slice(0, 8);
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

async function build() {
    // ── 清理并重建 dist/ ──────────────────────────────────────
    const buildStartTime = Date.now();
    fs.rmSync(DIST, { recursive: true, force: true });
    fs.mkdirSync(path.join(DIST, 'face_img'), { recursive: true });

    // ── 压缩 CSS ──────────────────────────────────────────────
    const cssSource = fs.readFileSync(path.join(SRC, 'style.css'), 'utf-8');
    const cssResult = csso.minify(cssSource, { restructureOn: true });
    const cssHash = hashContent(cssResult.css);
    const cssFileName = `style.${cssHash}.css`;
    fs.writeFileSync(path.join(DIST, cssFileName), cssResult.css);
    console.log(`✔  ${cssFileName}  (压缩 ${formatBytes(cssSource.length)} → ${formatBytes(cssResult.css.length)})`);

    // ── 压缩 JS ───────────────────────────────────────────────
    const jsSource = fs.readFileSync(path.join(SRC, 'script.js'), 'utf-8');
    const jsResult = await terserMinify(jsSource, {
        compress: {
            drop_console: false,
            drop_debugger: true,
            passes: 2
        },
        mangle: true,
        format: {
            comments: false
        }
    });
    if (!jsResult || !jsResult.code) {
        console.error('JS 压缩失败');
        process.exit(1);
    }
    const jsHash = hashContent(jsResult.code);
    const jsFileName = `script.${jsHash}.js`;
    fs.writeFileSync(path.join(DIST, jsFileName), jsResult.code);
    console.log(`✔  ${jsFileName}  (压缩 ${formatBytes(jsSource.length)} → ${formatBytes(jsResult.code.length)})`);

    // ── 提取关键 CSS 并内联到 HTML ────────────────────────────
    const criticalCssRules = [
        '*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}',
        '.skip-link{position:absolute;top:-100%;left:16px;z-index:9999;padding:12px 24px;background:#f8fafc;color:#0f172a;text-decoration:none;border-radius:8px;font-weight:600;font-size:.95em;transition:top .2s ease;box-shadow:0 4px 12px rgba(0,0,0,.3)}.skip-link:focus{top:16px}',
        '.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}',
        ':focus-visible{outline:2px solid #a78bfa;outline-offset:2px}',
        'button:focus,a:focus,input:focus{outline:none}',
        'body{font-family:"Segoe UI","PingFang SC","Noto Sans SC",sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at top,rgba(148,163,184,.08),transparent 34%),linear-gradient(180deg,#0f172a 0%,#111827 100%);color:#e5e7eb;overflow:hidden}',
        'body.modal-open{overflow:hidden}',
        '.bg{position:fixed;inset:0;z-index:0;pointer-events:none}',
        '.orb{position:absolute;border-radius:50%;filter:blur(120px)}',
        '.orb-1{width:520px;height:520px;background:radial-gradient(circle,rgba(56,189,248,.12) 0%,transparent 72%);top:-160px;left:-120px;animation:d-1 22s ease-in-out infinite alternate}',
        '.orb-2{width:420px;height:420px;background:radial-gradient(circle,rgba(255,255,255,.05) 0%,transparent 70%);bottom:-140px;right:-120px;animation:d-2 24s ease-in-out infinite alternate}',
        '.orb-3{width:320px;height:320px;background:radial-gradient(circle,rgba(148,163,184,.09) 0%,transparent 70%);top:56%;left:56%;transform:translate(-50%,-50%);animation:d-3 26s ease-in-out infinite alternate}',
        '@keyframes d-1{to{transform:translate(200px,220px) scale(1.3)}}',
        '@keyframes d-2{to{transform:translate(-180px,-160px) scale(1.2)}}',
        '@keyframes d-3{to{transform:translate(calc(-50% + 140px),calc(-50% - 100px)) scale(.75)}}',
        '.topbar{position:fixed;top:22px;left:22px;right:22px;z-index:3;display:flex;align-items:center;justify-content:space-between;pointer-events:none}',
        '.topbar-btn,.clock-chip{pointer-events:auto}',
        '.topbar-btn{display:inline-flex;align-items:center;gap:10px;min-height:44px;padding:0 16px;border:1px solid rgba(255,255,255,.08);border-radius:999px;background:rgba(15,23,42,.72);color:rgba(229,231,235,.92);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);box-shadow:0 8px 24px rgba(0,0,0,.18);cursor:pointer;transition:transform .16s ease,background .16s ease,border-color .16s ease}',
        '.clock-chip{min-width:116px;padding:11px 16px;border-radius:999px;background:rgba(15,23,42,.72);border:1px solid rgba(255,255,255,.08);color:#e5e7eb;font-size:.92rem;font-weight:600;text-align:center;letter-spacing:.06em;font-variant-numeric:tabular-nums;box-shadow:0 8px 24px rgba(0,0,0,.18);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px)}',
        '.card{position:relative;z-index:1;display:flex;flex-direction:row;align-items:center;gap:0;width:640px;padding:36px;border-radius:24px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);backdrop-filter:blur(30px);-webkit-backdrop-filter:blur(30px);box-shadow:0 32px 80px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.04);animation:card-in .5s ease-out}',
        '@keyframes card-in{from{opacity:0;transform:translateY(24px) scale(.96)}to{opacity:1;transform:translateY(0) scale(1)}}'
    ];

    const criticalCss = criticalCssRules.join('\n');

    // ── 处理 HTML ─────────────────────────────────────────────
    let htmlContent = fs.readFileSync(path.join(SRC, 'index.html'), 'utf-8');

    // 移除原有 preload link
    htmlContent = htmlContent.replace(/\s*<link rel="preload" href="\/style\.css" as="style">\n/, '\n');

    // 替换 stylesheet link 为带哈希版本，使用 media="print" 技巧异步加载
    htmlContent = htmlContent.replace(
        '<link rel="stylesheet" href="/style.css">',
        `<style>${criticalCss}</style>\n    <link rel="stylesheet" href="/${cssFileName}" media="print" onload="this.media='all'">\n    <noscript><link rel="stylesheet" href="/${cssFileName}"></noscript>`
    );

    // 替换 script src 为带哈希版本
    htmlContent = htmlContent.replace(
        '<script src="/script.js" defer></script>',
        `<script src="/${jsFileName}" defer></script>`
    );

    fs.writeFileSync(path.join(DIST, 'index.html'), htmlContent);
    console.log(`✔  index.html  (内联关键 CSS + 引用哈希资源)`);

    // ── manifest.json ────────────────────────────────────────
    if (fs.existsSync(path.join(SRC, 'manifest.json'))) {
        fs.copyFileSync(path.join(SRC, 'manifest.json'), path.join(DIST, 'manifest.json'));
        console.log('✔  manifest.json');
    }

    // ── icon.svg ─────────────────────────────────────────────
    if (fs.existsSync(path.join(SRC, 'icon.svg'))) {
        fs.copyFileSync(path.join(SRC, 'icon.svg'), path.join(DIST, 'icon.svg'));
        console.log('✔  icon.svg');
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

        // 检查是否存在优化后的 WebP 图片
        const optimizedDir = path.join(DIST, 'face_img');
        const webpFiles = fs.readdirSync(optimizedDir).filter((f) => f.endsWith('.webp'));
        if (webpFiles.length > 0) {
            console.log(`✔  WebP 优化图片 (${webpFiles.length} files)`);
        }
    } else {
        console.warn('⚠  face_img/ 不存在，头像将通过 B 站 CDN fallback 加载');
    }

    // ── 构建报告 ──
    console.log('\n── 构建报告 ──');

    const htmlSize = getFileSize(path.join(DIST, 'index.html'));
    const cssSize = getFileSize(path.join(DIST, cssFileName));
    const jsSize = getFileSize(path.join(DIST, jsFileName));
    const jsonSize = getFileSize(path.join(DIST, 'vup.json'));
    const imgInfo = getDirectorySize(path.join(DIST, 'face_img'));

    const originalCssSize = cssSource.length;
    const originalJsSize = jsSource.length;

    console.log(`  index.html      ${formatBytes(htmlSize)}`);
    console.log(
        `  ${cssFileName}  ${formatBytes(cssSize)}  (原 ${formatBytes(originalCssSize)}, 节省 ${((1 - cssSize / originalCssSize) * 100).toFixed(1)}%)`
    );
    console.log(
        `  ${jsFileName}   ${formatBytes(jsSize)}  (原 ${formatBytes(originalJsSize)}, 节省 ${((1 - jsSize / originalJsSize) * 100).toFixed(1)}%)`
    );
    console.log(`  vup.json        ${formatBytes(jsonSize)}`);
    console.log(`  face_img/       ${imgInfo.fileCount} files, ${formatBytes(imgInfo.totalSize)}`);

    const totalSize = htmlSize + cssSize + jsSize + jsonSize + imgInfo.totalSize;
    console.log(`  ─────────────────────────`);
    console.log(`  总计             ${formatBytes(totalSize)}`);

    const buildDuration = Date.now() - buildStartTime;
    console.log(`  构建耗时         ${buildDuration}ms`);
    console.log(`  构建时间         ${new Date().toISOString()}`);

    console.log('\n构建完成 → dist/');
}

build().catch((err) => {
    console.error('构建失败:', err);
    process.exit(1);
});
