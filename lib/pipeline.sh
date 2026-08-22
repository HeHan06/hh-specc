#!/usr/bin/env bash
# ============================================================
# lib/pipeline.sh —— M2 流程引擎（阶段状态机）
# 职责：驱动六阶段线性流程，执行
#   「前置条件检查 → 组装上下文 → 调引擎 → 产物落盘 → 自动门禁 → 人工检查点」循环。
# 关键规则：
#   - 禁止跳阶段：前置阶段未通过不得执行后续阶段（验收用例 TC-G1）
#   - 门禁编排：自动门禁先行（✓），失败即终止；通过后进入人工检查点（✋）
#   - redo 支持：重置目标阶段及其后的门禁状态（验收用例 TC-G6）
# ============================================================

source "$(dirname "${BASH_SOURCE[0]}")/common.sh"
source "$(dirname "${BASH_SOURCE[0]}")/state.sh"
source "$(dirname "${BASH_SOURCE[0]}")/assemble.sh"
source "$(dirname "${BASH_SOURCE[0]}")/engines.sh"
source "$(dirname "${BASH_SOURCE[0]}")/gates.sh"

# ---- 各阶段产物说明（供引擎/人工执行时明确交付物）----
stage_deliverables() {
  local stage="$1" fdir="$2"
  case "$stage" in
    specify)  echo "- $fdir/spec.md（EARS 需求 + 端归属 + 验收标准 + 不做什么）" ;;
    clarify)  echo "- $fdir/clarify.md（问答记录）"
              echo "- $fdir/spec.md（回填，[NEEDS CLARIFICATION] 清零）" ;;
    plan)     echo "- $fdir/plan.md（技术方案，遵循 plan 模板）"
              echo "- $fdir/contracts/<模块>.yaml（契约，四要素齐备）" ;;
    tasks)    echo "- $fdir/tasks.md（原子任务 + 需求回链 + 验证命令）" ;;
    implement) echo "- 代码写入工作区：web-admin/ miniprogram/ backend/ shared/（含单测）"
              echo "- 不自动 commit（宪法 5.5 / Git 形态 A）" ;;
    verify)   echo "- $fdir/verify-report.md（测试汇总 + 契约一致性 + 验收对照表）" ;;
  esac
}

# ---- 前置条件检查：阶段必须按序执行（验收用例 TC-G1）----
pipeline_check_precondition() {
  local stage="$1" fdir="$2"
  local idx; idx="$(stage_index "$stage")"
  (( idx >= 0 )) || die "未知阶段：$stage（合法阶段：${SPECC_STAGES[*]}）"

  # 第一个阶段（specify）无前置
  (( idx == 0 )) && return 0

  # 所有前驱阶段必须已通过门禁（approved）
  local i prev
  for (( i = 0; i < idx; i++ )); do
    prev="${SPECC_STAGES[$i]}"
    local g; g="$(state_get "$fdir" "gates.$prev")"
    if [[ "$g" != "approved" ]]; then
      log_error "前置条件不满足：阶段【$prev】尚未通过（当前状态：${g:-pending}）"
      log_error "请先完成前置阶段，禁止跳阶段（宪法 5.4）"
      return 1
    fi
  done
  return 0
}

# ---- 执行单个阶段 ----
# 流程：前置检查 → 组装上下文 → 引擎执行 → 自动门禁 → 人工检查点 → 状态落盘
pipeline_run_stage() {
  local stage="$1" fdir="$2"

  # 1) 前置条件检查
  pipeline_check_precondition "$stage" "$fdir" || return 1

  state_set "$fdir" "stage" "$stage"
  state_set "$fdir" "gates.$stage" "running"
  state_history_add "$fdir" "阶段开始：$stage"

  # 2) 组装阶段上下文（提示词）
  local prompt_dir prompt_file
  prompt_dir="$SPECC_ROOT/$(cfg_get 'engine.output_dir' '.specc-cache/prompts')"
  mkdir -p "$prompt_dir"
  prompt_file="$prompt_dir/$(basename "$fdir")-${stage}.prompt.md"

  # 收集本阶段的额外输入文件（上一阶段产物等）
  local extras=()
  case "$stage" in
    clarify)   [[ -f "$fdir/spec.md" ]] && extras+=("$fdir/spec.md") ;;
    plan)      [[ -f "$fdir/spec.md" ]] && extras+=("$fdir/spec.md") ;;
    tasks)     [[ -f "$fdir/plan.md" ]] && extras+=("$fdir/plan.md")
               # 契约文件一并注入
               if [[ -d "$fdir/contracts" ]]; then
                 local c; for c in "$fdir"/contracts/*; do [[ -f "$c" ]] && extras+=("$c"); done
               fi ;;
    verify)    extras+=("$fdir/spec.md" "$fdir/tasks.md")
               [[ -f "$fdir/plan.md" ]] && extras+=("$fdir/plan.md") ;;
  esac
  assemble_to_file "$stage" "$fdir" "$prompt_file" "${extras[@]}" >/dev/null
  log_info "上下文已组装：$prompt_file"

  # 3) 引擎执行（codex 或 manual 退化）
  local deliverables; deliverables="$(stage_deliverables "$stage" "$fdir")"
  engine_run "$stage" "$fdir" "$prompt_file" "$deliverables" || {
    state_set "$fdir" "gates.$stage" "engine_failed"
    state_history_add "$fdir" "阶段 $stage 引擎执行失败"
    return 1
  }

  # 4) 自动门禁（✓ 先行）
  if ! gate_auto_run "$stage" "$fdir"; then
    state_set "$fdir" "gates.$stage" "gate_failed"
    state_history_add "$fdir" "阶段 $stage 自动门禁失败"
    return 1
  fi

  # 5) 人工检查点（✋ 后置）
  if ! gate_human_review "$stage" "$fdir"; then
    state_set "$fdir" "gates.$stage" "rejected"
    return 1
  fi

  # 6) 全部通过：状态落盘
  state_set "$fdir" "gates.$stage" "approved"
  state_history_add "$fdir" "阶段完成：$stage（自动门禁 + 人工审查均通过）"
  log_ok "阶段【$stage】完成 ✔"

  # 提示下一阶段
  local next_idx; next_idx=$(( $(stage_index "$stage") + 1 ))
  if (( next_idx < ${#SPECC_STAGES[@]} )); then
    log_info "下一阶段：${SPECC_STAGES[$next_idx]}（./specc.sh ${SPECC_STAGES[$next_idx]} $(basename "$fdir")）"
  else
    log_ok "六阶段全部完成！可执行 ./specc.sh archive $(basename "$fdir") 归档（v0.2）"
  fi
  return 0
}

# ---- redo：重置目标阶段及之后所有阶段的状态（验收用例 TC-G6）----
# 规则：目标阶段及其后门禁重置为 pending；之前的阶段与产物保留
pipeline_redo() {
  local stage="$1" fdir="$2"
  local idx; idx="$(stage_index "$stage")"
  (( idx >= 0 )) || die "未知阶段：$stage"

  local i s
  for (( i = idx; i < ${#SPECC_STAGES[@]}; i++ )); do
    s="${SPECC_STAGES[$i]}"
    state_set "$fdir" "gates.$s" "pending"
  done
  state_set "$fdir" "stage" "$stage"
  state_history_add "$fdir" "redo：重置阶段 $stage 及其后所有门禁"
  log_ok "已重置：从【$stage】开始的所有阶段门禁（之前阶段保留）"
}
