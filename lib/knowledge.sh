#!/usr/bin/env bash
# ============================================================
# lib/knowledge.sh —— 知识库（corpus）选读
# 职责：为需求目录下的 knowledge/ 生成索引；按 selection.md 选出要注入的文件。
# 关键规则（对齐宪法 7.6 单一真相源）：
#   - 知识库是外部参考源，产物对其只「引用不复制」
#   - 上下文默认只注入「索引 + 已选文件」，避免全量灌入稀释重点
# 与需求文档（requirement.md）的区别：requirement.md 是需求正文（specify 全文注入，
# 作为 {REQUIREMENT_TEXT}）；knowledge/ 是辅助参考（索引 + 选读）。
# ============================================================

source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

# ---- 是否为可读文本文件（按扩展名白名单）----
_kb_is_text() {
  case "${1##*.}" in
    md|txt|markdown|adoc|json|yaml|yml|js|jsx|ts|tsx|java|sql|css|scss|html|xml|properties|conf|ini|sh|go|py|rb|c|h|cpp|hpp)
      return 0 ;;
    *) return 1 ;;
  esac
}

# ---- 知识库是否含文本文件（排除 .index.md 与 selection.md）----
knowledge_has_files() {
  local fdir="$1" kdir="$fdir/knowledge"
  [[ -d "$kdir" ]] || return 1
  local f
  while IFS= read -r f; do
    [[ "$(basename "$f")" == ".index.md" || "$(basename "$f")" == "selection.md" ]] && continue
    _kb_is_text "$f" && [[ -s "$f" ]] && return 0
  done < <(find "$kdir" -type f 2>/dev/null)
  return 1
}

# ---- 为 knowledge/ 生成索引 .index.md（树 + 每文件标题行摘要）----
knowledge_build_index() {
  local fdir="$1"
  local kdir="$fdir/knowledge" idx="$fdir/knowledge/.index.md"
  mkdir -p "$kdir"
  local rel depth prefix title
  {
    echo "# 知识库索引：$(basename "$fdir")"
    echo ""
    echo "> 本文件自动生成，仅列标题行摘要。请依据索引选出与本需求最相关的文件，"
    echo "> 将其相对路径逐行写入 knowledge/selection.md（每行一个）。"
    echo ""
  } > "$idx"
  while IFS= read -r rel; do
    [[ -z "$rel" ]] && continue
    depth=$(printf '%s' "$rel" | tr -cd '/' | wc -c)
    prefix=""
    (( depth > 0 )) && printf -v prefix '%*s' $((depth * 2)) ''
    # 优先取标题行（# 开头），否则取首非空行，截断到 80 字符
    title="$(grep -m1 '^#' "$kdir/$rel" 2>/dev/null || grep -m1 -v '^[[:space:]]*$' "$kdir/$rel" 2>/dev/null)"
    title="${title:0:80}"
    echo "${prefix}- ${rel}  ${title}" >> "$idx"
  done < <(find "$kdir" -mindepth 1 -type f \
      ! -name '.index.md' ! -name 'selection.md' 2>/dev/null | sed "s|^$kdir/||" | sort)
}

# ---- 读取选读清单 selection.md → 输出已选文件绝对路径（每行一个）----
knowledge_selection_files() {
  local fdir="$1"
  local kdir="$fdir/knowledge" sfile="$fdir/knowledge/selection.md"
  [[ -f "$sfile" ]] || return 0
  local line
  while IFS= read -r line; do
    [[ -z "${line// }" ]] && continue
    [[ "$line" == \#* ]] && continue
    [[ -f "$kdir/$line" ]] || continue
    echo "$kdir/$line"
  done < "$sfile"
}
