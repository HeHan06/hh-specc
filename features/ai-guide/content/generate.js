// 内容清单 + seed SQL 生成器（单一真相源：content/**/*.md 的正文 Markdown）
// 用法：node features/ai-guide/content/generate.js
const fs = require('fs');
const path = require('path');

const CONTENT_DIR = path.join(__dirname);
const V2_PATH = '/Users/wangzhenxing/Documents/trae_projects/AI coding specc/projects/ai-guide/backend/src/main/resources/db/migration/V2__seed_content.sql';
const INDEX_PATH = path.join(CONTENT_DIR, '.index.md');

// 主题：code -> [name, sort_order]
const topics = [
  ['ai', 'AI', 1],
  ['backend', '后端基础知识', 2],
  ['algorithm', '算法题', 3],
  ['interview', '面试记录', 4],
  ['resume', '简历优化', 5],
];

// 分类：code -> [topic_code, name, sort_order]（sort_order 与库内已有值一致；vivo/ctrip 为新增）
const categories = [
  ['ai-agent', 'ai', 'Agent知识', 1],
  ['backend-java', 'backend', 'java基础', 1],
  ['backend-redis', 'backend', 'Redis', 2],
  ['backend-system-design', 'backend', '场景-系统设计题', 3],
  ['backend-database', 'backend', '数据库', 4],
  ['backend-mq', 'backend', '消息队列', 5],
  ['interview-pdd', 'interview', 'pdd', 2],
  ['interview-alibaba', 'interview', '阿里', 3],
  ['interview-dewu', 'interview', '得物', 4],
  ['interview-didi', 'interview', '滴滴', 5],
  ['interview-nengliang', 'interview', '能良电商', 7],
  ['interview-tencent', 'interview', '腾讯', 8],
  ['interview-tuya', 'interview', '涂鸦智能', 9],
  ['interview-weplay', 'interview', '武汉微派', 10],
  ['interview-xiaomi', 'interview', '小米', 11],
  ['interview-bytedance', 'interview', '字节', 12],
  ['interview-vivo', 'interview', 'vivo', 13],
  ['interview-ctrip', 'interview', '携程', 14],
  ['interview-netease', 'interview', '网易', 15],
  ['resume-cv', 'resume', '简历', 1],
  ['resume-prep', 'resume', '简历准备', 2],
];

// 分类 -> 领域标签
const categoryTags = {
  'ai-agent': ['Agent', '大模型'],
  'backend-java': ['Java'],
  'backend-redis': ['Redis', '缓存'],
  'backend-system-design': ['系统设计'],
  'backend-database': ['数据库'],
  'backend-mq': ['消息队列'],
  'interview-pdd': ['拼多多'],
  'interview-vivo': ['vivo'],
  'interview-bytedance': ['字节'],
  'interview-xiaomi': ['小米'],
  'interview-dewu': ['得物'],
  'interview-weplay': ['微派'],
  'interview-ctrip': ['携程'],
  'interview-netease': ['网易'],
  'interview-tuya': ['涂鸦'],
  'interview-didi': ['滴滴'],
  'interview-nengliang': ['能良电商'],
  'interview-tencent': ['腾讯'],
  'interview-alibaba': ['阿里'],
  'resume-cv': ['求职'],
  'resume-prep': ['求职准备'],
};

const typeLabels = { question: '面试题', interview: '面经', article: '教程', resume: '简历' };

// 无法从正文可靠推导标题的少数条目
const titleOverrides = {
  'resume-cv-resume-001': '候选人简历',
  'resume-prep-question-001': '简历高频问题集合',
  'resume-prep-article-001': '面试自我介绍',
  'backend-database-article-001': 'SQL 语法基础教程',
  'interview-netease-001': '网易 企业效能Agent开发',
};

function walk(dir) {
  let out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out = out.concat(walk(p));
    else if (entry.name.endsWith('.md') && entry.name !== '.index.md') out.push(p);
  }
  return out.sort();
}

function deriveType(code) {
  // 面试记录 code 形如 interview-<公司>-NNN，前缀即为类型
  if (/^interview-/.test(code)) return 'interview';
  const m = code.match(/-(question|article|resume|interview)-\d+$/);
  return m ? m[1] : null;
}

function firstLineAfter(body, heading) {
  const idx = body.indexOf(heading);
  if (idx < 0) return null;
  for (const raw of body.slice(idx + heading.length).split('\n')) {
    const s = raw.trim();
    if (!s) continue;
    if (s.startsWith('#')) continue;
    return s;
  }
  return null;
}

function clean(line) {
  return String(line)
    .replace(/^[-*]\s+/, '')
    .replace(/^\d+\.\s+/, '')
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .replace(/\[|\]|\(|\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function deriveTitle(code, type, body) {
  if (titleOverrides[code]) return titleOverrides[code];
  if (type === 'question') {
    const t = firstLineAfter(body, '## 问题');
    if (t) return clean(t).slice(0, 200);
  } else if (type === 'interview') {
    const company = (body.match(/- 公司：(.+)/) || [])[1];
    const round = (body.match(/- 轮次：(.+)/) || [])[1];
    if (company && round) return `${company.trim()} ${round.trim()}`.slice(0, 200);
    if (company) return company.trim().slice(0, 200);
  }
  return code;
}

function deriveSummary(type, body, title) {
  const heading = {
    question: '## 标准答案',
    interview: '## 面试概览',
    article: '## 概述',
    resume: '## 简历正文',
  }[type];
  const line = heading ? firstLineAfter(body, heading) : null;
  const s = line ? clean(line) : title;
  return (s || '暂无').slice(0, 80);
}

function sqlStr(s) {
  return "'" + String(s).replace(/'/g, "''") + "'";
}
function sqlTags(tags) {
  return 'ARRAY[' + tags.map((t) => sqlStr(t)).join(', ') + ']';
}

const items = [];
for (const file of walk(CONTENT_DIR)) {
  const rel = path.relative(CONTENT_DIR, file);
  const parts = rel.split(path.sep);
  const topic = parts[0];
  const category = parts[1];
  const code = path.basename(file, '.md');
  const type = deriveType(code);
  const body = fs.readFileSync(file, 'utf8');
  const title = deriveTitle(code, type, body);
  const summary = deriveSummary(type, body, title);
  const tags = [typeLabels[type], ...(categoryTags[category] || [])];
  items.push({ code, type, topic, category, title, summary, tags, body });
}

// 生成 .index.md
let indexMd = '# 内容清单（ai-guide）\n\n';
indexMd += '> 单一真相源：`content/**/*.md` 每条对应一条内容（正文 Markdown）；本索引由 `generate.js` 生成，禁止手工维护。\n\n';
indexMd += '| code | type | topic | category | title | summary | tags |\n';
indexMd += '| --- | --- | --- | --- | --- | --- | --- |\n';
for (const it of items) {
  indexMd += `| ${it.code} | ${it.type} | ${it.topic} | ${it.category} | ${it.title} | ${it.summary} | ${it.tags.join('、')} |\n`;
}

// 生成 V2 seed SQL
let sql = '';
sql += '-- V2: ai-guide 内容结构化迁移（单一真相源：features/ai-guide/content/，由 generate.js 生成）\n';
sql += '-- 说明：删除旧 migrated 内容、插入结构化 Markdown 内容；幂等（ON CONFLICT DO UPDATE）。\n';
sql += '-- 执行：Flyway 自动执行，或 psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/src/main/resources/db/migration/V2__seed_content.sql\n\n';
sql += 'BEGIN;\n\n';
sql += '-- 主题（幂等）\n';
for (const [code, name, sort] of topics) {
  sql += `INSERT INTO topic (code, name, sort_order) VALUES (${sqlStr(code)}, ${sqlStr(name)}, ${sort}) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order;\n`;
}
sql += '\n-- 分类（幂等；含新增 interview-vivo / interview-ctrip）\n';
for (const [code, topic, name, sort] of categories) {
  sql += `INSERT INTO category (code, topic_id, name, sort_order) VALUES (${sqlStr(code)}, (SELECT id FROM topic WHERE code = ${sqlStr(topic)}), ${sqlStr(name)}, ${sort}) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, topic_id = EXCLUDED.topic_id, sort_order = EXCLUDED.sort_order;\n`;
}
sql += '\n-- 移除算法题主题（用户决定从平台移除）\n';
sql += "UPDATE topic SET enabled = FALSE WHERE code = 'algorithm';\n";
sql += "UPDATE category SET enabled = FALSE WHERE code = 'algorithm-patterns';\n";
sql += '\n-- 清空旧内容（幂等重建，先清引用表再清内容）\n';
sql += "DELETE FROM tip_order WHERE content_id IN (SELECT id FROM content WHERE source = 'migrated');\n";
sql += "DELETE FROM content_like WHERE content_id IN (SELECT id FROM content WHERE source = 'migrated');\n";
sql += "DELETE FROM content WHERE source = 'migrated';\n";
sql += '\n-- 插入结构化内容\n';
for (const it of items) {
  sql += `INSERT INTO content (code, category_id, type, title, summary, body, tags, source, status, published_at) VALUES (\n`;
  sql += `  ${sqlStr(it.code)},\n`;
  sql += `  (SELECT id FROM category WHERE code = ${sqlStr(it.category)}),\n`;
  sql += `  ${sqlStr(it.type)},\n`;
  sql += `  ${sqlStr(it.title)},\n`;
  sql += `  ${sqlStr(it.summary)},\n`;
  sql += `  ${sqlStr(it.body)},\n`;
  sql += `  ${sqlTags(it.tags)},\n`;
  sql += `  'migrated',\n`;
  sql += `  'published',\n`;
  sql += `  CURRENT_TIMESTAMP\n`;
  sql += `) ON CONFLICT (code) DO UPDATE SET type = EXCLUDED.type, category_id = EXCLUDED.category_id, title = EXCLUDED.title, summary = EXCLUDED.summary, body = EXCLUDED.body, tags = EXCLUDED.tags, published_at = CURRENT_TIMESTAMP;\n`;
}
sql += '\nCOMMIT;\n';

fs.writeFileSync(INDEX_PATH, indexMd, 'utf8');
fs.writeFileSync(V2_PATH, sql, 'utf8');
console.log(`items=${items.length}`);
console.log(`index=${INDEX_PATH}`);
console.log(`v2=${V2_PATH}`);
