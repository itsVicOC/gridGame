# HTTP API

## 约定

- Base URL 示例：`https://api.example.com`
- 请求与响应使用 `application/json`
- 需要身份的接口使用 `Authorization: Bearer <accessToken>`
- 正式日期使用 `YYYY-MM-DD`，赛季使用 `YYYY-MM`
- 错误响应至少包含 `{ "message": "..." }`

## 健康检查

### `GET /health`

无需认证，返回服务版本和北京时间业务日期。

```json
{ "ok": true, "date": "2026-07-15", "version": "1.1.0" }
```

## 玩家

### `POST /v1/players/anonymous`

创建匿名玩家。恢复码只在创建响应中明文返回一次。

```json
{
  "player": { "id": "uuid", "nickname": "旅人", "shortCode": "A1B2C3" },
  "accessToken": "jwt",
  "recoveryCode": "random-secret"
}
```

### `POST /v1/players/recover`

请求：

```json
{ "recoveryCode": "random-secret" }
```

成功后旧恢复码与旧访问令牌失效，并返回新访问令牌和新恢复码。无效或已使用的恢复码返回 `401`。

### `GET /v1/players/me`

需要认证。返回当前玩家与由服务端成绩计算的连续天数。

```json
{
  "player": { "id": "uuid", "nickname": "旅人", "shortCode": "A1B2C3" },
  "streak": 4
}
```

### `PATCH /v1/players/me`

需要认证。请求 `{ "nickname": "纸上旅人" }`。昵称为 2–12 个允许字符，并经过保留词校验。

## 谜题

### `GET /v1/puzzles/today`

无需认证。返回北京时间当日正式题、服务器时间和最低客户端版本。

```json
{
  "date": "2026-07-15",
  "serverTime": "2026-07-14T16:00:01.000Z",
  "minClientVersion": "1.1.0",
  "puzzle": {
    "id": "daily-2026-07-15-v2.1.0",
    "date": "2026-07-15",
    "title": "午后折线",
    "width": 5,
    "height": 5,
    "start": { "row": 4, "col": 0 },
    "end": { "row": 0, "col": 4 },
    "blocked": ["0,0"],
    "required": ["2,2"],
    "rules": {},
    "challenge": { "type": "no-undo", "label": "一笔笃定：不撤销完成" },
    "optimalSteps": 8,
    "difficulty": 3,
    "generatorVersion": "2.1.0",
    "rulesVersion": "1.1.0"
  }
}
```

## 正式尝试

### `POST /v1/attempts/start`

需要认证，创建 15 分钟有效的正式尝试。

```json
{
  "attemptId": "uuid",
  "attemptToken": "jwt",
  "startedAt": "2026-07-14T16:01:00.000Z",
  "expiresAt": "2026-07-14T16:16:00.000Z"
}
```

### `POST /v1/attempts/:id/submit`

需要玩家令牌和对应尝试令牌。

```json
{
  "attemptToken": "jwt",
  "idempotencyKey": "client-generated-uuid",
  "moves": [{ "row": 4, "col": 1 }],
  "operationLog": [
    { "type": "move", "target": { "row": 4, "col": 1 }, "elapsedMs": 850 }
  ]
}
```

日志类型可为 `move`、`undo` 或 `reset`。相同玩家使用相同 `idempotencyKey` 重试时，API 返回首次处理结果。

```json
{
  "accepted": true,
  "improved": true,
  "result": {
    "valid": true,
    "completed": true,
    "stars": 2,
    "starDetails": { "completion": true, "optimal": false, "challenge": true },
    "steps": 10,
    "durationMs": 18340
  }
}
```

## 排行榜

### `GET /v1/leaderboards/daily/:date`

认证可选。返回前 100 名；提供认证时额外返回当前玩家附近名次。

### `GET /v1/leaderboards/seasons/:month`

认证可选。返回当前或历史月度赛季榜，通过 `current` 标识是否为当前赛季。

```json
{
  "key": "2026-07-15",
  "top": [{
    "id": "uuid",
    "nickname": "旅人",
    "short_code": "A1B2C3",
    "stars": 3,
    "steps": 8,
    "duration_ms": 12000,
    "rank": 1
  }],
  "nearby": []
}
```

## 限流与大小限制

- 全局：每个 IP 每分钟 120 次。
- 身份创建、恢复和改名：每个账号令牌或 IP 每分钟 12 次。
- 开始与提交尝试：每个账号令牌或 IP 每分钟 40 次。
- 请求体最大 128 KiB；移动最多 150 个，操作日志最多 500 条。
