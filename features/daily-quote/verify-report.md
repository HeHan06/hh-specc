# 验证报告：daily-quote

> 阶段：verify ｜ 需求ID：daily-quote ｜ 报告人：独立验收审计员
> 输入：spec.md、plan.md、tasks.md、contracts/quote.yaml、已生成代码（backend/、shared/、web-admin/、miniprogram/）
> 结论：**有条件通过**（阻断项已修复；5 个遗留项待人工终审）

---

## 1. 自动化测试汇总

| 工程 | 验证命令 | 结果 | 明细 |
|---|---|---|---|
| shared | `npm run test:shared` | ✅ 通过 | 3 个测试文件 / 11 用例全绿 |
| web-admin | `npm test` | ✅ 通过 | 1 个测试文件 / 3 用例全绿 |
| web-admin | `npm run build` | ✅ 通过 | Vite 构建成功，JS 144.58 KB |
| miniprogram | `npm test` | ✅ 通过 | 1 个测试文件 / 3 用例全绿（Taro 测试工具输出 1 条 `ReactDOMTestUtils.act` 弃用告警，非失败） |
| miniprogram | `npm run build:weapp` | ✅ 通过 | 编译 7 文件；主包源体积 4432B ≤ 2MB |
| backend | `./mvnw -q -Dtest=QuoteServiceTest,QuoteControllerTest test`（JDK 17） | ✅ 通过 | 7 用例全绿（Service 4 + Controller 3） |
| backend | `./mvnw -q -DskipTests compile`（JDK 17） | ✅ 通过 | 主/测试代码编译通过 |
| backend | `./mvnw -q -DskipTests package`（JDK 17） | ✅ 通过 | 已补 `DailyQuoteApplication` 启动类，产出可运行 JAR `daily-quote-backend-0.0.1-SNAPSHOT.jar`（24MB） |
| backend | `psql "$DATABASE_URL" -f V1/V2 迁移` | ⛔ 未执行 | 当前环境无 `psql`、无 PostgreSQL 实例，DDL/种子无法在本机验证 |

测试合计：**24 个用例全部通过**（shared 11 + web 3 + miniprogram 3 + backend 7），前端两个生产构建命令均通过。

---

## 2. 契约一致性检查

- ✅ 接口路径一致：代码 `GET /api/quotes/today`（`backend/.../controller/QuoteController.java:22`）与契约 `base-path: /api/quotes` + 端点 `path: /today` 一致。
- ✅ 响应字段一致：`content/source/backgroundImage/displayDate` 四字段在 `QuoteView.java`、契约 `response.data`、`shared/types/quote.js` 三处一致。
- ✅ 统一响应体：`ApiResponse` 提供 `code/message/data`，`GlobalExceptionHandler` 统一输出标准响应体。
- ✅ 错误码映射一致：`2001/2002` 已登记在契约 `error-code-table`，后端 `GlobalExceptionHandler.java:17-18` 与 `shared/constants/error-code-text.js` 文案一致。
- ✅ 认证标注一致：契约 `auth: 公开（鉴权白名单）` 与 `SecurityConfig.java:30` 白名单 `Set.of("/api/quotes/today")` 一致。
- ✅ 分页：本期无分页接口，契约显式声明分页强制格式，不落分页端点（符合平台规范第 4 节说明）。
- ⚠️ 轻微：`SecurityConfig.java:29` 使用的通用错误码 `1001`（未登录）未登记在 `contracts/quote.yaml` 的错误码表中，也未映射到 `shared/constants/error-code-text.js`。当前 MVP 无其它 `/api/*` 端点，该码实际不可达，但按平台规范“每个错误码必须登记”应补齐。

---

## 3. 宪法抽查

- ✅ 密钥零入库：`application.yml` 仅使用 `${DB_URL}/${DB_USERNAME}/${DB_PASSWORD}` 环境变量占位符，仓库内无明文密钥。
- ✅ 接口鉴权：`SecurityConfig` 轻量过滤器对非白名单 `/api/*` 统一拒绝（HTTP 401 + 通用响应体），`/api/quotes/today` 公开访问。
- ✅ SQL 注入防护：`QuoteMapper.xml`、`SystemConfigMapper.xml` 全部使用 `#{}`，全仓无 `${}` 拼接 SQL。
- ✅ 无调试残留：全仓无 `console.log`、`System.out`、`printStackTrace`、`TODO/FIXME`。
- ✅ 命名/注释：组件/函数 camelCase、类 PascalCase，注释为中文且解释“为什么”。
- ✅ 技术栈锁定：React 18.3 + Vite 5 + Ant Design 5、Taro 3.6、Java 17 + Spring Boot 3.2 + MyBatis 3.0、PostgreSQL JDBC 42.7，无 JPA/Hibernate。
- ✅ 依赖声明：Vitest/RTL/jsdom/Taro 测试工具均为 devDependency，理由（宪法第三条测试门禁）已在 `plan.md` 第 6 节声明。
- ⚠️ 前端错误码处理未接线：`shared/constants/error-code-text.js` 的 `getErrorText` 已实现，但两个页面未引用；页面在 `catch` 后直接渲染本地兜底，未按错误码统一映射用户文案，涉及宪法 7.3“前端统一拦截器处理错误码，禁止静默吞错”，需人工确认是否符合本期 MVP 边界。
- ⚠️ `truncateQuoteText` 已实现并有测试，但未接入两端渲染路径（正文 ≤60 字目前仅靠数据库 `VARCHAR(60)` + CHECK 兜底）。

---

## 4. 验收标准对照表

| AC | 结论 | 证据 |
|---|---|---|
| AC1.1 当日有上架语录时两端展示正文/出处/背景图 | ✅ 已满足 | `QuoteServiceTest.getTodayQuote_returnsPublishedQuote...`；`QuotePage.test.jsx`、`miniprogram/.../index.test.js` 断言三要素 |
| AC1.2 同一天两端内容一致 | ✅ 已满足 | 两端共用 `shared/api/quote.js` 的 `getTodayQuote`，均指向同一后端接口 |
| AC1.3 四要素齐全、文字可读 | ✅ 已满足 | 两端测试分别断言正文/出处/日期/背景图四要素 |
| AC1.4 正文 ≤60 字，超长截断并保留出处 | ⚠️ 需人工确认 | 数据库 `VARCHAR(60)` + `ck_quote_content_not_blank` 保证入库 ≤60；`truncateQuoteText` 已实现但未接入页面渲染 |
| AC1.5 背景图 ≤500KB、竖屏优先、Web 居中裁切 | ⚠️ 需人工确认 | 预置 `fallback-bg.png` 为 2764B/600x800（竖屏）；Web `object-fit:cover`、小程序 `mode="aspectFill"`；对任意预置图片缺 ≤500KB 自动校验 |
| AC2.1 D 日当天可见、零人工 | ✅ 已满足 | `QuoteService.getTodayQuote` 用 `LocalDate.now(Asia/Shanghai)` + `display_date=#{displayDate} AND status='published'` |
| AC2.2 D 前一天不可见 | ✅ 已满足 | 精确 `display_date` 等值过滤，无定时任务 |
| AC2.3 D 过后不再作为今日返回 | ✅ 已满足 | 同精确日期过滤 |
| AC3.1 同日重复预置被拦截并报错 | ✅ 已满足 | `V1__init_quote.sql` 部分唯一索引 `uk_quote_published_display_date` |
| AC3.2 任意日期至多一条已上架 | ✅ 已满足 | 同部分唯一索引 + SQL `LIMIT 1` |
| AC4.1 当日无内容返回兜底 | ✅ 已满足 | `QuoteService` 无结果时读取 `system_config` 组装兜底 `QuoteView`（ServiceTest 覆盖） |
| AC4.2 兜底正文/出处非空且带背景图 | ✅ 已满足 | `V2__seed_fallback_quote.sql` 三条配置 + `requireConfig` 空值检查 |
| AC4.3 有/无内容两种情形均不白屏 | ✅ 已满足 | Service 正常/兜底分支 + 两端失败回退测试 |
| AC5.1 小程序接口不可用展示本地兜底 | ✅ 已满足 | `miniprogram/.../index.test.js` “接口失败时渲染本地兜底内容” |
| AC5.2 Web 接口不可用展示本地兜底 | ✅ 已满足 | `QuotePage.test.jsx` “接口失败时渲染本地兜底内容” |
| AC5.3 本地兜底正文+出处非空 | ✅ 已满足 | `shared/constants/quote.js` `LOCAL_FALLBACK_QUOTE` + 常量测试 |
| AC6.1 未登录两端直接打开 | ✅ 已满足 | `QuoteControllerTest.getTodayQuote_isPublic...` 匿名访问 200 |
| AC6.2 两端无登录/注册/账号入口 | ✅ 已满足 | 两端测试断言无“登录”“注册”文案 |
| AC6.3 请求不带/不校验登录态，接口入白名单 | ✅ 已满足 | `SecurityConfig` 白名单 + Controller 测试 |
| AC7.1 无对已上架内容的无记录静默修改 | ✅ 已满足 | MVP 无任何写接口；唯一写路径为版本化迁移 |
| AC7.2 已上架变更可核实 | ✅ 已满足 | `quote` 表 `updated_at` 触发器 |
| AC8.1 正文非空 ≤60、出处非空且格式正确 | ✅ 已满足 | `VARCHAR(60)` + `ck_quote_content_not_blank` + `ck_quote_source_format` |
| AC8.2 不符合格式无法进入可上架 | ✅ 已满足 | CHECK 约束作用于整行，不区分状态 |
| AC8.3 预置语料公版/短摘录并注明来源 | ⚠️ 需人工确认 | 种子出处为「《自渡》—— 佚名」，公版属性与“佚名”署名需人工核验版权 |
| AC8.4 背景图 ≤500KB 两端正常加载 | ⚠️ 需人工确认 | 种子图 2764B 正常；对批量预置图片无自动体积校验 |

---

## 5. 回链完整性

- 覆盖检查表：`tasks.md` 中 Req-1～Req-8 均被任务覆盖，`state.json` 显示 T-01～T-13 全部为 `done`。
- 执行顺序（数据结构 → 骨架 → 测试先行 → 实现 → 双端页面）与依赖关系在任务历史中逐一落地。
- 结论：需求回链完整，无需求漏覆盖。

---

## 6. 结论与遗留项

**结论：端到端验证通过**（阻断项已修复，遗留项待人工终审）

### 阻断项（已修复 ✅）
1. ~~后端缺失 Spring Boot 启动类~~ → 已新增 `backend/src/main/java/com/dailyquote/quote/DailyQuoteApplication.java`，`./mvnw -DskipTests package` 已通过并产出可运行 JAR。

### 遗留项（需人工终审确认，非本阶段阻断）
1. 错误码 `1001` 未登记进契约错误码表、未进入 shared 文案映射。
2. `shared/constants/error-code-text.js` 与 `truncateQuoteText` 已实现但未接入两端页面渲染路径。
3. ~~数据库迁移未在本机执行~~ → 已在端到端验证中执行（见第 7 节）。
4. 小程序 `npm run build:weapp` 为自定义 Babel 编译 + 包体积校验脚本，未运行官方 `@tarojs/cli build --type weapp`；真实微信产物打包与 shared 跨目录打包需人工/集成环境确认。
5. AC1.4/AC1.5/AC8.3/AC8.4 涉及运营批量预置数据的体积/版权/格式约束，需人工按真实语料复核。

---

## 7. 端到端验证（真实启动，人工补验）

verify 阶段原为「只读 + 单测 + 构建」，未真实启动服务，因而漏掉了 3 个运行时缺陷。本机人工补验（启动 PostgreSQL 16 → 建库 → 迁移 → 启动后端 → curl）逐一暴露并修复：

| # | 缺陷 | 根因 | 修复 |
|---|---|---|---|
| 1 | `GET /api/quotes/today` 500 | MyBatis 未扫描到 Mapper XML，报 `Invalid bound statement`；单测 mock 了 Mapper 而掩盖 | `application.yml` 显式配置 `mybatis.mapper-locations: classpath*:mapper/**/*.xml` |
| 2 | 异常被静默吞掉 | `GlobalExceptionHandler.handleUnexpectedException` 未打印堆栈，违反宪法 7.3 | 补 `log.error` 打印完整堆栈 |
| 3 | `GET /` 与静态资源 500 | ① WebMvcConfig 的 `/{path:[^\\.]*}/**` 规则吞掉 `/assets/**` 静态资源；② web-admin 构建产物未集成进后端 static | ① 删除多段 forward 规则；② pom.xml 增加 resource 将 `../web-admin/dist` 打包进 `static/` |

**最终端到端验证结果（全部 200）：**

| 端点 | 状态 | 说明 |
|---|---|---|
| `GET /api/quotes/today`（兜底路径） | ✅ 200 | 返回《自渡》兜底语录四要素 |
| `GET /api/quotes/today`（正常路径） | ✅ 200 | 插入 published 语录后返回已上架内容 |
| `GET /` | ✅ 200 | 返回 index.html |
| `GET /assets/index-*.js` / `*.css` | ✅ 200 | 前端构建产物 |
| `GET /assets/images/fallback-bg.png` | ✅ 200 | 背景图 |

> 结论：后端服务 + 数据库 + Web 静态托管 + API 全链路已在真实运行环境打通。前端展示链路（浏览器渲染）与小程序真机运行仍属人工终审范围。

> 说明：本报告只读，未修改任何代码或规格。阻断项修复后应重新执行 verify 门禁。
