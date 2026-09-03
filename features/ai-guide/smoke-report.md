# 端到端冒烟报告：ai-guide

> 由 verify 阶段确定性执行（lib/smoke.sh），以「从前端页面入口」的真实链路冒烟为准。
> 冒烟时间：2026-09-03T13:27:57

| 结果 | 检查项 |
|---|---|
| ✅ | 后端启动成功（端口 8080） |
| ✅ | 前端 [web-admin] 页面可访问（http://localhost:5173/） |
| ✅ | 前端 [web-reader] 页面可访问（http://localhost:5174/） |
| ✅ | [web-admin] 页面入口 / 返回 200 |
| ✅ | [web-admin] 经前端代理 /api/topics 返回 code=0 |
| ✅ | [web-admin] 经前端代理 /api/contents/latest 返回 code=0 |
| ✅ | [web-admin] 经前端代理 /api/contents/recommended 返回 code=0 |
| ✅ | [web-reader] 页面入口 / 返回 200 |
| ✅ | [web-reader] 经前端代理 /api/topics 返回 code=0 |
| ✅ | [web-reader] 经前端代理 /api/contents/latest 返回 code=0 |
| ✅ | [web-reader] 经前端代理 /api/contents/recommended 返回 code=0 |
| ✅ | 后端直连 /api/topics 返回 code=0 |
| ✅ | 管理员登录链路通过（admin） |

**结论：通过**（端到端冒烟全部通过）
