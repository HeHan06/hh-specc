/**
 * 管理后台路由装配。
 * 登录页公开，业务页面统一挂载在受保护布局下，覆盖内容、目录、广告位与操作日志。
 *
 * @capability Req-8 管理后台路由
 * @capability Req-12 后台登录态边界
 * @capabilityPoint T-24 后台路由装配
 */
import { Navigate, Route, Routes } from 'react-router-dom';
import LoginPage from './pages/LoginPage.jsx';
import AdminLayout from './layouts/AdminLayout.jsx';
import ContentListPage from './pages/ContentListPage.jsx';
import ContentEditPage from './pages/ContentEditPage.jsx';
import TopicManagePage from './pages/TopicManagePage.jsx';
import CategoryManagePage from './pages/CategoryManagePage.jsx';
import AdvertisementManagePage from './pages/AdvertisementManagePage.jsx';
import OperationLogPage from './pages/OperationLogPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<AdminLayout />}>
        <Route path="/contents" element={<ContentListPage />} />
        <Route path="/contents/new" element={<ContentEditPage />} />
        <Route path="/contents/:contentCode/edit" element={<ContentEditPage />} />
        <Route path="/topics" element={<TopicManagePage />} />
        <Route path="/categories" element={<CategoryManagePage />} />
        <Route path="/advertisement" element={<AdvertisementManagePage />} />
        <Route path="/logs" element={<OperationLogPage />} />
      </Route>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
