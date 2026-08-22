#!/usr/bin/env bash
# ============================================================
# lib/engines.sh —— M6 引擎适配层
# 职责：屏蔽引擎差异，规格层不感知具体引擎。
#   - codex 适配器：调用 Codex Harness（codex exec）执行有界阶段任务
#   - manual 退化模式：不调引擎，输出组装好的提示词 + 产物清单，
#     由人工在任意 IDE Agent 中手动执行，产物放回约定路径
# 安全：密钥只从环境变量读取（宪法 2.1 / 验收用例 TC-B4、TC-F2）
# ============================================================

source "$(dirname "${BASH_SOURCE[0]}")/common.sh"
source "$(dirname "${BASH_SOURCE[0]}")/assemble.sh"

# ---- 读取当前配置的引擎类型（codex | manual）----
engine_type() {
  cfg_get 'engine.type' 'codex'
}

# ---- codex 引擎可用性检查 ----
# 检查项：codex 命令存在 + 密钥环境变量已设置
# 任一不满足即不可用（调用方可选择退化到 manual）
engine_codex_available() {
  command -v codex >/dev/null 2>&1 || return 1
  local key_env
  key_env="$(cfg_get 'model.api_key_env' 'DASHSCOPE_API_KEY')"
  [[ -n "${!key_env:-}" ]] || return 1
  return 0
}

# ---- codex 适配器：执行一次有界阶段任务 ----
# 用法：engine_run_codex <阶段名> <需求目录> <提示词文件> <产物说明>
# 说明：一个阶段=一次有界调用；产物由模型按指令落盘到约定路径
engine_run_codex() {
  local stage="$1" fdir="$2" prompt_file="$3" deliverables="$4"

  # 密钥检查（失败信息明确指向应设置的变量，对应验收用例 TC-F2）
  local key_env
  key_env="$(cfg_get 'model.api_key_env' 'DASHSCOPE_API_KEY')"
  if [[ -z "${!key_env:-}" ]]; then
    die "未设置环境变量 ${key_env}：请 export ${key_env}=<你的密钥>（密钥不入库）"
  fi
  command -v codex >/dev/null 2>&1 || \
    die "未安装 Codex CLI：请先安装（npm i -g @openai/codex 或参考官方文档）"

  local model_id base_url
  model_id="$(cfg_get 'model.id' 'qwen3.8-max')"
  base_url="$(cfg_get 'model.base_url' 'https://dashscope.aliyuncs.com/compatible-mode/v1')"

  log_info "引擎：Codex Harness ｜ 模型：${model_id} ｜ 端点：${base_url}"
  log_info "阶段：${stage} ｜ 需求：$(basename "$fdir")"

  # 组装最终执行指令：提示词内容 + 产物要求
  local exec_prompt
  exec_prompt="$(cat "$prompt_file")

---
【产物要求】
${deliverables}
【工作目录】${fdir}"

  # codex exec：非交互模式、跳过 git 仓库检查（本仓库可能刚初始化）
  # --full-auto：在沙箱内自动执行工具调用；高风险操作仍受审批策略约束
  ( cd "$SPECC_ROOT" && codex exec --skip-git-repo-check "$exec_prompt" )
}

# ---- manual 退化适配器：输出提示词与产物清单，转人工执行 ----
# 用法：engine_run_manual <阶段名> <需求目录> <提示词文件> <产物说明>
# 对应验收用例 TC-F4：引擎不可用时流程不崩溃，产物路径清晰
engine_run_manual() {
  local stage="$1" fdir="$2" prompt_file="$3" deliverables="$4"
  local out_dir
  out_dir="$(cfg_get 'engine.output_dir' '.specc-cache/prompts')"
  mkdir -p "$SPECC_ROOT/$out_dir"
  local saved="$SPECC_ROOT/$out_dir/$(basename "$fdir")-${stage}.prompt.md"
  cp "$prompt_file" "$saved"

  echo ""
  echo "============================================================"
  echo "【Manual 退化模式】当前不调用引擎，请按以下步骤人工执行："
  echo "  1. 将下方提示词文件内容粘贴到任意 IDE Agent（Trae/Cursor/Claude Code 等）"
  echo "     提示词文件：$saved"
  echo "  2. 要求 Agent 产出以下产物："
  echo "$deliverables" | sed 's/^/       /'
  echo "  3. 产物落盘路径：$fdir"
  echo "  4. 完成后重新执行本阶段命令以过门禁"
  echo "============================================================"
  echo ""
}

# ---- 统一入口：按配置与可用性选择适配器 ----
# 用法：engine_run <阶段名> <需求目录> <提示词文件> <产物说明>
# 返回：0=已执行（codex 成功 或 manual 已输出指引）
engine_run() {
  local stage="$1" fdir="$2" prompt_file="$3" deliverables="$4"
  local etype
  etype="$(engine_type)"

  if [[ "$etype" == "codex" ]]; then
    if engine_codex_available; then
      engine_run_codex "$stage" "$fdir" "$prompt_file" "$deliverables"
      return $?
    fi
    # codex 配置了但不可用（未装/无密钥）：告警后退化为 manual
    log_warn "Codex 引擎不可用（未安装或密钥未设置），自动退化为 Manual 模式"
    engine_run_manual "$stage" "$fdir" "$prompt_file" "$deliverables"
    return 0
  fi

  # 显式配置的 manual 模式
  engine_run_manual "$stage" "$fdir" "$prompt_file" "$deliverables"
}
