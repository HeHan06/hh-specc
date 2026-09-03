/**
 * 后台打赏订单列表页：关键词筛选、分页展示订单列表，支持查看详情、
 * 确认收款与关闭。收款/关闭均为敏感操作，使用 Popconfirm 二次确认，
 * 并依赖后端接口级校验；列表统一实现 loading / error / 空 三态。
 *
 * @capability Req-7 打赏订单后台状态流转
 * @capability Req-11 打赏订单管理
 * @capability Req-12 统一错误处理与敏感操作反馈
 * @capabilityPoint T-28 实现打赏订单列表页
 * @orchestrate listTips/getTip/receiveTip/closeTip
 */
import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Descriptions,
  Empty,
  Input,
  Modal,
  Pagination,
  Popconfirm,
  Space,
  Spin,
  Table,
} from 'antd';
import { getErrorText } from '@shared/constants/error-code-text.js';
import { TIP_ORDER_STATUS, TIP_ORDER_STATUS_TEXT } from '@shared/constants/order.js';
import { fenToYuan } from '@shared/utils/money.js';
import { closeTip, getTip, listTips, receiveTip } from '../services/admin-order.js';

const PAGE_SIZE = 20;
const INITIAL_LIST_STATE = Object.freeze({ status: 'loading', items: [], total: 0, pageNum: 1 });
const INITIAL_DETAIL_STATE = Object.freeze({ status: 'idle', data: null, errorText: '' });

function LoadingState() {
  return <Spin data-testid="tip-order-loading" />;
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

function formatAmount(cents) {
  return `¥${fenToYuan(cents).toFixed(2)}`;
}

/** 列表展示时对联系方式脱敏，完整值仅在详情弹窗中可见。 */
function maskContact(value) {
  if (!value) {
    return '-';
  }
  if (value.length <= 4) {
    return value;
  }
  return `${value.slice(0, 3)}****${value.slice(-4)}`;
}

export default function TipOrderListPage() {
  const [keyword, setKeyword] = useState('');
  const [search, setSearch] = useState({ keyword: '', pageNum: 1, pageSize: PAGE_SIZE });
  const [listState, setListState] = useState(INITIAL_LIST_STATE);
  const [reloadKey, setReloadKey] = useState(0);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailState, setDetailState] = useState(INITIAL_DETAIL_STATE);
  const [actionError, setActionError] = useState('');
  const [actionPending, setActionPending] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setListState((previous) => ({ ...previous, status: 'loading' }));
      try {
        const page = await listTips(search);
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

    load();
    return () => {
      cancelled = true;
    };
  }, [search, reloadKey]);

  function handleSearch() {
    // 筛选总是回到第一页，避免高页码下查询结果为空。
    setSearch({ keyword: keyword.trim(), pageNum: 1, pageSize: PAGE_SIZE });
  }

  function handlePageChange(pageNum) {
    setSearch((previous) => ({ ...previous, pageNum }));
  }

  function handleRetry() {
    setReloadKey((key) => key + 1);
  }

  async function handleOpenDetail(orderNo) {
    setDetailState({ status: 'loading', data: null, errorText: '' });
    setDetailOpen(true);
    try {
      const data = await getTip(orderNo);
      setDetailState({ status: 'success', data, errorText: '' });
    } catch (error) {
      setDetailState({ status: 'error', data: null, errorText: getErrorText(error?.code) });
    }
  }

  async function handleReceive(orderNo) {
    if (actionPending) {
      return;
    }
    setActionPending('receive');
    setActionError('');
    try {
      await receiveTip(orderNo);
      setReloadKey((key) => key + 1);
    } catch (error) {
      setActionError(getErrorText(error?.code));
    } finally {
      setActionPending(null);
    }
  }

  async function handleClose(orderNo) {
    if (actionPending) {
      return;
    }
    setActionPending('close');
    setActionError('');
    try {
      await closeTip(orderNo);
      setReloadKey((key) => key + 1);
    } catch (error) {
      setActionError(getErrorText(error?.code));
    } finally {
      setActionPending(null);
    }
  }

  const columns = [
    { title: '订单号', dataIndex: 'orderNo' },
    { title: '金额', dataIndex: 'amountCents', render: formatAmount },
    { title: '联系方式', dataIndex: 'contactValue', render: maskContact },
    { title: '状态', dataIndex: 'status', render: (status) => TIP_ORDER_STATUS_TEXT[status] ?? status },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size={0}>
          <Button type="link" autoInsertSpace={false} onClick={() => handleOpenDetail(record.orderNo)}>
            详情
          </Button>
          {record.status === TIP_ORDER_STATUS.SUBMITTED ? (
            <>
              <Popconfirm
                title="确认已线下收到该笔打赏？"
                okText="确认"
                cancelText="取消"
                onConfirm={() => handleReceive(record.orderNo)}
              >
                <Button type="link" autoInsertSpace={false}>确认收款</Button>
              </Popconfirm>
              <Popconfirm
                title="确定关闭该打赏留资单？关闭后不可再收款。"
                okText="确认关闭"
                cancelText="取消"
                onConfirm={() => handleClose(record.orderNo)}
              >
                <Button type="link" danger autoInsertSpace={false}>关闭</Button>
              </Popconfirm>
            </>
          ) : null}
        </Space>
      ),
    },
  ];

  return (
    <main>
      <h1>打赏订单</h1>
      <Space wrap style={{ marginBottom: 16 }}>
        <Input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="请输入订单号或联系方式"
          style={{ width: 260 }}
        />
        <Button type="primary" autoInsertSpace={false} onClick={handleSearch}>查询</Button>
      </Space>

      {actionError ? <Alert type="error" message={actionError} showIcon style={{ marginBottom: 16 }} /> : null}

      {listState.status === 'loading' ? (
        <LoadingState />
      ) : listState.status === 'error' ? (
        <ErrorState onRetry={handleRetry} />
      ) : listState.items.length === 0 ? (
        <Empty description="暂无打赏订单" />
      ) : (
        <>
          <Table
            rowKey="orderNo"
            columns={columns}
            dataSource={listState.items}
            pagination={false}
            onRow={() => ({ 'data-testid': 'tip-order-row' })}
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

      <Modal title="打赏订单详情" open={detailOpen} footer={null} onCancel={() => setDetailOpen(false)}>
        {detailState.status === 'loading' ? (
          <Spin />
        ) : detailState.status === 'error' ? (
          <Alert type="error" message={detailState.errorText} showIcon />
        ) : detailState.data ? (
          <Descriptions column={1} size="small">
            <Descriptions.Item label="订单号">{detailState.data.orderNo}</Descriptions.Item>
            <Descriptions.Item label="关联内容">{detailState.data.contentCode || '-'}</Descriptions.Item>
            <Descriptions.Item label="金额">{formatAmount(detailState.data.amountCents)}</Descriptions.Item>
            <Descriptions.Item label="联系人">{detailState.data.contactName || '-'}</Descriptions.Item>
            <Descriptions.Item label="联系方式">{detailState.data.contactValue || '-'}</Descriptions.Item>
            <Descriptions.Item label="留言">{detailState.data.message || '-'}</Descriptions.Item>
            <Descriptions.Item label="状态">
              {TIP_ORDER_STATUS_TEXT[detailState.data.status] ?? detailState.data.status}
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">{formatDateTime(detailState.data.createdAt)}</Descriptions.Item>
          </Descriptions>
        ) : null}
      </Modal>
    </main>
  );
}
