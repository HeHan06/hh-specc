#!/usr/bin/env bash
# ============================================================
# lib/observability.sh —— 代码可观测性 DAG 生成
# 职责：在 verify 阶段自动生成跨端可观测 DAG（审查时生效、运行时不生效）。
#   后端 DAG：由 Maven 编译期 APT（specc-observability 的 CodeGraphProcessor）
#             自动生成到 backend/target/observability/（implement/verify 跑测试即触发）
#   前端 DAG：由前端扫描器 scan.cjs（Babel AST 解析 JSDoc 标签）生成
#   跨端总图：由 merge.cjs 按节点 id 合并后端 + 前端，得到完整调用链
# 产物落点（均在 projects/<需求ID>/target/ 下，随构建重建、不入库）：
#   projects/<需求ID>/target/observability-frontend/   前端 DAG
#   projects/<需求ID>/target/observability/            跨端合并总图
# ============================================================

source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

# ---- 可观测扫描器与合并器路径（随平台组件分发，属 .specc/lib 同级资产）----
_observability_scan() { echo "$SPECC_ROOT/specc-observability/frontend/scan.cjs"; }
_observability_merge() { echo "$SPECC_ROOT/specc-observability/merge.cjs"; }

# ---- 各 DAG 输出目录 ----
observability_backend_out() { echo "$PROJECTS_DIR/$(basename "$1")/backend/target/observability"; }
observability_frontend_out() { echo "$PROJECTS_DIR/$(basename "$1")/target/observability-frontend"; }
observability_merged_out() { echo "$PROJECTS_DIR/$(basename "$1")/target/observability"; }

# ---- 收集前端工程目录（projects/<ID>/ 下含 package.json 的子目录）----
# 输出：以换行分隔的目录列表；无则输出空
observability_frontend_projects() {
  local pid="$1" d
  for d in "$PROJECTS_DIR/$pid"/*/; do
    [[ -d "$d" ]] || continue
    [[ -f "$d/package.json" ]] && echo "${d%/}"
  done
}

# ---- 生成跨端可观测 DAG（verify 阶段调用）----
# 用法：observability_generate <需求目录>
# 流程：前端扫描（若有前端工程）→ 合并后端+前端 DAG
# 返回：0=成功（或无可扫描工程时跳过）；1=生成失败
observability_generate() {
  local fdir="$1"
  local pid; pid="$(basename "$fdir")"
  local scan merge
  scan="$(_observability_scan)"
  merge="$(_observability_merge)"

  [[ -f "$scan" ]]  || { log_error "缺少前端扫描器：$scan"; return 1; }
  [[ -f "$merge" ]] || { log_error "缺少合并器：$merge"; return 1; }
  command -v node >/dev/null 2>&1 || { log_error "未安装 Node.js：前端 DAG 扫描依赖 node 命令"; return 1; }

  local backend_out front_out merged_out
  backend_out="$(observability_backend_out "$fdir")"
  front_out="$(observability_frontend_out "$fdir")"
  merged_out="$(observability_merged_out "$fdir")"

  # 1) 前端扫描（收集到的前端工程逐一遍历；空数组需先判空，兼容 bash 3.2）
  local fe fe_list
  fe_list="$(observability_frontend_projects "$pid")"
  if [[ -n "$fe_list" ]]; then
    fe=()
    while IFS= read -r d; do fe+=("$d"); done <<< "$fe_list"
    log_info "前端 DAG 扫描：${fe[*]}"
    node "$scan" --feature "$pid" --out "$front_out" "${fe[@]}" || {
      log_error "前端 DAG 扫描失败（工程：${fe[*]}）"; return 1; }
  else
    log_info "未发现前端工程（projects/$pid 下无 package.json），跳过前端扫描"
  fi

  # 2) 跨端合并（后端 DAG 由编译期 APT 生成，可能尚不存在；merge.cjs 会跳过缺失输入）
  local merge_inputs=()
  [[ -f "$backend_out/code-graph.json" ]] && merge_inputs+=("$backend_out/code-graph.json")
  [[ -f "$front_out/code-graph.json" ]]  && merge_inputs+=("$front_out/code-graph.json")

  if (( ${#merge_inputs[@]} == 0 )); then
    log_warn "未找到任何 DAG 产物（后端未编译且无前端工程），跳过跨端合并"
    return 0
  fi

  log_info "跨端 DAG 合并：${merge_inputs[*]}"
  node "$merge" --feature "$pid" --out "$merged_out" "${merge_inputs[@]}" || {
    log_error "跨端 DAG 合并失败"; return 1; }
  return 0
}
