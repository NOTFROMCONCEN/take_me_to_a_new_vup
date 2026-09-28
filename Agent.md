# 带我去一个VUP主页 — Agent 规则

本文件是给在本仓库工作的 AI Agent / 编码助手的**行为约定**，与 `README.md`（使用说明）互补。冲突时以本文件为准。

## 部署规则（Agent 必读）

执行「部署 / 发布 / 上线」类任务时，**先判断当前运行环境**，再决定部署通道：

### 情况一：在 WorkBuddy 中，且 EdgeOne 相关 skill / MCP 可用

**Git 推送与 EdgeOne 部署同时进行**，两条通道并行，不要只做其一：

1. `npm run build` 生成 `dist/`（纯静态产物，即完整部署内容）
2. EdgeOne：通过 EdgeOne 连接器直传 `dist/`，或使用 `npm run deploy:edgeone`
3. Git：提交本次改动并 push 到远端
4. 两条通道互不阻塞；若其中一条失败，单独重试并**明确告知用户哪一条成功、哪一条失败**

### 情况二：不在 WorkBuddy 中（或 EdgeOne skill / MCP 不可用）

**只进行 Git 推送**，不要尝试任何 EdgeOne 部署动作，并向用户说明原因（环境不具备直传能力）。

### 部署目标

| 项         | 值                                       |
| ---------- | ---------------------------------------- |
| 项目名     | `take-me-to-a-vup`                       |
| Project ID | `makers-dnnodfw5d5qd`                    |
| 站点       | 中国站（china）                          |
| 线上域名   | `take-me-to-a-vup-prusz3ic.edgeone.cool` |

部署目标固定，每次部署覆盖更新线上版本，域名不变。不要新建同名之外的项目。

## 构建流水线约定（顺序不可颠倒）

```bash
npm run prefetch && npm run optimize-images && npm run build
```

1. `optimize-images` 把 WebP 写入 `face_img/`（源目录），**不是** `dist/`。
2. `build` 会先清空 `dist/`，再打包 `face_img/`；已有 WebP 的头像跳过冗余 JPG。
3. 写成 `build && optimize-images` 会导致产物缺 WebP —— 这是本项目踩过的坑，不要重犯。

改动 `build.js` / `src/index.html` 时必须保住两条底线：

- HTML 引用要替换成带哈希文件名，build 自带残留校验，失败即报错。
- `src/sw.js` 必须进 `dist/`，且由 build 注入哈希资源清单与 cache 名。

## 其他约定

- 项目为**纯静态**站点，`dist/` 即完整产物，无服务端运行时；`server.js` 仅用于本地 `dev` / `preview`。
- 不要修改 `data/vup.json` 中的 `name` 字段（由用户维护，不从 B 站覆盖）。
- 涉及 B 站数据更新走 `scripts/` 下脚本，不要手工编造 VUP 数据。
- `.github/workflows/deploy.yml` 已改为仅手动触发（push 不再自动部署），不要恢复 push 触发器，以免与直传形成双通道覆盖。
