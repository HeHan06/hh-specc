/**
 * 内容正文结构化渲染：按内容类型差异化排版。
 * 分节骨架唯一源见 features/ai-guide/content-template.md。
 *
 * - question：突显「问题」「标准答案」，弱化「考察点」「关联」
 * - interview：元信息卡（面试概览）+ Q&A 卡（问题与回答）+ 复盘总结分组卡
 * - article / resume：默认 Markdown 渲染
 */
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styles from './ContentBody.module.css';

/** 按指定层级标题切分 Markdown，返回 [{ heading, body }]。 */
function splitByHeading(markdown, level) {
  const regex = new RegExp(`^#{${level}}\\s+(.*?)\\s*$`);
  const sections = [];
  const lines = String(markdown || '').split('\n');
  let current = null;
  for (const line of lines) {
    const match = line.match(regex);
    if (match) {
      current = { heading: match[1].trim(), body: '' };
      sections.push(current);
    } else if (current) {
      current.body += `${line}\n`;
    }
  }
  return sections;
}

function Md({ children }) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>;
}

/** 解析「- 标签：值」形式的概览条目，返回 [{ label, value }]。 */
function parseOverview(markdown) {
  const rows = [];
  for (const line of String(markdown || '').split('\n')) {
    const match = line.match(/^[-*]\s*(.+?)[：:]\s*(.*)$/);
    if (match) {
      rows.push({ label: match[1].trim(), value: match[2].trim() });
    }
  }
  return rows;
}

function reviewTone(heading) {
  if (/做得好|亮点/.test(heading)) {
    return styles.reviewGood;
  }
  if (/待改进|不足|翻车|问题|失分/.test(heading)) {
    return styles.reviewBad;
  }
  return styles.reviewNext;
}

function QuestionBody({ markdown }) {
  // 问题已由「序号 + 标题」标识（title 即「问题」首行），正文不再重复渲染。
  const sections = splitByHeading(markdown, 2).filter((section) => section.heading !== '问题');
  if (sections.length === 0) {
    return <div className={styles.md}><Md>{markdown}</Md></div>;
  }
  return sections.map((section, index) => {
    if (section.heading === '标准答案') {
      return (
        <section key={index} className={styles.answerCard}>
          <span className={styles.strongTag}>标准答案</span>
          <div className={`${styles.md} ${styles.answerText}`}><Md>{section.body}</Md></div>
        </section>
      );
    }
    return (
      <section key={index} className={styles.mutedCard}>
        <span className={styles.mutedTag}>{section.heading}</span>
        <div className={`${styles.md} ${styles.mutedText}`}><Md>{section.body}</Md></div>
      </section>
    );
  });
}

function InterviewBody({ markdown }) {
  const sections = splitByHeading(markdown, 2);
  if (sections.length === 0) {
    return <div className={styles.md}><Md>{markdown}</Md></div>;
  }
  return sections.map((section, index) => {
    if (section.heading === '面试概览') {
      const rows = parseOverview(section.body);
      return (
        <section key={index} className={styles.overviewCard}>
          <span className={styles.strongTag}>面试概览</span>
          <div className={styles.overviewGrid}>
            {rows.map((row) => (
              <div key={row.label} className={styles.overviewItem}>
                <span className={styles.overviewLabel}>{row.label}</span>
                <span className={styles.overviewValue}>{row.value}</span>
              </div>
            ))}
          </div>
        </section>
      );
    }
    if (section.heading === '面试问题与回答') {
      const qas = splitByHeading(section.body, 3);
      return (
        <section key={index} className={styles.blockSection}>
          <span className={styles.strongTag}>面试问题与回答</span>
          <div className={styles.qaList}>
            {qas.map((qa, j) => (
              <div key={j} className={styles.qaCard}>
                <div className={styles.qaQuestion}>{qa.heading}</div>
                <div className={`${styles.md} ${styles.qaAnswer}`}><Md>{qa.body}</Md></div>
              </div>
            ))}
          </div>
        </section>
      );
    }
    if (section.heading === '复盘总结') {
      const subs = splitByHeading(section.body, 3);
      return (
        <section key={index} className={styles.blockSection}>
          <span className={styles.strongTag}>复盘总结</span>
          <div className={styles.reviewList}>
            {subs.map((sub, j) => (
              <div key={j} className={`${styles.reviewCard} ${reviewTone(sub.heading)}`}>
                <div className={styles.reviewHeading}>{sub.heading}</div>
                <div className={`${styles.md} ${styles.reviewBody}`}><Md>{sub.body}</Md></div>
              </div>
            ))}
          </div>
        </section>
      );
    }
    return (
      <section key={index} className={styles.blockSection}>
        <span className={styles.strongTag}>{section.heading}</span>
        <div className={styles.md}><Md>{section.body}</Md></div>
      </section>
    );
  });
}

export default function ContentBody({ type, body }) {
  if (type === 'question') {
    return <QuestionBody markdown={body} />;
  }
  if (type === 'interview') {
    return <InterviewBody markdown={body} />;
  }
  return <div className={styles.md}><Md>{body}</Md></div>;
}
