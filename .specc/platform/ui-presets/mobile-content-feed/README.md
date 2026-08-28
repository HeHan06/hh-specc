# UI 预设：mobile-content-feed（移动端内容流范式）

> 一句话愿景：**让"移动端内容消费"长得像"沉浸式信息流"——单列卡片、大图、下拉加载，拇指操作、看得下去、愿意下滑/分享。**
> 适用产品：微信小程序、H5、内容/资讯流、卡片列表、打卡/记录类移动页。
> 何时**不**用：PC 后台管理系统（`dashboard-admin`）；PC 落地页（`landing-page`）。
> 技术基座：Taro（React 语法），小程序特有的 `wx.*` 一律封装进 `platform/`，页面禁止裸调（frontend-architecture F-01-5）。

## 设计令牌（视觉唯一权威源）

> 取值只准来自这里。移动端**字更大（易读）、点击目标 ≥44px、单列流式**，一切为"拇指 + 滑动"服务。

### 色板
| 令牌 | 值 | 用途 |
|---|---|---|
| `--color-bg` | `#f7f8fa` | 页面底色（浅灰，衬托卡片） |
| `--color-surface` | `#ffffff` | 卡片 |
| `--color-primary` | `#07c160`（微信绿） | 品牌强调 / 主操作 |
| `--color-text` | `#1f2937` | 正文 |
| `--color-text-secondary` | `#9ca3af` | 时间/次要/来源 |
| `--color-divider` | `#e5e7eb` | 分隔线 |

### 字号
`14 → 16 → 20 → 24`（次要 / 正文 / 卡片标题 / 大标题）。正文 16（移动端偏大），卡片标题 20。

### 间距
`8, 12, 16, 20`。卡片间距 12~16，卡片内边距 16~20。

### 圆角 & 阴影
- 圆角：`12`（卡片）/ `8`（按钮）
- 阴影：`0 2px 8px rgba(0,0,0,0.06)`（轻浮起）

## 布局骨架（单列信息流）

```
┌─────────────────────────────────────┐
│ 导航栏 NavBar（返回 + 标题 + 右侧操作） │
├─────────────────────────────────────┤
│ 列表流 Content（单列，可滚动/下拉刷新）  │
│  ┌───────────────────────────────┐  │
│  │ 卡片 Card                      │  │
│  │  [可选]大图封面 (aspectFill)     │  │
│  │  标题(20, 2行省略)               │  │
│  │  摘要/内容摘要 (16, 3行省略)      │  │
│  │  底部元信息：来源 · 时间 · 操作     │  │
│  └───────────────────────────────┘  │
│  （重复卡片 ×N）                       │
│  底部：加载中 / 没有更多 / 下拉刷新      │
└─────────────────────────────────────┘
```

## 组件清单（用 Taro + 少量自有样式）

| 区块 | 推荐实现 |
|---|---|
| 导航栏 | `NavigationBar`（或自绘 header），支持返回 |
| 卡片 | `View` 容器 + `Image`（`mode="aspectFill"`）+ `Text` |
| 图片 | `Image`（懒加载 `lazyLoad`，避免渲染卡顿） |
| 列表 | `ScrollView`（`scrollY` + `onScrollToLower` 触底加载） |
| 加载/空态 | `Text`「加载中...」/「暂无内容」，遵循 F-04 三态 |
| 交互 | `Button`/`View` 点击，规格 `@tap`/`bindtap` |

> 移动端不引入重 UI 库，用 Taro 基础组件 + 少量 scss（`index.scss`）即可，但颜色/间距/圆角走令牌。

## 组件纪律（反模式）

- **禁止**页面内裸调 `wx.request`/`fetch`——统一走 `platform/request.js` 适配器 + `shared/api`（F-01-5）。
- **禁止**写死图片路径、硬编码颜色；封面图、色值走令牌与配置。
- **禁止**列表一次性全量渲染——必须分页/触底加载，避免小程序性能崩（性能红线下）。
- **禁止**卡片交互复杂化；移动端操作以"点击卡片进入详情 / 分享"为主，避免多级弹层。
- `Image` 必须给 `mode="aspectFill"` + `lazyLoad`，否则封面拉伸变形、滚动卡顿。
- 每个列表必须有 `loading`（首屏）/ `empty`（无内容）/ `error`（失败可重试）三态（F-04）。
- 页面结构按 `frontend-architecture.md`：Page → service → api → shared，数据流转不堆在页面 `useEffect`（F-01-2）。

## 卡片流写法示例

```jsx
// pages/list/index.jsx
import { View, Text, Image, ScrollView } from '@tarojs/components';
import { useList } from '../../services/list.js';   // service 管数据 + 分页
// @capability Req-1 内容列表
// @capabilityPoint T-03 渲染首页卡片流
function ListPage() {
  const { items, loading, error, reload, loadMore } = useList();
  return (
    <View className="page">
      <ScrollView scrollY onScrollToLower={loadMore}>
        {items.map(it => (
          <View className="card" key={it.id}>
            {it.cover && <Image className="cover" src={it.cover} mode="aspectFill" lazyLoad />}
            <Text className="title">{it.title}</Text>
            <Text className="desc">{it.summary}</Text>
            <Text className="meta">{it.source} · {it.time}</Text>
          </View>
        ))}
        <Text className="end">{loading ? '加载中...' : '没有更多了'}</Text>
      </ScrollView>
    </View>
  );
}
```
