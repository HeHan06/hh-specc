#!/usr/bin/env bash
# ============================================================
# specc.sh —— M1 CLI 命令模块（用户唯一入口）
# 命令一览：
#   ./specc.sh init                 初始化 .specc/ 资产骨架
#   ./specc.sh new <需求ID>          创建需求工作目录
#   ./specc.sh status [需求ID]       查看阶段进度与门禁状态
#   ./specc.sh <stage> <需求ID>      执行阶段（specify/clarify/plan/tasks/implement/verify）
#   ./specc.sh redo <stage> <需求ID> 重置某阶段及其后的门禁
#   ./specc.sh help                 帮助
# 设计：CLI 不含业务逻辑，只做路由与交互；规则在流程引擎与门禁系统中
# ============================================================

set -euo pipefail
source "$(dirname "$0")/lib/common.sh"
source "$(dirname "$0")/lib/state.sh"
source "$(dirname "$0")/lib/pipeline.sh"

# ---- 用法帮助（验收用例 TC-A4：未知命令输出帮助并非 0 退出）----
usage() {
  cat <<'EOF'
specc —— 规范驱动 AI Coding 平台 CLI

用法：
  ./specc.sh init                   初始化框架资产（.specc/）
  ./specc.sh new <需求ID>            创建需求工作目录
  ./specc.sh status [需求ID]         查看进度与门禁状态
  ./specc.sh <stage> <需求ID>        执行阶段（六阶段）
  ./specc.sh redo <stage> <需求ID>   重置某阶段及其后的门禁
  ./specc.sh help                   显示本帮助

六阶段：specify → clarify → plan → tasks → implement → verify
EOF
}

# ---- init：校验资产完整性（骨架由模板仓库携带，此处做完整性检查与兜底）----
cmd_init() {
  log_info "初始化 specc 框架资产..."
  local missing=0 f
  # 关键资产清单：缺一即提示（骨架文件随仓库分发，init 负责校验与建目录）
  local required=(
    ".specc/constitution.md"
    ".specc/platform/tech-stack.md"
    ".specc/platform/dual-end-boundary.md"
    ".specc/platform/miniprogram-standards.md"
    ".specc/platform/web-admin-standards.md"
    ".specc/platform/api-conventions.md"
    ".specc/project/business.md"
    ".specc/project/data-model.md"
    ".specc/project/flows.md"
    ".specc/config.yaml"
    ".specc/templates/spec.template.md"
    ".specc/templates/plan.template.md"
    ".specc/templates/tasks.template.md"
    ".specc/templates/contract.template.md"
    ".specc/prompts/specify.md"
    ".specc/prompts/clarify.md"
    ".specc/prompts/plan.md"
    ".specc/prompts/tasks.md"
    ".specc/prompts/implement.md"
    ".specc/prompts/verify.md"
  )
  for f in "${required[@]}"; do
    if [[ ! -f "$SPECC_ROOT/$f" ]]; then
      log_error "缺失资产：$f"
      missing=1
    fi
  done
  (( missing == 0 )) || die "资产不完整，请从模板仓库恢复上述文件后重试"

  # 运行时目录（幂等创建；重复 init 不覆盖已修改的宪法——只建缺失目录）
  mkdir -p "$FEATURES_DIR" "$SPECS_DIR" \
           "$SPECC_ROOT/web-admin" "$SPECC_ROOT/miniprogram" \
           "$SPECC_ROOT/backend" "$SPECC_ROOT/shared"
  # 工程目录放 .gitkeep 保证空目录可被 git 跟踪
  local d; for d in web-admin miniprogram backend shared; do
    touch "$SPECC_ROOT/$d/.gitkeep"
  done

  log_ok "specc 初始化完成：资产齐备，工作目录就绪"
  log_info "下一步：./specc.sh new <需求ID> 创建你的第一个需求"
}

# ---- new：创建需求工作目录（验收用例 TC-A2：重复创建报错不覆盖）----
cmd_new() {
  local fid="${1:-}"
  [[ -n "$fid" ]] || die "缺少需求ID，用法：./specc.sh new <需求ID>"
  require_init
  # 需求ID合法性：仅允许字母数字与连字符（防止路径穿越）
  [[ "$fid" =~ ^[A-Za-z0-9][A-Za-z0-9-]*$ ]] || die "需求ID只允许字母、数字与连字符，且以字母数字开头"

  local fdir="$FEATURES_DIR/$fid"
  [[ -e "$fdir" ]] && die "需求已存在：$fdir（不会覆盖；如需重来请手动删除或使用 redo）"

  mkdir -p "$fdir/contracts"
  state_init "$fdir" "$fid"
  log_ok "需求工作目录已创建：$fdir"
  log_info "开始第一阶段：./specc.sh specify $fid"
}

# ---- status：展示进度（验收用例 TC-A3）----
cmd_status() {
  local fid="${1:-}"
  require_init
  if [[ -z "$fid" ]]; then
    # 列出所有需求
    log_info "当前需求列表："
    local d found=0
    for d in "$FEATURES_DIR"/*/; do
      [[ -d "$d" ]] || continue
      found=1
      local id; id="$(basename "$d")"
      echo "  - $id（当前阶段：$(state_get "$d" 'stage')）"
    done
    (( found == 1 )) || echo "  （暂无需求，使用 ./specc.sh new <需求ID> 创建）"
    return 0
  fi

  local fdir; fdir="$(require_feature "$fid")"
  echo ""
  echo "需求：$fid"
  echo "当前阶段：$(state_get "$fdir" 'stage')"
  echo "门禁状态："
  local s g
  for s in "${SPECC_STAGES[@]}"; do
    g="$(state_get "$fdir" "gates.$s")"
    printf "  %-10s %s\n" "$s" "${g:-pending}"
  done
  # implement 阶段展示任务进度
  local tasks; tasks="$(state_get "$fdir" 'tasks')"
  if [[ -n "$tasks" && "$tasks" != "{}" ]]; then
    echo "任务进度：$tasks"
  fi
  echo ""
  echo "审计历史（最近 10 条）："
  python3 - "$fdir/state.json" <<'PYEOF'
import json, sys
data = json.load(open(sys.argv[1], encoding="utf-8"))
for h in data.get("history", [])[-10:]:
    print(f"  [{h['ts']}] {h['text']}")
PYEOF
}

# ---- 主路由 ----
main() {
  local cmd="${1:-help}"
  case "$cmd" in
    init)   cmd_init ;;
    new)    shift; cmd_new "$@" ;;
    status) shift; cmd_status "$@" ;;
    redo)
      shift
      local stage="${1:-}" fid="${2:-}"
      [[ -n "$stage" && -n "$fid" ]] || die "用法：./specc.sh redo <stage> <需求ID>"
      require_init
      local fdir; fdir="$(require_feature "$fid")"
      pipeline_redo "$stage" "$fdir"
      ;;
    specify|clarify|plan|tasks|implement|verify)
      local stage="$cmd"; shift
      local fid="${1:-}"
      require_init
      local fdir; fdir="$(require_feature "$fid")"
      pipeline_run_stage "$stage" "$fdir"
      ;;
    help|-h|--help) usage ;;
    *) log_error "未知命令：$cmd"; echo ""; usage; exit 1 ;;
  esac
}

main "$@"
