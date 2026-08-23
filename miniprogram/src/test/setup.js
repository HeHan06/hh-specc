// Taro H5 运行时依赖 TARO_ENV 判断端类型，测试环境固定为 h5（对应官方 jest.setup.js 的职责）。
// 用中括号取值规避 Taro 测试转换器对 `process.env.TARO_ENV` 的字符串替换，避免赋值语句被改写。
process.env['TARO_ENV'] = 'h5';

// jsdom 默认不提供 requestAnimationFrame，而 Taro 测试工具的 mount 会等待下一帧再完成渲染。
// 这里用定时器兜底，避免组件挂载阶段因缺少 rAF 直接抛错。
if (typeof global.requestAnimationFrame !== 'function') {
  global.requestAnimationFrame = (callback) => setTimeout(() => callback(Date.now()), 0);
  global.cancelAnimationFrame = (id) => clearTimeout(id);
}

// 每个用例结束后清空 body，避免前一个用例渲染出的页面节点残留到下一个用例。
afterEach(() => {
  document.body.innerHTML = '';
});
