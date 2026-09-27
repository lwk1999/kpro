import type { GuideGroupSnapshot } from '@kpro/core';
import {
  dismiss,
  getSnapshot,
  injectStyles,
  next,
  normalizeStep,
  prev,
  registerStep,
  scrollIntoViewIfNeeded,
  stop,
  subscribe,
  subscribeEvent,
  unregisterStep,
} from '@kpro/core';
import {
  cloneElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type FC,
  type MutableRefObject,
  type ReactElement,
  type Ref,
} from 'react';
import { GuideOverlay } from './GuideOverlay';
import type { GuideProps } from './GuideProvider';

interface EventHandlers {
  onStepChange?: GuideProps['onStepChange'];
  onNext?: GuideProps['onNext'];
  onPrev?: GuideProps['onPrev'];
  onFinish?: GuideProps['onFinish'];
  onClose?: GuideProps['onClose'];
  onDontShowAgain?: GuideProps['onDontShowAgain'];
}

/** 把 ref 拿到的值解析为真实 DOM 元素。 */
function resolveElement(value: unknown): HTMLElement | null {
  if (typeof HTMLElement !== 'undefined' && value instanceof HTMLElement) return value;
  return null;
}

/** 把 ref 转发给使用方原本传入的 ref，避免覆盖。 */
function applyOriginalRef(original: Ref<unknown> | undefined, value: unknown): void {
  if (!original) return;
  if (typeof original === 'function') {
    original(value);
  } else if (typeof original === 'object' && original !== null) {
    (original as MutableRefObject<unknown>).current = value;
  }
}

/**
 * 指引步骤组件。
 *
 * 默认插槽（children）中的 DOM 元素即为当前步骤的目标元素：该步骤激活时，
 * 组件会显示半透明遮罩、只高亮这个元素，并在其旁边展示步骤卡片。
 * children 需为单个 DOM 元素，组件会通过 `cloneElement` 挂载 ref 以测量它。
 *
 * @example
 * ```tsx
 * <Guide id="dashboard" serial={1} title="第一步" content="点击这里新建">
 *   <button>新建</button>
 * </Guide>
 * ```
 */
export const Guide: FC<GuideProps> = ({
  id,
  serial,
  title,
  content,
  placement,
  padding,
  showHighlight,
  maskOpacity,
  closable,
  showDontShowAgain,
  disabled,
  autoScroll,
  children,
  onStepChange,
  onNext,
  onPrev,
  onFinish,
  onClose,
  onDontShowAgain,
}) => {
  injectStyles();

  const [target, setTarget] = useState<HTMLElement | null>(null);

  const subscribeToGroup = useCallback((onStoreChange: () => void) => subscribe(id, onStoreChange), [id]);
  const getGroupSnapshot = useCallback(() => getSnapshot(id), [id]);
  const snapshot = useSyncExternalStore<GuideGroupSnapshot>(
    subscribeToGroup,
    getGroupSnapshot,
    getGroupSnapshot,
  );

  // 注册 / 注销步骤。依赖逐项列出，任一属性变化都会重新注册。
  useEffect(() => {
    registerStep(
      normalizeStep({ id, serial, title, content, placement, padding, showHighlight, maskOpacity, closable, showDontShowAgain, disabled, autoScroll }),
    );
    return () => unregisterStep(id, serial);
  }, [id, serial, title, content, placement, padding, showHighlight, maskOpacity, closable, showDontShowAgain, disabled, autoScroll]);

  // 事件回调存入 ref，避免因内联函数每次渲染变化而反复重订阅。
  const handlersRef = useRef<EventHandlers>({});
  useEffect(() => {
    handlersRef.current = { onStepChange, onNext, onPrev, onFinish, onClose, onDontShowAgain };
  });

  // 组级事件只由引擎指定的唯一步骤出口转发，避免同组多个步骤重复触发。
  useEffect(() => {
    const stops = [
      subscribeEvent(id, 'step-change', (payload) => {
        if (getSnapshot(id).eventOwner !== serial) return;
        handlersRef.current.onStepChange?.(payload);
      }),
      subscribeEvent(id, 'next', (payload) => {
        if (getSnapshot(id).eventOwner !== serial) return;
        handlersRef.current.onNext?.(payload);
      }),
      subscribeEvent(id, 'prev', (payload) => {
        if (getSnapshot(id).eventOwner !== serial) return;
        handlersRef.current.onPrev?.(payload);
      }),
      subscribeEvent(id, 'finish', (payload) => {
        if (getSnapshot(id).eventOwner !== serial) return;
        handlersRef.current.onFinish?.(payload);
      }),
      subscribeEvent(id, 'close', (payload) => {
        if (getSnapshot(id).eventOwner !== serial) return;
        handlersRef.current.onClose?.(payload);
      }),
      subscribeEvent(id, 'dont-show-again', (payload) => {
        if (getSnapshot(id).eventOwner !== serial) return;
        handlersRef.current.onDontShowAgain?.(payload);
      }),
    ];

    return () => stops.forEach((stopSubscription) => stopSubscription());
  }, [id, serial]);

  // 保留 children 自身的 ref，同时把元素交给组件用于测量与高亮。
  const originalRef = (children as unknown as { ref?: Ref<unknown> }).ref;
  const setTargetRef = useCallback(
    (node: unknown) => {
      setTarget(resolveElement(node));
      applyOriginalRef(originalRef, node);
    },
    [originalRef],
  );

  const isCurrentStep = snapshot.isActive && snapshot.current === serial && !disabled;

  // 步骤激活时按需滚动到可见区域。
  useEffect(() => {
    if (!isCurrentStep || !target || autoScroll === false) return;
    scrollIntoViewIfNeeded(target);
  }, [isCurrentStep, target, autoScroll]);

  const enabledSerials = useMemo(
    () => snapshot.steps.filter((step) => !step.disabled).map((step) => step.serial),
    [snapshot],
  );
  const index = enabledSerials.indexOf(serial);

  const targetElement: ReactElement = cloneElement(children, { ref: setTargetRef } as Partial<unknown>);

  return (
    <>
      {targetElement}
      {isCurrentStep ? (
        <GuideOverlay
          target={target}
          serial={serial}
          title={title}
          content={content}
          placement={placement}
          padding={padding}
          showHighlight={showHighlight === true}
          maskOpacity={maskOpacity}
          closable={closable}
          showDontShowAgain={showDontShowAgain !== false && snapshot.dontShowAgainEnabled}
          currentIndex={index + 1}
          total={enabledSerials.length}
          canPrev={index > 0}
          onNext={() => next(id)}
          onPrev={() => prev(id)}
          onClose={() => stop(id)}
          onDismiss={() => dismiss(id)}
        />
      ) : null}
    </>
  );
};
