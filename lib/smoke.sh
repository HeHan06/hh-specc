#!/usr/bin/env bash
# ============================================================
# lib/smoke.sh —— 端到端冒烟校验（verify 阶段确定性执行）
# 职责：真实启动「数据库就绪的后端 + 前端 dev server」，然后
#   「从前端页面入口」发起的冒烟用例验证完整链路，替代原先
#   「后端 JUnit / 前端 vitest 单测」作为 verify 的代码可运行证据。
# 背景：单测（standalone MockMvc / jsdom）只加载局部，不 boot 整个
#   Spring 容器、不连库、不跑迁移、不启动前端，导致「缺主类 / 资源映射
#   非法 / MyBatis mapper-locations 缺失 / 数组类型无映射」等只有在
#   真实启动时才暴露的问题全部漏网（见 FRAMEWORK-DEV 背景）。
# 设计约束：
#   - 只依赖 curl / lsof / python3 / mvn / node（均为仓库既有运行依赖）
#   - 不硬编码业务密钥；后端所需环境变量从当前环境继承，缺省用「本地冒烟默认」
#     （仅冒烟工具运行时使用，不写入任何业务代码或仓库文件）
# ============================================================

source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

# ---- 本地冒烟默认端口（后端对齐 application.yml 的 SERVER_PORT:8080）----
SMOKE_BACKEND_PORT="${SMOKE_BACKEND_PORT:-8080}"
SMOKE_FRONTEND_BASE_PORT="${SMOKE_FRONTEND_BASE_PORT:-5173}"

# ---- 内部：记录冒烟结果（写报告 + 控制台）----
_smoke_report=()
_smoke_fail=0

_smoke_record() {
  local status="$1" text="$2"
  _smoke_report+=("| ${status} | ${text} |")
  [[ "$status" == "❌" ]] && _smoke_fail=1
  log_info "冒烟 ${status} ${text}"
}

# ---- 内部：等待 HTTP 端点就绪（返回 0=就绪）----
_smoke_wait_http() {
  local url="$1" tries="${2:-60}" delay="${3:-1}"
  local i
  for (( i = 0; i < tries; i++ )); do
    if curl -s -o /dev/null "$url" 2>/dev/null; then
      return 0
    fi
    sleep "$delay"
  done
  return 1
}

# ---- 内部：探测后端所需环境变量（缺省给本地冒烟默认）----
# 说明：这些默认值仅供本地冒烟启动后端；生产由调用方通过环境变量注入。
_smoke_export_backend_env() {
  local fid="$1"
  # JAVA_HOME：优先环境变量，其次 macOS java_home 定位 JDK 17
  if [[ -z "${JAVA_HOME:-}" ]]; then
    if command -v /usr/libexec/java_home >/dev/null 2>&1; then
      JAVA_HOME="$(/usr/libexec/java_home -v 17 2>/dev/null || true)"
    fi
  fi
  export JAVA_HOME
  export DATABASE_URL="${DATABASE_URL:-jdbc:postgresql://localhost:5432/${fid}}"
  export DATABASE_USERNAME="${DATABASE_USERNAME:-$(whoami)}"
  export DATABASE_PASSWORD="${DATABASE_PASSWORD:-}"
  export JWT_SECRET="${JWT_SECRET:-smoke-local-dev-secret-key-0123456789abcdef}"
  export ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
  export ADMIN_INITIAL_PASSWORD="${ADMIN_INITIAL_PASSWORD:-admin123456}"
}

# ---- 内部：从 contracts 解析「公开 GET 端点」（完整路径 = base-path + path）----
_smoke_public_get_paths() {
  local fdir="$1"
  python3 - "$fdir" <<'PYEOF'
import sys, glob, re, os
cpath = sys.argv[1]
seen = []
for f in sorted(glob.glob(os.path.join(cpath, 'contracts', '*.yaml'))):
    txt = open(f, encoding='utf-8').read()
    base = '/'
    bm = re.search(r'^base-path:\s*(\S+)', txt, re.M)
    if bm:
        base = bm.group(1).strip()
    for b in re.split(r'\n\s*- method:\s*', txt)[1:]:
        lines = b.splitlines()
        method = lines[0].strip() if lines else ''
        path = auth = None
        for ln in lines[1:]:
            s = ln.strip()
            if s.startswith('path:'):
                path = s.split('path:', 1)[1].strip()
            elif s.startswith('auth:'):
                auth = s.split('auth:', 1)[1].strip()
            elif re.match(r'-\s*method:', ln) or s.startswith('base-path:') or s.startswith('endpoints:'):
                break
        # 只冒烟「无路径参数」的公开 GET（带 {..} 的需真实数据，跳过）
        if not (method == 'GET' and auth and '公开' in auth and path):
            continue
        full = (base.rstrip('/') + '/' + path.lstrip('/')).rstrip('/') or '/'
        if '{' not in full and full not in seen:
            seen.append(full)
print('\n'.join(seen))
PYEOF
}

# ---- 内部：按端口停止进程（后端/前端统一用端口定位，避免误杀无关进程）----
_smoke_stop_port() {
  local port="$1"
  local pids
  pids="$(lsof -ti tcp:"$port" 2>/dev/null || true)"
  [[ -z "$pids" ]] && return 0
  kill $pids 2>/dev/null || true
  sleep 1
  pids="$(lsof -ti tcp:"$port" 2>/dev/null || true)"
  [[ -z "$pids" ]] || kill -9 $pids 2>/dev/null || true
}

# ---- 端到端冒烟主流程 ----
# 用法：smoke_run <需求目录>
# 返回：0=全部冒烟通过；1=存在失败项
smoke_run() {
  local fdir="$1"
  local fid projdir
  fid="$(basename "$fdir")"
  projdir="$PROJECTS_DIR/$fid"
  local report="$fdir/smoke-report.md"
  local log_dir="$SPECC_ROOT/.specc-cache/smoke"
  mkdir -p "$log_dir"

  _smoke_report=()
  _smoke_fail=0

  # 1) 探测工程
  local backend_dir="$projdir/backend"
  local frontends=()
  local d
  for d in web-admin web-reader miniprogram; do
    [[ -d "$projdir/$d" ]] && frontends+=("$d")
  done

  [[ -d "$backend_dir" ]] || {
    _smoke_record "❌" "缺少后端工程 $backend_dir"
    _smoke_write_report "$fdir" "$report"
    return 1
  }
  (( ${#frontends[@]} > 0 )) || {
    _smoke_record "❌" "未发现任何前端工程（web-admin/web-reader/miniprogram）"
    _smoke_write_report "$fdir" "$report"
    return 1
  }

  # 2) 后端环境 + 启动
  _smoke_export_backend_env "$fid"
  local backend_pid=""
  local backend_log="$log_dir/${fid}-backend.log"
  ( cd "$backend_dir" && ./mvnw -q spring-boot:run ) > "$backend_log" 2>&1 &
  backend_pid=$!

  local backend_base="http://localhost:${SMOKE_BACKEND_PORT}"
  if _smoke_wait_http "$backend_base" 60 1; then
    _smoke_record "✅" "后端启动成功（端口 ${SMOKE_BACKEND_PORT}）"
  else
    _smoke_record "❌" "后端启动失败（见 $backend_log 末尾）"
    tail -n 15 "$backend_log" | sed 's/^/      /' >&2
    kill "$backend_pid" 2>/dev/null || true
    _smoke_stop_port "$SMOKE_BACKEND_PORT"
    _smoke_write_report "$fdir" "$report"
    return 1
  fi

  # 3) 启动前端（逐个分配端口）
  local -a fe_ports fe_pids
  local idx=0 fe
  for fe in "${frontends[@]}"; do
    local port=$(( SMOKE_FRONTEND_BASE_PORT + idx ))
    local fe_log="$log_dir/${fid}-${fe}.log"
    ( cd "$projdir/$fe" && npm run dev -- --port "$port" ) > "$fe_log" 2>&1 &
    fe_pids+=($!)
    fe_ports+=("$port")
    idx=$(( idx + 1 ))
  done

  idx=0
  for fe in "${frontends[@]}"; do
    local port="${fe_ports[$idx]}"
    local base="http://localhost:${port}"
    if _smoke_wait_http "$base" 60 1; then
      _smoke_record "✅" "前端 [$fe] 页面可访问（${base}/）"
    else
      _smoke_record "❌" "前端 [$fe] 启动失败（见 $log_dir/${fid}-${fe}.log）"
      tail -n 15 "$log_dir/${fid}-${fe}.log" | sed 's/^/      /' >&2
    fi
    idx=$(( idx + 1 ))
  done

  # 4) 冒烟用例（从前端页面入口出发，验证「页面 → 代理 → 后端」全链路）
  local -a public_paths=()
  local _p
  while IFS= read -r _p; do
    [[ -n "$_p" ]] && public_paths+=("$_p")
  done < <(_smoke_public_get_paths "$fdir")

  idx=0
  for fe in "${frontends[@]}"; do
    local port="${fe_ports[$idx]}"
    local base="http://localhost:${port}"

    # 4.1 前端页面入口 HTTP 200（「从页面开始」的起点）
    if curl -s -o /dev/null -w '%{http_code}' "$base/" | grep -q '^200$'; then
      _smoke_record "✅" "[$fe] 页面入口 / 返回 200"
    else
      _smoke_record "❌" "[$fe] 页面入口 / 未返回 200"
    fi

    # 4.2 经前端 dev server 代理访问后端公开端点（验证页面→代理→后端链路）
    local proxied=0 checked=0
    local p
    for p in "${public_paths[@]}"; do
      checked=$(( checked + 1 ))
      local body code
      body="$(curl -s "$base$p" 2>/dev/null)"
      code="$(printf '%s' "$body" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("code"))' 2>/dev/null)"
      if [[ "$code" == "0" ]]; then
        _smoke_record "✅" "[$fe] 经前端代理 $p 返回 code=0"
        proxied=$(( proxied + 1 ))
      fi
      [[ $checked -ge 5 ]] && break   # 每端最多冒烟 5 个公开端点，控制时长
    done
    (( checked == 0 )) && _smoke_record "⚠️" "[$fe] 契约未解析到公开 GET 端点，跳过代理冒烟"
    (( checked > 0 && proxied == 0 )) && _smoke_record "❌" "[$fe] 公开端点经前端代理均未返回 code=0"
    idx=$(( idx + 1 ))
  done

  # 4.3 后端直连一个公开端点（定位「前端代理问题」还是「后端问题」）
  local p0=""
  [[ ${#public_paths[@]} -gt 0 ]] && p0="${public_paths[0]}"
  if [[ -n "$p0" ]]; then
    local body0 code0
    body0="$(curl -s "$backend_base$p0" 2>/dev/null)"
    code0="$(printf '%s' "$body0" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("code"))' 2>/dev/null)"
    [[ "$code0" == "0" ]] \
      && _smoke_record "✅" "后端直连 $p0 返回 code=0" \
      || _smoke_record "❌" "后端直连 $p0 未返回 code=0（后端或数据库链路异常）"
  fi

  # 4.4 管理员登录链路（登录路径从契约解析：POST + 公开 + 含 login，拼 base-path）
  local login_path
  login_path="$(python3 - "$fdir" <<'PYEOF'
import sys, glob, re, os
cpath = sys.argv[1]
for f in sorted(glob.glob(os.path.join(cpath, 'contracts', '*.yaml'))):
    txt = open(f, encoding='utf-8').read()
    base = '/'
    bm = re.search(r'^base-path:\s*(\S+)', txt, re.M)
    if bm:
        base = bm.group(1).strip()
    for b in re.split(r'\n\s*- method:\s*', txt)[1:]:
        lines = b.splitlines()
        method = lines[0].strip() if lines else ''
        path = auth = None
        for ln in lines[1:]:
            s = ln.strip()
            if s.startswith('path:'):
                path = s.split('path:', 1)[1].strip()
            elif s.startswith('auth:'):
                auth = s.split('auth:', 1)[1].strip()
            elif re.match(r'-\s*method:', ln) or s.startswith('base-path:') or s.startswith('endpoints:'):
                break
        if method == 'POST' and auth and '公开' in auth and path and 'login' in path:
            print((base.rstrip('/') + '/' + path.lstrip('/')).rstrip('/') or '/')
            sys.exit(0)
PYEOF
)"
  if [[ -n "$login_path" ]]; then
    local login_body login_code
    login_body="$(curl -s -X POST "$backend_base$login_path" \
      -H 'Content-Type: application/json' \
      -d "{\"username\":\"${ADMIN_USERNAME}\",\"password\":\"${ADMIN_INITIAL_PASSWORD}\"}" 2>/dev/null)"
    login_code="$(printf '%s' "$login_body" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("code"))' 2>/dev/null)"
    [[ "$login_code" == "0" ]] \
      && _smoke_record "✅" "管理员登录链路通过（${ADMIN_USERNAME}）" \
      || _smoke_record "❌" "管理员登录链路失败（${login_path}）"
  fi

  # 5) 清理启动的进程
  idx=0
  for fe in "${frontends[@]}"; do
    _smoke_stop_port "${fe_ports[$idx]}"
    idx=$(( idx + 1 ))
  done
  _smoke_stop_port "$SMOKE_BACKEND_PORT"
  [[ -n "$backend_pid" ]] && kill "$backend_pid" 2>/dev/null || true

  _smoke_write_report "$fdir" "$report"
  return "$_smoke_fail"
}

# ---- 内部：落盘冒烟报告 ----
_smoke_write_report() {
  local fdir="$1" report="$2"
  {
    echo "# 端到端冒烟报告：$(basename "$fdir")"
    echo
    echo "> 由 verify 阶段确定性执行（lib/smoke.sh），以「从前端页面入口」的真实链路冒烟为准。"
    echo "> 冒烟时间：$(now_iso)"
    echo
    echo "| 结果 | 检查项 |"
    echo "|---|---|"
    local line
    for line in "${_smoke_report[@]}"; do
      echo "$line"
    done
    echo
    if (( _smoke_fail == 0 )); then
      echo "**结论：通过**（端到端冒烟全部通过）"
    else
      echo "**结论：不通过**（存在失败项，见上表）"
    fi
  } > "$report"
  log_info "冒烟报告已落盘：$report"
}
