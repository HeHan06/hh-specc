/**
 * 阅读站打赏页：展示预设金额档位（按元展示、按分提交），联系方式可选；
 * 提交后展示管理员微信号与「备注订单号完成支付」提示，访客加微信线下付款。
 *
 * @capability Req-5 打赏
 * @capability Req-12 输入校验与错误反馈
 * @capabilityPoint T-22 打赏页实现
 * @orchestrate createTipOrder
 */
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Alert, Button, Input, Radio } from 'antd';
import { TIP_AMOUNT_CENTS } from '@shared/constants/order.js';
import { fenToYuan } from '@shared/utils/money.js';
import { isValidPhone, isValidWechat, isValidTipAmount } from '@shared/utils/validate.js';
import { createTipOrder } from '../services/order.js';
import { getVisitorId } from '../utils/visitor.js';
import styles from './FormPage.module.css';

function ContactField({ id, label, value, onChange, maxLength }) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>{label}</label>
      <Input id={id} value={value} maxLength={maxLength} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

export default function TipPage() {
  // 访客标识在组件挂载时读取一次，作为点赞/打赏的匿名幂等键。
  const [visitorId] = useState(() => getVisitorId());
  const [searchParams] = useSearchParams();
  const contentCode = searchParams.get('contentCode')?.trim() || undefined;

  const [amount, setAmount] = useState(null);
  const [contactName, setContactName] = useState('');
  const [contactValue, setContactValue] = useState('');
  const [message, setMessage] = useState('');
  const [formError, setFormError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError('');
    setSubmitError('');

    if (!isValidTipAmount(amount)) {
      setFormError('请选择打赏金额');
      return;
    }

    const trimmedContactName = contactName.trim();
    if (trimmedContactName.length > 50) {
      setFormError('联系人长度不能超过 50 个字符');
      return;
    }

    const trimmedContactValue = contactValue.trim();
    if (
      trimmedContactValue
      && !isValidPhone(trimmedContactValue)
      && !isValidWechat(trimmedContactValue)
    ) {
      setFormError('请填写正确的手机号或微信');
      return;
    }

    const trimmedMessage = message.trim();
    if (trimmedMessage.length > 500) {
      setFormError('留言长度不能超过 500 个字符');
      return;
    }

    const payload = { visitorId, amount };
    if (contentCode) {
      payload.contentCode = contentCode;
    }
    if (trimmedContactName) {
      payload.contactName = trimmedContactName;
    }
    if (trimmedContactValue) {
      payload.contactValue = trimmedContactValue;
    }
    if (trimmedMessage) {
      payload.message = trimmedMessage;
    }

    setSubmitting(true);
    try {
      const data = await createTipOrder(payload);
      setResult(data);
    } catch {
      setSubmitError('提交失败，请重试');
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <h1 className={styles.title}>打赏已提交</h1>
          <p className={styles.meta}>订单号：{result.orderNo}</p>
          <p className={styles.text}>
            请加管理员微信 <strong>{result.wechatId}</strong>，并备注订单号完成支付。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>打赏</h1>
        <p className={styles.subtitle}>支持你喜欢的内容，金额随心意</p>

        <form onSubmit={handleSubmit} noValidate>
          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>打赏金额</legend>
            <Radio.Group value={amount} onChange={(event) => setAmount(event.target.value)}>
              {TIP_AMOUNT_CENTS.map((cents) => (
                <Radio key={cents} value={cents}>
                  {fenToYuan(cents)} 元
                </Radio>
              ))}
            </Radio.Group>
          </fieldset>

          <ContactField
            id="tip-contact-name"
            label="联系人（选填）"
            value={contactName}
            onChange={setContactName}
            maxLength={50}
          />
          <ContactField
            id="tip-contact-value"
            label="联系方式（选填）"
            value={contactValue}
            onChange={setContactValue}
            maxLength={100}
          />
          <div className={styles.field}>
            <label className={styles.label} htmlFor="tip-message">留言（选填）</label>
            <Input.TextArea
              id="tip-message"
              value={message}
              maxLength={500}
              onChange={(event) => setMessage(event.target.value)}
            />
          </div>

          {formError ? <Alert type="error" message={formError} showIcon /> : null}
          {submitError ? <Alert type="error" message={submitError} showIcon /> : null}

          <Button type="primary" htmlType="submit" className={styles.submit} disabled={submitting}>
            提交打赏
          </Button>
        </form>
      </div>
    </div>
  );
}
