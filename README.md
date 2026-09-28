# 带我去一个 VUP 主页

一个纯 Node 工作流的静态站点项目：页面会随机展示一位 VUP，并在倒计时后跳转到对应的 Bilibili 主页。

## 当前架构

- 前端源码位于 `src/`，使用原生 HTML/CSS/JS。
- 数据文件位于 `data/vup.json`。
- 本地头像缓存位于 `face_img/`。
- `scripts/fetch-bilibili.js` 负责从 B 站公开接口批量更新头像与简介。
- `scripts/vup-manager.js` 提供增删改查、验证、导入/导出的交互式管理能力。
- `scripts/optimize-images.js` 负责将头像转换为 WebP 格式并生成多尺寸。
- `build.js` 负责生成可直接部署到 EdgeOne 的 `dist/` 目录。
- `server.js` 仅用于本地开发和预览，不参与线上运行。
- `Agent.md` 是给 AI Agent 的项目约定（部署规则、构建顺序等），改动前请先阅读。

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

### 图片优化

将头像转换为 WebP 格式并生成多种尺寸（缩略图 72px、卡片 140px、原图）：

```bash
npm run optimize-images
```

需要额外生成 AVIF（前端暂未使用，仅供后续 `<picture>` 升级）：

```bash
node scripts/optimize-images.js --avif
```

**注意**：图片优化需要安装 `sharp` 库：`npm install sharp --save-dev`

优化后的图片写入 **`face_img/` 源目录**（而非 `dist/`），体积可减少约 67%（3.4 MB → 1.1 MB）。
因为 `build` 会先清空 `dist/`，**必须先执行本脚本再执行 `build`**，否则产物里不会有 WebP。

构建时，已生成 WebP 的头像会跳过冗余 JPG（前端加载链路本身还有 B 站 CDN 兜底），产物体积因此大幅下降。

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
npm run vup -- validate
npm run vup -- export --output backup.json
npm run vup -- import --input backup.json
```

这个脚本支持：

- 按 UID 搜索 B 站账号
- 按 UID 新增 VUP 到 `data/vup.json`
- 按 UID 删除 VUP
- 更新单个或全部 VUP 的头像和简介
- 验证数据完整性（UID 唯一性、必填字段、头像文件）
- 导出/导入 VUP 数据（自动去重）

可选参数：

| 参数              | 说明                     |
| ----------------- | ------------------------ |
| `--name <名称>`   | 新增或更新时手动指定名称 |
| `--intro <文本>`  | 新增或更新时手动覆盖简介 |
| `--no-avatar`     | 不下载头像文件           |
| `--keep-avatar`   | 删除时保留本地头像文件   |
| `--force`         | 强制覆盖已有数据         |
| `--output <路径>` | 导出文件路径             |
| `--input <路径>`  | 导入文件路径             |

### 数据验证

```bash
npm run validate
```

检查数据完整性：UID 唯一性、必填字段、头像文件存在性等。

## 构建静态产物

```bash
npm run build
```

构建完成后输出到 `dist/`。

本地预览构建结果：

```bash
npm run preview
```

完整发布流水线（顺序固定，不可颠倒）：

```bash
npm run deploy   # = prefetch → optimize-images → build
```

构建期约束：`src/index.html` 中的 `/style.css`、`/script.js` 引用会被替换为带哈希的文件名，若残留未哈希引用构建会直接失败；`src/sw.js` 会随产物一起部署并注入哈希资源清单。

## 部署到 EdgeOne（直传模式）

本项目采用 **直接从本地直传** 的方式部署到 EdgeOne Makers，不再依赖 Git 推送触发。
部署目标固定为同一个项目 `take-me-to-a-vup`（Project ID `makers-dnnodfw5d5qd`），因此每次部署都会覆盖更新线上版本，访问域名保持不变。

### 方式一：在 WorkBuddy 中让我直接部署（推荐）

直接说一句「部署到 EdgeOne」即可。我会自动完成：构建 `dist/` → 通过 EdgeOne 连接器直传 → 返回线上访问地址。
无需任何本地配置，也无需手动登录。

### 方式二：本地命令行部署

首次使用需先登录一次（浏览器授权，选中国站）：

```bash
npm run deploy:edgeone:login
npm run deploy:edgeone:whoami   # 确认已登录
```

之后每次部署执行：

```bash
npm run deploy:edgeone
```

该命令等价于：

```bash
npm run optimize-images
npm run build
npx -y edgeone@latest makers deploy ./dist -n take-me-to-a-vup --json
```

部署到预览环境（不影响线上）：

```bash
npm run deploy:edgeone:preview
```

### CI / 无浏览器环境

在 CI 中使用 API Token 部署（Token 具备账号级权限，切勿写入仓库）：

```bash
npx -y edgeone@latest makers deploy ./dist -n take-me-to-a-vup -t "$EDGEONE_API_TOKEN" --json
```

也可将 Token 存到本地 `.edgeone/.token`（已被 `.gitignore` 忽略），CLI 会自动读取。

Token 获取位置：腾讯云 EdgeOne 控制台 → Pages → 设置 → API Token。

### 说明

- 项目为 **纯静态直传** 类型，`dist/` 即完整部署产物，无需服务端运行时（当前产物约 1.2 MB）。
- `npm run deploy`（`prefetch` → `optimize-images` → `build`）仍为数据更新流水线，只负责生成产物，不负责上传。
- `.github/workflows/deploy.yml` 是旧版的 Git 推送自动部署流程，改用直传后可按需停用（见文件内注释）。

<!-- legacy-git-deploy -->

在 EdgeOne Pages 中也可使用以下构建配置：

- Build Command: `npm run build`
- Output Directory: `dist`

## 项目结构

```text
take_me_to_A_vup/
├── Agent.md                  # Agent 行为约定（部署规则等），改代码前必读
├── build.js                  # 静态构建脚本
├── data/
│   ├── vup.json              # VUP 数据
│   └── vup.schema.json       # 数据校验 schema
├── dist/                     # 构建输出目录（gitignore）
├── face_img/                 # 本地头像缓存（JPG + 优化后的 WebP）
├── scripts/
│   ├── fetch-bilibili.js     # B 站数据批量预取脚本
│   ├── optimize-images.js    # 图片优化脚本（WebP 转换，可选 AVIF）
│   ├── vup-manager.js        # VUP 数据管理脚本（增删改查 + 验证 + 导入/导出）
│   ├── validate-schema.js    # schema 校验脚本
│   └── lib/                  # 脚本共用模块
├── src/
│   ├── index.html            # 页面结构
│   ├── script.js             # 前端交互逻辑
│   ├── style.css             # 页面样式
│   ├── sw.js                 # Service Worker（离线缓存）
│   ├── manifest.json         # PWA 清单
│   └── icon.svg              # 站点图标
├── .github/
│   ├── copilot-instructions.md
│   └── workflows/
│       ├── ci.yml            # CI 检查
│       ├── deploy.yml        # EdgeOne 部署（仅手动触发，已停用 push 触发）
│       └── update-vup.yml    # 定时更新 VUP 数据
├── package.json
└── server.js                 # 本地开发 / 预览服务器
```

## 前端功能

### 核心功能

- 页面从 `/vup.json` 获取全部 VUP 数据，在浏览器端完成随机选择
- 使用 `localStorage` 记录上次展示的 VUP，避免连续重复
- 头像优先加载本地 `face_img/` 中的 WebP 缓存，失败时回退到 JPG → B 站 CDN
- 倒计时 10 秒后自动跳转到 VUP 的 B 站主页
- 支持暂停/恢复倒计时

### 标签与搜索

- 支持按标签筛选 VUP
- 支持按名称或简介搜索

### 主题与国际化

- 支持浅色/深色主题切换（自动检测系统偏好）
- 支持中文/英文切换

### 键盘快捷键

| 快捷键       | 功能              |
| ------------ | ----------------- |
| `空格` / `N` | 换一个 VUP        |
| `P`          | 暂停/恢复倒计时   |
| `L`          | 打开全部 VUP 列表 |
| `S`          | 分享当前 VUP      |
| `Enter`      | 立即跳转          |
| `Esc`        | 关闭弹窗          |

### 无障碍访问

- Skip Link 跳转到主内容
- ARIA 属性和 live region
- 键盘导航和焦点管理
- 屏幕阅读器公告
- WCAG 2.1 AA 颜色对比度

### 离线支持

- Service Worker 缓存静态资源（`sw.js` 由构建注入哈希资源清单，随 `dist/` 一起部署）
- Stale-While-Revalidate 策略（静态资源）
- Network First 策略（数据文件）
- Cache First 策略（图片资源）

## 数据约定

- `data/vup.json` 字段：`name`、`uid`、`url`、`avatar`、`intro`、`tags`
- 头像本地路径约定：`face_img/<uid>.jpg`（WebP 优化后为 `<uid>.webp`、`<uid>@72w.webp`、`<uid>@140w.webp`）
- `name` 字段由用户维护，作为展示名，不从 B 站覆盖
- `uid` 字段为 B 站用户 UID，作为头像文件名 key

## License

MIT
