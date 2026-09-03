# AGENTS.md — ai-guide 本地启动与排障（AI 自动读取）

> 本文件供进入本目录（及其子目录）的 AI 代理在**启动 / 排查前**自动读取，目标：少走弯路、一次起对。
> 这是「运行时运维」说明，不影响业务代码生成（业务代码遵循 `.specc/constitution.md`）。

## 1. 项目组成（本地开发）

| 组件 | 技术 | 端口 | 备注 |
|---|---|---|---|
| PostgreSQL 16 | Homebrew | 5432 | 数据已就绪：`ai_guide` 库，45 条内容；管理员账号 `admin` 已建 |
| backend | Java 17 + Spring Boot 3 + MyBatis | 8080 | `./mvnw spring-boot:run` |
| web-reader | React 18 + Vite + AntD | 5173 | `npm run dev`，`/api` 代理到 8080 |

## 2. 正确启动顺序

```bash
# ① PostgreSQL（若未起）——直接后台启动，避开 brew services / pg_ctl 的沙箱限制
/usr/local/opt/postgresql@16/bin/postgres -D /usr/local/var/postgresql@16 > /tmp/pg16.log 2>&1 &

# ② 后端（务必先设 JAVA_HOME=17 + 环境变量，见 P1/P2）
export JAVA_HOME=/usr/local/Cellar/openjdk@17/17.0.15/libexec/openjdk.jdk/Contents/Home
export DATABASE_URL='jdbc:postgresql://localhost:5432/ai_guide'
export DATABASE_USERNAME=wangzhenxing
export DATABASE_PASSWORD=''
export JWT_SECRET='dev-only-placeholder-at-least-32-bytes-long-0123456789'
cd projects/ai-guide/backend && ./mvnw spring-boot:run -DskipTests

# ③ 前端（务必先补 PATH，见 P3）
export PATH="/usr/local/bin:$PATH"
cd projects/ai-guide/web-reader && npm run dev
```

验证链路：`curl -s http://localhost:5173/api/topics` 应返回 `"code":0`。

## 3. 排障速查（症状 → 根因 → 解法）

### P0 PostgreSQL 起不来
- **症状**：`brew services start postgresql@16` 报 `Operation not permitted @ rb_sysopen ... LaunchAgents ...plist`；或 `pg_ctl start` 报 `FATAL: could not create lock file "postmaster.pid": Operation not permitted`。
- **根因**：受限环境（Trae IDE 沙箱）禁止写 LaunchAgents 或数据目录 pid 文件。
- **解法**：绕开服务管理，直接后台启动 `postgres`（见 §2 ①）。
- **验证**：`/usr/local/opt/postgresql@16/bin/pg_isready` → `accepting connections`。

### P1 Java 版本不对
- **症状**：`java -version` 显示 `1.8.x`；`mvnw` 编译/启动报 class 版本错误。
- **根因**：系统默认 `java` 是 JDK 8，而 Spring Boot 3 要求 Java 17。
- **解法**：`export JAVA_HOME=/usr/local/Cellar/openjdk@17/17.0.15/libexec/openjdk.jdk/Contents/Home`（等价：`JAVA_HOME=$(/usr/libexec/java_home -v 17)`）。
- **验证**：`java -version` → `17.0.15`。

### P2 后端缺环境变量
- **症状**：启动即抛 `IllegalStateException: JWT_SECRET 长度至少为 32 字节`；或 `Could not resolve placeholder 'DATABASE_URL'`。
- **根因**：`application.yml` 的数据库/JWT 配置全部从环境变量读取，绝不硬编码（宪法 2.1）。
- **解法**：本地按 §2 ② 注入 `DATABASE_URL / DATABASE_USERNAME / DATABASE_PASSWORD / JWT_SECRET`（`JWT_SECRET` 须 ≥32 字节；仅本地占位，生产用真密钥且不入文档/代码）。
- **备注**：`ADMIN_USERNAME` + `ADMIN_PASSWORD_HASH`/`ADMIN_INITIAL_PASSWORD` 仅首次空库时用于播种管理员，已建好账号的库无需设置。

### P3 node/npm 找不到
- **症状**：`which node` / `which npm` 无输出。
- **根因**：受限非登录 shell 的 PATH 不含 `/usr/local/bin`。
- **解法**：`export PATH="/usr/local/bin:$PATH"`（node 实际在 `/usr/local/bin/node`）。

### P4 前端端口被占
- **症状**：`npm run dev` 提示 `Port 5173 is in use, trying another one...`，自动跑到 5174。
- **根因**：上次会话遗留的旧 vite 进程仍占用 5173。
- **解法**：`lsof -nP -iTCP:5173 -sTCP:LISTEN` 取 PID → `kill <PID>` → 重启 `npm run dev`。

### P5 curl / lsof 找不到
- **症状**：`which curl` / `which lsof` 无输出。
- **解法**：用全路径 `/usr/bin/curl`、`/usr/sbin/lsof`，或先 `export PATH="/usr/local/bin:$PATH"`。

## 4. 已知数据说明（非故障）

- `content` 首条「202060827-腾讯星海海一面」的日期疑似笔误（应为 `20260827`），未修正。
- 3 个空面经文件（`初创公司Loot AI一面`、`20260825一面`、`20260826小爱同学三面`）正文为占位文本「（该记录内容待补充）」。
