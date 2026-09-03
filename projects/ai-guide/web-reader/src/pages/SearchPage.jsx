/**
 * 阅读站搜索页：按标题、摘要、标签检索已发布内容。
 * 支持从 URL query（keyword）进入并自动搜索；结果点击直达对应内容流。
 *
 * @capability Req-2 内容搜索
 * @orchestrate searchContents
 */
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Alert, Button, Empty, Input, Spin } from 'antd';
import { isValidSearchKeyword } from '@shared/utils/validate.js';
import { searchContents } from '../services/content.js';
import styles from './SearchPage.module.css';

const PAGE_SIZE = 20;
const IDLE_STATE = Object.freeze({ status: 'idle', items: [], submittedKeyword: '' });

function SearchResults({ items }) {
  return (
    <ul className={styles.grid}>
      {items.map((item) => (
        <li key={item.code} data-testid="search-result-item" className={styles.card}>
          <Link to={`/docs/${item.categoryCode}#${item.code}`} className={styles.cardTitle}>{item.title}</Link>
          <p className={styles.cardDesc}>{item.summary}</p>
        </li>
      ))}
    </ul>
  );
}

export default function SearchPage() {
  const [searchParams] = useSearchParams();
  const initialKeyword = searchParams.get('keyword') ?? '';
  const [keyword, setKeyword] = useState(initialKeyword);
  const [validationError, setValidationError] = useState('');
  const [state, setState] = useState(IDLE_STATE);

  async function runSearch(submittedKeyword) {
    setState({ status: 'loading', items: [], submittedKeyword });
    try {
      const page = await searchContents({ keyword: submittedKeyword, pageNum: 1, pageSize: PAGE_SIZE });
      setState({ status: 'success', items: page?.list ?? [], submittedKeyword });
    } catch {
      setState({ status: 'error', items: [], submittedKeyword });
    }
  }

  useEffect(() => {
    if (initialKeyword) {
      runSearch(initialKeyword);
    }
    // 仅在首次进入（query 变化）时自动搜索，避免把 runSearch 纳入依赖造成循环。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialKeyword]);

  function handleSubmit(event) {
    event.preventDefault();
    const normalized = keyword.trim();
    if (!isValidSearchKeyword(normalized)) {
      setValidationError('请输入 1-50 个字符的关键词');
      setState(IDLE_STATE);
      return;
    }

    setValidationError('');
    runSearch(normalized);
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>搜索</h1>
        <p className={styles.subtitle}>按标题、摘要或标签，检索已发布的内容</p>
      </header>

      <div className={styles.body}>
        <form className={styles.searchBar} onSubmit={handleSubmit} noValidate>
          <Input
            className={styles.input}
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="请输入关键词"
            aria-label="关键词"
          />
          <Button type="primary" htmlType="submit" className={styles.searchBtn} autoInsertSpace={false}>搜索</Button>
        </form>

        {validationError ? <Alert type="error" message={validationError} showIcon /> : null}
        {state.status === 'loading' ? (
          <div className={styles.center}>
            <Spin data-testid="search-loading" />
          </div>
        ) : null}
        {state.status === 'error' ? (
          <div className={styles.center}>
            <Alert type="error" message="加载失败，请重试" showIcon />
            <Button type="primary" className={styles.retry} autoInsertSpace={false} onClick={() => runSearch(state.submittedKeyword)}>
              重试
            </Button>
          </div>
        ) : null}
        {state.status === 'success' && state.items.length === 0 ? (
          <Empty description="暂无搜索结果" />
        ) : null}
        {state.status === 'success' && state.items.length > 0 ? (
          <SearchResults items={state.items} />
        ) : null}
      </div>
    </div>
  );
}
