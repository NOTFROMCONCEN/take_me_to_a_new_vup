/**
 * VUP 数据管理脚本
 *
 * 支持：
 *   - 根据 UID 查询 B 站账号信息
 *   - 新增 VUP
 *   - 删除 VUP
 *   - 更新单个 / 全部 VUP 的头像与简介
 *   - 列出当前 data/vup.json 中的所有条目
 *
 * 用法示例：
 *   node scripts/vup-manager.js search --uid 672328094
 *   node scripts/vup-manager.js add --uid 672328094
 *   node scripts/vup-manager.js add --uid 672328094 --name 嘉然Diana
 *   node scripts/vup-manager.js remove --uid 672328094
 *   node scripts/vup-manager.js update --uid 672328094 --force
 *   node scripts/vup-manager.js update-all
 *   node scripts/vup-manager.js list
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA_FILE = path.join(ROOT, 'data', 'vup.json');
const FACE_IMG_DIR = path.join(ROOT, 'face_img');
const API_DELAY_MS = 800;

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArgs(argv) {
    const [command, ...rest] = argv;
    const options = {};

    for (let i = 0; i < rest.length; i++) {
        const token = rest[i];
        if (!token.startsWith('--')) {
            continue;
        }

        const key = token.slice(2);
        const next = rest[i + 1];
        if (!next || next.startsWith('--')) {
            options[key] = true;
            continue;
        }
        options[key] = next;
        i++;
    }

    return { command, options };
}

function requireOption(options, key, message) {
    const value = options[key];
    if (!value || value === true) {
        throw new Error(message || `缺少参数 --${key}`);
    }
    return String(value);
}

function ensureUid(uid) {
    if (!/^\d+$/.test(uid)) {
        throw new Error(`UID 格式无效：${uid}`);
    }
    return uid;
}

function uidFromUrl(spaceUrl) {
    const matched = String(spaceUrl || '').match(/space\.bilibili\.com\/(\d+)/);
    return matched ? matched[1] : null;
}

function buildSpaceUrl(uid) {
    return `https://space.bilibili.com/${uid}`;
}

function safeAvatarUrl(url) {
    return String(url || '')
        .replace(/^http:\/\//, 'https://')
        .replace(/@.*$/, '');
}

function getJson(url) {
    return new Promise((resolve, reject) => {
        const req = https.get(
            url,
            {
                headers: {
                    'User-Agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                    Referer: 'https://www.bilibili.com',
                    Origin: 'https://www.bilibili.com'
                }
            },
            (res) => {
                let data = '';
                res.on('data', (chunk) => (data += chunk));
                res.on('end', () => {
                    if (res.statusCode !== 200) {
                        reject(new Error(`HTTP ${res.statusCode}`));
                        return;
                    }

                    try {
                        resolve(JSON.parse(data));
                    } catch (error) {
                        reject(new Error(`JSON 解析失败: ${error.message}`));
                    }
                });
            }
        );

        req.on('error', reject);
        req.setTimeout(15000, () => {
            req.destroy();
            reject(new Error('请求超时'));
        });
    });
}

function downloadImage(url, destPath) {
    const avatarUrl = safeAvatarUrl(url);

    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(destPath);
        const req = https.get(
            avatarUrl,
            {
                headers: {
                    'User-Agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                    Referer: 'https://space.bilibili.com'
                }
            },
            (res) => {
                if (res.statusCode === 301 || res.statusCode === 302) {
                    file.close();
                    fs.unlink(destPath, () => {});
                    downloadImage(res.headers.location || avatarUrl, destPath)
                        .then(resolve)
                        .catch(reject);
                    return;
                }

                if (res.statusCode !== 200) {
                    file.close();
                    fs.unlink(destPath, () => {});
                    reject(new Error(`头像下载失败: HTTP ${res.statusCode}`));
                    return;
                }

                res.pipe(file);
                file.on('finish', () => {
                    file.close();
                    resolve();
                });
            }
        );

        req.on('error', (error) => {
            file.close();
            fs.unlink(destPath, () => {});
            reject(error);
        });

        req.setTimeout(20000, () => {
            req.destroy();
            reject(new Error('头像下载超时'));
        });
    });
}

function ensureFaceDir() {
    if (!fs.existsSync(FACE_IMG_DIR)) {
        fs.mkdirSync(FACE_IMG_DIR, { recursive: true });
    }
}

function loadVups() {
    if (!fs.existsSync(DATA_FILE)) {
        return [];
    }
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
}

function saveVups(vups) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(vups, null, 4), 'utf-8');
}

function avatarPathForName(name) {
    return path.join(FACE_IMG_DIR, `${name}.jpg`);
}

async function fetchBilibiliCard(uid) {
    const json = await getJson(`https://api.bilibili.com/x/web-interface/card?mid=${uid}&photo=true`);

    if (json.code !== 0) {
        throw new Error(`B 站接口错误 ${json.code}: ${json.message}`);
    }

    const card = json.data && json.data.card;
    if (!card) {
        throw new Error('B 站接口未返回 card 数据');
    }

    return {
        uid,
        name: card.name,
        avatar: safeAvatarUrl(card.face),
        intro: (card.sign || '').trim(),
        url: buildSpaceUrl(uid)
    };
}

function printEntry(prefix, entry) {
    console.log(`${prefix} ${entry.name}`);
    console.log(`   UID: ${uidFromUrl(entry.url) || 'N/A'}`);
    console.log(`   URL: ${entry.url}`);
    console.log(`   头像: ${entry.avatar || '(空)'}`);
    console.log(`   简介: ${(entry.intro || '').slice(0, 80) || '(空)'}`);
}

async function commandSearch(options) {
    const uid = ensureUid(requireOption(options, 'uid'));
    const remote = await fetchBilibiliCard(uid);
    const local = loadVups().find((item) => uidFromUrl(item.url) === uid);

    console.log('B 站查询结果');
    printEntry('•', remote);

    if (local) {
        console.log('\n本地已存在对应条目');
        printEntry('•', local);
    } else {
        console.log('\n本地未找到该 UID。');
    }
}

async function hydrateEntryFromRemote(entry, { force = false, downloadAvatar = true } = {}) {
    const uid = ensureUid(uidFromUrl(entry.url) || '');
    const remote = await fetchBilibiliCard(uid);

    entry.avatar = remote.avatar || entry.avatar;
    entry.intro = remote.intro || entry.intro || '';

    if (!entry.name) {
        entry.name = remote.name;
    }

    if (downloadAvatar && remote.avatar) {
        ensureFaceDir();
        const avatarPath = avatarPathForName(entry.name);
        if (force || !fs.existsSync(avatarPath)) {
            await downloadImage(remote.avatar, avatarPath);
        }
    }

    return { entry, remote };
}

async function commandAdd(options) {
    const uid = ensureUid(requireOption(options, 'uid'));
    const vups = loadVups();

    if (vups.some((item) => uidFromUrl(item.url) === uid)) {
        throw new Error(`UID ${uid} 已存在于 data/vup.json`);
    }

    const remote = await fetchBilibiliCard(uid);
    const entry = {
        name: options.name ? String(options.name) : remote.name,
        url: buildSpaceUrl(uid),
        avatar: remote.avatar,
        intro: options.intro ? String(options.intro) : remote.intro
    };

    vups.push(entry);
    saveVups(vups);

    if (!options['no-avatar'] && remote.avatar) {
        ensureFaceDir();
        await downloadImage(remote.avatar, avatarPathForName(entry.name));
    }

    console.log('已新增 VUP');
    printEntry('•', entry);
}

async function commandRemove(options) {
    const uid = ensureUid(requireOption(options, 'uid'));
    const vups = loadVups();
    const index = vups.findIndex((item) => uidFromUrl(item.url) === uid);

    if (index === -1) {
        throw new Error(`未找到 UID ${uid}`);
    }

    const [removed] = vups.splice(index, 1);
    saveVups(vups);

    const avatarPath = avatarPathForName(removed.name);
    if (!options['keep-avatar'] && fs.existsSync(avatarPath)) {
        fs.unlinkSync(avatarPath);
    }

    console.log('已删除 VUP');
    printEntry('•', removed);
}

async function commandUpdate(options) {
    const uid = ensureUid(requireOption(options, 'uid'));
    const vups = loadVups();
    const entry = vups.find((item) => uidFromUrl(item.url) === uid);

    if (!entry) {
        throw new Error(`未找到 UID ${uid}`);
    }

    const oldName = entry.name;
    const { remote } = await hydrateEntryFromRemote(entry, {
        force: Boolean(options.force),
        downloadAvatar: !options['no-avatar']
    });

    if (options.name) {
        entry.name = String(options.name);
    }

    if (options.intro) {
        entry.intro = String(options.intro);
    }

    if (oldName !== entry.name) {
        const oldAvatarPath = avatarPathForName(oldName);
        const newAvatarPath = avatarPathForName(entry.name);
        if (fs.existsSync(oldAvatarPath) && !fs.existsSync(newAvatarPath)) {
            fs.renameSync(oldAvatarPath, newAvatarPath);
        }
    }

    saveVups(vups);

    console.log('已更新 VUP');
    printEntry('•', entry);
    console.log(`   B站当前昵称: ${remote.name}`);
}

async function commandUpdateAll(options) {
    const vups = loadVups();
    let updated = 0;

    for (const entry of vups) {
        const uid = uidFromUrl(entry.url);
        if (!uid) {
            console.warn(`⚠ ${entry.name} 缺少有效 UID，跳过`);
            continue;
        }

        try {
            await hydrateEntryFromRemote(entry, {
                force: Boolean(options.force),
                downloadAvatar: !options['no-avatar']
            });
            updated++;
            console.log(`✔ 已更新 ${entry.name} (${uid})`);
        } catch (error) {
            console.warn(`⚠ 更新 ${entry.name} (${uid}) 失败: ${error.message}`);
        }

        await sleep(API_DELAY_MS);
    }

    saveVups(vups);
    console.log(`\n完成：共更新 ${updated} 个 VUP`);
}

function commandList() {
    const vups = loadVups();
    if (vups.length === 0) {
        console.log('当前没有任何 VUP 数据。');
        return;
    }

    console.log(`当前共有 ${vups.length} 个 VUP：\n`);
    for (const entry of vups) {
        console.log(`${entry.name}\t${uidFromUrl(entry.url) || 'N/A'}\t${entry.url}`);
    }
}

function printHelp() {
    console.log(`
VUP 管理脚本

命令：
  search --uid <uid>                按 UID 查询 B 站账号，并显示本地是否已存在
  add --uid <uid> [--name 名称]     新增 VUP，默认使用 B 站当前昵称
  remove --uid <uid>                按 UID 删除 VUP
  update --uid <uid> [--force]      更新单个 VUP 的头像与简介
  update-all [--force]              更新全部 VUP 的头像与简介
  list                              列出当前所有 VUP
  validate                          验证 vup.json 数据完整性
  export [--output <路径>]          导出 VUP 数据为独立 JSON 文件
  import --input <路径>             从 JSON 文件导入 VUP 数据

可选参数：
  --intro <文本>                    新增或更新时手动覆盖简介
  --no-avatar                       不下载头像文件
  --keep-avatar                     删除时保留本地头像文件

示例：
  node scripts/vup-manager.js search --uid 672328094
  node scripts/vup-manager.js add --uid 672328094 --name 嘉然Diana
  node scripts/vup-manager.js update --uid 672328094 --force
  node scripts/vup-manager.js remove --uid 672328094 --keep-avatar
  node scripts/vup-manager.js validate
  node scripts/vup-manager.js export --output backup.json
  node scripts/vup-manager.js import --input backup.json
`);
}

// ── 数据验证 ──
function commandValidate() {
    const vups = loadVups();
    let errors = 0;
    let warnings = 0;

    console.log(`\n验证 ${vups.length} 个 VUP 条目...\n`);

    // 检查 UID 唯一性
    const uidMap = new Map();
    for (const vup of vups) {
        const uid = vup.uid || '';
        if (!uid) {
            console.log(`  ❌ ${vup.name || '未知'}: 缺少 uid 字段`);
            errors++;
            continue;
        }
        if (uidMap.has(uid)) {
            console.log(`  ❌ UID ${uid} 重复: ${vup.name} 和 ${uidMap.get(uid)}`);
            errors++;
        }
        uidMap.set(uid, vup.name);
    }

    // 检查必填字段
    for (const vup of vups) {
        if (!vup.name) {
            console.log(`  ❌ UID ${vup.uid}: 缺少 name 字段`);
            errors++;
        }
        if (!vup.url) {
            console.log(`  ❌ ${vup.name}: 缺少 url 字段`);
            errors++;
        } else if (!vup.url.includes('bilibili.com')) {
            console.log(`  ⚠️  ${vup.name}: url 不是 Bilibili 链接`);
            warnings++;
        }
        if (!vup.avatar) {
            console.log(`  ⚠️  ${vup.name}: 缺少 avatar 字段`);
            warnings++;
        }
        if (!vup.intro) {
            console.log(`  ⚠️  ${vup.name}: 缺少 intro 字段`);
            warnings++;
        }
        if (!Array.isArray(vup.tags) || vup.tags.length === 0) {
            console.log(`  ⚠️  ${vup.name}: 缺少 tags 字段`);
            warnings++;
        }
    }

    // 检查头像文件
    const faceFiles = fs.readdirSync(FACE_IMG_DIR).filter((f) => f.endsWith('.jpg'));
    for (const vup of vups) {
        const expectedFile = `${vup.uid}.jpg`;
        if (!faceFiles.includes(expectedFile)) {
            console.log(`  ⚠️  ${vup.name}: 缺少头像文件 ${expectedFile}`);
            warnings++;
        }
    }

    console.log(`\n── 验证结果 ──`);
    console.log(`  条目数: ${vups.length}`);
    console.log(`  错误: ${errors}`);
    console.log(`  警告: ${warnings}`);
    if (errors === 0 && warnings === 0) {
        console.log('  ✅ 所有数据验证通过！');
    }
    console.log('');
}

// ── 数据导出 ──
function commandExport(options) {
    const vups = loadVups();
    const outputPath = options.output || path.join(ROOT, 'data', `vup-export-${Date.now()}.json`);

    const exportData = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        count: vups.length,
        data: vups
    };

    fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2), 'utf-8');
    console.log(`✔ 已导出 ${vups.length} 个 VUP 到 ${outputPath}`);
}

// ── 数据导入 ──
function commandImport(options) {
    const inputPath = requireOption(options, 'input', '请指定 --input <路径>');
    if (!fs.existsSync(inputPath)) {
        throw new Error(`文件不存在: ${inputPath}`);
    }

    const raw = fs.readFileSync(inputPath, 'utf-8');
    const imported = JSON.parse(raw);

    // 支持两种格式：数组或带 metadata 的对象
    const newVups = Array.isArray(imported) ? imported : imported.data || [];
    if (!Array.isArray(newVups) || newVups.length === 0) {
        throw new Error('导入文件中没有有效的 VUP 数据');
    }

    const existing = loadVups();
    const existingUids = new Set(existing.map((v) => v.uid));

    let added = 0;
    let skipped = 0;

    for (const vup of newVups) {
        if (!vup.uid || existingUids.has(vup.uid)) {
            console.log(`  ⏭ 跳过 ${vup.name || vup.uid}（已存在或缺少 UID）`);
            skipped++;
            continue;
        }
        existing.push(vup);
        console.log(`  ✔ 新增 ${vup.name} (${vup.uid})`);
        added++;
    }

    if (added > 0) {
        fs.writeFileSync(DATA_FILE, JSON.stringify(existing, null, 4), 'utf-8');
        console.log(`\n✔ 导入完成：新增 ${added} 个，跳过 ${skipped} 个`);
    } else {
        console.log(`\n没有新的 VUP 需要导入（跳过 ${skipped} 个）`);
    }
}

async function main() {
    const { command, options } = parseArgs(process.argv.slice(2));

    if (!command || command === 'help' || command === '--help') {
        printHelp();
        return;
    }

    switch (command) {
        case 'search':
            await commandSearch(options);
            return;
        case 'add':
            await commandAdd(options);
            return;
        case 'remove':
            await commandRemove(options);
            return;
        case 'update':
            await commandUpdate(options);
            return;
        case 'update-all':
            await commandUpdateAll(options);
            return;
        case 'list':
            commandList();
            return;
        case 'validate':
            commandValidate();
            return;
        case 'export':
            commandExport(options);
            return;
        case 'import':
            commandImport(options);
            return;
        default:
            throw new Error(`未知命令：${command}`);
    }
}

main().catch((error) => {
    console.error(`错误: ${error.message}`);
    process.exit(1);
});
