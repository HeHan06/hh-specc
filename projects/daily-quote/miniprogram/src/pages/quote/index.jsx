import { useEffect, useState } from 'react';
import { Image, Text, View } from '@tarojs/components';
import { getTodayQuote } from '../../../../shared/api/quote.js';
import { LOCAL_FALLBACK_QUOTE } from '../../../../shared/constants/quote.js';
import { formatShanghaiDate } from '../../../../shared/utils/quote.js';
import { wxRequestAdapter } from '../../platform/request.js';
import './index.scss';

// 当日语录展示页：读者匿名阅读，只读、无账号入口。
function QuotePage() {
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadQuote() {
      try {
        const data = await getTodayQuote(wxRequestAdapter);
        if (!cancelled) {
          setQuote(data);
        }
      } catch {
        // 接口不可用时回退 shared 里的本地兜底，保证不白屏。
        if (!cancelled) {
          setQuote({
            ...LOCAL_FALLBACK_QUOTE,
            displayDate: formatShanghaiDate(new Date()),
          });
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
      <View className="quote-page">
        <Text className="quote-loading">加载中...</Text>
      </View>
    );
  }

  return (
    <View className="quote-page">
      <Image className="quote-background" src={quote.backgroundImage} mode="aspectFill" />
      <View className="quote-overlay">
        <Text className="quote-content">{quote.content}</Text>
        <Text className="quote-source">{quote.source}</Text>
        <Text className="quote-date">{quote.displayDate}</Text>
      </View>
    </View>
  );
}

export default QuotePage;
