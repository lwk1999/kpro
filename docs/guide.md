# Guide 指引组件

`Guide`（指引）用于引导用户完成特定操作流程：把需要说明的目标 DOM 放进组件的默认插槽，即可将该元素与某个步骤关联。步骤激活时会显示半透明遮罩，并只高亮当前步骤的目标元素。

Vue 3 与 React 18 两个版本由同一套框架无关内核（`@kpro/core`）驱动，**属性名、默认值、事件名与控制器方法完全一致**，仅组件挂载写法不同。

---

## 目录

- [安装](#安装)
- [快速上手](#快速上手)
- [高亮与遮罩实现](#高亮与遮罩实现)
- [API](#api)
  - [Guide 属性](#guide-属性)
  - [Guide 事件](#guide-事件)
  - [GuideProvider 属性](#guideprovider-属性)
  - [useGuide 控制器](#useguide-控制器)
- [「不再提示」与持久化](#不再提示与持久化)
- [主题定制](#主题定制)
- [响应式与浏览器兼容](#响应式与浏览器兼容)
- [SSR 说明](#ssr-说明)
- [常见问题](#常见问题)

---

## 安装

```bash
# Vue 3
pnpm add @kpro/vue

# React 18
pnpm add @kpro/react
```

两个包都以 `@kpro/core` 作为依赖，样式由 `@kpro/core` 在首次渲染时自动注入（`<style id="kpro-guide-styles">`），**无需手动引入 CSS 文件**。

---

## 快速上手

### Vue 3

```vue
<script setup lang="ts">
import { GuideProvider, KProGuide, useGuide } from '@kpro/vue';

const guide = useGuide('dashboard');

function handleStepChange(payload: { from: number | null; to: number | null }) {
  console.log(`步骤切换：${payload.from ?? '无'} → ${payload.to ?? '结束'}`);
}
</script>

<template>
  <button @click="guide.start()">开始引导</button>

  <GuideProvider id="dashboard">
    <!-- 第 1 步：目标 DOM 写在默认插槽里 -->
    <KProGuide
      id="dashboard"
      :serial="1"
      title="概览"
      content="这里可以查看本周的关键指标。"
      @step-change="handleStepChange"
      @finish="() => console.log('引导完成')"
    >
      <div class="card">概览卡片</div>
    </KProGuide>

    <!-- 第 2 步 -->
    <KProGuide
      id="dashboard"
      :serial="2"
      title="导出"
      content="点击右上角按钮即可导出报表。"
      placement="right"
    >
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
        {/* 第 1 步：目标 DOM 作为子元素传入 */}
        <Guide
          id="dashboard"
          serial={1}
          title="概览"
          content="这里可以查看本周的关键指标。"
          onStepChange={(payload) => console.log(`步骤切换：${payload.from ?? '无'} → ${payload.to ?? '结束'}`)}
          onFinish={() => console.log('引导完成')}
        >
          <div className="card">概览卡片</div>
        </Guide>

        {/* 第 2 步 */}
        <Guide
          id="dashboard"
          serial={2}
          title="导出"
          content="点击右上角按钮即可导出报表。"
          placement="right"
        >
          <button className="export-btn">导出报表</button>
        </Guide>
      </GuideProvider>
    </>
  );
}
```

要点：

- **同一个 `id` 的多个 `Guide` 组成一个指引组**，`serial` 标识步骤顺序（从 `1` 开始，不要求连续，但排序按数值升序）。
- `Guide` **不产生额外的包裹 DOM 节点**：它对插槽/子元素做 `cloneVNode` / `cloneElement` 并附加 `ref`，原有的 `ref` 与事件都会被保留。
- 步骤注册是**自动**的：组件挂载即注册，卸载即注销。因此步骤列表由当前实际渲染的 `Guide` 决定——条件渲染即可实现动态步骤。
- 不同 `id` 的指引组相互独立，可同时激活，互不干扰。

---

## 高亮与遮罩实现

组件采用**挖孔遮罩（cutout mask）**方案，而不是「克隆 DOM 后重新定位」：

1. 浮层通过 Teleport（Vue）/ `createPortal`（React）挂载到 `document.body`，避免被祖先元素的 `overflow: hidden`、`transform` 层叠上下文裁剪。
2. 遮罩由最多 4 块矩形拼成——上、下、左、右——围绕目标元素的外扩矩形（`padding`），中间留出透空区域。
3. 透空区内的**真实 DOM 保持原样**：它没有被覆盖、没有被克隆，因此位置、尺寸、字体、滚动、交互（点击、输入、focus）都与页面完全一致，天然不存在「克隆元素与原元素对不齐」的问题。
4. 透空区之上叠加一个 `border: 2px solid` 的高亮环（`.kpro-guide__highlight`），`pointer-events: none`，只做视觉强调，不拦截点击。
5. 目标元素位置变化由 `ResizeObserver` + 滚动/窗口尺寸监听驱动，回调通过 `requestAnimationFrame` 节流，仅当矩形真正变化时才写回，避免布局抖动。

> 也就是说：**高亮区域内的元素是可以正常交互的**，这正是「用户能按指引直接操作目标元素」的关键。

---

## API

### Guide 属性

Vue 与 React 的属性名、类型、默认值完全一致（React 中 `children` 为单个元素，Vue 中为默认插槽）。

| 属性 | 类型 | 默认值 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `id` | `string` | — | 是 | 指引组标识，用于区分不同的指引组。同组内所有步骤必须使用相同的 `id`。 |
| `serial` | `number` | — | 是 | 当前步骤在整组指引流程中的顺序，从 `1` 开始。 |
| `title` | `string` | — | 否 | 步骤标题，显示在浮层顶部。 |
| `content` | `string` | — | 否 | 步骤说明文案。 |
| `placement` | `'top' \| 'right' \| 'bottom' \| 'left' \| 'auto'` | `'auto'` | 否 | 浮层相对目标元素的方位。`auto` 按 下 → 上 → 右 → 左 依次寻找可用空间，都不足时取空间最大的一侧。 |
| `padding` | `number` | `8` | 否 | 高亮区域相对目标元素外扩的像素值。 |
| `showHighlight` | `boolean` | `false` | 否 | 是否显示目标元素四周的蓝色高亮描边。默认不显示；设为 `true` 时会在透空区边缘叠加 2px 描边。 |
| `maskOpacity` | `number` | `0.5` | 否 | 遮罩不透明度，取值 `0 ~ 1`。 |
| `closable` | `boolean` | `true` | 否 | 是否显示右上角关闭按钮。 |
| `showDontShowAgain` | `boolean` | `true` | 否 | 是否显示「不再提示」勾选项。 |
| `disabled` | `boolean` | `false` | 否 | 为 `true` 时该步骤被流程跳过（不计入 `stepCount`）。 |
| `autoScroll` | `boolean` | `true` | 否 | 步骤激活时若目标不在视口内，自动滚动到可见区域。 |

> 提示：当 `padding` 较大导致透空区超出某条视口边界时，对应的遮罩块面积为零并被自动剔除，因此遮罩块数量可能是 1~4 块中的任意值。

### Guide 事件

Vue 使用 `@事件名`，React 使用对应的 `onXxx` 回调，载荷类型完全一致。

| 事件名 | React 回调 | 载荷 | 触发时机 |
| --- | --- | --- | --- |
| `step-change` | `onStepChange` | `{ id, from, to }` | 步骤切换时（`from` / `to` 为 `null` 表示未激活 / 已结束）。 |
| `next` | `onNext` | `{ id, from, to }` | 点击「下一步」。 |
| `prev` | `onPrev` | `{ id, from, to }` | 点击「上一步」。 |
| `finish` | `onFinish` | `{ id }` | 最后一步点击「完成」（由 `next()` 自动触发 `finish()`）。 |
| `close` | `onClose` | `{ id }` | 点击关闭按钮、点击遮罩，或调用 `stop()`。 |
| `dont-show-again` | `onDontShowAgain` | `{ id }` | 用户勾选「不再提示」并退出浮层时。 |

事件载荷中的 `id` 为指引组标识。

> **同组多步骤的事件出口**：一个指引组内可能有多个 `Guide` 组件，如果每个都转发事件就会重复触发。内核会指定「首个注册的步骤」作为该组唯一的事件出口（`eventOwner`），因此**只需给组内任意一个步骤绑定事件**即可，推荐绑定在 `serial = 1` 的步骤上。该步骤被注销时，出口会自动移交给下一个步骤。

### GuideProvider 属性

`GuideProvider` 是**可选**的组级容器，用于集中声明组级配置。不放置它时，`Guide` 与 `useGuide` 依然可用（内核自身按 `id` 维护分组）。

| 属性 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `id` | `string` | — | 该指引组的标识。 |
| `dontShowAgain` | `boolean` | `true` | 组级是否启用「不再提示」能力。设为 `false` 时，组内所有步骤都不显示该勾选项，`dismiss()` 也不会写入持久化（但仍会关闭浮层并触发 `dont-show-again`）。 |

### useGuide 控制器

`useGuide(id)` 订阅某个指引组的状态，并返回操作该组的控制器。两个框架返回的对象**字段与方法命名一致**，便于迁移。

状态字段以两种方式暴露：

- Vue：通过 getter 暴露，模板中直接读取 `guide.current` 即为响应式。
- React：通过 `useSyncExternalStore` 订阅，渲染中直接读取 `guide.current`。

| 成员 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `string` | 组标识。 |
| `steps` | `GuideStep[]` | 组内已注册的步骤（含 `disabled`），按 `serial` 升序；可用数量见 `stepCount`。 |
| `current` | `number \| null` | 当前激活步骤的 `serial`，未激活时为 `null`。 |
| `isActive` | `boolean` | 是否处于激活态（即是否显示遮罩）。 |
| `isDismissed` | `boolean` | 该指引组是否已被标记为「不再提示」。 |
| `stepCount` | `number` | 组内可用步骤数量。 |
| `snapshot` | `GuideGroupSnapshot`（React）/ `ShallowRef<GuideGroupSnapshot>`（Vue） | 完整只读快照，包含 `dontShowAgainEnabled`、`eventOwner` 等。 |
| `start(from?)` | `(from?: number) => void` | 开始指引，可指定起始 `serial`；已被「不再提示」时不会启动。 |
| `next()` | `() => void` | 进入下一步；已是最后一步时自动结束。 |
| `prev()` | `() => void` | 回到上一步；已是第一步时不动作。 |
| `goTo(serial)` | `(serial: number) => void` | 跳转到指定 `serial`；该步骤不存在或已禁用时不动作。 |
| `stop()` | `() => void` | 关闭指引（触发 `close`）。 |
| `finish()` | `() => void` | 结束指引（触发 `finish`）。 |
| `dismiss()` | `() => void` | 标记为「不再提示」、持久化并关闭（触发 `dont-show-again`，若原本激活还会触发 `close`）。 |
| `reset()` | `() => void` | 清除「不再提示」标记。 |

控制器可以在组件树之外使用，例如路由守卫中调用 `start()`，界面同样会响应（内核是独立于框架的观察者模型）。

`finish()` 只触发 `finish` 事件，不再额外产生 `step-change`。

---

## 「不再提示」与持久化

默认行为：

- 「不再提示」勾选项默认显示（`showDontShowAgain = true`）。
- 用户勾选并退出浮层后，该指引组的 `id` 会被写入 `localStorage`，键名 `kpro:guide:dismissed`，值为字符串数组，例如 `["onboarding"]`。
- 被标记后，再次调用 `start()` 不会启动，组件也不会显示遮罩。可通过 `reset()` 或 `restoreGuide(id)` 清除。

自定义存储：

```ts
import { configureGuide } from '@kpro/core';

// 1) 更换存储键
configureGuide({ storageKey: 'my-app:guide:dismissed' });

// 2) 接入任意后端（cookie、服务端接口、内存等）
configureGuide({
  storageAdapter: {
    read: (key) => myStore.getItem(key),
    write: (key, value) => myStore.setItem(key, value),
  },
});
```

其他工具函数：

| 函数 | 说明 |
| --- | --- |
| `isGuideDismissed(id)` | 查询某个指引组是否已被「不再提示」。 |
| `dismissGuide(id)` | 标记为「不再提示」。 |
| `restoreGuide(id)` | 清除某个指引组的标记。 |
| `clearDismissedGuides()` | 清空全部标记。 |

在无 `localStorage` 的环境（SSR、隐私模式、写入被拒）下，组件会**自动退化为内存实现**，不会抛错，只是刷新后不再保留。

---

## 主题定制

浮层根节点带有 `.kpro-guide` 类，样式通过 CSS 变量暴露。用相同或更高优先级的规则覆盖即可：

```css
.kpro-guide {
  --kpro-mask-bg: rgba(0, 0, 0);
  --kpro-mask-opacity: 0.5;
  --kpro-primary: #2f6bff;
  --kpro-tooltip-bg: #ffffff;
  --kpro-tooltip-color: #1f2430;
  --kpro-tooltip-radius: 10px;
  --kpro-tooltip-shadow: 0 12px 32px rgba(15, 23, 42, 0.24);
  --kpro-z-index: 9999;
}
```

主要类名（Vue / React 完全一致）：

| 类名 | 作用 |
| --- | --- |
| `.kpro-guide` | 浮层根容器（`position: fixed; inset: 0`）。 |
| `.kpro-guide__mask` | 组成挖孔效果的单块遮罩矩形。 |
| `.kpro-guide__highlight` | 高亮环。 |
| `.kpro-guide__tooltip` | 提示框容器；窄屏下追加 `--sheet` 修饰类。 |
| `.kpro-guide__title` / `__content` | 标题 / 正文。 |
| `.kpro-guide__footer` / `__progress` / `__actions` | 底部区、进度文案、按钮区。 |
| `.kpro-guide__btn` / `--primary` / `--ghost` | 按钮样式。 |
| `.kpro-guide__close` | 关闭按钮。 |
| `.kpro-guide__dont-show` | 「不再提示」勾选区。 |

组件已内置 `@media (prefers-reduced-motion: reduce)` 规则，系统开启「减少动态效果」时会关闭过渡动画。

---

## 响应式与浏览器兼容

- **窄屏降级**：视口宽度小于 `640px`（`NARROW_VIEWPORT_WIDTH`）时，提示框自动从跟随目标改为**底部抽屉**样式（`.kpro-guide__tooltip--sheet`），宽度铺满视口并贴底，同时适配 `env(safe-area-inset-bottom)` 以避开 iPhone 底部横条。
- **视口边界收敛**：提示框定位会收敛在视口内（留 `8px` 边距），不会溢出屏幕。
- **尺寸变化跟随**：窗口缩放、容器尺寸变化、页面滚动、设备旋转都会实时更新高亮与提示框位置。
- **浏览器支持**：Chrome / Firefox / Safari / Edge 最新版本，以及各浏览器的最近两个大版本。依赖 `ResizeObserver` 与 `requestAnimationFrame`，均为上述浏览器的长期可用特性。

---

## SSR 说明

- `@kpro/core` 在无 `document` / `window` 时不会注入样式、不会访问 `localStorage`，服务端渲染可安全导入。
- 遮罩通过 Teleport（Vue）/ `createPortal`（React）挂载到 `document.body`，因此**只在客户端渲染**，不会造成服务端与客户端 HTML 不一致（hydration mismatch）。
- 持久化的读取发生在客户端，服务端渲染时 `isDismissed` 为 `false`；若需要在首屏就按「不再提示」隐藏入口，建议在客户端挂载后再做判断。

---

## 常见问题

**Q：目标元素被遮住了，或者点击穿透失效？**
A：透空区内的元素始终可交互。若发现异常，请检查目标元素是否被祖先的 `transform` / `filter` 创建了新的层叠上下文（这会导致 `position: fixed` 的坐标系改变）。组件已将浮层挂到 `body`，但**目标元素自身**若处于此类容器中，请以该容器作为插槽目标。

**Q：同一个 `id` 的事件触发了多次？**
A：请只给一个 `Guide` 绑定事件（推荐 `serial = 1`）。内核已通过 `eventOwner` 去重，但绑定在多个步骤上时每个步骤的注册时机不同，仍建议只绑一个。

**Q：步骤顺序不是 1、2、3？**
A：`serial` 只要求唯一且可排序，不必连续。例如 `10 / 20 / 30` 是合法的，流程按升序执行。

**Q：某个步骤想临时跳过？**
A：给该步骤设 `disabled`，它会从流程中排除，直到该属性变回 `false`（此时组件重新注册，位置回到正确顺序）。

**Q：如何实现「首次进入自动引导」？**
A：

```ts
// Vue / React 通用
const guide = useGuide('dashboard');
onMounted(() => {          // React: useEffect
  if (!guide.isDismissed) guide.start();
});
```
