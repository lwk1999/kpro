import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createController,
  dismiss,
  finish,
  getSnapshot,
  goTo,
  next,
  normalizeStep,
  prev,
  registerStep,
  reset,
  resetEngine,
  setGroupOptions,
  start,
  stop,
  subscribe,
  subscribeEvent,
  unregisterStep,
} from './engine';
import { isGuideDismissed } from './storage';

const GROUP = 'main';

function step(serial: number, overrides: Record<string, unknown> = {}) {
  return normalizeStep({ id: GROUP, serial, ...overrides });
}

function registerSerials(...serials: number[]): void {
  serials.forEach((serial) => registerStep(step(serial)));
}

beforeEach(() => {
  resetEngine();
  window.localStorage.clear();
});

describe('normalizeStep', () => {
  it('补齐默认值，且保留调用方传入的值', () => {
    const full = normalizeStep({ id: GROUP, serial: 1 });
    expect(full).toMatchObject({
      placement: 'auto',
      padding: 8,
      showHighlight: false,
      maskOpacity: 0.5,
      closable: true,
      showDontShowAgain: true,
      disabled: false,
      autoScroll: true,
    });

    const custom = normalizeStep({ id: GROUP, serial: 2, padding: 20, placement: 'left' });
    expect(custom.padding).toBe(20);
    expect(custom.placement).toBe('left');
  });
});

describe('步骤注册表', () => {
  it('按 serial 升序返回步骤，与注册顺序无关', () => {
    registerStep(step(3));
    registerStep(step(1));
    registerStep(step(2));

    expect(getSnapshot(GROUP).steps.map((item) => item.serial)).toEqual([1, 2, 3]);
  });

  it('stepCount 不包含 disabled 的步骤', () => {
    registerStep(step(1));
    registerStep(step(2, { disabled: true }));
    registerStep(step(3));

    const snapshot = getSnapshot(GROUP);
    expect(snapshot.steps).toHaveLength(3);
    expect(snapshot.stepCount).toBe(2);
  });

  it('重复注册同一 serial 视为更新', () => {
    registerStep(step(1, { title: '旧' }));
    registerStep(step(1, { title: '新' }));

    const snapshot = getSnapshot(GROUP);
    expect(snapshot.steps).toHaveLength(1);
    expect(snapshot.steps[0].title).toBe('新');
  });

  it('同一版本内快照引用保持稳定，状态变化后失效', () => {
    registerStep(step(1));
    const first = getSnapshot(GROUP);
    expect(getSnapshot(GROUP)).toBe(first);

    registerStep(step(2));
    expect(getSnapshot(GROUP)).not.toBe(first);
  });

  it('注销步骤会通知订阅者', () => {
    const listener = vi.fn();
    registerStep(step(1));
    const unsubscribe = subscribe(GROUP, listener);

    unregisterStep(GROUP, 1);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getSnapshot(GROUP).steps).toHaveLength(0);

    unsubscribe();
    registerStep(step(2));
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('流程推进', () => {
  it('start 激活首个可用步骤', () => {
    registerSerials(1, 2);
    start(GROUP);

    expect(getSnapshot(GROUP)).toMatchObject({ isActive: true, current: 1 });
  });

  it('start 可指定起始 serial，非法 serial 回落到首个步骤', () => {
    registerSerials(1, 2, 3);
    start(GROUP, 2);
    expect(getSnapshot(GROUP).current).toBe(2);

    start(GROUP, 99);
    expect(getSnapshot(GROUP).current).toBe(1);
  });

  it('没有注册任何步骤时 start 不生效', () => {
    start(GROUP);
    expect(getSnapshot(GROUP).isActive).toBe(false);
  });

  it('disabled 的步骤会被 start / next / prev 跳过', () => {
    registerStep(step(1));
    registerStep(step(2, { disabled: true }));
    registerStep(step(3));

    start(GROUP);
    expect(getSnapshot(GROUP).current).toBe(1);

    next(GROUP);
    expect(getSnapshot(GROUP).current).toBe(3);

    prev(GROUP);
    expect(getSnapshot(GROUP).current).toBe(1);
  });

  it('next 在最后一步时自动结束并触发 finish', () => {
    const onFinish = vi.fn();
    subscribeEvent(GROUP, 'finish', onFinish);
    registerSerials(1, 2);
    start(GROUP);
    next(GROUP);

    expect(getSnapshot(GROUP).current).toBe(2);
    next(GROUP);

    expect(getSnapshot(GROUP)).toMatchObject({ isActive: false, current: null });
    expect(onFinish).toHaveBeenCalledWith({ id: GROUP });
  });

  it('prev 在第一步时不动作', () => {
    registerSerials(1, 2);
    start(GROUP);
    prev(GROUP);

    expect(getSnapshot(GROUP).current).toBe(1);
  });

  it('未激活时 next / prev 不动作', () => {
    registerSerials(1, 2);
    next(GROUP);
    prev(GROUP);

    expect(getSnapshot(GROUP).isActive).toBe(false);
  });

  it('goTo 可跳转，忽略不存在或已禁用的步骤', () => {
    registerStep(step(1));
    registerStep(step(2, { disabled: true }));
    registerStep(step(3));

    goTo(GROUP, 3);
    expect(getSnapshot(GROUP)).toMatchObject({ isActive: true, current: 3 });

    goTo(GROUP, 2);
    expect(getSnapshot(GROUP).current).toBe(3);

    goTo(GROUP, 99);
    expect(getSnapshot(GROUP).current).toBe(3);
  });

  it('stop 关闭指引并触发 close，finish 触发 finish', () => {
    const onClose = vi.fn();
    const onFinish = vi.fn();
    subscribeEvent(GROUP, 'close', onClose);
    subscribeEvent(GROUP, 'finish', onFinish);

    registerSerials(1, 2);
    start(GROUP);
    stop(GROUP);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onFinish).not.toHaveBeenCalled();

    start(GROUP);
    finish(GROUP);
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('未激活时 stop / finish 不重复触发事件', () => {
    const onClose = vi.fn();
    subscribeEvent(GROUP, 'close', onClose);
    stop(GROUP);
    finish(GROUP);

    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('事件', () => {
  it('step-change 携带正确的 from / to', () => {
    const changes: Array<[number | null, number | null]> = [];
    const onFinish = vi.fn();
    subscribeEvent(GROUP, 'step-change', (payload) => changes.push([payload.from, payload.to]));
    subscribeEvent(GROUP, 'finish', onFinish);

    registerSerials(1, 2);
    start(GROUP);
    next(GROUP);
    next(GROUP);

    // 最后一步之后由 finish 收尾，不再产生 step-change。
    expect(changes).toEqual([
      [null, 1],
      [1, 2],
    ]);
    expect(onFinish).toHaveBeenCalledWith({ id: GROUP });
  });

  it('next / prev 在 step-change 之后触发', () => {
    const order: string[] = [];
    subscribeEvent(GROUP, 'step-change', () => order.push('step-change'));
    subscribeEvent(GROUP, 'next', () => order.push('next'));
    subscribeEvent(GROUP, 'prev', () => order.push('prev'));

    registerSerials(1, 2);
    start(GROUP);
    order.length = 0;

    next(GROUP);
    prev(GROUP);

    expect(order).toEqual(['step-change', 'next', 'step-change', 'prev']);
  });

  it('取消订阅后不再收到事件', () => {
    const handler = vi.fn();
    const unsubscribe = subscribeEvent(GROUP, 'finish', handler);
    unsubscribe();

    registerSerials(1);
    start(GROUP);
    finish(GROUP);

    expect(handler).not.toHaveBeenCalled();
  });
});

describe('不再提示', () => {
  it('dismiss 持久化标记、关闭指引并触发事件', () => {
    const onDontShowAgain = vi.fn();
    const onClose = vi.fn();
    subscribeEvent(GROUP, 'dont-show-again', onDontShowAgain);
    subscribeEvent(GROUP, 'close', onClose);

    registerSerials(1, 2);
    start(GROUP);
    dismiss(GROUP);

    expect(isGuideDismissed(GROUP)).toBe(true);
    expect(getSnapshot(GROUP)).toMatchObject({ isActive: false, current: null, isDismissed: true });
    expect(onDontShowAgain).toHaveBeenCalledWith({ id: GROUP });
    expect(onClose).toHaveBeenCalledWith({ id: GROUP });
  });

  it('已被「不再提示」后 start 不再生效', () => {
    registerSerials(1);
    dismiss(GROUP);

    start(GROUP);
    expect(getSnapshot(GROUP).isActive).toBe(false);
  });

  it('reset 清除标记后可再次启动', () => {
    registerSerials(1);
    dismiss(GROUP);
    reset(GROUP);

    expect(isGuideDismissed(GROUP)).toBe(false);
    start(GROUP);
    expect(getSnapshot(GROUP).isActive).toBe(true);
  });

  it('组级关闭该能力时不写入存储', () => {
    setGroupOptions(GROUP, { dontShowAgain: false });
    registerSerials(1);
    dismiss(GROUP);

    expect(isGuideDismissed(GROUP)).toBe(false);
    expect(getSnapshot(GROUP)).toMatchObject({ isDismissed: false, dontShowAgainEnabled: false });
  });
});

describe('动态注销', () => {
  it('注销当前激活步骤时自动前进到下一个可用步骤', () => {
    registerSerials(1, 2, 3);
    start(GROUP);

    unregisterStep(GROUP, 1);
    expect(getSnapshot(GROUP)).toMatchObject({ isActive: true, current: 2 });
  });

  it('注销最后一个步骤后退出激活态', () => {
    registerSerials(1);
    start(GROUP);
    unregisterStep(GROUP, 1);

    expect(getSnapshot(GROUP)).toMatchObject({ isActive: false, current: null });
  });
});

describe('createController', () => {
  it('暴露与快照一致的只读状态，并提供全部动作', () => {
    const controller = createController(GROUP);
    registerSerials(1, 2);

    expect(controller.id).toBe(GROUP);
    expect(controller.steps).toHaveLength(2);
    expect(controller.stepCount).toBe(2);
    expect(controller.isActive).toBe(false);
    expect(controller.current).toBeNull();

    controller.start();
    expect(controller.isActive).toBe(true);
    expect(controller.current).toBe(1);

    controller.next();
    expect(controller.current).toBe(2);

    controller.finish();
    expect(controller.isActive).toBe(false);
  });
});