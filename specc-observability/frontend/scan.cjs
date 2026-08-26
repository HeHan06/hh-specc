#!/usr/bin/env node
// hh-specc 前端可观测性扫描器（MVP）。
//
// 对标后端 Java APT（specc-observability 的 CodeGraphProcessor）：
// 扫描 JSX/JS 源码里函数/组件上方的 JSDoc 标签，产出 code-graph.json 与 code-graph.mmd，
// 供 verify 阶段与人工 review 快速理解前端代码的「能力/能力点/编排关系」。
//
// 与后端的关键一致性：
//   - 标签语义对齐：@capability ↔ @Capability、@capabilityPoint ↔ @CapabilityPoint、
//     @orchestrate ↔ @Orchestrate
//   - 产物字段同构：nodes(type=capability/capabilityPoint)、edges(from/to/rel)
//   - 「审查时生效、执行时不生效」：本脚本独立运行，不注入业务构建链，运行时零开销
//
// 用法：
//   node scan.cjs --feature <需求ID> --out <输出目录> <前端工程目录1> [前端工程目录2 ...]
//   每个工程目录会递归扫描 src/ 下的 .js/.jsx，合并产出同一张 DAG。
//
// 依赖解析：从每个工程目录自带的 node_modules 里 require @babel/parser/@babel/traverse，
// 因此无需为本脚本单独安装依赖。

'use strict';

const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');

const JS_EXT = /\.(js|jsx)$/;

// ---- 参数解析 ----
function parseArgs(argv) {
  const args = { feature: '', out: '', projects: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--feature') args.feature = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (!a.startsWith('--')) args.projects.push(a);
  }
  if (!args.out || args.projects.length === 0) {
    console.error('用法：node scan.cjs --feature <需求ID> --out <输出目录> <前端工程目录>...');
    process.exit(1);
  }
  return args;
}

// ---- 从工程目录解析 babel 依赖 ----
function resolveBabel(projectDir) {
  const projectRequire = createRequire(path.join(projectDir, 'package.json'));
  const parser = projectRequire('@babel/parser');
  const traverse = projectRequire('@babel/traverse').default;
  return { parser, traverse };
}

// ---- 文件遍历 ----
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return JS_EXT.test(entry.name) ? [full] : [];
  });
}

// ---- JSDoc 标签解析 ----
// 标签语法（对齐 tech-stack §6.2）：
//   @capability Req-1 当日语录展示
//   @capabilityPoint T-11 渲染今日语录卡片
//   @orchestrate from=T-11 to=T-09 rel=calls   （rel 可省略，默认 calls）
function parseTags(commentBlock) {
  const tags = { capability: null, capabilityPoint: null, orchestrate: [] };
  const lines = commentBlock.value.split('\n');
  for (const raw of lines) {
    const line = raw.replace(/^\s*\*?\s?/, '').trim();
    let m;
    if ((m = line.match(/^@capability\s+(\S+)\s+(.+)$/))) {
      tags.capability = { req: m[1], name: m[2].trim() };
    } else if ((m = line.match(/^@capabilityPoint\s+(\S+)\s+(.+)$/))) {
      tags.capabilityPoint = { task: m[1], name: m[2].trim() };
    } else if ((m = line.match(/^@orchestrate\s+from=(\S+)\s+to=(\S+)(?:\s+rel=(\S+))?$/))) {
      tags.orchestrate.push({ from: m[1], to: m[2], rel: m[3] || 'calls' });
    }
  }
  return tags;
}

// ---- 扫描单个工程，收集节点/边 ----
function scanProject(projectDir, babel, collector) {
  const srcDir = path.join(projectDir, 'src');
  if (!fs.existsSync(srcDir)) return;

  for (const file of walk(srcDir)) {
    const code = fs.readFileSync(file, 'utf8');
    let ast;
    try {
      ast = babel.parser.parse(code, {
        sourceType: 'module',
        plugins: ['jsx'],
        attachComment: true,
      });
    } catch (e) {
      console.warn(`[跳过] 无法解析 ${file}：${e.message}`);
      continue;
    }

    babel.traverse(ast, {
      enter(p) {
        const node = p.node;
        const comments = node.leadingComments;
        if (!comments) return;

        for (const c of comments) {
          if (c.type !== 'CommentBlock') continue;
          const tags = parseTags(c);
          if (!tags.capability && !tags.capabilityPoint && tags.orchestrate.length === 0) continue;

          const relFile = path.relative(projectDir, file);
          if (tags.capability) {
            collector.capabilities.set(tags.capability.req, {
              id: tags.capability.req,
              type: 'capability',
              name: tags.capability.name,
              file: relFile,
            });
          }
          if (tags.capabilityPoint) {
            collector.points.push({
              id: tags.capabilityPoint.task,
              type: 'capabilityPoint',
              name: tags.capabilityPoint.name,
              capability: tags.capability ? tags.capability.req : '',
              file: relFile,
            });
          }
          for (const e of tags.orchestrate) {
            collector.edges.push({ from: e.from, to: e.to, rel: e.rel });
          }
        }
      },
    });
  }
}

// ---- 输出 JSON（与后端 CodeGraphProcessor 同构）----
function writeJson(file, feature, collector) {
  const nodes = [...collector.capabilities.values(), ...collector.points];
  const obj = {
    feature,
    generatedAt: new Date().toISOString(),
    nodes,
    edges: collector.edges,
  };
  fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

// ---- 输出 Mermaid（与后端同构）----
function writeMermaid(file, collector) {
  const lines = ['%% hh-specc 可观测 DAG（由前端扫描器生成，勿手改）', 'graph TD'];
  for (const n of collector.capabilities.values()) {
    lines.push(`  ${n.id}["${n.name}<br/>${n.id} · capability"]`);
  }
  for (const n of collector.points) {
    lines.push(`  ${n.id}["${n.name}<br/>${n.id} · capabilityPoint"]`);
  }
  for (const n of collector.points) {
    if (n.capability && collector.capabilities.has(n.capability)) {
      lines.push(`  ${n.capability} --> ${n.id}`);
    }
  }
  for (const e of collector.edges) {
    lines.push(`  ${e.from} -->|${e.rel}| ${e.to}`);
  }
  fs.writeFileSync(file, lines.join('\n') + '\n', 'utf8');
}

// ---- main ----
function main() {
  const args = parseArgs(process.argv.slice(2));
  const collector = { capabilities: new Map(), points: [], edges: [] };

  for (const projectDir of args.projects) {
    const abs = path.resolve(projectDir);
    if (!fs.existsSync(path.join(abs, 'package.json'))) {
      console.warn(`[跳过] 非前端工程（无 package.json）：${abs}`);
      continue;
    }
    // 依赖可能未安装（如 shared 纯逻辑层无 @babel/parser），跳过而非中断整个扫描
    let babel;
    try {
      babel = resolveBabel(abs);
    } catch (e) {
      console.warn(`[跳过] 缺少 @babel/parser/@babel/traverse 依赖：${abs}`);
      continue;
    }
    scanProject(abs, babel, collector);
  }

  fs.mkdirSync(args.out, { recursive: true });
  writeJson(path.join(args.out, 'code-graph.json'), args.feature, collector);
  writeMermaid(path.join(args.out, 'code-graph.mmd'), collector);

  console.log(`[通过] 前端 DAG 已生成：${path.resolve(args.out)}`);
  console.log(`  能力节点 ${collector.capabilities.size} 个，能力点 ${collector.points.length} 个，编排边 ${collector.edges.length} 条`);
}

main();
