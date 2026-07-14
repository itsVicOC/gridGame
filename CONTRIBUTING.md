# 贡献指南

## 开发环境

```bash
npm install
cp .env.example .env
npm run verify
```

完整 API 开发需要 PostgreSQL，启动方法见 README。

## 工作区职责

- 规则、类型、求解器或生成器：`packages/game`
- 可信校验、身份、事务或排行榜：`apps/api`
- 交互、视觉、PWA 或分享：`apps/web`
- 数据库变更必须新增顺序迁移文件，禁止改写已经发布的迁移

## 代码原则

- 保持 TypeScript strict 模式通过。
- 规则逻辑使用纯函数，避免前后端分别实现规则。
- 不信任客户端提交的星数、步数或排名。
- 正式成绩写入必须保持幂等和事务一致性。
- 新增机制必须由求解器验证可解性与挑战可完成性。
- 交互组件应支持键盘、明确焦点和 `prefers-reduced-motion`。

## 测试

提交前运行：

```bash
npm run verify
```

生产数据库特性还应使用：

```bash
psql "$DATABASE_URL" -f scripts/postgres-smoke.sql
```

## Pull Request

PR 描述应包含改动目标、设计取舍、测试结果、数据库或环境变量变更，以及 UI 改动的桌面和移动截图。请保持提交聚焦，不混入无关重构。
