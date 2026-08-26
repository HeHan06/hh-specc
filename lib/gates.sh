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
  log_ok "结构检查：无待澄清标记残留"
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
  log_ok "契约检查：四要素齐备（统一响应体/错误码/认证/分页）"
  return 0
}

# ---- 自动门禁：verify 阶段 —— 验证报告四部分齐备 ----
# 规则：verify-report.md 必须存在且含四部分：测试汇总/契约一致性/宪法抽查/验收对照表。
# 可观测 DAG 由 pipeline 在 verify 阶段先行生成（observability_generate），
# 生成失败已在流程中阻断，此处不再重复校验 DAG 产物。
gate_check_verify() {
  local fdir="$1"
  local report="$fdir/verify-report.md"
  local fail=0

  [[ -s "$report" ]] || { log_error "门禁失败：缺少产物 $report（verify 阶段必须生成验证报告）"; return 1; }

  grep -q '测试汇总' "$report"     || { log_error "门禁失败：报告缺少「测试汇总」部分"; fail=1; }
  grep -q '契约一致性' "$report"   || { log_error "门禁失败：报告缺少「契约一致性」部分"; fail=1; }
  grep -q '宪法抽查' "$report"     || { log_error "门禁失败：报告缺少「宪法抽查」部分"; fail=1; }
  grep -qE '验收(标准)?对照表' "$report" || { log_error "门禁失败：报告缺少「验收对照表」部分"; fail=1; }

  [[ "$fail" -eq 1 ]] && return 1
  log_ok "结构检查：验证报告四部分齐备（测试汇总/契约一致性/宪法抽查/验收对照表）"
  return 0
}

# ---- 自动门禁路由：按阶段执行对应检查（无自动门禁的阶段直接通过）----
gate_auto_run() {
  local stage="$1" fdir="$2"
  case "$stage" in
    specify) gate_check_specify "$fdir" ;;
    clarify) gate_check_clarify "$fdir" ;;
    plan)    gate_check_plan "$fdir" ;;
    tasks)   gate_check_tasks "$fdir" ;;
    verify)  gate_check_verify "$fdir" ;;
    *)       log_info "阶段 $stage 无自动门禁，跳过"; return 0 ;;
  esac
}

# ---- 人工检查点：暂停等待人工审查（✋）----
# 需要人工审查的阶段：specify / plan / verify（对应 02 文档门禁汇总）
# 两种模式：
#   交互模式（终端直连）：approve 通过 ｜ reject 否决（附意见，记入审计链）
#   异步审批模式（非交互，如脚本/CI/IDE Agent 代跑）：不阻塞等待，
#     返回特殊码 2，由流程引擎将门禁置为 awaiting_review，
#     人工审查后通过 ./specc.sh approve / reject 完成审批
#   ——这正是未来产品化时"人工检查点异步化"的提前落地（见产品化讨论）
gate_human_review() {
  local stage="$1" fdir="$2"
  case "$stage" in
    specify|plan|verify) ;;        # 这三个阶段需要人工审查
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
