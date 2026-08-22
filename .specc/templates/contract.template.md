# 接口契约：{模块名}
# 格式依据：.specc/platform/api-conventions.md 第 5 节
# 效力：契约是前后端唯一真相源；implement 阶段禁止私改（宪法 4.3）
# 门禁检查：四要素（统一响应体/错误码/认证/分页）缺一即失败

module: {模块名}                # 业务模块
error-code-range: {起始}-{结束}  # 本模块错误码段（在错误码表中登记）
base-path: /api/{模块复数}
auth: JWT Bearer                # 认证方式（与 api-conventions 第 3 节一致）

# ---- 统一响应体（所有接口遵守）----
# { "code": 0, "message": "success", "data": {} }

endpoints:
  - method: POST
    path: /
    summary: {接口说明}
    auth: 需登录（{角色清单}）          # 认证标注：公开 / 需登录 / 需登录+角色
    audience: miniprogram | web-admin | both   # 可选：端倾向
    request:
      body:
        - { field: xxx, type: string, required: true, validate: "长度1-50" }
    response:
      data:
        - { field: xxx, type: string, desc: 说明 }
    error-codes: [{码值}]

  # ---- 分页列表接口示例（分页格式强制）----
  - method: GET
    path: /
    summary: 分页查询
    auth: 需登录（{角色清单}）
    request:
      query:
        - { field: pageNum, type: int, default: 1 }
        - { field: pageSize, type: int, default: 10, max: 100 }
    response:
      data:
        - { field: list, type: array }
        - { field: total, type: int }
        - { field: pageNum, type: int }
        - { field: pageSize, type: int }
    error-codes: []

# ---- 错误码表（四要素之一，必须登记）----
error-code-table:
  - { code: {码值}, meaning: {含义}, user-text: {面向用户文案} }
