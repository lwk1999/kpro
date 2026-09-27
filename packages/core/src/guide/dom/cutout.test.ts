import { describe, expect, it } from 'vitest';
import {
  computeCutoutRects,
  computeHole,
  computeOverlayLayout,
  computeTooltipPosition,
  isSheetLayout,
  resolvePlacement,
} from './cutout';
import { getElementRect } from './rect';
import type { Rect, Size } from '../types';

const VIEWPORT: Size = { width: 1000, height: 800 };

function rect(top: number, left: number, width: number, height: number): Rect {
  return { top, left, width, height };
}

/** 点是否被任意一块遮罩覆盖。 */
function isCovered(masks: Rect[], x: number, y: number): boolean {
  return masks.some(
    (mask) => x >= mask.left && x <= mask.left + mask.width && y >= mask.top && y <= mask.top + mask.height,
  );
}

describe('computeHole', () => {
  it('按 padding 外扩目标矩形', () => {
    const hole = computeHole(rect(100, 100, 200, 50), 10, VIEWPORT);
    expect(hole).toEqual(rect(90, 90, 220, 70));
  });

  it('外扩部分被裁剪到视口内', () => {
    expect(computeHole(rect(0, 0, 100, 100), 20, VIEWPORT)).toEqual(rect(0, 0, 120, 120));
    expect(computeHole(rect(700, 950, 100, 100), 20, VIEWPORT)).toEqual(rect(680, 930, 70, 120));
  });

  it('padding 为 0 时透空区与目标矩形完全一致', () => {
    const target = rect(120, 240, 300, 60);
    expect(computeHole(target, 0, VIEWPORT)).toEqual(target);
  });
});

describe('computeCutoutRects', () => {
  it('按 上 / 下 / 左 / 右 顺序拆出四块遮罩', () => {
    const hole = computeHole(rect(200, 300, 200, 100), 10, VIEWPORT);
    const masks = computeCutoutRects(hole, VIEWPORT);

    expect(masks).toEqual([
      rect(0, 0, 1000, 190),
      rect(310, 0, 1000, 490),
      rect(190, 0, 290, 120),
      rect(190, 510, 490, 120),
    ]);
  });

  it('浮层完全超出视口时返回空数组', () => {
    // 目标铺满整个视口，没有可绘制的遮罩。
    expect(computeCutoutRects(rect(0, 0, 1000, 800), VIEWPORT)).toEqual([]);
  });

  it('紧贴视口边缘的零面积遮罩块会被剔除', () => {
    // 透空区顶边为 0，上方遮罩高度为 0，应被剔除，只保留 下 / 左 / 右 三块。
    const masks = computeCutoutRects(rect(0, 100, 200, 100), VIEWPORT);

    expect(masks).toHaveLength(3);
    expect(masks.every((mask) => mask.width > 0 && mask.height > 0)).toBe(true);
  });
});

describe('computeOverlayLayout —— 高亮与目标 DOM 完全吻合', () => {
  it('透空区完整包含目标 DOM，且目标 DOM 不被任何遮罩覆盖', () => {
    const el = document.createElement('button');
    document.body.appendChild(el);

    const target: Rect = rect(320, 400, 180, 48);
    el.getBoundingClientRect = () =>
      ({
        ...target,
        right: target.left + target.width,
        bottom: target.top + target.height,
        x: target.left,
        y: target.top,
        toJSON: () => target,
      }) as DOMRect;

    // 目标 DOM 的真实矩形与遮罩层使用同一套测量方式。
    const measured = getElementRect(el);
    const layout = computeOverlayLayout({
      target: measured,
      viewport: VIEWPORT,
      tooltip: { width: 320, height: 140 },
      padding: 8,
      placement: 'auto',
    });

    // 1. 透空区在目标 DOM 之外均匀外扩 padding。
    expect(layout.hole).toEqual(rect(312, 392, 196, 64));

    // 2. 目标 DOM 的四角与中心都没有被遮罩覆盖 —— 真实元素因此保持原样可见。
    const corners = [
      [measured.left, measured.top],
      [measured.left + measured.width, measured.top],
      [measured.left, measured.top + measured.height],
      [measured.left + measured.width, measured.top + measured.height],
      [measured.left + measured.width / 2, measured.top + measured.height / 2],
    ];
    corners.forEach(([x, y]) => expect(isCovered(layout.masks, x, y)).toBe(false));

    // 3. 透空区之外仍被遮罩覆盖。
    expect(isCovered(layout.masks, 10, 10)).toBe(true);
    expect(isCovered(layout.masks, 990, 790)).toBe(true);

    el.remove();
  });

  it('padding 为 0 时透空区与目标 DOM 位置尺寸完全相同', () => {
    const target = rect(500, 250, 120, 40);
    const layout = computeOverlayLayout({
      target,
      viewport: VIEWPORT,
      tooltip: { width: 0, height: 0 },
      padding: 0,
      placement: 'bottom',
    });

    expect(layout.hole).toEqual(target);
  });
});

describe('resolvePlacement', () => {
  const tooltip: Size = { width: 320, height: 140 };

  it('显式方位直接返回', () => {
    expect(resolvePlacement(rect(0, 0, 10, 10), tooltip, 'left', VIEWPORT)).toBe('left');
  });

  it('auto 优先选择下方', () => {
    expect(resolvePlacement(rect(100, 100, 100, 40), tooltip, 'auto', VIEWPORT)).toBe('bottom');
  });

  it('下方空间不足时翻转到上方', () => {
    expect(resolvePlacement(rect(700, 100, 100, 40), tooltip, 'auto', VIEWPORT)).toBe('top');
  });

  it('所有方位都放不下时兜底选择可用空间最大的一侧', () => {
    const viewport: Size = { width: 400, height: 300 };
    const target = rect(130, 300, 60, 40);
    // 上/下各 130，右 40，左 300，均放不下 320x140 的浮层，兜底取空间最大的左侧。
    expect(resolvePlacement(target, tooltip, 'auto', viewport)).toBe('left');
  });
});

describe('computeTooltipPosition', () => {
  it('按方位计算并居中于目标', () => {
    const target = rect(200, 400, 200, 100);
    const tooltip: Size = { width: 320, height: 140 };

    expect(computeTooltipPosition(target, tooltip, 'bottom', VIEWPORT)).toEqual({ top: 312, left: 340 });
    expect(computeTooltipPosition(target, tooltip, 'top', VIEWPORT)).toEqual({ top: 48, left: 340 });
    expect(computeTooltipPosition(target, tooltip, 'right', VIEWPORT)).toEqual({ top: 180, left: 612 });
    expect(computeTooltipPosition(target, tooltip, 'left', VIEWPORT)).toEqual({ top: 180, left: 68 });
  });

  it('浮层始终收敛在视口内', () => {
    const tooltip: Size = { width: 320, height: 140 };

    expect(computeTooltipPosition(rect(10, 0, 20, 20), tooltip, 'bottom', VIEWPORT).left).toBe(8);
    expect(computeTooltipPosition(rect(10, 980, 20, 20), tooltip, 'bottom', VIEWPORT).left).toBe(672);
    expect(computeTooltipPosition(rect(0, 400, 20, 20), tooltip, 'top', VIEWPORT).top).toBe(8);
    expect(computeTooltipPosition(rect(790, 400, 20, 20), tooltip, 'bottom', VIEWPORT).top).toBe(652);
  });
});

describe('响应式：窄视口降级为底部抽屉', () => {
  const narrow: Size = { width: 375, height: 667 };

  it('isSheetLayout 以 640px 为断点', () => {
    expect(isSheetLayout({ width: 640, height: 800 })).toBe(false);
    expect(isSheetLayout({ width: 639, height: 800 })).toBe(true);
  });

  it('抽屉布局下不返回浮层坐标，交由 CSS 接管', () => {
    const layout = computeOverlayLayout({
      target: rect(200, 100, 100, 40),
      viewport: narrow,
      tooltip: { width: 320, height: 140 },
      padding: 8,
      placement: 'auto',
    });

    expect(layout.sheet).toBe(true);
    expect(layout.tooltip).toBeNull();
  });

  it('宽视口下正常返回浮层坐标', () => {
    const layout = computeOverlayLayout({
      target: rect(200, 400, 100, 40),
      viewport: VIEWPORT,
      tooltip: { width: 320, height: 140 },
      padding: 8,
      placement: 'auto',
    });

    expect(layout.sheet).toBe(false);
    expect(layout.tooltip).not.toBeNull();
  });
});