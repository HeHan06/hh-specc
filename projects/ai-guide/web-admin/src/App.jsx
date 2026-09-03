/**
 * 管理后台路由装配。
 * 登录页公开，业务页面统一挂载在受保护布局下；本期先提供内容管理入口。
 *
 * @capability Req-8 管理后台路由
 * @capability Req-12 后台登录态边界
 * @capabilityPoint T-24 后台路由装配
 */
import { Navigate, Route, Routes } from 'react-router-dom';
import LoginPage from './pages/LoginPage.jsx';
import AdminLayout from './layouts/AdminLayout.jsx';

function ContentPlaceholder() {
  return <div>后台内容管理</div>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<AdminLayout />}>
        <Route path="/contents" element={<ContentPlaceholder />} />
      </Route>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
