/**
 * 后台内容编辑页：加载内容详情并编辑，保存携带 version 做乐观锁；
 * 发布/恢复要求人工审核确认，下架/归档为危险操作需二次确认。
 * 并发冲突等业务错误通过 getErrorText 统一映射，失败时提供重新加载入口。
 *
 * @capability Req-9 后台内容编辑与状态机交互
 * @capability Req-10 发布前人工审核确认
 * @capability Req-12 统一错误处理与乐观锁冲突反馈
 * @capabilityPoint T-26 实现内容编辑/发布/下架/恢复/归档
 * @orchestrate getContent/updateContent/publishContent/unpublishContent/restoreContent/archiveContent
 */
import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Checkbox,
  Form,
  Input,
  Popconfirm,
  Select,
  Space,
  Spin,
  Switch,
} from 'antd';
import {
  CONTENT_SOURCES,
  CONTENT_SOURCE_TEXT,
  CONTENT_TYPES,
  CONTENT_TYPE_TEXT,
} from '@shared/constants/content.js';
import { getErrorText } from '@shared/constants/error-code-text.js';
import {
  archiveContent,
  createContent,
  getContent,
  listCategories,
  publishContent,
  restoreContent,
  unpublishContent,
  updateContent,
} from '../services/admin-content.js';

const INITIAL_LOAD_STATE = Object.freeze({ status: 'loading', content: null, categories: [] });

function LoadingState() {
  return <Spin data-testid="content-edit-loading" />;
}

function ErrorState({ onRetry }) {
  return (
    <div>
      <Alert type="error" message="加载失败，请重试" showIcon />
      <Button type="primary" autoInsertSpace={false} onClick={onRetry}>重试</Button>
    </div>
  );
}

/**
 * 把编辑表单值规范化为契约要求的内容更新 body。
 * version 始终来自当前已加载内容，避免表单里夹带旧版本。
 */
function buildContentBody(values, version) {
  return {
    categoryCode: values.categoryCode,
    type: values.type,
    title: values.title?.trim() ?? '',
    summary: values.summary,
    body: values.body,
    tags: Array.isArray(values.tags) ? values.tags : [],
    source: values.source,
    recommended: Boolean(values.recommended),
    version,
  };
}

/** 把编辑表单值规范化为契约要求的创建 body（不含 version / recommended）。 */
function buildCreateBody(values) {
  return {
    categoryCode: values.categoryCode,
    type: values.type,
    title: values.title?.trim() ?? '',
    summary: values.summary,
    body: values.body,
    tags: Array.isArray(values.tags) ? values.tags : [],
    source: values.source,
  };
}

/** 新建模式下的空表单默认值，字段与编辑详情视图对齐。 */
function emptyContent() {
  return {
    code: null,
    categoryCode: undefined,
    type: undefined,
    title: '',
    summary: '',
    body: '',
    tags: [],
    source: undefined,
    status: 'draft',
    recommended: false,
    version: 0,
    publishedAt: null,
    updatedAt: null,
  };
}

export default function ContentEditPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { contentCode } = useParams();
  const isNew = !contentCode;
  const imported = location.state?.imported ?? null;
  const [loadState, setLoadState] = useState(INITIAL_LOAD_STATE);
  const [reloadKey, setReloadKey] = useState(0);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [actionPending, setActionPending] = useState(null);
  const [actionError, setActionError] = useState('');
  const [actionErrorCode, setActionErrorCode] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoadState((previous) => ({ ...previous, status: 'loading' }));
      setActionError('');
      setActionErrorCode(null);
      setReviewConfirmed(false);
      try {
        const categoryPage = await listCategories({ pageNum: 1, pageSize: 100 });
        const categories = categoryPage?.list ?? [];
        const content = isNew
          ? (imported ? { ...emptyContent(), ...imported } : emptyContent())
          : await getContent(contentCode);
        if (cancelled) {
          return;
        }
        setLoadState({
          status: 'success',
          content,
          categories,
        });
      } catch {
        if (cancelled) {
          return;
        }
        setLoadState({ status: 'error', content: null, categories: [] });
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [contentCode, isNew, reloadKey, imported]);

  function handleReload() {
    setActionError('');
    setActionErrorCode(null);
    setReloadKey((key) => key + 1);
  }

  function showActionError(error) {
    setActionError(getErrorText(error?.code));
    setActionErrorCode(error?.code ?? null);
  }

  async function handleSave(values) {
    if (actionPending) {
      return;
    }

    setActionPending('save');
    setActionError('');
    setActionErrorCode(null);
    try {
      if (isNew) {
        const result = await createContent(buildCreateBody(values));
        navigate(`/contents/${result.code}/edit`, { replace: true });
      } else {
        const result = await updateContent(
          contentCode,
          buildContentBody(values, loadState.content.version),
        );
        setLoadState((previous) => ({
          ...previous,
          content: {
            ...previous.content,
            ...buildContentBody(values, previous.content.version),
            version: result?.version ?? previous.content.version,
          },
        }));
      }
    } catch (error) {
      showActionError(error);
    } finally {
      setActionPending(null);
    }
  }

  async function handlePublish() {
    if (actionPending) {
      return;
    }
    if (!reviewConfirmed) {
      setActionError('发布前请先完成人工审核确认');
      setActionErrorCode(null);
      return;
    }

    setActionPending('publish');
    setActionError('');
    setActionErrorCode(null);
    try {
      const result = await publishContent(contentCode, {
        reviewConfirmed: true,
        version: loadState.content.version,
      });
      setReviewConfirmed(false);
      setLoadState((previous) => ({
        ...previous,
        content: {
          ...previous.content,
          status: result?.status ?? 'published',
          publishedAt: result?.publishedAt ?? previous.content.publishedAt,
        },
      }));
    } catch (error) {
      showActionError(error);
    } finally {
      setActionPending(null);
    }
  }

  async function handleRestore() {
    if (actionPending) {
      return;
    }
    if (!reviewConfirmed) {
      setActionError('恢复发布前请先完成人工审核确认');
      setActionErrorCode(null);
      return;
    }

    setActionPending('restore');
    setActionError('');
    setActionErrorCode(null);
    try {
      const result = await restoreContent(contentCode, {
        reviewConfirmed: true,
        version: loadState.content.version,
      });
      setReviewConfirmed(false);
      setLoadState((previous) => ({
        ...previous,
        content: { ...previous.content, status: result?.status ?? 'published' },
      }));
    } catch (error) {
      showActionError(error);
    } finally {
      setActionPending(null);
    }
  }

  async function runStatusAction(action) {
    if (actionPending) {
      return;
    }

    setActionPending(action);
    setActionError('');
    setActionErrorCode(null);
    try {
      const result = action === 'unpublish'
        ? await unpublishContent(contentCode, { version: loadState.content.version })
        : await archiveContent(contentCode, { version: loadState.content.version });
      setLoadState((previous) => ({
        ...previous,
        content: {
          ...previous.content,
          status: result?.status ?? (action === 'unpublish' ? 'unpublished' : 'archived'),
        },
      }));
    } catch (error) {
      showActionError(error);
    } finally {
      setActionPending(null);
    }
  }

  if (loadState.status === 'loading') {
    return <LoadingState />;
  }

  if (loadState.status === 'error') {
    return <ErrorState onRetry={handleReload} />;
  }

  const content = loadState.content;
  const requiresReview = content.status === 'draft' || content.status === 'unpublished';

  return (
    <main>
      <h1>{isNew ? '新建内容' : '内容编辑'}</h1>
      {actionError ? (
        <Alert
          type="error"
          message={actionError}
          showIcon
          action={
            actionErrorCode === 2302 ? (
              <Button size="small" autoInsertSpace={false} onClick={handleReload}>重新加载</Button>
            ) : null
          }
        />
      ) : null}

      <Form
        key={content.version}
        layout="vertical"
        initialValues={content}
        onFinish={handleSave}
        style={{ maxWidth: 960, marginTop: 16 }}
      >
        <Form.Item name="categoryCode" label="所属专题" rules={[{ required: true, message: '请选择所属专题' }]}>
          <Select
            showSearch
            optionFilterProp="label"
            placeholder="请选择所属专题"
            options={loadState.categories.map((category) => ({
              value: category.code,
              label: category.name,
            }))}
          />
        </Form.Item>

        <Form.Item name="type" label="内容类型" rules={[{ required: true, message: '请选择内容类型' }]}>
          <Select
            placeholder="请选择内容类型"
            options={CONTENT_TYPES.map((type) => ({ value: type, label: CONTENT_TYPE_TEXT[type] }))}
          />
        </Form.Item>

        <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
          <Input placeholder="请输入内容标题" maxLength={200} />
        </Form.Item>

        <Form.Item name="summary" label="摘要" rules={[{ required: true, message: '请输入摘要' }]}>
          <Input.TextArea rows={3} maxLength={500} />
        </Form.Item>

        <Form.Item name="body" label="正文" rules={[{ required: true, message: '请输入正文' }]}>
          <Input.TextArea rows={12} />
        </Form.Item>

        <Form.Item name="tags" label="标签">
          <Select mode="tags" tokenSeparators={[',', '，']} placeholder="输入标签后回车" />
        </Form.Item>

        <Form.Item name="source" label="来源" rules={[{ required: true, message: '请选择来源' }]}>
          <Select
            placeholder="请选择来源"
            options={CONTENT_SOURCES.map((source) => ({
              value: source,
              label: CONTENT_SOURCE_TEXT[source],
            }))}
          />
        </Form.Item>

        {!isNew ? (
          <Form.Item name="recommended" label="推荐" valuePropName="checked">
            <Switch />
          </Form.Item>
        ) : null}

        <Space wrap>
          <Button
            type="primary"
            htmlType="submit"
            loading={actionPending === 'save'}
            autoInsertSpace={false}
          >
            {isNew ? '创建草稿' : '保存'}
          </Button>

          {!isNew && content.status === 'draft' ? (
            <Button
              type="primary"
              htmlType="button"
              loading={actionPending === 'publish'}
              onClick={handlePublish}
              autoInsertSpace={false}
            >
              发布
            </Button>
          ) : null}

          {!isNew && content.status === 'unpublished' ? (
            <Button
              type="primary"
              htmlType="button"
              loading={actionPending === 'restore'}
              onClick={handleRestore}
              autoInsertSpace={false}
            >
              恢复发布
            </Button>
          ) : null}

          {!isNew && content.status === 'published' ? (
            <Popconfirm
              title="确认下架该内容？"
              okText="确认下架"
              cancelText="取消"
              onConfirm={() => runStatusAction('unpublish')}
            >
              <Button
                danger
                htmlType="button"
                loading={actionPending === 'unpublish'}
                onClick={() => runStatusAction('unpublish')}
                autoInsertSpace={false}
              >
                下架
              </Button>
            </Popconfirm>
          ) : null}

          {!isNew && content.status !== 'archived' ? (
            <Popconfirm
              title="确认归档该内容？归档后不再展示。"
              okText="确认归档"
              cancelText="取消"
              onConfirm={() => runStatusAction('archive')}
            >
              <Button
                danger
                htmlType="button"
                loading={actionPending === 'archive'}
                onClick={() => runStatusAction('archive')}
                autoInsertSpace={false}
              >
                归档
              </Button>
            </Popconfirm>
          ) : null}
        </Space>
      </Form>

      {!isNew && requiresReview ? (
        <Checkbox
          checked={reviewConfirmed}
          onChange={(event) => setReviewConfirmed(event.target.checked)}
          style={{ marginTop: 16 }}
        >
          我已完成人工审核
        </Checkbox>
      ) : null}
    </main>
  );
}
