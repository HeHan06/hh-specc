/**
 * 后台广告位管理页：单槽位广告位，未配置时展示空态表单，保存后用于阅读站引流。
 * 仅一个广告位；enabled 决定阅读站是否显现。
 *
 * @orchestrate getAdvertisement/updateAdvertisement
 */
import { useEffect, useState } from 'react';
import { Alert, Button, Form, Input, Spin, Switch } from 'antd';
import { getErrorText } from '@shared/constants/error-code-text.js';
import { getAdvertisement, updateAdvertisement } from '../services/admin-advertisement.js';

const EMPTY_VALUES = Object.freeze({ title: '', description: '', link: '', enabled: true });
const INITIAL_STATE = Object.freeze({ status: 'loading' });

export default function AdvertisementManagePage() {
  const [form] = Form.useForm();
  const [loadState, setLoadState] = useState(INITIAL_STATE);
  const [reloadKey, setReloadKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoadState({ status: 'loading' });
      try {
        const data = await getAdvertisement();
        if (cancelled) {
          return;
        }
        form.setFieldsValue(data ?? EMPTY_VALUES);
        setLoadState({ status: 'success' });
      } catch {
        if (cancelled) {
          return;
        }
        setLoadState({ status: 'error' });
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [form, reloadKey]);

  async function handleSubmit(values) {
    if (submitting) {
      return;
    }
    setSubmitting(true);
    setActionError('');
    setSaved(false);
    try {
      const data = await updateAdvertisement({
        title: values.title.trim(),
        description: values.description?.trim() || null,
        link: values.link.trim(),
        enabled: Boolean(values.enabled),
      });
      form.setFieldsValue(data ?? EMPTY_VALUES);
      setSaved(true);
    } catch (error) {
      setActionError(getErrorText(error?.code));
    } finally {
      setSubmitting(false);
    }
  }

  if (loadState.status === 'loading') {
    return <Spin data-testid="advertisement-loading" />;
  }

  if (loadState.status === 'error') {
    return (
      <main>
        <h1>广告位管理</h1>
        <Alert type="error" message="加载失败，请重试" showIcon />
        <Button type="primary" autoInsertSpace={false} onClick={() => setReloadKey((key) => key + 1)}>
          重试
        </Button>
      </main>
    );
  }

  return (
    <main>
      <h1>广告位管理</h1>
      <p>配置后，阅读站将在启用时展示该广告位，用于导流到闲鱼等第三方平台交易。</p>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={EMPTY_VALUES}
        style={{ maxWidth: 560 }}
      >
        <Form.Item
          label="标题"
          name="title"
          rules={[{ required: true, message: '请输入广告标题' }, { max: 100, message: '标题不能超过 100 个字符' }]}
        >
          <Input placeholder="例如：面试辅导 / 简历优化，闲鱼交易" />
        </Form.Item>

        <Form.Item
          label="描述"
          name="description"
          rules={[{ max: 500, message: '描述不能超过 500 个字符' }]}
        >
          <Input.TextArea rows={3} placeholder="简单说明服务内容与交易方式（选填）" />
        </Form.Item>

        <Form.Item
          label="跳转链接"
          name="link"
          rules={[{ required: true, message: '请输入跳转链接' }, { max: 500, message: '链接不能超过 500 个字符' }]}
        >
          <Input placeholder="例如闲鱼商品/主页链接 https://..." />
        </Form.Item>

        <Form.Item label="是否显示" name="enabled" valuePropName="checked">
          <Switch checkedChildren="显示" unCheckedChildren="隐藏" />
        </Form.Item>

        {actionError ? <Alert type="error" message={actionError} showIcon style={{ marginBottom: 16 }} /> : null}
        {saved ? <Alert type="success" message="已保存" showIcon style={{ marginBottom: 16 }} /> : null}

        <Button type="primary" htmlType="submit" loading={submitting} autoInsertSpace={false}>
          保存
        </Button>
      </Form>
    </main>
  );
}
