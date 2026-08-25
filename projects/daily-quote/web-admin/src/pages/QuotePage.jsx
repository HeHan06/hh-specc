import { useEffect, useState } from 'react';
import { getTodayQuote } from '../../../shared/api/quote.js';
import { LOCAL_FALLBACK_QUOTE } from '../../../shared/constants/quote.js';
import { formatShanghaiDate } from '../../../shared/utils/quote.js';

// Web 端 HTTP 适配器：只负责发请求并返回统一响应体，业务解包交给 shared/api/client.js。
async function fetchRequest({ path, method }) {
  const response = await fetch(path, {
    method,
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`请求失败：${response.status}`);
  }

  return response.json();
}

/**
 * @capability Req-1 当日语录展示
 * @capabilityPoint T-11 渲染今日语录卡片
 * @orchestrate from=T-11 to=T-09 rel=calls
 */
function QuotePage() {
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadQuote() {
      try {
        const data = await getTodayQuote(fetchRequest);
        if (!cancelled) {
          setQuote(data);
          setHasError(false);
        }
      } catch {
        // 接口不可用时使用本地兜底，保证页面不白屏。
        if (!cancelled) {
          setQuote({
            ...LOCAL_FALLBACK_QUOTE,
            displayDate: formatShanghaiDate(new Date()),
          });
          setHasError(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadQuote();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading || !quote) {
    return (
      <main className="quote-page">
        <p className="quote-loading">加载中...</p>
      </main>
    );
  }

  return (
    <main className="quote-page">
      <img
        className="quote-background"
        src={quote.backgroundImage}
        alt="今日语录背景图"
      />
      <div className="quote-overlay" aria-live="polite">
        <p className="quote-content">{quote.content}</p>
        <p className="quote-source">{quote.source}</p>
        <p className="quote-date">{quote.displayDate}</p>
        {hasError && <p className="quote-error-hint">内容加载失败，请稍后再试</p>}
      </div>
    </main>
  );
}

export default QuotePage;
