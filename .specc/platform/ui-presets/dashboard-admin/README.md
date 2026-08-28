# UI 预设：dashboard-admin（管理后台范式）

> 一句话愿景：**让"内部系统/后台管理"长得像"标准后台"——信息密度高、操作路径短、一眼看清数据，用户上手即会。**
> 适用产品：后台管理系统、数据看板、运营控制台、表格 CRUD、审核/配置类页面。
> 何时**不**用：C 端营销页、需要强烈视觉冲击的品牌首页（用 `landing-page`）；纯移动端流式（用 `mobile-content-feed`）。

## 设计令牌（视觉唯一权威源）

> 取值只准来自这里，禁止在页面硬编码 `#xxx` / 字号 / 间距。令牌基于 Ant Design `ConfigProvider.theme.token` 映射，落地时通过主题注入，不在页面写死。

### 色板（oklch 语义）
| 令牌 | 值 | 用途 |
|---|---|---|
| `--color-bg` | `#f5f5f5` | 页面底色（浅灰） |
| `--color-surface` | `#ffffff` | 卡片 / 页面容器 |
| `--color-primary` | `#2563eb`（蓝） | 主按钮、选中态、重点文字 |
| `--color-text` | `#1f2937` | 正文 |
| `--color-text-secondary` | `#6b7280` | 次要说明 / 表头 |
| `--color-border` | `#e5e7eb` | 分隔线、卡片描边 |
| `--color-success / warn / danger` | `#10b981 / #f59e0b / #ef4444` | 状态色（升级/降级/封禁等） |

### 字号（层级刻度）
`12 → 14 → 16 → 20 → 24`（说明 / 正文 / 卡片标题 / 区块标题 / 大标题）。正文默认 14。

### 间距（4px 基数）
`4, 8, 12, 16, 24, 32`。卡片内边距 16~24；区块间距 24。

### 圆角 & 阴影
- 圆角：`6`（卡片）/ `4`（按钮 / 输入框）
- 阴影：`0 1px 3px rgba(0,0,0,0.08)`（卡片级，轻）

## 布局骨架（标准三区）

```
┌────────────────────────────────────────────────┐
│  顶栏 TopBar（高 56）                            │
│  左：产品名/Logo       右：搜索 / 用户头像 / 退出   │
├────────────┬───────────────────────────────────┤
│  侧边栏      │  内容区 Content（最大撞 1200，居中）  │
│  Sidebar    │ ┌─────────────────────────────┐  │
│  宽 200     │ │ 页头 PageHeader              │  │
│  - 菜单项    │ │  标题 + 面包屑 + 主操作按钮(右)  │  │
│  - 分组      │ ├─────────────────────────────┤  │
│  - 当前态    │ │ 统计卡片区 StatCards (1行N列)  │  │
│  高亮       │ ├─────────────────────────────┤  │
│            │ │ 表格 Table / 筛选 / 分页        │  │
│            │ └─────────────────────────────┘  │
└────────────┴───────────────────────────────────┘
```

## 组件清单（用 Ant Design 现成件搭）

| 布局区 | 推荐组件 |
|---|---|
| 顶栏 | `Layout.Header`、`Avatar`、`Dropdown` |
| 侧边栏 | `Layout.Sider`、`Menu`（inline，含分组） |
| 页头 | `Breadcrumb` + `Typography.Title` + `Button`（主操作居右） |
| 统计卡片 | `Card` + `Statistic`（或自绘 `Row/Col` + 图标） |
| 表格 | `Table`（含 `loading/empty/分页`）、`Tag`（状态列）、`Button`（操作列） |
| 筛选 | `Form`（inline）+ `Select`/`DatePicker`/`Input.Search` |
| 详情/弹窗 | `Modal`、`Drawer`（右侧详情）、`Descriptions` |

## 组件纪律（反模式）

- **禁止**在页面手写 `<button>`/`<table>`/`<input>` 原生标签——一律走 Ant Design 组件。
- **禁止**在页面里用原生 CSS 覆盖 Ant 组件已提供的样式（颜色/尺寸/状态）——改视觉只改主题令牌。
- **禁止**把表格列写死 100 行——拆成列定义数组 + `Table` 渲染。
- 状态色（启用/禁用/风险）**必须**用 `Tag` + 语义色，禁止裸文字拼色。
- 每个数据区块必须有 `loading`（表格自带）/ `empty`（`empty` 文案）/ `error`（`Alert` or `Button` 重试），遵循 F-04 三态。
- 页面结构按 `frontend-architecture.md`：Page → service → api → shared，接口调用不落在页面里。

## 这个预设下的页面该如何写（示例骨架）

```jsx
// pages/UserListPage.jsx  —— 只做组装，不碰请求细节
import { Layout, Menu, Card, Statistic, Table, Button, Breadcrumb } from 'antd';
import { useUserList } from '../../services/userList.js';   // service 管数据
// @capability Req-1 用户管理
function UserListPage() {
  const { rows, loading, error, reload } = useUserList();   // 状态在 service
  return (
    <Layout> <Sidebar/> <Content>
      <PageHeader title="用户列表" extra={<Button type="primary">新建</Button>} />
      <StatCards />
      <Table dataSource={rows} loading={loading} pagination columns={cols} />
    </Content> </Layout>
  );
}
```
