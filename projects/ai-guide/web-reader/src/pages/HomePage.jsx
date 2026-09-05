/**
 * 阅读站首页：深色科技感 Hero + 热门主题 + 最近更新。
 * Hero 自带深色导航与搜索，CTA 直达首个分类内容流。
 *
 * @orchestrate getTopics / getCategories / getLatestContents
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, Button, Spin } from 'antd';
import { getCategories, getLatestContents, getStats, getTopics } from '../services/content.js';
import AdvertisementBanner from '../components/AdvertisementBanner.jsx';
import styles from './HomePage.module.css';

const INITIAL_STATE = Object.freeze({
  status: 'loading',
  topics: [],
  latest: [],
  topicEntry: {},
  firstCategoryCode: null,
  stats: { totalViews: 0, totalLikes: 0 },
});

function formatDate(value) {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('zh-CN');
}

function formatCount(value) {
  const num = Number(value);
  return Number.isNaN(num) ? 0 : num.toLocaleString('zh-CN');
}

export default function HomePage() {
  const navigate = useNavigate();
  const [state, setState] = useState(INITIAL_STATE);
  const [reloadKey, setReloadKey] = useState(0);
  const [keyword, setKeyword] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState((previous) => ({ ...previous, status: 'loading' }));
      try {
        const [topics, latestPage, stats] = await Promise.all([getTopics(), getLatestContents(), getStats()]);
        if (cancelled) {
          return;
        }
        const topicList = topics ?? [];
        const groups = await Promise.all(
          topicList.map(async (topic) => ({ topic, categories: await getCategories(topic.code) })),
        );
        if (cancelled) {
          return;
        }
        const topicEntry = {};
        groups.forEach(({ topic, categories }) => {
          topicEntry[topic.code] = categories?.[0]?.code ?? null;
        });
        setState({
          status: 'success',
          topics: topicList,
          latest: latestPage?.list ?? [],
          topicEntry,
          firstCategoryCode: groups[0]?.categories?.[0]?.code ?? null,
          stats: stats ?? { totalViews: 0, totalLikes: 0 },
        });
      } catch {
        if (!cancelled) {
          setState({ status: 'error', topics: [], latest: [], topicEntry: {}, firstCategoryCode: null, stats: { totalViews: 0, totalLikes: 0 } });
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  function handleSearch(event) {
    event.preventDefault();
    const normalized = keyword.trim();
    if (normalized) {
      navigate(`/search?keyword=${encodeURIComponent(normalized)}`);
    }
  }

  function startReading() {
    if (state.firstCategoryCode) {
      navigate(`/docs/${state.firstCategoryCode}`);
    } else {
      navigate('/search');
    }
  }

  if (state.status === 'loading') {
    return (
      <div className={styles.center}>
        <Spin data-testid="home-loading" />
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className={styles.center}>
        <Alert type="error" message="加载失败，请重试" showIcon />
        <Button type="primary" autoInsertSpace={false} onClick={() => setReloadKey((key) => key + 1)}>重试</Button>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={`${styles.glow} ${styles.glow1}`} />
        <div className={`${styles.glow} ${styles.glow2}`} />
        <div className={`${styles.glow} ${styles.glow3}`} />

        <div className={styles.heroNav}>
          <span className={styles.brand}>AI Agent 面试指南</span>
        </div>

        <div className={styles.heroBody}>
          <span className={styles.heroBadge}><span className={styles.pulse} />一手面经 · 持续沉淀 · v1.0</span>
          <h1 className={styles.heroTitle}>AI Agent 面试指南</h1>
          <p className={styles.heroSub}>把零散的一手面试经验，沉淀成可系统备考、可持续更新的知识体系。</p>
          <form className={styles.heroSearch} onSubmit={handleSearch}>
            <span className={styles.searchIco}>🔍</span>
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="搜索问题、知识点或面经…"
            />
          </form>
          <button type="button" className={styles.heroCta} onClick={startReading}>
            开始系统化阅读 →
          </button>
          <div className={styles.heroStats}>
            <div className={styles.stat}><div className={styles.num}>45</div><div className={styles.lbl}>篇内容</div></div>
            <div className={styles.stat}><div className={styles.num}>{state.topics.length}</div><div className={styles.lbl}>大主题</div></div>
            <div className={styles.stat}><div className={styles.num}>15+</div><div className={styles.lbl}>公司面经</div></div>
          </div>
          <div className={styles.heroSubStats}>
            <span className={styles.subStat}>
              <span className={styles.subIcon}>
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
              </span>
              累积访问 <b>{formatCount(state.stats.totalViews)}</b>
            </span>
            <span className={styles.subDot}>·</span>
            <span className={styles.subStat}>
              <span className={styles.subIcon}>
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" /></svg>
              </span>
              点赞 <b>{formatCount(state.stats.totalLikes)}</b>
            </span>
          </div>
        </div>
      </section>

      <AdvertisementBanner />

      <div className={styles.body}>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>热门主题</h2>
          <div className={styles.grid4}>
            {state.topics.map((topic) => {
              const entry = state.topicEntry[topic.code];
              const content = (
                <>
                  <div className={styles.topicName}>{topic.name}</div>
                  {topic.description ? <div className={styles.topicDesc}>{topic.description}</div> : null}
                </>
              );
              return entry
                ? <Link key={topic.code} to={`/docs/${entry}`} className={styles.topicCard}>{content}</Link>
                : <div key={topic.code} className={styles.topicCard}>{content}</div>;
            })}
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>最近更新</h2>
          <div className={styles.grid3}>
            {state.latest.slice(0, 6).map((item) => (
              <Link key={item.code} to={`/docs/${item.categoryCode}#${item.code}`} className={styles.updateCard}>
                <div className={styles.updateTitle}>{item.title}</div>
                {item.summary ? <div className={styles.updateDesc}>{item.summary}</div> : null}
                <div className={styles.updateMeta}>更新于 {formatDate(item.updatedAt)}</div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
