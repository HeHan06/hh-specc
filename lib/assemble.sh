#!/usr/bin/env bash
# ============================================================
# lib/assemble.sh —— M5 上下文组装器（Context Assembler）
# 职责：按「宪法 + 平台层相关片段 + 业务层 + 上一阶段产物 + 模板 + 阶段指令」
#       组装单次引擎调用的完整提示词。
# 关键设计（见 02/03 文档）：
#   - 宪法：所有阶段强制注入，红线不可省略
#   - 平台层：按阶段相关性 JIT 选取（specify 不注入技术规约，保持规格纯净）
#   - 业务层：术语/角色/数据模型/流程全量注入
#   - Token 预算：超阈值告警，提示裁剪
# ============================================================

source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

# ---- 阶段 → 平台层文件 映射表（JIT 注入的核心）----
# specify 刻意不注入技术规约；plan 阶段全量注入
_platform_files_for_stage() {
  local stage="$1"
  case "$stage" in
    specify)
      echo "" ;;                                          # 规格阶段保持纯净，不注入技术规约
    clarify)
      echo "dual-end-boundary.md" ;;                      # 澄清时帮助判断端归属
    plan)
      echo "tech-stack.md dual-end-boundary.md miniprogram-standards.md web-admin-standards.md api-conventions.md" ;;
    tasks)
      echo "api-conventions.md" ;;                        # 拆任务只需契约规范
    implement)
      # 按任务所属工程注入对应规范；默认给契约规范（由 pipeline 可再追加）
      echo "api-conventions.md" ;;
    verify)
      echo "api-conventions.md" ;;                        # 验证需对照契约
    *)
      echo "" ;;
  esac
}

# ---- 内部：把文件内容以「来源标注块」形式拼接 ----
_append_file() {
  local file="$1" label="$2"
  [[ -f "$file" ]] || return 0
  {
    echo ""
    echo "========== ${label}（$(basename "$file")）=========="
    echo ""
    cat "$file"
  }
}

# ---- 组装阶段提示词 ----
# 用法：assemble_context <阶段名> <需求目录> [额外文件路径...]
# 输出：完整提示词到 stdout（由调用方落盘或喂给引擎）
assemble_context() {
  local stage="$1" fdir="$2"; shift 2 || true
  local fid
  fid="$(basename "$fdir")"

  # 1) 宪法：永远注入（宪法第 8.1 条）
  _append_file "$SPECC_DIR/constitution.md" "宪法（强制遵守）"

  # 2) 平台层：按阶段映射注入
  local pf
  for pf in $(_platform_files_for_stage "$stage"); do
    _append_file "$SPECC_DIR/platform/$pf" "平台层知识"
  done

  # 3) 业务层：全量注入
  local bf
  for bf in business.md data-model.md flows.md; do
    _append_file "$SPECC_DIR/project/$bf" "业务层知识"
  done

  # 4) 上一阶段产物 + 额外指定文件（如 implement 的任务片段、plan 的契约）
  local extra
  for extra in "$@"; do
    [[ -f "$extra" ]] && _append_file "$extra" "阶段输入产物"
  done

  # 5) 阶段指令（放最后，靠近执行要求）
  _append_file "$SPECC_DIR/prompts/$stage.md" "本阶段指令"

  # 6) specify 阶段：注入需求描述（替换阶段指令中的 {REQUIREMENT_TEXT} 占位符）
  #    需求描述是 specify 的唯一需求输入口，由 ./specc.sh new 落盘到 requirement.md
  if [[ "$stage" == "specify" ]]; then
    local req_file="$fdir/requirement.md"
    if [[ -f "$req_file" ]]; then
      _append_file "$req_file" "需求描述（原始输入，请注入指令中的 {REQUIREMENT_TEXT}）"
    else
      echo ""
      echo "========== ⚠ 警告：未找到需求描述（$req_file）=========="
      echo "specify 阶段缺少需求输入，产物可能为空或不完整。请先补充需求描述。"
    fi
  fi
}

# ---- 组装并落盘（供引擎调用与人工检视）----
# 用法：assemble_to_file <阶段名> <需求目录> <输出文件> [额外文件...]
assemble_to_file() {
  local stage="$1" fdir="$2" outfile="$3"; shift 3 || true
  mkdir -p "$(dirname "$outfile")"
  assemble_context "$stage" "$fdir" "$@" > "$outfile"

  # Token 预算告警（按字符数粗估，超阈值提示裁剪）
  local warn_chars chars
  warn_chars="$(cfg_get 'pipeline.context_warn_chars' '60000')"
  chars="$(wc -c < "$outfile" | tr -d ' ')"
  if (( chars > warn_chars )); then
    log_warn "上下文体积 ${chars} 字符，超过阈值 ${warn_chars}，建议裁剪平台层/业务层内容（见 TC-E3）"
  fi
  echo "$outfile"
}

# ---- 简易配置读取（从 .specc/config.yaml 取 key，取不到用默认值）----
# 用法：cfg_get 'pipeline.context_warn_chars' '60000'
cfg_get() {
  local dotpath="$1" default="$2"
  local cfg="$SPECC_DIR/config.yaml"
  [[ -f "$cfg" ]] || { echo "$default"; return; }
  # 用 python3 解析 yaml 的扁平 key（避免引入第三方依赖）
  python3 - "$cfg" "$dotpath" "$default" <<'PYEOF' || echo "$2"
import sys
cfg_path, dotpath, default = sys.argv[1], sys.argv[2], sys.argv[3]
keys = dotpath.split(".")
# 极简 YAML 读取：按缩进层级匹配（本项目 config.yaml 为固定两级结构）
cur_indent = -1
stack = []
found = None
with open(cfg_path, encoding="utf-8") as f:
    for line in f:
        if not line.strip() or line.strip().startswith("#"):
            continue
        indent = len(line) - len(line.lstrip())
        key_part = line.split(":")[0].strip()
        # 根据缩进维护层级栈
        while stack and stack[-1][0] >= indent:
            stack.pop()
        stack.append((indent, key_part))
        path = ".".join(k for _, k in stack)
        if path == dotpath:
            val = line.split(":", 1)[1].strip()
            found = val if val else None
if found is not None:
    print(found)
else:
    print(default)
PYEOF
}
