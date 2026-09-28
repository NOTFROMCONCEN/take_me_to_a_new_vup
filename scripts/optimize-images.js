/**
 * 图片优化脚本
 * 将 face_img/ 中的 JPG 图片转换为 WebP 和 AVIF 格式，并生成多种尺寸
 *
 * 用法：
 *   node scripts/optimize-images.js            # 仅生成 WebP（默认，前端实际只用 WebP）
 *   node scripts/optimize-images.js --avif     # 额外生成 AVIF（前端暂未使用，仅供未来 <picture> 升级）
 *
 * 依赖：
 *   npm install sharp --save-dev
 *
 * 产物输出到 face_img/（源目录），必须在 npm run build 之前执行；
 * build 会把 face_img/ 中的 WebP 一起打进 dist/，并对已有 WebP 的头像跳过冗余 JPG。
 */

const fs = require('fs');
const path = require('path');

// 尝试加载 sharp，如果未安装则提示
let sharp;
try {
    sharp = require('sharp');
} catch {
    console.error('错误: 未安装 sharp 库');
    console.error('请运行: npm install sharp --save-dev');
    process.exit(1);
}

const ROOT = path.join(__dirname, '..');
const FACE_IMG = path.join(ROOT, 'face_img');

// 前端目前只使用 WebP，AVIF 默认关闭，避免产物体积与构建耗时浪费
const ENABLE_AVIF = process.argv.includes('--avif');

// 目标尺寸
const SIZES = {
    thumb: 72, // 列表缩略图
    card: 140, // 卡片头像
    original: 0 // 原图（0 表示不调整尺寸）
};

// 格式配置
const FORMATS = {
    webp: { quality: 85, ext: '.webp' },
    avif: { quality: 65, ext: '.avif' }
};

async function optimizeImage(inputPath, uid, outputDir) {
    const image = sharp(inputPath);
    const metadata = await image.metadata();
    const results = [];

    for (const [sizeName, width] of Object.entries(SIZES)) {
        const suffix = sizeName === 'original' ? '' : `@${width}w`;

        let pipeline = image.clone();
        if (width > 0) {
            pipeline = pipeline.resize(width, width, {
                fit: 'cover',
                position: 'center'
            });
        }

        // 生成 WebP
        const webpPath = path.join(outputDir, `${uid}${suffix}${FORMATS.webp.ext}`);
        await pipeline.webp({ quality: FORMATS.webp.quality }).toFile(webpPath);
        const webpStats = fs.statSync(webpPath);
        results.push({
            format: 'webp',
            size: sizeName,
            width: width || metadata.width,
            path: webpPath,
            bytes: webpStats.size,
            kb: (webpStats.size / 1024).toFixed(1)
        });

        // 生成 AVIF（可选）
        if (ENABLE_AVIF) {
            const avifPath = path.join(outputDir, `${uid}${suffix}${FORMATS.avif.ext}`);
            try {
                await pipeline.avif({ quality: FORMATS.avif.quality, effort: 4 }).toFile(avifPath);
                const avifStats = fs.statSync(avifPath);
                results.push({
                    format: 'avif',
                    size: sizeName,
                    width: width || metadata.width,
                    path: avifPath,
                    bytes: avifStats.size,
                    kb: (avifStats.size / 1024).toFixed(1)
                });
            } catch (e) {
                // AVIF 编码可能失败（如 sharp 版本不支持），仅记录警告
                results.push({
                    format: 'avif',
                    size: sizeName,
                    width: width || metadata.width,
                    path: avifPath,
                    bytes: 0,
                    kb: '0.0',
                    error: e.message
                });
            }
        }
    }

    return results;
}

async function main() {
    if (!fs.existsSync(FACE_IMG)) {
        console.error('错误: face_img/ 目录不存在');
        process.exit(1);
    }

    const files = fs.readdirSync(FACE_IMG);
    const jpgFiles = files.filter((f) => f.endsWith('.jpg') && /^\d+\.jpg$/.test(f));

    if (jpgFiles.length === 0) {
        console.log('没有找到 JPG 文件（格式应为 {uid}.jpg）');
        return;
    }

    console.log(`找到 ${jpgFiles.length} 个头像文件\n`);

    let totalOriginalSize = 0;
    let totalWebpSize = 0;
    let totalAvifSize = 0;

    for (const file of jpgFiles) {
        const uid = path.basename(file, '.jpg');
        const inputPath = path.join(FACE_IMG, file);
        const originalStats = fs.statSync(inputPath);
        const originalKb = (originalStats.size / 1024).toFixed(1);
        totalOriginalSize += originalStats.size;

        console.log(`处理 ${uid}...`);

        try {
            const results = await optimizeImage(inputPath, uid, FACE_IMG);

            for (const result of results) {
                const status = result.error ? `✘ (${result.error.slice(0, 30)}...)` : '✔';
                console.log(
                    `  ${status} ${result.format.toUpperCase().padEnd(5)} ${result.size.padEnd(8)} → ${result.kb.padStart(6)} KB`
                );
                if (result.format === 'webp' && !result.error) {
                    totalWebpSize += result.bytes;
                }
                if (result.format === 'avif' && !result.error) {
                    totalAvifSize += result.bytes;
                }
            }

            const webpSavings = ((1 - totalWebpSize / totalOriginalSize) * 100).toFixed(1);
            console.log(
                `  原文件: ${originalKb} KB | WebP: ${(totalWebpSize / 1024).toFixed(1)} KB (节省 ${webpSavings}%)\n`
            );
        } catch (error) {
            console.error(`  错误: ${error.message}\n`);
        }
    }

    const webpSavings = ((1 - totalWebpSize / totalOriginalSize) * 100).toFixed(1);
    const avifSavings = totalAvifSize > 0 ? ((1 - totalAvifSize / totalOriginalSize) * 100).toFixed(1) : 'N/A';

    console.log('── 总结 ──');
    console.log(`原文件总大小: ${(totalOriginalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`WebP 总大小:  ${(totalWebpSize / 1024 / 1024).toFixed(2)} MB (节省 ${webpSavings}%)`);
    if (totalAvifSize > 0) {
        console.log(`AVIF 总大小:  ${(totalAvifSize / 1024 / 1024).toFixed(2)} MB (节省 ${avifSavings}%)`);
    } else {
        console.log('AVIF:         未生成（前端暂不使用，需要时加 --avif）');
    }
    console.log(`\n优化后的图片保存在: face_img/（构建时随 dist/ 一起打包）`);
}

main().catch((error) => {
    console.error('错误:', error);
    process.exit(1);
});
