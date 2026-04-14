# 带我去一个 VUP 主页

一个纯 Node 工作流的静态站点项目：页面会随机展示一位 VUP，并在倒计时后跳转到对应的 Bilibili 主页。

## 当前架构

- 前端源码位于 `src/`，使用原生 HTML/CSS/JS。
- 数据文件位于 `data/vup.json`。
- 本地头像缓存位于 `face_img/`。
- `scripts/fetch-bilibili.js` 负责从 B 站公开接口更新头像与简介。
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

使用 Node 脚本从 B 站公开接口更新 `data/vup.json`，并下载头像到 `face_img/`：

```bash
npm run prefetch
```

强制覆盖已有头像与简介：

```bash
npm run prefetch:force
```

也可以使用统一的 VUP 管理脚本：

```bash
npm run vup -- list
npm run vup -- search --uid 672328094
npm run vup -- add --uid 672328094
npm run vup -- remove --uid 672328094
npm run vup -- update --uid 672328094 --force
npm run vup -- update-all
```

这个脚本支持：

- 按 UID 搜索 B 站账号
- 按 UID 新增 VUP 到 `data/vup.json`
- 按 UID 删除 VUP
- 更新单个或全部 VUP 的头像和简介

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
├── dist/                     # 构建输出目录
├── face_img/                 # 本地头像缓存
├── scripts/
│   └── fetch-bilibili.js     # Node 数据抓取脚本
├── src/
│   ├── index.html            # 页面结构
│   ├── script.js             # 前端交互逻辑
│   └── style.css             # 页面样式
├── package.json
└── server.js                 # 本地开发 / 预览服务器
```
