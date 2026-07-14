# 纸径 · 每日路径拼图

一款响应式每日路径拼图：在小型网格中连接起点与终点，覆盖必经格，并应对箭头、传送门、转弯格和限步门。所有玩家每天挑战同一题目，成绩进入全球每日榜与月度赛季榜。

## 功能

- 北京时间每日零点切换的确定性谜题
- 周一至周日逐步提升的难度曲线
- 完成、最短路径、额外挑战三颗独立星星
- 12 关渐进式练习册，可离线游玩
- 匿名玩家、昵称、短编号和一次性恢复码
- 服务端路径重放、可信活动计时和幂等成绩提交
- 全球每日排行榜、月度赛季榜和历史赛季查询
- 成绩海报、连续打卡、PWA 安装与离线应用外壳
- GitHub Pages 前端发布与 Docker Compose 后端部署

## 技术栈

| 区域 | 技术 |
| --- | --- |
| Web | React 19、TypeScript、Vite、SVG、PWA |
| API | Node.js 22、Fastify、Zod、JWT |
| 数据 | PostgreSQL 17、SQL migrations |
| 共享逻辑 | TypeScript 规则引擎、DFS 求解器、确定性生成器 |
| 部署 | GitHub Pages、Docker Compose、Caddy、GitHub Actions |
| 测试 | Vitest、pg-mem、Fastify inject |

## 快速开始

### 环境要求

- Node.js 22 或更高版本
- npm 10 或更高版本
- PostgreSQL 15 或更高版本；推荐使用 Docker Compose

### 安装

```bash
npm install
cp .env.example .env
```

只运行前端练习模式：

```bash
npm run dev
```

运行完整本地环境：

```bash
docker compose up -d postgres
npm run migrate -w @pathweave/api
npm run dev:api
npm run dev
```

默认地址：

- Web：`http://localhost:5173`
- API：`http://localhost:3001`
- 健康检查：`http://localhost:3001/health`

## 常用命令

```bash
npm run dev          # 启动 Web 开发服务器
npm run dev:api      # 启动 API 开发服务器
npm test             # 运行规则、API 集成和组件测试
npm run typecheck    # 严格 TypeScript 检查
npm run build        # 构建共享包、API 和 Web
npm run verify       # 依次执行测试、类型检查和构建
```

## 项目结构

```text
apps/
  api/               Fastify API、数据库迁移与排行榜事务
  web/               React PWA、棋盘交互与成绩展示
packages/
  game/              前后端共享规则引擎、求解器和谜题生成器
docs/
  api.md             HTTP API 契约
  architecture.md    系统结构与数据流
  deployment.md      GitHub Pages 与 VPS 部署
  game-rules.md      玩法、特殊格与计分规则
  operations.md      监控、备份与安全边界
scripts/
  backup-postgres.sh  PostgreSQL 备份脚本
  postgres-smoke.sql  生产数据库烟雾测试
```

## 设计与可信性

- 正式每日题只由 API 发布，客户端不能自行决定正式谜题。
- 服务端使用共享规则引擎重放每一步，不信任客户端提交的星数。
- 每日最佳更新先取得玩家与日期级事务锁，再重算月度赛季聚合。
- 客户端活动时长用于公平排名，服务器墙钟用于检查异常时长和过期尝试。
- 此机制提供实用级防作弊，但无法阻止共享答案或专业自动求解。

## 文档

- [玩法规则](docs/game-rules.md)
- [系统架构](docs/architecture.md)
- [API 参考](docs/api.md)
- [部署指南](docs/deployment.md)
- [运维说明](docs/operations.md)
- [贡献指南](CONTRIBUTING.md)
- [安全策略](SECURITY.md)

## 验证范围

`npm test` 会执行全部数据库迁移，并覆盖：

- 基础移动、撤销、传送、箭头、转弯、限步门和三星判定
- 12 个练习关的可解性与最优步数
- 整月每日题的确定性、唯一最短解、星期难度和挑战可完成性
- 匿名身份、正式题发布、尝试令牌、路径重放、幂等提交和连续打卡
- 每日最佳、赛季聚合与独立三星前端展示

生产部署后还应运行：

```bash
psql "$DATABASE_URL" -f scripts/postgres-smoke.sql
```

该脚本验证真实 PostgreSQL 的迁移状态、窗口排名和 advisory lock 能力。

## 发布说明

前端由 `.github/workflows/pages.yml` 发布到 GitHub Pages；API 镜像由 `.github/workflows/api.yml` 构建并推送到 GitHub Container Registry。完整步骤见[部署指南](docs/deployment.md)。

## 许可证

本项目当前未声明开源许可证。公开可见不代表自动授予复制、修改或分发权利。
