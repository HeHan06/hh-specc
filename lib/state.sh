#!/usr/bin/env bash
# ============================================================
# lib/state.sh —— M8 状态与检查点管理
# 职责：以 features/<需求ID>/state.json 为单一事实来源，
#       记录阶段状态、门禁结果、任务进度与审查历史（审计链）。
# 实现：JSON 读写借助 macOS 自带的 python3，保持结构可靠；
#       无 python3 时报错退出（macOS 默认自带）。
# ============================================================

source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

# 八阶段固定顺序（全流程 full profile）
# probe：需求探询（新增）——先补全用户「能说的」，再让 specify 基于完整需求生成真规格；
# clarify：改为「信息完整后」的补盲/评审（用户忽略的点），不再是救草稿。
# visual：全页面视觉确认（新增）——clarify 后、plan 前，仅当模型判定「涉及新的前端视觉/交互」才执行（frontend-scope.md），纯后端/无新视觉交互自动跳过。
SPECC_STAGES=(probe specify clarify visual plan tasks implement verify)

# ---- 内部：确认 python3 可用 ----
_require_python() {
  command -v python3 >/dev/null 2>&1 || die "缺少 python3（macOS 应自带，请检查环境）"
}

# ---- 初始化某需求的 state.json ----
state_init() {
  _require_python
  local fdir="$1" fid="$2"
  python3 - "$fdir/state.json" "$fid" <<'PYEOF'
import json, sys, datetime
path, fid = sys.argv[1], sys.argv[2]
stages = ["probe", "specify", "clarify", "visual", "plan", "tasks", "implement", "verify"]
data = {
    "feature": fid,                                  # 需求ID
    "created_at": datetime.datetime.now().isoformat(timespec="seconds"),
    "stage": "probe",                                # 当前所处阶段
    "gates": {s: "pending" for s in stages},         # 各阶段门禁状态
    "tasks": {},                                     # implement 阶段任务进度
    "history": []                                    # 审计链：事件与人工审查记录
}
json.dump(data, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
PYEOF
}

# ---- 读取 state 字段（点路径，如 gates.plan / stage）----
state_get() {
  _require_python
  local fdir="$1" dotpath="$2"
  python3 - "$fdir/state.json" "$dotpath" <<'PYEOF'
import json, sys
data = json.load(open(sys.argv[1], encoding="utf-8"))
cur = data
for k in sys.argv[2].split("."):
    if isinstance(cur, dict) and k in cur:
        cur = cur[k]
    else:
        print("")
        sys.exit(0)
print(cur if isinstance(cur, str) else json.dumps(cur, ensure_ascii=False))
PYEOF
}

# ---- 写入 state 字段（点路径，值为字符串）----
state_set() {
  _require_python
  local fdir="$1" dotpath="$2" value="$3"
  python3 - "$fdir/state.json" "$dotpath" "$value" <<'PYEOF'
import json, sys
path, dotpath, value = sys.argv[1], sys.argv[2], sys.argv[3]
data = json.load(open(path, encoding="utf-8"))
keys = dotpath.split(".")
cur = data
for k in keys[:-1]:
    cur = cur.setdefault(k, {})
cur[keys[-1]] = value
json.dump(data, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
PYEOF
}

# ---- 追加审计记录（人工审查决策、阶段通过/失败等均留痕）----
state_history_add() {
  _require_python
  local fdir="$1" text="$2"
  python3 - "$fdir/state.json" "$text" <<'PYEOF'
import json, sys, datetime
path, text = sys.argv[1], sys.argv[2]
data = json.load(open(path, encoding="utf-8"))
data.setdefault("history", []).append({
    "ts": datetime.datetime.now().isoformat(timespec="seconds"),
    "text": text
})
json.dump(data, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
PYEOF
}

# ---- 上一阶段名（specify 无前驱，输出空）----
prev_stage() {
  local target="$1" prev=""
  for s in "${SPECC_STAGES[@]}"; do
    [[ "$s" == "$target" ]] && { echo "$prev"; return; }
    prev="$s"
  done
  echo ""
}

# ---- 阶段顺序号（用于 redo 重置「本阶段及之后」）----
stage_index() {
  local target="$1" i=0
  for s in "${SPECC_STAGES[@]}"; do
    [[ "$s" == "$target" ]] && { echo "$i"; return; }
    i=$((i + 1))
  done
  echo "-1"
}
