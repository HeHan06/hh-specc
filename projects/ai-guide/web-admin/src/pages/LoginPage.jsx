/**
 * 管理后台登录页。
 * 登录失败统一按错误码映射文案，不区分账号不存在与密码错误；
 * 登录成功后保存会话并跳转后台内容页。
 *
 * @capability Req-8 管理后台登录
 * @capability Req-12 登录失败统一错误处理
 * @capabilityPoint T-24 后台登录页实现
 * @orchestrate login / saveSession
 */
import { useState } from 'react';
import { Alert, Button, Card, Form, Input, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { login } from '@shared/api/admin.js';
import { getErrorText } from '@shared/constants/error-code-text.js';
import request from '../platform/request.js';
import { saveSession } from '../store/auth.js';

const { Title } = Typography;

export default function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState('');

  async function handleSubmit(values) {
    setLoading(true);
    setErrorText('');

    try {
      const session = await login(request, {
        username: values.username,
        password: values.password,
      });
      saveSession(session);
      navigate('/contents', { replace: true });
    } catch (error) {
      // 未知错误回退到通用繁忙文案，禁止直接把后端 message 展示给用户。
      setErrorText(getErrorText(error?.code ?? 1004));
      setLoading(false);
    }
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Card style={{ width: 380 }}>
        <Title level={3} style={{ textAlign: 'center' }}>管理后台登录</Title>
        {errorText ? <Alert type="error" message={errorText} showIcon style={{ marginBottom: 16 }} /> : null}
        <Form layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            label="账号"
            name="username"
            rules={[{ required: true, message: '请输入管理员账号' }]}
          >
            <Input placeholder="请输入管理员账号" autoComplete="username" />
          </Form.Item>
          <Form.Item
            label="密码"
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password placeholder="请输入密码" autoComplete="current-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} autoInsertSpace={false} block>
            登录
          </Button>
        </Form>
      </Card>
    </main>
  );
}
