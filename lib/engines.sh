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

# ---- 计算引擎工作目录 ----
# implement 阶段代码产物写入 projects/<需求ID>（与平台组件隔离，见 docs/03），
# 其余阶段产物落在 features/<需求ID>（规格产物）。
_engine_workdir() {
  local stage="$1" fdir="$2"
  if [[ "$stage" == "implement" ]]; then
    echo "$PROJECTS_DIR/$(basename "$fdir")"
  else
    echo "$fdir"
  fi
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

# ---- 判定本次调用是否需要「看图片」的多模态模型 ----
# 规则：若该环节的上下文（prompt）中携带了图片引用（markdown 图片 / 【附图】/ 图片路径），
# 则自动切换到 model.vision 模型；否则一律用默认 model.id（v4-pro）。
# 这是「需要图片的环节自动用多模态，否则用 v4-pro」的自动化判定实现。
_prompt_needs_vision() {
  local prompt_file="$1"
  [[ -f "$prompt_file" ]] || return 1
  # 匹配以下任一「上下文里带图片」的信号：
  #   1. markdown 图片：![alt](xxx.png)
  #   2. 【附图:xxx.png】 章节标记
  #   3. 裸图片路径（asset/logo.png、img/banner.jpg 等独立词）
  grep -qiE '!\[[^]]*\]\([^)]*\.(png|jpe?g|gif|webp|bmp|svg)\)|\b【附图[：:]\s*\S+\.(png|jpe?g|gif|webp|bmp|svg)\b|[A-Za-z0-9_./-]+\.(png|jpe?g|gif|webp|bmp|svg)' "$prompt_file"
  return $?
}

# ---- 解析本次调用应使用的模型 ID ----
# 默认用 model.id；上下文带图片时用 model.vision.id（其余继承顶层，仅 ID 不同）。
# 用法：_resolve_model_id <prompt_file>
_resolve_model_id() {
  local prompt_file="$1"
  if _prompt_needs_vision "$prompt_file"; then
    cfg_get 'model.vision.id' "$(cfg_get 'model.id' 'deepseek-v4-pro')"
  else
    cfg_get 'model.id' 'deepseek-v4-pro'
  fi
}

# ---- 根据 .specc/config.yaml 动态生成 Codex 配置 ----
# 目的：切换模型只需改 config.yaml 的 model 段，无需手改 ~/.codex/config.toml。
# 用法：_gen_codex_config <输出文件> <模型ID>
# 输出：写入 CODEX_HOME 下的 config.toml（IDE 沙箱不可写 ~/.codex 时同样生效）
_gen_codex_config() {
  local out="$1" model_id="$2"
  local provider provider_name base_url wire_api key_env
  provider="$(cfg_get 'model.provider' 'deepseek')"
  provider_name="$(cfg_get 'model.provider_name' 'DeepSeek')"
  base_url="$(cfg_get 'model.base_url' 'https://api.deepseek.com')"
  wire_api="$(cfg_get 'model.wire_api' 'responses')"
  key_env="$(cfg_get 'model.api_key_env' 'DEEPSEEK_API_KEY')"

  # 沙箱固定为 danger-full-access：Codex 运行在 IDE 沙箱内，其自身沙箱
  # 需 OS 级机制（Seatbelt/Landlock），嵌套环境会持续失败（实测）。安全边界由外层兜底。
  cat > "$out" <<EOF
# 由 specc 引擎适配层根据 .specc/config.yaml 自动生成，勿手改
model_provider = "$provider"
model = "$model_id"
approval_policy = "on-request"
sandbox_mode = "danger-full-access"

[model_providers.$provider]
name = "$provider_name"
base_url = "$base_url"
wire_api = "$wire_api"
env_key = "$key_env"

[projects."${SPECC_ROOT}"]
trust_level = "trusted"
EOF
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
  # 模型按环节自动解析：上下文带图片 → 用 vision 多模态；否则用默认 v4-pro
  model_id="$(_resolve_model_id "$prompt_file")"
  base_url="$(cfg_get 'model.base_url' 'https://api.deepseek.com')"

  log_info "引擎：Codex Harness ｜ 模型：${model_id} ｜ 端点：${base_url}"
  log_info "阶段：${stage} ｜ 需求：$(basename "$fdir")"

  # 计算工作目录：implement 写代码到 projects/<ID>，其余阶段写产物到 features/<ID>
  local workdir
  workdir="$(_engine_workdir "$stage" "$fdir")"
  mkdir -p "$workdir"

  # 组装最终执行指令：提示词内容 + 产物要求
  local exec_prompt
  exec_prompt="$(cat "$prompt_file")

---
【产物要求】
${deliverables}
【工作目录】${workdir}"

  # Codex 状态目录重定向：默认 ~/.codex 在 IDE 沙箱内可能不可写（实测暴露），
  # 重定向到项目内 .specc-cache/codex-home（已被 .gitignore 覆盖，不入库）。
  # 配置由 _gen_codex_config 根据 config.yaml 动态生成，无需依赖 ~/.codex。
  local codex_home="$SPECC_ROOT/$(cfg_get 'engine.output_dir' '.specc-cache')/codex-home"
  mkdir -p "$codex_home"
  _gen_codex_config "$codex_home/config.toml" "$model_id"
  export CODEX_HOME="$codex_home"

  # codex exec：非交互模式、跳过 git 仓库检查（本仓库可能刚初始化）
  # --full-auto：在沙箱内自动执行工具调用；高风险操作仍受审批策略约束
  # </dev/null：切断 stdin，避免外层循环的 here-string/管道内容泄漏给 codex
  ( cd "$workdir" && codex exec --skip-git-repo-check "$exec_prompt" </dev/null )
}

# ---- manual 退化适配器：输出提示词与产物清单，转人工执行 ----
# 用法：engine_run_manual <阶段名> <需求目录> <提示词文件> <产物说明>
# 对应验收用例 TC-F4：引擎不可用时流程不崩溃，产物路径清晰
engine_run_manual() {
  local stage="$1" fdir="$2" prompt_file="$3" deliverables="$4"
  local out_dir
  out_dir="$(cfg_get 'engine.output_dir' '.specc-cache/prompts')"
  mkdir -p "$SPECC_ROOT/$out_dir"
  local workdir
  workdir="$(_engine_workdir "$stage" "$fdir")"
  mkdir -p "$workdir"
  local saved="$SPECC_ROOT/$out_dir/$(basename "$fdir")-${stage}.prompt.md"
  # 源与目标可能同名（pipeline 组装与 manual 输出同路径），判等则跳过拷贝
  if [[ "$(cd "$(dirname "$prompt_file")" && pwd)/$(basename "$prompt_file")" != "$(cd "$(dirname "$saved")" && pwd)/$(basename "$saved")" ]]; then
    cp "$prompt_file" "$saved"
  fi

  echo ""
  echo "============================================================"
  echo "【Manual 退化模式】当前不调用引擎，请按以下步骤人工执行："
  echo "  1. 将下方提示词文件内容粘贴到任意 IDE Agent（Trae/Cursor/Claude Code 等）"
  echo "     提示词文件：$saved"
  echo "  2. 要求 Agent 产出以下产物："
  echo "$deliverables" | sed 's/^/       /'
  echo "  3. 产物落盘路径：$workdir"
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
