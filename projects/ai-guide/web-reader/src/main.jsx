/**
 * 阅读站浏览器入口：挂载 React 根节点、注入 BrowserRouter 与 Ant Design 主题。
 * 主题令牌落地 landing-page 预设（营销落地页范式）：主色 #4f46e5（靛蓝）。
 *
 * @capability Req-1 阅读站应用入口
 * @capabilityPoint T-18 阅读站入口装配
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import App from './App.jsx';
import './styles/global.css';

const theme = {
  token: {
    colorPrimary: '#4f46e5',
    borderRadius: 8,
    fontSize: 16,
    colorText: '#111827',
    colorTextSecondary: '#6b7280',
    colorBorder: '#e5e7eb',
  },
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ConfigProvider locale={zhCN} theme={theme}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ConfigProvider>
  </React.StrictMode>,
);
