/**
 * @capability Req-5 打赏订单输入校验
 * @capability Req-6 付费咨询输入校验
 * @capability Req-12 输入校验
 * @capabilityPoint T-05 校验共享输入校验规则
 */
import { describe, expect, it } from 'vitest';
import {
  isValidPhone,
  isValidWechat,
  isValidContactValue,
  isValidSearchKeyword,
  isValidPageNum,
  isValidPageSize,
  isValidTipAmount,
  validateConsultationForm,
} from '../../utils/validate.js';

describe('联系方式校验', () => {
  it('校验大陆手机号格式', () => {
    expect(isValidPhone('13800138000')).toBe(true);
    expect(isValidPhone('12345678901')).toBe(false);
    expect(isValidPhone('1380013800')).toBe(false);
    expect(isValidPhone('23800138000')).toBe(false);
  });

  it('校验微信号格式', () => {
    expect(isValidWechat('wx_guide-01')).toBe(true);
    expect(isValidWechat('a1b2c3')).toBe(true);
    expect(isValidWechat('1abcde')).toBe(false);
    expect(isValidWechat('ab')).toBe(false);
    expect(isValidWechat('wx guide')).toBe(false);
  });

  it('按联系类型分派手机或微信校验', () => {
    expect(isValidContactValue('13800138000', 'phone')).toBe(true);
    expect(isValidContactValue('12345', 'phone')).toBe(false);
    expect(isValidContactValue('wx_guide-01', 'wechat')).toBe(true);
    expect(isValidContactValue('ab', 'wechat')).toBe(false);
    expect(isValidContactValue('13800138000', 'email')).toBe(false);
  });
});

describe('搜索词与分页校验', () => {
  it('搜索词 trim 后长度为 1-50', () => {
    expect(isValidSearchKeyword('Agent')).toBe(true);
    expect(isValidSearchKeyword('  Agent  ')).toBe(true);
    expect(isValidSearchKeyword('')).toBe(false);
    expect(isValidSearchKeyword('   ')).toBe(false);
    expect(isValidSearchKeyword('a'.repeat(50))).toBe(true);
    expect(isValidSearchKeyword('a'.repeat(51))).toBe(false);
  });

  it('页码必须为大于等于 1 的整数', () => {
    expect(isValidPageNum(1)).toBe(true);
    expect(isValidPageNum(2)).toBe(true);
    expect(isValidPageNum(0)).toBe(false);
    expect(isValidPageNum(-1)).toBe(false);
    expect(isValidPageNum(1.5)).toBe(false);
  });

  it('每页条数必须为 1-100 的整数', () => {
    expect(isValidPageSize(1)).toBe(true);
    expect(isValidPageSize(20)).toBe(true);
    expect(isValidPageSize(100)).toBe(true);
    expect(isValidPageSize(101)).toBe(false);
    expect(isValidPageSize(0)).toBe(false);
    expect(isValidPageSize(100.5)).toBe(false);
  });
});

describe('打赏金额档位校验', () => {
  it('仅接受契约预设的六个档位', () => {
    expect(isValidTipAmount(10)).toBe(true);
    expect(isValidTipAmount(100)).toBe(true);
    expect(isValidTipAmount(500)).toBe(true);
    expect(isValidTipAmount(1000)).toBe(true);
    expect(isValidTipAmount(5000)).toBe(true);
    expect(isValidTipAmount(10000)).toBe(true);
    expect(isValidTipAmount(15)).toBe(false);
    expect(isValidTipAmount(10001)).toBe(false);
    expect(isValidTipAmount(10.5)).toBe(false);
  });
});

describe('付费咨询表单校验', () => {
  const validForm = () => ({
    contactName: '张三',
    contactType: 'phone',
    contactValue: '13800138000',
    topicText: 'Agent 架构设计',
    requestText: '想了解多 Agent 协作方案',
    expectedTime: new Date(Date.now() + 86400000).toISOString(),
  });

  it('必填与格式均合法时返回 valid:true', () => {
    expect(validateConsultationForm(validForm())).toEqual({ valid: true, errors: {} });
  });

  it('缺项时标记对应字段错误', () => {
    const result = validateConsultationForm({});
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveProperty('contactName');
    expect(result.errors).toHaveProperty('contactType');
    expect(result.errors).toHaveProperty('contactValue');
    expect(result.errors).toHaveProperty('topicText');
    expect(result.errors).toHaveProperty('requestText');
    expect(result.errors).toHaveProperty('expectedTime');
  });

  it('联系方式格式非法时标记 contactValue', () => {
    const form = validForm();
    form.contactValue = 'bad-contact';
    const result = validateConsultationForm(form);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveProperty('contactValue');
  });

  it('期望时间早于当前时间时标记 expectedTime', () => {
    const form = validForm();
    form.expectedTime = new Date(Date.now() - 86400000).toISOString();
    const result = validateConsultationForm(form);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveProperty('expectedTime');
  });
});
