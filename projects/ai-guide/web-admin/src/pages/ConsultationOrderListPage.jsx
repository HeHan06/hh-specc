/**
 * 后台咨询订单列表页：关键词筛选、分页展示咨询订单，支持查看详情、
 * 确认排期、完成、取消与备注。确认排期/完成为二次确认的敏感操作，
 * 取消必须填写原因；列表统一实现 loading / error / 空 三态。
 *
 * @capability Req-7 咨询订单后台状态流转
 * @capability Req-11 咨询订单管理
 * @capability Req-12 统一错误处理与敏感操作反馈
 * @capabilityPoint T-28 实现咨询订单列表页
 * @orchestrate listConsultations/getConsultation/confirmConsultation/completeConsultation/cancelConsultation/updateConsultationNote
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
import { CONSULTATION_ORDER_STATUS, CONSULTATION_ORDER_STATUS_TEXT } from '@shared/constants/order.js';
import { fenToYuan } from '@shared/utils/money.js';
import {
  cancelConsultation,
  completeConsultation,
  confirmConsultation,
  getConsultation,
  listConsultations,
  updateConsultationNote,
} from '../services/admin-order.js';

const PAGE_SIZE = 20;
const INITIAL_LIST_STATE = Object.freeze({ status: 'loading', items: [], total: 0, pageNum: 1 });
const INITIAL_DETAIL_STATE = Object.freeze({ status: 'idle', data: null, errorText: '' });

function LoadingState() {
  return <Spin data-testid="consultation-order-loading" />;
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

/** 免费订单显示「免费」；付费订单按分换算为元展示。 */
function formatPrice(cents) {
  if (cents === 0) {
    return '免费';
  }
  return `¥${fenToYuan(cents).toFixed(2)}`;
}

export default function ConsultationOrderListPage() {
  const [keyword, setKeyword] = useState('');
  const [search, setSearch] = useState({ keyword: '', pageNum: 1, pageSize: PAGE_SIZE });
  const [listState, setListState] = useState(INITIAL_LIST_STATE);
  const [reloadKey, setReloadKey] = useState(0);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailState, setDetailState] = useState(INITIAL_DETAIL_STATE);
  const [actionError, setActionError] = useState('');
  const [actionPending, setActionPending] = useState(null);
  const [cancelOrder, setCancelOrder] = useState(null);
  const [noteOrder, setNoteOrder] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setListState((previous) => ({ ...previous, status: 'loading' }));
      try {
        const page = await listConsultations(search);
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
      const data = await getConsultation(orderNo);
      setDetailState({ status: 'success', data, errorText: '' });
    } catch (error) {
      setDetailState({ status: 'error', data: null, errorText: getErrorText(error?.code) });
    }
  }

  async function handleConfirm(orderNo) {
    if (actionPending) {
      return;
    }
    setActionPending('confirm');
    setActionError('');
    try {
      await confirmConsultation(orderNo, {});
      setReloadKey((key) => key + 1);
    } catch (error) {
      setActionError(getErrorText(error?.code));
    } finally {
      setActionPending(null);
    }
  }

  async function handleComplete(orderNo) {
    if (actionPending) {
      return;
    }
    setActionPending('complete');
    setActionError('');
    try {
      await completeConsultation(orderNo, {});
      setReloadKey((key) => key + 1);
    } catch (error) {
      setActionError(getErrorText(error?.code));
    } finally {
      setActionPending(null);
    }
  }

  function handleOpenCancel(record) {
    setActionError('');
    setCancelOrder({ orderNo: record.orderNo, adminNote: '' });
  }

  async function handleSubmitCancel() {
    if (!cancelOrder || actionPending) {
      return;
    }
    setActionPending('cancel');
    setActionError('');
    try {
      await cancelConsultation(cancelOrder.orderNo, { adminNote: cancelOrder.adminNote.trim() });
      setCancelOrder(null);
      setReloadKey((key) => key + 1);
    } catch (error) {
      setActionError(getErrorText(error?.code));
    } finally {
      setActionPending(null);
    }
  }

  function handleOpenNote(record) {
    setActionError('');
    setNoteOrder({ orderNo: record.orderNo, adminNote: record.adminNote ?? '' });
  }

  async function handleSubmitNote() {
    if (!noteOrder || actionPending) {
      return;
    }
    setActionPending('note');
    setActionError('');
    try {
      await updateConsultationNote(noteOrder.orderNo, { adminNote: noteOrder.adminNote });
      setNoteOrder(null);
      setReloadKey((key) => key + 1);
    } catch (error) {
      setActionError(getErrorText(error?.code));
    } finally {
      setActionPending(null);
    }
  }

  const columns = [
    { title: '订单号', dataIndex: 'orderNo' },
    { title: '联系人', dataIndex: 'contactName' },
    { title: '咨询主题', dataIndex: 'topicText' },
    { title: '金额', dataIndex: 'priceCents', render: formatPrice },
    { title: '状态', dataIndex: 'status', render: (status) => CONSULTATION_ORDER_STATUS_TEXT[status] ?? status },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size={0}>
          <Button type="link" autoInsertSpace={false} onClick={() => handleOpenDetail(record.orderNo)}>
            详情
          </Button>
          {record.status === CONSULTATION_ORDER_STATUS.SUBMITTED ? (
            <>
              <Popconfirm
                title="确认排期？将占用免费名额（前 10 个确认订单免费）。"
                okText="确认"
                cancelText="取消"
                onConfirm={() => handleConfirm(record.orderNo)}
              >
                <Button type="link" autoInsertSpace={false}>确认排期</Button>
              </Popconfirm>
              <Button type="link" danger autoInsertSpace={false} onClick={() => handleOpenCancel(record)}>
                取消
              </Button>
            </>
          ) : null}
          {record.status === CONSULTATION_ORDER_STATUS.CONFIRMED ? (
            <>
              <Popconfirm
                title="确认该咨询已完成？"
                okText="确认"
                cancelText="取消"
                onConfirm={() => handleComplete(record.orderNo)}
              >
                <Button type="link" autoInsertSpace={false}>完成</Button>
              </Popconfirm>
              <Button type="link" danger autoInsertSpace={false} onClick={() => handleOpenCancel(record)}>
                取消
              </Button>
            </>
          ) : null}
          {record.status === CONSULTATION_ORDER_STATUS.SUBMITTED ||
          record.status === CONSULTATION_ORDER_STATUS.CONFIRMED ? (
            <Button type="link" autoInsertSpace={false} onClick={() => handleOpenNote(record)}>备注</Button>
          ) : null}
        </Space>
      ),
    },
  ];

  return (
    <main>
      <h1>咨询订单</h1>
      <Space wrap style={{ marginBottom: 16 }}>
        <Input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="请输入订单号、联系人或咨询主题"
          style={{ width: 280 }}
        />
        <Button type="primary" autoInsertSpace={false} onClick={handleSearch}>查询</Button>
      </Space>

      {actionError ? <Alert type="error" message={actionError} showIcon style={{ marginBottom: 16 }} /> : null}

      {listState.status === 'loading' ? (
        <LoadingState />
      ) : listState.status === 'error' ? (
        <ErrorState onRetry={handleRetry} />
      ) : listState.items.length === 0 ? (
        <Empty description="暂无咨询订单" />
      ) : (
        <>
          <Table
            rowKey="orderNo"
            columns={columns}
            dataSource={listState.items}
            pagination={false}
            onRow={() => ({ 'data-testid': 'consultation-order-row' })}
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

      <Modal title="咨询订单详情" open={detailOpen} footer={null} onCancel={() => setDetailOpen(false)}>
        {detailState.status === 'loading' ? (
          <Spin />
        ) : detailState.status === 'error' ? (
          <Alert type="error" message={detailState.errorText} showIcon />
        ) : detailState.data ? (
          <Descriptions column={1} size="small">
            <Descriptions.Item label="订单号">{detailState.data.orderNo}</Descriptions.Item>
            <Descriptions.Item label="联系人">{detailState.data.contactName}</Descriptions.Item>
            <Descriptions.Item label="联系方式">{detailState.data.contactValue}</Descriptions.Item>
            <Descriptions.Item label="咨询主题">{detailState.data.topicText}</Descriptions.Item>
            <Descriptions.Item label="咨询诉求">{detailState.data.requestText}</Descriptions.Item>
            <Descriptions.Item label="期望时间">{formatDateTime(detailState.data.expectedTime)}</Descriptions.Item>
            <Descriptions.Item label="金额">{formatPrice(detailState.data.priceCents)}</Descriptions.Item>
            <Descriptions.Item label="状态">
              {CONSULTATION_ORDER_STATUS_TEXT[detailState.data.status] ?? detailState.data.status}
            </Descriptions.Item>
          </Descriptions>
        ) : null}
      </Modal>

      <Modal
        title="取消咨询订单"
        open={Boolean(cancelOrder)}
        okText="确认取消"
        cancelText="取消"
        okButtonProps={{ loading: actionPending === 'cancel', danger: true }}
        onOk={handleSubmitCancel}
        onCancel={() => setCancelOrder(null)}
      >
        <Input.TextArea
          value={cancelOrder?.adminNote ?? ''}
          onChange={(event) =>
            setCancelOrder((previous) => previous && { ...previous, adminNote: event.target.value })
          }
          placeholder="请输入取消原因"
          rows={4}
        />
      </Modal>

      <Modal
        title="更新管理员备注"
        open={Boolean(noteOrder)}
        okText="保存备注"
        cancelText="取消"
        okButtonProps={{ loading: actionPending === 'note' }}
        onOk={handleSubmitNote}
        onCancel={() => setNoteOrder(null)}
      >
        <Input.TextArea
          value={noteOrder?.adminNote ?? ''}
          onChange={(event) =>
            setNoteOrder((previous) => previous && { ...previous, adminNote: event.target.value })
          }
          placeholder="请输入管理员备注"
          rows={4}
        />
      </Modal>
    </main>
  );
}
