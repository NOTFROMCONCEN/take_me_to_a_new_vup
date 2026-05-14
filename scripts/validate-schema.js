/**
 * 数据 Schema 校验脚本
 * 使用 AJV 对 data/vup.json 进行严格校验
 *
 * 用法：
 *   node scripts/validate-schema.js
 */

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');

const ROOT = path.join(__dirname, '..');
const DATA_FILE = path.join(ROOT, 'data', 'vup.json');
const SCHEMA_FILE = path.join(ROOT, 'data', 'vup.schema.json');

function main() {
    // 读取数据
    if (!fs.existsSync(DATA_FILE)) {
        console.error('✘ data/vup.json 不存在');
        process.exit(1);
    }
    if (!fs.existsSync(SCHEMA_FILE)) {
        console.error('✘ data/vup.schema.json 不存在');
        process.exit(1);
    }

    let data;
    try {
        data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    } catch (e) {
        console.error(`✘ data/vup.json 解析失败: ${e.message}`);
        process.exit(1);
    }

    let schema;
    try {
        schema = JSON.parse(fs.readFileSync(SCHEMA_FILE, 'utf-8'));
    } catch (e) {
        console.error(`✘ data/vup.schema.json 解析失败: ${e.message}`);
        process.exit(1);
    }

    // 初始化 AJV
    const ajv = new Ajv({ allErrors: true, strict: false });
    const validate = ajv.compile(schema);
    const valid = validate(data);

    if (!valid) {
        console.error('\n✘ Schema 校验失败，发现以下错误：\n');
        for (const err of validate.errors) {
            const path = err.instancePath || 'root';
            const value = err.params ? JSON.stringify(err.params) : '';
            console.error(`  [${path}] ${err.message} ${value}`);
        }
        console.error(`\n共 ${validate.errors.length} 个错误\n`);
        process.exit(1);
    }

    // 额外业务校验
    const warnings = [];
    const uids = new Set();
    for (let i = 0; i < data.length; i++) {
        const entry = data[i];
        // UID 唯一性检查
        if (uids.has(entry.uid)) {
            warnings.push(`[${i}] UID "${entry.uid}" 重复`);
        }
        uids.add(entry.uid);

        // URL 与 UID 一致性检查（支持多平台）
        const isAcfun = entry.url.includes('acfun.cn');
        const expectedUrl = isAcfun ? `https://www.acfun.cn/u/${entry.uid}` : `https://space.bilibili.com/${entry.uid}`;
        if (entry.url !== expectedUrl) {
            warnings.push(
                `[${i}] ${entry.name}: URL "${entry.url}" 与 UID "${entry.uid}" 不匹配，期望 "${expectedUrl}"`
            );
        }

        // 缺少 avatar 警告
        if (!entry.avatar) {
            warnings.push(`[${i}] ${entry.name}: 缺少 avatar 字段`);
        }

        // 缺少 intro 警告
        if (!entry.intro || entry.intro.trim().length === 0) {
            warnings.push(`[${i}] ${entry.name}: 缺少简介`);
        }

        // 缺少 tags 警告
        if (!entry.tags || entry.tags.length === 0) {
            warnings.push(`[${i}] ${entry.name}: 缺少标签`);
        }
    }

    console.log(`✔ Schema 校验通过 (${data.length} 个 VUP)`);

    if (warnings.length > 0) {
        console.log(`\n⚠ 发现 ${warnings.length} 个警告（不影响构建）：\n`);
        for (const w of warnings) {
            console.log(`  ${w}`);
        }
    }

    console.log('\n数据质量良好 ✓');
}

main();
