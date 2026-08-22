#!/usr/bin/env bash
# ============================================================
# lib/common.sh —— 通用工具函数
# 职责：路径定位、日志输出、依赖检查
# 所有其他脚本通过 source 引入本文件
# ============================================================

# ---- 路径定位 ----
# SPECC_ROOT：specc 仓库根目录（以 lib/common.sh 所在位置向上推导）
SPECC_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SPECC_DIR="$SPECC_ROOT/.specc"          # 框架资产目录
FEATURES_DIR="$SPECC_ROOT/features"     # 需求工作目录
SPECS_DIR="$SPECC_ROOT/specs"           # 系统级规格库

# ---- 带颜色的日志输出（终端友好）----
_c() { printf "\033[%sm%s\033[0m" "$1" "$2"; }   # 内部：上色辅助
log_info()  { echo "$(_c '0;36' '[信息]') $*"; }
log_ok()    { echo "$(_c '0;32' '[通过]') $*"; }
log_warn()  { echo "$(_c '0;33' '[警告]') $*"; }
log_error() { echo "$(_c '0;31' '[失败]') $*" >&2; }
die()       { log_error "$*"; exit 1; }

# ---- 依赖检查：确认已执行过 specc init ----
require_init() {
  [[ -f "$SPECC_DIR/constitution.md" ]] || \
    die "未初始化：请先执行 ./specc.sh init"
}

# ---- 需求目录检查：返回需求目录路径，不存在则报错退出 ----
require_feature() {
  local fid="$1"
  [[ -n "$fid" ]] || die "缺少需求ID，用法：specc.sh <命令> <需求ID>"
  local fdir="$FEATURES_DIR/$fid"
  [[ -d "$fdir" ]] || die "需求目录不存在：${fdir}（请先执行 ./specc.sh new ${fid}）"
  echo "$fdir"
}

# ---- 时间戳（用于 state.json 的 history 记录）----
now_iso() { date '+%Y-%m-%dT%H:%M:%S'; }
