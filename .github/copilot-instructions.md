# 带我去一个VUP主页 — 项目指南

## 架构概览

**前端**：纯 HTML + CSS + JS，位于 `src/`。  
**构建**：`build.js` 将 `src/` + `data/` + `face_img/` 组装为纯静态 `dist/` 目录，可直接部署到 EdgeOne Pages。  
**本地开发**：`server.js`（Express）提供本地开发服务器，不参与线上运行。  
**数据脚本**：Node.js 脚本（`scripts/`），用于从 B 站公开接口抓取和更新 VUP 头像与简介。

## 启动与构建

```bash
# 安装依赖
npm install

# 开发模式（热重载，需 nodemon）
npm run dev

# 预览构建产物
npm run preview
```

数据管理脚本：

```bash
# 从 B 站更新全部 VUP 数据
npm run prefetch

# 强制覆盖已有数据
npm run prefetch:force

# 使用统一管理脚本
npm run vup -- list
npm run vup -- search --uid 672328094
npm run vup -- add --uid 672328094
npm run vup -- remove --uid 672328094
npm run vup -- update --uid 672328094 --force
npm run vup -- update-all
```

## 目录结构

| 路径 | 说明 |
|------|------|
| `server.js` | Express 本地开发/预览服务器 |
| `build.js` | 静态构建脚本，输出 `dist/` |
| `src/index.html` | 页面结构 |
| `src/script.js` | 前端逻辑：获取 vup.json、随机选择、倒计时、跳转 |
| `src/style.css` | 页面样式 |
| `data/vup.json` | VUP 数据源，脚本会更新此文件 |
| `face_img/` | 本地缓存头像，由脚本下载 |
| `scripts/fetch-bilibili.js` | B 站数据预取脚本 |
| `scripts/vup-manager.js` | VUP 数据管理脚本（增删改查） |

## 前端逻辑

- 页面从 `/vup.json` 获取全部 VUP 数据，在浏览器端完成随机选择。
- 使用 `localStorage` 记录上次展示的 VUP，避免连续重复。
- 头像优先加载本地 `face_img/` 中的缓存，失败时回退到 B 站 CDN。
- 倒计时 10 秒后自动跳转到 VUP 的 B 站主页。

## 数据约定

- `data/vup.json` 字段：`name`、`url`、`avatar`、`intro`
- 头像本地路径约定：`face_img/<name>.jpg`（与 `script.js` 中 `/face_img/${name}.jpg` 对应）
- `name` 字段由用户维护，作为展示名 & face_img 文件名 key，不从 B 站覆盖
