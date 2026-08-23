// 双端共用的业务常量只在这里维护，避免 Web 与小程序各自定义后漂移。
export const MAX_CONTENT_LENGTH = 60;

export const QUOTE_TODAY_PATH = '/api/quotes/today';

// 接口失败时的本地兜底内容，保证双端在无网络/无响应时都不白屏。
export const LOCAL_FALLBACK_QUOTE = Object.freeze({
  content: '人生自苦，他人难悟，唯有自爱，方能自渡',
  source: '《自渡》—— 佚名',
  backgroundImage: '/assets/images/fallback-bg.png',
});
