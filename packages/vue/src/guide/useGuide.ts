import type { GuideController, GuideGroupSnapshot } from '@kpro/core';
import {
  dismiss as engineDismiss,
  finish as engineFinish,
  getSnapshot,
  goTo as engineGoTo,
  next as engineNext,
  prev as enginePrev,
  reset as engineReset,
  start as engineStart,
  stop as engineStop,
  subscribe,
} from '@kpro/core';
import { onScopeDispose, shallowRef, type ShallowRef } from 'vue';

/** `useGuide` 的返回值：控制器 + 响应式快照。 */
export interface UseGuideResult extends GuideController {
  /** 响应式快照。模板中直接读取控制器的字段即可自动更新。 */
  readonly snapshot: ShallowRef<GuideGroupSnapshot>;
}

/**
 * 订阅某个指引组的状态，并返回操作该组的控制器。
 *
 * 返回对象的字段与方法命名与 React 版本完全一致，便于两个框架之间迁移。
 *
 * @example
 * ```ts
 * const guide = useGuide('dashboard');
 * guide.start();
 * ```
 */
export function useGuide(id: string): UseGuideResult {
  const snapshot = shallowRef(getSnapshot(id));
  const unsubscribe = subscribe(id, () => {
    snapshot.value = getSnapshot(id);
  });
  onScopeDispose(unsubscribe);

  return {
    id,
    snapshot,
    get steps() {
      return snapshot.value.steps;
    },
    get current() {
      return snapshot.value.current;
    },
    get isActive() {
      return snapshot.value.isActive;
    },
    get isDismissed() {
      return snapshot.value.isDismissed;
    },
    get stepCount() {
      return snapshot.value.stepCount;
    },
    start: (from?: number) => engineStart(id, from),
    next: () => engineNext(id),
    prev: () => enginePrev(id),
    goTo: (serial: number) => engineGoTo(id, serial),
    stop: () => engineStop(id),
    finish: () => engineFinish(id),
    dismiss: () => engineDismiss(id),
    reset: () => engineReset(id),
  };
}
