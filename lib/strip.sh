#!/usr/bin/env bash
# ============================================================
# lib/strip.sh —— 可观测性注解剥离（交付前清理）
# 职责：移除业务代码中「仅用于可观测性」的注解/标签，业务逻辑零改动。
#   后端：@Capability / @CapabilityPoint / @Orchestrate 注解 + import
#   前端：JSDoc 的 @capability / @capabilityPoint / @orchestrate 标签
# 安全：
#   - 默认 dry-run（只预览 diff，不写文件）
#   - --apply 前自动整目录备份到 .specc-cache/strip-backup/
#   - 只作用于 projects/<需求ID>/，不动 features/ 规格与平台组件
# ============================================================

source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

_strip_script() { echo "$SPECC_ROOT/specc-observability/strip.py"; }

# ---- 剥离命令入口 ----
# 用法：cmd_strip <需求ID> [--apply | --dry-run]
cmd_strip() {
  local fid="${1:-}"; shift || true
  require_init
  [[ -n "$fid" ]] || die "用法：./specc.sh strip <需求ID> [--apply]"

  local fdir; fdir="$(require_feature "$fid")"
  local target="$PROJECTS_DIR/$fid"
  [[ -d "$target" ]] || die "代码目录不存在：${target}（尚未 implement，无可剥离内容）"

  local strip_py; strip_py="$(_strip_script)"
  [[ -f "$strip_py" ]] || die "缺少剥离脚本：$strip_py"
  command -v python3 >/dev/null 2>&1 || die "未安装 python3：剥离脚本依赖 python3"

  local mode="--dry-run" apply=0
  local a
  for a in "$@"; do
    case "$a" in
      --apply)   apply=1; mode="--apply" ;;
      --dry-run) mode="--dry-run" ;;
      *) die "未知参数：$a（仅支持 --apply / --dry-run）" ;;
    esac
  done

  if [[ "$apply" -eq 1 ]]; then
    local backup_dir="$SPECC_ROOT/.specc-cache/strip-backup/${fid}-$(date +%Y%m%d%H%M%S)"
    mkdir -p "$(dirname "$backup_dir")"
    cp -R "$target" "$backup_dir" 2>/dev/null
    log_info "已备份到：$backup_dir"
  fi

  python3 "$strip_py" "$target" "$mode"
  local rc=$?

  if [[ "$apply" -eq 1 && "$rc" -eq 0 ]]; then
    log_info "如需还原：从 $SPECC_ROOT/.specc-cache/strip-backup/ 恢复对应快照"
  fi
  return "$rc"
}
