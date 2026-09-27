import { describe, expect, it, vi } from 'vitest';
import {
  getElementRect,
  getViewport,
  isRectFullyVisible,
  observeElement,
  scrollIntoViewIfNeeded,
} from './rect';
import type { Rect } from '../types';

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

describe('getElementRect', () => {
  it('读取元素的视口矩形', () => {
    const el = document.createElement('div');
    mockRect(el, { top: 12, left: 34, width: 56, height: 78 });

    expect(getElementRect(el)).toEqual({ top: 12, left: 34, width: 56, height: 78 });
  });
});

describe('getViewport', () => {
  it('读取 window 尺寸', () => {
    expect(getViewport()).toEqual({ width: window.innerWidth, height: window.innerHeight });
  });
});

describe('isRectFullyVisible', () => {
  const viewport = { width: 1000, height: 800 };

  it('完整落在视口内时为 true', () => {
    expect(isRectFullyVisible({ top: 10, left: 10, width: 100, height: 50 }, viewport)).toBe(true);
  });

  it('任一方向越界即为 false', () => {
    expect(isRectFullyVisible({ top: -1, left: 10, width: 100, height: 50 }, viewport)).toBe(false);
    expect(isRectFullyVisible({ top: 10, left: -1, width: 100, height: 50 }, viewport)).toBe(false);
    expect(isRectFullyVisible({ top: 760, left: 10, width: 100, height: 50 }, viewport)).toBe(false);
    expect(isRectFullyVisible({ top: 10, left: 950, width: 100, height: 50 }, viewport)).toBe(false);
  });
});

describe('scrollIntoViewIfNeeded', () => {
  it('目标不在视口内时滚动到可见区域', () => {
    const el = document.createElement('div');
    const scrollIntoView = vi.fn();
    el.scrollIntoView = scrollIntoView;
    mockRect(el, { top: 5000, left: 10, width: 100, height: 40 });

    scrollIntoViewIfNeeded(el);

    expect(scrollIntoView).toHaveBeenCalledWith({
      block: 'center',
      inline: 'center',
      behavior: 'smooth',
    });
  });

  it('目标已完整可见时不滚动', () => {
    const el = document.createElement('div');
    const scrollIntoView = vi.fn();
    el.scrollIntoView = scrollIntoView;
    mockRect(el, { top: 10, left: 10, width: 100, height: 40 });

    scrollIntoViewIfNeeded(el);

    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});

describe('observeElement', () => {
  it('挂载时同步测量一次，并在矩形变化时回调', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    mockRect(el, { top: 10, left: 10, width: 100, height: 40 });

    const onUpdate = vi.fn();
    const stop = observeElement(el, onUpdate);

    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenLastCalledWith({ top: 10, left: 10, width: 100, height: 40 });

    mockRect(el, { top: 60, left: 10, width: 100, height: 40 });
    window.dispatchEvent(new Event('scroll'));
    expect(onUpdate).toHaveBeenCalledTimes(2);

    stop();
    el.remove();
  });

  it('矩形未变化时不重复回调', () => {
    const el = document.createElement('div');
    mockRect(el, { top: 10, left: 10, width: 100, height: 40 });

    const onUpdate = vi.fn();
    const stop = observeElement(el, onUpdate);

    window.dispatchEvent(new Event('scroll'));
    window.dispatchEvent(new Event('resize'));
    expect(onUpdate).toHaveBeenCalledTimes(1);

    stop();
  });

  it('取消追踪后不再回调，也不依赖已移除的元素', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    mockRect(el, { top: 10, left: 10, width: 100, height: 40 });

    const onUpdate = vi.fn();
    const stop = observeElement(el, onUpdate);
    stop();
    el.remove();

    mockRect(el, { top: 200, left: 10, width: 100, height: 40 });
    window.dispatchEvent(new Event('scroll'));

    expect(onUpdate).toHaveBeenCalledTimes(1);
  });
});