#!/usr/bin/env bash
# ============================================================
# specc.sh —— M1 CLI 命令模块（用户唯一入口）
# 命令一览：
#   ./specc.sh init                 初始化 .specc/ 资产骨架
#   ./specc.sh new <需求ID>          创建需求工作目录
#   ./specc.sh status [需求ID]       查看阶段进度与门禁状态
#   ./specc.sh <stage> <需求ID>      执行阶段（probe/clarify/plan/tasks/implement/verify）
#   ./specc.sh redo <stage> <需求ID> 重置某阶段及其后的门禁
#   ./specc.sh help                 帮助
# 设计：CLI 不含业务逻辑，只做路由与交互；规则在流程引擎与门禁系统中
# ============================================================

set -euo pipefail
source "$(dirname "$0")/lib/common.sh"
source "$(dirname "$0")/lib/state.sh"
source "$(dirname "$0")/lib/knowledge.sh"
source "$(dirname "$0")/lib/pipeline.sh"
source "$(dirname "$0")/lib/strip.sh"

# ---- 用法帮助（验收用例 TC-A4：未知命令输出帮助并非 0 退出）----
usage() {
  cat <<'EOF'
specc —— 规范驱动 AI Coding 平台 CLI

用法：
  ./specc.sh init                   初始化框架资产（.specc/）
  ./specc.sh new <需求ID> ["描述"] [--prd <文件|目录>] [--kb <文件|目录>]
      --prd 需求文档（PRD），进 requirement.md（需求正文）
      --kb  知识库（参考素材），进 knowledge/（索引+选读；--attach 已退役）
  ./specc.sh status [需求ID]         查看进度与门禁状态
  ./specc.sh <stage> <需求ID>        执行阶段（七阶段）
  ./specc.sh redo <stage> <需求ID>   重置某阶段及其后的门禁
  ./specc.sh strip <需求ID> [--apply] 剥离可观测性注解/标签（交付前清理，默认预览）
  ./specc.sh help                   显示本帮助
  ./specc.sh --version              显示版本号

七阶段：probe → specify → clarify → plan → tasks → implement → verify
EOF
}

# ---- version：显示框架名称与版本号（单一真相源：.specc/config.yaml 的 app.version）----
cmd_version() {
  local name ver
  name="$(cfg_get 'app.name' 'hh-specc')"
  ver="$(cfg_get 'app.version' '0.0.0')"
  echo "${name} v${ver}"
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
    ".specc/config.yaml"
    ".specc/templates/probe-checklist.template.md"
    ".specc/templates/spec.template.md"
    ".specc/templates/plan.template.md"
    ".specc/templates/tasks.template.md"
    ".specc/templates/contract.template.md"
    ".specc/prompts/probe.md"
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
  # 需求代码目录 projects/ 由 implement 阶段按需创建，不在此处预建
  mkdir -p "$FEATURES_DIR" "$PROJECTS_DIR"

  log_ok "specc 初始化完成：资产齐备，工作目录就绪"
  log_info "下一步：./specc.sh new <需求ID> 创建你的第一个需求"
}

# ---- new：创建需求工作目录（验收用例 TC-A2：重复创建报错不覆盖）----
# 用法：./specc.sh new <需求ID> ["需求描述"] [--prd <文件|目录>...] [--kb <文件|目录>...]
#   - 需求描述：写入 requirement.md，作为 specify 阶段的 {REQUIREMENT_TEXT} 正文来源
#   - --prd：需求文档（PRD），文本全量并入 requirement.md（需求正文，specify 全文注入）
#   - --kb ：知识库（corpus 参考材料），复制进 knowledge/，走「索引 + 选读」，不全文灌入
#   - --attach 已退役：语义模糊（需求正文 vs 参考素材不分），报错并提示改用 --prd / --kb
cmd_new() {
  local fid="${1:-}"
  [[ -n "$fid" ]] || die "缺少需求ID，用法：./specc.sh new <需求ID> [\"需求描述\"] [--prd <文件|目录>...] [--kb <文件|目录>...]"
  shift

  local requirement=""
  local -a prd_paths=()
  local -a kb_paths=()
  while (( $# )); do
    case "$1" in
      --attach)
        die "--attach 已退役（语义模糊：需求正文 vs 参考素材不分）。请改用 --prd（需求文档，进 requirement.md）或 --kb（知识库，进 knowledge/）"
        ;;
      --prd)
        shift
        [[ $# -gt 0 ]] || die "--prd 后需跟文件或目录路径"
        prd_paths+=("$1")
        shift
        ;;
      --kb)
        shift
        [[ $# -gt 0 ]] || die "--kb 后需跟文件或目录路径"
        kb_paths+=("$1")
        shift
        ;;
      --)
        shift; break ;;
      *)
        [[ -n "$requirement" ]] && requirement+=$'\n'
        requirement+="$1"
        shift
        ;;
    esac
  done

  require_init
  # 需求ID合法性：仅允许字母数字与连字符（防止路径穿越）
  [[ "$fid" =~ ^[A-Za-z0-9][A-Za-z0-9-]*$ ]] || die "需求ID只允许字母、数字与连字符，且以字母数字开头"

  local fdir="$FEATURES_DIR/$fid"
  [[ -e "$fdir" ]] && die "需求已存在：${fdir}（不会覆盖；如需重来请手动删除或使用 redo）"

  mkdir -p "$fdir/contracts" "$fdir/knowledge"
  state_init "$fdir" "$fid"
  log_ok "需求工作目录已创建：$fdir"

  {
    if [[ -n "$requirement" ]]; then
      printf '%s\n' "$requirement"
    else
      echo "（本需求暂未填写描述。请在此补充一句话需求概述；或通过 --prd 挂入需求文档。该描述将作为探询起点。）"
    fi
    echo
    echo "## 需求文档（--prd 附加内容）"
    local p; local prd_cnt=0
    # macOS bash 3.2 在 set -u 下，空数组 "${arr[@]}" 展开会报 unbound variable，须先判空
    if (( ${#prd_paths[@]} > 0 )); then
      for p in "${prd_paths[@]}"; do
        _cmd_new_prd "$p" && prd_cnt=1
      done
    fi
    (( prd_cnt == 1 )) || echo "（未附加需求文档）"
  } > "$fdir/requirement.md"

  # 知识库：把 --kb 的文本文件复制到 knowledge/（只复制，不并入 requirement.md）
  local kpt; local kb_cnt=0
  if (( ${#kb_paths[@]} > 0 )); then
    for kpt in "${kb_paths[@]}"; do
      _cmd_new_kb "$kpt" "$fdir" && kb_cnt=1
    done
  fi

  if [[ -n "$requirement" || ${#prd_paths[@]} -gt 0 ]]; then
    log_ok "需求描述已记录：$fdir/requirement.md"
  else
    log_warn "未携带需求描述与需求文档：请将需求写入 $fdir/requirement.md 后再执行 probe"
  fi

  # 生成知识库索引（若知识库有内容），供 probe/specify 阶段「先看索引再选读」
  if knowledge_has_files "$fdir"; then
    knowledge_build_index "$fdir"
    log_ok "知识库已就绪：$fdir/knowledge/（索引已生成，probe 时先看索引再探询）"
  else
    log_warn "知识库为空：probe 将仅凭需求描述进行"
  fi

  log_info "开始第一阶段（需求探询）：./specc.sh probe $fid"
}

# ---- 辅助：是否为可读文本文件（按扩展名白名单）----
_cmd_new_is_text() {
  case "${1##*.}" in
    md|txt|markdown|adoc|json|yaml|yml|js|jsx|ts|tsx|java|sql|css|scss|html|xml|properties|conf|ini|sh|go|py|rb)
      return 0 ;;
    *) return 1 ;;
  esac
}

# ---- 辅助：把 --prd 指向的文本并入 requirement.md（需求正文，全量）----
# 返回 0 表示有内容写入，否则返回 1
_cmd_new_prd() {
  local src="$1"
  if [[ -f "$src" ]]; then
    if _cmd_new_is_text "$src" && [[ -s "$src" ]]; then
      echo
      echo "### 需求文档：$(basename "$src")"
      cat "$src"
      return 0
    fi
    echo "[警告] 忽略非文本或空文件：$src" >&2
    return 1
  fi
  if [[ -d "$src" ]]; then
    echo
    echo "### 需求文档目录：$(basename "$src")/"
    local f; local any=0
    while IFS= read -r f; do
      _cmd_new_is_text "$f" || continue
      [[ -s "$f" ]] || continue
      echo
      echo "### 资源：$(basename "$src")/${f#$src/}"
      cat "$f"
      any=1
    done < <(find "$src" \( -name node_modules -o -name .git -o -name target -o -name dist \
        -o -name build -o -name '.specc-cache' -o -name '*.log' \) -prune -o -type f -print 2>/dev/null | head -n 200)
    return 0
  fi
  echo "[警告] 需求文档不存在：$src" >&2
  return 1
}

# ---- 辅助：把 --kb 指向的文件/目录复制进 knowledge/（只复制，不并需求正文）----
# 返回 0 表示有文件写入知识库，否则返回 1
_cmd_new_kb() {
  local src="$1" fdir="$2"
  local kdir="$fdir/knowledge"
  mkdir -p "$kdir"
  if [[ -f "$src" ]]; then
    if _cmd_new_is_text "$src" && [[ -s "$src" ]]; then
      cp "$src" "$kdir/"
      echo "  已归入知识库：$(basename "$src")"
      return 0
    fi
    echo "[警告] 忽略非文本或空文件：$src" >&2
    return 1
  fi
  if [[ -d "$src" ]]; then
    local f rel n=0
    while IFS= read -r f; do
      _cmd_new_is_text "$f" || continue
      [[ -s "$f" ]] || continue
      rel="${f#$src/}"
      mkdir -p "$kdir/$(dirname "$rel")"
      cp "$f" "$kdir/$rel"
      (( n++ ))
    done < <(find "$src" \( \
        -name node_modules -o -name .git -o -name target -o -name dist -o -name build \
        -o -name '.specc-cache' -o -name '*.log' -o -name '*.png' -o -name '*.jpg' -o -name '*.jpeg' \
        -o -name '*.gif' -o -name '*.webp' -o -name '*.bmp' -o -name '*.svg' -o -name '*.class' \) \
        -prune -o -type f -print 2>/dev/null)
    if (( n > 0 )); then
      echo "  已归入知识库：$(basename "$src")/（${n} 个文本文件）"
      return 0
    fi
    echo "[警告] 目录内无可归入的文本文件：$src" >&2
    return 1
  fi
  echo "[警告] 知识库材料不存在：$src" >&2
  return 1
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
      echo "  - ${id}（当前阶段：$(state_get "$d" 'stage')）"
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
  # 无任何参数：输出帮助并以非 0 退出（验收用例 TC-A4：提示用法但视为调用错误）
  if [[ $# -eq 0 ]]; then
    usage
    exit 1
  fi
  local cmd="$1"
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
    strip)
      shift
      cmd_strip "$@"
      ;;
    approve|reject)
      # 异步审批命令：人工审查产物后通过/否决（配合人工检查点异步模式）
      shift
      local fid="${1:-}" opinion="${2:-}"
      [[ -n "$fid" ]] || die "用法：./specc.sh approve|reject <需求ID> [意见]"
      require_init
      local fdir; fdir="$(require_feature "$fid")"
      pipeline_review "$cmd" "$fdir" "$opinion"
      ;;
    probe|specify|clarify|plan|tasks|implement|verify)
      local stage="$cmd"; shift
      local fid="${1:-}"
      require_init
      local fdir; fdir="$(require_feature "$fid")"
      pipeline_run_stage "$stage" "$fdir"
      ;;
    help|-h|--help) usage ;;
    --version|-v|version) cmd_version ;;
    *) log_error "未知命令：$cmd"; echo ""; usage; exit 1 ;;
  esac
}

main "$@"
