# kpro

一套代码同时支持 **Vue 3** 与 **React 18** 的跨框架 UI 组件库。

kpro 把组件行为下沉到与框架无关的内核 `@kpro/core`，Vue / React 两端只保留薄适配层。因此两个框架的**属性名、默认值、事件名、控制器方法完全一致**，业务代码在框架间迁移时几乎零成本。

首个组件：[指引（Guide）](docs/guide.md) —— 步骤化引导用户完成操作流程，激活时显示半透明遮罩、只高亮当前步骤的目标 DOM，并支持「不再提示」永久关闭。

---

## 特性

- **跨框架一致 API**：`id` / `serial` / `title` / `content` / `placement` / `padding` / `showHighlight` / `maskOpacity` / `closable` / `showDontShowAgain` / `disabled` / `autoScroll`，两端同名同默认值。
- **挖孔遮罩高亮**：遮罩由最多 4 块矩形拼成并围绕目标元素留出透空区，透空区内是**真实 DOM**，位置、尺寸、滚动、交互都与页面完全一致，不存在克隆元素对不齐的问题。
- **响应式**：窄屏（< 640px）自动降级为底部抽屉；窗口缩放、容器尺寸变化、滚动、旋转实时跟随。
- **「不再提示」持久化**：默认写入 `localStorage`，可替换存储键或接入自定义后端；无 `localStorage` 时自动退化为内存实现。
- **零侵入**：`Guide` 不产生额外包裹节点，插槽/子元素原有的 `ref` 与事件都被保留。
- **完整类型与测试**：全量 TypeScript 类型声明，内核与两端组件共 115 个单元测试。

---

## 仓库结构

```
kpro/
├── packages/
│   ├── core/            # @kpro/core  —— 框架无关内核（按组件分组）
│   │   └── src/
│   │       ├── index.ts        # 公共出口
│   │       └── guide/          # 指引组件
│   │           ├── types.ts    # 跨框架公共契约（唯一事实来源）
│   │           ├── engine.ts   # 步骤注册表与状态机
│   │           ├── storage.ts  # 「不再提示」持久化
│   │           ├── style.ts    # 共享 CSS 与注入
│   │           └── dom/
│   │               ├── cutout.ts   # 挖孔几何与浮层定位（纯函数）
│   │               └── rect.ts     # DOM 矩形测量与变化追踪
│   ├── vue/             # @kpro/vue   —— Vue 3 适配层
│   └── react/           # @kpro/react —— React 18 适配层
├── examples/
│   ├── vue-demo/        # Vue 3 演示页（端口 5173）
│   └── react-demo/      # React 18 演示页（端口 5174）
└── docs/
    └── guide.md         # 指引组件 API 文档
```

---

## 开始使用

### 环境要求

- Node.js ≥ 16.14
- pnpm 8（仓库已通过 `packageManager` 字段锁定版本，推荐用 corepack 启用）

```bash
corepack enable
pnpm install
```

### 常用命令

| 命令 | 说明 |
| --- | --- |
| `pnpm dev:vue` | 启动 Vue 演示页（http://localhost:5173） |
| `pnpm dev:react` | 启动 React 演示页（http://localhost:5174） |
| `pnpm test` | 运行全部单元测试（Vitest） |
| `pnpm test:cov` | 运行测试并输出覆盖率 |
| `pnpm typecheck` | 三个包的类型检查 |
| `pnpm lint` / `pnpm lint:fix` | ESLint 检查 / 自动修复 |
| `pnpm build` | 构建 `@kpro/core`、`@kpro/vue`、`@kpro/react`（ESM + CJS + d.ts） |
| `pnpm build:examples` | 构建两个演示页 |

---

## 快速上手

### Vue 3

```vue
<script setup lang="ts">
import { GuideProvider, KProGuide, useGuide } from '@kpro/vue';

const guide = useGuide('dashboard');
</script>

<template>
  <button @click="guide.start()">开始引导</button>

  <GuideProvider id="dashboard">
    <KProGuide id="dashboard" :serial="1" title="概览" content="查看本周关键指标。">
      <div class="card">概览卡片</div>
    </KProGuide>

    <KProGuide id="dashboard" :serial="2" title="导出" content="点击导出报表。" placement="right">
      <button class="export-btn">导出报表</button>
    </KProGuide>
  </GuideProvider>
</template>
```

### React 18

```tsx
import { Guide, GuideProvider, useGuide } from '@kpro/react';

export function Dashboard() {
  const guide = useGuide('dashboard');

  return (
    <>
      <button onClick={() => guide.start()}>开始引导</button>

      <GuideProvider id="dashboard">
        <Guide id="dashboard" serial={1} title="概览" content="查看本周关键指标。">
          <div className="card">概览卡片</div>
        </Guide>

        <Guide id="dashboard" serial={2} title="导出" content="点击导出报表。" placement="right">
          <button className="export-btn">导出报表</button>
        </Guide>
      </GuideProvider>
    </>
  );
}
```

核心心智模型：

1. 把目标 DOM 放进 `Guide` 的**默认插槽**（Vue）或作为**子元素**（React），即完成元素与步骤的绑定。
2. 同一个 `id` 的多个 `Guide` 组成一个指引组，`serial` 决定步骤顺序。
3. 用 `useGuide(id)` 拿到控制器（`start` / `next` / `prev` / `goTo` / `stop` / `finish` / `dismiss` / `reset`）与状态（`current` / `isActive` / `isDismissed` / `steps` / `stepCount`）。

完整属性表、事件表、主题变量、持久化与 SSR 说明见 **[docs/guide.md](docs/guide.md)**。

---

## 技术选型

| 领域 | 选择 | 说明 |
| --- | --- | --- |
| 包管理 | pnpm workspaces | 通过 `workspace:*` 协议关联内部包 |
| 构建 | Vite 4 + vite-plugin-dts | 产出 ESM、CJS 与类型声明 |
| 单元测试 | Vitest | 与 Vite 共用配置，jsdom 环境渲染组件 |
| 类型 | TypeScript 5.3 | 公共契约单点定义为唯一事实来源 |
| 代码检查 | ESLint 8 + @typescript-eslint + eslint-plugin-vue / react-hooks | 覆盖 `.ts/.tsx/.vue/.cjs` |

> 仓库锁定 Vite 4 / Vitest 0.34 / ESLint 8 / TypeScript 5.3，以兼容 Node 16。

---

## 设计要点

**为什么要有 `@kpro/core`？**
若两个框架各自实现一遍指引逻辑，行为漂移几乎不可避免。把状态机、几何计算、DOM 追踪、持久化与样式全部放进框架无关的 core 后，Vue 与 React 层只剩下「注册步骤、绑定事件、渲染浮层」三件事，一致性由架构保证而非靠人工对齐。

**为什么用挖孔遮罩而不是克隆 DOM？**
克隆方案需要把目标元素的样式、滚动位置、伪元素、Canvas 内容逐一还原，任何一处遗漏都会导致视觉错位。挖孔方案不复制任何东西——透空区下方就是真实元素，一致性是天然的，而且用户可以直接点击、输入目标元素。

**状态订阅如何同时满足两个框架？**
内核实现为观察者模型（`subscribe` / `getSnapshot`），且快照引用在未变更时保持稳定。React 侧直接喂给 `useSyncExternalStore`，Vue 侧写入 `shallowRef`。两侧还能自动获得「组件树之外触发指引也能驱动界面」的能力。

---

## 浏览器支持

Chrome、Firefox、Safari、Edge 最新版本，以及各浏览器最近两个大版本。依赖 `ResizeObserver` 与 `requestAnimationFrame`，均为上述浏览器的长期可用特性。

---

## License

MIT
