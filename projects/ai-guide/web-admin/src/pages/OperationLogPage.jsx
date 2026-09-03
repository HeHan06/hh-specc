/**
 * 后台操作日志页：分页查看敏感操作留痕，展示操作者、动作、对象、
 * 状态变化与时间；列表统一实现 loading / error / 空 三态。
 *
 * @capability Req-11 敏感操作留痕查询
 * @capability Req-12 统一错误处理与三态
 * @capabilityPoint T-28 实现操作日志查询页
 * @orchestrate listOperationLogs
 */
import { useEffect, useState } from 'react';
import { Alert, Button, Empty, Pagination, Spin, Table } from 'antd';
import { listOperationLogs } from '../services/operation-log.js';

const PAGE_SIZE = 20;
const INITIAL_LIST_STATE = Object.freeze({ status: 'loading', items: [], total: 0, pageNum: 1 });

function LoadingState() {
  return <Spin data-testid="operation-log-loading" />;
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

export default function OperationLogPage() {
  const [pageNum, setPageNum] = useState(1);
  const [listState, setListState] = useState(INITIAL_LIST_STATE);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setListState((previous) => ({ ...previous, status: 'loading' }));
      try {
        const page = await listOperationLogs({ pageNum, pageSize: PAGE_SIZE });
        if (cancelled) {
          return;
        }
        setListState({
          status: 'success',
          items: page?.list ?? [],
          total: page?.total ?? 0,
          pageNum: page?.pageNum ?? pageNum,
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

  function handlePageChange(nextPage) {
    setPageNum(nextPage);
  }

  const columns = [
    { title: '操作者', dataIndex: 'username' },
    { title: '动作', dataIndex: 'action' },
    { title: '对象类型', dataIndex: 'targetType' },
    { title: '对象', dataIndex: 'targetCode' },
    { title: '操作前状态', dataIndex: 'beforeState' },
    { title: '操作后状态', dataIndex: 'afterState' },
    { title: '时间', dataIndex: 'createdAt', render: formatDateTime },
  ];

  if (listState.status === 'loading') {
    return <LoadingState />;
  }

  if (listState.status === 'error') {
    return <ErrorState onRetry={() => setReloadKey((key) => key + 1)} />;
  }

  return (
    <main>
      <h1>操作日志</h1>
      {listState.items.length === 0 ? (
        <Empty description="暂无操作日志" />
      ) : (
        <>
          <Table
            rowKey="id"
            columns={columns}
            dataSource={listState.items}
            pagination={false}
            onRow={() => ({ 'data-testid': 'operation-log-row' })}
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
    </main>
  );
}
