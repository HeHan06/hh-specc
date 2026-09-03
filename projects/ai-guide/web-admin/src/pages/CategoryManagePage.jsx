/**
 * 后台专题管理页：列表展示专题，新建时选择所属主题，支持编辑。
 * 列表统一实现 loading / error / 空 三态，失败时提供重试入口；
 * 接口错误统一由 shared 客户端按错误码抛出，页面只展示映射后的文案。
 *
 * @capability Req-9 后台专题管理
 * @capability Req-12 统一错误处理与三态
 * @capabilityPoint T-26 实现专题管理页
 * @orchestrate listCategories/listTopics/createCategory/updateCategory
 */
import { useEffect, useState } from 'react';
import { Alert, Button, Empty, Input, InputNumber, Space, Spin, Switch, Table } from 'antd';
import { getErrorText } from '@shared/constants/error-code-text.js';
import {
  createCategory,
  listCategories,
  listTopics,
  updateCategory,
} from '../services/admin-content.js';

const PAGE_SIZE = 20;
const INITIAL_LIST_STATE = Object.freeze({ status: 'loading', items: [], total: 0, pageNum: 1 });
const EMPTY_FORM = Object.freeze({
  code: '',
  topicCode: undefined,
  name: '',
  description: '',
  sortOrder: 1,
  enabled: true,
});

function LoadingState() {
  return <Spin data-testid="category-loading" />;
}

function ErrorState({ onRetry }) {
  return (
    <div>
      <Alert type="error" message="加载失败，请重试" showIcon />
      <Button type="primary" autoInsertSpace={false} onClick={onRetry}>重试</Button>
    </div>
  );
}

function formatDateTime(value) {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false });
}

export default function CategoryManagePage() {
  const [listState, setListState] = useState(INITIAL_LIST_STATE);
  const [topicOptions, setTopicOptions] = useState([]);
  const [pageNum, setPageNum] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingCode, setEditingCode] = useState(null);
  const [topicOpen, setTopicOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setListState((previous) => ({ ...previous, status: 'loading' }));
      try {
        const [categoryPage, topicPage] = await Promise.all([
          listCategories({ pageNum, pageSize: PAGE_SIZE }),
          listTopics({ pageNum: 1, pageSize: 100 }),
        ]);
        if (cancelled) {
          return;
        }
        setTopicOptions(topicPage?.list ?? []);
        setListState({
          status: 'success',
          items: categoryPage?.list ?? [],
          total: categoryPage?.total ?? 0,
          pageNum: categoryPage?.pageNum ?? pageNum,
        });
      } catch {
        if (cancelled) {
          return;
        }
        setListState({ status: 'error', items: [], total: 0, pageNum });
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [pageNum, reloadKey]);

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingCode(null);
    setActionError('');
  }

  function handleEdit(category) {
    setEditingCode(category.code);
    setForm({
      code: category.code,
      topicCode: category.topicCode,
      name: category.name,
      description: category.description ?? '',
      sortOrder: category.sortOrder ?? 1,
      enabled: Boolean(category.enabled),
    });
    setActionError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) {
      return;
    }

    setSubmitting(true);
    setActionError('');
    try {
      if (editingCode) {
        await updateCategory(editingCode, {
          topicCode: form.topicCode,
          name: form.name.trim(),
          description: form.description,
          sortOrder: form.sortOrder,
          enabled: form.enabled,
        });
      } else {
        await createCategory({
          code: form.code.trim(),
          topicCode: form.topicCode,
          name: form.name.trim(),
          description: form.description,
          sortOrder: form.sortOrder,
          enabled: form.enabled,
        });
      }
      resetForm();
      setReloadKey((key) => key + 1);
    } catch (error) {
      setActionError(getErrorText(error?.code));
    } finally {
      setSubmitting(false);
    }
  }

  const columns = [
    { title: '编码', dataIndex: 'code' },
    { title: '所属主题', dataIndex: 'topicCode' },
    { title: '名称', dataIndex: 'name' },
    {
      title: '状态',
      dataIndex: 'enabled',
      render: (enabled) => (enabled ? '启用' : '停用'),
    },
    { title: '更新时间', dataIndex: 'updatedAt', render: formatDateTime },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Button type="link" autoInsertSpace={false} onClick={() => handleEdit(record)}>编辑</Button>
      ),
    },
  ];

  if (listState.status === 'loading') {
    return <LoadingState />;
  }

  if (listState.status === 'error') {
    return <ErrorState onRetry={() => setReloadKey((key) => key + 1)} />;
  }

  return (
    <main>
      <h1>专题管理</h1>
      <form onSubmit={handleSubmit} noValidate style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            value={form.code}
            onChange={(event) => setForm((previous) => ({ ...previous, code: event.target.value }))}
            placeholder="请输入专题编码"
            disabled={Boolean(editingCode)}
            style={{ width: 200 }}
          />
          <Input
            value={form.name}
            onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))}
            placeholder="请输入专题名称"
            style={{ width: 200 }}
          />
          <Button
            type="default"
            role="combobox"
            aria-haspopup="listbox"
            aria-expanded={topicOpen}
            onClick={() => setTopicOpen((open) => !open)}
            autoInsertSpace={false}
            style={{ width: 200 }}
          >
            {topicOptions.find((topic) => topic.code === form.topicCode)?.name ?? '请选择所属主题'}
          </Button>
          {topicOpen ? (
            <div
              role="listbox"
              style={{
                position: 'absolute',
                zIndex: 10,
                background: '#fff',
                border: '1px solid #d9d9d9',
                borderRadius: 6,
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                marginTop: 4,
                minWidth: 200,
              }}
            >
              {topicOptions.map((topic) => (
                <Button
                  key={topic.code}
                  type="text"
                  role="option"
                  aria-selected={form.topicCode === topic.code}
                  block
                  autoInsertSpace={false}
                  onClick={() => {
                    setForm((previous) => ({ ...previous, topicCode: topic.code }));
                    setTopicOpen(false);
                  }}
                >
                  {topic.name}
                </Button>
              ))}
            </div>
          ) : null}
          <Input
            value={form.description}
            onChange={(event) => setForm((previous) => ({ ...previous, description: event.target.value }))}
            placeholder="专题简介"
            style={{ width: 260 }}
          />
          <InputNumber
            value={form.sortOrder}
            min={0}
            onChange={(value) => setForm((previous) => ({ ...previous, sortOrder: value ?? 1 }))}
            placeholder="排序"
            style={{ width: 100 }}
          />
          <Switch
            checked={form.enabled}
            checkedChildren="启用"
            unCheckedChildren="停用"
            onChange={(checked) => setForm((previous) => ({ ...previous, enabled: checked }))}
          />
          <Button type="primary" htmlType="submit" loading={submitting} autoInsertSpace={false}>
            {editingCode ? '保存' : '新建'}
          </Button>
          {editingCode ? (
            <Button autoInsertSpace={false} onClick={resetForm}>取消</Button>
          ) : null}
        </Space>
      </form>

      {actionError ? <Alert type="error" message={actionError} showIcon style={{ marginBottom: 16 }} /> : null}

      {listState.items.length === 0 ? (
        <Empty description="暂无专题" />
      ) : (
        <Table
          rowKey="code"
          columns={columns}
          dataSource={listState.items}
          pagination={false}
          onRow={() => ({ 'data-testid': 'category-row' })}
        />
      )}
    </main>
  );
}
