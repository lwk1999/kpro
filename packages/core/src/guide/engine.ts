/**
 * 指引引擎 —— 与框架无关的核心状态机。
 *
 * 以 `id` 为键维护多个指引组，每组内含按 `serial` 排序的步骤。
 * 对外只暴露「订阅 / 取快照」两个读接口，因此 React 的 `useSyncExternalStore`
 * 与 Vue 的 `ref` 都能直接消费同一份状态，两端行为因此完全一致。
 */

import { dismissGuide, isGuideDismissed, restoreGuide } from './storage';
import {
  GUIDE_STEP_DEFAULTS,
  type GuideEventMap,
  type GuideEventName,
  type GuideGroupSnapshot,
  type GuideStep,
  type GuideStepProps,
} from './types';

interface GroupState {
  id: string;
  /** serial -> 步骤 */
  steps: Map<number, GuideStep>;
  current: number | null;
  isActive: boolean;
  /** 组级是否启用「不再提示」能力，由 GuideProvider 设置。 */
  dontShowAgain: boolean;
  /** 负责转发组级事件的步骤 serial。 */
  ownerSerial: number | null;
  listeners: Set<() => void>;
  eventListeners: Map<GuideEventName, Set<(payload: unknown) => void>>;
  /** 缓存快照，保证未变更时引用稳定。 */
  snapshot: GuideGroupSnapshot | null;
  /** 变更计数，用于快照缓存失效。 */
  version: number;
}

const groups = new Map<string, GroupState>();

function createGroup(id: string): GroupState {
  return {
    id,
    steps: new Map(),
    current: null,
    isActive: false,
    dontShowAgain: true,
    ownerSerial: null,
    listeners: new Set(),
    eventListeners: new Map(),
    snapshot: null,
    version: 0,
  };
}

function getGroup(id: string): GroupState {
  let group = groups.get(id);
  if (!group) {
    group = createGroup(id);
    groups.set(id, group);
  }
  return group;
}

/** 通知订阅者状态已变更。 */
function notify(group: GroupState): void {
  group.version += 1;
  group.snapshot = null;
  group.listeners.forEach((listener) => listener());
}

/** 派发事件。 */
function emit<K extends GuideEventName>(group: GroupState, event: K, payload: GuideEventMap[K]): void {
  const handlers = group.eventListeners.get(event);
  if (!handlers) return;
  handlers.forEach((handler) => handler(payload));
}

/** 补齐默认值，得到引擎内部使用的完整步骤定义。 */
export function normalizeStep(props: GuideStepProps): GuideStep {
  return {
    id: props.id,
    serial: props.serial,
    title: props.title,
    content: props.content,
    placement: props.placement ?? GUIDE_STEP_DEFAULTS.placement,
    padding: props.padding ?? GUIDE_STEP_DEFAULTS.padding,
    showHighlight: props.showHighlight ?? GUIDE_STEP_DEFAULTS.showHighlight,
    maskOpacity: props.maskOpacity ?? GUIDE_STEP_DEFAULTS.maskOpacity,
    closable: props.closable ?? GUIDE_STEP_DEFAULTS.closable,
    showDontShowAgain: props.showDontShowAgain ?? GUIDE_STEP_DEFAULTS.showDontShowAgain,
    disabled: props.disabled ?? GUIDE_STEP_DEFAULTS.disabled,
    autoScroll: props.autoScroll ?? GUIDE_STEP_DEFAULTS.autoScroll,
  };
}

/** 按 serial 升序取出组内可用步骤（不含 disabled）。 */
function getEnabledSteps(group: GroupState): GuideStep[] {
  return Array.from(group.steps.values())
    .filter((step) => !step.disabled)
    .sort((a, b) => a.serial - b.serial);
}

/** 从 `fromSerial` 出发按 `direction` 找相邻的可用步骤。 */
function findAdjacent(group: GroupState, fromSerial: number, direction: 1 | -1): GuideStep | null {
  const enabled = getEnabledSteps(group);
  const index = enabled.findIndex((step) => step.serial === fromSerial);
  if (index === -1) {
    // 当前步骤已不可用，退回到最接近的可用步骤。
    return direction === 1 ? (enabled[0] ?? null) : (enabled[enabled.length - 1] ?? null);
  }
  return enabled[index + direction] ?? null;
}

/** 注册步骤（组不存在时自动创建）。 */
export function registerStep(step: GuideStep): void {
  const group = getGroup(step.id);
  group.steps.set(step.serial, step);
  if (group.ownerSerial === null) {
    group.ownerSerial = step.serial;
  }
  notify(group);
}

/** 注销步骤，并修正当前步骤、事件出口与激活状态。 */
export function unregisterStep(id: string, serial: number): void {
  const group = groups.get(id);
  if (!group) return;
  if (!group.steps.delete(serial)) return;

  // 事件出口注销后移交给组内剩余步骤。
  if (group.ownerSerial === serial) {
    const remaining = Array.from(group.steps.keys()).sort((a, b) => a - b);
    group.ownerSerial = remaining[0] ?? null;
  }

  if (group.current === serial) {
    const next = findAdjacent(group, serial, 1);
    group.current = next ? next.serial : null;
    if (!group.current) group.isActive = false;
  }
  if (group.steps.size === 0) {
    group.current = null;
    group.isActive = false;
  }
  notify(group);
}

/** 读取组的只读快照。同一版本内多次调用返回同一引用。 */
export function getSnapshot(id: string): GuideGroupSnapshot {
  const group = getGroup(id);
  if (group.snapshot) return group.snapshot;
  const steps = Array.from(group.steps.values()).sort((a, b) => a.serial - b.serial);
  group.snapshot = {
    id,
    steps,
    current: group.current,
    isActive: group.isActive,
    isDismissed: isGuideDismissed(id),
    dontShowAgainEnabled: group.dontShowAgain,
    stepCount: steps.filter((step) => !step.disabled).length,
    eventOwner: group.ownerSerial,
  };
  return group.snapshot;
}

/** 订阅组状态变化，返回取消订阅函数。 */
export function subscribe(id: string, listener: () => void): () => void {
  const group = getGroup(id);
  group.listeners.add(listener);
  return () => {
    group.listeners.delete(listener);
  };
}

/** 订阅组事件，返回取消订阅函数。 */
export function subscribeEvent<K extends GuideEventName>(
  id: string,
  event: K,
  handler: (payload: GuideEventMap[K]) => void,
): () => void {
  const group = getGroup(id);
  const existing = group.eventListeners.get(event);
  const handlers = existing ?? new Set<(payload: unknown) => void>();
  if (!existing) {
    group.eventListeners.set(event, handlers);
  }
  const typed = handler as (payload: unknown) => void;
  handlers.add(typed);
  return () => {
    handlers.delete(typed);
  };
}

/** 设置组级选项（由 GuideProvider 调用）。 */
export function setGroupOptions(id: string, options: { dontShowAgain?: boolean }): void {
  const group = getGroup(id);
  const next = options.dontShowAgain ?? group.dontShowAgain;
  if (next === group.dontShowAgain) return;
  group.dontShowAgain = next;
  notify(group);
}

/** 离开当前步骤：清空 current 与激活态。 */
function deactivate(group: GroupState): void {
  group.isActive = false;
  group.current = null;
}

/** 开始指引。已被「不再提示」时不会启动。 */
export function start(id: string, from?: number): void {
  const group = getGroup(id);
  if (isGuideDismissed(id)) return;

  const enabled = getEnabledSteps(group);
  if (enabled.length === 0) return;

  const requested = from ?? enabled[0].serial;
  const target = enabled.find((step) => step.serial === requested) ?? enabled[0];

  const previous = group.current;
  group.isActive = true;
  group.current = target.serial;
  notify(group);
  if (previous !== target.serial) {
    emit(group, 'step-change', { id, from: previous, to: target.serial });
  }
}

/** 进入下一步；已是最后一步时自动结束。 */
export function next(id: string): void {
  const group = getGroup(id);
  if (!group.isActive || group.current === null) return;

  const from = group.current;
  const target = findAdjacent(group, from, 1);
  if (!target) {
    finish(id);
    return;
  }
  group.current = target.serial;
  notify(group);
  const payload = { id, from, to: target.serial };
  emit(group, 'step-change', payload);
  emit(group, 'next', payload);
}

/** 回到上一步；已是第一步时不动作。 */
export function prev(id: string): void {
  const group = getGroup(id);
  if (!group.isActive || group.current === null) return;

  const from = group.current;
  const target = findAdjacent(group, from, -1);
  if (!target || target.serial === from) return;

  group.current = target.serial;
  notify(group);
  const payload = { id, from, to: target.serial };
  emit(group, 'step-change', payload);
  emit(group, 'prev', payload);
}

/** 跳转到指定 serial；该步骤不存在或已禁用时不动作。 */
export function goTo(id: string, serial: number): void {
  const group = getGroup(id);
  const step = group.steps.get(serial);
  if (!step || step.disabled) return;

  const from = group.current;
  group.isActive = true;
  group.current = serial;
  notify(group);
  if (from !== serial) {
    emit(group, 'step-change', { id, from, to: serial });
  }
}

/** 关闭指引（不触发 finish）。 */
export function stop(id: string): void {
  const group = getGroup(id);
  if (!group.isActive) return;
  deactivate(group);
  notify(group);
  emit(group, 'close', { id });
}

/** 结束指引。 */
export function finish(id: string): void {
  const group = getGroup(id);
  if (!group.isActive) return;
  deactivate(group);
  notify(group);
  emit(group, 'finish', { id });
}

/** 标记为「不再提示」并关闭。 */
export function dismiss(id: string): void {
  const group = getGroup(id);
  if (group.dontShowAgain) {
    dismissGuide(id);
  }
  const wasActive = group.isActive;
  deactivate(group);
  notify(group);
  emit(group, 'dont-show-again', { id });
  if (wasActive) {
    emit(group, 'close', { id });
  }
}

/** 清除「不再提示」标记。 */
export function reset(id: string): void {
  const group = getGroup(id);
  restoreGuide(id);
  notify(group);
}

/** 创建绑定到某个 id 的控制器，即 `useGuide(id)` 的返回值形状。 */
export function createController(id: string) {
  return {
    id,
    get steps() {
      return getSnapshot(id).steps;
    },
    get current() {
      return getSnapshot(id).current;
    },
    get isActive() {
      return getSnapshot(id).isActive;
    },
    get isDismissed() {
      return getSnapshot(id).isDismissed;
    },
    get stepCount() {
      return getSnapshot(id).stepCount;
    },
    start: (from?: number) => start(id, from),
    next: () => next(id),
    prev: () => prev(id),
    goTo: (serial: number) => goTo(id, serial),
    stop: () => stop(id),
    finish: () => finish(id),
    dismiss: () => dismiss(id),
    reset: () => reset(id),
  };
}

/** 仅供测试与调试：清空所有组状态。 */
export function resetEngine(): void {
  groups.clear();
}
