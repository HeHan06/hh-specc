/**
 * 后台内容列表页：按类型、状态、专题、关键词筛选，分页展示内容列表。
 * 列表统一实现 loading / error / 空 三态，失败时提供重试入口；
 * 接口错误统一由 shared 客户端按错误码抛出，页面只展示映射后的文案。
 *
 * @capability Req-9 后台内容列表
 * @capability Req-12 统一错误处理与三态
 * @capabilityPoint T-26 实现内容列表页筛选/分页/三态
 * @orchestrate listContents / listCategories
 */
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, Button, Empty, Input, Modal, Pagination, Select, Space, Spin, Table, Tabs, Typography } from 'antd';
import {
  CONTENT_STATUSES,
  CONTENT_STATUS_TEXT,
  CONTENT_TYPES,
  CONTENT_TYPE_TEXT,
} from '@shared/constants/content.js';
import { CONTENT_TEMPLATES } from '../constants/contentTemplates.js';
import { listCategories, listContents } from '../services/admin-content.js';
import { parseMarkdownContent } from '../utils/parseMarkdown.js';

const PAGE_SIZE = 20;
const INITIAL_FILTER = Object.freeze({
  keyword: '',
  status: undefined,
  type: undefined,
  categoryCode: undefined,
});
const INITIAL_SEARCH = Object.freeze({
  ...INITIAL_FILTER,
  pageNum: 1,
  pageSize: PAGE_SIZE,
});
const INITIAL_LIST_STATE = Object.freeze({ status: 'loading', items: [], total: 0, pageNum: 1 });

function LoadingState() {
  return <Spin data-testid="content-loading" />;
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

const { Paragraph } = Typography;

function ContentTemplateModal({ open, onClose }) {
  const items = CONTENT_TEMPLATES.map(({ type, label, description, template }) => ({
    key: type,
    label,
    children: (
      <div>
        <Paragraph type="secondary" style={{ marginBottom: 12 }}>
          {description}
        </Paragraph>
        <Paragraph
          code
          copyable={{ text: template, tooltips: ['复制模板', '已复制'] }}
          style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}
        >
          {template}
        </Paragraph>
      </div>
    ),
  }));

  return (
    <Modal open={open} onCancel={onClose} footer={null} title="内容模板" width={800} getContainer={false}>
      <Tabs items={items} />
    </Modal>
  );
}

export default function ContentListPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [importError, setImportError] = useState('');
  const [templateOpen, setTemplateOpen] = useState(false);
  const [filter, setFilter] = useState(INITIAL_FILTER);
  const [search, setSearch] = useState(INITIAL_SEARCH);
  const [listState, setListState] = useState(INITIAL_LIST_STATE);
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadCategories() {
      try {
        const page = await listCategories({ pageNum: 1, pageSize: 100 });
        if (!cancelled) {
          setCategoryOptions(page?.list ?? []);
        }
      } catch {
        // 分类下拉加载失败不阻塞内容列表；内容请求仍会携带后端统一错误提示。
      }
    }

    loadCategories();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadContents() {
      setListState((previous) => ({ ...previous, status: 'loading' }));
      try {
        const page = await listContents(search);
        if (cancelled) {
          return;
        }
        setListState({
          status: 'success',
          items: page?.list ?? [],
          total: page?.total ?? 0,
          pageNum: page?.pageNum ?? search.pageNum,
        });
      } catch {
        if (cancelled) {
          return;
        }
        setListState({ status: 'error', items: [], total: 0, pageNum: search.pageNum });
      }
    }

    loadContents();
    return () => {
      cancelled = true;
    };
  }, [search, reloadKey]);

  function handleSearch() {
    // 每次筛选都回到第一页，避免在高页码下无结果。
    setSearch({
      keyword: filter.keyword.trim(),
      status: filter.status,
      type: filter.type,
      categoryCode: filter.categoryCode,
      pageNum: 1,
      pageSize: PAGE_SIZE,
    });
    setReloadKey((key) => key + 1);
  }

  function handlePageChange(pageNum) {
    setSearch((previous) => ({ ...previous, pageNum }));
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  function handleImportFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const body = String(reader.result ?? '');
      try {
        const imported = parseMarkdownContent(file.name, body);
        setImportError('');
        navigate('/contents/new', { state: { imported } });
      } catch {
        setImportError('导入失败：无法解析该 Markdown 文档');
      }
    };
    reader.onerror = () => {
      setImportError('导入失败：读取文件出错');
    };
    reader.readAsText(file, 'utf-8');
  }

  const columns = [
    {
      title: '标题',
      dataIndex: 'title',
      render: (title, record) => <Link to={`/contents/${record.code}/edit`}>{title}</Link>,
    },
    {
      title: '类型',
      dataIndex: 'type',
      render: (type) => CONTENT_TYPE_TEXT[type] ?? type,
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (status) => CONTENT_STATUS_TEXT[status] ?? status,
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      render: formatDateTime,
    },
  ];

  return (
    <main>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>内容管理</h1>
        <Space>
          <Button autoInsertSpace={false} onClick={() => setTemplateOpen(true)}>查看模板</Button>
          <Button autoInsertSpace={false} onClick={handleImportClick}>导入 MD</Button>
          <Link to="/contents/new"><Button type="primary" autoInsertSpace={false}>新建内容</Button></Link>
        </Space>
        <input
          ref={fileInputRef}
          type="file"
          accept=".md,.markdown,text/markdown"
          style={{ display: 'none' }}
          onChange={handleImportFile}
        />
      </div>
      {importError ? (
        <Alert type="error" message={importError} showIcon style={{ marginBottom: 16 }} />
      ) : null}
      <Space wrap style={{ marginBottom: 16 }}>
        <Input
          value={filter.keyword}
          onChange={(event) => setFilter((previous) => ({ ...previous, keyword: event.target.value }))}
          placeholder="请输入内容标题关键词"
          style={{ width: 240 }}
        />
        <Select
          value={filter.type}
          allowClear
          placeholder="内容类型"
          style={{ width: 160 }}
          onChange={(value) => setFilter((previous) => ({ ...previous, type: value }))}
          options={CONTENT_TYPES.map((type) => ({ value: type, label: CONTENT_TYPE_TEXT[type] }))}
        />
        <Select
          value={filter.status}
          allowClear
          placeholder="内容状态"
          style={{ width: 160 }}
          onChange={(value) => setFilter((previous) => ({ ...previous, status: value }))}
          options={CONTENT_STATUSES.map((status) => ({
            value: status,
            label: CONTENT_STATUS_TEXT[status],
          }))}
        />
        <Select
          value={filter.categoryCode}
          allowClear
          placeholder="所属专题"
          style={{ width: 200 }}
          onChange={(value) => setFilter((previous) => ({ ...previous, categoryCode: value }))}
          options={categoryOptions.map((category) => ({
            value: category.code,
            label: category.name,
          }))}
        />
        <Button type="primary" autoInsertSpace={false} onClick={handleSearch}>查询</Button>
      </Space>

      {listState.status === 'loading' ? (
        <LoadingState />
      ) : listState.status === 'error' ? (
        <ErrorState onRetry={() => setReloadKey((key) => key + 1)} />
      ) : listState.items.length === 0 ? (
        <Empty description="暂无内容" />
      ) : (
        <>
          <Table
            rowKey="code"
            columns={columns}
            dataSource={listState.items}
            pagination={false}
            onRow={() => ({ 'data-testid': 'content-row' })}
          />
          <Pagination
            current={listState.pageNum}
            pageSize={PAGE_SIZE}
            total={listState.total}
            showSizeChanger={false}
            onChange={handlePageChange}
            style={{ marginTop: 16 }}
          />
        </>
      )}
      <ContentTemplateModal open={templateOpen} onClose={() => setTemplateOpen(false)} />
    </main>
  );
}
