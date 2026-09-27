import {
  configureGuide,
  DEFAULT_STORAGE_KEY,
  finish,
  getSnapshot,
  resetEngine,
  start,
} from '@kpro/core';
import { mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick, shallowRef } from 'vue';
import { Guide } from '../guide/Guide';
import { GuideProvider } from '../guide/GuideProvider';
import { useGuide, type UseGuideResult } from '../guide/useGuide';

const GROUP = 'flow';

type Rect = { top: number; left: number; width: number; height: number };

/** jsdom 没有布局引擎，这里手动给元素设置视口矩形。 */
function mockRect(el: Element, rect: Rect): void {
  el.getBoundingClientRect = () =>
    ({
      ...rect,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
      x: rect.left,
      y: rect.top,
      toJSON: () => rect,
    }) as DOMRect;
}

/** 给所有步骤的目标元素设置互不相同的矩形（serial * 100）。 */
function mockTargetRects(): void {
  [1, 2, 3].forEach((serial) => {
    const el = document.querySelector(`.target-${serial}`);
    if (el) mockRect(el, { top: 100 * serial, left: 50, width: 120, height: 40 });
  });
}

function query<T extends Element>(selector: string): T | null {
  return document.querySelector<T>(selector);
}

function queryAll<T extends Element>(selector: string): T[] {
  return Array.from(document.querySelectorAll<T>(selector));
}

/** 主操作按钮（下一步 / 完成）。 */
function primaryButton(): HTMLButtonElement {
  const buttons = queryAll<HTMLButtonElement>('.kpro-guide__btn--primary');
  return buttons[buttons.length - 1];
}

/** 上一步按钮。 */
function prevButton(): HTMLButtonElement {
  const buttons = queryAll<HTMLButtonElement>('.kpro-guide__btn--ghost');
  return buttons[buttons.length - 1];
}

/** 步骤组件 + 内部控制器的应用。 */
function createFlow(serials: number[] = [1, 2, 3], listeners: Record<string, unknown> = {}) {
  return defineComponent({
    name: 'FlowApp',
    setup() {
      const guide = useGuide(GROUP);
      return { guide };
    },
    render() {
      return h('div', [
        h('button', { id: 'start' }, '开始'),
        ...serials.map((serial) =>
          h(
            Guide,
            { id: GROUP, serial, title: `第 ${serial} 步`, content: `内容 ${serial}`, ...listeners },
            { default: () => h('button', { class: `target-${serial}` }, `目标 ${serial}`) },
          ),
        ),
      ]);
    },
  });
}

let wrapper: VueWrapper | null = null;

function mountFlow(serials?: number[], listeners?: Record<string, unknown>): VueWrapper {
  wrapper = mount(createFlow(serials, listeners), { attachTo: document.body });
  return wrapper;
}

/** 从组件实例上取出控制器。 */
function guideOf(target: VueWrapper): UseGuideResult {
  return (target.vm as unknown as { guide: UseGuideResult }).guide;
}

function overlays(): HTMLElement[] {
  return queryAll<HTMLElement>('.kpro-guide');
}

beforeEach(() => {
  resetEngine();
  window.localStorage.clear();
  configureGuide({ storageKey: DEFAULT_STORAGE_KEY, storageAdapter: undefined });
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
  document.body.innerHTML = '';
  document.getElementById('kpro-guide-styles')?.remove();
});

describe('步骤注册', () => {
  it('挂载后把各步骤登记到引擎，按 serial 排序', () => {
    mountFlow([3, 1, 2]);

    expect(getSnapshot(GROUP).steps.map((step) => step.serial)).toEqual([1, 2, 3]);
    expect(getSnapshot(GROUP).stepCount).toBe(3);
  });

  it('默认值来自 core 契约', () => {
    mountFlow();
    expect(getSnapshot(GROUP).steps[0]).toMatchObject({
      placement: 'auto',
      padding: 8,
      maskOpacity: 0.5,
      closable: true,
      disabled: false,
    });
  });

  it('卸载后从引擎注销，不留残留', () => {
    const flow = mountFlow();
    expect(getSnapshot(GROUP).stepCount).toBe(3);

    flow.unmount();
    wrapper = null;

    expect(getSnapshot(GROUP).steps).toHaveLength(0);
    expect(getSnapshot(GROUP).isActive).toBe(false);
  });

  it('disabled 的步骤不计入可用步骤', () => {
    wrapper = mount(
      defineComponent({
        render: () => [
          h(Guide, { id: GROUP, serial: 1, disabled: true }, { default: () => h('button', 'a') }),
          h(Guide, { id: GROUP, serial: 2 }, { default: () => h('button', 'b') }),
        ],
      }),
      { attachTo: document.body },
    );

    expect(getSnapshot(GROUP).stepCount).toBe(1);
  });
});

describe('遮罩与高亮', () => {
  it('未启动时不渲染遮罩', () => {
    mountFlow();
    expect(overlays()).toHaveLength(0);
  });

  it('启动后渲染遮罩，目标元素不被任何遮罩覆盖', async () => {
    const flow = mountFlow();
    mockTargetRects();

    guideOf(flow).start();
    await nextTick();

    expect(query('.kpro-guide')).not.toBeNull();

    const masks = queryAll<HTMLElement>('.kpro-guide__mask');
    expect(masks.length).toBeGreaterThan(0);

    const target = query<HTMLElement>('.target-1')!;
    const rect = target.getBoundingClientRect();
    const corners: Array<[number, number]> = [
      [rect.left, rect.top],
      [rect.left + rect.width, rect.top],
      [rect.left, rect.top + rect.height],
      [rect.left + rect.width, rect.top + rect.height],
      [rect.left + rect.width / 2, rect.top + rect.height / 2],
    ];

    const isCovered = (x: number, y: number): boolean =>
      masks.some((mask) => {
        const { top, left, width, height } = mask.style;
        return (
          x >= parseFloat(left) &&
          x <= parseFloat(left) + parseFloat(width) &&
          y >= parseFloat(top) &&
          y <= parseFloat(top) + parseFloat(height)
        );
      });

    corners.forEach(([x, y]) => expect(isCovered(x, y)).toBe(false));
    // 透空区之外仍被遮罩覆盖。
    expect(isCovered(10, 10)).toBe(true);
  });

  it('默认不渲染高亮描边，showHighlight 为 true 时渲染', async () => {
    const flow = mountFlow();
    mockTargetRects();
    guideOf(flow).start();
    await nextTick();
    expect(query('.kpro-guide__highlight')).toBeNull();
  });

  it('高亮描边与目标元素外扩 padding 后完全吻合', async () => {
    const flow = mountFlow(undefined, { showHighlight: true });
    mockTargetRects();
    guideOf(flow).start();
    await nextTick();

    const rect = query<HTMLElement>('.target-1')!.getBoundingClientRect();
    const style = query<HTMLElement>('.kpro-guide__highlight')!.style;

    expect(parseFloat(style.top)).toBe(rect.top - 8);
    expect(parseFloat(style.left)).toBe(rect.left - 8);
    expect(parseFloat(style.width)).toBe(rect.width + 16);
    expect(parseFloat(style.height)).toBe(rect.height + 16);
  });

  it('浮层渲染到 body 下，不受宿主层叠上下文裁剪', async () => {
    const flow = mountFlow();
    mockTargetRects();
    guideOf(flow).start();
    await nextTick();

    expect(query<HTMLElement>('.kpro-guide')?.parentElement).toBe(document.body);
  });
});

describe('步骤推进', () => {
  it('start / next / prev 切换高亮的目标元素', async () => {
    const flow = mountFlow(undefined, { showHighlight: true });
    mockTargetRects();

    guideOf(flow).start();
    await nextTick();
    expect(query('.kpro-guide__title')?.textContent).toBe('第 1 步');

    guideOf(flow).next();
    await nextTick();
    expect(query('.kpro-guide__title')?.textContent).toBe('第 2 步');
    expect(parseFloat(query<HTMLElement>('.kpro-guide__highlight')!.style.top)).toBe(192);

    guideOf(flow).prev();
    await nextTick();
    expect(query('.kpro-guide__title')?.textContent).toBe('第 1 步');
  });

  it('点击主按钮推进流程，最后一步显示完成', async () => {
    const flow = mountFlow();
    mockTargetRects();
    guideOf(flow).start();
    await nextTick();

    expect(primaryButton().textContent?.trim()).toBe('下一步');

    primaryButton().click();
    await nextTick();
    expect(getSnapshot(GROUP).current).toBe(2);

    primaryButton().click();
    await nextTick();
    expect(primaryButton().textContent?.trim()).toBe('完成');

    primaryButton().click();
    await nextTick();
    expect(getSnapshot(GROUP).isActive).toBe(false);
    expect(overlays()).toHaveLength(0);
  });

  it('第一步时上一步按钮不可用', async () => {
    const flow = mountFlow();
    mockTargetRects();
    guideOf(flow).start();
    await nextTick();

    expect(prevButton().disabled).toBe(true);
  });

  it('进度文案反映当前步骤与总数', async () => {
    const flow = mountFlow();
    mockTargetRects();
    guideOf(flow).goTo(2);
    await nextTick();

    expect(query('.kpro-guide__progress')?.textContent?.replace(/\s+/g, ' ')).toContain('2 / 3');
  });

  it('点击关闭按钮结束指引', async () => {
    const flow = mountFlow();
    mockTargetRects();
    guideOf(flow).start();
    await nextTick();

    query<HTMLButtonElement>('.kpro-guide__close')!.click();
    await nextTick();

    expect(getSnapshot(GROUP).isActive).toBe(false);
    expect(overlays()).toHaveLength(0);
  });
});

describe('事件', () => {
  it('组级事件只转发一次，不因同组多个步骤而重复', async () => {
    const onStepChange = vi.fn();
    const onFinish = vi.fn();
    const flow = mountFlow([1, 2, 3], { onStepChange, onFinish });
    mockTargetRects();

    guideOf(flow).start();
    await nextTick();

    expect(onStepChange).toHaveBeenCalledTimes(1);
    expect(onStepChange).toHaveBeenCalledWith({ id: GROUP, from: null, to: 1 });

    onStepChange.mockClear();
    guideOf(flow).next();
    await nextTick();
    guideOf(flow).next();
    await nextTick();
    guideOf(flow).next();
    await nextTick();

    expect(onStepChange).toHaveBeenCalledTimes(2);
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('卸载后事件监听被清理，不会重复触发', async () => {
    const onFinish = vi.fn();
    const first = mountFlow([1], { onFinish });
    first.unmount();

    // 重新挂载一组全新的步骤，事件应只由新实例触发一次。
    const second = mountFlow([1], { onFinish });
    mockTargetRects();

    guideOf(second).start();
    await nextTick();
    guideOf(second).next();
    await nextTick();

    expect(onFinish).toHaveBeenCalledTimes(1);
  });
});

describe('不再提示', () => {
  it('勾选后点击完成会持久化标记并阻止再次启动', async () => {
    const flow = mountFlow();
    mockTargetRects();
    guideOf(flow).start();
    await nextTick();

    const checkbox = query<HTMLInputElement>('.kpro-guide__dont-show input')!;
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));
    await nextTick();

    primaryButton().click();
    await nextTick();

    expect(getSnapshot(GROUP).isDismissed).toBe(true);
    expect(JSON.parse(window.localStorage.getItem(DEFAULT_STORAGE_KEY) as string)).toEqual([GROUP]);

    guideOf(flow).start();
    await nextTick();
    expect(getSnapshot(GROUP).isActive).toBe(false);

    guideOf(flow).reset();
    await nextTick();
    guideOf(flow).start();
    await nextTick();
    expect(getSnapshot(GROUP).isActive).toBe(true);
  });

  it('组级关闭该能力后不显示勾选项，且 dismiss 不写入存储', async () => {
    wrapper = mount(
      defineComponent({
        setup() {
          const guide = useGuide(GROUP);
          return { guide };
        },
        render() {
          return h(GuideProvider, { id: GROUP, dontShowAgain: false }, {
            default: () =>
              h(Guide, { id: GROUP, serial: 1 }, { default: () => h('button', { class: 'target-1' }, 't') }),
          });
        },
      }),
      { attachTo: document.body },
    );

    await nextTick();
    expect(getSnapshot(GROUP).dontShowAgainEnabled).toBe(false);

    mockTargetRects();
    guideOf(wrapper!).start();
    await nextTick();

    expect(query('.kpro-guide__dont-show')).toBeNull();

    guideOf(wrapper!).dismiss();
    await nextTick();
    expect(window.localStorage.getItem(DEFAULT_STORAGE_KEY)).toBeNull();
  });
});

describe('响应式', () => {
  it('窄视口下降级为底部抽屉，不写死浮层坐标', async () => {
    const flow = mountFlow();
    mockTargetRects();

    const innerWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true });
    window.dispatchEvent(new Event('resize'));

    guideOf(flow).start();
    await nextTick();

    const tooltip = query<HTMLElement>('.kpro-guide__tooltip')!;
    expect(tooltip.classList.contains('kpro-guide__tooltip--sheet')).toBe(true);
    expect(tooltip.style.top).toBe('');

    Object.defineProperty(window, 'innerWidth', { value: innerWidth, configurable: true });
  });

  it('宽视口下浮层带定位坐标', async () => {
    const flow = mountFlow();
    mockTargetRects();
    guideOf(flow).start();
    await nextTick();

    const tooltip = query<HTMLElement>('.kpro-guide__tooltip')!;
    expect(tooltip.classList.contains('kpro-guide__tooltip--sheet')).toBe(false);
    expect(tooltip.style.top).not.toBe('');
  });

  it('目标元素位置变化时遮罩跟随更新', async () => {
    const flow = mountFlow(undefined, { showHighlight: true });
    mockTargetRects();
    guideOf(flow).start();
    await nextTick();

    mockRect(query('.target-1')!, { top: 400, left: 50, width: 120, height: 40 });
    window.dispatchEvent(new Event('scroll'));
    await nextTick();

    expect(parseFloat(query<HTMLElement>('.kpro-guide__highlight')!.style.top)).toBe(392);
  });
});

describe('默认插槽', () => {
  it('插槽内容原样渲染，不引入额外包裹节点', () => {
    wrapper = mount(
      defineComponent({
        render: () =>
          h(Guide, { id: GROUP, serial: 1 }, { default: () => h('button', { class: 'plain' }, '点我') }),
      }),
      { attachTo: document.body },
    );

    const btn = query<HTMLButtonElement>('.plain');
    expect(btn).not.toBeNull();
    expect(btn?.textContent).toBe('点我');
    // 目标元素直接位于挂载容器之下，中间没有多余 wrapper。
    expect(btn?.parentElement?.tagName).toBe('DIV');
  });

  it('content 文案展示在浮层中', async () => {
    const flow = mountFlow([1]);
    mockTargetRects();
    guideOf(flow).start();
    await nextTick();

    expect(query('.kpro-guide__content')?.textContent).toContain('内容 1');
  });
});

describe('useGuide 与引擎解耦一致', () => {
  it('控制器状态与引擎保持同步', async () => {
    const flow = mountFlow();
    mockTargetRects();
    const guide = guideOf(flow);

    expect(guide.isActive).toBe(false);
    expect(guide.steps).toHaveLength(3);

    guide.start();
    await nextTick();
    expect(guide.isActive).toBe(true);
    expect(guide.current).toBe(1);

    guide.goTo(3);
    await nextTick();
    expect(guide.current).toBe(3);

    guide.finish();
    await nextTick();
    expect(guide.isActive).toBe(false);
  });

  it('没有渲染任何步骤组件时，控制器方法为安全的空操作', async () => {
    const probe = shallowRef<UseGuideResult | null>(null);

    wrapper = mount(
      defineComponent({
        setup() {
          probe.value = useGuide(GROUP);
          return () => h('div');
        },
      }),
      { attachTo: document.body },
    );

    const guide = probe.value!;
    expect(() => guide.start()).not.toThrow();
    expect(guide.isActive).toBe(false);
    expect(guide.stepCount).toBe(0);
  });

  it('引擎在组件树之外触发时，控制器状态同步更新', async () => {
    const flow = mountFlow();
    mockTargetRects();
    const guide = guideOf(flow);

    // 直接调用引擎动作，模拟外部驱动（例如路由守卫里触发引导）。
    start(GROUP, 2);
    await nextTick();
    expect(guide.current).toBe(2);

    finish(GROUP);
    await nextTick();
    expect(guide.isActive).toBe(false);
  });
});
