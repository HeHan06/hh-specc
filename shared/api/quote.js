import { createApiClient } from './client.js';
import { QUOTE_TODAY_PATH } from '../constants/quote.js';

// 固定返回契约四字段，屏蔽后端可能的附加字段，保证双端消费结构稳定。
export async function getTodayQuote(request) {
  const data = await createApiClient(request).get(QUOTE_TODAY_PATH);

  return {
    content: data?.content,
    source: data?.source,
    backgroundImage: data?.backgroundImage,
    displayDate: data?.displayDate,
  };
}
