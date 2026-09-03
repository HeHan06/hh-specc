#!/usr/bin/env bash
# ============================================================
# specc.sh —— M1 CLI 命令模块（用户唯一入口）
# 命令一览：
#   ./specc.sh init                 初始化 .specc/ 资产骨架
#   ./specc.sh new <需求ID>          创建需求工作目录（仅建目录结构，不写需求内容）
#   ./specc.sh probe <需求ID> [..]   描述需求并启动探询（需求正文/知识库在此阶段挂载）
#   ./specc.sh status [需求ID]       查看阶段进度与门禁状态
#   ./specc.sh <stage> <需求ID>      执行阶段（probe/specify/clarify/visual/plan/tasks/implement/verify）
#   ./specc.sh redo <stage> <需求ID> 重置某阶段及其后的门禁
#   ./specc.sh help                 帮助
# 设计：CLI 不含业务逻辑，只做路由与交互；规则在流程引擎与门禁系统中
# ============================================================

set -euo pipefail
source "$(dirname "$0")/lib/common.sh"
source "$(dirname "$0")/lib/state.sh"
source "$(dirname "$0")/lib/knowledge.sh"
source "$(dirname "$0")/lib/pipeline.sh"
source "$(dirname "$0")/lib/strip.sh"

# ---- 用法帮助（验收用例 TC-A4：未知命令输出帮助并非 0 退出）----
usage() {
  cat <<'EOF'
specc —— 规范驱动 AI Coding 平台 CLI

用法：
  ./specc.sh init                   初始化框架资产（.specc/）
  ./specc.sh new <需求ID>            创建需求工作目录（仅建目录结构）
  ./specc.sh probe <需求ID> ["描述"] [--prd <文件|目录>] [--kb <文件|目录>]
      描述需求并启动探询；--prd 需求文档进 requirement.md；--kb 知识库进 knowledge/（索引+选读）
  ./specc.sh status [需求ID]         查看进度与门禁状态
  ./specc.sh ui <需求ID> list        列出可用 UI 预设并在浏览器展示视觉图（供确认选型）
  ./specc.sh ui <需求ID> select <code> [--fe <前端名>] 锁定某前端的 UI 预设（写入 contracts/ui-preset.md）
  ./specc.sh <stage> <需求ID>        执行阶段（八阶段）
  ./specc.sh redo <stage> <需求ID>   重置某阶段及其后的门禁
  ./specc.sh strip <需求ID> [--apply] 剥离可观测性注解/标签（交付前清理，默认预览）
  ./specc.sh help                   显示本帮助
  ./specc.sh --version              显示版本号

八阶段：probe → specify → clarify → visual → plan → tasks → implement → verify
EOF
}

# ---- version：显示框架名称与版本号（单一真相源：.specc/config.yaml 的 app.version）----
cmd_version() {
  local name ver
  name="$(cfg_get 'app.name' 'hh-specc')"
  ver="$(cfg_get 'app.version' '0.0.0')"
  echo "${name} v${ver}"
}

# ---- init：校验资产完整性（骨架由模板仓库携带，此处做完整性检查与兜底）----
cmd_init() {
  log_info "初始化 specc 框架资产..."
  local missing=0 f
  # 关键资产清单：缺一即提示（骨架文件随仓库分发，init 负责校验与建目录）
  local required=(
    ".specc/constitution.md"
    ".specc/platform/tech-stack.md"
    ".specc/platform/dual-end-boundary.md"
    ".specc/platform/miniprogram-standards.md"
    ".specc/platform/web-admin-standards.md"
    ".specc/platform/api-conventions.md"
    ".specc/config.yaml"
    ".specc/templates/probe-checklist.template.md"
    ".specc/templates/spec.template.md"
    ".specc/templates/plan.template.md"
    ".specc/templates/tasks.template.md"
    ".specc/templates/contract.template.md"
    ".specc/prompts/probe.md"
    ".specc/prompts/specify.md"
    ".specc/prompts/clarify.md"
    ".specc/prompts/visual.md"
    ".specc/prompts/plan.md"
    ".specc/prompts/tasks.md"
    ".specc/prompts/implement.md"
    ".specc/prompts/verify.md"
  )
  for f in "${required[@]}"; do
    if [[ ! -f "$SPECC_ROOT/$f" ]]; then
      log_error "缺失资产：$f"
      missing=1
    fi
  done
  (( missing == 0 )) || die "资产不完整，请从模板仓库恢复上述文件后重试"

  # 运行时目录（幂等创建；重复 init 不覆盖已修改的宪法——只建缺失目录）
  # 需求代码目录 projects/ 由 implement 阶段按需创建，不在此处预建
  mkdir -p "$FEATURES_DIR" "$PROJECTS_DIR"

  log_ok "specc 初始化完成：资产齐备，工作目录就绪"
  log_info "下一步：./specc.sh new <需求ID> 创建你的第一个需求"
}

# ---- new：创建需求工作目录（验收用例 TC-A2：重复创建报错不覆盖）----
# 用法：./specc.sh new <需求ID>
# 职责：仅创建需求工作目录结构（features/<ID>/contracts、knowledge、state.json）。
#       不写需求内容——需求正文与知识库统一在 probe 阶段挂载（new 与 probe 解耦）。
cmd_new() {
  local fid="${1:-}"
  [[ -n "$fid" ]] || die "缺少需求ID，用法：./specc.sh new <需求ID>"
  shift
  # 解耦后 new 只建目录：若仍携带描述/--prd/--kb 等旧参数，提示已迁移到 probe
  if (( $# > 0 )); then
    log_warn "new 已解耦为「仅建目录结构」：描述/--prd/--kb 已迁移到 probe，多余参数被忽略。请用 ./specc.sh probe $fid ... 描述需求"
  fi

  require_init
  # 需求ID合法性：仅允许字母数字与连字符（防止路径穿越）
  [[ "$fid" =~ ^[A-Za-z0-9][A-Za-z0-9-]*$ ]] || die "需求ID只允许字母、数字与连字符，且以字母数字开头"

  local fdir="$FEATURES_DIR/$fid"
  [[ -e "$fdir" ]] && die "需求已存在：${fdir}（不会覆盖；如需重来请手动删除或使用 redo）"

  mkdir -p "$fdir/contracts" "$fdir/knowledge"
  state_init "$fdir" "$fid"
  log_ok "需求工作目录已创建：$fdir"
  log_info "下一步（描述需求并探询）：./specc.sh probe $fid [\"描述\"] [--prd <文件|目录>] [--kb <文件|目录>]"
}

# 用法：./specc.sh probe <需求ID> ["需求描述"] [--prd <文件|目录>...] [--kb <文件|目录>...]
# 职责：描述需求（建 requirement.md）+ 挂知识库（--kb 进 knowledge/），随后启动 probe 探询。
#       与 new 解耦：new 只建目录，需求内容统一在此阶段挂载。
cmd_probe() {
  local fid="${1:-}"
  [[ -n "$fid" ]] || die "缺少需求ID，用法：./specc.sh probe <需求ID> [\"描述\"] [--prd <文件|目录>...] [--kb <文件|目录>...]"
  shift

  local requirement=""
  local -a prd_paths=()
  local -a kb_paths=()
  while (( $# )); do
    case "$1" in
      --attach)
        die "--attach 已退役（语义模糊：需求正文 vs 参考素材不分）。请改用 --prd（需求文档，进 requirement.md）或 --kb（知识库，进 knowledge/）"
        ;;
      --prd)
        shift
        [[ $# -gt 0 ]] || die "--prd 后需跟文件或目录路径"
        prd_paths+=("$1")
        shift
        ;;
      --kb)
        shift
        [[ $# -gt 0 ]] || die "--kb 后需跟文件或目录路径"
        kb_paths+=("$1")
        shift
        ;;
      --)
        shift; break ;;
      *)
        [[ -n "$requirement" ]] && requirement+=$'\n'
        requirement+="$1"
        shift
        ;;
    esac
  done

  require_init
  local fdir; fdir="$(require_feature "$fid")"

  # 1) 需求正文 requirement.md：多轮不覆盖，仅首次（不存在）时创建
  if [[ ! -f "$fdir/requirement.md" ]]; then
    {
      if [[ -n "$requirement" ]]; then
        printf '%s\n' "$requirement"
      else
        echo "（本需求暂未填写描述。请在此补充一句话需求概述；或通过 --prd 挂入需求文档。该描述将作为探询起点。）"
      fi
      echo
      echo "## 需求文档（--prd 附加内容）"
      local p; local prd_cnt=0
      if (( ${#prd_paths[@]} > 0 )); then
        for p in "${prd_paths[@]}"; do
          _append_prd "$p" && prd_cnt=1
        done
      fi
      (( prd_cnt == 1 )) || echo "（未附加需求文档）"
    } > "$fdir/requirement.md"
    log_ok "需求正文已写入：$fdir/requirement.md"
  else
    log_info "requirement.md 已存在（多轮探询），不覆盖"
  fi

  # 2) 知识库：--kb 复制进 knowledge/
  local kpt; local kb_cnt=0
  if (( ${#kb_paths[@]} > 0 )); then
    for kpt in "${kb_paths[@]}"; do
      _copy_kb "$kpt" "$fdir" && kb_cnt=1
    done
  fi

  # 3) 生成知识库索引（若知识库有内容），供 probe 阶段「先看索引再选读」
  if knowledge_has_files "$fdir"; then
    knowledge_build_index "$fdir"
    log_ok "知识库索引已就绪：$fdir/knowledge/.index.md"
  fi

  # 4) 启动 probe 探询阶段
  pipeline_run_stage "probe" "$fdir"
}

# ---- 辅助：是否为可读文本文件（按扩展名白名单）----
_is_text_file() {
  case "${1##*.}" in
    md|txt|markdown|adoc|json|yaml|yml|js|jsx|ts|tsx|java|sql|css|scss|html|xml|properties|conf|ini|sh|go|py|rb)
      return 0 ;;
    *) return 1 ;;
  esac
}

# ---- 辅助：把 --prd 指向的文本并入 requirement.md（需求正文，全量）----
# 返回 0 表示有内容写入，否则返回 1
_append_prd() {
  local src="$1"
  if [[ -f "$src" ]]; then
    if _is_text_file "$src" && [[ -s "$src" ]]; then
      echo
      echo "### 需求文档：$(basename "$src")"
      cat "$src"
      return 0
    fi
    echo "[警告] 忽略非文本或空文件：$src" >&2
    return 1
  fi
  if [[ -d "$src" ]]; then
    echo
    echo "### 需求文档目录：$(basename "$src")/"
    local f; local any=0
    while IFS= read -r f; do
      _is_text_file "$f" || continue
      [[ -s "$f" ]] || continue
      echo
      echo "### 资源：$(basename "$src")/${f#$src/}"
      cat "$f"
      any=1
    done < <(find "$src" \( -name node_modules -o -name .git -o -name target -o -name dist \
        -o -name build -o -name '.specc-cache' -o -name '*.log' \) -prune -o -type f -print 2>/dev/null | head -n 200)
    return 0
  fi
  echo "[警告] 需求文档不存在：$src" >&2
  return 1
}

# ---- 辅助：把 --kb 指向的文件/目录复制进 knowledge/（只复制，不并需求正文）----
# 返回 0 表示有文件写入知识库，否则返回 1
_copy_kb() {
  local src="$1" fdir="$2"
  local kdir="$fdir/knowledge"
  mkdir -p "$kdir"
  if [[ -f "$src" ]]; then
    if _is_text_file "$src" && [[ -s "$src" ]]; then
      cp "$src" "$kdir/"
      echo "  已归入知识库：$(basename "$src")"
      return 0
    fi
    echo "[警告] 忽略非文本或空文件：$src" >&2
    return 1
  fi
  if [[ -d "$src" ]]; then
    local f rel n=0
    while IFS= read -r f; do
      _is_text_file "$f" || continue
      [[ -s "$f" ]] || continue
      rel="${f#$src/}"
      mkdir -p "$kdir/$(dirname "$rel")"
      cp "$f" "$kdir/$rel"
      (( n++ ))
    done < <(find "$src" \( \
        -name node_modules -o -name .git -o -name target -o -name dist -o -name build \
        -o -name '.specc-cache' -o -name '*.log' -o -name '*.png' -o -name '*.jpg' -o -name '*.jpeg' \
        -o -name '*.gif' -o -name '*.webp' -o -name '*.bmp' -o -name '*.svg' -o -name '*.class' \) \
        -prune -o -type f -print 2>/dev/null)
    if (( n > 0 )); then
      echo "  已归入知识库：$(basename "$src")/（${n} 个文本文件）"
      return 0
    fi
    echo "[警告] 目录内无可归入的文本文件：$src" >&2
    return 1
  fi
  echo "[警告] 知识库材料不存在：$src" >&2
  return 1
}

# ---- status：展示进度（验收用例 TC-A3）----
cmd_status() {
  local fid="${1:-}"
  require_init
  if [[ -z "$fid" ]]; then
    # 列出所有需求
    log_info "当前需求列表："
    local d found=0
    for d in "$FEATURES_DIR"/*/; do
      [[ -d "$d" ]] || continue
      found=1
      local id; id="$(basename "$d")"
      echo "  - ${id}（当前阶段：$(state_get "$d" 'stage')）"
    done
    (( found == 1 )) || echo "  （暂无需求，使用 ./specc.sh new <需求ID> 创建）"
    return 0
  fi

  local fdir; fdir="$(require_feature "$fid")"
  echo ""
  echo "需求：$fid"
  echo "当前阶段：$(state_get "$fdir" 'stage')"
  echo "门禁状态："
  local s g
  for s in "${SPECC_STAGES[@]}"; do
    g="$(state_get "$fdir" "gates.$s")"
    printf "  %-10s %s\n" "$s" "${g:-pending}"
  done
  # implement 阶段展示任务进度
  local tasks; tasks="$(state_get "$fdir" 'tasks')"
  if [[ -n "$tasks" && "$tasks" != "{}" ]]; then
    echo "任务进度：$tasks"
  fi
  echo ""
  echo "审计历史（最近 10 条）："
  python3 - "$fdir/state.json" <<'PYEOF'
import json, sys
data = json.load(open(sys.argv[1], encoding="utf-8"))
for h in data.get("history", [])[-10:]:
    print(f"  [{h['ts']}] {h['text']}")
PYEOF
}

# ---- ui：列出 / 选定 UI 预设（前端视觉范式）----
# 用法：./specc.sh ui <需求ID> list | select <code>
# 背景：前端视觉与布局必须从 platform/ui-presets/ 选定一个范式，作为该需求
#   「视觉宪法」在 plan/implement 注入（见 ui-presets/README.md）。此前该命令
#   只在文档里写了用法、未落地 CLI，导致前端自由发挥、视觉失控。
cmd_ui() {
  local fid="${1:-}" sub="${2:-}" code="${3:-}"
  [[ -n "$fid" ]] || die "用法：./specc.sh ui <需求ID> list | select <code>"
  require_init
  local fdir; fdir="$(require_feature "$fid")"
  local preset_dir
  preset_dir="$SPECC_DIR/platform/ui-presets"

  case "$sub" in
    list)
      echo "可用 UI 预设（${preset_dir}）："
      python3 - "$preset_dir" <<'PYEOF'
import sys, os, glob
pdir = sys.argv[1]
found = False
for d in sorted(glob.glob(os.path.join(pdir, '*/'))):
    name = os.path.basename(d.rstrip('/'))
    rf = os.path.join(d, 'README.md')
    if not os.path.isfile(rf):
        continue
    desc = ''
    with open(rf, encoding='utf-8') as f:
        for line in f:
            if line.startswith('# UI 预设：'):
                desc = line.replace('# UI 预设：', '').strip()
                break
    print('  - %s\t%s' % (name, desc))
    found = True
if not found:
    print('  （无可用预设）')
PYEOF
      echo ""
      # 生成并排对比图：把所有预设的 preview.html 汇总到一个「并排对比页」，
      # 用浏览器打开供用户横向比较风格后确认选型（UI 选型主观，必须先看图再定）。
      # 汇总页是临时缓存产物（.specc-cache/），不写入任何预设目录，不参与引擎注入。
      local compare_out
      compare_out="$SPECC_ROOT/.specc-cache/ui-compare.html"
      mkdir -p "$(dirname "$compare_out")"
      python3 - "$preset_dir" "$compare_out" <<'PYEOF'
import sys, os, glob, html
pdir, out = sys.argv[1], sys.argv[2]
# 各预设 preview 内容容器的原始宽度（与各 preview.html 内 .frame/.page/.phone 对齐），
# 用于按列宽等比缩放 iframe，实现三列并排对比。
WIDTH = {'dashboard-admin': 960, 'landing-page': 960, 'mobile-content-feed': 390}
items = []
for d in sorted(glob.glob(os.path.join(pdir, '*/'))):
    name = os.path.basename(d.rstrip('/'))
    pf = os.path.join(d, 'preview.html')
    if not os.path.isfile(pf):
        continue
    desc = name
    rf = os.path.join(d, 'README.md')
    if os.path.isfile(rf):
        with open(rf, encoding='utf-8') as f:
            for line in f:
                if line.startswith('# UI 预设：'):
                    desc = line.replace('# UI 预设：', '').strip()
                    break
    items.append((name, desc, os.path.abspath(pf), WIDTH.get(name, 960)))

panels = []
for name, desc, pf, w in items:
    url = 'file://' + pf
    panels.append(
        '<div class="panel">'
        '<div class="cap">%s<span class="code">%s</span></div>'
        '<div class="stage"><iframe src="%s" data-w="%d"></iframe></div>'
        '</div>' % (html.escape(desc), html.escape(name), html.escape(url), w)
    )

doc = '''<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>UI 预设并排对比</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%%; }
  body {
    display: flex; gap: 14px; padding: 14px;
    background: #1e1f22; color: #111;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  }
  .panel {
    flex: 1 1 0; min-width: 0; display: flex; flex-direction: column;
    background: #fff; border-radius: 10px; overflow: hidden;
    box-shadow: 0 8px 24px rgba(0,0,0,0.35);
  }
  .cap {
    padding: 10px 12px; font-size: 13px; font-weight: 600;
    background: #f7f8fa; border-bottom: 1px solid #e5e7eb;
    display: flex; align-items: center; justify-content: space-between; gap: 8px;
  }
  .cap .code { font-weight: 400; font-size: 11px; color: #6b7280; background: #eef0f3; padding: 2px 8px; border-radius: 999px; }
  .stage { flex: 1; overflow: hidden; position: relative; }
  .stage iframe { border: 0; transform-origin: top left; }
</style>
</head>
<body>
%s
<script>
(function () {
  var panels = document.querySelectorAll('.panel');
  panels.forEach(function (p) {
    var fr = p.querySelector('iframe');
    var stage = p.querySelector('.stage');
    var w = parseInt(fr.getAttribute('data-w'), 10) || 960;
    fr.style.width = w + 'px';
    fr.style.height = '2200px';
    function fit() {
      var scale = stage.clientWidth / w;
      fr.style.transform = 'scale(' + scale + ')';
    }
    fit();
    fr.addEventListener('load', fit);
    window.addEventListener('resize', fit);
  });
})();
</script>
</body>
</html>
''' % ''.join(panels)

with open(out, 'w', encoding='utf-8') as f:
    f.write(doc)
print(out)
PYEOF
      if [[ -f "$compare_out" ]]; then
        if command -v open >/dev/null 2>&1; then
          open "$compare_out" 2>/dev/null || true
          echo "已在浏览器打开并排对比图，请对照确认风格后选型。"
        else
          echo "并排对比图（当前环境无 open 命令，请手动在浏览器打开）：file://$compare_out"
        fi
      else
        echo "（未生成视觉图，可先按文字描述选型）"
      fi
      echo ""
      echo "选定预设：./specc.sh ui $fid select <code> [--fe <前端名>]"
      ;;
    select)
      [[ -n "$code" ]] || die "用法：./specc.sh ui $fid select <code> [--fe <前端名>]（先 ./specc.sh ui $fid list 查看）"
      local src
      src="$preset_dir/$code/README.md"
      [[ -f "$src" ]] || die "预设不存在：${code}（先 ./specc.sh ui $fid list 查看可用预设）"
      # 解析 --fe <前端名>：多前端需求可为每个前端各选一个预设（如 web-admin 用后台范式、
      # web-reader 用落地页范式）。未指定则落到「default」，作为单前端/兜底预设。
      local fe_name=""
      if [[ "${4:-}" == "--fe" ]]; then
        fe_name="${5:-}"
        [[ -n "$fe_name" ]] || die "用法：./specc.sh ui $fid select $code --fe <前端名>"
      fi
      local desc
      desc="$(python3 - "$src" <<'PYEOF'
import sys
rf = sys.argv[1]
desc = ''
with open(rf, encoding='utf-8') as f:
    for line in f:
        if line.startswith('# UI 预设：'):
            desc = line.replace('# UI 预设：', '').strip()
            break
print(desc)
PYEOF
)"
      mkdir -p "$fdir/contracts"
      # 用 python 幂等维护「前端 -> 预设」映射（同前端重复 select 覆盖而非追加，保留其它前端）
      python3 - "$fdir/contracts/ui-preset.md" "${fe_name:-default}" "$code" "$desc" <<'PYEOF'
import sys, os, re
path, fe, code, desc = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
header = [
    '# UI 预设选择',
    '',
    '> 本文件是「选指路径」引用，不复制预设的令牌/骨架/纪律内容。',
    '> 视觉令牌、布局骨架、组件纪律的唯一源见各源文件（宪法 7.6 / FRAMEWORK-DEV §1.2）。',
    '',
    '## 前端映射',
]
mapping = {}
if os.path.isfile(path):
    with open(path, encoding='utf-8') as f:
        for line in f:
            m = re.match(r'^- 前端：(\S+)\s*->\s*预设：(\S+)', line)
            if m:
                mapping[m.group(1)] = m.group(2)
mapping[fe] = code
lines = list(header)
for fe_name in sorted(mapping):
    lines.append('- 前端：%s -> 预设：%s' % (fe_name, mapping[fe_name]))
with open(path, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines) + '\n')
PYEOF
      log_ok "已为前端【${fe_name:-default}】选定 UI 预设【${code}】：$fdir/contracts/ui-preset.md"
      log_info "plan / implement 阶段将按前端注入对应预设作为视觉与布局契约"
      ;;
    *)
      die "用法：./specc.sh ui <需求ID> list | select <code>"
      ;;
  esac
}

# ---- 主路由 ----
main() {
  # 无任何参数：输出帮助并以非 0 退出（验收用例 TC-A4：提示用法但视为调用错误）
  if [[ $# -eq 0 ]]; then
    usage
    exit 1
  fi
  local cmd="$1"
  case "$cmd" in
    init)   cmd_init ;;
    new)    shift; cmd_new "$@" ;;
    status) shift; cmd_status "$@" ;;
      ui) shift; cmd_ui "$@" ;;
    redo)
      shift
      local stage="${1:-}" fid="${2:-}"
      [[ -n "$stage" && -n "$fid" ]] || die "用法：./specc.sh redo <stage> <需求ID>"
      require_init
      local fdir; fdir="$(require_feature "$fid")"
      pipeline_redo "$stage" "$fdir"
      ;;
    strip)
      shift
      cmd_strip "$@"
      ;;
    approve|reject)
      # 异步审批命令：人工审查产物后通过/否决（配合人工检查点异步模式）
      shift
      local fid="${1:-}" opinion="${2:-}"
      [[ -n "$fid" ]] || die "用法：./specc.sh approve|reject <需求ID> [意见]"
      require_init
      local fdir; fdir="$(require_feature "$fid")"
      pipeline_review "$cmd" "$fdir" "$opinion"
      ;;
    probe)
      shift; cmd_probe "$@" ;;
    specify|clarify|visual|plan|tasks|implement|verify)
      local stage="$cmd"; shift
      local fid="${1:-}"
      require_init
      local fdir; fdir="$(require_feature "$fid")"
      pipeline_run_stage "$stage" "$fdir"
      ;;
    help|-h|--help) usage ;;
    --version|-v|version) cmd_version ;;
    *) log_error "未知命令：$cmd"; echo ""; usage; exit 1 ;;
  esac
}

main "$@"
