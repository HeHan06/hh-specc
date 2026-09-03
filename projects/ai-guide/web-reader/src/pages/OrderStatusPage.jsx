/**
 * 阅读站订单状态页：按路由区分打赏/咨询订单，展示管理员微信号、订单状态与
 * 收款/确认时间；加载失败提供重试，且不暴露管理员备注等后台私有字段。
 *
 * @capability Req-7 订单状态流转
 * @capability Req-12 错误反馈
 * @capability Req-13 页面可用性
 * @capabilityPoint T-22 订单状态页实现
 * @orchestrate getTipOrder / getConsultationOrder
 */
import { useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { Alert, Button, Spin } from 'antd';
import {
  CONSULTATION_ORDER_STATUS_TEXT,
  TIP_ORDER_STATUS_TEXT,
} from '@shared/constants/order.js';
import { fenToYuan } from '@shared/utils/money.js';
import { getConsultationOrder, getTipOrder } from '../services/order.js';
import styles from './OrderStatusPage.module.css';

const INITIAL_STATE = Object.freeze({ status: 'loading', data: null });

function formatDateTime(value) {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false });
}

export default function OrderStatusPage() {
  const { orderNo } = useParams();
  const { pathname } = useLocation();
  const isTip = pathname.includes('/orders/tips/');
  const [state, setState] = useState(INITIAL_STATE);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState({ status: 'loading', data: null });
      try {
        const data = isTip ? await getTipOrder(orderNo) : await getConsultationOrder(orderNo);
        if (cancelled) {
          return;
        }
        setState({ status: 'success', data });
      } catch {
        if (cancelled) {
          return;
        }
        setState({ status: 'error', data: null });
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [orderNo, isTip, reloadKey]);

  if (state.status === 'loading') {
    return (
      <div className={styles.center}>
        <Spin data-testid="order-status-loading" />
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className={styles.center}>
        <Alert type="error" message="加载失败，请重试" showIcon />
        <Button type="primary" className={styles.retry} autoInsertSpace={false} onClick={() => setReloadKey((key) => key + 1)}>
          重试
        </Button>
      </div>
    );
  }

  const data = state.data;
  const statusText = isTip
    ? TIP_ORDER_STATUS_TEXT[data.status] ?? data.status
    : CONSULTATION_ORDER_STATUS_TEXT[data.status] ?? data.status;

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>订单状态</h1>

        <dl className={styles.rows}>
          <div className={styles.row}>
            <dt>订单号</dt>
            <dd>{data.orderNo}</dd>
          </div>
          <div className={styles.row}>
            <dt>当前状态</dt>
            <dd className={styles.status}>{statusText}</dd>
          </div>
          <div className={styles.row}>
            <dt>管理员微信号</dt>
            <dd>{data.wechatId}</dd>
          </div>

          {isTip ? (
            <>
              <div className={styles.row}>
                <dt>打赏金额</dt>
                <dd>{data.amountCents != null ? `${fenToYuan(data.amountCents)} 元` : ''}</dd>
              </div>
              {data.receivedAt ? (
                <div className={styles.row}>
                  <dt>收款时间</dt>
                  <dd>{formatDateTime(data.receivedAt)}</dd>
                </div>
              ) : null}
            </>
          ) : (
            <>
              <div className={styles.row}>
                <dt>咨询价格</dt>
                <dd>{data.priceCents != null ? `${fenToYuan(data.priceCents)} 元` : ''}</dd>
              </div>
              {data.confirmedAt ? (
                <div className={styles.row}>
                  <dt>确认时间</dt>
                  <dd>{formatDateTime(data.confirmedAt)}</dd>
                </div>
              ) : null}
            </>
          )}
        </dl>
      </div>
    </div>
  );
}
