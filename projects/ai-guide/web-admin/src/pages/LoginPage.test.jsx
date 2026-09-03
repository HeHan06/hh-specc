/**
 * 登录页红测：统一失败提示、不区分账号不存在/密码错误、
 * Token 存储与 Bearer 请求头注入、登录成功跳转。
 *
 * @capability Req-8 管理后台登录
 * @capability Req-12 登录态与统一错误拦截
 * @capabilityPoint T-23 登录页测试先行红测
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import LoginPage from './LoginPage.jsx';
import { login } from '@shared/api/admin.js';
import { clearSession, getAuthHeaders, getToken } from '../store/auth.js';

vi.mock('@shared/api/admin.js', () => ({
  login: vi.fn(),
}));

function renderLoginPage() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/contents" element={<div>后台内容管理</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function submitLogin(user, username, password) {
  await user.type(screen.getByPlaceholderText('请输入管理员账号'), username);
  await user.type(screen.getByPlaceholderText('请输入密码'), password);
  await user.click(screen.getByRole('button', { name: '登录' }));
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearSession();
  });

  it('渲染账号、密码输入框与登录按钮', () => {
    renderLoginPage();

    expect(screen.getByPlaceholderText('请输入管理员账号')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('请输入密码')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '登录' })).toBeInTheDocument();
  });

  it('登录失败统一提示，且不区分账号不存在与密码错误', async () => {
    const user = userEvent.setup();

    login.mockRejectedValueOnce(Object.assign(new Error('账号不存在'), { code: 2300 }));
    const first = renderLoginPage();
    await submitLogin(user, 'ghost', 'x');
    expect(await screen.findByText('账号或密码错误')).toBeInTheDocument();
    first.unmount();

    login.mockRejectedValueOnce(Object.assign(new Error('密码错误'), { code: 2300 }));
    renderLoginPage();
    await submitLogin(user, 'admin', 'wrong');
    expect(await screen.findByText('账号或密码错误')).toBeInTheDocument();
  });

  it('系统繁忙等通用错误也走统一错误文案', async () => {
    const user = userEvent.setup();
    login.mockRejectedValueOnce(Object.assign(new Error('服务异常'), { code: 1004 }));

    renderLoginPage();
    await submitLogin(user, 'admin', 'secret');

    expect(await screen.findByText('系统繁忙，请稍后重试')).toBeInTheDocument();
  });

  it('登录成功后保存 Token、注入 Bearer 请求头并跳转后台', async () => {
    const user = userEvent.setup();
    login.mockResolvedValueOnce({ token: 'jwt-token', username: 'admin', role: 'ADMIN' });

    renderLoginPage();
    await submitLogin(user, 'admin', 'secret');

    expect(await screen.findByText('后台内容管理')).toBeInTheDocument();
    expect(getToken()).toBe('jwt-token');
    expect(getAuthHeaders()).toEqual({ Authorization: 'Bearer jwt-token' });
  });
});
