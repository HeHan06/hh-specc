/**
 * 解析导入的 Markdown 文档，产出内容草稿字段（type/title/summary/body/tags）。
 *
 * 解析规则与 features/ai-guide/content/generate.js 保持一致：
 * - type 由文件名推导（`-question` / `-article` / `-resume` / `-interview` 后缀，或 `interview-` 前缀）；
 * - title 优先取一级标题 `# `，否则按类型从固定分节抽取；
 * - summary 按类型从对应分节首行抽取（≤ 80 字）；
 * - body 为文档全文；tags 先给类型标签，领域标签由用户在表单中补充。
 */

const TYPE_LABELS = {
  algorithm: '算法题模板',
  question: '面试题',
  interview: '面经',
  article: '教程',
  resume: '简历',
};

const SUMMARY_HEADING = {
  question: '## 标准答案',
  interview: '## 面试概览',
  article: '## 概述',
  resume: '## 简历正文',
};

function deriveType(fileName) {
  if (/^interview-/.test(fileName)) {
    return 'interview';
  }
  const matched = fileName.match(/-(question|article|resume|interview|algorithm)\b/);
  return matched ? matched[1] : 'article';
}

function firstLineAfter(body, heading) {
  const index = body.indexOf(heading);
  if (index < 0) {
    return null;
  }
  for (const raw of body.slice(index + heading.length).split('\n')) {
    const line = raw.trim();
    if (!line) {
      continue;
    }
    if (line.startsWith('#')) {
      continue;
    }
    return line;
  }
  return null;
}

function clean(line) {
  return String(line)
    .replace(/^[-*]\s+/, '')
    .replace(/^\d+\.\s+/, '')
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .replace(/[()[\]{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function deriveTitle(type, body, fileName) {
  const headingMatch = body.match(/^#\s+(.+)$/m);
  if (headingMatch) {
    return clean(headingMatch[1]).slice(0, 200);
  }
  if (type === 'question') {
    const line = firstLineAfter(body, '## 问题');
    if (line) {
      return clean(line).slice(0, 200);
    }
  }
  if (type === 'interview') {
    const company = (body.match(/- 公司：(.+)/) || [])[1];
    const round = (body.match(/- 轮次：(.+)/) || [])[1];
    if (company && round) {
      return `${company.trim()} ${round.trim()}`.slice(0, 200);
    }
    if (company) {
      return company.trim().slice(0, 200);
    }
  }
  return fileName.replace(/\.(md|markdown)$/i, '');
}

function deriveSummary(type, body, title) {
  const heading = SUMMARY_HEADING[type];
  const line = heading ? firstLineAfter(body, heading) : null;
  const summary = line ? clean(line) : title;
  return (summary || '暂无').slice(0, 80);
}

export function parseMarkdownContent(fileName, body) {
  const type = deriveType(fileName);
  const title = deriveTitle(type, body, fileName);
  const summary = deriveSummary(type, body, title);
  const tags = [TYPE_LABELS[type]];
  return { type, title, summary, body, tags };
}
