import { MAX_CONTENT_LENGTH } from '../constants/quote.js';

// 用 Array.from 按码点截断，避免直接 slice 把表情等代理对字符截成乱码。
export function truncateQuoteText(content, maxLength = MAX_CONTENT_LENGTH) {
  if (typeof content !== 'string') {
    return '';
  }

  if (!Number.isInteger(maxLength) || maxLength <= 0) {
    maxLength = MAX_CONTENT_LENGTH;
  }

  return Array.from(content).slice(0, maxLength).join('');
}

const SHANGHAI_TIME_ZONE = 'Asia/Shanghai';

// 日期口径由上海时区决定，不能依赖运行环境的本地时区。
export function formatShanghaiDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new TypeError('date 必须是合法 Date 对象');
  }

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: SHANGHAI_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const getPart = (type) => parts.find((part) => part.type === type)?.value || '';

  return `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
}
