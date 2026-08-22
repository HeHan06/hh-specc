# 平台层知识：前后端契约规范（api-conventions）

> 层级：平台层 ｜ 用途：plan（契约设计）/ tasks / implement / verify（契约一致性）阶段注入
> 效力：本文件定义契约四要素的强制格式，契约缺失任一要素不得通过 plan 门禁（宪法第四条）

## 1. 统一响应体（强制）

所有接口返回统一包裹结构：

```json
{
  "code": 0,            // 业务码：0=成功；非 0=失败（见错误码表）
  "message": "success", // 面向开发者的说明；面向用户的文案由前端按 code 映射
  "data": { }           // 业务数据；失败时可为 null
}
```

- HTTP 状态码只表达传输层结果（200/401/403/500 等），业务成败看 `code`。
- 401 未登录、403 无权限必须由后端网关/拦截器统一返回，前端统一拦截处理。

## 2. 错误码（强制）

- 错误码为整数，分段管理：
  - `0` 成功
  - `1000~1999` 通用错误（参数校验、未登录、无权限、系统繁忙）
  - `2000+` 按业务模块分段（每模块独占一段，如订单 2000~2999），在契约文件中登记模块段
- 每个错误码必须有：`码值 / 含义 / 前端默认文案`，登记在契约的错误码表中。
- 禁止直接抛出原始异常信息给用户。

## 3. 认证方式（强制）

- 3.1 令牌：JWT（Bearer Token），Header 携带 `Authorization: Bearer <token>`。
- 3.2 双端统一：小程序用微信登录（code2session）换取同一体系的 JWT；后台用账号密码登录换取同一体系的 JWT（见 `platform/miniprogram-standards.md` 第 3 节）。
- 3.3 契约必须标注每个接口的认证要求：`公开 / 需登录 / 需登录+角色（角色清单）`。
- 3.4 令牌过期返回统一错误码，前端统一走刷新或重登录流程。

## 4. 分页（强制）

- 请求参数：`pageNum`（从 1 开始）、`pageSize`（默认 10，上限 100）。
- 响应 `data` 结构：

```json
{ "list": [ ], "total": 123, "pageNum": 1, "pageSize": 10 }
```

- 排序参数统一 `orderBy=字段,asc|desc`，字段白名单在后端校验，禁止透传。

## 5. 契约文件格式（contracts/*.yaml）

每个契约文件必须包含以下要素（缺一即门禁失败）：

```yaml
module: 订单            # 业务模块名
error-code-range: 2000-2999   # 本模块错误码段
auth: 见各接口标注
endpoints:
  - method: POST
    path: /api/orders
    summary: 创建订单
    auth: 需登录（顾客）          # 认证三要素之一
    audience: miniprogram        # 可选：x-audience 标注端倾向
    request: { ... }             # 请求体字段 + 校验规则
    response: { ... }            # 响应数据字段
    error-codes: [2001, 2002]    # 可能返回的业务错误码
error-code-table:                # 错误码表（四要素之一）
  - { code: 2001, meaning: 库存不足, user-text: 当前服务暂不可订 }
```

## 6. 命名与版本

- 路径：`/api/<模块复数>/<资源>`，REST 风格；动作用词遵循 GET 查 / POST 增 / PUT 改 / DELETE 删。
- 字段命名：camelCase；时间统一 ISO-8601 字符串（UTC）；金额统一「分」为单位的整数，展示层换算。
- 契约变更：implement 阶段禁止私改；变更必须回到 plan 重新审查（宪法 4.3）。
