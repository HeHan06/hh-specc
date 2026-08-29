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
source "$(dirname "${BASH_SOURCE[0]}")/observability.sh"

# ---- 各阶段产物说明（供引擎/人工执行时明确交付物）----
stage_deliverables() {
  local stage="$1" fdir="$2"
  case "$stage" in
    probe)    echo "- $fdir/probe-questions.md（需求探询问题清单，供用户逐条回答）"
              echo "- 用户将答案写入 $fdir/probe-answers.md（完整需求输入，specify 据此生成规格）" ;;
    specify)  echo "- $fdir/spec.md（EARS 需求 + 端归属 + 验收标准 + 不做什么）"
              echo "- $fdir/business.md $fdir/data-model.md $fdir/flows.md（业务层知识三件套，后续阶段注入）" ;;
    clarify)  echo "- $fdir/clarify.md（问答记录）"
              echo "- $fdir/spec.md（回填，[NEEDS CLARIFICATION] 清零）" ;;
    plan)     echo "- $fdir/plan.md（技术方案，遵循 plan 模板）"
              echo "- $fdir/contracts/<模块>.yaml（契约，四要素齐备）" ;;
    tasks)    echo "- $fdir/tasks.md（原子任务 + 需求回链 + 验证命令）" ;;
    implement) echo "- 代码写入 $PROJECTS_DIR/$(basename "$fdir")/：web-admin/ miniprogram/ backend/ shared/（含单测）"
              echo "- 不自动 commit（宪法 5.5 / Git 形态 A）" ;;
    verify)   echo "- $fdir/verify-report.md（测试汇总 + 契约一致性 + 验收对照表）" ;;
  esac
}

# ---- 前置条件检查：阶段必须按序执行（验收用例 TC-G1）----
pipeline_check_precondition() {
  local stage="$1" fdir="$2"
  local idx; idx="$(stage_index "$stage")"
  (( idx >= 0 )) || die "未知阶段：${stage}（合法阶段：${SPECC_STAGES[*]}）"

  # 第一个阶段（specify）无前置
  (( idx == 0 )) && return 0

  # 所有前驱阶段必须已通过门禁（approved）
  local i prev
  for (( i = 0; i < idx; i++ )); do
    prev="${SPECC_STAGES[$i]}"
    local g; g="$(state_get "$fdir" "gates.$prev")"
    if [[ "$g" != "approved" ]]; then
      log_error "前置条件不满足：阶段【${prev}】尚未通过（当前状态：${g:-pending}）"
      log_error "请先完成前置阶段，禁止跳阶段（宪法 5.4）"
      return 1
    fi
  done
  return 0
}

# ---- 执行单个阶段 ----
# 流程：前置检查 → 组装上下文 → 引擎执行 → 自动门禁 → 人工检查点 → 状态落盘
# 重入规则（异步审批配套）：若本阶段门禁已是 approved（人工审批已通过），
# 直接返回成功，避免重复跑引擎（./specc.sh approve 后重跑命令即走此分支）
pipeline_run_stage() {
  local stage="$1" fdir="$2"

  # implement 阶段与其它「单一有界调用」阶段不同，走逐任务循环
  if [[ "$stage" == "implement" ]]; then
    pipeline_run_implement "$fdir"
    return $?
  fi

  # 0) 已通过则幂等跳过
  if [[ "$(state_get "$fdir" "gates.$stage")" == "approved" ]]; then
    log_ok "阶段【${stage}】已通过审批，跳过执行"
    return 0
  fi

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
    probe)     [[ -f "$fdir/requirement.md" ]] && extras+=("$fdir/requirement.md")  # 探询起点：用户第一句话
               [[ -f "$fdir/probe-answers.md" ]] && extras+=("$fdir/probe-answers.md")  # 多轮：若已答，据此收敛/追问
               if [[ "$(cfg_get 'knowledge.enabled' 'true' 2>/dev/null)" == "true" ]]; then
                 [[ -f "$fdir/knowledge/.index.md" ]] && extras+=("$fdir/knowledge/.index.md")  # 知识库索引辅助判断遗漏主题
               fi ;;
    specify)   ;;   # 需求输入由 assemble.sh 第 6 步专用处理（优先探询沉淀，其次 requirement.md），此处不重复
    clarify)   [[ -f "$fdir/spec.md" ]] && extras+=("$fdir/spec.md")
               # 人工提前提供的澄清答案（可选）：若存在则注入，模型据此直接回填
               [[ -f "$fdir/clarify-answers.md" ]] && extras+=("$fdir/clarify-answers.md") ;;
    plan)      [[ -f "$fdir/spec.md" ]] && extras+=("$fdir/spec.md") ;;
    tasks)     [[ -f "$fdir/plan.md" ]] && extras+=("$fdir/plan.md")
               # 契约文件一并注入
               if [[ -d "$fdir/contracts" ]]; then
                 local c; for c in "$fdir"/contracts/*; do [[ -f "$c" ]] && extras+=("$c"); done
               fi ;;
    verify)    extras+=("$fdir/spec.md" "$fdir/tasks.md")
               [[ -f "$fdir/plan.md" ]] && extras+=("$fdir/plan.md") ;;
  esac
  # 注意：macOS 自带 bash 3.2 在 set -u 下，空数组展开 "${extras[@]}" 会报
  # unbound variable，必须先判空再展开
  if (( ${#extras[@]} > 0 )); then
    assemble_to_file "$stage" "$fdir" "$prompt_file" "${extras[@]}" >/dev/null
  else
    assemble_to_file "$stage" "$fdir" "$prompt_file" >/dev/null
  fi
  log_info "上下文已组装：$prompt_file"

  # 3) 引擎执行（codex 或 manual 退化）
  local deliverables; deliverables="$(stage_deliverables "$stage" "$fdir")"
  engine_run "$stage" "$fdir" "$prompt_file" "$deliverables" || {
    state_set "$fdir" "gates.$stage" "engine_failed"
    state_history_add "$fdir" "阶段 $stage 引擎执行失败"
    return 1
  }

  # 3.5) verify 阶段：生成跨端可观测 DAG（确定性产物，不依赖引擎）
  # 后端 DAG 已由引擎跑测试时的编译期 APT 顺带生成；此处补前端扫描 + 跨端合并
  if [[ "$stage" == "verify" ]]; then
    observability_generate "$fdir" || {
      state_set "$fdir" "gates.$stage" "gate_failed"
      state_history_add "$fdir" "阶段 $stage 可观测 DAG 生成失败"
      return 1
    }
  fi

  # 4) 自动门禁（✓ 先行）
  if ! gate_auto_run "$stage" "$fdir"; then
    state_set "$fdir" "gates.$stage" "gate_failed"
    state_history_add "$fdir" "阶段 $stage 自动门禁失败"
    return 1
  fi

  # 5) 人工检查点（✋ 后置）
  # 返回码：0=交互模式直接通过；1=否决；2=异步模式待审批
  local review_rc=0
  gate_human_review "$stage" "$fdir" || review_rc=$?
  if (( review_rc == 2 )); then
    state_set "$fdir" "gates.$stage" "awaiting_review"
    state_history_add "$fdir" "阶段 $stage 产物已生成，等待人工审批（异步模式）"
    log_warn "阶段 $stage 已生成产物，等待人工审批：./specc.sh approve $(basename "$fdir")"
    return 2
  elif (( review_rc != 0 )); then
    state_set "$fdir" "gates.$stage" "rejected"
    return 1
  fi

  # 6) 全部通过：状态落盘
  state_set "$fdir" "gates.$stage" "approved"
  state_history_add "$fdir" "阶段完成：${stage}（自动门禁 + 人工审查均通过）"
  log_ok "阶段【${stage}】完成 ✔"

  # 提示下一阶段
  local next_idx; next_idx=$(( $(stage_index "$stage") + 1 ))
  if (( next_idx < ${#SPECC_STAGES[@]} )); then
    log_info "下一阶段：${SPECC_STAGES[$next_idx]}（./specc.sh ${SPECC_STAGES[$next_idx]} $(basename "$fdir")）"
  else
    log_ok "六阶段全部完成！需求【$(basename "$fdir")】已端到端实现完毕"
  fi
  return 0
}

# ---- 从 tasks.md 提取单个任务块（### T-NN 到下一个 ### 或文件尾）----
# 用法：extract_task_block <tasks.md路径> <任务ID如T-01>
# 说明：任务头形如「### T-01：...」，全角/半角冒号均兼容
extract_task_block() {
  local file="$1" tid="$2"
  awk -v id="$tid" '
    $0 ~ ("^### " id "[：:]") { found=1; print; next }
    found && /^### / { exit }
    found { print }
  ' "$file"
}

# ---- 执行 implement 阶段的单个任务（一个任务 = 一次有界引擎调用）----
# 流程：提取任务块 → 按工程组装上下文 → 引擎生成代码并跑该任务验证 → 失败重试 1 次 → 回填 state.json
# 验证命令由引擎（codex）在其工作流内自行执行；本函数只负责编排与状态记录
implement_run_one_task() {
  local fdir="$1" tasks_file="$2" tid="$3"

  # 断点续跑：已完成的重复任务跳过
  if [[ "$(state_get "$fdir" "tasks.$tid")" == "done" ]]; then
    log_info "任务 ${tid} 已完成，跳过"
    return 0
  fi

  log_info "==> 任务 ${tid} 开始"

  # 提取任务块（多行 markdown）
  local task_block
  task_block="$(extract_task_block "$tasks_file" "$tid")"
  [[ -n "$task_block" ]] || { log_error "无法从 tasks.md 提取任务 ${tid}"; return 1; }

  # 提取所属工程（端/工程 字段），用于按工程注入平台规范
  local proj
  proj="$(printf '%s\n' "$task_block" | grep -m1 '端/工程' | sed 's/.*：//' | tr -d '[:space:]')"

  state_set "$fdir" "tasks.$tid" "running"
  state_history_add "$fdir" "任务 $tid 开始（工程：${proj:-未知}）"

  # 组装该任务的上下文并落盘
  local prompt_file
  prompt_file="$SPECC_ROOT/$(cfg_get 'engine.output_dir' '.specc-cache/prompts')/$(basename "$fdir")-implement-${tid}.prompt.md"
  mkdir -p "$(dirname "$prompt_file")"
  assemble_implement_task "$fdir" "$task_block" "$proj" "$prompt_file"
  log_info "上下文已组装：$prompt_file"

  # 引擎执行：codex 在内部生成代码并运行该任务自带验证命令
  local deliverables="- 任务 ${tid} 涉及文件中的源代码 + 单元测试（写入工作区，不自动 commit）"
  if engine_run "implement" "$fdir" "$prompt_file" "$deliverables"; then
    state_set "$fdir" "tasks.$tid" "done"
    state_history_add "$fdir" "任务 $tid 完成"
    log_ok "任务 $tid 完成 ✔"
    return 0
  fi

  # 引擎失败：自动重试 1 次（追加失败反馈，让模型先修复再重跑验证）
  log_warn "任务 ${tid} 引擎执行失败，自动重试 1 次"
  state_history_add "$fdir" "任务 $tid 引擎失败，重试中"
  {
    echo ""
    echo "---"
    echo "【重试说明】上一次执行未通过。请先检查你刚才生成的代码与其验证命令结果，"
    echo "修复任务 ${tid} 涉及文件中的问题后，重新运行该任务的验证命令并确保通过。"
  } >> "$prompt_file"

  if engine_run "implement" "$fdir" "$prompt_file" "$deliverables"; then
    state_set "$fdir" "tasks.$tid" "done"
    state_history_add "$fdir" "任务 $tid 重试后完成"
    log_ok "任务 $tid 完成 ✔（重试）"
    return 0
  fi

  state_set "$fdir" "tasks.$tid" "failed"
  state_history_add "$fdir" "任务 $tid 重试后仍失败，挂起待人工介入"
  log_error "任务 ${tid} 重试后仍失败，挂起"
  return 1
}

# ---- implement 阶段：逐任务循环（验收用例 TC-G2/H1.4，设计文档 02 第⑤步）----
# 规则：按 tasks.md 顺序逐个执行；任一任务重试后仍失败则挂起，后续任务不再执行
pipeline_run_implement() {
  local fdir="$1"

  # 0) 已通过则幂等跳过
  if [[ "$(state_get "$fdir" "gates.implement")" == "approved" ]]; then
    log_ok "阶段【implement】已通过审批，跳过执行"
    return 0
  fi

  # 1) 前置条件检查（tasks 必须已通过）
  pipeline_check_precondition "implement" "$fdir" || return 1

  state_set "$fdir" "stage" "implement"
  state_set "$fdir" "gates.implement" "running"
  state_history_add "$fdir" "阶段开始：implement（逐任务循环）"

  # 2) 解析任务清单（按 tasks.md 中出现顺序）
  local tasks_file="$fdir/tasks.md"
  [[ -f "$tasks_file" ]] || {
    state_set "$fdir" "gates.implement" "gate_failed"
    state_history_add "$fdir" "阶段 implement 失败：缺少 tasks.md"
    log_error "缺少任务清单：$tasks_file（请先完成 tasks 阶段）"
    return 1
  }
  local task_ids
  task_ids="$(grep -oE '^### T-[0-9]+' "$tasks_file" | sed 's/^### //')"
  [[ -n "$task_ids" ]] || {
    state_set "$fdir" "gates.implement" "gate_failed"
    log_error "tasks.md 中未解析到任何任务（形如 ### T-01）"
    return 1
  }

  # 3) 逐任务执行
  # 注意：必须用 for 而非 while read <<<，否则 here-string 的 stdin 会泄漏进
  # 引擎的 codex exec（实测 codex 会把剩余任务ID当作额外输入，干扰执行）
  local tid failed=0
  for tid in $task_ids; do
    implement_run_one_task "$fdir" "$tasks_file" "$tid" || { failed=1; break; }
  done

  # 4) 结果落盘
  if (( failed == 1 )); then
    state_set "$fdir" "gates.implement" "gate_failed"
    state_history_add "$fdir" "阶段 implement 挂起：存在失败任务，需人工介入后重跑"
    log_error "implement 阶段挂起：存在失败任务（./specc.sh status 查看进度，修复后重跑 ./specc.sh implement）"
    return 1
  fi

  state_set "$fdir" "gates.implement" "approved"
  state_history_add "$fdir" "阶段完成：implement（逐任务全部实现）"
  log_ok "阶段【implement】完成 ✔"
  log_info "下一阶段：verify（./specc.sh verify $(basename "$fdir")）"
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
  log_ok "已重置：从【${stage}】开始的所有阶段门禁（之前阶段保留）"
}

# ---- 异步审批：对处于 awaiting_review 的阶段执行 approve / reject ----
# approve：门禁置 approved，记录审计，提示下一阶段
# reject ：门禁置 rejected，意见记入审计链，需修改产物后重跑该阶段
pipeline_review() {
  local action="$1" fdir="$2" opinion="${3:-}"

  # 找到处于待审批状态的阶段（正常流程中最多只有一个）
  local stage="" s g
  for s in "${SPECC_STAGES[@]}"; do
    g="$(state_get "$fdir" "gates.$s")"
    if [[ "$g" == "awaiting_review" ]]; then
      stage="$s"
      break
    fi
  done
  [[ -n "$stage" ]] || die "当前没有处于待审批（awaiting_review）状态的阶段"

  case "$action" in
    approve)
      state_set "$fdir" "gates.$stage" "approved"
      state_history_add "$fdir" "人工审查：阶段 $stage 通过（approve，异步）"
      log_ok "阶段【${stage}】审查通过 ✔"
      local next_idx; next_idx=$(( $(stage_index "$stage") + 1 ))
      if (( next_idx < ${#SPECC_STAGES[@]} )); then
        log_info "下一阶段：${SPECC_STAGES[$next_idx]}（./specc.sh ${SPECC_STAGES[$next_idx]} $(basename "$fdir")）"
      else
        log_ok "六阶段全部完成！需求【$(basename "$fdir")】已端到端实现完毕"
      fi
      ;;
    reject)
      state_set "$fdir" "gates.$stage" "rejected"
      state_history_add "$fdir" "人工审查：阶段 $stage 否决（reject，异步）——意见：${opinion:-未填写}"
      log_warn "阶段【${stage}】被否决（意见：${opinion:-未填写}），请修改产物后重跑：./specc.sh $stage $(basename "$fdir")"
      ;;
  esac
}
