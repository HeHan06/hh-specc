/**
 * 阅读站内容流页：三栏文档式阅读（学习目录 + 连续内容流 + 本页目录）。
 * 一个分类下的所有内容串成一篇可连续滚动的内容流，支持点赞与锚点定位。
 *
 * @orchestrate getTopics / getCategories / getContentsByCategory / getContentDetail / likeContent
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Alert, Button, Spin } from 'antd';
import {
  getCategories,
  getContentDetail,
  getContentsByCategory,
  getTopics,
  likeContent,
} from '../services/content.js';
import { getVisitorId } from '../utils/visitor.js';
import Sidebar from '../components/Sidebar.jsx';
import ContentBody from '../components/ContentBody.jsx';
import styles from './DocsPage.module.css';

const CATEGORY_PAGE_SIZE = 100;

function formatDateTime(value) {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('zh-CN');
}

// 定位当前分类所属主题与前后分类，用于面包屑与「上一篇/下一篇」。
async function resolveCategoryContext(categoryCode) {
  const topics = await getTopics();
  const groups = await Promise.all(
    topics.map(async (topic) => ({ topic, categories: await getCategories(topic.code) })),
  );
  const flat = [];
  groups.forEach(({ topic, categories }) => {
    categories.forEach((category) => flat.push({ ...category, topicName: topic.name }));
  });
  const index = flat.findIndex((category) => category.code === categoryCode);
  return {
    topicName: index >= 0 ? flat[index].topicName : '',
    categoryName: index >= 0 ? flat[index].name : '',
    prev: index > 0 ? flat[index - 1] : null,
    next: index >= 0 && index < flat.length - 1 ? flat[index + 1] : null,
  };
}

export default function DocsPage() {
  const { categoryCode } = useParams();
  const { hash } = useLocation();
  const [visitorId] = useState(() => getVisitorId());
  const [meta, setMeta] = useState(null);
  const [contents, setContents] = useState([]);
  const [details, setDetails] = useState({});
  const [status, setStatus] = useState('loading');
  const [reloadKey, setReloadKey] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('');
  const [likePending, setLikePending] = useState({});

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setStatus('loading');
      try {
        const [context, contentsPage] = await Promise.all([
          resolveCategoryContext(categoryCode),
          getContentsByCategory({ categoryCode, pageNum: 1, pageSize: CATEGORY_PAGE_SIZE }),
        ]);
        if (cancelled) {
          return;
        }
        const list = contentsPage?.list ?? [];
        setMeta(context);
        setContents(list);
        const entries = await Promise.all(
          list.map(async (item) => [item.code, await getContentDetail(item.code, { visitorId })]),
        );
        if (cancelled) {
          return;
        }
        setDetails(Object.fromEntries(entries));
        setStatus('success');
      } catch {
        if (!cancelled) {
          setStatus('error');
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [categoryCode, visitorId, reloadKey]);

  // 通过 URL hash 定位到指定内容小节。
  useEffect(() => {
    if (status !== 'success' || !hash) {
      return;
    }
    const element = document.getElementById(hash.slice(1));
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [hash, status]);

  // 滚动时高亮当前内容小节对应的本页目录项。
  useEffect(() => {
    if (status !== 'success') {
      return;
    }
    const ids = contents.map((item) => item.code);
    function onScroll() {
      let current = ids[0] ?? '';
      ids.forEach((id) => {
        const element = document.getElementById(id);
        if (element && element.getBoundingClientRect().top <= 120) {
          current = id;
        }
      });
      setActiveSection(current);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [contents, status]);

  const scrollTo = useCallback((id) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  async function handleLike(code) {
    if (likePending[code] || !details[code] || details[code].liked) {
      return;
    }
    setLikePending((previous) => ({ ...previous, [code]: true }));
    try {
      const result = await likeContent(code, visitorId);
      setDetails((previous) => {
        const current = previous[code];
        if (!current) {
          return previous;
        }
        return {
          ...previous,
          [code]: { ...current, liked: true, likeCount: result?.likeCount ?? current.likeCount },
        };
      });
    } catch {
      // 点赞失败静默忽略，不打断阅读。
    } finally {
      setLikePending((previous) => ({ ...previous, [code]: false }));
    }
  }

  if (status === 'loading') {
    return (
      <div className={styles.center}>
        <Spin data-testid="docs-loading" />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className={styles.center}>
        <Alert type="error" message="加载失败，请重试" showIcon />
        <Button type="primary" autoInsertSpace={false} onClick={() => setReloadKey((key) => key + 1)}>重试</Button>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.mobileBar}>
        <button
          type="button"
          className={styles.menuBtn}
          onClick={() => setSidebarOpen(true)}
          aria-label="打开目录"
        >
          ☰
        </button>
        <span className={styles.mobileTitle}>{meta?.categoryName}</span>
      </div>
      {sidebarOpen ? <div className={styles.overlay} onClick={() => setSidebarOpen(false)} /> : null}
      <div className={styles.reader}>
        <Sidebar activeCategoryCode={categoryCode} open={sidebarOpen} onNavigate={() => setSidebarOpen(false)} />
        <article className={styles.doc}>
          <div className={styles.crumbs}>{meta?.topicName} / {meta?.categoryName}</div>
          <h1 className={styles.docTitle}>{meta?.categoryName}</h1>
          <div className={styles.docMeta}>共 {contents.length} 个问题</div>

          {contents.map((item, index) => {
            const detail = details[item.code];
            return (
              <section key={item.code} id={item.code} className={styles.qa}>
                <div className={styles.qaHead}>
                  <span className={styles.qaNum}>{String(index + 1).padStart(2, '0')}</span>
                  <h2 className={styles.qaTitle}>{item.title}</h2>
                </div>
                {item.summary ? <p className={styles.qaSummary}>{item.summary}</p> : null}
                {detail ? (
                  <ContentBody type={detail.type} body={detail.body} />
                ) : <Spin size="small" />}
                {detail ? (
                  <div className={styles.qaFooter}>
                    {Array.isArray(detail.tags) && detail.tags.length > 0
                      ? detail.tags.map((tag) => <span key={tag} className={styles.tag}>{tag}</span>)
                      : null}
                    <span className={styles.stat}>{detail.likeCount} 赞 · {detail.viewCount} 浏览</span>
                    <button
                      type="button"
                      className={styles.likeBtn}
                      onClick={() => handleLike(item.code)}
                      disabled={detail.liked || likePending[item.code]}
                    >
                      {detail.liked ? '已点赞' : '点赞'}
                    </button>
                  </div>
                ) : null}
              </section>
            );
          })}

          <div className={styles.pager}>
            {meta?.prev
              ? (
                <Link to={`/docs/${meta.prev.code}`} className={styles.pagerLink}>
                  <span className={styles.pagerDir}>上一篇</span>
                  <span className={styles.pagerTtl}>{meta.prev.name}</span>
                </Link>
              )
              : <span />}
            {meta?.next
              ? (
                <Link to={`/docs/${meta.next.code}`} className={`${styles.pagerLink} ${styles.pagerNext}`}>
                  <span className={styles.pagerDir}>下一篇</span>
                  <span className={styles.pagerTtl}>{meta.next.name}</span>
                </Link>
              )
              : <span />}
          </div>
        </article>

        <aside className={styles.toc}>
          <p className={styles.tocTitle}>本页目录</p>
          {contents.map((item, index) => (
            <button
              key={item.code}
              type="button"
              className={item.code === activeSection ? `${styles.tocItem} ${styles.tocActive}` : styles.tocItem}
              onClick={() => scrollTo(item.code)}
            >
              <span className={styles.tocNum}>{String(index + 1).padStart(2, '0')}</span>
              {item.title}
            </button>
          ))}
        </aside>
      </div>
    </div>
  );
}
