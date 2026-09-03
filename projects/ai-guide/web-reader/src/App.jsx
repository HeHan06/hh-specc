/**
 * 阅读站路由装配。文档式阅读统一走 `/docs/:categoryCode`（三栏内容流），
 * 主题/分类/单条内容页已被内容流页取代。
 *
 * @capability Req-1 阅读站内容目录
 */
import { Route, Routes } from 'react-router-dom';
import ReaderLayout from './layouts/ReaderLayout.jsx';
import HomePage from './pages/HomePage.jsx';
import DocsPage from './pages/DocsPage.jsx';
import SearchPage from './pages/SearchPage.jsx';
import TipPage from './pages/TipPage.jsx';
import ConsultationPage from './pages/ConsultationPage.jsx';
import OrderStatusPage from './pages/OrderStatusPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<ReaderLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/docs/:categoryCode" element={<DocsPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/tip" element={<TipPage />} />
        <Route path="/consultation" element={<ConsultationPage />} />
        <Route path="/orders/tips/:orderNo" element={<OrderStatusPage />} />
        <Route path="/orders/consultations/:orderNo" element={<OrderStatusPage />} />
      </Route>
    </Routes>
  );
}
