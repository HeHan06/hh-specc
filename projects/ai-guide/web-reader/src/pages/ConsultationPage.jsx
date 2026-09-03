/**
 * 阅读站付费咨询页：展示 500 元/半小时计价，必填与格式校验复用 shared 校验规则；
 * 提交后展示管理员微信号与「备注订单号完成支付」提示，访客加微信完成线下收款。
 *
 * @capability Req-6 付费咨询
 * @capability Req-12 输入校验与错误反馈
 * @capabilityPoint T-22 付费咨询页实现
 * @orchestrate createConsultationOrder
 */
import { useState } from 'react';
import { Alert, Button, Input, Radio } from 'antd';
import { validateConsultationForm } from '@shared/utils/validate.js';
import { createConsultationOrder } from '../services/order.js';
import styles from './FormPage.module.css';

function TextField({ id, label, value, onChange, maxLength, textArea = false }) {
  const Control = textArea ? Input.TextArea : Input;
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>{label}</label>
      <Control id={id} value={value} maxLength={maxLength} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

export default function ConsultationPage() {
  const [contactName, setContactName] = useState('');
  const [contactType, setContactType] = useState('phone');
  const [contactValue, setContactValue] = useState('');
  const [topicText, setTopicText] = useState('');
  const [requestText, setRequestText] = useState('');
  const [expectedTime, setExpectedTime] = useState('');
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitError('');

    const validation = validateConsultationForm({
      contactName,
      contactType,
      contactValue,
      topicText,
      requestText,
      expectedTime,
    });
    setErrors(validation.errors);
    if (!validation.valid) {
      return;
    }

    const payload = {
      contactName: contactName.trim(),
      contactType,
      contactValue: contactValue.trim(),
      topicText: topicText.trim(),
      requestText: requestText.trim(),
      expectedTime,
    };

    setSubmitting(true);
    try {
      const data = await createConsultationOrder(payload);
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
          <h1 className={styles.title}>咨询已提交</h1>
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
        <h1 className={styles.title}>付费咨询</h1>
        <p className={styles.subtitle}>计价：500 元/半小时（前 10 个经确认排期的咨询免费）</p>

        <form onSubmit={handleSubmit} noValidate>
          <TextField
            id="consultation-contact-name"
            label="联系人"
            value={contactName}
            onChange={setContactName}
            maxLength={50}
          />

          <div className={styles.field}>
            <span className={styles.label}>联系方式类型</span>
            <Radio.Group value={contactType} onChange={(event) => setContactType(event.target.value)}>
              <Radio value="phone">手机</Radio>
              <Radio value="wechat">微信</Radio>
            </Radio.Group>
          </div>

          <TextField
            id="consultation-contact-value"
            label="联系方式"
            value={contactValue}
            onChange={setContactValue}
            maxLength={100}
          />
          <TextField
            id="consultation-topic"
            label="咨询主题"
            value={topicText}
            onChange={setTopicText}
            maxLength={200}
          />
          <TextField
            id="consultation-request"
            label="咨询诉求"
            value={requestText}
            onChange={setRequestText}
            maxLength={2000}
            textArea
          />
          <TextField
            id="consultation-expected-time"
            label="期望时间"
            value={expectedTime}
            onChange={setExpectedTime}
          />

          {Object.values(errors).map((message) => (
            <Alert key={message} type="error" message={message} showIcon />
          ))}
          {submitError ? <Alert type="error" message={submitError} showIcon /> : null}

          <Button type="primary" htmlType="submit" className={styles.submit} disabled={submitting}>
            提交咨询
          </Button>
        </form>
      </div>
    </div>
  );
}
