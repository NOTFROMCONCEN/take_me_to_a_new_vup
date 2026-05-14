/**
 * 本地开发 / 预览服务器
 * - `npm run dev`     → 提供 src/ + data/ + face_img/
 * - `npm run preview` → 提供 dist/，模拟 EdgeOne 静态部署结果
 */

const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5090;
const serveDist = process.argv.includes('--dist');
const webRoot = serveDist ? path.join(__dirname, 'dist') : path.join(__dirname, 'src');

// ── 安全响应头 ──
app.use((_, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; " +
            "script-src 'self'; " +
            "style-src 'self' 'unsafe-inline'; " +
            "img-src 'self' https://i0.hdslb.com https://i1.hdslb.com https://i2.hdslb.com data:; " +
            "connect-src 'self'; " +
            "font-src 'self'; " +
            "frame-ancestors 'none'; " +
            "base-uri 'self'; " +
            "form-action 'self';"
    );
    next();
});

if (serveDist) {
    // dist 模式：静态资源加长期缓存（构建产物文件名不变时可安全缓存）
    app.use(
        express.static(webRoot, {
            maxAge: '1h',
            immutable: false
        })
    );
} else {
    // 开发模式：禁用缓存，方便调试
    app.use(
        express.static(webRoot, {
            maxAge: 0,
            etag: false
        })
    );
    app.use(
        '/face_img',
        express.static(path.join(__dirname, 'face_img'), {
            maxAge: '1d'
        })
    );
    app.get('/vup.json', (_req, res) => {
        res.sendFile(path.join(__dirname, 'data', 'vup.json'));
    });
    app.get('/manifest.json', (_req, res) => {
        res.sendFile(path.join(__dirname, 'src', 'manifest.json'));
    });
    app.get('/icon.svg', (_req, res) => {
        res.sendFile(path.join(__dirname, 'src', 'icon.svg'));
    });
}

app.get('*', (_req, res) => {
    res.sendFile(path.join(webRoot, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`服务器已启动：http://localhost:${PORT}`);
    console.log(serveDist ? '模式：dist 预览（接近 EdgeOne 线上效果）' : '模式：src 开发');
});
