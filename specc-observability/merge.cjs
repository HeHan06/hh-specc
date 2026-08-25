#!/usr/bin/env node
// hh-specc 跨端可观测性 DAG 合并器（MVP）。
//
// 后端 APT 产物（backend/target/observability/code-graph.json）与前端扫描器产物
// （target/observability-frontend/code-graph.json）各是一张局部图。两者通过
// 「前端能力点 --> 后端接口能力点（@orchestrate 指向 T-09）」衔接，按节点 id
// 合并即可得到「前端页面 → 后端接口 → 服务层」的完整调用链。
//
// 用法：
//   node merge.cjs --feature <需求ID> --out <输出目录> <code-graph.json 1> [<code-graph.json 2> ...]
// 按传入顺序合并；同名 id 的 capability/capabilityPoint 保留首个，edges 按 from|to|rel 去重。

'use strict';

const fs = require('fs');
const path = require('path');

// ---- 参数解析 ----
function parseArgs(argv) {
  const args = { feature: '', out: '', graphs: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--feature') args.feature = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (!a.startsWith('--')) args.graphs.push(a);
  }
  if (!args.out || args.graphs.length === 0) {
    console.error('用法：node merge.cjs --feature <需求ID> --out <输出目录> <code-graph.json>...');
    process.exit(1);
  }
  return args;
}

// ---- 读取一张图 ----
function readGraph(file) {
  if (!fs.existsSync(file)) {
    console.warn(`[跳过] 不存在：${file}`);
    return null;
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// ---- 合并 ----
function merge(graphs) {
  const capabilities = new Map(); // id -> node
  const points = new Map(); // id -> node
  const edges = new Map(); // `${from}|${to}|${rel}` -> edge

  for (const g of graphs) {
    if (!g) continue;
    for (const n of g.nodes || []) {
      if (n.type === 'capability') {
        if (!capabilities.has(n.id)) capabilities.set(n.id, n);
      } else if (n.type === 'capabilityPoint') {
        if (!points.has(n.id)) points.set(n.id, n);
      }
    }
    for (const e of g.edges || []) {
      const key = `${e.from}|${e.to}|${e.rel}`;
      if (!edges.has(key)) edges.set(key, e);
    }
  }

  return {
    nodes: [...capabilities.values(), ...points.values()],
    edges: [...edges.values()],
  };
}

// ---- 输出 JSON ----
function writeJson(file, feature, merged) {
  const obj = {
    feature,
    generatedAt: new Date().toISOString(),
    nodes: merged.nodes,
    edges: merged.edges,
  };
  fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

// ---- 输出 Mermaid ----
function writeMermaid(file, merged) {
  const capabilities = merged.nodes.filter((n) => n.type === 'capability');
  const points = merged.nodes.filter((n) => n.type === 'capabilityPoint');
  const capIds = new Set(capabilities.map((n) => n.id));

  const lines = ['%% hh-specc 跨端可观测 DAG（由合并器生成，勿手改）', 'graph TD'];
  for (const n of capabilities) {
    lines.push(`  ${n.id}["${n.name}<br/>${n.id} · capability"]`);
  }
  for (const n of points) {
    lines.push(`  ${n.id}["${n.name}<br/>${n.id} · capabilityPoint"]`);
  }
  for (const n of points) {
    if (n.capability && capIds.has(n.capability)) {
      lines.push(`  ${n.capability} --> ${n.id}`);
    }
  }
  for (const e of merged.edges) {
    lines.push(`  ${e.from} -->|${e.rel}| ${e.to}`);
  }
  fs.writeFileSync(file, lines.join('\n') + '\n', 'utf8');
}

// ---- main ----
function main() {
  const args = parseArgs(process.argv.slice(2));
  const graphs = args.graphs.map((f) => readGraph(path.resolve(f)));
  const merged = merge(graphs);

  fs.mkdirSync(args.out, { recursive: true });
  writeJson(path.join(args.out, 'code-graph.json'), args.feature, merged);
  writeMermaid(path.join(args.out, 'code-graph.mmd'), merged);

  console.log(`[通过] 跨端 DAG 已合并：${path.resolve(args.out)}`);
  console.log(`  能力节点 ${merged.nodes.filter((n) => n.type === 'capability').length} 个，能力点 ${merged.nodes.filter((n) => n.type === 'capabilityPoint').length} 个，编排边 ${merged.edges.length} 条`);
}

main();
