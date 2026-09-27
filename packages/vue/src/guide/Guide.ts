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
  type GuideEventName,
  type GuideGroupSnapshot,
  type GuideStepProps,
} from '@kpro/core';
import {
  cloneVNode,
  Comment,
  defineComponent,
  h,
  isVNode,
  onBeforeUnmount,
  onMounted,
  shallowRef,
  watch,
  type ComponentPublicInstance,
  type VNode,
} from 'vue';
import GuideOverlay from './GuideOverlay.vue';
import { guideProps } from './GuideProvider';

/** 把 ref 回调拿到的值解析为真实 DOM 元素。 */
function resolveElement(value: unknown): HTMLElement | null {
  if (value instanceof HTMLElement) return value;
  const instance = value as ComponentPublicInstance | null;
  const el = instance?.$el;
  if (el instanceof HTMLElement) return el;
  return null;
}

/**
 * 指引步骤组件。
 *
 * 默认插槽中的 DOM 元素即为当前步骤的目标元素：该步骤激活时，
 * 组件会显示半透明遮罩、只高亮这个元素，并在其旁边展示步骤卡片。
 *
 * @example
 * ```vue
 * <KProGuide id="dashboard" :serial="1" title="第一步" content="点击这里新建">
 *   <button>新建</button>
 * </KProGuide>
 * ```
 */
export const Guide = defineComponent({
  name: 'KProGuide',
  props: guideProps,
  emits: ['step-change', 'next', 'prev', 'finish', 'close', 'dont-show-again'],
  setup(props, { slots, emit }) {
    injectStyles();

    const target = shallowRef<HTMLElement | null>(null);
    const snapshot = shallowRef<GuideGroupSnapshot>(getSnapshot(props.id));
    const unsubscribe = subscribe(props.id, () => {
      snapshot.value = getSnapshot(props.id);
    });

    /** 已注册的 { id, serial }，用于在 props 变化时注销旧值。 */
    let registered: { id: string; serial: number } | null = null;

    const syncRegistration = (): void => {
      if (registered && (registered.id !== props.id || registered.serial !== props.serial)) {
        unregisterStep(registered.id, registered.serial);
        registered = null;
      }
      registerStep(normalizeStep(props as GuideStepProps));
      registered = { id: props.id, serial: props.serial };
    };

    onMounted(syncRegistration);

    watch(
      () => [
        props.id,
        props.serial,
        props.title,
        props.content,
        props.placement,
        props.padding,
        props.showHighlight,
        props.maskOpacity,
        props.closable,
        props.showDontShowAgain,
        props.disabled,
        props.autoScroll,
      ],
      syncRegistration,
    );

    // 组级事件只由引擎指定的唯一步骤出口转发，避免同组多个步骤重复触发。
    let eventId: string | null = null;
    let eventStops: Array<() => void> = [];

    const reemit = (event: GuideEventName, payload: unknown): void => {
      if (!eventId) return;
      if (getSnapshot(eventId).eventOwner !== props.serial) return;
      (emit as unknown as (name: string, payload: unknown) => void)(event, payload);
    };

    const bindEvents = (id: string): void => {
      eventStops.forEach((stopBinding) => stopBinding());
      eventId = id;
      eventStops = [
        subscribeEvent(id, 'step-change', (payload) => reemit('step-change', payload)),
        subscribeEvent(id, 'next', (payload) => reemit('next', payload)),
        subscribeEvent(id, 'prev', (payload) => reemit('prev', payload)),
        subscribeEvent(id, 'finish', (payload) => reemit('finish', payload)),
        subscribeEvent(id, 'close', (payload) => reemit('close', payload)),
        subscribeEvent(id, 'dont-show-again', (payload) => reemit('dont-show-again', payload)),
      ];
    };

    watch(() => props.id, bindEvents, { immediate: true });

    onBeforeUnmount(() => {
      unsubscribe();
      eventStops.forEach((stopBinding) => stopBinding());
      eventStops = [];
      if (registered) {
        unregisterStep(registered.id, registered.serial);
        registered = null;
      }
    });

    // 保留插槽元素自身的 ref，同时把元素交给我们用于测量与高亮。
    let originalRef: VNode['ref'] = null;

    const applyOriginalRef = (value: unknown): void => {
      const ref = originalRef;
      if (!ref) return;
      if (typeof ref === 'function') {
        (ref as unknown as (value: unknown) => void)(value);
      } else if (typeof ref === 'object' && ref !== null) {
        (ref as unknown as { value: unknown }).value = value;
      }
    };

    const setTargetRef = (value: unknown): void => {
      target.value = resolveElement(value);
      applyOriginalRef(value);
    };

    const isCurrentStep = (): boolean =>
      snapshot.value.isActive && snapshot.value.current === props.serial && !props.disabled;

    const enabledSerials = (): number[] =>
      snapshot.value.steps.filter((step) => !step.disabled).map((step) => step.serial);

    // 步骤激活时按需滚动到可见区域。
    watch(
      () => [isCurrentStep(), target.value] as const,
      ([active, el]) => {
        if (!active || !el || props.autoScroll === false) return;
        scrollIntoViewIfNeeded(el);
      },
      { immediate: true },
    );

    return () => {
      const children = slots.default?.() ?? [];
      const first = children.find((child) => isVNode(child) && child.type !== Comment);

      let targetVNode: VNode | null = null;
      if (first) {
        originalRef = first.ref ?? null;
        targetVNode = cloneVNode(first, { ref: setTargetRef });
      } else {
        target.value = null;
      }

      const active = isCurrentStep();
      const index = enabledSerials().indexOf(props.serial);

      return [
        targetVNode,
        active
          ? h(GuideOverlay, {
              target: target.value,
              serial: props.serial,
              title: props.title,
              content: props.content,
              placement: props.placement,
              padding: props.padding,
              showHighlight: props.showHighlight === true,
              maskOpacity: props.maskOpacity,
              closable: props.closable,
              showDontShowAgain: props.showDontShowAgain !== false && snapshot.value.dontShowAgainEnabled,
              currentIndex: index + 1,
              total: enabledSerials().length,
              canPrev: index > 0,
              onNext: () => next(props.id),
              onPrev: () => prev(props.id),
              onClose: () => stop(props.id),
              onDismiss: () => dismiss(props.id),
            })
          : null,
      ];
    };
  },
});
