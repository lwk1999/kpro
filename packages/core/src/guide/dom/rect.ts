/** 目标元素几何测量与实时追踪。 */

import type { Rect, Size } from '../types';

/** 读取当前视口尺寸。 */
export function getViewport(): Size {
  if (typeof window === 'undefined') return { width: 0, height: 0 };
  return {
    width: window.innerWidth || document.documentElement.clientWidth || 0,
    height: window.innerHeight || document.documentElement.clientHeight || 0,
  };
}

/** 读取元素在视口坐标系下的矩形。 */
export function getElementRect(el: Element): Rect {
  const raw = el.getBoundingClientRect();
  return {
    top: raw.top,
    left: raw.left,
    width: raw.width,
    height: raw.height,
  };
}

/** 元素是否完整落在视口内。 */
export function isRectFullyVisible(rect: Rect, viewport: Size): boolean {
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.top + rect.height <= viewport.height &&
    rect.left + rect.width <= viewport.width
  );
}

/** 若元素不在视口内则滚动到可见区域（居中）。 */
export function scrollIntoViewIfNeeded(el: HTMLElement): void {
  if (isRectFullyVisible(getElementRect(el), getViewport())) return;
  // 旧环境或测试环境下可能未实现 scrollIntoView。
  if (typeof el.scrollIntoView === 'function') {
    el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
  }
}

function rectKey(rect: Rect): string {
  return `${rect.top}|${rect.left}|${rect.width}|${rect.height}`;
}

/**
 * 持续追踪目标元素的视口矩形，仅在矩形实际发生变化时回调。
 *
 * 三重保障：`requestAnimationFrame` 逐帧比对（兜底捕获任意布局变化）、
 * `ResizeObserver`（元素自身尺寸变化）、`scroll`/`resize` 监听（滚动与窗口变化即时响应）。
 * `scroll` 使用捕获阶段，因此元素位于内层滚动容器时同样有效。
 *
 * @returns 取消追踪的函数。
 */
export function observeElement(el: HTMLElement, onUpdate: (rect: Rect) => void): () => void {
  let lastKey = '';
  let rafId = 0;
  let stopped = false;

  const measure = (): void => {
    if (stopped) return;
    const rect = getElementRect(el);
    const key = rectKey(rect);
    if (key === lastKey) return;
    lastKey = key;
    onUpdate(rect);
  };

  const loop = (): void => {
    if (stopped) return;
    measure();
    rafId = requestAnimationFrame(loop);
  };

  window.addEventListener('scroll', measure, true);
  window.addEventListener('resize', measure);
  window.addEventListener('orientationchange', measure);

  let resizeObserver: ResizeObserver | null = null;
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(el);
  }

  // 先同步测量一次，避免首帧出现遮罩与目标错位。
  measure();
  if (typeof requestAnimationFrame === 'function') {
    rafId = requestAnimationFrame(loop);
  }

  return () => {
    stopped = true;
    if (rafId) cancelAnimationFrame(rafId);
    window.removeEventListener('scroll', measure, true);
    window.removeEventListener('resize', measure);
    window.removeEventListener('orientationchange', measure);
    resizeObserver?.disconnect();
  };
}