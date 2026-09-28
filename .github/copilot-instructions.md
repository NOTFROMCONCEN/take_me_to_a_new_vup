# 带我去一个VUP主页 — 项目指南

> 更完整的 Agent 行为约定见仓库根目录 `Agent.md`（部署规则以其为准）。

## 架构概览

- **前端**：原生 HTML + CSS + JS，位于 `src/`（含 `sw.js`、`manifest.json`、`icon.svg`）。
- **构建**：`build.js` 将 `src/` + `data/` + `face_img/` 组装为纯静态 `dist/`，输出带内容哈希的 CSS/JS，并内联关键 CSS。
- **产物**：`dist/` 即完整部署产物，**纯静态，无服务端运行时**。
- **本地开发**：`server.js`（Express）仅用于 `dev` / `preview`，不参与线上运行。
- **数据脚本**：`scripts/` 下为 Node.js 脚本，负责 B 站数据抓取、头像优化、数据校验。

## 常用命令

```bash
npm install             # 安装依赖
npm run dev             # 开发模式（src/，端口 5090）
npm run build           # 构建 dist/
npm run preview         # 预览 dist/ 构建产物
npm run validate        # 校验 data/vup.json 完整性
npm run prefetch        # 从 B 站更新头像与简介
npm run optimize-images # 生成 WebP 头像（写入 face_img/，须在 build 之前）
```

数据管理：

```bash
npm run vup -- list
npm run vup -- search --uid 672328094
npm run vup -- add --uid 672328094 --name 嘉然Diana
npm run vup -- remove --uid 672328094
npm run vup -- update --uid 672328094 --force
npm run vup -- update-all
npm run vup -- validate
npm run vup -- export --output backup.json
npm run vup -- import --input backup.json
```

## 构建流水线（顺序不可颠倒）

```bash
npm run prefetch && npm run optimize-images && npm run build
```

1. `optimize-images` 从 `face_img/<uid>.jpg` 生成 `<uid>@72w.webp` / `<uid>@140w.webp` / `<uid>.webp`，**写入 `face_img/` 源目录**。
2. `build` 会**先清空 `dist/`**，再把 `face_img/` 打包进去；对已有 WebP 的头像会跳过冗余 JPG。
3. 若顺序写成 `build && optimize-images`，产物里不会有 WebP（旧版 `npm run deploy` 就是这个错误）。

构建期还有两个强制约束，改动 `src/index.html` 或 `build.js` 时要留意：

- HTML 中的 `/style.css`、`/script.js` 引用**必须**被替换为带哈希的文件名；build 结束会做残留校验，发现未哈希引用直接报错退出。
- `src/sw.js` 必须随产物一起部署，其静态资源清单与 cache 名由 build 注入哈希，否则线上 `/sw.js` 404、离线能力失效。

## 目录结构

| 路径                            | 说明                                                |
| ------------------------------- | --------------------------------------------------- |
| `src/index.html`                | 页面结构                                            |
| `src/script.js`                 | 前端逻辑：随机选择、倒计时、跳转、列表、i18n        |
| `src/style.css`                 | 页面样式                                            |
| `src/sw.js`                     | Service Worker（SWR / Network First / Cache First） |
| `src/manifest.json`、`icon.svg` | PWA 清单与图标                                      |
| `data/vup.json`                 | VUP 数据源                                          |
| `data/vup.schema.json`          | 数据校验 schema                                     |
| `face_img/`                     | 头像缓存：`<uid>.jpg` 及优化后的 WebP               |
| `scripts/fetch-bilibili.js`     | B 站数据批量预取                                    |
| `scripts/optimize-images.js`    | 图片优化（WebP，可选 AVIF）                         |
| `scripts/vup-manager.js`        | 数据增删改查 / 验证 / 导入导出                      |
| `scripts/validate-schema.js`    | schema 校验                                         |
| `scripts/lib/`                  | 脚本共用模块                                        |
| `build.js`                      | 静态构建脚本                                        |
| `server.js`                     | 本地开发 / 预览服务器                               |
| `Agent.md`                      | Agent 行为约定（含部署规则）                        |

## 前端逻辑

- 从 `/vup.json` 拉取全部数据，随机选择在浏览器端完成。
- `localStorage` 记录上次展示的 VUP，避免连续重复。
- 头像加载链路：`/face_img/<uid>@140w.webp` → `/face_img/<uid>.jpg` → B 站 CDN。
- 倒计时 10 秒后跳转到 B 站主页，可暂停 / 恢复。
- 支持标签筛选、搜索、深浅主题、中英文切换、键盘快捷键。

## 数据约定

- `data/vup.json` 字段：`name`、`uid`、`url`、`avatar`、`intro`、`tags`。
- `uid` 是 B 站用户 UID，也是头像文件名 key。
- 头像文件：`face_img/<uid>.jpg`，优化后为 `face_img/<uid>.webp`、`face_img/<uid>@72w.webp`、`face_img/<uid>@140w.webp`。
- **`name` 由用户维护，作为展示名，不从 B 站覆盖。**

## 部署

采用**本地直传 EdgeOne Makers**，不是 Git 触发。详见 `README.md` 与 `Agent.md`。

- 项目名 `take-me-to-a-vup`，Project ID `makers-dnnodfw5d5qd`，中国站。
- `.github/workflows/deploy.yml` 已改为仅 `workflow_dispatch` 手动触发，**不要恢复 push 触发器**，避免与直传形成双通道覆盖。
