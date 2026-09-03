#!/usr/bin/env bash
# ============================================================
# lib/gates.sh —— M7 门禁检查系统
# 职责：两类自动门禁（结构检查）+ 人工检查点的统一执行框架。
#   自动门禁先行，失败即终止并报告；通过后暂停等待人工审查（✋）。
# 门禁清单（对应 05-验收用例 TC-G2~G5）：
#   - specify 后：spec.md 完整 + 业务层知识三件套齐备
#   - clarify 后：spec.md 不得残留 [NEEDS CLARIFICATION]
#   - tasks 后：每条 Req 至少被一个任务回链覆盖
#   - plan 后：契约四要素齐备（响应体/错误码/认证/分页）
# ============================================================

source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

# ---- 自动门禁：probe 阶段 —— 探询问题清单已生成 ----
# 规则：probe-questions.md 必须存在且非空（代表已有一次有效的需求探询）。
# 说明：probe 的「是否问清了」由人工裁决（gate_human_review），门禁只校验清单确实产出，
#       避免「探询阶段跑了却什么都没问」的情况。
gate_check_probe() {
  local fdir="$1"
  local qfile="$fdir/probe-questions.md"
  [[ -s "$qfile" ]] || { log_error "门禁失败：缺少探询问题清单 $qfile（probe 阶段必须产出问题清单）"; return 1; }
  log_ok "结构检查：探询问题清单已生成"
  return 0
}

# ---- 自动门禁：specify 阶段 —— 产物完整性 ----
# 规则：spec.md 结构完整 + 业务层知识三件套（business/data-model/flows）齐备且非空。
# 背景：业务层知识是 specify 的产出物（非全局资产），后续阶段注入；若引擎漏生成，
#   assemble.sh 会对不存在文件静默跳过，导致「业务层知识缺失但不报错」，故此处强制校验。
gate_check_specify() {
  local fdir="$1"
  local spec="$fdir/spec.md"
  local fail=0

  [[ -f "$spec" ]] || { log_error "门禁失败：缺少产物 $spec"; return 1; }

  # 业务层知识三件套必须存在且非空
  local f
  for f in business.md data-model.md flows.md; do
    if [[ ! -s "$fdir/$f" ]]; then
      log_error "门禁失败：缺少业务层知识产物 ${fdir}/${f}（specify 阶段必须生成三件套）"
      fail=1
    fi
  done

  # spec.md 基本结构：至少一条 Req-N
  grep -qE 'Req-[0-9]+' "$spec" || {
    log_error "门禁失败：spec.md 未找到任何 Req-N 需求条目"; fail=1; }

  # 范围边界与量化约束章节必须存在（一等公民）
  grep -q '不做什么' "$spec" || { log_error "门禁失败：spec.md 缺少「不做什么（范围边界）」章节"; fail=1; }
  grep -q '量化约束' "$spec" || { log_error "门禁失败：spec.md 缺少「量化约束」章节"; fail=1; }

  [[ "$fail" -eq 1 ]] && return 1
  log_ok "结构检查：spec.md 完整 + 业务层知识三件套齐备"
  return 0
}

# ---- 自动门禁：clarify 阶段 —— 待澄清标记必须清零 ----
gate_check_clarify() {
  local fdir="$1"
  local spec="$fdir/spec.md"
  [[ -f "$spec" ]] || { log_error "门禁失败：缺少产物 $spec"; return 1; }
  local remain
  remain="$(grep -c 'NEEDS CLARIFICATION' "$spec" 2>/dev/null || true)"
  if [[ "${remain:-0}" -gt 0 ]]; then
    log_error "门禁失败：spec.md 仍有 ${remain} 处 [NEEDS CLARIFICATION] 未消除："
    grep -n 'NEEDS CLARIFICATION' "$spec" | sed 's/^/    /'
    return 1
  fi
  # 前端视觉范围结论必须落盘（visual 阶段分流与门禁据此判断，单一真相源）
  local scope="$fdir/frontend-scope.md"
  if [[ ! -f "$scope" ]] || ! grep -qE '^frontend_visual_required:[[:space:]]*(true|false)' "$scope"; then
    log_error "门禁失败：缺少前端视觉范围结论 $scope（clarify 阶段必须判定本需求是否涉及新的前端视觉/交互）"
    return 1
  fi

  log_ok "结构检查：无待澄清标记残留 + 前端视觉范围已判定"
  return 0
}

# ---- 自动门禁：tasks 阶段 —— 需求回链全覆盖 ----
# 规则：spec.md 中的每个「### Req-N」必须在 tasks.md 的回链中出现
gate_check_tasks() {
  local fdir="$1"
  local spec="$fdir/spec.md" tasks="$fdir/tasks.md"
  [[ -f "$spec" ]]  || { log_error "门禁失败：缺少 $spec"; return 1; }
  [[ -f "$tasks" ]] || { log_error "门禁失败：缺少 $tasks"; return 1; }

  # 提取 spec 中的全部需求编号（形如 Req-1）
  local reqs missing=""
  reqs="$(grep -oE 'Req-[0-9]+' "$spec" | sort -u)"
  [[ -n "$reqs" ]] || { log_error "门禁失败：spec.md 未找到任何 Req 编号"; return 1; }

  # 只统计任务正文中的回链行（含「回链」字样的行）：
  # 防止注释/标题中顺带提到某需求编号被误判为"已覆盖"（S3 测试 4 暴露的弱点）
  local trace_lines
  trace_lines="$(grep '回链' "$tasks" 2>/dev/null || true)"

  local r
  while IFS= read -r r; do
    echo "$trace_lines" | grep -q "$r" || missing="$missing $r"
  done <<< "$reqs"

  if [[ -n "$missing" ]]; then
    log_error "门禁失败：以下需求未被任何任务回链覆盖：$missing"
    return 1
  fi
  log_ok "结构检查：全部需求（$(echo "$reqs" | wc -l | tr -d ' ') 条）均有任务回链覆盖"
  return 0
}

# ---- 内部：判断本需求是否需要前端视觉图 ----
# 单一真相源：features/<ID>/frontend-scope.md（clarify 阶段由模型判定并落盘，
# 表达「本次是否涉及新的前端视觉/交互」）。不再用关键词 grep 的割裂判据。
# 该函数被 gate_check_visual / gate_check_plan（事后门禁）与 pipeline.sh
# visual 跳过 / plan 前置提示（事前引导）共用，判据只在此定义一份。
# 返回 0=需要视觉图；1=不需要（纯后端 / 无新视觉交互）。
gate_needs_frontend_visual() {
  local fdir="$1"
  local scope="$fdir/frontend-scope.md"
  [[ -f "$scope" ]] || return 1
  grep -qE '^frontend_visual_required:[[:space:]]*true' "$scope"
}

# ---- 内部：读取本需求涉及的前端工程清单（空格分隔）----
# 单一真相源：frontend-scope.md 的 frontends 行（仅 required=true 时列出）。
gate_frontend_engines() {
  local fdir="$1"
  local scope="$fdir/frontend-scope.md"
  [[ -f "$scope" ]] || return 0
  grep -m1 '^frontends:' "$scope" 2>/dev/null \
    | sed 's/^frontends:[[:space:]]*//' \
    | tr ',' ' '
}

# ---- 自动门禁：visual 阶段 —— 全页面视觉图已生成 + UI 预设已锁定 ----
# 规则：visual.html 存在且非空；涉及前端视觉的需求必须已选定 UI 预设（视觉令牌唯一源）。
gate_check_visual() {
  local fdir="$1"
  local vfile="$fdir/visual.html"
  [[ -s "$vfile" ]] || { log_error "门禁失败：缺少全页面视觉图 $vfile（visual 阶段必须产出 visual.html）"; return 1; }
  if gate_needs_frontend_visual "$fdir" && [[ ! -f "$fdir/contracts/ui-preset.md" ]]; then
    log_error "门禁失败：涉及前端视觉的需求尚未选定 UI 预设。请先 ./specc.sh ui $(basename "$fdir") list 后 select"
    return 1
  fi
  log_ok "结构检查：全页面视觉图已生成 + UI 预设已锁定"
  return 0
}

# ---- 自动门禁：plan 阶段 —— 契约四要素 ----
# 检查 contracts/ 下至少一个契约文件，且含四要素关键标记
gate_check_plan() {
  local fdir="$1"
  local cdir="$fdir/contracts"
  [[ -d "$cdir" ]] && [[ -n "$(ls -A "$cdir" 2>/dev/null)" ]] || {
    log_error "门禁失败：$cdir 不存在或为空（plan 阶段必须产出契约）"; return 1; }

  local f fail=0
  for f in "$cdir"/*; do
    [[ -f "$f" ]] || continue
    local fname; fname="$(basename "$f")"
    # 四要素逐项检查（关键字以 api-conventions 模板为准）
    grep -q 'error-code-table' "$f" || { log_error "  [$fname] 缺少错误码表（error-code-table）"; fail=1; }
    grep -qE 'auth:'            "$f" || { log_error "  [$fname] 缺少认证标注（auth）"; fail=1; }
    grep -q 'pageNum'           "$f" || { log_error "  [$fname] 缺少分页约定（pageNum）"; fail=1; }
    grep -qE 'code.*(0|统一响应)|统一响应体' "$f" || { log_error "  [$fname] 缺少统一响应体约定"; fail=1; }
  done
  if [[ "$fail" -eq 1 ]]; then
    log_error "门禁失败：契约四要素不齐备（见上方明细，规范见 platform/api-conventions.md）"
    return 1
  fi

  # 涉及前端视觉的需求须为每个前端工程选定 UI 预设（视觉与布局唯一源，见 platform/ui-presets/README.md）
  # 判据与工程清单均来自 frontend-scope.md（模型判定，单一真相源，见 gate_needs_frontend_visual）
  local is_fe=0
  gate_needs_frontend_visual "$fdir" && is_fe=1
  if [[ "$is_fe" -eq 1 ]]; then
    # 从 frontend-scope.md 读取本需求涉及的前端工程，逐个核对已选预设
    local fe fe_missing=0
    for fe in $(gate_frontend_engines "$fdir"); do
      if ! grep -qE "^- 前端：${fe} -> 预设：[^ ]+$" "$fdir/contracts/ui-preset.md" 2>/dev/null; then
        log_error "门禁失败：前端【${fe}】未选定 UI 预设。请执行 ./specc.sh ui $(basename "$fdir") list 后 ./specc.sh ui $(basename "$fdir") select <code> --fe ${fe}"
        fe_missing=1
      fi
    done
    [[ "$fe_missing" -eq 1 ]] && fail=1
  fi

  [[ "$fail" -eq 1 ]] && return 1
  log_ok "契约检查：四要素齐备（统一响应体/错误码/认证/分页）$([[ "$is_fe" -eq 1 ]] && echo '+ 各前端 UI 预设已选定')"
  return 0
}

# ---- 自动门禁：verify 阶段 —— 端到端冒烟通过 + 验证报告四部分齐备 ----
# 规则：
#   1) 端到端冒烟报告 smoke-report.md 必须存在且结论「通过」（由 lib/smoke.sh
#      确定性执行，真实启动后端+前端，从前端页面入口冒烟——替代原先单测汇总）。
#   2) verify-report.md 必须含四部分：端到端冒烟 / 契约一致性 / 宪法抽查 / 验收对照表。
# 可观测 DAG 由 pipeline 在 verify 阶段生成，失败已在流程中阻断，此处不再重复校验。
gate_check_verify() {
  local fdir="$1"
  local report="$fdir/verify-report.md"
  local smoke="$fdir/smoke-report.md"
  local fail=0

  [[ -s "$smoke" ]] || { log_error "门禁失败：缺少端到端冒烟报告 $smoke"; return 1; }
  grep -q '结论：通过' "$smoke" || {
    log_error "门禁失败：端到端冒烟未通过（${smoke}）"
    grep -E '❌|结论' "$smoke" | sed 's/^/    /' >&2
    return 1
  }
  log_ok "端到端冒烟：通过（真实启动 + 从页面入口验证完整链路）"

  [[ -s "$report" ]] || { log_error "门禁失败：缺少产物 $report（verify 阶段必须生成验证报告）"; return 1; }

  grep -q '端到端冒烟' "$report"   || { log_error "门禁失败：报告缺少「端到端冒烟」部分"; fail=1; }
  grep -q '契约一致性' "$report"   || { log_error "门禁失败：报告缺少「契约一致性」部分"; fail=1; }
  grep -q '宪法抽查' "$report"     || { log_error "门禁失败：报告缺少「宪法抽查」部分"; fail=1; }
  grep -qE '验收(标准)?对照表' "$report" || { log_error "门禁失败：报告缺少「验收对照表」部分"; fail=1; }

  [[ "$fail" -eq 1 ]] && return 1
  log_ok "结构检查：验证报告四部分齐备（端到端冒烟/契约一致性/宪法抽查/验收对照表）"
  return 0
}

# ---- 自动门禁路由：按阶段执行对应检查（无自动门禁的阶段直接通过）----
gate_auto_run() {
  local stage="$1" fdir="$2"
  case "$stage" in
    probe)   gate_check_probe "$fdir" ;;
    specify) gate_check_specify "$fdir" ;;
    clarify) gate_check_clarify "$fdir" ;;
    visual)  gate_check_visual "$fdir" ;;
    plan)    gate_check_plan "$fdir" ;;
    tasks)   gate_check_tasks "$fdir" ;;
    verify)  gate_check_verify "$fdir" ;;
    *)       log_info "阶段 $stage 无自动门禁，跳过"; return 0 ;;
  esac
}

# ---- 人工检查点：暂停等待人工审查（✋）----
# 需要人工审查的阶段：probe / specify / visual / plan / verify（对应流程设计文档门禁汇总）
# 两种模式：
#   交互模式（终端直连）：approve 通过 ｜ reject 否决（附意见，记入审计链）
#   异步审批模式（非交互，如脚本/CI/IDE Agent 代跑）：不阻塞等待，
#     返回特殊码 2，由流程引擎将门禁置为 awaiting_review，
#     人工审查后通过 ./specc.sh approve / reject 完成审批
#   ——这正是未来产品化时"人工检查点异步化"的提前落地（见产品化讨论）
gate_human_review() {
  local stage="$1" fdir="$2"
  case "$stage" in
    probe|specify|visual|plan|verify) ;;  # 这五个阶段需要人工审查（visual：全页面视觉图敲定）
    *) return 0 ;;                 # 其余阶段自动通过
  esac

  # 非交互环境：切换为异步审批模式
  if [[ ! -t 0 ]]; then
    echo ""
    echo "============================================================"
    echo "✋ 人工检查点（异步模式）：阶段【${stage}】产物已生成，等待人工审查"
    echo "   需求目录：$fdir"
    echo "   审查通过后执行：./specc.sh approve $(basename "$fdir")"
    echo "   否决并附意见　：./specc.sh reject $(basename "$fdir") <意见>"
    echo "============================================================"
    return 2
  fi

  local decision opinion
  while true; do
    read -r -p "审查结论 [approve / reject]：" decision
    case "$decision" in
      approve)
        state_history_add "$fdir" "人工审查：阶段 $stage 通过（approve）"
        log_ok "人工审查通过，进入下一阶段"
        return 0 ;;
      reject)
        read -r -p "请填写否决意见（将记入审计链）：" opinion
        state_history_add "$fdir" "人工审查：阶段 $stage 否决（reject）——意见：${opinion:-未填写}"
        log_warn "阶段 $stage 被否决，请修改产物后重新执行本阶段"
        return 1 ;;
      *) echo "请输入 approve 或 reject" ;;
    esac
  done
}
