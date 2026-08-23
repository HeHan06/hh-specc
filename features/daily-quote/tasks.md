# 任务清单：daily-quote

> 阶段：tasks ｜ 需求ID：daily-quote ｜ 状态：待人工审查
> 输入：spec.md、plan.md、contracts/quote.yaml、宪法 v1.1、platform/api-conventions.md
> 执行顺序：数据结构/迁移 → 接口骨架 → 测试 → 实现 → 双端页面

## 覆盖检查表（门禁依据）

| 需求编号 | 覆盖任务 | 状态 |
|---|---|---|
| Req-1 | T-03、T-04、T-05、T-07、T-08、T-09、T-10、T-11、T-12、T-13 | ⬜ |
| Req-2 | T-06、T-07 | ⬜ |
| Req-3 | T-01 | ⬜ |
| Req-4 | T-02、T-06、T-07 | ⬜ |
| Req-5 | T-04、T-05、T-10、T-11、T-12、T-13 | ⬜ |
| Req-6 | T-08、T-09、T-10、T-11、T-12、T-13 | ⬜ |
| Req-7 | T-01 | ⬜ |
| Req-8 | T-01、T-02、T-06、T-07 | ⬜ |

## 任务列表

### T-01：PostgreSQL 数据表与约束迁移

- **需求回链**：Req-3、Req-7、Req-8
- **依赖**：无
- **端/工程**：backend
- **测试先行**：否（数据结构/迁移类任务，无运行期业务逻辑；门禁以 SQL 应用成功与约束存在为准）
- **目标**：创建 `quote`、`system_config` 表，落地正文/出处/状态/背景图非空等 CHECK 约束、按日期部分唯一索引与 `updated_at` 触发器。
- **涉及文件**：
  - `backend/src/main/resources/db/migration/V1__init_quote.sql`
- **验证命令**：`psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/src/main/resources/db/migration/V1__init_quote.sql`
- **完成判据**：迁移命令成功；`quote` 表含 `ck_quote_content_not_blank`、`ck_quote_source_format`、`ck_quote_status` 约束；部分唯一索引 `uk_quote_published_display_date` 存在；`updated_at` 触发器生效。

### T-02：兜底内容种子迁移

- **需求回链**：Req-4、Req-8
- **依赖**：T-01
- **端/工程**：backend
- **测试先行**：否（种子/迁移类任务，无运行期业务逻辑；以 SQL 幂等应用成功为准）
- **目标**：将兜底语录正文、出处、背景图写入 `system_config`，保证当日无已上架语录时可返回完整兜底内容。
- **涉及文件**：
  - `backend/src/main/resources/db/migration/V2__seed_fallback_quote.sql`
- **验证命令**：`psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/src/main/resources/db/migration/V2__seed_fallback_quote.sql`
- **完成判据**：`system_config` 含 `fallback.quote.content`、`fallback.quote.source`、`fallback.quote.backgroundImage` 三条记录；正文、出处非空；出处符合「《书名》—— 作者」格式；重复执行幂等不报错。

### T-03：后端工程骨架与契约接口占位

- **需求回链**：Req-1
- **依赖**：无
- **端/工程**：backend
- **测试先行**：否（工程骨架与契约落地，先提供编译目标；T-06/T-08 才是对应测试任务）
- **目标**：创建 Spring Boot 3 + MyBatis 工程骨架，定义统一响应体、`QuoteView`、Mapper 接口及 `QuoteController`/`QuoteService` 占位，使后续测试可编译。
- **涉及文件**：
  - `backend/pom.xml`
  - `backend/mvnw`、`backend/mvnw.cmd`、`backend/.mvn/wrapper/maven-wrapper.properties`
  - `backend/src/main/java/com/dailyquote/quote/dto/ApiResponse.java`
  - `backend/src/main/java/com/dailyquote/quote/dto/QuoteView.java`
  - `backend/src/main/java/com/dailyquote/quote/controller/QuoteController.java`
  - `backend/src/main/java/com/dailyquote/quote/service/QuoteService.java`
  - `backend/src/main/java/com/dailyquote/quote/mapper/QuoteMapper.java`
  - `backend/src/main/java/com/dailyquote/quote/mapper/SystemConfigMapper.java`
  - `backend/src/main/resources/application.yml`
- **验证命令**：`cd backend && ./mvnw -q -DskipTests compile`
- **完成判据**：Maven 编译通过；`QuoteController` 暴露 `GET /api/quotes/today` 路由（占位响应使用统一响应体）；依赖版本与 plan 第 6 节一致；敏感配置仅从环境变量读取，无密钥硬编码。

### T-04：shared 纯逻辑测试（测试先行）

- **需求回链**：Req-1、Req-5
- **依赖**：无
- **端/工程**：shared
- **测试先行**：是（先写 Vitest 单测，确认失败方向后再在 T-05 实现）
- **目标**：为 `truncateQuoteText`、`formatShanghaiDate`、`getTodayQuote` 与本地兜底常量编写测试。
- **涉及文件**：
  - `shared/package.json`
  - `shared/vitest.config.js`
  - `shared/__tests__/utils/quote.test.js`
  - `shared/__tests__/api/quote.test.js`
  - `shared/__tests__/constants/quote.test.js`
- **验证命令**：`cd shared && npm run test:shared`
- **完成判据**：测试文件可被 Vitest 收集并运行；当前因实现缺失而失败（红），断言方向与需求一致（正文截断 60 字保留出处、上海日期格式 YYYY-MM-DD、API 路径 `/api/quotes/today` 与统一解包、本地兜底文案非空）；T-05 实现后同命令转绿。

### T-05：shared 纯逻辑实现

- **需求回链**：Req-1、Req-5
- **依赖**：T-04
- **端/工程**：shared
- **测试先行**：否（测试已在 T-04 前置完成）
- **目标**：实现 `shared/` 纯逻辑：类型定义、常量、工具函数与注入式 API 客户端；禁止引入 DOM、`wx.*`、React 组件或路由逻辑。
- **涉及文件**：
  - `shared/types/quote.js`
  - `shared/constants/quote.js`
  - `shared/constants/error-code-text.js`
  - `shared/utils/quote.js`
  - `shared/api/client.js`
  - `shared/api/quote.js`
- **验证命令**：`cd shared && npm run test:shared`
- **完成判据**：`npm run test:shared` 通过；`shared/` 无 DOM、`wx.*`、React 组件或路由逻辑；错误码文案映射与 `contracts/quote.yaml` 错误码表一致。

### T-06：后端 QuoteService 测试（测试先行）

- **需求回链**：Req-2、Req-4、Req-8
- **依赖**：T-03
- **端/工程**：backend
- **测试先行**：是（先写 `QuoteServiceTest`，覆盖正常路径与至少一个异常路径）
- **目标**：编写 `QuoteService` 单元测试：按上海日期查询当日已上架、无内容回退兜底、兜底缺失或格式非法抛统一业务异常。
- **涉及文件**：
  - `backend/src/test/java/com/dailyquote/quote/service/QuoteServiceTest.java`
- **验证命令**：`cd backend && ./mvnw -q -Dtest=QuoteServiceTest test`
- **完成判据**：测试可编译并运行，当前因 `QuoteService` 占位实现而失败（红）；失败断言覆盖正常路径与异常路径，方向与 Req-2/4/8 一致；T-07 实现后同命令转绿。

### T-07：后端 QuoteService 与 Mapper 实现

- **需求回链**：Req-1、Req-2、Req-4、Req-8
- **依赖**：T-06
- **端/工程**：backend
- **测试先行**：否（测试已在 T-06 前置完成）
- **目标**：实现 `QuoteService` 与 Mapper 查询：用 `ZoneId.of("Asia/Shanghai")` 计算今日日期，MyBatis 仅用 `#{}` 查询 `display_date = #{displayDate} AND status = 'published' LIMIT 1`；无结果时读取兜底配置并组装 `QuoteView`。
- **涉及文件**：
  - `backend/src/main/java/com/dailyquote/quote/service/QuoteService.java`
  - `backend/src/main/java/com/dailyquote/quote/mapper/QuoteMapper.java`
  - `backend/src/main/java/com/dailyquote/quote/mapper/SystemConfigMapper.java`
  - `backend/src/main/resources/mapper/QuoteMapper.xml`
  - `backend/src/main/resources/mapper/SystemConfigMapper.xml`
  - `backend/src/main/java/com/dailyquote/quote/dto/QuoteView.java`
- **验证命令**：`cd backend && ./mvnw -q -Dtest=QuoteServiceTest test`
- **完成判据**：`QuoteServiceTest` 通过；SQL 全部使用 `#{}`，无 `${}` 拼接；日期计算在服务端完成，客户端不传日期；无结果时返回兜底内容而非空数据。

### T-08：后端 QuoteController 测试（测试先行）

- **需求回链**：Req-1、Req-6
- **依赖**：T-03
- **端/工程**：backend
- **测试先行**：是（先写 `QuoteControllerTest`，验证公开访问、统一响应体与错误码）
- **目标**：编写 `QuoteController` 切片测试：未登录可访问 `GET /api/quotes/today`，返回统一响应体与四要素字段；异常返回标准错误码。
- **涉及文件**：
  - `backend/src/test/java/com/dailyquote/quote/controller/QuoteControllerTest.java`
- **验证命令**：`cd backend && ./mvnw -q -Dtest=QuoteControllerTest test`
- **完成判据**：测试可编译并运行，当前因 Controller 占位或鉴权配置缺失而失败（红）；断言方向与契约一致；T-09 实现后同命令转绿。

### T-09：后端 Controller、鉴权白名单与静态路由实现

- **需求回链**：Req-1、Req-6
- **依赖**：T-08
- **端/工程**：backend
- **测试先行**：否（测试已在 T-08 前置完成）
- **目标**：完成 Controller 响应组装、统一异常处理、`/api/quotes/today` 鉴权白名单，并将 Web 构建产物以静态路由托管：`/` 返回 `index.html`，`/api/*` 优先匹配 API，非 API 前端路由回退 `index.html`。
- **涉及文件**：
  - `backend/src/main/java/com/dailyquote/quote/controller/QuoteController.java`
  - `backend/src/main/java/com/dailyquote/quote/config/SecurityConfig.java`
  - `backend/src/main/java/com/dailyquote/quote/common/ApiException.java`
  - `backend/src/main/java/com/dailyquote/quote/common/GlobalExceptionHandler.java`
  - `backend/src/main/java/com/dailyquote/quote/config/WebMvcConfig.java`
  - `backend/src/main/resources/static/assets/images/fallback-bg.png`
- **验证命令**：`cd backend && ./mvnw -q -Dtest=QuoteServiceTest,QuoteControllerTest test`
- **完成判据**：`QuoteServiceTest` 与 `QuoteControllerTest` 全部通过；`GET /api/quotes/today` 无令牌可访问；异常经统一处理器返回标准响应体；静态路由不吞掉 `/api/*`。

### T-10：Web 展示页测试（测试先行）

- **需求回链**：Req-1、Req-5、Req-6
- **依赖**：T-05
- **端/工程**：web-admin
- **测试先行**：是（先写页面可渲染测试与本地兜底分支测试）
- **目标**：创建 Vite + React 18 + Ant Design 5 工程骨架，编写 `QuotePage` 可渲染测试：四要素齐全、接口失败时渲染本地兜底、无登录/注册入口。
- **涉及文件**：
  - `web-admin/package.json`
  - `web-admin/vite.config.js`
  - `web-admin/src/pages/QuotePage.test.jsx`
  - `web-admin/src/test/setup.js`
- **验证命令**：`cd web-admin && npm test -- QuotePage`
- **完成判据**：测试配置就绪，测试文件可被 Vitest 收集；当前因 `QuotePage` 组件缺失而失败（红），断言方向与 Req-1/5/6 一致；T-11 实现后同命令转绿。

### T-11：Web 展示页实现

- **需求回链**：Req-1、Req-5、Req-6
- **依赖**：T-10
- **端/工程**：web-admin
- **测试先行**：否（测试已在 T-10 前置完成）
- **目标**：实现 Web 展示页 `/`：通过 `shared/api/quote.js` 获取今日语录，渲染背景图、正文、出处、当天日期四要素；接口失败时渲染本地兜底；页面无账号入口。
- **涉及文件**：
  - `web-admin/src/pages/QuotePage.jsx`
  - `web-admin/src/App.jsx`
  - `web-admin/src/main.jsx`
  - `web-admin/src/index.css`
  - `web-admin/index.html`
- **验证命令**：`cd web-admin && npm test -- QuotePage && npm run build`
- **完成判据**：`QuotePage` 测试通过；`npm run build` 成功；页面复用 `shared/`，不裸写请求逻辑；无登录/注册入口；背景图居中裁切适配宽屏。

### T-12：小程序展示页测试（测试先行）

- **需求回链**：Req-1、Req-5、Req-6
- **依赖**：T-05
- **端/工程**：miniprogram
- **测试先行**：是（先写 Taro 页面可渲染测试与本地兜底分支测试）
- **目标**：创建 Taro 工程骨架，编写 `pages/quote/index` 可渲染测试：四要素齐全、接口失败时渲染本地兜底、无账号入口。
- **涉及文件**：
  - `miniprogram/package.json`
  - `miniprogram/src/pages/quote/index.test.js`
  - `miniprogram/src/test/setup.js`
- **验证命令**：`cd miniprogram && npm test -- quote/index`
- **完成判据**：Taro 测试配置就绪，测试文件可被测试工具收集；当前因页面缺失而失败（红），断言方向与 Req-1/5/6 一致；T-13 实现后同命令转绿。

### T-13：小程序展示页实现

- **需求回链**：Req-1、Req-5、Req-6
- **依赖**：T-12
- **端/工程**：miniprogram
- **测试先行**：否（测试已在 T-12 前置完成）
- **目标**：实现小程序 `pages/quote/index`：通过 `shared/api/quote.js` 获取今日语录，渲染背景图、正文、出处、当天日期四要素；接口失败时渲染本地兜底；页面无账号入口、不配置 tabBar、不申请隐私权限。
- **涉及文件**：
  - `miniprogram/src/pages/quote/index.jsx`
  - `miniprogram/src/pages/quote/index.scss`
  - `miniprogram/src/app.config.js`
  - `miniprogram/src/app.js`
  - `miniprogram/src/platform/request.js`
- **验证命令**：`cd miniprogram && npm test -- quote/index && npm run build:weapp`
- **完成判据**：`quote/index` 测试通过；`npm run build:weapp` 成功；页面复用 `shared/`，请求统一走 `src/platform/request.js`，不裸调 `wx.*`；无登录/注册入口；主包体积不超过 2MB。

## 执行说明

- 按依赖顺序执行；每个任务完成其验证命令后，方可进入下一任务。
- 测试先行任务（T-04/T-06/T-08/T-10/T-12）以「确认失败方向正确」作为测试编写完成标志，对应实现任务（T-05/T-07/T-09/T-11/T-13）必须让同一验证命令转绿。
- 任务失败自动重试 1 次，再失败挂起转人工。
- 禁止跨任务修改范围外代码；涉及契约或 DDL 变更必须回到 plan 阶段审查。
