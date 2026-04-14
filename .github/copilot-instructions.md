# 带我去一个VUP主页 — 项目指南

## 架构概览

**前端**：纯 HTML + CSS + JS，位于 `static/` 和 `templates/`。  
**后端**：Node.js + Express（`server.js`），替换原 Flask `app.py`。  
**数据脚本**：Python 实用脚本（`python/`），用于抓取 VUP 头像，独立于 Web 服务器运行。

## 启动与构建

```bash
# 安装依赖
npm install

# 生产模式启动（端口 5090）
npm start

# 开发模式（热重载，需 nodemon）
npm run dev
```

Python 数据脚本（独立运行，不影响 Web 服务）：

```bash
pip install -r requirements.txt
playwright install
python python/getface.py   # 抓取并更新 VUP 头像
```

## 目录结构

| 路径 | 说明 |
|------|------|
| `server.js` | Express 主服务，对外提供 HTTP 接口 |
| `static/vup.json` | VUP 数据源，`getface.py` 会更新此文件 |
| `static/script.js` | 前端逻辑：获取 `/api/vup`、倒计时、跳转 |
| `templates/index.html` | 唯一页面模板（纯 HTML，无模板引擎） |
| `face_img/` | 本地缓存头像，由 `getface.py` 下载 |
| `python/` | 独立数据抓取脚本（Playwright + requests） |

## API

- `GET /` — 首页
- `GET /api/vup` — 返回随机 VUP JSON，利用 session 避免连续重复
- `GET /face_img/:filename` — 提供本地头像图片
- `GET /static/*` — 静态资源

## 约定

- `static/vup.json` 字段：`name`、`url`、`avatar`、`intro`
- 头像本地路径约定：`face_img/<name>.jpg`（与 `script.js` 中 `/face_img/${vup.name}.jpg` 对应）
- Session 由 `express-session` 管理，用于记录上次展示的 VUP，防止重复
- Python 脚本的配置在 `python/config.py` 中，修改路径时需同步更新
