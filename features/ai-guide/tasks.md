# 任务清单：ai-guide

> 阶段：tasks ｜ 需求ID：ai-guide ｜ 状态：待人工审查
> 输入：spec.md、plan.md、contracts/{common,content,tip,consultation,admin}.yaml、宪法 v1.2、platform/api-conventions.md
> 路径约定：任务涉及文件均相对 `projects/ai-guide/`；验证命令默认在 `projects/ai-guide/` 下执行。
> 执行顺序：数据结构/迁移 → 接口骨架 → 测试 → 实现 → 双端页面。

## 覆盖检查表（门禁依据）

| 需求编号 | 覆盖任务 | 状态 |
|---|---|---|
| Req-1 | T-04、T-05、T-06、T-07、T-08、T-13、T-14、T-17、T-18 | ⬜ |
| Req-2 | T-04、T-07、T-08、T-13、T-14、T-19、T-20 | ⬜ |
| Req-3 | T-01、T-04、T-07、T-08、T-13、T-14、T-19、T-20、T-29 | ⬜ |
| Req-4 | T-01、T-04、T-07、T-08、T-13、T-14、T-19、T-20 | ⬜ |
| Req-5 | T-01、T-04、T-05、T-06、T-09、T-10、T-13、T-14、T-21、T-22 | ⬜ |
| Req-6 | T-01、T-04、T-05、T-06、T-09、T-10、T-13、T-14、T-21、T-22 | ⬜ |
| Req-7 | T-01、T-03、T-04、T-09、T-10、T-11、T-12、T-15、T-16、T-21、T-22、T-27、T-28 | ⬜ |
| Req-8 | T-01、T-03、T-04、T-11、T-12、T-15、T-16、T-23、T-24 | ⬜ |
| Req-9 | T-01、T-04、T-11、T-12、T-15、T-16、T-25、T-26 | ⬜ |
| Req-10 | T-04、T-11、T-12、T-15、T-16、T-25、T-26 | ⬜ |
| Req-11 | T-01、T-03、T-04、T-11、T-12、T-15、T-16、T-27、T-28 | ⬜ |
| Req-12 | T-02、T-03、T-05、T-06、T-09、T-10、T-11、T-12、T-13、T-14、T-15、T-16、T-19、T-20、T-21、T-22、T-23、T-24、T-25、T-26、T-27、T-28 | ⬜ |
| Req-13 | T-01、T-08、T-13、T-14、T-17、T-18、T-19、T-20、T-21、T-22、T-25、T-26 | ⬜ |
| Req-14 | T-29、T-30、T-31 | ⬜ |

## 任务列表

### T-01：PostgreSQL 数据表、约束、索引与配额初始化

- **需求回链**：Req-3、Req-4、Req-5、Req-6、Req-7、Req-8、Req-9、Req-11、Req-13
- **依赖**：无
- **端/工程**：backend
- **测试先行**：否（数据结构/迁移类任务，无运行期业务逻辑；门禁以 SQL 应用成功与约束存在为准）
- **目标**：创建 plan 第 4 节全部表，落地内容类型/来源/状态、点赞唯一约束、打赏金额枚举、咨询免费名额行级控制、操作日志等约束，并建立查询索引与 `updated_at` 触发器。
- **涉及文件**：
  - `backend/src/main/resources/db/migration/V1__init_ai_guide.sql`
- **验证命令**：`psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/src/main/resources/db/migration/V1__init_ai_guide.sql`
- **完成判据**：迁移成功；存在 `uk_content_like(content_id, visitor_id)`、`ck_content_type`、`ck_content_source`、`ck_content_status`、`ck_tip_amount`、`ck_consultation_price`；存在内容状态/发布时间/推荐/标签与 trigram 查询索引；`consultation_quota` 初始化单行且 `used_count=0`；`updated_at` 触发器生效。

### T-02：后端工程骨架与统一异常/响应基座

- **需求回链**：Req-12、Req-13
- **依赖**：无
- **端/工程**：backend
- **测试先行**：否（工程骨架与公共基座任务，先提供编译目标；T-07/T-09/T-11 才是业务测试任务）
- **目标**：创建 Spring Boot 3 + MyBatis 工程骨架，落地统一响应体、错误码枚举、全局异常处理与 MyBatis 配置，保证所有敏感配置仅从环境变量读取。
- **涉及文件**：
  - `backend/pom.xml`
  - `backend/mvnw`、`backend/mvnw.cmd`、`backend/.mvn/wrapper/maven-wrapper.properties`
  - `backend/src/main/java/com/aiguide/common/ApiResponse.java`
  - `backend/src/main/java/com/aiguide/common/ApiErrorCode.java`
  - `backend/src/main/java/com/aiguide/common/ApiException.java`
  - `backend/src/main/java/com/aiguide/common/GlobalExceptionHandler.java`
  - `backend/src/main/java/com/aiguide/config/MyBatisConfig.java`
  - `backend/src/main/resources/application.yml`
- **验证命令**：`cd backend && ./mvnw -q -DskipTests compile`
- **完成判据**：Maven 编译通过；统一响应体符合 `contracts/common.yaml`；全局异常处理器不向用户抛出原始异常；依赖仅含 Spring Boot 3、MyBatis、PostgreSQL、JWT、BCrypt 等 plan 已声明项；无 JPA/Hibernate，无密钥硬编码。

### T-03：JWT 鉴权、操作日志切面与站点配置基础设施

- **需求回链**：Req-8、Req-11、Req-12
- **依赖**：T-02
- **端/工程**：backend
- **测试先行**：否（安全/切面基础设施任务；对应行为在 T-11/T-12/T-15/T-16 中测试）
- **目标**：建立 JWT Bearer 校验过滤器与 `/api/admin/**` 鉴权规则，公开接口白名单，管理员微信号环境配置，以及敏感操作日志切面接口。
- **涉及文件**：
  - `backend/src/main/java/com/aiguide/security/JwtTokenService.java`
  - `backend/src/main/java/com/aiguide/security/JwtAuthFilter.java`
  - `backend/src/main/java/com/aiguide/config/SecurityConfig.java`
  - `backend/src/main/java/com/aiguide/config/SiteConfigProperties.java`
  - `backend/src/main/java/com/aiguide/operationlog/OperationLogService.java`
  - `backend/src/main/java/com/aiguide/operationlog/OperationLogAspect.java`
  - `backend/src/main/java/com/aiguide/operationlog/OperationLogMapper.java`
- **验证命令**：`cd backend && ./mvnw -q -DskipTests compile`
- **完成判据**：Maven 编译通过；登录接口为公开白名单，其余 `/api/admin/**` 必须 `ADMIN` 角色；`ADMIN_WECHAT_ID` 从环境变量读取；敏感操作切面先校验管理员再落日志，日志写入与业务更新同事务入口具备。

### T-04：后端契约接口骨架与领域占位

- **需求回链**：Req-1、Req-2、Req-3、Req-4、Req-5、Req-6、Req-7、Req-8、Req-9、Req-10、Req-11
- **依赖**：T-03
- **端/工程**：backend
- **测试先行**：否（契约落地的接口骨架，先提供编译目标；对应测试在 T-07/T-09/T-11/T-13/T-15）
- **目标**：按 `contracts/` 创建 DTO/Mapper/Controller/Service 占位，确保所有契约路径有明确后端入口且可编译。
- **涉及文件**：
  - `backend/src/main/java/com/aiguide/content/dto/*.java`
  - `backend/src/main/java/com/aiguide/content/mapper/*.java`
  - `backend/src/main/java/com/aiguide/content/controller/*.java`
  - `backend/src/main/java/com/aiguide/content/service/*.java`
  - `backend/src/main/java/com/aiguide/order/dto/*.java`
  - `backend/src/main/java/com/aiguide/order/mapper/*.java`
  - `backend/src/main/java/com/aiguide/order/controller/*.java`
  - `backend/src/main/java/com/aiguide/order/service/*.java`
  - `backend/src/main/java/com/aiguide/admin/controller/*.java`
  - `backend/src/main/java/com/aiguide/admin/service/*.java`
  - `backend/src/main/resources/mapper/*.xml`
- **验证命令**：`cd backend && ./mvnw -q -DskipTests compile`
- **完成判据**：Maven 编译通过；`contracts/content.yaml`、`tip.yaml`、`consultation.yaml`、`admin.yaml` 中每个 endpoint 都有对应 Controller 方法占位；Controller 不写业务逻辑；Mapper 全为 MyBatis 接口/XML，无 JPA。

### T-05：shared 纯逻辑测试（测试先行）

- **需求回链**：Req-1、Req-5、Req-6、Req-12
- **依赖**：无
- **端/工程**：shared
- **测试先行**：是（先写 Vitest 单测，确认失败方向后再在 T-06 实现）
- **目标**：为类型常量、金额换算、输入校验、错误码文案映射与 API 客户端封装编写测试。
- **涉及文件**：
  - `shared/package.json`
  - `shared/vitest.config.js`
  - `shared/__tests__/constants/content.test.js`
  - `shared/__tests__/constants/order.test.js`
  - `shared/__tests__/constants/error-code-text.test.js`
  - `shared/__tests__/utils/money.test.js`
  - `shared/__tests__/utils/validate.test.js`
  - `shared/__tests__/api/client.test.js`
  - `shared/__tests__/api/content.test.js`
  - `shared/__tests__/api/order.test.js`
  - `shared/__tests__/api/admin.test.js`
- **验证命令**：`cd shared && npm run test`
- **完成判据**：测试可被 Vitest 收集并运行；当前因实现缺失而失败（红），断言方向与需求一致（金额档位为 10/100/500/1000/5000/10000 分、500 元=50000 分、手机/微信与搜索词校验、分页上限 100、错误码映射、API 路径与统一解包）；T-06 实现后同命令转绿。

### T-06：shared 纯逻辑实现

- **需求回链**：Req-1、Req-5、Req-6、Req-12
- **依赖**：T-05
- **端/工程**：shared
- **测试先行**：否（测试已在 T-05 前置完成）
- **目标**：实现 `shared/` 的类型定义、常量、金额与校验工具、错误码文案映射及平台无关 API 客户端。
- **涉及文件**：
  - `shared/types/content.js`
  - `shared/types/order.js`
  - `shared/constants/content.js`
  - `shared/constants/order.js`
  - `shared/constants/error-code-text.js`
  - `shared/utils/money.js`
  - `shared/utils/validate.js`
  - `shared/api/client.js`
  - `shared/api/content.js`
  - `shared/api/order.js`
  - `shared/api/admin.js`
- **验证命令**：`cd shared && npm run test && npm run build`
- **完成判据**：`npm run test` 全部通过且 `npm run build` 成功；`shared/` 不含 DOM、`fetch`、React 组件或路由；客户端通过注入 `request` 适配器统一解包响应体。

### T-07：内容公开能力 Service 测试（测试先行）

- **需求回链**：Req-1、Req-2、Req-3、Req-4、Req-13
- **依赖**：T-04
- **端/工程**：backend
- **测试先行**：是（先写 JUnit，确认失败方向后再在 T-08 实现）
- **目标**：为目录查询、搜索、详情与点赞能力编写 Service 测试。
- **涉及文件**：
  - `backend/src/test/java/com/aiguide/content/service/ContentServiceTest.java`
- **验证命令**：`cd backend && ./mvnw -q -Dtest=ContentServiceTest test`
- **完成判据**：测试文件可被 Maven 收集并运行；当前因实现未完成而失败（红），断言覆盖启用主题/专题、仅已发布可见、最新/推荐排序、pg_trgm 与 ILIKE 回退、详情仅对已发布内容累计浏览数、点赞幂等与唯一约束；T-08 实现后同命令转绿。

### T-08：内容公开能力 Service 实现

- **需求回链**：Req-1、Req-2、Req-3、Req-4、Req-13
- **依赖**：T-07
- **端/工程**：backend
- **测试先行**：否（测试已在 T-07 前置完成）
- **目标**：实现主题/专题目录查询、内容列表/最新/推荐/搜索、详情浏览数累计与点赞幂等逻辑。
- **涉及文件**：
  - `backend/src/main/java/com/aiguide/content/service/TopicService.java`
  - `backend/src/main/java/com/aiguide/content/service/CategoryService.java`
  - `backend/src/main/java/com/aiguide/content/service/ContentService.java`
  - `backend/src/main/java/com/aiguide/content/service/LikeService.java`
  - `backend/src/main/java/com/aiguide/content/mapper/TopicMapper.java`
  - `backend/src/main/java/com/aiguide/content/mapper/CategoryMapper.java`
  - `backend/src/main/java/com/aiguide/content/mapper/ContentMapper.java`
  - `backend/src/main/java/com/aiguide/content/mapper/LikeMapper.java`
  - `backend/src/main/resources/mapper/content/*.xml`
- **验证命令**：`cd backend && ./mvnw -q -Dtest=ContentServiceTest test`
- **完成判据**：`ContentServiceTest` 全部通过；仅 `published` 内容出现在公开查询；搜索不可建扩展时回退 ILIKE 不静默失败；所有用户输入使用 `#{}`，无 `${}` 拼接；点赞捕获唯一键冲突后返回 `liked=true` 与当前计数。

### T-09：打赏/咨询订单 Service 测试（测试先行）

- **需求回链**：Req-5、Req-6、Req-7、Req-12
- **依赖**：T-04
- **端/工程**：backend
- **测试先行**：是（先写 JUnit，确认失败方向后再在 T-10 实现）
- **目标**：为打赏留资与付费咨询订单的创建、查询和基础状态约束编写测试。
- **涉及文件**：
  - `backend/src/test/java/com/aiguide/order/service/TipOrderServiceTest.java`
  - `backend/src/test/java/com/aiguide/order/service/ConsultationOrderServiceTest.java`
- **验证命令**：`cd backend && ./mvnw -q -Dtest=TipOrderServiceTest,ConsultationOrderServiceTest test`
- **完成判据**：测试可被 Maven 收集并运行；当前因实现未完成而失败（红），断言覆盖金额枚举、联系方式可选与格式校验、咨询必填与期望时间未来、订单号不可猜测、公开查询字段范围及非法状态流转；T-10 实现后同命令转绿。

### T-10：打赏/咨询订单 Service 实现

- **需求回链**：Req-5、Req-6、Req-7、Req-12
- **依赖**：T-09
- **端/工程**：backend
- **测试先行**：否（测试已在 T-09 前置完成）
- **目标**：实现打赏留资单与付费咨询订单的创建、公开查询与基础状态校验，统一返回管理员微信号。
- **涉及文件**：
  - `backend/src/main/java/com/aiguide/order/service/TipOrderService.java`
  - `backend/src/main/java/com/aiguide/order/service/ConsultationOrderService.java`
  - `backend/src/main/java/com/aiguide/order/mapper/TipOrderMapper.java`
  - `backend/src/main/java/com/aiguide/order/mapper/ConsultationOrderMapper.java`
  - `backend/src/main/resources/mapper/order/*.xml`
- **验证命令**：`cd backend && ./mvnw -q -Dtest=TipOrderServiceTest,ConsultationOrderServiceTest test`
- **完成判据**：两个 Service 测试全部通过；金额单位为分且仅接受枚举值；联系信息按契约校验；订单号使用不可猜测随机值；响应返回 `ADMIN_WECHAT_ID`；不接入在线支付，不记录密码或日志敏感信息。

### T-11：后台 Service 测试（测试先行）

- **需求回链**：Req-7、Req-8、Req-9、Req-10、Req-11、Req-12
- **依赖**：T-03、T-04
- **端/工程**：backend
- **测试先行**：是（先写 JUnit，确认失败方向后再在 T-12 实现）
- **目标**：为管理员登录、内容管理、发布审核、订单状态流转与操作日志编写 Service 测试。
- **涉及文件**：
  - `backend/src/test/java/com/aiguide/admin/service/AdminAuthServiceTest.java`
  - `backend/src/test/java/com/aiguide/admin/service/AdminContentServiceTest.java`
  - `backend/src/test/java/com/aiguide/admin/service/AdminOrderServiceTest.java`
- **验证命令**：`cd backend && ./mvnw -q -Dtest=AdminAuthServiceTest,AdminContentServiceTest,AdminOrderServiceTest test`
- **完成判据**：测试可被 Maven 收集并运行；当前因实现未完成而失败（红），断言覆盖登录统一失败提示、唯一 ADMIN、内容 CRUD 与 version 乐观锁、发布必须 `reviewConfirmed=true`、下架/恢复/归档状态机、订单收款/排期/完成/取消、免费名额占用与释放、敏感操作日志与业务同事务；T-12 实现后同命令转绿。

### T-12：后台 Service 实现

- **需求回链**：Req-7、Req-8、Req-9、Req-10、Req-11、Req-12
- **依赖**：T-11
- **端/工程**：backend
- **测试先行**：否（测试已在 T-11 前置完成）
- **目标**：实现管理员登录、内容与目录管理、发布审核、订单状态机、免费名额控制与操作日志落库。
- **涉及文件**：
  - `backend/src/main/java/com/aiguide/admin/service/AdminAuthService.java`
  - `backend/src/main/java/com/aiguide/admin/service/AdminContentService.java`
  - `backend/src/main/java/com/aiguide/admin/service/AdminOrderService.java`
  - `backend/src/main/java/com/aiguide/admin/mapper/AdminUserMapper.java`
  - `backend/src/main/java/com/aiguide/admin/AdminBootstrapRunner.java`
  - `backend/src/main/java/com/aiguide/operationlog/OperationLogServiceImpl.java`
  - `backend/src/main/resources/mapper/admin/*.xml`
- **验证命令**：`cd backend && ./mvnw -q -Dtest=AdminAuthServiceTest,AdminContentServiceTest,AdminOrderServiceTest test`
- **完成判据**：三个 Service 测试全部通过；密码使用 BCrypt 哈希；管理员凭据仅从环境变量初始化；内容编辑冲突返回对应错误码；咨询确认排期使用 `SELECT ... FOR UPDATE` 串行化，前 10 个确认订单免费，取消已确认免费订单释放名额；敏感操作先校验 ADMIN 再写日志，日志与业务更新同事务。

### T-13：公开 API Controller/安全测试（测试先行）

- **需求回链**：Req-1、Req-2、Req-3、Req-4、Req-5、Req-6、Req-12
- **依赖**：T-08、T-10
- **端/工程**：backend
- **测试先行**：是（先写 MockMvc 测试，确认失败方向后再在 T-14 完成控制器装配）
- **目标**：验证阅读站公开接口的路由、入参校验、鉴权白名单与统一响应体。
- **涉及文件**：
  - `backend/src/test/java/com/aiguide/content/controller/PublicApiControllerTest.java`
- **验证命令**：`cd backend && ./mvnw -q -Dtest=PublicApiControllerTest test`
- **完成判据**：测试可被 Maven 收集并运行；当前因控制器返回占位而失败（红），断言覆盖 `/api/topics`、`/api/categories`、`/api/contents*`、`/api/contents/{contentCode}/likes`、`/api/tips`、`/api/consultations`、`/api/site/config` 的路径、分页、认证与错误码；T-14 实现后同命令转绿。

### T-14：公开 API Controller/安全实现

- **需求回链**：Req-1、Req-2、Req-3、Req-4、Req-5、Req-6、Req-12
- **依赖**：T-13
- **端/工程**：backend
- **测试先行**：否（测试已在 T-13 前置完成）
- **目标**：完成阅读站公开 Controller 入参校验、鉴权白名单与统一响应体装配，并下发站点配置。
- **涉及文件**：
  - `backend/src/main/java/com/aiguide/content/controller/TopicController.java`
  - `backend/src/main/java/com/aiguide/content/controller/CategoryController.java`
  - `backend/src/main/java/com/aiguide/content/controller/ContentController.java`
  - `backend/src/main/java/com/aiguide/content/controller/LikeController.java`
  - `backend/src/main/java/com/aiguide/order/controller/TipOrderController.java`
  - `backend/src/main/java/com/aiguide/order/controller/ConsultationOrderController.java`
  - `backend/src/main/java/com/aiguide/config/SiteConfigController.java`
- **验证命令**：`cd backend && ./mvnw -q -Dtest=PublicApiControllerTest test`
- **完成判据**：`PublicApiControllerTest` 全部通过；公开接口无需登录；入参按契约校验；错误码与统一响应体符合 `contracts/common.yaml`；详情与点赞正确处理 `X-Visitor-Id`。

### T-15：后台 API Controller/安全测试（测试先行）

- **需求回链**：Req-7、Req-8、Req-9、Req-10、Req-11、Req-12
- **依赖**：T-03、T-12
- **端/工程**：backend
- **测试先行**：是（先写 MockMvc 测试，确认失败方向后再在 T-16 完成控制器装配）
- **目标**：验证后台登录与 `/api/admin/**` 的鉴权、分页、状态流转、操作日志接口。
- **涉及文件**：
  - `backend/src/test/java/com/aiguide/admin/controller/AdminApiControllerTest.java`
- **验证命令**：`cd backend && ./mvnw -q -Dtest=AdminApiControllerTest test`
- **完成判据**：测试可被 Maven 收集并运行；当前因控制器返回占位而失败（红），断言覆盖登录公开、其余 `/api/admin/**` 需 JWT + ADMIN、未登录/无权限返回 1001/1002、内容发布/下架/恢复/归档、订单确认/完成/取消/收款/关闭及操作日志分页；T-16 实现后同命令转绿。

### T-16：后台 API Controller/安全实现

- **需求回链**：Req-7、Req-8、Req-9、Req-10、Req-11、Req-12
- **依赖**：T-15
- **端/工程**：backend
- **测试先行**：否（测试已在 T-15 前置完成）
- **目标**：完成后台 Controller 装配、安全拦截、静态前端回退与操作日志查询。
- **涉及文件**：
  - `backend/src/main/java/com/aiguide/admin/controller/AdminAuthController.java`
  - `backend/src/main/java/com/aiguide/admin/controller/AdminContentController.java`
  - `backend/src/main/java/com/aiguide/admin/controller/AdminOrderController.java`
  - `backend/src/main/java/com/aiguide/admin/controller/OperationLogController.java`
  - `backend/src/main/java/com/aiguide/config/WebMvcConfig.java`
- **验证命令**：`cd backend && ./mvnw -q -Dtest=AdminApiControllerTest test`
- **完成判据**：`AdminApiControllerTest` 全部通过；`/api/*` 优先匹配 API，非 API 前端路由回退 `index.html`；后台接口全部校验 ADMIN；敏感操作响应由统一错误码反馈，不泄露内部异常。

### T-17：Web 阅读站目录页测试（测试先行）

- **需求回链**：Req-1、Req-13
- **依赖**：T-06
- **端/工程**：web-reader
- **测试先行**：是（先写页面可渲染与三态测试，确认失败方向后再在 T-18 实现）
- **目标**：创建 Vite + React 18 + Ant Design 工程骨架，编写首页、主题页、专题列表页测试。
- **涉及文件**：
  - `web-reader/package.json`
  - `web-reader/vite.config.js`
  - `web-reader/src/test/setup.js`
  - `web-reader/src/pages/HomePage.test.jsx`
  - `web-reader/src/pages/TopicPage.test.jsx`
  - `web-reader/src/pages/CategoryPage.test.jsx`
- **验证命令**：`cd web-reader && npm test -- HomePage TopicPage CategoryPage`
- **完成判据**：测试文件可被 Vitest 收集；当前因页面缺失而失败（红），断言覆盖目录展示、最新/推荐入口、列表项含标题/摘要/更新时间、loading/error/空态；T-18 实现后同命令转绿。

### T-18：Web 阅读站目录页实现

- **需求回链**：Req-1、Req-13
- **依赖**：T-17
- **端/工程**：web-reader
- **测试先行**：否（测试已在 T-17 前置完成）
- **目标**：实现阅读站 `/`、`/topics/:topicCode`、`/categories/:categoryCode`，统一使用 shared API，所有列表实现三态与失败重试。
- **涉及文件**：
  - `web-reader/src/main.jsx`
  - `web-reader/src/App.jsx`
  - `web-reader/src/pages/HomePage.jsx`
  - `web-reader/src/pages/TopicPage.jsx`
  - `web-reader/src/pages/CategoryPage.jsx`
  - `web-reader/src/platform/request.js`
  - `web-reader/src/services/content.js`
- **验证命令**：`cd web-reader && npm test -- HomePage TopicPage CategoryPage && npm run build`
- **完成判据**：目录页测试通过且 `npm run build` 成功；`fetch` 只出现在 `src/platform/request.js`；页面复用 `shared/api/content.js`；loading/error/空态完整，不静默吞错。

### T-19：Web 阅读站详情/搜索/点赞测试（测试先行）

- **需求回链**：Req-2、Req-3、Req-4、Req-12、Req-13
- **依赖**：T-06
- **端/工程**：web-reader
- **测试先行**：是（先写页面测试，确认失败方向后再在 T-20 实现）
- **目标**：编写内容详情页与搜索页测试，覆盖阅读、点赞、搜索与错误重试。
- **涉及文件**：
  - `web-reader/src/pages/ContentPage.test.jsx`
  - `web-reader/src/pages/SearchPage.test.jsx`
- **验证命令**：`cd web-reader && npm test -- ContentPage SearchPage`
- **完成判据**：测试文件可被 Vitest 收集；当前因页面缺失而失败（红），断言覆盖已发布详情字段、搜索词校验与无结果空态、点赞携带 `X-Visitor-Id` 并展示最新计数、详情/搜索失败重试；T-20 实现后同命令转绿。

### T-20：Web 阅读站详情/搜索/点赞实现

- **需求回链**：Req-2、Req-3、Req-4、Req-12、Req-13
- **依赖**：T-19
- **端/工程**：web-reader
- **测试先行**：否（测试已在 T-19 前置完成）
- **目标**：实现 `/contents/:contentCode` 与 `/search`，完成阅读、浏览数展示、点赞、搜索与失败重试。
- **涉及文件**：
  - `web-reader/src/pages/ContentPage.jsx`
  - `web-reader/src/pages/SearchPage.jsx`
  - `web-reader/src/services/content.js`
  - `web-reader/src/utils/visitor.js`
- **验证命令**：`cd web-reader && npm test -- ContentPage SearchPage && npm run build`
- **完成判据**：两个页面测试通过且 `npm run build` 成功；访客标识 UUID v4 存 `localStorage` 并经 `X-Visitor-Id` 传递；点赞重复点击仅忽略；搜索非法/超长词走统一校验错误；失败与超时展示重试入口。

### T-21：Web 阅读站打赏/咨询/订单状态测试（测试先行）

- **需求回链**：Req-5、Req-6、Req-7、Req-12、Req-13
- **依赖**：T-06
- **端/工程**：web-reader
- **测试先行**：是（先写页面测试，确认失败方向后再在 T-22 实现）
- **目标**：编写打赏、付费咨询与订单状态页测试。
- **涉及文件**：
  - `web-reader/src/pages/TipPage.test.jsx`
  - `web-reader/src/pages/ConsultationPage.test.jsx`
  - `web-reader/src/pages/OrderStatusPage.test.jsx`
- **验证命令**：`cd web-reader && npm test -- TipPage ConsultationPage OrderStatusPage`
- **完成判据**：测试文件可被 Vitest 收集；当前因页面缺失而失败（红），断言覆盖打赏金额枚举、可选联系方式、咨询必填与格式校验、提交后展示管理员微信号与备注订单号、订单状态展示、失败重试；T-22 实现后同命令转绿。

### T-22：Web 阅读站打赏/咨询/订单状态实现

- **需求回链**：Req-5、Req-6、Req-7、Req-12、Req-13
- **依赖**：T-21
- **端/工程**：web-reader
- **测试先行**：否（测试已在 T-21 前置完成）
- **目标**：实现打赏、付费咨询与订单状态查询路由，统一走 shared API 与请求适配器。
- **涉及文件**：
  - `web-reader/src/pages/TipPage.jsx`
  - `web-reader/src/pages/ConsultationPage.jsx`
  - `web-reader/src/pages/OrderStatusPage.jsx`
  - `web-reader/src/services/order.js`
- **验证命令**：`cd web-reader && npm test -- TipPage ConsultationPage OrderStatusPage && npm run build`
- **完成判据**：三个页面测试通过且 `npm run build` 成功；金额按分提交并按元展示；联系方式格式复用 `shared/utils/validate.js`；提交后展示管理员微信号与「备注订单号完成支付」提示；订单查询字段不暴露管理员备注。

### T-23：Web 管理后台登录与布局测试（测试先行）

- **需求回链**：Req-8、Req-12
- **依赖**：T-06
- **端/工程**：web-admin
- **测试先行**：是（先写登录与路由守卫测试，确认失败方向后再在 T-24 实现）
- **目标**：创建后台 Vite 工程，编写登录页与后台布局/鉴权测试。
- **涉及文件**：
  - `web-admin/package.json`
  - `web-admin/vite.config.js`
  - `web-admin/src/test/setup.js`
  - `web-admin/src/pages/LoginPage.test.jsx`
  - `web-admin/src/layouts/AdminLayout.test.jsx`
- **验证命令**：`cd web-admin && npm test -- LoginPage AdminLayout`
- **完成判据**：测试文件可被 Vitest 收集；当前因页面缺失而失败（红），断言覆盖登录失败统一提示、不区分账号不存在/密码错误、Token 存储与请求头注入、未登录/越权跳转、统一错误提示；T-24 实现后同命令转绿。

### T-24：Web 管理后台登录与布局实现

- **需求回链**：Req-8、Req-12
- **依赖**：T-23
- **端/工程**：web-admin
- **测试先行**：否（测试已在 T-23 前置完成）
- **目标**：实现 `/login` 与后台受保护布局，接入 JWT 请求适配器与统一错误拦截。
- **涉及文件**：
  - `web-admin/src/main.jsx`
  - `web-admin/src/App.jsx`
  - `web-admin/src/pages/LoginPage.jsx`
  - `web-admin/src/layouts/AdminLayout.jsx`
  - `web-admin/src/platform/request.js`
  - `web-admin/src/store/auth.js`
- **验证命令**：`cd web-admin && npm test -- LoginPage AdminLayout && npm run build`
- **完成判据**：登录与布局测试通过且 `npm run build` 成功；`fetch` 只出现在 `src/platform/request.js`；Token 从环境/本地安全读取并注入 Bearer 头；未登录访问后台路由被拦截；无账号密码硬编码，无调试输出残留。

### T-25：Web 管理后台内容与目录管理测试（测试先行）

- **需求回链**：Req-9、Req-10、Req-12、Req-13
- **依赖**：T-06
- **端/工程**：web-admin
- **测试先行**：是（先写页面测试，确认失败方向后再在 T-26 实现）
- **目标**：编写内容列表/编辑、主题与专题管理页测试。
- **涉及文件**：
  - `web-admin/src/pages/ContentListPage.test.jsx`
  - `web-admin/src/pages/ContentEditPage.test.jsx`
  - `web-admin/src/pages/TopicManagePage.test.jsx`
  - `web-admin/src/pages/CategoryManagePage.test.jsx`
- **验证命令**：`cd web-admin && npm test -- ContentListPage ContentEditPage TopicManagePage CategoryManagePage`
- **完成判据**：测试文件可被 Vitest 收集；当前因页面缺失而失败（红），断言覆盖筛选/分页、四类内容类型、编辑携带 version 且冲突提示重新加载、发布前必须确认人工审核、下架/恢复/归档入口与三态；T-26 实现后同命令转绿。

### T-26：Web 管理后台内容与目录管理实现

- **需求回链**：Req-9、Req-10、Req-12、Req-13
- **依赖**：T-25
- **端/工程**：web-admin
- **测试先行**：否（测试已在 T-25 前置完成）
- **目标**：实现后台内容列表、内容编辑、主题管理与专题管理，满足人工审核、乐观锁与状态机交互。
- **涉及文件**：
  - `web-admin/src/pages/ContentListPage.jsx`
  - `web-admin/src/pages/ContentEditPage.jsx`
  - `web-admin/src/pages/TopicManagePage.jsx`
  - `web-admin/src/pages/CategoryManagePage.jsx`
  - `web-admin/src/services/admin-content.js`
- **验证命令**：`cd web-admin && npm test -- ContentListPage ContentEditPage TopicManagePage CategoryManagePage && npm run build`
- **完成判据**：四个页面测试通过且 `npm run build` 成功；编辑更新携带 `version`，冲突展示明确提示；发布/恢复请求携带 `reviewConfirmed`；下架/归档等危险操作使用 `Popconfirm` 二次确认；错误统一由拦截器处理。

### T-27：Web 管理后台订单与操作日志测试（测试先行）

- **需求回链**：Req-7、Req-11、Req-12
- **依赖**：T-06
- **端/工程**：web-admin
- **测试先行**：是（先写页面测试，确认失败方向后再在 T-28 实现）
- **目标**：编写打赏订单、咨询订单与操作日志页测试。
- **涉及文件**：
  - `web-admin/src/pages/TipOrderListPage.test.jsx`
  - `web-admin/src/pages/ConsultationOrderListPage.test.jsx`
  - `web-admin/src/pages/OperationLogPage.test.jsx`
- **验证命令**：`cd web-admin && npm test -- TipOrderListPage ConsultationOrderListPage OperationLogPage`
- **完成判据**：测试文件可被 Vitest 收集；当前因页面缺失而失败（红），断言覆盖订单列表/详情/筛选分页、打赏收款确认与关闭、咨询确认排期/完成/取消/备注、免费名额结果展示、操作日志列表与敏感操作二次确认；T-28 实现后同命令转绿。

### T-28：Web 管理后台订单与操作日志实现

- **需求回链**：Req-7、Req-11、Req-12
- **依赖**：T-27
- **端/工程**：web-admin
- **测试先行**：否（测试已在 T-27 前置完成）
- **目标**：实现后台订单管理与操作日志查询，完成敏感操作交互与状态展示。
- **涉及文件**：
  - `web-admin/src/pages/TipOrderListPage.jsx`
  - `web-admin/src/pages/ConsultationOrderListPage.jsx`
  - `web-admin/src/pages/OperationLogPage.jsx`
  - `web-admin/src/services/admin-order.js`
  - `web-admin/src/services/operation-log.js`
- **验证命令**：`cd web-admin && npm test -- TipOrderListPage ConsultationOrderListPage OperationLogPage && npm run build`
- **完成判据**：三个页面测试通过且 `npm run build` 成功；订单状态流转按钮按状态机显隐；收款确认/关闭/取消等危险操作使用 `Popconfirm`；操作日志可查看操作者、时间、对象、动作；无静默吞错，无调试输出。

### T-29：Web 阅读站 Markdown 正文渲染

- **需求回链**：Req-3、Req-14
- **依赖**：T-20
- **端/工程**：web-reader
- **测试先行**：否（渲染依赖接入 + 单组件改造，同步更新 ContentPage 测试断言 Markdown 输出）
- **目标**：接入 `react-markdown` + `remark-gfm`（plan §8.1 已声明），将内容详情页正文改为 Markdown 渲染，并配套排版样式。
- **涉及文件**：
  - `web-reader/package.json`
  - `web-reader/src/pages/ContentPage.jsx`
  - `web-reader/src/pages/ContentPage.module.css`
  - `web-reader/src/pages/ContentPage.test.jsx`
- **验证命令**：`cd web-reader && npm test -- ContentPage && npm run build`
- **完成判据**：ContentPage 测试通过且 `npm run build` 成功；`body` 经 `react-markdown` + `remark-gfm` 渲染，`##`/`###` 标题、加粗、列表、代码块、表格产生对应视觉层级；正文不再以纯文本原样渲染；`fetch` 仍只出现在 `src/platform/request.js`。

### T-30：桌面资料改造为结构化 Markdown

- **需求回链**：Req-14
- **依赖**：无（依据 `content-template.md` 与桌面「Agent 开发面试辅导资料」）
- **端/工程**：数据/知识（features/ai-guide）
- **测试先行**：否（内容数据改造，无运行期逻辑，以结构合规为准）
- **目标**：将桌面「Agent 开发面试辅导资料」逐文件改造为结构化 Markdown，拆分到最小内容单元，映射到主题/专题，并生成 `summary`/`tags`。
- **涉及文件**：
  - `features/ai-guide/content/`（改造后的结构化 Markdown，按「主题/专题」分目录，作为内容唯一真相源）
  - `features/ai-guide/content/.index.md`（内容清单：code / type / title / summary / tags / 主题 / 专题映射）
- **验证命令**：无（人工验收结构合规）
- **完成判据**：每条内容 `body` 符合 `content-template.md` 对应 type 的固定分节骨架；一道题/一篇面经/一篇知识文/一份简历各为一条内容；`summary` ≤ 80 字、`tags` 2~6 个；`.index.md` 完整列出全部内容的 code 与主题/专题映射，无遗漏。

### T-31：内容 seed 生成与幂等导入

- **需求回链**：Req-14
- **依赖**：T-30
- **端/工程**：backend
- **测试先行**：否（数据迁移/导入任务，无运行期业务逻辑，以导入幂等与结构合规为准）
- **目标**：基于 T-30 的内容源（唯一真相源 `features/ai-guide/content/`）生成幂等 seed SQL `V2__seed_content.sql`，执行导入并验证；正文不得在 SQL 与 `content/` 中重复维护。
- **涉及文件**：
  - `backend/src/main/resources/db/migration/V2__seed_content.sql`
- **验证命令**：`psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/src/main/resources/db/migration/V2__seed_content.sql`
- **完成判据**：seed 幂等可重复执行（重复执行不产生重复行）；导入后内容数量与 `content/.index.md` 一致；抽样内容 `body` 为结构化 Markdown 且详情接口可正常返回；seed 不写账号密码/令牌（宪法 2.1）。

## 执行说明

- 按依赖顺序执行；每个任务完成其验证命令后，方可进入下一任务。
- 测试先行任务以「确认失败方向正确」作为测试编写完成标志，对应实现任务必须让同一验证命令转绿。
- 任务失败自动重试 1 次，再失败挂起转人工。
- 禁止跨任务顺手修改范围外代码；涉及契约或 DDL 变更必须回到 plan 阶段审查。
