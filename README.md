# 带我去一个 VUP 主页

一个纯 Node 工作流的静态站点项目：页面会随机展示一位 VUP，并在倒计时后跳转到对应的 Bilibili 主页。

## 当前架构

- 前端源码位于 `src/`，使用原生 HTML/CSS/JS。
- 数据文件位于 `data/vup.json`。
- 本地头像缓存位于 `face_img/`。
- `scripts/fetch-bilibili.js` 负责从 B 站公开接口批量更新头像与简介。
- `scripts/vup-manager.js` 提供增删改查的交互式管理能力。
- `build.js` 负责生成可直接部署到 EdgeOne 的 `dist/` 目录。
- `server.js` 仅用于本地开发和预览，不参与线上运行。

## 安装依赖

```bash
npm install
```

## 本地开发

启动源码开发服务器：

```bash
npm run dev
```

访问 `http://localhost:5090`。

## 更新 VUP 数据

### 批量预取

使用 Node 脚本从 B 站公开接口更新 `data/vup.json`，并下载头像到 `face_img/`：

```bash
npm run prefetch
```

强制覆盖已有头像与简介：

```bash
npm run prefetch:force
```

### 交互式管理

使用统一的 VUP 管理脚本：

```bash
npm run vup -- list
npm run vup -- search --uid 672328094
npm run vup -- add --uid 672328094
npm run vup -- add --uid 672328094 --name 嘉然Diana
npm run vup -- remove --uid 672328094
npm run vup -- update --uid 672328094 --force
npm run vup -- update-all
```

这个脚本支持：

- 按 UID 搜索 B 站账号
- 按 UID 新增 VUP 到 `data/vup.json`
- 按 UID 删除 VUP
- 更新单个或全部 VUP 的头像和简介

可选参数：

| 参数 | 说明 |
|------|------|
| `--name <名称>` | 新增或更新时手动指定名称 |
| `--intro <文本>` | 新增或更新时手动覆盖简介 |
| `--no-avatar` | 不下载头像文件 |
| `--keep-avatar` | 删除时保留本地头像文件 |
| `--force` | 强制覆盖已有数据 |

## 构建静态产物

```bash
npm run build
```

构建完成后输出到 `dist/`。

本地预览构建结果：

```bash
npm run preview
```

## 部署到 EdgeOne

在 EdgeOne Pages 中可直接使用以下配置：

- Build Command: `npm run build`
- Output Directory: `dist`

如果数据已经在仓库内准备好，也可以直接上传 `dist/` 目录作为纯静态站点。

## 项目结构

```text
take_me_to_A_vup/
├── build.js                  # 静态构建脚本
├── data/
│   └── vup.json              # VUP 数据
├── dist/                     # 构建输出目录（gitignore）
├── face_img/                 # 本地头像缓存
├── scripts/
│   ├── fetch-bilibili.js     # B 站数据批量预取脚本
│   └── vup-manager.js        # VUP 数据管理脚本（增删改查）
├── src/
│   ├── index.html            # 页面结构
│   ├── script.js             # 前端交互逻辑
│   └── style.css             # 页面样式
├── package.json
└── server.js                 # 本地开发 / 预览服务器
```

## 前端逻辑

- 页面从 `/vup.json` 获取全部 VUP 数据，在浏览器端完成随机选择。
- 使用 `localStorage` 记录上次展示的 VUP，避免连续重复。
- 头像优先加载本地 `face_img/` 中的缓存，失败时回退到 B 站 CDN。
- 倒计时 10 秒后自动跳转到 VUP 的 B 站主页。
- 支持键盘操作（Escape 关闭弹窗）和无障碍访问（ARIA 属性）。

## 数据约定

- `data/vup.json` 字段：`name`、`url`、`avatar`、`intro`
- 头像本地路径约定：`face_img/<name>.jpg`
- `name` 字段由用户维护，作为展示名 & face_img 文件名 key，不从 B 站覆盖

## License

MIT
