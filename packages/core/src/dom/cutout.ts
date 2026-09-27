/**
 * 挖孔遮罩几何计算。
 *
 * 遮罩由最多 4 块矩形拼成，目标元素所在的「透空区」不被任何遮罩覆盖，
 * 因此真实 DOM 保持可见、可交互，且位置与尺寸与原 DOM 天然完全一致。
 */

import { NARROW_VIEWPORT_WIDTH, type GuidePlacement, type GuidePlacementInput, type Rect, type Size } from '../types';

/** 浮层与目标元素之间的间距。 */
export const TOOLTIP_GAP = 12;
/** 浮层距离视口边缘的最小留白。 */
export const VIEWPORT_MARGIN = 8;
/** 方位选择的优先顺序。 */
const PLACEMENT_PRIORITY: readonly GuidePlacement[] = ['bottom', 'top', 'right', 'left'];

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

/** 把目标矩形按 `padding` 外扩，并裁剪到视口内，得到透空区。 */
export function computeHole(target: Rect, padding: number, viewport: Size): Rect {
  const left = Math.max(0, target.left - padding);
  const top = Math.max(0, target.top - padding);
  const right = Math.min(viewport.width, target.left + target.width + padding);
  const bottom = Math.min(viewport.height, target.top + target.height + padding);
  return {
    left,
    top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

/**
 * 由透空区推导出组成遮罩的矩形。
 *
 * 返回顺序固定为 上 / 下 / 左 / 右，零面积的分块会被剔除。
 */
export function computeCutoutRects(hole: Rect, viewport: Size): Rect[] {
  const holeRight = hole.left + hole.width;
  const holeBottom = hole.top + hole.height;
  const candidates: Rect[] = [
    // 上
    { left: 0, top: 0, width: viewport.width, height: hole.top },
    // 下
    { left: 0, top: holeBottom, width: viewport.width, height: viewport.height - holeBottom },
    // 左
    { left: 0, top: hole.top, width: hole.left, height: hole.height },
    // 右
    { left: holeRight, top: hole.top, width: viewport.width - holeRight, height: hole.height },
  ];
  return candidates.filter((rect) => rect.width > 0 && rect.height > 0);
}

/** 判断是否应降级为底部抽屉布局。 */
export function isSheetLayout(viewport: Size): boolean {
  return viewport.width < NARROW_VIEWPORT_WIDTH;
}

/**
 * 解析实际使用的浮层方位。
 *
 * `auto` 时按「能否完整放下浮层」优先选择 下 / 上 / 右 / 左；
 * 都放不下时选择可用空间最大的一侧。
 */
export function resolvePlacement(
  target: Rect,
  tooltip: Size,
  placement: GuidePlacementInput,
  viewport: Size,
): GuidePlacement {
  if (placement !== 'auto') return placement;

  const space: Record<GuidePlacement, number> = {
    bottom: viewport.height - (target.top + target.height),
    top: target.top,
    right: viewport.width - (target.left + target.width),
    left: target.left,
  };
  const need: Record<GuidePlacement, number> = {
    bottom: tooltip.height + TOOLTIP_GAP,
    top: tooltip.height + TOOLTIP_GAP,
    right: tooltip.width + TOOLTIP_GAP,
    left: tooltip.width + TOOLTIP_GAP,
  };

  for (const candidate of PLACEMENT_PRIORITY) {
    if (space[candidate] >= need[candidate]) return candidate;
  }
  return PLACEMENT_PRIORITY.reduce((best, current) =>
    space[current] > space[best] ? current : best,
  );
}

/** 计算浮层左上角坐标，并收敛到视口内。 */
export function computeTooltipPosition(
  target: Rect,
  tooltip: Size,
  placement: GuidePlacement,
  viewport: Size,
): { top: number; left: number } {
  let top = 0;
  let left = 0;

  switch (placement) {
    case 'top':
      top = target.top - TOOLTIP_GAP - tooltip.height;
      left = target.left + target.width / 2 - tooltip.width / 2;
      break;
    case 'bottom':
      top = target.top + target.height + TOOLTIP_GAP;
      left = target.left + target.width / 2 - tooltip.width / 2;
      break;
    case 'left':
      top = target.top + target.height / 2 - tooltip.height / 2;
      left = target.left - TOOLTIP_GAP - tooltip.width;
      break;
    case 'right':
      top = target.top + target.height / 2 - tooltip.height / 2;
      left = target.left + target.width + TOOLTIP_GAP;
      break;
  }

  return {
    top: clamp(top, VIEWPORT_MARGIN, viewport.height - tooltip.height - VIEWPORT_MARGIN),
    left: clamp(left, VIEWPORT_MARGIN, viewport.width - tooltip.width - VIEWPORT_MARGIN),
  };
}

/** `computeOverlayLayout` 的入参。 */
export interface OverlayLayoutInput {
  /** 目标元素的视口矩形。 */
  target: Rect;
  /** 视口尺寸。 */
  viewport: Size;
  /** 浮层自身尺寸（需先渲染后测量）。 */
  tooltip: Size;
  /** 高亮区外扩像素。 */
  padding: number;
  /** 期望方位。 */
  placement: GuidePlacementInput;
}

/** 遮罩与浮层的完整布局结果。 */
export interface OverlayLayout {
  /** 透空区。 */
  hole: Rect;
  /** 组成遮罩的矩形。 */
  masks: Rect[];
  /** 实际使用的浮层方位。 */
  placement: GuidePlacement;
  /** 是否降级为底部抽屉（此时 `tooltip` 为 null，位置交由 CSS 接管）。 */
  sheet: boolean;
  /** 浮层左上角坐标；抽屉布局下为 null。 */
  tooltip: { top: number; left: number } | null;
}

/**
 * 一次算出遮罩与浮层的完整布局。
 * Vue 与 React 两端共用此函数，保证两个框架的视觉与定位行为完全一致。
 */
export function computeOverlayLayout(input: OverlayLayoutInput): OverlayLayout {
  const { target, viewport, tooltip, padding, placement } = input;
  const hole = computeHole(target, padding, viewport);
  const masks = computeCutoutRects(hole, viewport);
  const sheet = isSheetLayout(viewport);
  const resolved = resolvePlacement(target, tooltip, placement, viewport);
  return {
    hole,
    masks,
    placement: resolved,
    sheet,
    tooltip: sheet ? null : computeTooltipPosition(target, tooltip, resolved, viewport),
  };
}