import type { GuideGroupSnapshot } from '@kpro/core';
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
import { useCallback, useMemo, useSyncExternalStore } from 'react';

/** `useGuide` 的返回值：控制器 + 只读快照。 */
export interface UseGuideResult {
  /** 只读快照，可直接在渲染中使用。 */
  snapshot: GuideGroupSnapshot;
  id: string;
  steps: GuideGroupSnapshot['steps'];
  current: number | null;
  isActive: boolean;
  isDismissed: boolean;
  stepCount: number;
  start: (from?: number) => void;
  next: () => void;
  prev: () => void;
  goTo: (serial: number) => void;
  stop: () => void;
  finish: () => void;
  dismiss: () => void;
  reset: () => void;
}

/**
 * 订阅某个指引组的状态，并返回操作该组的控制器。
 *
 * 返回对象的字段与方法命名与 Vue 版本完全一致，便于两个框架之间迁移。
 * 状态通过 `useSyncExternalStore` 订阅 core 引擎，因此组件树之外
 * （例如路由守卫）触发的指引同样会驱动界面更新。
 *
 * @example
 * ```tsx
 * const guide = useGuide('dashboard');
 * <button onClick={() => guide.start()}>开始引导</button>
 * ```
 */
export function useGuide(id: string): UseGuideResult {
  const subscribeToGroup = useCallback((onStoreChange: () => void) => subscribe(id, onStoreChange), [id]);
  const getGroupSnapshot = useCallback(() => getSnapshot(id), [id]);
  const snapshot = useSyncExternalStore(subscribeToGroup, getGroupSnapshot, getGroupSnapshot);

  return useMemo(
    () => ({
      snapshot,
      id,
      steps: snapshot.steps,
      current: snapshot.current,
      isActive: snapshot.isActive,
      isDismissed: snapshot.isDismissed,
      stepCount: snapshot.stepCount,
      start: (from?: number) => engineStart(id, from),
      next: () => engineNext(id),
      prev: () => enginePrev(id),
      goTo: (serial: number) => engineGoTo(id, serial),
      stop: () => engineStop(id),
      finish: () => engineFinish(id),
      dismiss: () => engineDismiss(id),
      reset: () => engineReset(id),
    }),
    [id, snapshot],
  );
}
