/**
 * 阅读站学习目录侧边栏：主题 → 分类 两层树。
 * 主题与分类一次性加载；点击分类直接进入内容流（问题导航由右侧本页目录承担）。
 * 桌面端作为三栏布局左列；移动端收为抽屉（由 open 控制滑入）。
 *
 * @capability Req-1 阅读站内容目录
 * @orchestrate getTopics / getCategories
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Spin } from 'antd';
import { getCategories, getTopics } from '../services/content.js';
import styles from './Sidebar.module.css';

export default function Sidebar({ activeCategoryCode, open, onNavigate }) {
  const navigate = useNavigate();
  const [topics, setTopics] = useState([]);
  const [categoriesMap, setCategoriesMap] = useState({});
  const [expandedTopics, setExpandedTopics] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  function go(path) {
    if (onNavigate) {
      onNavigate();
    }
    navigate(path);
  }

  useEffect(() => {
    let cancelled = false;

    async function loadInitial() {
      setLoading(true);
      setError(false);
      try {
        const topicList = await getTopics();
        if (cancelled) {
          return;
        }
        setTopics(topicList);
        const entries = await Promise.all(
          topicList.map(async (topic) => [topic.code, await getCategories(topic.code)]),
        );
        if (cancelled) {
          return;
        }
        setCategoriesMap(Object.fromEntries(entries));
      } catch {
        if (!cancelled) {
          setError(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadInitial();
    return () => {
      cancelled = true;
    };
  }, []);

  // 当前分类变化时，自动展开所属主题，保证当前项始终可见。
  useEffect(() => {
    if (!activeCategoryCode) {
      return;
    }
    let activeTopicCode = null;
    Object.entries(categoriesMap).forEach(([topicCode, categories]) => {
      if (categories.some((category) => category.code === activeCategoryCode)) {
        activeTopicCode = topicCode;
      }
    });
    if (!activeTopicCode) {
      return;
    }
    setExpandedTopics((previous) => ({ ...previous, [activeTopicCode]: true }));
  }, [activeCategoryCode, categoriesMap]);

  function toggleTopic(topicCode) {
    setExpandedTopics((previous) => ({ ...previous, [topicCode]: !previous[topicCode] }));
  }

  const className = open ? `${styles.sidebar} ${styles.open}` : styles.sidebar;

  if (loading) {
    return (
      <div className={className}>
        <div className={styles.loading}>
          <Spin data-testid="sidebar-loading" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={className}>
        <div className={styles.error}>目录加载失败</div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className={styles.caption}>学习目录</div>
      <nav aria-label="学习目录">
        {topics.map((topic) => {
          const topicOpen = !!expandedTopics[topic.code];
          const categories = categoriesMap[topic.code] ?? [];
          return (
            <div key={topic.code} className={styles.group}>
              <button
                type="button"
                className={styles.topicBtn}
                onClick={() => toggleTopic(topic.code)}
                aria-expanded={topicOpen}
              >
                <span className={styles.arrow}>{topicOpen ? '▾' : '▸'}</span>
                <span className={styles.topicName}>{topic.name}</span>
              </button>
              {topicOpen
                ? categories.map((category) => {
                    const active = activeCategoryCode === category.code;
                    return (
                      <button
                        key={category.code}
                        type="button"
                        className={`${styles.categoryBtn} ${active ? styles.categoryActive : ''}`}
                        onClick={() => go(`/docs/${category.code}`)}
                      >
                        <span className={styles.categoryName}>{category.name}</span>
                      </button>
                    );
                  })
                : null}
            </div>
          );
        })}
      </nav>
    </div>
  );
}
