/**
 * 阅读站布局骨架：顶部导航 + 内容区 + 页脚。
 * 首页使用自带深色导航的 Hero，不渲染全局导航；其余页面渲染吸顶白色导航。
 *
 * @capability Req-1 阅读站应用入口
 */
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Layout } from 'antd';
import styles from './ReaderLayout.module.css';

const NAV_ITEMS = [
  { to: '/', label: '首页', end: true },
  { to: '/search', label: '搜索' },
  { to: '/tip', label: '打赏' },
  { to: '/consultation', label: '付费咨询' },
];

export default function ReaderLayout() {
  const location = useLocation();
  const isHome = location.pathname === '/';

  return (
    <Layout className={styles.layout}>
      {!isHome ? (
        <header className={styles.navbar}>
          <div className={styles.navbarInner}>
            <Link to="/" className={styles.brand}>
              <span className={styles.brandMark} aria-hidden="true" />
              AI Agent 面试指南
            </Link>
            <nav className={styles.nav} aria-label="主导航">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => (isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink)}
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
        </header>
      ) : null}

      <main className={styles.main}>
        <Outlet />
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerCols}>
            <div>
              <h4>内容</h4>
              <Link to="/">首页</Link>
              <Link to="/search">内容搜索</Link>
            </div>
            <div>
              <h4>互动</h4>
              <Link to="/tip">打赏支持</Link>
              <Link to="/consultation">付费咨询</Link>
            </div>
          </div>
          <div className={styles.footerBottom}>© 2026 AI Agent 面试指南 · 沉淀你的面试知识体系</div>
        </div>
      </footer>
    </Layout>
  );
}
