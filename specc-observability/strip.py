#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""hh-specc 可观测性注解剥离器（交付前清理）。

移除业务代码中「仅用于可观测性」的标签，不触碰任何业务逻辑：
  - Java：删除 @Capability / @CapabilityPoint / @Orchestrate 注解行，
    以及对应的 import com.hhspecc.observability.* 行
  - JS/JSX：删除 JSDoc 块内的 @capability / @capabilityPoint / @orchestrate 标签行；
    若删除后 JSDoc 块只剩空壳（/** 与 */ 与 * 空白），则连块一起删除

安全性设计：
  - 注解保留策略为 SOURCE，删除后业务编译零影响（注解本就未进字节码）
  - JSDoc 为纯注释，删除后运行零影响
  - 只做「删标签」，保留其它注释与全部代码

用法：
  python3 strip.py <目标目录> [--dry-run | --apply]
  默认 --dry-run（只预览 diff，不写文件）。
"""

import os
import re
import sys
import difflib

# ---- 匹配规则 ----
# Java 注解：@Capability / @CapabilityPoint / @Orchestrate（行首允许缩进）
JAVA_ANNOTATION_RE = re.compile(r'^\s*@(Capability|CapabilityPoint|Orchestrate)\b')
# Java 导入：逐个 import 与通配符 import 都覆盖
JAVA_IMPORT_RE = re.compile(r'^\s*import\s+com\.hhspecc\.observability\.[A-Za-z*]+;')

# JS JSDoc 标签：先精确 capabilityPoint，再 capability（\b 已避免误配，这里顺序双保险）
JS_TAG_RE = re.compile(r'@(capabilityPoint|capability|orchestrate)\b')

JAVA_EXTS = ('.java',)
JS_EXTS = ('.js', '.jsx')


def is_js_tag_line(line):
    """判断一行是否为需删除的 JSDoc 标签行（忽略行首空白与 * 前缀）。"""
    s = line.strip()
    if s.startswith('*'):
        s = s[1:].strip()
    return bool(JS_TAG_RE.match(s))


def is_empty_jsdoc(block):
    """判断一个 JSDoc 块删完标签后是否只剩空壳（无任何实质描述）。"""
    for line in block:
        s = line.strip()
        if s in ('/**', '*/'):
            continue
        if s.startswith('*'):
            s = s[1:].strip()
        if s != '':
            return False
    return True


def process_java_lines(lines):
    """Java：删除注解行与 observability import 行。"""
    return [
        l for l in lines
        if not JAVA_ANNOTATION_RE.match(l) and not JAVA_IMPORT_RE.match(l)
    ]


def process_js_lines(lines):
    """JS/JSX：删除 JSDoc 块内标签行；块删空则整块删除。"""
    out = []
    i = 0
    n = len(lines)
    while i < n:
        line = lines[i]
        if line.strip().startswith('/**'):
            # 收集 JSDoc 块（/** 到 */，可能单行或多行）
            block = [line]
            i += 1
            if '*/' not in line:
                while i < n and '*/' not in lines[i]:
                    block.append(lines[i])
                    i += 1
                if i < n:
                    block.append(lines[i])
                    i += 1
            # 块内删标签行
            new_block = [b for b in block if not is_js_tag_line(b)]
            if not is_empty_jsdoc(new_block):
                out.extend(new_block)
            # 空壳块直接丢弃
        else:
            out.append(line)
            i += 1
    return out


def process_file(path):
    """处理单个文件，返回新行列表；无改动返回 None。"""
    try:
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
    except (OSError, UnicodeDecodeError) as e:
        print(f'[跳过] 无法读取 {path}：{e}', file=sys.stderr)
        return None

    lines = content.split('\n')
    ext = os.path.splitext(path)[1].lower()

    if ext in JAVA_EXTS:
        new_lines = process_java_lines(lines)
    elif ext in JS_EXTS:
        new_lines = process_js_lines(lines)
    else:
        return None

    return new_lines if new_lines != lines else None


def iter_target_files(root):
    """递归收集目标文件（.java / .js / .jsx），跳过隐藏目录与 node_modules/target。"""
    skip_dirs = {'.git', 'node_modules', 'target', 'dist', '.specc-cache'}
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in skip_dirs]
        for fn in filenames:
            if fn.endswith(JAVA_EXTS + JS_EXTS):
                yield os.path.join(dirpath, fn)


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    root = sys.argv[1]
    mode = '--dry-run'
    if '--apply' in sys.argv[2:]:
        mode = '--apply'

    if not os.path.isdir(root):
        print(f'[失败] 目录不存在：{root}', file=sys.stderr)
        sys.exit(1)

    changed_files = []
    total_removed = 0
    diffs = []

    for path in sorted(iter_target_files(root)):
        new_lines = process_file(path)
        if new_lines is None:
            continue
        with open(path, 'r', encoding='utf-8') as f:
            old_content = f.read()
        old_lines = old_content.split('\n')
        removed = len(old_lines) - len(new_lines)
        total_removed += removed
        changed_files.append(path)
        diffs.append((path, old_lines, new_lines))

    if not changed_files:
        print('[通过] 未发现可观测性注解/标签，无需清理')
        return 0

    rel = lambda p: os.path.relpath(p, root)
    if mode == '--apply':
        for path in changed_files:
            new_lines = process_file(path)
            with open(path, 'w', encoding='utf-8') as f:
                f.write('\n'.join(new_lines))
        print(f'[通过] 已清理 {len(changed_files)} 个文件，移除 {total_removed} 行注解/标签')
        for p in changed_files:
            print(f'  - {rel(p)}')
        print('\n提示：清理仅移除可观测性注解/标签，业务逻辑未变。建议重新执行测试/编译以确认。')
    else:
        print(f'[预览] 将清理 {len(changed_files)} 个文件，移除 {total_removed} 行注解/标签（未写入）')
        print(f'  加 --apply 参数实际执行。\n')
        for path, old_lines, new_lines in diffs:
            print(f'--- {rel(path)}')
            diff = difflib.unified_diff(
                old_lines, new_lines,
                fromfile=rel(path), tofile=rel(path),
                lineterm='')
            for line in diff:
                print(line)
            print()

    return 0


if __name__ == '__main__':
    sys.exit(main())
