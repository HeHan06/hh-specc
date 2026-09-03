/**
 * 后台布局与路由守卫红测：未登录/越权跳转登录页，
 * 已登录 ADMIN 渲染导航与子路由内容。
 *
 * @capability Req-8 管理后台路由守卫
 * @capability Req-12 未登录/越权统一拦截
 * @capabilityPoint T-23 后台布局与鉴权测试先行红测
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AdminLayout from './AdminLayout.jsx';
import { clearSession, saveSession } from '../store/auth.js';

function renderLayout(initialEntry = '/contents') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/login" element={<div>后台登录页</div>} />
        <Route element={<AdminLayout />}>
          <Route path="/contents" element={<div>后台内容管理</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('AdminLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearSession();
  });

  it('未登录访问后台路由时跳转登录页', () => {
    renderLayout();

    expect(screen.getByText('后台登录页')).toBeInTheDocument();
    expect(screen.queryByText('后台内容管理')).not.toBeInTheDocument();
  });

  it('角色非 ADMIN 时视为越权并跳转登录页', () => {
    saveSession({ token: 'token', username: 'guest', role: 'GUEST' });

    renderLayout();

    expect(screen.getByText('后台登录页')).toBeInTheDocument();
    expect(screen.queryByText('后台内容管理')).not.toBeInTheDocument();
  });

  it('已登录 ADMIN 渲染后台导航与子路由内容', () => {
    saveSession({ token: 'token', username: 'admin', role: 'ADMIN' });

    renderLayout();

    expect(screen.getByText('后台内容管理')).toBeInTheDocument();
    expect(screen.getByText('内容管理')).toBeInTheDocument();
  });
});
