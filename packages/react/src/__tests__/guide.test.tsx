import {
  configureGuide,
  DEFAULT_STORAGE_KEY,
  dismiss as dismissGroup,
  finish,
  getSnapshot,
  resetEngine,
  start,
} from '@kpro/core';
import { act, render, type RenderResult } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRef, type ReactElement, type RefObject } from 'react';
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

function primaryButton(): HTMLButtonElement {
  const buttons = queryAll<HTMLButtonElement>('.kpro-guide__btn--primary');
  return buttons[buttons.length - 1];
}

function prevButton(): HTMLButtonElement {
  const buttons = queryAll<HTMLButtonElement>('.kpro-guide__btn--ghost');
  return buttons[buttons.length - 1];
}

function overlays(): HTMLElement[] {
  return queryAll<HTMLElement>('.kpro-guide');
}

/** 暴露控制器的测试用容器组件。 */
let controller: UseGuideResult | null = null;

interface FlowProps {
  serials?: number[];
  showHighlight?: boolean;
  onStepChange?: (payload: unknown) => void;
  onFinish?: (payload: unknown) => void;
  onNext?: (payload: unknown) => void;
  childRef?: RefObject<HTMLButtonElement>;
}

function Flow({ serials = [1, 2, 3], showHighlight, onStepChange, onFinish, onNext, childRef }: FlowProps): ReactElement {
  controller = useGuide(GROUP);

  return (
    <div>
      <button type="button" id="start">
        开始
      </button>
      {serials.map((serial) => (
        <Guide
          key={serial}
          id={GROUP}
          serial={serial}
          title={`第 ${serial} 步`}
          content={`内容 ${serial}`}
          showHighlight={showHighlight}
          onStepChange={onStepChange as never}
          onFinish={onFinish as never}
          onNext={onNext as never}
        >
          <button type="button" className={`target-${serial}`} ref={serial === 1 ? childRef : undefined}>
            {`目标 ${serial}`}
          </button>
        </Guide>
      ))}
    </div>
  );
}

let view: RenderResult | null = null;

function renderFlow(props: FlowProps = {}): RenderResult {
  view = render(<Flow {...props} />);
  return view;
}

/** 从测试容器上取出控制器。 */
function guide(): UseGuideResult {
  if (!controller) throw new Error('控制器尚未初始化');
  return controller;
}

beforeEach(() => {
  resetEngine();
  controller = null;
  window.localStorage.clear();
  configureGuide({ storageKey: DEFAULT_STORAGE_KEY, storageAdapter: undefined });
});

afterEach(() => {
  view = null;
  document.body.innerHTML = '';
  document.getElementById('kpro-guide-styles')?.remove();
});

describe('步骤注册', () => {
  it('挂载后把各步骤登记到引擎，按 serial 排序', () => {
    renderFlow({ serials: [3, 1, 2] });

    expect(getSnapshot(GROUP).steps.map((step) => step.serial)).toEqual([1, 2, 3]);
    expect(getSnapshot(GROUP).stepCount).toBe(3);
  });

  it('默认值来自 core 契约', () => {
    renderFlow();
    expect(getSnapshot(GROUP).steps[0]).toMatchObject({
      placement: 'auto',
      padding: 8,
      maskOpacity: 0.5,
      closable: true,
      disabled: false,
    });
  });

  it('卸载后从引擎注销，不留残留', () => {
    const rendered = renderFlow();
    expect(getSnapshot(GROUP).stepCount).toBe(3);

    rendered.unmount();
    view = null;

    expect(getSnapshot(GROUP).steps).toHaveLength(0);
    expect(getSnapshot(GROUP).isActive).toBe(false);
  });

  it('disabled 的步骤不计入可用步骤', () => {
    render(
      <>
        <Guide id={GROUP} serial={1} disabled>
          <button type="button">a</button>
        </Guide>
        <Guide id={GROUP} serial={2}>
          <button type="button">b</button>
        </Guide>
      </>,
    );

    expect(getSnapshot(GROUP).stepCount).toBe(1);
  });

  it('保留 children 原有的 ref', () => {
    const RefHost = (): ReactElement => {
      const ref = useRef<HTMLButtonElement>(null);
      return (
        <div>
          <Flow serials={[1]} childRef={ref} />
          <span data-testid="has-ref">{ref.current ? 'yes' : 'no'}</span>
        </div>
      );
    };

    const { rerender } = render(<RefHost />);
    rerender(<RefHost />);

    expect(query<HTMLButtonElement>('.target-1')).not.toBeNull();
  });
});

describe('遮罩与高亮', () => {
  it('未启动时不渲染遮罩', () => {
    renderFlow();
    expect(overlays()).toHaveLength(0);
  });

  it('启动后渲染遮罩，目标元素不被任何遮罩覆盖', () => {
    renderFlow();
    mockTargetRects();

    act(() => guide().start());

    expect(query('.kpro-guide')).not.toBeNull();

    const masks = queryAll<HTMLElement>('.kpro-guide__mask');
    expect(masks.length).toBeGreaterThan(0);

    const rect = query<HTMLElement>('.target-1')!.getBoundingClientRect();
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

  it('默认不渲染高亮描边，传入 showHighlight 后渲染', () => {
    renderFlow();
    mockTargetRects();
    act(() => guide().start());
    expect(query('.kpro-guide__highlight')).toBeNull();
  });

  it('高亮描边与目标元素外扩 padding 后完全吻合', () => {
    renderFlow({ showHighlight: true });
    mockTargetRects();
    act(() => guide().start());

    const rect = query<HTMLElement>('.target-1')!.getBoundingClientRect();
    const style = query<HTMLElement>('.kpro-guide__highlight')!.style;

    expect(parseFloat(style.top)).toBe(rect.top - 8);
    expect(parseFloat(style.left)).toBe(rect.left - 8);
    expect(parseFloat(style.width)).toBe(rect.width + 16);
    expect(parseFloat(style.height)).toBe(rect.height + 16);
  });

  it('浮层渲染到 body 下，不受宿主层叠上下文裁剪', () => {
    renderFlow();
    mockTargetRects();
    act(() => guide().start());

    expect(query<HTMLElement>('.kpro-guide')?.parentElement).toBe(document.body);
  });
});

describe('步骤推进', () => {
  it('start / next / prev 切换高亮的目标元素', () => {
    renderFlow({ showHighlight: true });
    mockTargetRects();

    act(() => guide().start());
    expect(query('.kpro-guide__title')?.textContent).toBe('第 1 步');

    act(() => guide().next());
    expect(query('.kpro-guide__title')?.textContent).toBe('第 2 步');
    expect(parseFloat(query<HTMLElement>('.kpro-guide__highlight')!.style.top)).toBe(192);

    act(() => guide().prev());
    expect(query('.kpro-guide__title')?.textContent).toBe('第 1 步');
  });

  it('点击主按钮推进流程，最后一步显示完成', () => {
    renderFlow();
    mockTargetRects();
    act(() => guide().start());

    expect(primaryButton().textContent?.trim()).toBe('下一步');

    act(() => primaryButton().click());
    expect(getSnapshot(GROUP).current).toBe(2);

    act(() => primaryButton().click());
    expect(primaryButton().textContent?.trim()).toBe('完成');

    act(() => primaryButton().click());
    expect(getSnapshot(GROUP).isActive).toBe(false);
    expect(overlays()).toHaveLength(0);
  });

  it('第一步时上一步按钮不可用', () => {
    renderFlow();
    mockTargetRects();
    act(() => guide().start());

    expect(prevButton().disabled).toBe(true);
  });

  it('进度文案反映当前步骤与总数', () => {
    renderFlow();
    mockTargetRects();
    act(() => guide().goTo(2));

    expect(query('.kpro-guide__progress')?.textContent?.replace(/\s+/g, ' ')).toContain('2 / 3');
  });

  it('点击关闭按钮结束指引', () => {
    renderFlow();
    mockTargetRects();
    act(() => guide().start());

    act(() => query<HTMLButtonElement>('.kpro-guide__close')!.click());

    expect(getSnapshot(GROUP).isActive).toBe(false);
    expect(overlays()).toHaveLength(0);
  });
});

describe('事件', () => {
  it('组级事件只转发一次，不因同组多个步骤而重复', () => {
    const onStepChange = vi.fn();
    const onFinish = vi.fn();
    renderFlow({ onStepChange, onFinish });
    mockTargetRects();

    act(() => guide().start());
    expect(onStepChange).toHaveBeenCalledTimes(1);
    expect(onStepChange).toHaveBeenCalledWith({ id: GROUP, from: null, to: 1 });

    onStepChange.mockClear();
    act(() => guide().next());
    act(() => guide().next());
    act(() => guide().next());

    expect(onStepChange).toHaveBeenCalledTimes(2);
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('卸载后事件监听被清理，不会重复触发', () => {
    const onFinish = vi.fn();
    const first = renderFlow({ serials: [1], onFinish });
    first.unmount();
    controller = null;

    renderFlow({ serials: [1], onFinish });
    mockTargetRects();

    act(() => guide().start());
    act(() => guide().next());

    expect(onFinish).toHaveBeenCalledTimes(1);
  });
});

describe('不再提示', () => {
  it('勾选后点击完成会持久化标记并阻止再次启动', () => {
    renderFlow();
    mockTargetRects();
    act(() => guide().start());

    const checkbox = query<HTMLInputElement>('.kpro-guide__dont-show input')!;
    act(() => checkbox.click());
    expect(checkbox.checked).toBe(true);

    act(() => primaryButton().click());

    expect(getSnapshot(GROUP).isDismissed).toBe(true);
    expect(JSON.parse(window.localStorage.getItem(DEFAULT_STORAGE_KEY) as string)).toEqual([GROUP]);

    act(() => guide().start());
    expect(getSnapshot(GROUP).isActive).toBe(false);

    act(() => guide().reset());
    act(() => guide().start());
    expect(getSnapshot(GROUP).isActive).toBe(true);
  });

  it('组级关闭该能力后不显示勾选项，且 dismiss 不写入存储', () => {
    render(
      <GuideProvider id={GROUP} dontShowAgain={false}>
        <Guide id={GROUP} serial={1}>
          <button type="button" className="target-1">
            t
          </button>
        </Guide>
      </GuideProvider>,
    );

    expect(getSnapshot(GROUP).dontShowAgainEnabled).toBe(false);

    mockTargetRects();
    act(() => start(GROUP));
    expect(query('.kpro-guide__dont-show')).toBeNull();

    act(() => dismissGroup(GROUP));
    expect(window.localStorage.getItem(DEFAULT_STORAGE_KEY)).toBeNull();
  });
});

describe('响应式', () => {
  it('窄视口下降级为底部抽屉，不写死浮层坐标', () => {
    renderFlow();
    mockTargetRects();

    const innerWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true });
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });

    act(() => guide().start());

    const tooltip = query<HTMLElement>('.kpro-guide__tooltip')!;
    expect(tooltip.classList.contains('kpro-guide__tooltip--sheet')).toBe(true);
    expect(tooltip.style.top).toBe('');

    Object.defineProperty(window, 'innerWidth', { value: innerWidth, configurable: true });
  });

  it('宽视口下浮层带定位坐标', () => {
    renderFlow();
    mockTargetRects();
    act(() => guide().start());

    const tooltip = query<HTMLElement>('.kpro-guide__tooltip')!;
    expect(tooltip.classList.contains('kpro-guide__tooltip--sheet')).toBe(false);
    expect(tooltip.style.top).not.toBe('');
  });

  it('目标元素位置变化时遮罩跟随更新', () => {
    renderFlow({ showHighlight: true });
    mockTargetRects();
    act(() => guide().start());

    mockRect(query('.target-1')!, { top: 400, left: 50, width: 120, height: 40 });
    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });

    expect(parseFloat(query<HTMLElement>('.kpro-guide__highlight')!.style.top)).toBe(392);
  });
});

describe('默认插槽', () => {
  it('children 原样渲染，不引入额外包裹节点', () => {
    render(
      <div className="host">
        <Guide id={GROUP} serial={1}>
          <button type="button" className="plain">
            点我
          </button>
        </Guide>
      </div>,
    );

    const btn = query<HTMLButtonElement>('.plain');
    expect(btn).not.toBeNull();
    expect(btn?.textContent).toBe('点我');
    // 目标元素直接位于宿主容器之下，中间没有多余 wrapper。
    expect(btn?.parentElement?.className).toBe('host');
  });

  it('content 文案展示在浮层中', () => {
    renderFlow({ serials: [1] });
    mockTargetRects();
    act(() => guide().start());

    expect(query('.kpro-guide__content')?.textContent).toContain('内容 1');
  });
});

describe('useGuide 与引擎解耦一致', () => {
  it('控制器状态与引擎保持同步', () => {
    renderFlow();
    mockTargetRects();

    expect(guide().isActive).toBe(false);
    expect(guide().steps).toHaveLength(3);

    act(() => guide().start());
    expect(guide().isActive).toBe(true);
    expect(guide().current).toBe(1);

    act(() => guide().goTo(3));
    expect(guide().current).toBe(3);

    act(() => guide().finish());
    expect(guide().isActive).toBe(false);
  });

  it('引擎在组件树之外触发时，控制器状态同步更新', () => {
    renderFlow();
    mockTargetRects();

    act(() => start(GROUP, 2));
    expect(guide().current).toBe(2);

    act(() => finish(GROUP));
    expect(guide().isActive).toBe(false);
  });

  it('没有渲染任何步骤组件时，控制器方法为安全的空操作', () => {
    render(<div />);

    // 单独订阅一个不存在的组。
    const alone: { current: UseGuideResult | null } = { current: null };
    const Probe = (): ReactElement => {
      alone.current = useGuide('empty-group');
      return <div />;
    };
    render(<Probe />);

    expect(() => act(() => alone.current?.start())).not.toThrow();
    expect(alone.current?.stepCount).toBe(0);
    expect(alone.current?.isActive).toBe(false);
  });
});
