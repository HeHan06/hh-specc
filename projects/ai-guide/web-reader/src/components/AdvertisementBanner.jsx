/**
 * 阅读站广告位横幅：仅在后台已启用且已配置广告时展示。
 * Web 无法直接跳转闲鱼/小程序，因此不做点击跳转，仅展示引流信息
 * （如微信号、公众号、搜索关键词等，由 description 承载）。
 * 未配置、未启用或加载失败时静默隐藏。
 *
 * @orchestrate getAdvertisement
 */
import { useEffect, useState } from 'react';
import { getAdvertisement } from '../services/advertisement.js';
import styles from './AdvertisementBanner.module.css';

export default function AdvertisementBanner() {
  const [advertisement, setAdvertisement] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const ad = await getAdvertisement();
        if (!cancelled && ad) {
          setAdvertisement(ad);
        }
      } catch {
        // 广告位加载失败不打断主流程，静默隐藏。
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!advertisement) {
    return null;
  }

  return (
    <div className={styles.wrap} role="note" aria-label="推广信息">
      <div className={styles.inner}>
        <span className={styles.badge}>推广</span>
        <span className={styles.title}>{advertisement.title}</span>
        {advertisement.description ? <span className={styles.desc}>{advertisement.description}</span> : null}
      </div>
    </div>
  );
}
