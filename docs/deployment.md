# 部署指南

推荐使用 GitHub Pages 托管 Web，VPS 通过 Docker Compose 运行 API、PostgreSQL 和 Caddy。

## GitHub Pages

仓库包含 `.github/workflows/pages.yml`：

1. 在 **Settings → Pages** 将 Source 设置为 **GitHub Actions**；
2. 在 Actions Variables 创建 `VITE_API_URL`，例如 `https://api.example.com`；
3. 推送到 `main` 或手动运行 Pages workflow。

工作流自动将 `VITE_BASE_PATH` 设置为 `/<repository>/`，确保脚本、manifest 和 Service Worker 在子路径正常工作。

## VPS 准备

- 安装 Docker Engine 与 Compose plugin；
- 将 API 域名解析到 VPS；
- 防火墙开放 80 和 443；
- 准备 PostgreSQL 数据卷与备份空间。

创建 `.env`：

```dotenv
POSTGRES_PASSWORD=replace-with-a-long-random-password
JWT_SECRET=replace-with-at-least-32-random-bytes
ALLOWED_ORIGIN=https://your-name.github.io
API_DOMAIN=api.example.com
```

`ALLOWED_ORIGIN` 支持逗号分隔多个精确来源，不要在生产环境使用通配符。

## 启动

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f migrate api caddy
```

启动顺序为 PostgreSQL、迁移、API 健康检查、Caddy。验证：

```bash
curl --fail https://api.example.com/health
psql "$DATABASE_URL" -f scripts/postgres-smoke.sql
```

## 更新

```bash
git pull --ff-only
docker compose up -d --build
docker compose ps
```

迁移应保持向后兼容：先新增结构并部署兼容代码，确认稳定后再在后续版本清理旧结构。

## Container Registry

`.github/workflows/api.yml` 在 `main` 或 `v*` tag 推送时构建镜像到 `ghcr.io/<owner>/<repository>/api`。当前 Compose 默认在 VPS 本地构建。

## 备份

```bash
DATABASE_URL='postgres://...' BACKUP_DIR=/var/backups/pathweave \
  ./scripts/backup-postgres.sh
```

建议每日运行并保留至少 14 天，每月至少在隔离数据库演练一次恢复。

## 发布检查清单

- `npm run verify` 通过；
- `npm audit --omit=dev` 无高危漏洞；
- Pages workflow 成功；
- API 与 PostgreSQL 健康检查正常；
- `postgres-smoke.sql` 通过；
- CORS 只允许正式来源；
- 数据库备份与容量告警已配置。
