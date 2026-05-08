/**
 * 图片优化脚本
 * 将 face_img/ 中的 JPG 图片转换为 WebP 格式并生成多种尺寸
 * 
 * 用法：
 *   node scripts/optimize-images.js
 * 
 * 依赖：
 *   npm install sharp --save-dev
 */

const fs = require('fs');
const path = require('path');

// 尝试加载 sharp，如果未安装则提示
let sharp;
try {
    sharp = require('sharp');
} catch (e) {
    console.error('错误: 未安装 sharp 库');
    console.error('请运行: npm install sharp --save-dev');
    process.exit(1);
}

const ROOT = path.join(__dirname, '..');
const FACE_IMG = path.join(ROOT, 'face_img');
const DIST_FACE_IMG = path.join(ROOT, 'dist', 'face_img');

// 目标尺寸
const SIZES = {
    thumb: 72,   // 列表缩略图
    card: 140,   // 卡片头像
    original: 0  // 原图（0 表示不调整尺寸）
};

// WebP 质量
const WEBP_QUALITY = 85;

async function optimizeImage(inputPath, uid, outputDir) {
    const image = sharp(inputPath);
    const metadata = await image.metadata();

    const results = [];

    for (const [sizeName, width] of Object.entries(SIZES)) {
        const suffix = sizeName === 'original' ? '' : `@${width}w`;
        const outputPath = path.join(outputDir, `${uid}${suffix}.webp`);

        let pipeline = image;
        if (width > 0) {
            pipeline = pipeline.resize(width, width, {
                fit: 'cover',
                position: 'center'
            });
        }

        await pipeline
            .webp({ quality: WEBP_QUALITY })
            .toFile(outputPath);

        const stats = fs.statSync(outputPath);
        results.push({
            size: sizeName,
            width: width || metadata.width,
            path: outputPath,
            bytes: stats.size,
            kb: (stats.size / 1024).toFixed(1)
        });
    }

    return results;
}

async function main() {
    if (!fs.existsSync(FACE_IMG)) {
        console.error('错误: face_img/ 目录不存在');
        process.exit(1);
    }

    // 确保 dist/face_img 目录存在
    fs.mkdirSync(DIST_FACE_IMG, { recursive: true });

    const files = fs.readdirSync(FACE_IMG);
    const jpgFiles = files.filter(f => f.endsWith('.jpg') && /^\d+\.jpg$/.test(f));

    if (jpgFiles.length === 0) {
        console.log('没有找到 JPG 文件（格式应为 {uid}.jpg）');
        return;
    }

    console.log(`找到 ${jpgFiles.length} 个头像文件\n`);

    let totalOriginalSize = 0;
    let totalOptimizedSize = 0;

    for (const file of jpgFiles) {
        const uid = path.basename(file, '.jpg');
        const inputPath = path.join(FACE_IMG, file);
        const originalStats = fs.statSync(inputPath);
        const originalKb = (originalStats.size / 1024).toFixed(1);
        totalOriginalSize += originalStats.size;

        console.log(`处理 ${uid}...`);

        try {
            const results = await optimizeImage(inputPath, uid, DIST_FACE_IMG);

            for (const result of results) {
                console.log(`  ${result.size.padEnd(8)} → ${result.kb.padStart(6)} KB`);
                totalOptimizedSize += result.bytes;
            }

            const savings = ((1 - totalOptimizedSize / totalOriginalSize) * 100).toFixed(1);
            console.log(`  原文件: ${originalKb} KB → 优化后: ${(totalOptimizedSize / 1024).toFixed(1)} KB (节省 ${savings}%)\n`);
        } catch (error) {
            console.error(`  错误: ${error.message}\n`);
        }
    }

    const totalSavings = ((1 - totalOptimizedSize / totalOriginalSize) * 100).toFixed(1);
    console.log('── 总结 ──');
    console.log(`原文件总大小: ${(totalOriginalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`优化后总大小: ${(totalOptimizedSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`节省空间: ${totalSavings}%`);
    console.log(`\n优化后的图片保存在: dist/face_img/`);
}

main().catch(error => {
    console.error('错误:', error);
    process.exit(1);
});
