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

if (serveDist) {
    app.use(express.static(webRoot));
} else {
    app.use(express.static(webRoot));
    app.use('/face_img', express.static(path.join(__dirname, 'face_img')));
    app.get('/vup.json', (_req, res) => {
        res.sendFile(path.join(__dirname, 'data', 'vup.json'));
    });
}

app.get('*', (_req, res) => {
    res.sendFile(path.join(webRoot, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`服务器已启动：http://localhost:${PORT}`);
    console.log(serveDist ? '模式：dist 预览（接近 EdgeOne 线上效果）' : '模式：src 开发');
});
