/**
 * Web 管理后台浏览器入口：挂载 React 根节点并注入 BrowserRouter。
 *
 * @capability Req-8 管理后台应用入口
 * @capabilityPoint T-24 后台入口装配
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
