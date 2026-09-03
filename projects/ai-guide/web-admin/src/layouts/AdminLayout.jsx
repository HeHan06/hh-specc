/**
 * 管理后台受保护布局与路由守卫。
 * 未登录或角色非 ADMIN 时统一跳转登录页；已登录后渲染侧边导航与子路由内容。
 *
 * @capability Req-8 管理后台路由守卫
 * @capability Req-12 未登录/越权统一拦截
 * @capabilityPoint T-24 后台布局与守卫实现
 */
import { Link, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { Button, Layout, Menu, Space } from 'antd';
import { clearSession, getSession } from '../store/auth.js';

const { Content, Header, Sider } = Layout;

export default function AdminLayout() {
  const navigate = useNavigate();
  const session = getSession();

  if (!session?.token || session.role !== 'ADMIN') {
    return <Navigate to="/login" replace />;
  }

  function handleLogout() {
    clearSession();
    navigate('/login', { replace: true });
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider>
        <div style={{ color: '#fff', padding: 16, fontSize: 16, fontWeight: 600 }}>管理后台</div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={['/contents']}
          items={[
            {
              key: '/contents',
              label: <Link to="/contents">内容管理</Link>,
            },
          ]}
        />
      </Sider>
      <Layout>
        <Header style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
          <Space>
            <span style={{ color: '#fff' }}>{session.username}</span>
            <Button onClick={handleLogout}>退出登录</Button>
          </Space>
        </Header>
        <Content style={{ padding: 24 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
